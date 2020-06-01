/* eslint camelcase: 0 */
/* global describe, it */

import assert from 'assert'
import _ from '../../web_modules/lodash.js'
import * as Utils from './index.js'

describe('Array2d', () => {
  describe('length', () => {
    it('works', () => {
      var arr = new Utils.Array2d(new Float32Array(8), 2)
      assert.strictEqual(arr.length, 4)
    })
  })
})

describe('computeTopology', () => {
  it('works', () => {
    var geometry = new Utils.Quad()
    var num_verts = geometry.attributes.position.count
    var index_array = geometry.index.array
    var [face_to_edge, vert_to_edge, edge_to_vert] = Utils.computeTopology(index_array, num_verts)
    // [?] : vertex
    // (?) : edge
    // <?> : face
    //  [3] --(3)-- [2]
    //   | <1>    /  |
    //  (4)   (2)   (1)
    //   |  /   <0>  |
    //  [0] --(0)-- [1]
    assert.deepStrictEqual(vert_to_edge, [[[1, 0], [2, 2], [3, 4]], [[2, 1]], [[3, 3]], []])
    assert.deepStrictEqual(edge_to_vert, [[0, 1], [1, 2], [0, 2], [2, 3], [0, 3]])
    assert.deepStrictEqual(face_to_edge, [[0, 1, 2], [2, 3, 4]])
  })
})

describe('subdivTriforce', () => {
  it('works', () => {
    var geometry = new Utils.Quad()
    assert.strictEqual(geometry.index.count / 3, 2)
    assert.strictEqual(geometry.attributes.position.count, 4)
    Utils.subdivTriforce(geometry)
    assert.strictEqual(geometry.index.count / 3, 2 * 4)
    assert.strictEqual(geometry.attributes.position.count, 4 + 5)
  })
})

/* eslint-disable no-unused-vars */
const { abs } = Math
const {
  vec2, vec3, vec4, mat2, mat3, mat4,
  M_add, M_sub, M_mul, M_div,
  T_translate, T_axisAngle, M_diag, M_get,
  dot, cross, inverse, normalize, transpose,
  diag, pow2, dot2, outer, outer2,
  eigenvalues_mat2, eigen_mat2, sqrt_mat2,
  toColor, patchThreeMath
} = Utils
/* eslint-enable no-unused-vars */

describe('Matrix', () => {
  it('works 00', () => {
    const m = mat3(
      0, 1, 2,
      3, 4, 5,
      6, 7, 8)
    assert.deepStrictEqual([0, 1, 2], M_mul(m, vec3(1, 0, 0)).toArray())
    assert.deepStrictEqual([3, 4, 5], M_mul(m, vec3(0, 1, 0)).toArray())
    assert.deepStrictEqual([6, 7, 8], M_mul(m, vec3(0, 0, 1)).toArray())
    assert.deepStrictEqual([6, 7, 8, 1], M_mul(mat4(m), vec4(0, 0, 1, 1)).toArray())
    assert.deepStrictEqual(m.toArray(), mat3(mat4(m)).toArray())
  })

  it('works 01', () => {
    assert.deepStrictEqual(mat3(6).toArray(), M_mul(mat3(2), mat3(3)).toArray())
    assert.deepStrictEqual(vec3(3).toArray(), M_add(vec3(1), vec3(2)).toArray())
  })

  it('works 02', () => {
    assert.deepStrictEqual([2, 3, 1], M_mul(T_translate(vec2(2, 3)), vec3(0, 0, 1)).toArray())
    assert.deepStrictEqual([2, 3, 4, 1], M_mul(T_translate(vec3(2, 3, 4)), vec4(0, 0, 0, 1)).toArray())

    assert.deepStrictEqual([26, 33, 35], M_mul(M_diag(vec3(2, 3, 5)), vec3(13, 11, 7)).toArray())

    {
      const expected = [
        0, 1, 0,
        -1, 0, 0,
        0, 0, 1]
      const actual = T_axisAngle(vec3(0, 0, 1), 0.5 * 3.141592).toArray()
      assert(_.zip(expected, actual).every(([e, a]) => Math.abs(e - a) < 1e-4))
    }

    {
      const expected = [
        1, 0, 0,
        0, 0, 1,
        0, -1, 0]
      const actual = T_axisAngle(vec3(1, 0, 0), 0.5 * 3.141592).toArray()
      assert(_.zip(expected, actual).every(([e, a]) => Math.abs(e - a) < 1e-4))
    }
  })

  it('works 03', () => {
    const actual = [
      T_translate(vec3(7, 11, 13)), M_diag(vec4(2, 3, 5, 1)),
      vec4(1, 0, 0, 1)
    ].reduce(M_mul)
    assert.deepStrictEqual([9, 11, 13, 1], actual.toArray())
  })

  it('works 04', () => {
    const m = mat3(1, 2, 3, 4, 5, 6, 7, 8, 9)
    assert.strictEqual(M_get(m, 0, 2), 3)
    assert.strictEqual(M_get(m, 2, 1), 8)
    assert.deepStrictEqual(M_get(m, 2).toArray(), [7, 8, 9])
  })

  it('works 05', () => {
    assert.deepStrictEqual(M_mul(vec2(-1, -1), vec2(1, 1)).toArray(), [-1, -1])
  })

  it('works 06', () => {
    patchThreeMath()
    const m = mat2(1, 2, 3, 4)
    const v = vec2(5, 6)
    assert.deepStrictEqual(M_mul(m, v).toArray(), [23, 34])
    patchThreeMath(false)
  })

  it('works 07', () => {
    patchThreeMath()
    const a = diag(vec2(2, 3))
    const m = mat2(0, 1, -1, 0)
    const mt = transpose(m)
    assert(M_sub(a, [a, m, mt].reduce(M_mul)).elements.every(x => abs(x) < 1e-6))
    patchThreeMath(false)
  })

  it('works 08', () => {
    patchThreeMath()
    const m = mat2(1, 2, 3, 4)
    const A = M_mul(transpose(m), m) // positive definite
    const [[l1, l2], [v1, v2]] = eigen_mat2(A)
    const P = mat2(v1, v2)
    const D = diag(vec2(l1, l2))
    assert(M_sub(M_mul(A, v1), M_mul(l1, v1)).length() < 1e-6)
    assert(M_sub(M_mul(A, v2), M_mul(l2, v2)).length() < 1e-6)
    assert(M_sub(M_mul(P, transpose(P)), mat2(1)).elements.every(x => abs(x) < 1e-6))
    assert(M_sub(A, [P, D, inverse(P)].reduce(M_mul)).elements.every(x => abs(x) < 1e-6))
    patchThreeMath(false)
  })

  it('works 09', () => {
    patchThreeMath()
    const m = mat2(1, 2, 3, 4)
    const A = M_mul(transpose(m), m) // positive definite
    const B = sqrt_mat2(A)
    assert(M_sub(A, pow2(B)).elements.every(x => abs(x) < 1e-6))
    patchThreeMath(false)
  })
})

describe('patchThreeMath', () => {
  it('works (Symbol.iterator)', () => {
    patchThreeMath()
    assert.deepStrictEqual([...vec3(1)], [1, 1, 1])
    patchThreeMath(false)
    let error
    try { [...vec3(1)] } catch (e) { error = e } // eslint-disable-line
    assert(error instanceof TypeError)
    assert(error.toString().endsWith('is not iterable'))
  })
})

describe('linspace', () => {
  it('works', () => {
    assert.deepStrictEqual(Utils.linspace(1, 3, 4), [1, 1.5, 2, 2.5, 3])
  })
})
