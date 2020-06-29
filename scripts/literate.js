// See misc/data/README.md for some examples

import fs from 'fs'
import process from 'process'
import { spawn } from 'child_process'

const main = (infile, name, ...args) => {
  if (!infile || !name) {
    console.error('[literate.js] Usage: node literal.js <file> <section> <arguments>')
    return
  }

  const data = fs.readFileSync(infile).toString()
  // Find js code of the form
  /*
``js
// ${name}
<code>
``
*/
  const exp = RegExp(`
\`\`\`js
// ${name}
([\\s\\S]*?)
\`\`\`
`, 'm')

  const result = data.match(exp)
  if (!result) {
    console.error(`[literate.js] Section "${name}" not found`)
    return
  }
  const code = result[1]

  // Generate temporary file in the SAME DIRECTORY as infile
  const tmpjs = `${infile}--literate--${name}.js`
  fs.writeFileSync(tmpjs, code)

  // Execute
  const p = spawn('node', [tmpjs, ...args])
  p.stdout.on('data', (data) => {
    console.log(`[${name}] ${data}`)
  })
  p.stderr.on('data', (data) => {
    console.error(`[${name}] ${data}`)
  })
  p.on('close', (code) => {
    fs.unlinkSync(tmpjs)
    if (code !== 0) {
      console.error(`[literate.js] exit code: ${code}`)
    }
  })
}

main(...process.argv.slice(2))
