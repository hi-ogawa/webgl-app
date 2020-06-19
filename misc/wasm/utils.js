const requireEm = (path) => {
  return new Promise(resolve => {
    const Module = require(path)
    Module.postRun = resolve // Cheap trick to get notified when wasm code is ready
  })
}

module.exports = {
  requireEm
}
