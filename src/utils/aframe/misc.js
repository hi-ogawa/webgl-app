// Silly workaround for THREE's version difference
import AFRAME from '../../../web_modules/aframe.js'

const patchAframeThree = () => {
  const { Object3D, BufferGeometry } = AFRAME.THREE
  const patches = [
    [
      Object3D.prototype,
      {
        applyMatrix4 () { this.applyMatrix(...arguments) }
      }
    ],
    [
      BufferGeometry.prototype,
      {
        applyMatrix4 () { this.applyMatrix(...arguments) }
      }
    ]
  ]
  for (const [target, data] of patches) {
    Object.assign(target, data)
  }
}

export { patchAframeThree }
