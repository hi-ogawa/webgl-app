/* eslint camelcase: 0, no-eval: 0 */

//
// Aframe inspector
//

import _ from '../../web_modules/lodash.js'
import AFRAME from '../../web_modules/aframe.js'
import '../utils/aframe/geometry.js'
import '../utils/aframe/url-geometry.js'
import * as reader from '../utils/reader.js'
import { $ } from '../utils/misc.js'
import * as misc2 from '../utils/misc2.js'
import * as ddg from '../utils/ddg.js'

const { THREE } = AFRAME

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

AFRAME.registerComponent('init-inspector', {
  init () {
    // TODO: hack aframe-inspector to have directional light from camera
    this.el.sceneEl.addEventListener('loaded', () => {
      this.el.inspect()
      $('[data-name="aframe-inspector"]').onload = () => {
        AFRAME.INSPECTOR.camera.add(new THREE.DirectionalLight('#fff', 0.5))
      }
    }, { once: true })
  }
})

const getData = (url) => {
  return new Promise((resolve, reject) => {
    const loader = new THREE.FileLoader()
    loader.load(url, resolve, () => {}, reject)
  })
}

AFRAME.registerComponent('visualize-tetrahedron-mesh', {
  schema: {
    url: { default: '../../misc/data/bunny.off.tetwild.1e-2.mesh' },
    c0: { default: 0, type: 'int' },
    c3: { default: 0, type: 'int' },
    type: { default: 'c0xc3', oneOf: ['c0xc3', 'c3xc0'] }
  },

  async init () {
    const { url } = this.data
    const data = await getData(url)
    const { verts, c3xc0 } = reader.readMESH(data)
    misc2.normalizePositionsV2(verts)

    // Get c0xc3
    const c0xc3 = ddg.c3xc0Toc0xc3(c3xc0, verts.shape[0])

    // Get boundary surface
    const { c2xc0, d2 } = ddg.computeD2(c3xc0, verts.shape[0])
    const c2xc0B = ddg.computeBoundary(c2xc0, d2)

    // Boundary surface
    const geometry1 = new THREE.BufferGeometry()
    geometry1.index = new THREE.BufferAttribute(c2xc0B.data, 1)
    geometry1.attributes.position = new THREE.BufferAttribute(verts.data, 3)
    geometry1.computeVertexNormals()
    this.el.setObject3D('mesh', new THREE.Mesh(geometry1))

    // Focused tetrahedron
    const geometry2 = new THREE.BufferGeometry()
    geometry2.index = new THREE.BufferAttribute(new Uint32Array(4 * 3), 1)
    geometry2.attributes.position = new THREE.BufferAttribute(verts.data, 3)
    $('#root #c3').setObject3D('mesh', new THREE.Mesh(geometry2))

    _.assign(this, {
      verts, c3xc0, c0xc3, geometry1, geometry2
    })
    this.update()
  },

  update () {
    let { type, c0, c3 } = this.data
    const { verts, c0xc3, c3xc0, geometry2 } = this
    if (!geometry2) { return }

    if (type === 'c3xc0') {
      $('#root #c0').object3D.visible = false
    }

    if (type === 'c0xc3') {
      const offset = c3
      c3 = c0xc3.indices[c0xc3.indptr[c0] + offset]
      // [ Debug ]
      console.log(`c0: ${c0}, c3: ${c3}, offset: ${offset}`)
      const p = verts.row(c0)
      $('#root #c0').object3D.visible = true
      $('#root #c0').object3D.position.set(...p)
    }

    const vs = c3xc0.row(c3)
    geometry2.index.array.set([
      vs[0], vs[2], vs[1],
      vs[0], vs[3], vs[2],
      vs[0], vs[1], vs[3],
      vs[1], vs[2], vs[3]
    ])
    geometry2.index.needsUpdate = true
  }
})

AFRAME.registerComponent('reader-test', {
  schema: {
    url: { default: '../../thirdparty/libigl-tutorial-data/bunny.mesh' }
  },

  async init () {
    const { url } = this.data
    const data = await getData(url)
    const { verts, f2v } = reader.readMESH(data)
    misc2.normalizePositionsV2(verts)

    const geometry = new THREE.BufferGeometry()
    geometry.index = new THREE.BufferAttribute(f2v.data, 1)
    geometry.attributes.position = new THREE.BufferAttribute(verts.data, 3)
    geometry.computeVertexNormals()

    this.el.setObject3D('mesh', new THREE.Mesh(geometry))
  }
})

const main = () => {
  const scene = $('#scene').content.cloneNode(true)
  $('#root').appendChild(scene)
}

export { main }
