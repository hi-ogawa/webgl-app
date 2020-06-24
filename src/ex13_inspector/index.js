/* eslint camelcase: 0, no-eval: 0 */

//
// Aframe inspector
//

import _ from '../../web_modules/lodash.js'
import AFRAME from '../../web_modules/aframe.js'
import '../utils/aframe/geometry.js'

const stringToElement = (s) => {
  const template = document.createElement('template')
  template.innerHTML = s.trim()
  return template.content.firstChild
}

AFRAME.registerComponent('flower', {
  schema: {
    numPetals: { default: 8, min: 2, type: 'int' },
    openAngle: { default: 45 }
  },

  init () {
    this._updatePetals()
  },

  update ({ numPetals }) {
    if (numPetals !== this.data.numPetals) {
      this._updatePetals()
    }
    this._updateAngle()
  },

  _updatePetals () {
    const { numPetals } = this.data
    const degree = 360 / numPetals

    this.el.innerHTML = ''
    for (const i of _.range(numPetals)) {
      const el = stringToElement(`
        <a-entity rotation="0 ${i * degree} 0">
          <a-entity class="open-angle" rotation="0 0 0">
            <a-entity
              geometry="primitive: sphere; phiLength: ${degree}"
              position="0 1 0"
              rotation="0 ${-degree / 2} 0"
              material="color: #fa8; side: double"
            ></a-entity>
          </a-entity>
        </a-entity>
      `)
      this.el.appendChild(el)
    }
  },

  _updateAngle () {
    const { openAngle } = this.data
    for (const el of this.el.querySelectorAll('.open-angle')) {
      el.setAttribute('rotation', `0 0 ${openAngle}`)
    }
  }
})

AFRAME.registerSystem('open-inspector', {
  init () {
    this.el.sceneEl.addEventListener('loaded', () => {
      document.querySelector('#flower').inspect()
    }, { once: true })
  }
})

const main = () => {
  const $ = (...args) => document.querySelector(...args)
  const scene = $('#scene').content.cloneNode(true)
  $('#root').appendChild(scene)
}

export { main }
