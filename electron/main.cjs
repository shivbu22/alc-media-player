const { app, BrowserWindow, Menu, dialog, ipcMain, session, protocol } = require('electron')
const path = require('node:path')
const fs = require('node:fs')

// Register privileged scheme for high-performance audio/video streaming with range requests
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'alc-media',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
      bypassCSP: true,
    },
  },
])

// Enable hardware decoding, GPU rasterization, and HEVC / H.265 platform decoder support
app.commandLine.appendSwitch('enable-features', 'PlatformHEVCDecoderSupport')
app.commandLine.appendSwitch('ignore-gpu-blocklist')
app.commandLine.appendSwitch('enable-gpu-rasterization')
app.commandLine.appendSwitch('enable-zero-copy')

const logPath = path.join(app.getPath('temp'), 'alc-media-player-debug.log')
function log(...args) {
  const line = `[${new Date().toISOString()}] ${args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : a)).join(' ')}\n`
  try {
    fs.appendFileSync(logPath, line)
  } catch (_) {}
  console.log(...args)
}

process.on('uncaughtException', (err) => log('UNCAUGHT EXCEPTION:', err?.stack || err))
process.on('unhandledRejection', (reason) => log('UNHANDLED REJECTION:', reason?.stack || reason))

log('App starting. isPackaged:', app.isPackaged, 'argv:', process.argv)

const isDev = !app.isPackaged

const SENSITIVE_DIRS = new Set([
  'windows',
  'system32',
  'program files',
  'program files (x86)',
  '$recycle.bin',
  '.git',
  '.ssh',
  'appdata',
  'node_modules',
])

function isRootDirectory(dirPath) {
  if (!dirPath || typeof dirPath !== 'string') return true
  const norm = path.normalize(dirPath).replace(/\\/g, '/').toLowerCase()
  return /^[a-z]:\/?$/.test(norm) || norm === '/' || norm === '\\'
}

function isPathAllowed(targetPath) {
  if (!targetPath || typeof targetPath !== 'string') return false
  const resolved = path.resolve(targetPath)
  if (isRootDirectory(resolved)) return false
  const segments = resolved.toLowerCase().split(/[\\/]/)
  for (const seg of segments) {
    if (SENSITIVE_DIRS.has(seg)) return false
  }
  return true
}

function scanDirectory(dirPath, maxDepth = 6, currentDepth = 0, state = { count: 0 }) {
  let results = []
  if (currentDepth > maxDepth || state.count >= 5000) return results
  if (currentDepth === 0 && isRootDirectory(dirPath)) {
    log('Security: Attempted recursive scan of root drive blocked:', dirPath)
    return results
  }

  try {
    const list = fs.readdirSync(dirPath, { withFileTypes: true })
    for (const item of list) {
      if (state.count >= 5000) break
      const lower = item.name.toLowerCase()
      // Skip hidden and sensitive system directories
      if (SENSITIVE_DIRS.has(lower) || item.name.startsWith('.')) continue

      const fullPath = path.join(dirPath, item.name)
      if (item.isDirectory()) {
        results = results.concat(scanDirectory(fullPath, maxDepth, currentDepth + 1, state))
      } else if (item.isFile()) {
        try {
          const stats = fs.statSync(fullPath)
          results.push({
            name: item.name,
            path: fullPath,
            size: stats.size,
            extension: path.extname(item.name).replace('.', '').toLowerCase(),
          })
          state.count++
        } catch (_) {}
      }
    }
  } catch (_) {}
  return results
}

function createWindow() {
  log('createWindow called')
  const window = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1180,
    minHeight: 720,
    backgroundColor: '#f1f5f9',
    title: 'ALC — Media Player',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, 'preload.cjs'),
      webSecurity: true,
    },
  })

  Menu.setApplicationMenu(null)

  const targetFile = path.join(__dirname, '..', 'dist', 'index.html')
  log('targetFile path:', targetFile, 'exists:', fs.existsSync(targetFile))

  window.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    log('Failed to load:', errorCode, errorDescription, validatedURL)
  })

  window.webContents.on('did-finish-load', () => {
    log('Window finished load successfully')
  })

  window.webContents.on('render-process-gone', (_event, details) => {
    log('Render process gone:', details)
  })

  window.on('closed', () => {
    log('Window closed event fired')
  })

  const { shell } = require('electron')

  // Navigation lock: prevent rogue navigation away from local app bundle
  window.webContents.on('will-navigate', (event, url) => {
    const isDevUrl = isDev && url.startsWith('http://127.0.0.1:5173')
    const isAppFile = url.startsWith('file://')
    if (!isDevUrl && !isAppFile) {
      event.preventDefault()
      shell.openExternal(url)
    }
  })

  // Popup restriction: disallow untrusted new Electron windows, delegate web links to system browser
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url)
    }
    return { action: 'deny' }
  })

  if (isDev) {
    window.loadURL('http://127.0.0.1:5173').catch((err) => log('loadURL error:', err))
  } else {
    window.loadFile(targetFile).catch((err) => log('loadFile error:', err))
  }
}

