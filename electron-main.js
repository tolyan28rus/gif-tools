const { app, BrowserWindow, dialog } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const net = require('net');

let mainWindow = null;
let serverProcess = null;
let SERVER_PORT = 3456;

function findAvailablePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
    server.on('error', reject);
  });
}

function waitForServer(port, timeoutMs = 30000) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const check = () => {
      const socket = net.createConnection(port, '127.0.0.1');
      socket.on('connect', () => {
        socket.destroy();
        resolve(true);
      });
      socket.on('error', () => {
        socket.destroy();
        if (Date.now() - startTime > timeoutMs) {
          resolve(false);
        } else {
          setTimeout(check, 500);
        }
      });
    };
    check();
  });
}

async function startServer() {
  const isDev = !app.isPackaged;
  let serverPath, cwd;
  const fs = require('fs');

  if (isDev) {
    cwd = path.join(__dirname);
    serverPath = path.join(cwd, '.next', 'standalone', 'server.js');
    if (!fs.existsSync(serverPath)) {
      const subdirs = fs.readdirSync(path.join(cwd, '.next', 'standalone'), { withFileTypes: true })
        .filter(d => d.isDirectory() && d.name !== '.next' && d.name !== 'public' && d.name !== 'node_modules');
      if (subdirs.length > 0) {
        serverPath = path.join(cwd, '.next', 'standalone', subdirs[0].name, 'server.js');
        cwd = path.join(cwd, '.next', 'standalone', subdirs[0].name);
      }
    } else {
      cwd = path.join(cwd, '.next', 'standalone');
    }
  } else {
    const resourcesPath = process.resourcesPath;
    serverPath = path.join(resourcesPath, 'standalone', 'server.js');
    cwd = path.join(resourcesPath, 'standalone');
    if (!fs.existsSync(serverPath)) {
      const subdirs = fs.readdirSync(path.join(resourcesPath, 'standalone'), { withFileTypes: true })
        .filter(d => d.isDirectory() && d.name !== '.next' && d.name !== 'public' && d.name !== 'node_modules');
      if (subdirs.length > 0) {
        serverPath = path.join(resourcesPath, 'standalone', subdirs[0].name, 'server.js');
        cwd = path.join(resourcesPath, 'standalone', subdirs[0].name);
      }
    }
  }

  if (!fs.existsSync(serverPath)) {
    dialog.showErrorBox(
      'Server Error',
      `Next.js server not found at: ${serverPath}\n\nPlease run "npm run build" first.`
    );
    app.quit();
    return;
  }

  SERVER_PORT = await findAvailablePort();

  console.log(`[GIF Tools] Starting server on port ${SERVER_PORT}`);
  console.log(`[GIF Tools] Server: ${serverPath}`);
  console.log(`[GIF Tools] CWD: ${cwd}`);

  const nodeBin = isDev ? 'node' : process.execPath;
  const spawnEnv = {
    ...process.env,
    PORT: SERVER_PORT,
    HOST: '127.0.0.1',
    NODE_ENV: 'production',
    FFMPEG_PATH: isDev ? path.join(__dirname, 'resources', 'ffmpeg', 'ffmpeg.exe') : path.join(process.resourcesPath, 'ffmpeg', 'ffmpeg.exe'),
  };
  if (!isDev) {
    spawnEnv.ELECTRON_RUN_AS_NODE = '1';
  }

  serverProcess = spawn(nodeBin, [serverPath], {
    cwd,
    env: spawnEnv,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  serverProcess.stdout.on('data', (data) => {
    console.log(`[Server] ${data.toString().trim()}`);
  });

  serverProcess.stderr.on('data', (data) => {
    console.error(`[Server] ${data.toString().trim()}`);
  });

  serverProcess.on('error', (err) => {
    console.error('[GIF Tools] Failed to start server:', err);
    dialog.showErrorBox('Server Error', `Failed to start Next.js server: ${err.message}`);
    app.quit();
  });

  serverProcess.on('exit', (code) => {
    console.log(`[GIF Tools] Server exited with code ${code}`);
    serverProcess = null;
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    title: 'GIF Tools',
    icon: path.join(__dirname, 'public', 'icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    autoHideMenuBar: true,
    show: false,
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  const url = `http://127.0.0.1:${SERVER_PORT}`;
  console.log(`[GIF Tools] Loading ${url}`);
  mainWindow.loadURL(url);

  mainWindow.webContents.on('did-fail-load', (_, errorCode, errorDescription) => {
    console.error(`[GIF Tools] Load failed: ${errorCode} - ${errorDescription}`);
    setTimeout(() => {
      if (mainWindow) {
        mainWindow.loadURL(url);
      }
    }, 2000);
  });
}

app.whenReady().then(async () => {
  await startServer();

  const serverReady = await waitForServer(SERVER_PORT);
  if (!serverReady) {
    dialog.showErrorBox(
      'Server Timeout',
      'Next.js server failed to start within 30 seconds.'
    );
    app.quit();
    return;
  }

  console.log('[GIF Tools] Server ready, creating window');
  createWindow();
});

app.on('window-all-closed', () => {
  if (serverProcess) {
    console.log('[GIF Tools] Killing server process');
    serverProcess.kill();
    serverProcess = null;
  }
  app.quit();
});

app.on('before-quit', () => {
  if (serverProcess) {
    console.log('[GIF Tools] Killing server process');
    serverProcess.kill('SIGTERM');
    serverProcess = null;
  }
});
