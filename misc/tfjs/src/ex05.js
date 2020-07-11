/* eslint camelcase: 0 */
/* global _, assert, tf */

//
// Game of Life
//

import '../node_modules/@tensorflow/tfjs/dist/tf.es2017.js'

class MyKernel {
  constructor (shape) {
    assert(shape.length === 2)
    _.assign(this, {
      variableNames: ['A'],
      outputShape: shape,
      userCode: `
        void main() {
          ivec2 shape = ivec2(${shape[0]}, ${shape[1]});
          ivec2 ij = getOutputCoords();
          int i = ij[0];
          int j = ij[1];

          // Wrap coordinates
          #define GET(p, q) getA(imod(i + p + shape[0], shape[0]), imod(j + q + shape[1], shape[1]))

          float me = GET(0, 0);
          float neighbor =
            GET(-1, -1) + GET(-1, 0) + GET(-1, 1) +
            GET(0, -1)  +              GET(0, 1) +
            GET(1, -1)  + GET(1, 0)  + GET(1, 1);

          float result = float(((me == 1.0) && (neighbor == 2.0)) || (neighbor == 3.0));
          setOutput(result);
        }
      `
    })
  }
}

const drawAscii = (x) => {
  const [n, m] = x.shape
  const data = x.dataSync()
  let result = ''
  for (const i of _.range(n)) {
    for (const j of _.range(m)) {
      result += data[m * i + j] ? '#' : '.'
    }
    result += '\n'
  }
  return result
}

const pad = (x, shape) => {
  assert(x.shape.length === shape.length)
  const dim = x.shape.length
  const arg = _.range(dim).map(i => [0, shape[i] - x.shape[i]])
  return tf.pad(x, arg)
}

const main = async () => {
  await tf.setBackend('webgl')
  const tfgl = tf.backend()

  const size = [8, 8]
  const x = pad(tf.tensor([ // TODO: tensor leaks
    1, 0, 0,
    0, 1, 1,
    1, 1, 0
  ], [3, 3]), size)

  const program = new MyKernel(x.shape)
  const run = (x) => tfgl.compileAndRun(program, [x])

  let y = x
  console.log('0:\n' + drawAscii(y))
  for (const i of _.range(32)) {
    y = run(y) // TODO: tensor leaks
    console.log(`${i + 1}:\n` + drawAscii(y))
  }
}

export { main }
