const path = require('node:path')
const { app, BrowserWindow, Menu, shell } = require('electron')

const PRODUCTION_URL = 'https://knowledge-hub-tawny-one.vercel.app'
const APP_NAME = 'Knowledge Hub'
const APP_PROTOCOL = 'knowledge-hub'

let mainWindow = null
let pendingDeepLinkUrl = null

const resolveStartUrl = () => {
  const envUrl = process.env.KNOWLEDGE_HUB_URL
  if (envUrl && /^https?:\/\//.test(envUrl)) {
    return envUrl
  }
  return PRODUCTION_URL
}

const getAppIconPath = () => {
  const iconName = process.platform === 'darwin' ? 'icon.icns' : 'icon.png'
  return path.join(__dirname, 'assets', iconName)
}

const isAppProtocolUrl = (url) => url.startsWith(`${APP_PROTOCOL}://`)

const isAllowedInAppUrl = (url) => {
  try {
    const startUrl = new URL(resolveStartUrl())
    const nextUrl = new URL(url)

    if (nextUrl.origin === startUrl.origin) return true
    if (nextUrl.protocol === `${APP_PROTOCOL}:`) return true

    const hostname = nextUrl.hostname.toLowerCase()
    if (hostname === 'accounts.google.com') return true
    if (hostname === 'oauth2.googleapis.com') return true
    if (hostname.endsWith('.googleusercontent.com')) return true
    if (hostname.endsWith('.supabase.co')) return true

    return false
  } catch {
    return false
  }
}

const focusMainWindow = () => {
  if (!mainWindow) return
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
}

const buildCallbackUrlForWebApp = (deepLinkUrl) => {
  const startUrl = new URL(resolveStartUrl())
  const callbackUrl = new URL(deepLinkUrl)
  const pathName = callbackUrl.pathname && callbackUrl.pathname !== '/' ? callbackUrl.pathname : '/'
  return `${startUrl.origin}${pathName}${callbackUrl.search}${callbackUrl.hash}`
}

const handleDeepLink = (url) => {
  if (!url || !isAppProtocolUrl(url)) return

  if (!mainWindow) {
    pendingDeepLinkUrl = url
    createMainWindow()
    return
  }

  const webCallbackUrl = buildCallbackUrlForWebApp(url)
  mainWindow.loadURL(webCallbackUrl)
  focusMainWindow()
}

const createMainWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 980,
    minHeight: 680,
    title: APP_NAME,
    backgroundColor: '#0f172a',
    show: false,
    icon: getAppIconPath(),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isAppProtocolUrl(url)) {
      handleDeepLink(url)
      return { action: 'deny' }
    }

    if (isAllowedInAppUrl(url)) {
      mainWindow?.loadURL(url)
      return { action: 'deny' }
    }

    shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (isAppProtocolUrl(url)) {
      event.preventDefault()
      handleDeepLink(url)
      return
    }

    if (!isAllowedInAppUrl(url)) {
      event.preventDefault()
      shell.openExternal(url)
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  const urlToLoad = pendingDeepLinkUrl
    ? buildCallbackUrlForWebApp(pendingDeepLinkUrl)
    : resolveStartUrl()
  pendingDeepLinkUrl = null
  mainWindow.loadURL(urlToLoad)
}

const createApplicationMenu = () => {
  const template = [
    {
      label: APP_NAME,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Window',
      submenu: [{ role: 'minimize' }, { role: 'close' }],
    },
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

const gotSingleInstanceLock = app.requestSingleInstanceLock()

if (!gotSingleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', (_event, argv) => {
    const deepLinkUrl = argv.find((value) => isAppProtocolUrl(value))
    if (deepLinkUrl) handleDeepLink(deepLinkUrl)
    focusMainWindow()
  })

  app.on('open-url', (event, url) => {
    event.preventDefault()
    handleDeepLink(url)
  })

  app.whenReady().then(() => {
    app.setName(APP_NAME)
    app.setAsDefaultProtocolClient(APP_PROTOCOL)
    createApplicationMenu()
    createMainWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow()
      } else {
        focusMainWindow()
      }
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit()
    }
  })
}
