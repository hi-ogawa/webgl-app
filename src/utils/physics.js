/* eslint camelcase: 0, object-property-newline: 0 */
//
// Projective dynamics (Bouaziz et. al.)
//

import _ from '../../web_modules/lodash.js'
import { Matrix, MatrixCSR } from './array.js'
import * as glm from './glm.js'
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

class Example01 {
  init () {
    //
    // Configuration
    //
    const n = 6
    const g = 9.8
    const iterPD = 16
    const dt = 1 / 60
    const mass = 1

    //
    // Geometry
    //
    const { verts, f2v } = misc2.makeTriangle(n)
    const { vec3, mat3 } = glm
    const { sign, sqrt } = Math
    const eye3 = Matrix.eye([3, 3])
    const eye3neg = eye3.clone().muleqs(-1)

    const nV = verts.shape[0]
    const nF = f2v.shape[0]

    //
    // Constraints
    //
    const constraints = []
    const handles = []

    // Pin constraint for (0..n)-th vertices
    for (let i = 0; i <= n; i++) {
      const stiffness = 2 ** 14

      // Initially use rest position
      const rest = verts.row(i).slice()
      handles[i] = rest

      // TODO: Implement switching off constraint by p.set(x)
      const projection = (p, x) => {
        p.set(handles[i])
      }

      const weight = stiffness
      constraints.push({
        projection,
        selector: [i],
        A: eye3.clone().muleqs(weight),
        B: eye3.clone().muleqs(weight)
      })

      // TODO: just use one for now
      break
    }

    // Surface strain constraint for all faces
    // TODO: analyze weighting by area
    for (let j = 0; j < f2v.shape[0]; j++) {
      const stiffness = 64
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
      A.setSlice([[0, 3], [0, 3]], eye3neg) // TODO
      A.setSlice([[0, 3], [3, 6]], eye3)
      A.setSlice([[3, 6], [0, 3]], eye3neg)
      A.setSlice([[3, 6], [6, 9]], eye3)

      // Matrix P \in SO(3) is represented as a single vector R^9 as in
      // P u1 =  / u1^T          \  / Prow1 \
      //         |     u1^T      |  | Prow2 |
      //         \          u1^T /  \ Prow3 /
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

      const projection = (p, x0, x1, x2) => {
        // Cf. Procrustes problem
        // argmin_P |X - P Xr| = argmax_P Tr[P Xr XT] = V E UT = (U E VT)^T
        //   where
        //   - SVD decomp: Xr XT = U D VT
        //   - E = diag(sign(D11), sign(D22), sign(D11) * sign(D22)) (note that D33 = 0)
        const u1 = vec3.sub(x1, x0)
        const u2 = vec3.sub(x2, x0)
        const X = [...u1, ...u2, 0, 0, 0]

        const { matmul, transpose } = mat3
        const W = matmul(X_rest, transpose(X))
        const [U, D, VT] = mat3.svdNonInvertible(W)

        const E = mat3.diag([sign(D[0]), sign(D[1]), sign(D[0]) * sign(D[1])])
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

    const A = Matrix.stack(As)
    const B = Matrix.stackDiagonal(Bs)
    const AT = A.transpose()
    const AT_B = AT.matmul(B)
    const AT_A = AT.matmul(A)

    const Md = M.clone().diveqs(dt ** 2) // M / dt^2
    const E = Md.clone().addeq(AT_A) // E = M / dt^2 + A^T A
    const Esparse = MatrixCSR.fromDense(E)

    // Initial position
    const xx = verts.clone()
    const x = xx.reshape([-1, 1]) // Single vector view
    const x0 = x.clone() // Need to keep previous state during `update`

    // Initial velocity
    const vv = Matrix.emptyLike(xx)
    const v = vv.reshape([-1, 1]) // Single vector view

    // Projection variable (used as temporary variable during `update`, so allocate it here)
    const p = Matrix.empty([nP, 1])

    _.assign(this, {
      g, iterPD, dt, mass,
      constraints, handles, pCumsum,
      Md, AT_B, Esparse,
      xx, x, x0, vv, v, p,
      nV, nF, nP,
      verts, f2v
    })
  }

  update () {
    const {
      g, iterPD, dt,
      constraints, pCumsum,
      Md, AT_B, Esparse,
      xx, x, x0, vv, v, p,
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
      // Local step: invoke each constraint projection to obtain p
      for (let j = 0; j < constraints.length; j++) {
        const { projection, selector } = constraints[j]
        const selectP = p.data.subarray(pCumsum[j], pCumsum[j + 1])
        const selectXs = _.map(selector, s => xx.row(s))
        projection(selectP, ...selectXs)
      }

      // Global step: solve (Md + A^T A) x' = Md x + A^T B p
      const rhs = Md.matmul(x).addeq(AT_B.matmul(p))
      Esparse.conjugateGradient(x, rhs)
    }

    // Reset velocity (v = (x - x0) / dt)
    v.copy(x)
    v.subeq(x0).diveqs(dt)

    // Update previous state
    x0.copy(x)
  }
}

export { Example00, Example01 }
