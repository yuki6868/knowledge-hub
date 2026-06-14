const fs = require('node:fs')
const path = require('node:path')
const { execFileSync } = require('node:child_process')

const rootDir = path.resolve(__dirname, '..')
const assetDir = path.join(rootDir, 'electron', 'assets')
const svgPath = path.join(assetDir, 'icon.svg')
const pngPath = path.join(assetDir, 'icon.png')
const iconsetDir = path.join(assetDir, 'icon.iconset')
const icnsPath = path.join(assetDir, 'icon.icns')

const run = (command, args) => {
  execFileSync(command, args, { stdio: 'inherit' })
}

if (!fs.existsSync(svgPath)) {
  throw new Error(`icon.svg が見つかりません: ${svgPath}`)
}

fs.mkdirSync(assetDir, { recursive: true })

if (!fs.existsSync(pngPath)) {
  run('sips', ['-s', 'format', 'png', svgPath, '--out', pngPath])
}

if (process.platform !== 'darwin') {
  console.log('icon.png を生成しました。icns 生成は macOS で実行してください。')
  process.exit(0)
}

fs.rmSync(iconsetDir, { recursive: true, force: true })
fs.mkdirSync(iconsetDir, { recursive: true })

const sizes = [
  [16, 'icon_16x16.png'],
  [32, 'icon_16x16@2x.png'],
  [32, 'icon_32x32.png'],
  [64, 'icon_32x32@2x.png'],
  [128, 'icon_128x128.png'],
  [256, 'icon_128x128@2x.png'],
  [256, 'icon_256x256.png'],
  [512, 'icon_256x256@2x.png'],
  [512, 'icon_512x512.png'],
  [1024, 'icon_512x512@2x.png'],
]

for (const [size, filename] of sizes) {
  run('sips', ['-z', String(size), String(size), pngPath, '--out', path.join(iconsetDir, filename)])
}

run('iconutil', ['-c', 'icns', iconsetDir, '-o', icnsPath])
fs.rmSync(iconsetDir, { recursive: true, force: true })
console.log(`Electron icon を生成しました: ${icnsPath}`)
