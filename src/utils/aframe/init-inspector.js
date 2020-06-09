import AFRAME from '../../../web_modules/aframe.js'

AFRAME.registerComponent('init-inspector', {
  schema: {
    enable: { default: true }
  },

  init () {
    if (this.data.enable) {
      this.el.sceneEl.addEventListener('loaded', () => {
        this.el.inspect()
      }, { once: true })
    }
  }
})
