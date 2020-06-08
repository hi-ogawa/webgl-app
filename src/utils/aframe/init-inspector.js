import AFRAME from '../../../web_modules/aframe.js'

AFRAME.registerComponent('init-inspector', {
  init () {
    this.el.sceneEl.addEventListener('loaded', () => {
      this.el.inspect()
    }, { once: true })
  }
})
