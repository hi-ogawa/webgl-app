/* eslint camelcase: 0, object-property-newline: 0 */
//
// Projective dynamics (Bouaziz et. al.)
//
// TODO
// - dynamic constraint (e.g. for collision)
// - more sparse matrix during init
//

import _ from '../../web_modules/lodash.js'
import { Matrix, MatrixCSR } from './array.js'
import * as glm from './glm.js'
import * as ddg from './ddg.js'
import * as misc2 from './misc2.js'

// Curve
class Example00 {
  init () {
    const { sqrt } = Math
    const { sub, muleqs, normalizeeq } = glm.vec3

    // 1. Curve geometry (subdivide interval [0, 1])
    // TODO: dynamics should converge to "something" when nV -> \infty. (Note that total mass is fixed to "1", see below)
    //       but, probably `iterPD` has to be increased.
    const nV = 32
    const verts = Matrix.empty([nV, 3])
    for (let i = 0; i < nV; i++) {
      verts.row(i).set([i / nV, 0, 0])
    }

    // 2. Construct constraint where single constraint is a tuple of
    //    - local step projection
    //    - global step quadratic form (B.shape[1] corresdponds to the dimention of its projection variable)
    const constraints = []

    // 2.1. Pin 1st and 2nd verteces
    const pinPositions = [[0, 0, 0], [0, 0, 0]] // This will be mutated as interaction handle (cf. ex20_physics)
    for (let i = 0; i < pinPositions.length; i++) {
      const stiffness = 2 ** 14

      // Select 1st vertex
      const A = Matrix.empty([3, 3 * nV])
      _.range(3).forEach(j => A.set(j, j + 3 * i, 1))

      // Identity
      const B = Matrix.empty([3, 3])
      _.range(3).forEach(j => B.set(j, j, 1))

      A.muleqs(sqrt(stiffness))
      B.muleqs(sqrt(stiffness))

      constraints.push({
        localStep: (x, p) => p.set(pinPositions[i]),
        globalStep: { A, B }
      })
    }

    // 2.2. Strain constraint
    for (let i = 0; i < nV - 1; i++) {
      // TODO:
      // Does this correspond to something physically measurable quantity
      // at stationary states under gravity?
      const stiffness = 1024
      const rest = 1 / nV // rest edge length

      // i-th edge vector
      const A = Matrix.empty([3, 3 * nV])
      _.range(3).forEach(j => {
        A.set(j, j + 3 * i, -1)
        A.set(j, j + 3 * (i + 1), 1)
      })

      // Identity
      const B = Matrix.empty([3, 3])
      _.range(3).forEach(i => B.set(i, i, 1))

      A.muleqs(sqrt(stiffness))
      B.muleqs(sqrt(stiffness))

      constraints.push({
        localStep: (x, p) => {
          // p = |e_rest| \hat{e}
          x = x.reshape([nV, 3])
          const e = sub(x.row(i + 1), x.row(i))
          p.set(muleqs(normalizeeq(e), rest))
        },
        globalStep: { A, B }
      })
    }

    // 2.3. Curvature constraint
    for (let i = 0; i < nV - 2; i++) {
      // Make tail softer
      const sHead = 1.0
      const sTail = 0.01
      const stiffness = glm.scalar.mix(sHead, sTail, i / (nV - 3))
      const rest = 1 / nV // rest edge length

      // NOTE:
      // This Laplacian is derived via DEC (discrete exterior calculus) as primal 0-form to dual 1-form,
      // but underlying geometry comes from rest state, thus this is nothing but approximation for deformed state.
      // Of course, if we construct Laplacian based on deformed state, then it becomes non-linear w.r.t. state
      // and thus projective dynamics is not applicable.

      // TODO:
      // maybe take into account "sqrt" of dual edge volume

      // (i+1)-th dual edge (i.e. interior vertex)
      const A = Matrix.empty([3, 3 * nV])
      _.range(3).forEach(j => {
        A.set(j, j + 3 * i, 1 / rest)
        A.set(j, j + 3 * (i + 1), -2 / rest)
        A.set(j, j + 3 * (i + 2), 1 / rest)
      })

      // Identity
      const B = Matrix.empty([3, 3])
      _.range(3).forEach(i => B.set(i, i, 1))

      A.muleqs(sqrt(stiffness))
      B.muleqs(sqrt(stiffness))

      constraints.push({
        localStep: (x, p) => {
          p.set([0, 0, 0])
        },
        globalStep: { A, B }
      })
    }

    // 3. Constract matrices for global step
    const M = Matrix.empty([3 * nV, 3 * nV])
    _.range(3 * nV).forEach(i => {
      M.set(i, i, 1 / nV) // total mass of line is "1"
    })

    const A = Matrix.stack(constraints.map(c => c.globalStep.A))
    const B = Matrix.stackDiagonal(constraints.map(c => c.globalStep.B))
    const AT = A.transpose()
    const ATB = AT.matmul(B)
    const ATA = AT.matmul(A)

    const dt = 1 / 60
    const Md = M.clone().diveqs(dt ** 2) // M / dt^2
    const E = Md.clone().addeq(ATA) // E = M / dt^2 + A^T A
    const Esparse = MatrixCSR.fromDense(E)

    const pCumsum = misc2.cumsum(constraints.map(c => c.globalStep.B.shape[1]))

    // 4. Numerical integration
    const g = 9.8 // TODO: analyze stationary state under gravity
    const iterPD = 16 // TODO: analyze relevance to convergence

    // Position
    const x = Matrix.empty([3 * nV, 1])
    x.data.set(verts.data)

    // Velocity
    const v = Matrix.emptyLike(x)

    const t = 0
    _.assign(this, {
      x, v, t, dt, Md, ATB, Esparse, constraints, iterPD, B, nV, g, pinPositions, pCumsum
    })
  }

