import assert from 'assert';
import _ from '../../web_modules/lodash.js';
import { Array2d, computeTopology, subdivTriforce, Quad } from './index.js';
import * as U from './index.js';

describe('Array2d', () => {
  describe('length', () => {
    it('works', () => {
      var arr = new Array2d(new Float32Array(8), 2);
      assert.equal(arr.length, 4);
    });
  });
});

describe('computeTopology', () => {
  it('works', () => {
    var geometry = new Quad();
    var num_verts = geometry.attributes.position.count;
    var index_array = geometry.index.array;
    var [face_to_edge, vert_to_edge, edge_to_vert] = computeTopology(index_array, num_verts);
    // [?] : vertex
    // (?) : edge
    // <?> : face
    //  [3] --(3)-- [2]
    //   | <1>    /  |
    //  (4)   (2)   (1)
    //   |  /   <0>  |
    //  [0] --(0)-- [1]
    assert.deepEqual(vert_to_edge, [ [ [ 1, 0 ], [ 2, 2 ], [ 3, 4 ] ], [ [ 2, 1 ] ], [ [ 3, 3 ] ], [] ]);
    assert.deepEqual(edge_to_vert, [ [ 0, 1 ], [ 1, 2 ], [ 0, 2 ], [ 2, 3 ], [ 0, 3 ] ]);
    assert.deepEqual(face_to_edge, [ [ 0, 1, 2 ], [ 2, 3, 4 ] ]);
  });
});

describe('subdivTriforce', () => {
  it('works', () => {
    var geometry = new Quad();
    assert.equal(geometry.index.count / 3, 2);
    assert.equal(geometry.attributes.position.count, 4);
    subdivTriforce(geometry);
    assert.equal(geometry.index.count / 3, 2 * 4);
    assert.equal(geometry.attributes.position.count, 4 + 5);
  });
});

describe('Matrix', () => {
  const { vec2, vec3, vec4, mat3, mat4, M_add, M_mul, M_diag, T_translate, T_axisAngle } = U;

  it('works 00', () => {
    const m = mat3(
        0, 1, 2,
        3, 4, 5,
        6, 7, 8);
    assert.deepEqual([0, 1, 2],    M_mul(m, vec3(1, 0, 0)).toArray());
    assert.deepEqual([3, 4, 5],    M_mul(m, vec3(0, 1, 0)).toArray());
    assert.deepEqual([6, 7, 8],    M_mul(m, vec3(0, 0, 1)).toArray());
    assert.deepEqual([6, 7, 8, 1], M_mul(mat4(m), vec4(0, 0, 1, 1)).toArray());
    assert.deepEqual(m.toArray(), mat3(mat4(m)).toArray());
  });

  it('works 01', () => {
    assert.deepEqual(mat3(6).toArray(), M_mul(mat3(2), mat3(3)).toArray());
  });

  it('works 02', () => {
    assert.deepEqual([2, 3, 1],    M_mul(T_translate(vec2(2, 3)),    vec3(0, 0, 1)   ).toArray());
    assert.deepEqual([2, 3, 4, 1], M_mul(T_translate(vec3(2, 3, 4)), vec4(0, 0, 0, 1)).toArray());

    assert.deepEqual([26, 33, 35], M_mul(M_diag(vec3(2, 3, 5)), vec3(13, 11, 7)).toArray());

    const expected = [
       0, 1, 0,
      -1, 0, 0,
       0, 0, 1];
    const actual = T_axisAngle(vec3(0, 0, 1), 0.5 * 3.141592).toArray();
    assert(_.zip(expected, actual).every(([e, a]) => Math.abs(e - a) < 1e-4));
  });

  it('works 03', () => {
    const actual = [
      T_translate(vec3(7, 11, 13)), M_diag(vec4(2, 3, 5, 1)),
      vec4(1, 0, 0, 1)
    ].reduce(M_mul);
    assert.deepEqual([9, 11, 13, 1], actual.toArray());
  })
})
