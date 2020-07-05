/* eslint camelcase: 0 */
/* global _, assert, tf */

//
// blazeface model
// - https://arxiv.org/abs/1907.05047
// - https://github.com/tensorflow/tfjs-models/blob/master/blazeface/src/face.ts
//

import '../node_modules/@tensorflow/tfjs/dist/tf.es2017.js'
import { decodeImage } from './utils.js'

// Anchor box centers
const kSize = 128
const kAnchorConfig = [[8, 2], [16, 6]]
const kCenters = []
for (const [stride, numAnchors] of kAnchorConfig) {
  for (let y = 0; y < kSize / stride; y++) {
    for (let x = 0; x < kSize / stride; x++) {
      _.range(numAnchors).forEach(() => {
        kCenters.push([stride * (x + 0.5), stride * (y + 0.5)])
      })
    }
  }
}

const sortIndices = (a) => {
  return _.range(a.length).sort((i, j) => a[j] - a[i])
}

const main = async () => {
  await tf.setBackend('webgl')

  // blazeface
  const url = 'https://tfhub.dev/tensorflow/tfjs-model/blazeface/1/default/1'
  const url_image = 'https://picsum.photos/id/237/200'
  // const url_image = 'https://upload.wikimedia.org/wikipedia/commons/b/b7/Lueg_im_SWR1_Studio.jpg' // cf. https://en.wikipedia.org/wiki/Selfie

  const model = await tf.loadGraphModel(url, { fromTFHub: true } )

  let x = await decodeImage(url_image) // shape (H, W, 3) with value in [0, 1]
  x = x.resizeBilinear(model.inputs[0].shape.slice(1, 3)) // shape should be (128, 128, 3)
  x = x.reshape([1, ...x.shape])
  x = x.mul(2).sub(1) // in [-1, 1]

  // shape (896, 17) (896 anchor boxes with each having 17 data for score/start/size/landmark etc...)
  const y = model.predict(x).squeeze()
  const scores = y.slice([0, 0], [-1, 1]).sigmoid() // first slice is probability

  // Pick highest score (cf. more sophiscated one tfjs-core/src/backends/non_max_suppression_impl.ts)
  const argmax = scores.argMax().dataSync()[0]
  const probability = scores.dataSync()[argmax]

  // Predicted anchor box
  const center = kCenters[argmax]
  const result = y.slice([argmax, 0], [1, -1]).dataSync()
  const offset = result.slice(1, 3)
  const size = result.slice(3, 5)
  const start = _.range(2).map(i => center[i] + offset[i])
  const end = _.range(2).map(i => start[i] + size[i])
  console.log(probability, start, end, center, offset, size)
}

export { main }
