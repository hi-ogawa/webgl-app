//
// Hash (32 bits)
//

// cf. https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/imul
const mul = (a, b) => {
  const aHi = a >>> 16
  const aLo = a & 0xffff
  const bHi = b >>> 16
  const bLo = b & 0xffff
  return ((aLo * bLo) + (((aHi * bLo + aLo * bHi) << 16) >>> 0)) >>> 0
}

// 32 bit hash by Chris Wellons https://nullprogram.com/blog/2018/07/31/
/*
# In python with numpy
import numpy as np
u = np.uint32
def hash11u(x):
  x ^= x >> u(16)
  x *= u(0x7feb352d)
  x ^= x >> u(15)
  x *= u(0x846ca68b)
  x ^= x >> u(16)
  return x
*/
const hash11u = (x) => {
  // NOTE: Javascript's `^` produces signed integer but `umul` converts into unsigned
  x ^= x >>> 16
  x = mul(x, 0x7feb352d)
  x ^= x >>> 15
  x = mul(x, 0x846ca68b)
  x ^= x >>> 16
  return x >>> 0
}

const numberBitsToUint = (x) => {
  const buffer = new ArrayBuffer(4)
  const f32View = new Float32Array(buffer)
  const u32View = new Uint32Array(buffer)
  f32View[0] = x
  return u32View[0]
}

const normalizeUint = (x) => {
  return x / 0x100000000
}

const hash11 = (x) => {
  return normalizeUint(hash11u(numberBitsToUint(x)))
}

export { hash11u, hash11 }
