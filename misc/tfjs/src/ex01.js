/* global _, tf */

//
// Running custom op (cf. tfjs-backend-webgl/src/webgl_custom_op_test.ts)
//

import '../node_modules/@tensorflow/tfjs/dist/tf.es2017.js'

tf.setBackend('webgl')
const tfgl = tf.backend()

class SquareAndAddKernel {
  constructor (inputShape) {
    _.assign(this, {
      variableNames: ['X'],
      outputShape: inputShape.slice(),
      userCode: `
        void main() {
          float x = getXAtOutCoords();
          float value = x * x + x;
          setOutput(value);
        }
      `
    })
  }
}

const main = async () => {
  const x = tf.tensor2d([1, 2, 3, 4], [4, 1])
  const program = new SquareAndAddKernel(x.shape)
  const y = tfgl.compileAndRun(program, [x])
  return y
}

export { main }