  update () {
    const {
      x, v, dt, Md, ATB, Esparse, constraints, iterPD, B, nV, g, pCumsum
    } = this

    let {
      t
    } = this

    const x0 = x.clone() // Save previous state for later use

    // Handle external force
    // - Integrate velocity
    //   - Gravity (\partial_t v = - g \hat{y})
    for (let i = 0; i < nV; i++) {
      v.data[3 * i + 1] -= dt * g
    }
    // - Integrate position
    x.addeq(v.clone().muleqs(dt))

    // Projective dynamics iteration
    const p = Matrix.empty([B.shape[1], 1])
    for (let i = 0; i < iterPD; i++) {
      // Local step: invoke each constraint projection to obtain p
      // TODO: should also return residue for estimating error?
      for (let j = 0; j < constraints.length; j++) {
        constraints[j].localStep(x, p.data.subarray(pCumsum[j], pCumsum[j + 1]))
      }

      // Global step: solve (Md + A^T A) x' = Md x + A^T B p
      //                    <=> min_x' |x' - x|^2_Md + |A x' - B p|^2
      const rhs = Md.matmul(x).addeq(ATB.matmul(p))
      Esparse.conjugateGradient(x, rhs)
    }

    // Reset velocity (v = (x - x0) / dt)
    v.copy(x)
    v.subeq(x0).diveqs(dt)

    t += dt
    _.assign(this, {
      t
    })
  }
}

