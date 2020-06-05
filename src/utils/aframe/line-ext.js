import AFRAME from '../../../web_modules/aframe.js'

AFRAME.registerComponent('line-ext', {
  dependencies: ['line'],

  schema: {
    linewidth: { default: 1 }
  },

  init () {
    Object.assign(this.el.components.line.material, this.data)
  }
})
