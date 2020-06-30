/* global tf */

//
// Example from introduction
//

import '../node_modules/@tensorflow/tfjs/dist/tf.es2017.js'

const main = async () => {
  const model = tf.sequential()
  model.add(tf.layers.dense({ units: 1, inputShape: [1] }))

  model.compile({ loss: 'meanSquaredError', optimizer: 'sgd' })

  const xs = tf.tensor2d([1, 2, 3, 4], [4, 1])
  const ys = tf.tensor2d([1, 3, 5, 7], [4, 1])

  await model.fit(xs, ys, { epochs: 10 })
  return model.predict(tf.tensor2d([5], [1, 1]))
}

export { main }