// Surface
class Example01 {
  init (verts, f2v, handles) {
    //
    // Configuration
    //
    const g = 9.8
    const iterPD = 16
    const dt = 1 / 60
    const mass = 1

    //
    // Geometry
    //
    const { vec3, mat3 } = glm
    const { sqrt } = Math
    const eye3 = Matrix.eye([3, 3])
    const eye3neg = eye3.clone().muleqs(-1)

    const nV = verts.shape[0]
    const nF = f2v.shape[0]

    //
    // Constraints
    //
    const constraints = []

    // Pin constraint (`handle.target` will be mutated by the user before `update`)
    for (const handle of handles) {
      const stiffness = 2 ** 14

      const projection = (p, x) => {
        p.set(handle.target)
        // TODO:
        //   I thought setting `x` would make it equivalent to no constraint,
        //   but that is wrong since this simply forces x to follow "explicit method" solution.
        //   But, then how would people implement dynamic constraint e.g. for collision??
        // p.set(handle.enabled ? handle.target : x)
      }

      const weight = stiffness
      constraints.push({
        projection,
        selector: [handle.vertex],
        A: eye3.clone().muleqs(weight),
        B: eye3.clone().muleqs(weight)
      })
    }

    // Surface strain constraint for all faces
    // TODO: analyze weighting by area
    for (let j = 0; j < f2v.shape[0]; j++) {
      const stiffness = 2 ** 7
      const vs = f2v.row(j)
      const x0 = verts.row(vs[0])
      const x1 = verts.row(vs[1])
      const x2 = verts.row(vs[2])
      const u1_rest = vec3.sub(x1, x0)
      const u2_rest = vec3.sub(x2, x0)
      const X_rest = [
        ...u1_rest,
        ...u2_rest,
        0, 0, 0
      ]

      const A = Matrix.empty([6, 9])
      A.setSlice([[0, 3], [0, 3]], eye3neg)
      A.setSlice([[0, 3], [3, 6]], eye3)
      A.setSlice([[3, 6], [0, 3]], eye3neg)
      A.setSlice([[3, 6], [6, 9]], eye3)

      // Matrix P \in SO(3) is represented as a single vector R^9 as in
      // P u1 =  / u1^T          \  / Prow1^T \
      //         |     u1^T      |  | Prow2^T |
      //         \          u1^T /  \ Prow3^T /
      const B = Matrix.empty([6, 9])
      {
        const m1 = Matrix.fromArray(u1_rest, [1, 3])
        const m2 = Matrix.fromArray(u2_rest, [1, 3])
        B.setSlice([[0, 1], [0, 3]], m1)
        B.setSlice([[1, 2], [3, 6]], m1)
        B.setSlice([[2, 3], [6, 9]], m1)
        B.setSlice([[3, 4], [0, 3]], m2)
        B.setSlice([[4, 5], [3, 6]], m2)
        B.setSlice([[5, 6], [6, 9]], m2)
      }

      const { matmul, transpose, det } = mat3 // eslint-disable-line

      const projection = (p, x0, x1, x2) => {
        // Cf. Procrustes problem
        // argmin_P |X - P Xr| = argmax_P Tr[P Xr XT] = V E UT = (U E VT)^T
        //   where
        //   - SVD decomp: Xr XT = U D VT
        //   - E = diag(1, 1, det(U VT)) (flip smallest diagonal's sign if U.VT is inverted)
        //         (for 2d case, D[2, 2] = 0, so this actually doesn't affect strain energy)

        // [ Before inline ]
        // const u1 = vec3.sub(x1, x0)
        // const u2 = vec3.sub(x2, x0)
        // const X = [...u1, ...u2, 0, 0, 0]
        // const W = matmul(X_rest, transpose(X))

        // [ Inline ]
        const u1 = [x1[0] - x0[0], x1[1] - x0[1], x1[2] - x0[2]]
        const u2 = [x2[0] - x0[0], x2[1] - x0[1], x2[2] - x0[2]]
        const XT = [
          u1[0], u2[0], 0,
          u1[1], u2[1], 0,
          u1[2], u2[2], 0
        ]
        const W = matmul(X_rest, XT)

        const [U, D, VT] = mat3.svdNonInvertible(W) // eslint-disable-line
        const E = mat3.diag([1, 1, det(U) * det(VT)])
        const U_E_VT = matmul(U, matmul(E, VT))
        p.set(U_E_VT)
      }

      const weight = stiffness
      constraints.push({
        projection,
        selector: vs,
        A: A.muleqs(sqrt(weight)),
        B: B.muleqs(sqrt(weight))
      })
    }

    // Surface mean curvature constraint for all dual faces
    {
      // Laplacian based on rest surface
      let L = ddg.computeLaplacianV2(verts, f2v)
      L = MatrixCSR.fromCOO(L)
      L.sumDuplicates()

      // Make boundary vertices selector
      const { d1, c1xc0 } = ddg.computeD1(f2v, nV)
      const { d0 } = ddg.computeD0(c1xc0, nV)
      const { c0B } = ddg.computeBoundaryC2(d0, d1)
      const Si = ddg.toSelectorMatrix(c0B.negate().data)
      const nVI = Si.shape[0] // interior verts count

      // Select all
      const selector = _.range(nV)

      // R^{3 * nVI x 3 * nV}
      const A = Matrix.empty([3 * nVI, 3 * nV])
      const Si_L = Si.matmulCsr(L) // Laplacian restricted to interior

      // TODO: for now manually duplicate to three components
      for (let i = 0; i < Si_L.shape[0]; i++) {
        for (let p = Si_L.indptr[i]; p < Si_L.indptr[i + 1]; p++) {
          const j = Si_L.indices[p]
          const v = Si_L.data[p]
          A.set(3 * i, 3 * j, v)
          A.set(3 * i + 1, 3 * j + 1, v)
          A.set(3 * i + 2, 3 * j + 2, v)
        }
      }

      // R^{3 * nVI x 1}
      const B = Matrix.empty([3 * nVI, 3]) // = 0
      const projection = () => {} // no-op

      const weight = 4
      constraints.push({
        projection,
        selector,
        A: A.muleqs(sqrt(weight)),
        B
      })
    }

    //
    // Precomputation
    //
    const M = Matrix.eye([3 * nV, 3 * nV]).muleqs(mass / nV)
    const pCumsum = misc2.cumsum(constraints.map(c => c.B.shape[1]))
    const nP = pCumsum[constraints.length]

    const As = []
    const Bs = []
    for (const { selector, A, B } of constraints) {
      if (!(A.shape[1] === 3 * selector.length)) {
        throw new Error('[Example01.init]')
      }
      const S = Matrix.empty([3 * selector.length, 3 * nV])
      for (let i = 0; i < selector.length; i++) {
        const s = selector[i]
        S.setSlice([[3 * i, 3 * i + 3], [3 * s, 3 * s + 3]], eye3)
      }
      As.push(A.matmul(S))
      Bs.push(B)
    }

    const A = Matrix.stack(As) // shape = 6 nF x 3 nV
    const B = Matrix.stackDiagonal(Bs) // shape = 6 nF x 9 nF
    const AT = A.transpose()
    const AT_sparse = MatrixCSR.fromDense(AT) // Avoid dense matmul AT @ A and AT @ B
    const AT_B = Matrix.empty([AT.shape[0], B.shape[1]])
    const AT_A = Matrix.empty([AT.shape[0], A.shape[1]])
    AT_sparse.matmul(AT_B, B)
    AT_sparse.matmul(AT_A, A)

    const Md = M.clone().diveqs(dt ** 2) // M / dt^2
    const E = Md.clone().addeq(AT_A) // E = M / dt^2 + A^T A
    const E_sparse = MatrixCSR.fromDense(E)
    const E_cholesky = E_sparse.choleskyComputeV3()

    // [ Debug choleskyCompute ]
    // const LT = E_cholesky.toDense()
    // const L = LT.transpose()
    // console.log(E.clone().subeq(L.matmul(LT)).dotHS2())

    const Md_vec = new Matrix(MatrixCSR.fromDense(Md).data, [3 * nV, 1])
    const AT_B_sparse = MatrixCSR.fromDense(AT_B)

    // Initial position
    const xx = verts
    const x = xx.reshape([-1, 1]) // Single vector view
    const x0 = x.clone() // Need to keep previous state during `update`

    // Initial velocity
    const vv = Matrix.emptyLike(xx)
    const v = vv.reshape([-1, 1]) // Single vector view

    // Projection variable (used as temporary variable during `update`, so allocate it here)
    const p = Matrix.empty([nP, 1])

    // Temporary variables
    const tmp1 = Matrix.emptyLike(x)
    const tmp2 = Matrix.emptyLike(x)

    _.assign(this, {
      g, iterPD, dt, mass,
      constraints, pCumsum,
      Md_vec, AT_B_sparse, E_sparse, E_cholesky,
      xx, x, x0, vv, v, p, tmp1, tmp2,
      nV, nF, nP,
      verts, f2v
    })
  }

