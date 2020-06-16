// cf.
// - https://docs.python.org/3/library/timeit.html
// - https://github.com/python/cpython/blob/3.8/Lib/timeit.py
// - https://nodejs.org/api/perf_hooks.html

// TODO: allow use it on browser by wrapping `performance`
import { performance } from 'perf_hooks' // eslint-disable-line
import _ from '../../web_modules/lodash.js'

class Timer {
  constructor (stmt = '', setup = '', teardown = '', args = {}) {
    const code = `(__n, args) => {
        ${setup}
        const __t0 = performance.now()
        for (let __i = 0; __i < __n; __i++) {
          ${stmt}
        }
        const __t1 = performance.now()
        ${teardown}
        return __t1 - __t0
      }
    `
    this.inner = eval(code) // eslint-disable-line
    this.args = args
  }

  run (n) {
    return this.inner(n, this.args) / 1000
  }

  repeat (n, r = 5) {
    const timings = _.range(r).map(() => this.run(n) / n)
    const mean = _.sum(timings) / r
    const stddev2 = _.sum(timings.map(t => (t - mean) ** 2)) / r
    const stddev = Math.sqrt(stddev2)
    const max = Math.max(...timings)
    const min = Math.min(...timings)
    return { mean, stddev, max, min, timings, n, r }
  }

  autoRange (s = 0.1) {
    const cs = [1, 2, 4, 8]
    const base = 10
    let exp = 0
    while (true) {
      for (const c of cs) {
        const n = c * base ** exp
        const t = this.run(n)
        if (s < t) {
          return n
        }
      }
      exp++
    }
  }
}

const kTimeUnits = new Map([
  ['nsec', 1e9],
  ['usec', 1e6],
  ['msec', 1e3],
  ['sec', 1]
])

const autoTimeUnit = (s) => {
  // NOTE: Map is ordered
  for (const [unit, scale] of kTimeUnits) {
    if (scale * s < 1e3) { return unit }
  }
  return 'sec'
}

const formatTime = (s, unit = null, showUnit = true, precision = 5) => {
  if (!unit) {
    unit = autoTimeUnit(s)
  }
  const scale = kTimeUnits.get(unit)
  const ss = (scale * s).toPrecision(precision)
  return showUnit ? `${ss} ${unit}` : ss
}

const formatRepeatResult = (result) => {
  const { mean, stddev, max, min, n, r } = result
  const unit = autoTimeUnit(mean)
  const sMean = formatTime(mean, unit)
  const [sStddev, sMax, sMin] =
    [stddev, max, min].map(t => formatTime(t, unit, false, 4))
  return `${sMean} (stddev: ${sStddev}, min: ${sMin}, max: ${sMax}, n: ${n}, r: ${r})`
}

const timeit = (stmt, setup = '', teardown = '', args = {}, n = null, r = 5) => {
  const timer = new Timer(stmt, setup, teardown, args)
  if (!n) {
    n = timer.autoRange()
  }
  const result = timer.repeat(n, r)
  const resultString = formatRepeatResult(result)
  return { resultString, result }
}

export { Timer, timeit }
