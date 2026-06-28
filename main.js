const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1600,
    height: 900,
    title: '日月食教育演示 — HelioLuna',
    icon: path.join(__dirname, 'screenshots', 'Earth.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });
  win.setMenuBarVisibility(false);
  win.loadFile('index.html');
  win.maximize();
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
