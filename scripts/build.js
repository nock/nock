
import { stripTypeScriptTypes } from 'node:module'
import { readFileSync, writeFileSync, mkdirSync, globSync } from 'node:fs'
import { join, dirname } from 'node:path'

const root = join(import.meta.dirname, '..')
const dist = join(root, 'dist')

const sourceFiles = globSync('{index.ts,lib/**/*.ts}', { cwd: root })

for (const rel of sourceFiles) {
  const outFile = join(dist, rel.replace(/\.ts$/, '.js'))

  mkdirSync(dirname(outFile), { recursive: true })

  let code = readFileSync(join(root, rel), 'utf-8')
  code = stripTypeScriptTypes(code, { mode: 'strip' })
  // Rewrite .ts extensions to .js in import/require paths
  code = code.replace(/(['"]\..*?)\.ts(['"])/g, '$1.js$2')

  writeFileSync(outFile, code)
}
