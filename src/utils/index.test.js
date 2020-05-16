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

describe('Matrix', () => {
  const { vec2, vec3, vec4, mat3, mat4, M_add, M_mul, M_diag, T_translate, T_axisAngle } = Utils

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
})
