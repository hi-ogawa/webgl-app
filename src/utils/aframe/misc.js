// Silly workaround for THREE's version difference
const patchAframeThree = (AFRAME) => {
  const { Object3D } = AFRAME.THREE
  const patches = [
    [
      Object3D.prototype,
      {
        // cf. Camera3dHelper.update
        applyMatrix4 () { this.applyMatrix(...arguments) }
      }
    ]
  ]
  for (const [target, data] of patches) {
    Object.assign(target, data)
  }
}

export { patchAframeThree }
