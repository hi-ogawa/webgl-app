//
// Projective dynamics (Bouaziz et. al.)
//

import _ from '../../web_modules/lodash.js'
import { Matrix, MatrixCSR } from './array.js'
import * as glm from './glm.js'
import * as Misc2 from './misc2.js'

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

    const pCumsum = Misc2.cumsum(constraints.map(c => c.globalStep.B.shape[1]))

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

// TODO: Surface
class Example01 {
  init () {
  }

  update () {
  }
}

export { Example00, Example01 }
