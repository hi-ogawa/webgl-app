/* eslint camelcase: 0 */

import puppeteer from 'puppeteer'
import process from 'process'
import _ from 'lodash'

// TODO: support options
// - render timeout (currently 3sec)
// - width/height
const main = () => {
  const urls_outfiles = process.argv.slice(2)
  const len = urls_outfiles.length
  if (!(0 < len && len % 2 === 0)) {
    console.error('Usage: <program> <url-1> <outfile-1> <url-2> <outfile-2> ...');
    process.exitCode = 1;
    return;
  }
  runBrowser(_.chunk(urls_outfiles, 2))
}

// Allow only single "requestAnimationFrame" callback
// cf. https://github.com/mrdoob/three.js/blob/dev/test/e2e/deterministic-injection.js

const script_onNewDocument = () => {
  window._FRAME_ID = 0
  window._START = false
  window._FINISH = false

  const oldRAF = window.requestAnimationFrame
  const newRAF = (callback) => {
    // Wait for "START" signal from `script_evaluate`
    if (!window._START) {
      setTimeout(() => newRAF(callback), 100)
      return
    }
    oldRAF(() => {
      if (window._FRAME_ID === 0) {
        callback(0) // eslint-disable-line
      } else {
        // 2nd call of RAF triggers "FINISH"
        window._FINISH = true
      }
      window._FRAME_ID++
    })
  }
  window.requestAnimationFrame = newRAF
}

const script_evaluate = async () => {
  // Triggers "START"
  window._START = true

  return await new Promise(resolve => {
    let timeStart = performance.now()
    // Wait for "FINISH"
    const handle = setInterval(() => {
      let timeNow = performance.now()
      if (3000 < timeNow - timeStart) {
        resolve({ ok: false, message: 'Render timeout' })
      }
      if (window._FINISH) {
        clearInterval(handle)
        resolve({ ok: true })
      }
    }, 100)
  })
}

const runBrowser = async (urls_outfiles) => {
  const browser = await puppeteer.launch()
  const page = await browser.newPage()

  page.on('console', msg => console.log(`[BROWSER-CONSOLE] ${msg.text()}`))
  await page.setViewport({ width: 400, height: 300 })
  await page.evaluateOnNewDocument(script_onNewDocument)
  for (const [url, outfile] of urls_outfiles) {
    console.log(`[NODE-CONSOLE]: navigate to ${url}`)
    await page.goto(url, { waitUntil: 'networkidle2' })
    const result = await page.evaluate(script_evaluate)
    if (!result.ok) {
      console.log(`[NODE-CONSOLE]: failure : ${result.message}`)
      continue
    }
    console.log(`[NODE-CONSOLE]: savging to ${outfile}`)
    await page.screenshot({ path: outfile })
  }
  await browser.close()
}

main()
