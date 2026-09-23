/**
 * VIBELY Desktop Main Electron Process
 * Production-quality Windows Desktop Application Architecture
 */
const { app, BrowserWindow, ipcMain, shell, Menu, Notification } = require('electron');
const path = require('path');
const fs = require('fs');
const WindowStateManager = require('./src/window-state');

// Set Application Metadata
app.name = 'VIBELY';
if (process.platform === 'win32') {
  app.setAppUserModelId('com.vibely.social');
}

// Configurable Backend Target URL (Environment or Default Localhost)
const BACKEND_URL = process.env.VIBELY_APP_URL || 'http://127.0.0.1:8000';
const OFFLINE_PAGE = path.join(__dirname, 'src', 'offline.html');
const ICON_PATH = path.join(__dirname, 'assets', 'icons', 'icon.ico');
const ICON_PNG = path.join(__dirname, 'assets', 'icons', 'icon-256.png');

// Load Injected Assets in Main Process (Node Environment)
const TITLEBAR_CSS = fs.readFileSync(path.join(__dirname, 'src', 'desktop-titlebar.css'), 'utf8');
const BRIDGE_JS = fs.readFileSync(path.join(__dirname, 'src', 'desktop-bridge.js'), 'utf8');

let mainWindow = null;
let splashWindow = null;
let windowStateManager = null;
let isOffline = false;

function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 480,
    height: 360,
    frame: false,
    transparent: true,
    resizable: false,
    center: true,
    alwaysOnTop: true,
    skipTaskbar: false,
    icon: ICON_PATH,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  splashWindow.loadFile(path.join(__dirname, 'assets', 'splash', 'splash.html'));
  splashWindow.on('closed', () => {
    splashWindow = null;
  });
}

function createMainWindow() {
  windowStateManager = new WindowStateManager(1320, 820);
  const state = windowStateManager.state;

  mainWindow = new BrowserWindow({
    x: state.x,
    y: state.y,
    width: state.width,
    height: state.height,
    minWidth: 1200,
    minHeight: 720,
    title: 'VIBELY - Social Media',
    icon: ICON_PATH,
    frame: false, // Frameless window with custom desktop titlebar
    show: false,
    backgroundColor: '#FAF8F5',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      spellcheck: true,
    },
  });

  windowStateManager.track(mainWindow);

  // Restore maximized state if saved
  if (state.isMaximized) {
    mainWindow.maximize();
  }

  // Create Application Menu
  setupApplicationMenu();

  // Load Application
  loadAppWithFallback(mainWindow);

  // Inject Desktop Enhancements on DOM Ready
  mainWindow.webContents.on('dom-ready', () => {
    // Only inject on normal web views, not on offline fallback page
    const currentUrl = mainWindow.webContents.getURL();
    if (!currentUrl.includes('offline.html')) {
      mainWindow.webContents.insertCSS(TITLEBAR_CSS).catch(() => {});
      mainWindow.webContents.executeJavaScript(BRIDGE_JS).catch((err) => {
        console.warn('[Vibely Desktop] Bridge injection warning:', err.message);
      });
    }
  });

  // Smooth Splash to Main transition
  const minSplashTime = 1600; // Minimum brand reveal time
  const startTime = Date.now();

  mainWindow.once('ready-to-show', () => {
    const elapsed = Date.now() - startTime;
    const delay = Math.max(0, minSplashTime - elapsed);

    setTimeout(() => {
      if (splashWindow && !splashWindow.isDestroyed()) {
        splashWindow.close();
      }
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.show();
        mainWindow.focus();
      }
    }, delay);
  });

  // Handle Load Failures (e.g. Django server offline)
  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    console.warn(`[Vibely Desktop] Failed to load ${validatedURL}: ${errorDescription} (${errorCode})`);
    if (!isOffline && !validatedURL.includes('offline.html')) {
      isOffline = true;
      mainWindow.loadFile(OFFLINE_PAGE);
    }
  });

  // Window Maximize/Unmaximize Events for Custom Titlebar
  mainWindow.on('maximize', () => {
    mainWindow.webContents.send('window-maximized-change', true);
  });
  mainWindow.on('unmaximize', () => {
    mainWindow.webContents.send('window-maximized-change', false);
  });

  // Intercept new window requests (target="_blank") to open in OS default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isExternalUrl(url)) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  // Intercept navigation to external links
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (isExternalUrl(url)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function loadAppWithFallback(win) {
  if (!win || win.isDestroyed()) return;
  isOffline = false;
  win.loadURL(BACKEND_URL).catch((err) => {
    console.warn('[Vibely Desktop] Initial load failed, showing offline fallback:', err.message);
    isOffline = true;
    win.loadFile(OFFLINE_PAGE);
  });
}

function isExternalUrl(url) {
  if (!url.startsWith('http://') && !url.startsWith('https://')) return false;
  try {
    const parsed = new URL(url);
    const backendParsed = new URL(BACKEND_URL);
    return parsed.origin !== backendParsed.origin &&
           !parsed.hostname.includes('127.0.0.1') &&
           !parsed.hostname.includes('localhost');
  } catch {
    return true;
  }
}

function setupApplicationMenu() {
  const template = [
    {
      label: 'VIBELY',
      submenu: [
        {
          label: 'About VIBELY',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.executeJavaScript(`
                if (typeof showToast === 'function') {
                  showToast('VIBELY Desktop v1.0.0 — Share. Connect. Discover.', 'info');
                } else {
                  alert('VIBELY Desktop v1.0.0\\nShare. Connect. Discover.');
                }
              `);
            }
          },
        },
        { type: 'separator' },
        { role: 'reload', accelerator: 'Ctrl+R' },
        { role: 'forceReload', accelerator: 'Ctrl+Shift+R' },
        {
          label: 'Toggle Developer Tools',
          accelerator: 'Ctrl+Shift+I',
          click: () => mainWindow && mainWindow.webContents.toggleDevTools(),
        },
        { type: 'separator' },
        { role: 'quit', accelerator: 'Ctrl+Q' },
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
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Documentation & Support',
          click: () => shell.openExternal('https://github.com/niralivaghela/CodeAlpha_SocialMediaPlatform'),
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// IPC Handlers
ipcMain.on('window-minimize', () => {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.minimize();
});

ipcMain.on('window-maximize', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.on('window-close', () => {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.close();
});

ipcMain.handle('window-is-maximized', () => {
  return mainWindow && !mainWindow.isDestroyed() ? mainWindow.isMaximized() : false;
});

ipcMain.handle('get-backend-url', () => {
  return BACKEND_URL;
});

ipcMain.on('retry-connection', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    loadAppWithFallback(mainWindow);
  }
});

ipcMain.on('open-external', (_event, url) => {
  if (url) shell.openExternal(url);
});

ipcMain.on('show-notification', (_event, options) => {
  if (Notification.isSupported()) {
    new Notification({
      title: options.title || 'VIBELY',
      body: options.body || '',
      icon: ICON_PNG,
    }).show();
  }
});

// App Lifecycle
app.whenReady().then(() => {
  createSplashWindow();
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
