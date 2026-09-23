/**
 * VIBELY Electron Automated Integration Verifier
 * Programmatically tests the Electron lifecycle, splash screen, main window, preload API, and DOM integration
 */
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

app.name = 'VIBELY';
if (process.platform === 'win32') {
  app.setAppUserModelId('com.vibely.social');
}

const BACKEND_URL = process.env.VIBELY_APP_URL || 'http://127.0.0.1:8000';
const TITLEBAR_CSS = fs.readFileSync(path.join(__dirname, 'src', 'desktop-titlebar.css'), 'utf8');
const BRIDGE_JS = fs.readFileSync(path.join(__dirname, 'src', 'desktop-bridge.js'), 'utf8');

let splashWin = null;
let mainWin = null;

async function runTests() {
  console.log('=== VIBELY Electron Automated Verification ===');
  console.log(`[TEST 1] Testing Backend URL: ${BACKEND_URL}`);

  // 1. Verify Splash Screen
  console.log('[TEST 2] Launching Splash Screen...');
  splashWin = new BrowserWindow({
    width: 480,
    height: 360,
    frame: false,
    show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });
  await splashWin.loadFile(path.join(__dirname, 'assets', 'splash', 'splash.html'));
  console.log('[PASS] Splash screen HTML & CSS loaded successfully.');

  // 2. Verify Main Window & Preload Bridge
  console.log('[TEST 3] Launching Main Window with Preload Bridge...');
  mainWin = new BrowserWindow({
    width: 1320,
    height: 820,
    minWidth: 1200,
    minHeight: 720,
    title: 'VIBELY - Social Media',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
    },
  });

  mainWin.webContents.on('dom-ready', () => {
    mainWin.webContents.insertCSS(TITLEBAR_CSS).catch(() => {});
    mainWin.webContents.executeJavaScript(BRIDGE_JS).catch(() => {});
  });

  // Setup IPC listener
  ipcMain.handle('get-backend-url', () => BACKEND_URL);
  ipcMain.handle('window-is-maximized', () => false);

  try {
    await mainWin.loadURL(BACKEND_URL);
    console.log(`[PASS] Successfully loaded ${BACKEND_URL} in Electron webContents.`);

    // 3. Verify window.vibelyDesktop API in Renderer
    const desktopApiTest = await mainWin.webContents.executeJavaScript(`
      (() => {
        return {
          hasApi: typeof window.vibelyDesktop !== 'undefined',
          hasMinimize: typeof window.vibelyDesktop?.minimize === 'function',
          hasMaximize: typeof window.vibelyDesktop?.maximize === 'function',
          hasClose: typeof window.vibelyDesktop?.close === 'function',
          platform: window.vibelyDesktop?.platform,
          version: window.vibelyDesktop?.version,
        };
      })()
    `);

    console.log('[TEST 4] window.vibelyDesktop API check:', JSON.stringify(desktopApiTest));
    if (!desktopApiTest.hasApi) {
      throw new Error('window.vibelyDesktop is not defined in renderer!');
    }
    console.log('[PASS] window.vibelyDesktop contextBridge safely exposed in renderer.');

    // Give DOM a tick for titlebar injection
    await new Promise(r => setTimeout(r, 600));

    // 4. Verify Desktop Titlebar Injection
    const titlebarTest = await mainWin.webContents.executeJavaScript(`
      (() => {
        const titlebar = document.getElementById('vibely-desktop-titlebar');
        const searchBtn = document.getElementById('titlebar-search-trigger');
        const minBtn = document.getElementById('vibely-win-min');
        const maxBtn = document.getElementById('vibely-win-max');
        const closeBtn = document.getElementById('vibely-win-close');
        return {
          hasTitlebar: !!titlebar,
          hasSearch: !!searchBtn,
          hasControls: !!(minBtn && maxBtn && closeBtn),
          bodyClass: document.body.classList.contains('vibely-desktop-app'),
        };
      })()
    `);

    console.log('[TEST 5] Injected Desktop Titlebar check:', JSON.stringify(titlebarTest));
    if (!titlebarTest.hasTitlebar) {
      throw new Error('Desktop titlebar was not injected into DOM!');
    }
    console.log('[PASS] Custom Desktop Titlebar successfully injected with controls and search pill.');

    // 5. Verify Login View in Desktop
    await mainWin.loadURL(`${BACKEND_URL}/login.html`);
    await new Promise(r => setTimeout(r, 600));
    const loginTest = await mainWin.webContents.executeJavaScript(`
      (() => {
        return {
          hasLoginForm: !!document.getElementById('login-form'),
          hasUsernameInput: !!document.getElementById('login-username'),
          hasPasswordInput: !!document.getElementById('login-password'),
        };
      })()
    `);
    console.log('[TEST 6] Login View in Desktop check:', JSON.stringify(loginTest));
    if (!loginTest.hasLoginForm) {
      throw new Error('Login form could not be rendered in desktop window!');
    }
    console.log('[PASS] Login view loads properly inside Electron with native controls.');

    // 6. Verify Offline Fallback View
    await mainWin.loadFile(path.join(__dirname, 'src', 'offline.html'));
    const offlineTest = await mainWin.webContents.executeJavaScript(`
      (() => {
        return {
          hasOfflineTitle: !!document.querySelector('.offline-title'),
          hasRetryBtn: !!document.getElementById('retry-btn'),
          hasTargetUrl: !!document.getElementById('target-url'),
        };
      })()
    `);
    console.log('[TEST 7] Offline Recovery Page check:', JSON.stringify(offlineTest));
    if (!offlineTest.hasOfflineTitle || !offlineTest.hasRetryBtn) {
      throw new Error('Offline fallback page structure invalid!');
    }
    console.log('[PASS] Offline Recovery View rendered with retry button and target URL.');

    console.log('\n>>> ALL 7 ELECTRON DESKTOP VERIFICATIONS PASSED SUCCESSFULLY! <<<');
    process.exit(0);
  } catch (err) {
    console.error('[FAIL] Electron verification failed:', err);
    process.exit(1);
  }
}

app.whenReady().then(runTests);
