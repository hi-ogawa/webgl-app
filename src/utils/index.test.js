import assert from 'assert';
import { Array2d, computeTopology, subdivTriforce, Quad } from './index.js';

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
