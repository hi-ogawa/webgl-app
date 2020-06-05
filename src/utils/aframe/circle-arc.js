import AFRAME from '../../../web_modules/aframe.js'
import * as UtilsMisc from '../misc.js'

const THREE = AFRAME.THREE
const { PI } = Math

AFRAME.registerComponent('circle-arc', {
  schema: {
    phi: { default: 0.5 * PI },
    color: { default: '#fff', type: 'color' },
    linewidth: { default: 1 }
  },

  init () {
    const { phi, color, linewidth } = this.data
    this.object = new THREE.Line(
      UtilsMisc.makeCircle(16, phi),
      new THREE.LineBasicMaterial({ color, linewidth }))
    this.el.object3D.add(this.object)
  },

  remove () {
    this.object.geometry.dispose()
    this.object.material.dispose()
    this.el.object3D.remove(this.object)
  }
})
