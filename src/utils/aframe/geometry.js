import AFRAME from '../../../web_modules/aframe.js'
import * as Utils from '../index.js'
import * as UtilsMisc from '../misc.js'
import * as UtilsMisc2 from '../misc2.js'

AFRAME.registerGeometry('g-torus', {
  schema: {
    genus: { default: 2, min: 0, type: 'int' },
    subdiv: { default: 2, min: 0, type: 'int' }
  },

  init (data) {
    this.geometry = Utils.makeBufferGeometry(UtilsMisc.makeGTorus(data.genus, data.subdiv))
    this.geometry.computeVertexNormals()
    data.buffer = false
  }
})

AFRAME.registerGeometry('icosphere', {
  schema: {
    subdiv: { default: 0, min: 0, type: 'int' }
  },

  init (data) {
    this.geometry = Utils.makeBufferGeometry(UtilsMisc.makeIcosphere(data.subdiv))
    this.geometry.computeVertexNormals()
    data.buffer = false
  }
})

AFRAME.registerGeometry('my-triangle', {
  schema: {
    n: { default: 1, min: 1, type: 'int' }
  },

  init (data) {
    const { n } = data
    const { verts, f2v } = UtilsMisc2.makeTriangle(n)
    const geometry = new THREE.BufferGeometry()
    geometry.attributes.position = new THREE.BufferAttribute(verts.data, 3)
    geometry.index = new THREE.BufferAttribute(f2v.data, 1)
    geometry.computeVertexNormals()
    this.geometry = geometry
    data.buffer = false
  }
})
