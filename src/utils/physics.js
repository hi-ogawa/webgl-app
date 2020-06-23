//
// Projective dynamics (Bouaziz et. al.)
//

import _ from '../../web_modules/lodash.js'
import { Matrix, MatrixCSR } from './array.js'
import * as glm from './glm.js'

class Example00 {
  init () {
    const { sqrt } = Math
    const { sub, diveqs, normalizeeq } = glm.vec3

    // 1. Curve geometry (subdivide interval [0, 1])
    const nV = 16
    const verts = Matrix.empty([nV, 3])
    for (let i = 0; i < nV; i++) {
      verts.row(i).set([i / nV, 0, 0])
    }

    // 2. Construct constraint where single constraint is a tuple of
    //    - local step projection
    //    - global step quadratic form (B.shape[1] corresdponds to the dimention of its projection variable)
    const constraints = []

    // 2.1. Pin 1st vertex at 0
    const pinPosition = [0, 0, 0]
    {
      const stiffness = 1024

      // Select 1st vertex
      const A = Matrix.empty([3, 3 * nV])
      _.range(3).forEach(i => A.set(i, i, sqrt(stiffness)))

      // Identity
      const B = Matrix.empty([3, 3])
      _.range(3).forEach(i => B.set(i, i, sqrt(stiffness)))

      constraints.push({
        variableWidth: 3,
        localStep: (x, p) => {
          const offset = 0
          p.data.set(pinPosition, offset)
        },
        globalStep: { A, B }
      })
    }

    // 2.2. Strain constraint
    for (let i = 0; i < nV - 1; i++) {
      // TODO:
      // Does this correspond to something physically measurable quantity
      // at stationary states under gravity?
      const stiffness = 16

      // i-th edge vector
      const A = Matrix.empty([3, 3 * nV])
      _.range(3).forEach(j => {
        A.set(j, j + 3 * i, -1 * sqrt(stiffness))
        A.set(j, j + 3 * (i + 1), 1 * sqrt(stiffness))
      })

      // Identity
      const B = Matrix.empty([3, 3])
      _.range(3).forEach(i => B.set(i, i, 1 * sqrt(stiffness)))

      constraints.push({
        variableWidth: 3,
        localStep: (x, p) => {
          // p = |e_rest| \hat{e}
          x = x.reshape([nV, 3])
          const q = diveqs(normalizeeq(sub(x.row(i + 1), x.row(i))), nV)
          const offset = 3 * (i + 1)
          p.data.set(q, offset)
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

    // 4. Numerical integration
    const g = 9.8
    const iterPD = 16

    // Position
    const x = Matrix.empty([3 * nV, 1])
    x.data.set(verts.data)

    // Velocity
    const v = Matrix.emptyLike(x)

    const t = 0
    _.assign(this, {
      x, v, t, dt, Md, ATB, Esparse, constraints, iterPD, B, nV, g,
      pinPosition,
    })
  }

  update () {
    const {
      x, v, dt, Md, ATB, Esparse, constraints, iterPD, B, nV, g
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
    //   - Wind
    // for (let i = 0; i < nV; i++) {
    //   const mu = 1
    //   let wind = 0.0
    //   const { PI, cos } = Math
    //   wind = wind * cos(2 * PI * t / 4)
    //   v.data[3 * i + 2] += (- mu * (v.data[3 * i + 2] - wind))
    // }

    // - Integrate position
    x.addeq(v.clone().muleqs(dt))

    // Projective dynamics iteration
    const p = Matrix.empty([B.shape[1], 1])
    for (let i = 0; i < iterPD; i++) {
      // Local step: invoke each constraint projection to obtain p
      for (const c of constraints) {
        c.localStep(x, p)
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

export { Example00 }
