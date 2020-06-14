import AFRAME from '../../../web_modules/aframe.js'
import * as UtilsMisc2 from '../misc2.js'
import * as Reader from '../reader.js'
import { Matrix } from '../array.js'

const THREE = AFRAME.THREE

const globalUrlGeometries = {}

AFRAME.registerComponent('url-geometry-loader', {
  schema: {
    url: { default: '../../thirdparty/libigl-tutorial-data/bunny.off' }
  },

  init () {
    this._update()
  },

  update (oldData) {
    if (oldData.url !== this.data.url) {
      this._update()
    }
  },

  _update () {
    const { url } = this.data
    const promise = new Promise((resolve, reject) => {
      const loader = new THREE.FileLoader()
      loader.load(url, resolve, () => {}, reject)
    })
    promise.then((data) => {
      this.fileData = data
      this._updateGeometry()
    })
  },

  _updateGeometry () {
    const { url } = this.data
    let { verts, f2v } = Reader.readOFF(this.fileData, true)
    verts = new Matrix(verts, [verts.length / 3, 3])
    UtilsMisc2.normalizePositionsV2(verts)

    const geometry = new THREE.BufferGeometry()
    geometry.index = new THREE.BufferAttribute(f2v, 1)
    geometry.attributes.position = new THREE.BufferAttribute(verts.data, 3)
    geometry.computeVertexNormals()

    globalUrlGeometries[url] = geometry
    this.el.setAttribute('geometry', { primitive: 'url-geometry', url })
  }
})

AFRAME.registerGeometry('url-geometry', {
  schema: { url: { default: '' } },
  init (data) {
    this.geometry = globalUrlGeometries[data.url]
    data.buffer = false
  }
})
