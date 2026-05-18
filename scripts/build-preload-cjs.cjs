/**
 * Keeps Electron runtime artifacts compatible with the repo-level
 * "type": "module" package setting.
 *
 * The Electron build is CommonJS, and dist-electron/package.json makes
 * main.js/vmix.js load as CommonJS. preload.cjs is kept as the explicit
 * preload entry used by BrowserWindow.
 */
const fs = require('fs')
const path = require('path')

const distDir = path.join(__dirname, '..', 'dist-electron')
const src = path.join(distDir, 'preload.js')
const dest = path.join(distDir, 'preload.cjs')

let content = fs.readFileSync(src, 'utf8')

// Older builds emitted preload.js as ESM; current tsconfig emits CJS.
// Accept both shapes so this script remains safe during future config changes.
if (/^import\s*\{[^}]+\}\s*from\s*['"]electron['"];?\s*/m.test(content)) {
  content = content.replace(
    /^import\s*\{[^}]+\}\s*from\s*['"]electron['"];?\s*/m,
    () => `"use strict";\nObject.defineProperty(exports, "__esModule", { value: true });\nconst electron_1 = require("electron");\n`,
  )

  for (const name of ['contextBridge', 'ipcRenderer']) {
    content = content.replace(new RegExp(`\\b${name}\\b`, 'g'), `electron_1.${name}`)
  }
}

fs.writeFileSync(dest, content, 'utf8')
fs.writeFileSync(path.join(distDir, 'package.json'), '{"type":"commonjs"}\n', 'utf8')
console.log('preload.cjs and dist-electron/package.json updated')
