/* global tf, Image */

import '../node_modules/@tensorflow/tfjs/dist/tf.es2017.js'

const decodeImage = async (url) => {
  const el = new Image()
  el.src = url
  el.crossOrigin = 'Anonymous' // cf. https://stackoverflow.com/questions/22097747/how-to-fix-getimagedata-error-the-canvas-has-been-tainted-by-cross-origin-data
  await el.decode()
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  ctx.drawImage(el, 0, 0)
  const { data } = ctx.getImageData(0, 0, el.width, el.height)
  let t = tf.tensor(new Float32Array(data), [el.height, el.width, 4])
  t = t.slice([0, 0, 0], [-1, -1, 3])
  t = t.div(255)
  return t
}

export { decodeImage }
