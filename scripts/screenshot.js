/* eslint camelcase: 0 */

import puppeteer from 'puppeteer'
import argparse from 'argparse'
import process from 'process'
import _ from 'lodash'

const main = () => {
  const parser = new (argparse.ArgumentParser)()
  parser.addArgument('--width', { type: Number, defaultValue: 800 })
  parser.addArgument('--height', { type: Number, defaultValue: 600 })
  parser.addArgument('--timeout', { type: Number, defaultValue: 10 })
  parser.addArgument('url and outfile', { nargs: '+' })
  const args = parser.parseArgs()
  const urls_outfiles = args['url and outfile']
  if (!(urls_outfiles.length % 2 === 0)) {
    console.error('[error] url and outfile is not paired')
    process.exitCode = 1
    return
  }
  runBrowser(_.chunk(urls_outfiles, 2), args)
}

// Allow only single "requestAnimationFrame" callback
// cf. https://github.com/mrdoob/three.js/blob/dev/test/e2e/deterministic-injection.js

const script_onNewDocument = () => {
  window._FRAME_ID = 0
  window._NUM_FRAMES = 1
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
      if (window._FRAME_ID < window._NUM_FRAMES) {
        callback(window._FRAME_ID * 1000 / 60) // eslint-disable-line
      } else {
        // 2nd call of RAF triggers "FINISH"
        window._FINISH = true
      }
      window._FRAME_ID++
    })
  }
  window.requestAnimationFrame = newRAF
}

const script_evaluate = async (options) => {
  // Remove dat.gui
  const style = document.createElement('style')
  style.type = 'text/css'
  style.innerHTML = '.dg.ac { display: none; }'
  document.body.appendChild(style)

  // Triggers "START"
  window._START = true

  return await new Promise(resolve => {
    const timeStart = window.performance.now()
    // Wait for "FINISH"
    const handle = setInterval(() => {
      const timeNow = window.performance.now()
      const timeDiff = (timeNow - timeStart) / 1000
      if (options.timeout < timeDiff) {
        resolve({ ok: false, message: `timeout ${timeDiff}` })
      }
      if (window._FINISH) {
        clearInterval(handle)
        resolve({ ok: true, message: `time ${timeDiff}` })
      }
    }, 100)
  })
}

const runBrowser = async (urls_outfiles, options) => {
  const browser = await puppeteer.launch()
  const page = await browser.newPage()

  page.on('console', msg => console.log(`[BROWSER-CONSOLE] ${msg.text()}`))
  await page.setViewport(_.pick(options, ['width', 'height']))
  await page.evaluateOnNewDocument(script_onNewDocument)

  for (const [url, outfile] of urls_outfiles) {
    console.log(`[NODE-CONSOLE]: navigate to ${url}`)

    await page.goto(url, { waitUntil: 'networkidle2' })
    const result = await page.evaluate(script_evaluate, options)

    if (!result.ok) {
      console.log(`[NODE-CONSOLE]: failure : ${result.message}`)
      continue
    }

    console.log(`[NODE-CONSOLE]: message : ${result.message}`)
    console.log(`[NODE-CONSOLE]: savging image to ${outfile}`)
    await page.screenshot({ path: outfile })
  }

  await browser.close()
}

main()
