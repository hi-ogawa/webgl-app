/* global describe, it */

import _ from '../../web_modules/lodash.js'
import assert from 'assert'
import { hash11u, hash11 } from './hash.js'

describe('hash', () => {
  it('works 0', () => {
    assert.deepStrictEqual(_.range(4).map(hash11u), [0, 1753845952, 3507691905, 1408362973])
  })

  it('works 1', () => {
    const numSamples = 10000
    const numBins = 100
    const bins = new Array(numBins).fill(0)
    const { floor, pow, sqrt, round } = Math

    for (const x of _.range(numSamples)) {
      bins[floor(hash11(x) * numBins)]++
    }

    const mean = _.mean(bins)
    const stddev = sqrt(_.mean(bins.map(n => pow(n - mean, 2))))
    assert.strictEqual(round(stddev), 10)
  })
})
