/* eslint camelcase: 0 */
/* global _, assert, tf, fetch */

//
// Use pre-trained MobileNetV2
//

import '../node_modules/@tensorflow/tfjs/dist/tf.es2017.js'
import { decodeImage } from './utils.js'

const main = async () => {
  await tf.setBackend('webgl')

  // MobileNetV2
  const url = 'https://tfhub.dev/google/tfjs-model/imagenet/mobilenet_v2_140_224/classification/2/default/1'
  const url_labels = 'https://gist.githubusercontent.com/yrevar/942d3a0ac09ec9e5eb3a/raw/238f720ff059c1f82f368259d1ca4ffa5dd8f9f5/imagenet1000_clsidx_to_labels.txt'
  const url_image = 'https://static.flickr.com/1169/556623120_faec83e753.jpg' // http://image-net.org/synset?wnid=n01944390

  const model = await tf.loadGraphModel(url, { fromTFHub: true })
  const labels = (await (await fetch(url_labels)).text()).split('\n').map(s => s.split(':')[1].slice(2, -2)) // manual parsing
  let x = await decodeImage(url_image)
  x = x.resizeBilinear(model.inputs[0].shape.slice(1, 3))
  x = x.reshape([1, ...x.shape])
  const y = model.predict(x)
  const y_data = await y.data()
  const z = _.range(y_data.length).sort((i, j) => y_data[j] - y_data[i])
  assert.equal(labels[z[0] - 1], 'snail')
}

export { main }