  update () {
    const {
      g, iterPD, dt,
      constraints, pCumsum,
      Md_vec, AT_B_sparse, E_sparse, E_cholesky, // eslint-disable-line
      xx, x, x0, vv, v, p, tmp1, tmp2,
      nV
    } = this

    const { addeq, muls } = glm.vec3

    // Define external force
    const force = [0, -g, 0]

    // Integrate velocity
    for (let i = 0; i < nV; i++) {
      addeq(vv.row(i), force)
    }

    // Integrate position
    for (let i = 0; i < nV; i++) {
      addeq(xx.row(i), muls(vv.row(i), dt))
    }

    // Projective dynamics iteration
    for (let i = 0; i < iterPD; i++) {
      // misc2.measure('projection', () => {

      // Local step: invoke each constraint projection to obtain p
      for (let j = 0; j < constraints.length; j++) {
        const { projection, selector } = constraints[j]
        const selectP = p.data.subarray(pCumsum[j], pCumsum[j + 1])
        // NOTE: `_.map(selector, s => xx.row(s))` is terribly slow.
        const selectXs = _.range(selector.length).map(i => xx.row(selector[i]))
        projection(selectP, ...selectXs)
      }

      // }) // measure projection

      // Global step: solve (Md + A^T A) x' = Md x + A^T B p
      const rhs = tmp1.copy(Md_vec).muleq(x).addeq(AT_B_sparse.matmul(tmp2, p))

      // [ Compare with conjugateGradient ]
      // misc2.measure('conjugateGradient', () => {
      // E_sparse.conjugateGradient(x, rhs)
      // })

      // misc2.measure('choleskySolve', () => {

      E_cholesky.choleskySolveV3(x, rhs)

      // }) // measure choleskySolve

      // [ Debug choleskySolve ]
      // const Ex = E_sparse.matmul(Matrix.emptyLike(x), x)
      // console.log(Ex.subeq(rhs).dotHS2())
    }

    // Reset velocity (v = (x - x0) / dt)
    v.copy(x)
    v.subeq(x0).diveqs(dt)

    // Update previous state
    x0.copy(x)
  }
}

