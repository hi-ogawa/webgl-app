// Emscripten "Module" loader
const loadEm = (path) => {
  return new Promise(resolve => {
    load(path)
    Module.postRun = resolve
  })
}

// Cf. src/utils/timeit.js
const _ = {
  range: (n) => new Array(n).fill(0).map((v, i) => i),
  sum: (a) => a.reduce((x, y) => x + y),
}

const timeitRun = (func, n) => {
  const t0 = Date.now()
  for (let i = 0; i < n; i++) {
    func()
  }
  const t1 = Date.now()
  return (t1 - t0) / (n * 1000);
}

const timeit = (func, n, r = 5) => {
  const timings = _.range(r).map(() => timeitRun(func, n))
  const mean = _.sum(timings) / r
  const stddev2 = _.sum(timings.map(t => (t - mean) ** 2)) / r
  const stddev = Math.sqrt(stddev2)
  const max = Math.max(...timings)
  const min = Math.min(...timings)
  const unit = autoTimeUnit(mean)
  const sMean = formatTime(mean, unit)
  const [sStddev, sMax, sMin] = [stddev, max, min].map(t => formatTime(t, unit, false, 4))
  return `${sMean} (stddev: ${sStddev}, min: ${sMin}, max: ${sMax}, n: ${n}, r: ${r})`
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
