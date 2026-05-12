/**
 * Converts dist-electron/preload.js (ESM) to dist-electron/preload.cjs (CJS).
 * Run after electron:compile so preload.cjs stays in sync with preload.ts.
 */
const fs = require('fs')
const path = require('path')

const src  = path.join(__dirname, '..', 'dist-electron', 'preload.js')
const dest = path.join(__dirname, '..', 'dist-electron', 'preload.cjs')

let content = fs.readFileSync(src, 'utf8')

// Replace ESM import with CJS require
content = content.replace(
  /^import\s*\{([^}]+)\}\s*from\s*['"]electron['"];?\s*/m,
  (_, names) => `"use strict";\nObject.defineProperty(exports, "__esModule", { value: true });\nconst electron_1 = require("electron");\n`
)

// Replace bare identifiers with electron_1. prefix
const electronExports = ['contextBridge', 'ipcRenderer']
for (const name of electronExports) {
  content = content.replace(new RegExp(`\\b${name}\\b`, 'g'), `electron_1.${name}`)
}

fs.writeFileSync(dest, content, 'utf8')
console.log('✓ preload.cjs updated from preload.js')
