/* global describe, it */

import _ from '../../web_modules/lodash.js'
import * as glm from './glm.js'
import { hash11 } from './hash.js'
import { closeTo, deepEqual, deepCloseTo } from './test-misc.js'

describe('glm', () => {
  describe('vec3', () => {
    it('works 0', () => {
      const { subeq } = glm.vec3
      const v0 = [7, 11, 13]
      const v1 = [2, 3, 5]

      deepEqual(subeq(v0, v1), [5, 8, 8])
      deepEqual(v0, [5, 8, 8])
    })

    it('works 1', () => {
      const { matmuleq } = glm.vec3
      const v = [2, 3, 5]
      const m = [
        1, 2, 3,
        10, 20, 30,
        100, 200, 300
      ]
      deepEqual(matmuleq(m, v), [532, 1064, 1596])
      deepEqual(v, [532, 1064, 1596])
    })
  })

  describe('mat3', () => {
    describe('axisAngle', () => {
      it('works 0', () => {
        const { PI } = Math
        const { axisAngle } = glm.mat3

        deepCloseTo(axisAngle([1, 0, 0], 0.5 * PI), [
          1, 0, 0,
          0, 0, 1,
          0, -1, 0
        ])
        deepCloseTo(axisAngle([0, 1, 0], 0.5 * PI), [
          0, 0, -1,
          0, 1, 0,
          1, 0, 0
        ])
        deepCloseTo(axisAngle([0, 0, 1], 0.5 * PI), [
          0, 1, 0,
          -1, 0, 0,
          0, 0, 1
        ])
      })
    })

    describe('inverse', () => {
      it('works 0', () => {
        const { inverse, matmul } = glm.mat3
        const a = [
          2, 0, 0,
          0, 3, 0,
          0, 0, 5
        ]
        deepCloseTo(inverse(a), [
          1 / 2, 0, 0,
          0, 1 / 3, 0,
          0, 0, 1 / 5
        ])
        deepCloseTo(matmul(a, inverse(a)), [
          1, 0, 0,
          0, 1, 0,
          0, 0, 1
        ])
      })

      it('works 0', () => {
        const { normalize, cross } = glm.vec3
        const { inverse, transpose } = glm.mat3
        const x = normalize([hash11(0x13), hash11(0x57), hash11(0x9b)])
        const y = normalize(cross(x, [hash11(0x31), hash11(0x75), hash11(0xb9)]))
        const z = cross(x, y)
        const a = [...x, ...y, ...z] // Unitary
        deepCloseTo(inverse(a), transpose(a))
      })
    })
  })

  describe('mat2', () => {
    describe('eigenSym', () => {
      it('works 0', () => {
        const { transpose, matmul, eigenSym, diag, eye, outer2 } = glm.mat2

        {
          // A = 1 3
          //     2 4
          const A = [1, 2, 3, 4]
          const AT = transpose(A)
          deepCloseTo(AT, [1, 3, 2, 4])

          const B = matmul(transpose(A), A)
          deepCloseTo(B, [5, 11, 11, 25])

          const [U, D] = eigenSym(B)
          deepCloseTo(matmul(transpose(U), U), eye())
          deepCloseTo(matmul(U, matmul(diag(D), transpose(U))), B)
        }

        {
          // A = random
          const A = _.range(4).map(i => hash11(i ^ 0x259c))
          const B = matmul(transpose(A), A)
          const [U, D] = eigenSym(B)
          deepCloseTo(matmul(transpose(U), U), eye())
          deepCloseTo(matmul(U, matmul(diag(D), transpose(U))), B)
        }

        {
          // A = v v^T (i.e. rank = 1)
          const B = outer2([1, 2])
          const [U, D] = eigenSym(B)
          deepCloseTo(D, [5, 0])
          deepCloseTo(matmul(transpose(U), U), eye())
          deepCloseTo(matmul(U, matmul(diag(D), transpose(U))), B)
        }
      })
    })

    describe('svd', () => {
      it('works 0', () => {
        const { transpose, matmul, svd, svdInvertible, diag, eye, outer2, householderQR } = glm.mat2

        {
          // A = 1 3
          //     2 4
          const A = [1, 2, 3, 4]
          const [U, D, VT] = svdInvertible(A)
          deepCloseTo(matmul(transpose(U), U), eye())
          deepCloseTo(matmul(transpose(VT), VT), eye())
          deepCloseTo(matmul(U, matmul(diag(D), VT)), A)
        }

        {
          // A = random
          const A = _.range(4).map(i => hash11(i ^ 0x259c))
          const [U, D, VT] = svdInvertible(A)
          deepCloseTo(matmul(transpose(U), U), eye())
          deepCloseTo(matmul(transpose(VT), VT), eye())
          deepCloseTo(matmul(U, matmul(diag(D), VT)), A)

          const [Q, R] = householderQR(A)
          deepCloseTo(transpose(Q), Q) // for 2-dim, Q itself is householder reflection, so symmetric
          deepCloseTo(matmul(Q, Q), eye())
          deepCloseTo(matmul(Q, R), A)

          {
            const [U, D, VT] = svd(A)
            deepCloseTo(matmul(transpose(U), U), eye())
            deepCloseTo(matmul(transpose(VT), VT), eye())
            deepCloseTo(matmul(U, matmul(diag(D), VT)), A)
          }
        }

        // Non invertible
        {
          // A = v v^T (i.e. rank = 1)
          const A = outer2([1, 2])
          const [U, D, VT] = svd(A)

          deepCloseTo(matmul(transpose(U), U), eye())
          deepCloseTo(matmul(transpose(VT), VT), eye())
          deepCloseTo(matmul(U, matmul(diag(D), VT)), A)

          const [Q, R] = householderQR(A)
          deepCloseTo(transpose(Q), Q)
          deepCloseTo(matmul(Q, Q), eye())
          deepCloseTo(matmul(Q, R), A)
        }
      })
    })
  })

  describe('mat3', () => {
    describe('householderQR', () => {
      it('works 0', () => {
        const { transpose, matmul, eye, householderQR } = glm.mat3

        // A = random
        const A = _.range(3 * 3).map(i => hash11(i ^ 0x259c))
        const [Q, R] = householderQR(A)
        deepCloseTo(matmul(transpose(Q), Q), eye())
        deepCloseTo(matmul(Q, R), A)
      })
    })

    describe('eigen', () => {
      it('works 0', () => {
        const { vec3, mat3 } = glm
        const { transpose, matmul, eye, diag } = glm.mat3

        // eigenSymWithKnownEigenvalue
        {
          // A = v v^T (i.e. rank = 1)
          const A = mat3.outer2([1, 2, 3])
          const [U, D] = mat3.eigenSymWithKnownEigenvalue(A, 0)
          const UT = transpose(U)
          deepCloseTo(matmul(UT, U), eye())
          deepCloseTo(matmul(U, matmul(diag(D), UT)), A)
        }

        // eigenPSD
        {
          const B = _.range(3 * 3).map(i => hash11(i ^ 0x259c))
          const A = matmul(transpose(B), B)
          const e = mat3.eigenvaluePSD(A)
          const u = mat3.kernel(mat3.addeq(diag([-e, -e, -e]), A))
          deepCloseTo(vec3.matmul(A, u), vec3.muls(u, e))

          const [U, D] = mat3.eigenPSD(A)
          const UT = transpose(U)
          deepCloseTo(matmul(UT, U), eye())
          deepCloseTo(matmul(U, matmul(diag(D), UT)), A)
        }

        {
          const B = [
            2, 3, 5,
            3, 5, 7,
            5, 7, 11
          ]
          const A = matmul(transpose(B), B)
          const [U, D] = mat3.eigenPSD(A)
          const UT = transpose(U)
          deepCloseTo(matmul(UT, U), eye())
          deepCloseTo(matmul(U, matmul(diag(D), UT)), A)
        }
      })
    })

    describe('svd', () => {
      it('works 0', () => {
        const { mat3 } = glm
        const { transpose, matmul, diag, eye } = glm.mat3

        // Non invertible
        {
          // A = v1 v2^T (i.e. rank = 1)
          const A = mat3.outer([1, 2, 3], [4, 5, 6])
          const [U, D, VT] = mat3.svdNonInvertible(A)
          deepCloseTo(matmul(transpose(U), U), eye())
          deepCloseTo(matmul(transpose(VT), VT), eye())
          deepCloseTo(matmul(U, matmul(diag(D), VT)), A)
        }

        {
          // A = (v1, v2) (v3, v4)^T (i.e. rank = 2)
          const A1 = [
            1, 2, 3,
            4, 5, 6,
            0, 0, 0
          ]
          const A2 = [
            7, 8, 9,
            10, 11, 12,
            0, 0, 0
          ]
          const A = matmul(A1, transpose(A2))
          const [U, D, VT] = mat3.svdNonInvertible(A)
          deepCloseTo(matmul(transpose(U), U), eye())
          deepCloseTo(matmul(transpose(VT), VT), eye())
          deepCloseTo(matmul(U, matmul(diag(D), VT)), A)
        }

        {
          const B1 = [
            ..._.range(3 * 2).map(i => hash11(i ^ 0x259c)),
            0, 0, 0
          ]
          const B2 = transpose([
            ..._.range(3 * 2).map(i => hash11(i ^ 0x36ad)),
            0, 0, 0
          ])
          const A = matmul(B1, B2)
          const [U, D, VT] = mat3.svdNonInvertible(A)
          deepCloseTo(matmul(transpose(U), U), eye())
          deepCloseTo(matmul(transpose(VT), VT), eye())
          deepCloseTo(matmul(U, matmul(diag(D), VT)), A)
        }

        // Invertible
        {
          const A = _.range(3 * 3).map(i => hash11(i ^ 0x259c))
          const [U, D, VT] = mat3.svdInvertible(A)
          deepCloseTo(matmul(transpose(U), U), eye())
          deepCloseTo(matmul(transpose(VT), VT), eye())
          deepCloseTo(matmul(U, matmul(diag(D), VT)), A)
        }

        {
          const A = [
            2, 3, 5,
            3, 5, 7,
            5, 7, 11
          ]
          const [U, D, VT] = mat3.svdInvertible(A)
          deepCloseTo(matmul(transpose(U), U), eye())
          deepCloseTo(matmul(transpose(VT), VT), eye())
          deepCloseTo(matmul(U, matmul(diag(D), VT)), A)
        }

        // Version 2
        {
          const A1 = [
            1, 2, 3,
            4, 5, 6,
            0, 0, 0
          ]
          const A2 = [
            7, 8, 9,
            10, 11, 12,
            0, 0, 0
          ]
          const A = matmul(A1, transpose(A2))
          const [U, D, VT] = mat3.svdV2(A)
          deepCloseTo(matmul(transpose(U), U), eye())
          deepCloseTo(matmul(transpose(VT), VT), eye())
          deepCloseTo(matmul(U, matmul(diag(D), VT)), A)
        }

        {
          const A = [
            2, 3, 5,
            3, 5, 7,
            5, 7, 11
          ]
          const [U, D, VT] = mat3.svdV2(A)
          deepCloseTo(matmul(transpose(U), U), eye())
          deepCloseTo(matmul(transpose(VT), VT), eye())
          deepCloseTo(matmul(U, matmul(diag(D), VT)), A)
        }
      })
    })
  })

  describe('mat4', () => {
    describe('det', () => {
      it('works 0', () => {
        const { mat4 } = glm
        const a = [
          1, 0, 0, 0,
          0, 1, 0, 0,
          0, 0, 1, 0,
          0, 0, 0, 1
        ]
        closeTo(mat4.det(a), 1)
      })

      it('works 1', () => {
        const { mat4 } = glm
        const { normalize, cross } = glm.vec3

        const x = normalize([hash11(0x13), hash11(0x57), hash11(0x9b)])
        const y = normalize(cross(x, [hash11(0x31), hash11(0x75), hash11(0xb9)]))
        const z = cross(x, y)

        closeTo(mat4.det([
          ...x, 0,
          ...y, 0,
          ...z, 0,
          0, 0, 0, 1
        ]), 1)

        closeTo(mat4.det([
          ...x, 0,
          ...y, 0,
          0, 0, 0, 1,
          ...z, 0
        ]), -1)
      })
    })
  })
})
