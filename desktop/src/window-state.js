/**
 * VIBELY Desktop Window State Manager
 * Persists and restores window geometry and maximized state safely.
 */
const { app } = require('electron');
const path = require('path');
const fs = require('fs');

class WindowStateManager {
  constructor(defaultWidth = 1320, defaultHeight = 820) {
    this.stateFilePath = path.join(app.getPath('userData'), 'vibely-window-state.json');
    this.defaultState = {
      width: defaultWidth,
      height: defaultHeight,
      x: undefined,
      y: undefined,
      isMaximized: false,
    };
    this.state = this.loadState();
  }

  loadState() {
    try {
      if (fs.existsSync(this.stateFilePath)) {
        const data = fs.readFileSync(this.stateFilePath, 'utf8');
        return { ...this.defaultState, ...JSON.parse(data) };
      }
    } catch (err) {
      console.warn('Could not read window state, using defaults:', err.message);
    }
    return { ...this.defaultState };
  }

  saveState(win) {
    if (!win) return;
    try {
      const isMaximized = win.isMaximized();
      if (!isMaximized) {
        const bounds = win.getBounds();
        this.state = {
          width: bounds.width,
          height: bounds.height,
          x: bounds.x,
          y: bounds.y,
          isMaximized: false,
        };
      } else {
        this.state.isMaximized = true;
      }
      fs.writeFileSync(this.stateFilePath, JSON.stringify(this.state, null, 2), 'utf8');
    } catch (err) {
      console.warn('Could not save window state:', err.message);
    }
  }

  track(win) {
    let saveTimeout;
    const debouncedSave = () => {
      clearTimeout(saveTimeout);
      saveTimeout = setTimeout(() => this.saveState(win), 300);
    };

    win.on('resize', debouncedSave);
    win.on('move', debouncedSave);
    win.on('close', () => this.saveState(win));
  }
}

module.exports = WindowStateManager;
