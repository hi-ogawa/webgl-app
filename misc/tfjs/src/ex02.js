/* eslint camelcase: 0 */
/* global _, assert, tf */

//
// Sparse matmul
//

import '../node_modules/@tensorflow/tfjs/dist/tf.es2017.js'

tf.setBackend('webgl')
const tfgl = tf.backend()

class CsrDenseMatmulKernel {
  constructor (A_shape, B_shape) {
    _.assign(this, {
      variableNames: ['A_indptr', 'A_indices', 'A_data', 'B'],
      outputShape: [A_shape[0], B_shape[1]],
      userCode: `
        void main() {

          ivec2 ij = getOutputCoords();
          int i = ij[0];
          int j = ij[1];

          // NOTE: tf uses float for integer dtype
          int p0 = int(getA_indptr(i));
          int p1 = int(getA_indptr(i + 1));
          float value = 0.0;
          for (int p = p0; p < p1; p++) {
            int k = int(getA_indices(p));
            float Aik = getA_data(p);
            float Bkj = getB(k, j);
            value += Aik * Bkj;
          }
          setOutput(value);
        }
      `
    })
  }
}

const main = async () => {
  const [N, K, M] = [4, 3, 2]
  // A = 2 3 0
  //     0 1 5
  //     1 0 0
  //     0 0 1
  const shape = [N, K]
  const nnz = 6

  const indptr = tf.tensor([0, 2, 4, 5, 6], [N + 1], 'int32')
  const indices = tf.tensor([0, 1, 1, 2, 0, 2], [nnz], 'int32')
  const data = tf.tensor([2, 3, 1, 5, 1, 1], [nnz])
  const b = tf.tensor([
    1, 2,
    3, 4,
    5, 6
  ], [K, M])

  const program = new CsrDenseMatmulKernel(shape, b.shape)
  const c = tfgl.compileAndRun(program, [indptr, indices, data, b], 'float32')
  const source = _.values(tfgl.binaryCache).slice(-1)[0].source
  const buf = await c.buffer()
  assert.match(source, /float getA_indptr/)
  assert.match(source, /float getA_indices/)
  assert.deepEqual(buf.values, new Float32Array([
    11, 16,
    28, 34,
    1, 2,
    5, 6
  ]))
  // console.log(buf.values)
}

export { main }
