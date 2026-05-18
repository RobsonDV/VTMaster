const { spawn } = require('child_process')
const { mkdirSync } = require('fs')
const { join } = require('path')
const electronPath = require('electron')

const env = { ...process.env, NODE_ENV: 'development' }
delete env.ELECTRON_RUN_AS_NODE

const userDataDir = join(process.cwd(), '.electron-dev-user-data')
mkdirSync(userDataDir, { recursive: true })

const child = spawn(electronPath, [
  `--user-data-dir=${userDataDir}`,
  '--disable-gpu',
  '--disable-gpu-compositing',
  '--disable-gpu-sandbox',
  '--disable-software-rasterizer',
  '--disable-features=UseSkiaRenderer,VizDisplayCompositor',
  '.',
], {
  cwd: process.cwd(),
  env,
  stdio: 'inherit',
  windowsHide: false,
})

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal)
  process.exit(code ?? 0)
})
