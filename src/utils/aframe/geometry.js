import AFRAME from '../../../web_modules/aframe.js'
import * as Utils from '../index.js'
import * as UtilsMisc from '../misc.js'

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