// Volume
class Example02 {
  init (verts, c3xc0, handles) {
    //
    // Configuration
    //
    const g = 9.8
    const iterPD = 16
    const dt = 1 / 60
    const mass = 1

    //
    // Misc setup
    //
    const { vec3, mat3 } = glm
    const { sqrt } = Math
    const eye3 = Matrix.eye([3, 3])
    const eye3neg = eye3.clone().muleqs(-1)

    const nV = verts.shape[0]
    const nC3 = c3xc0.shape[0]

    //
    // Constraints
    //
    const constraints = []

    // Pin constraint (`handle.target` will be mutated by the user before `update`)
    for (const handle of handles) {
      const stiffness = 2 ** 12

      const projection = (p, x) => {
        p.set(handle.target)
      }

      const weight = stiffness
      constraints.push({
        projection,
        selector: [handle.vertex],
        A: eye3.clone().muleqs(sqrt(weight)),
        B: eye3.clone().muleqs(sqrt(weight))
      })
    }

    // Volume strain constraint
    for (let i = 0; i < nC3; i++) {
      const stiffness = 2 ** 5
      const vs = c3xc0.row(i)
      const x0 = verts.row(vs[0])
      const x1 = verts.row(vs[1])
      const x2 = verts.row(vs[2])
      const x3 = verts.row(vs[3])
      const u1_rest = vec3.sub(x1, x0)
      const u2_rest = vec3.sub(x2, x0)
      const u3_rest = vec3.sub(x3, x0)
      const X_rest = [...u1_rest, ...u2_rest, ...u3_rest]

      const A = Matrix.empty([9, 12])
      A.setSlice([[0, 3], [0, 3]], eye3neg)
      A.setSlice([[0, 3], [3, 6]], eye3)
      A.setSlice([[3, 6], [0, 3]], eye3neg)
      A.setSlice([[3, 6], [6, 9]], eye3)
      A.setSlice([[6, 9], [0, 3]], eye3neg)
      A.setSlice([[6, 9], [9, 12]], eye3)

      // Matrix P \in SO(3) is represented as a single vector R^9 as in
      // P u1 =  / u1^T          \  / Prow1^T \
      //         |     u1^T      |  | Prow2^T |
      //         \          u1^T /  \ Prow3^T /
      const B = Matrix.empty([9, 9])
      {
        const m1 = Matrix.fromArray(u1_rest, [1, 3])
        const m2 = Matrix.fromArray(u2_rest, [1, 3])
        const m3 = Matrix.fromArray(u3_rest, [1, 3])
        B.setSlice([[0, 1], [0, 3]], m1)
        B.setSlice([[1, 2], [3, 6]], m1)
        B.setSlice([[2, 3], [6, 9]], m1)
        B.setSlice([[3, 4], [0, 3]], m2)
        B.setSlice([[4, 5], [3, 6]], m2)
        B.setSlice([[5, 6], [6, 9]], m2)
        B.setSlice([[6, 7], [0, 3]], m3)
        B.setSlice([[7, 8], [3, 6]], m3)
        B.setSlice([[8, 9], [6, 9]], m3)
      }

      const { matmul, transpose, det } = mat3

      const projection = (p, x0, x1, x2, x3) => {
        const u1 = vec3.sub(x1, x0)
        const u2 = vec3.sub(x2, x0)
        const u3 = vec3.sub(x3, x0)
        const X = [...u1, ...u2, ...u3]
        const W = matmul(X_rest, transpose(X))

        // TODO: SVD might be not robust enough
        const [U, _D, VT] = mat3.svd(W) // eslint-disable-line
        const E = mat3.diag([1, 1, det(U) * det(VT)])
        const U_E_VT = matmul(U, matmul(E, VT))
        p.set(U_E_VT)
      }

      const weight = stiffness
      constraints.push({
        projection,
        selector: vs,
        A: A.muleqs(sqrt(weight)),
        B: B.muleqs(sqrt(weight))
      })
    }

    //
    // Precomputation
    //
    const Md_vec = Matrix.empty([3 * nV, 1])
    Md_vec.data.fill((mass / nV) / (dt ** 2)) // M / dt^2
    const Md_sparse = MatrixCSR.fromDiagonal(Md_vec.data)

    const pCumsum = misc2.cumsum(constraints.map(c => c.B.shape[1]))
    const nP = pCumsum[constraints.length]

    const As_sparse = []
    const Bs = []

    constraints.forEach(({ A, B, selector }) => {
      const S = MatrixCSR.fromSelector(selector, nV, 3)
      const AS = MatrixCSR.fromDense(A).matmulCsr(S)
      As_sparse.push(AS)
      Bs.push(B)
    })

    const A_sparse = MatrixCSR.stackCsr(As_sparse)
    const AT_sparse = A_sparse.transpose()
    const AT_A_sparse = AT_sparse.matmulCsr(A_sparse)

    const B_sparse = MatrixCSR.stackDiagonal(Bs) // volume strain (9 nC3 x 9 nC3)
    const AT_B_sparse = AT_sparse.matmulCsr(B_sparse)
    const E_sparse = AT_A_sparse.addeq(Md_sparse)
    let E_cholesky

    // misc2.measure('choleskyCompute', () => {

    E_cholesky = E_sparse.choleskyComputeV3() // eslint-disable-line

    // }) // measure projection

    // Initial position
    const xx = verts
    const x = xx.reshape([-1, 1]) // Single vector view
    const x0 = x.clone() // Need to keep previous state during `update`

    // Initial velocity
    const vv = Matrix.emptyLike(xx)
    const v = vv.reshape([-1, 1]) // Single vector view

    // Projection variable (used as temporary variable during `update`, so allocate it here)
    const p = Matrix.empty([nP, 1])

    // Temporary variables
    const tmp1 = Matrix.emptyLike(x)
    const tmp2 = Matrix.emptyLike(x)
    const tmp3 = Matrix.emptyLike(x)

    _.assign(this, {
      g, iterPD, dt, mass,
      constraints, pCumsum,
      Md_vec, AT_B_sparse, E_sparse, E_cholesky,
      xx, x, x0, vv, v, p, tmp1, tmp2, tmp3,
      nV, nC3, nP,
      verts, c3xc0
    })
  }

