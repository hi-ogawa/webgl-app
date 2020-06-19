const { requireEm } = require('./utils.js')

let promise = null

const instantiate = () => {
  promise = promise || requireEm('./ex01.em.js')
  return promise
}

module.exports = {
  instantiate
}
