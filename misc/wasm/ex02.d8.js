load('./utils.d8.js') // loadEm, timeit

const main = async () => {
  const { Buffer } = await loadEm('./ex02.em.js')

  {
    for (let i = 0; i < 128; i++) {
      const buf = new Buffer(i)
      buf.data().fill(1)
      const sum = buf.sum_sse()
      if (sum !== i) {
        console.log('Test failed:', sum, i)
      }
      buf.delete()
    }
  }

  {
    const buf = new Buffer(2**20)
    buf.data().set(buf.data().map(() => Math.random()))

    console.log('buf.data().length =', buf.data().length)
    console.log('buf.sum()     =', buf.sum())
    console.log('buf.sum_sse() =', buf.sum_sse())
    console.log('[timeit] buf.sum()     =>', timeit(() => buf.sum(), 200, 5))
    console.log('[timeit] buf.sum_sse() =>', timeit(() => buf.sum_sse(), 400, 5))

    buf.delete()
  }
}

main()