  update () {
    const {
      g, iterPD, dt,
      constraints, pCumsum,
      Md_vec, AT_B_sparse, E_sparse, E_cholesky, // eslint-disable-line
      xx, x, x0, vv, v, p, tmp1, tmp2, tmp3,
      nV
    } = this

    const { addeq, muls } = glm.vec3

    // Define external force
    const force = [0, -g, 0]

    // Integrate velocity
    for (let i = 0; i < nV; i++) {
      addeq(vv.row(i), force)
    }

    // Integrate position
    for (let i = 0; i < nV; i++) {
      addeq(xx.row(i), muls(vv.row(i), dt))
    }

    // Projective dynamics iteration
    for (let i = 0; i < iterPD; i++) {
      // misc2.measure('projection', () => {

      // Local step: invoke each constraint projection to obtain p
      for (let j = 0; j < constraints.length; j++) {
        const { projection, selector } = constraints[j]
        const selectP = p.data.subarray(pCumsum[j], pCumsum[j + 1])
        // NOTE: `_.map(selector, s => xx.row(s))` is terribly slow.
        const selectXs = _.range(selector.length).map(i => xx.row(selector[i]))
        projection(selectP, ...selectXs)
      }

      // }) // measure projection

      let rhs // eslint-disable-line
      // misc2.measure('rhs', () => {

      // Global step: solve (Md + A^T A) x' = Md x + A^T B p
      rhs = tmp1.copy(Md_vec).muleq(x).addeq(AT_B_sparse.matmul(tmp2, p)) // eslint-disable-line

      // }) // measure rhs

      // misc2.measure('choleskySolve', () => {

      E_cholesky.choleskySolveV3(x, rhs, tmp3)

      // }) // measure choleskySolve
    }

    // Reset velocity (v = (x - x0) / dt)
    v.copy(x)
    v.subeq(x0).diveqs(dt)

    // Update previous state
    x0.copy(x)
  }
}

export { Example00, Example01, Example02 }
