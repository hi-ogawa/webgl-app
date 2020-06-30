import puppeteer from '../../../scripts/node_modules/puppeteer/index.js'

const main = async (url) => {
  // cf. https://github.com/puppeteer/puppeteer/issues/4913
  const browser = await puppeteer.launch({ args: ['--use-gl=egl'] })
  const page = await browser.newPage()

  await page.evaluateOnNewDocument(() => {
    // Use this to switch mocha reporter in index.html
    window.__HEADLESS = true

    // Workaround for percentage formatting used by "spec" reporter
    const oldConsoleLog = console.log
    console.log = (...args) => {
      oldConsoleLog(args.join('∇'))
    }
  })

  page.on('console', msg => {
    const [fmt, ...data] = msg.text().split('∇')
    console.log(`[BROWSER-CONSOLE] ${fmt}`, ...data)
  })

  console.log(`[NODE-CONSOLE] Navigate to ${url}`)
  await page.goto(url, { waitUntil: 'networkidle2' })

  await page.evaluate(async () => {
    return await new Promise(resolve => {
      // Wait until `__MOCHA_FINISHED`
      const handle = window.setInterval(() => {
        if (window.__MOCHA_FINISHED) {
          clearInterval(handle)
          resolve()
        }
      }, 100)
    })
  })

  await browser.close()
}

main(...process.argv.slice(2))