app.whenReady().then(() => {
  log('app.whenReady fired')

  // Fix YouTube embed Error 153 by injecting valid Referer and Origin headers
  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    const requestHeaders = Object.assign({}, details.requestHeaders)
    if (
      details.url.includes('youtube.com') ||
      details.url.includes('youtube-nocookie.com') ||
      details.url.includes('googlevideo.com')
    ) {
      requestHeaders['Referer'] = 'https://www.youtube.com/'
      requestHeaders['Origin'] = 'https://www.youtube.com'
    }
    callback({ requestHeaders })
  })

  // Bypass CORS for arbitrary internet media links
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const responseHeaders = Object.assign({}, details.responseHeaders)
    responseHeaders['Access-Control-Allow-Origin'] = ['*']
    responseHeaders['Access-Control-Allow-Methods'] = ['GET, POST, OPTIONS, HEAD']
    responseHeaders['Access-Control-Allow-Headers'] = ['*']
    callback({ responseHeaders })
  })

  // Handle alc-media:// custom streaming protocol with 206 Partial Content (Range Requests)
  protocol.handle('alc-media', async (request) => {
    try {
      const url = new URL(request.url)
      let filePath = decodeURIComponent(url.pathname)
      filePath = filePath.replace(/^\/local\//, '/').replace(/^\//, '')
      if (process.platform === 'win32' && !/^[a-zA-Z]:/.test(filePath) && /^\/[a-zA-Z]:/.test(url.pathname)) {
        filePath = url.pathname.slice(1)
      }
      filePath = path.resolve(filePath)

      const ext = path.extname(filePath).toLowerCase()
      const mimeTypes = {
        '.mov': 'video/quicktime',
        '.mp4': 'video/mp4',
        '.mkv': 'video/x-matroska',
        '.webm': 'video/webm',
        '.avi': 'video/x-msvideo',
        '.m4v': 'video/mp4',
        '.wmv': 'video/x-ms-wmv',
        '.3gp': 'video/3gpp',
        '.ts': 'video/mp2t',
        '.ogv': 'video/ogg',
        '.mp3': 'audio/mpeg',
        '.wav': 'audio/wav',
        '.ogg': 'audio/ogg',
        '.aac': 'audio/aac',
        '.flac': 'audio/flac',
        '.m4a': 'audio/mp4',
        '.wma': 'audio/x-ms-wma',
        '.opus': 'audio/opus',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.webp': 'image/webp',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.bmp': 'image/bmp',
        '.avif': 'image/avif',
      }

      // Security check: restrict strictly to verified media formats (prevents arbitrary file disclosure)
      const contentType = mimeTypes[ext]
      if (!contentType) {
        return new Response('Access denied: Unauthorized file type', { status: 403 })
      }

      if (!fs.existsSync(filePath)) {
        return new Response('File not found', { status: 404 })
      }

      const stats = fs.statSync(filePath)
      if (!stats.isFile()) {
        return new Response('Access denied: Target is not a regular file', { status: 403 })
      }

      const fileSize = stats.size
      const rangeHeader = request.headers.get('range')

      if (rangeHeader) {
        const parts = rangeHeader.replace(/bytes=/, '').split('-')
        const start = parseInt(parts[0], 10)
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1

        if (start >= fileSize) {
          return new Response('Requested range not satisfiable', {
            status: 416,
            headers: { 'Content-Range': `bytes */${fileSize}` },
          })
        }

        const chunkSize = end - start + 1
        const fileStream = fs.createReadStream(filePath, { start, end })
        const readableStream = new ReadableStream({
          start(controller) {
            fileStream.on('data', (chunk) => controller.enqueue(chunk))
            fileStream.on('end', () => controller.close())
            fileStream.on('error', (err) => controller.error(err))
          },
          cancel() {
            fileStream.destroy()
          },
        })

        return new Response(readableStream, {
          status: 206,
          headers: {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': String(chunkSize),
            'Content-Type': contentType,
            'Access-Control-Allow-Origin': '*',
          },
        })
      } else {
        const fileStream = fs.createReadStream(filePath)
        const readableStream = new ReadableStream({
          start(controller) {
            fileStream.on('data', (chunk) => controller.enqueue(chunk))
            fileStream.on('end', () => controller.close())
            fileStream.on('error', (err) => controller.error(err))
          },
          cancel() {
            fileStream.destroy()
          },
        })

        return new Response(readableStream, {
          status: 200,
          headers: {
            'Accept-Ranges': 'bytes',
            'Content-Length': String(fileSize),
            'Content-Type': contentType,
            'Access-Control-Allow-Origin': '*',
          },
        })
      }
    } catch (err) {
      log('protocol.handle error:', err)
      return new Response('Internal error', { status: 500 })
    }
  })

  // IPC handlers for native folder picking and scanning
  ipcMain.handle('dialog:open-folder', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const res = await dialog.showOpenDialog(win, {
      title: 'Select Folder with Media',
      properties: ['openDirectory'],
    })
    if (res.canceled || res.filePaths.length === 0) return []
    const selected = res.filePaths[0]
    if (!isPathAllowed(selected)) {
      log('Security: Selected directory blocked as sensitive or root:', selected)
      return []
    }
    return scanDirectory(selected)
  })

  ipcMain.handle('folder:read-path', async (_event, dirPath) => {
    if (!dirPath || typeof dirPath !== 'string') return []
    const cleanPath = path.resolve(dirPath.trim().replace(/^"(.*)"$/, '$1'))
    if (!isPathAllowed(cleanPath)) {
      log('Security: folder:read-path on sensitive/root directory blocked:', cleanPath)
      return []
    }
    if (fs.existsSync(cleanPath) && fs.statSync(cleanPath).isDirectory()) {
      return scanDirectory(cleanPath)
    }
    return []
  })

  ipcMain.handle('download:file', async (event, { url, filename }) => {
    // Protocol validation: Strictly permit HTTP and HTTPS
    if (!url || typeof url !== 'string' || (!url.startsWith('https://') && !url.startsWith('http://'))) {
      return { success: false, error: 'Access denied: Only HTTP and HTTPS URLs are permitted' }
    }

    const win = BrowserWindow.fromWebContents(event.sender)
    // Sanitize filename to prevent directory traversal
    const safeBaseName = path.basename(filename || 'downloaded-media').replace(/[^a-zA-Z0-9._-]/g, '_')
    const res = await dialog.showSaveDialog(win, {
      title: 'Save Media File',
      defaultPath: path.join(app.getPath('downloads'), safeBaseName),
    })
    if (res.canceled || !res.filePath) return { success: false, canceled: true }

    try {
      const fetchMedia = (targetUrl, redirectCount = 0) => {
        if (redirectCount > 5) {
          throw new Error('Too many redirects')
        }
        const parsed = new URL(targetUrl)
        if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
          throw new Error('Invalid redirect protocol')
        }
        const client = parsed.protocol === 'https:' ? require('node:https') : require('node:http')
        return new Promise((resolve, reject) => {
          const req = client.get(targetUrl, (response) => {
            if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
              const redirectUrl = new URL(response.headers.location, targetUrl).href
              return resolve(fetchMedia(redirectUrl, redirectCount + 1))
            }
            if (response.statusCode < 200 || response.statusCode >= 300) {
              return reject(new Error(`Server returned HTTP ${response.statusCode}`))
            }
            const fileStream = fs.createWriteStream(res.filePath)
            response.pipe(fileStream)
            fileStream.on('finish', () => {
              fileStream.close()
              resolve({ success: true, path: res.filePath })
            })
            fileStream.on('error', (err) => {
              fs.unlink(res.filePath, () => {})
              reject(err)
            })
          })
          req.on('error', (err) => {
            fs.unlink(res.filePath, () => {})
            reject(err)
          })
        })
      }

      return await fetchMedia(url)
    } catch (err) {
      fs.unlink(res.filePath, () => {})
      return { success: false, error: err.message }
    }
  })

  createWindow()

  app.on('activate', () => {
    log('app activate fired')
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  log('window-all-closed event fired')
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => log('before-quit event fired'))
app.on('quit', (_e, exitCode) => log('quit event fired with exitCode:', exitCode))

