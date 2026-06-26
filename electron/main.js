const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

let win;

// ── Base paths ────────────────────────────────────────────────────────────────
const getModsPath = () => app.isPackaged
  ? path.join(process.resourcesPath, 'mods')
  : path.join(__dirname, '..', 'mods');

const getRestorePath = () => app.isPackaged
  ? path.join(process.resourcesPath, 'restaurar_mods')
  : path.join(__dirname, '..', 'restaurar_mods');

const RESTORE_MAP = {
  'Boost_Standard_SF.upk':     'boosts/Boost_Standard_SF.upk',
  'skin_grain_flames_SF.upk':  'decals/fennec/skin_grain_flames_SF.upk',
  'Skin_Octane_Wings_SF.upk':  'decals/octane/Skin_Octane_Wings_SF.upk',
  'Explosion_Default_SF.upk':  'goal explosion/Explosion_Default_SF.upk',
  'WHEEL_Hydra_SF.upk':        'wheels/WHEEL_Hydra_SF.upk',
  'Antenna_SoccerBall_SF.upk': 'antennas/Antenna_SoccerBall_SF.upk',
};

// ── Auto updater ──────────────────────────────────────────────────────────────
function setupAutoUpdater() {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => {
    console.log('[updater] Verificando updates...');
    win?.webContents.send('update-status', { status: 'checking' });
  });

  autoUpdater.on('update-available', (info) => {
    console.log('[updater] Update disponível:', info.version);
    win?.webContents.send('update-status', { status: 'available', version: info.version });
  });

  autoUpdater.on('update-not-available', () => {
    console.log('[updater] App já está na versão mais recente.');
    win?.webContents.send('update-status', { status: 'latest' });
  });

  autoUpdater.on('download-progress', (progress) => {
    const pct = Math.round(progress.percent);
    console.log(`[updater] Baixando: ${pct}%`);
    win?.webContents.send('update-status', { status: 'downloading', percent: pct });
  });

  autoUpdater.on('update-downloaded', (info) => {
    console.log('[updater] Download concluído:', info.version);
    win?.webContents.send('update-status', { status: 'downloaded', version: info.version });
  });

  autoUpdater.on('error', (err) => {
    console.error('[updater] Erro:', err.message);
    win?.webContents.send('update-status', { status: 'error', message: err.message });
  });

  // Só verifica se estiver empacotado (.exe instalado)
  if (app.isPackaged) {
    // Pequeno delay para janela estar pronta
    setTimeout(() => autoUpdater.checkForUpdates(), 3000);
  }
}

// Permite que o renderer instale o update manualmente
ipcMain.on('install-update', () => {
  autoUpdater.quitAndInstall();
});

// ── RL path detection ─────────────────────────────────────────────────────────
const RL_CANDIDATES = [
  'C:\\Program Files\\Epic Games\\rocketleague\\TAGame\\CookedPCConsole',
  'C:\\Program Files (x86)\\Epic Games\\rocketleague\\TAGame\\CookedPCConsole',
  'C:\\Program Files (x86)\\Steam\\steamapps\\common\\rocketleague\\TAGame\\CookedPCConsole',
  'C:\\Program Files\\Steam\\steamapps\\common\\rocketleague\\TAGame\\CookedPCConsole',
];

function getPathFromRegistry() {
  try {
    const epic = execSync(
      'reg query "HKLM\\SOFTWARE\\EpicGames\\Unreal Engine" /s /f "rocketleague" 2>nul',
      { encoding: 'utf8', timeout: 3000 }
    );
    const match = epic.match(/InstallLocation\s+REG_SZ\s+(.+)/i);
    if (match) {
      const candidate = path.join(match[1].trim(), 'TAGame', 'CookedPCConsole');
      if (fs.existsSync(candidate)) return candidate;
    }
  } catch (_) {}
  try {
    const steam = execSync(
      'reg query "HKLM\\SOFTWARE\\WOW6432Node\\Valve\\Steam" /v InstallPath 2>nul',
      { encoding: 'utf8', timeout: 3000 }
    );
    const match = steam.match(/InstallPath\s+REG_SZ\s+(.+)/i);
    if (match) {
      const candidate = path.join(
        match[1].trim(), 'steamapps', 'common', 'rocketleague', 'TAGame', 'CookedPCConsole'
      );
      if (fs.existsSync(candidate)) return candidate;
    }
  } catch (_) {}
  return null;
}

function scanDrives() {
  const drives = 'DEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  const suffixes = [
    '\\Games\\rocketleague\\TAGame\\CookedPCConsole',
    '\\Steam\\steamapps\\common\\rocketleague\\TAGame\\CookedPCConsole',
    '\\Program Files\\Epic Games\\rocketleague\\TAGame\\CookedPCConsole',
    '\\Epic Games\\rocketleague\\TAGame\\CookedPCConsole',
  ];
  for (const drive of drives) {
    for (const suffix of suffixes) {
      const p = `${drive}:${suffix}`;
      if (fs.existsSync(p)) return p;
    }
  }
  return null;
}

function detectRLPath() {
  for (const p of RL_CANDIDATES) {
    if (fs.existsSync(p)) return p;
  }
  return getPathFromRegistry() || scanDrives() || null;
}

// ── Window ────────────────────────────────────────────────────────────────────
function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    backgroundColor: '#070714',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    icon: path.join(__dirname, '..', 'assets', 'icon.ico'),
  });

  win.loadFile(path.join(__dirname, '..', 'src', 'index.html'));

  // Setup updater depois que a página carregar
  win.webContents.on('did-finish-load', () => {
    setupAutoUpdater();
  });
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

// ── IPC ───────────────────────────────────────────────────────────────────────
ipcMain.on('win-minimize', () => win.minimize());
ipcMain.on('win-maximize', () => win.isMaximized() ? win.unmaximize() : win.maximize());
ipcMain.on('win-close',    () => win.close());

ipcMain.handle('detect-rl-path', () => detectRLPath());

ipcMain.handle('browse-rl-path', async () => {
  const result = await dialog.showOpenDialog(win, {
    title: 'Selecione a pasta CookedPCConsole do Rocket League',
    properties: ['openDirectory'],
    defaultPath: 'C:\\Program Files',
  });
  if (result.canceled || !result.filePaths.length) return null;
  return result.filePaths[0];
});

ipcMain.handle('apply-mod', async (_event, { modFile, targetFile, rlPath, folder }) => {
  try {
    if (!rlPath || !fs.existsSync(rlPath)) {
      return { ok: false, error: 'Pasta do Rocket League não encontrada.' };
    }
    const src  = path.join(getModsPath(), folder, modFile);
    const dest = path.join(rlPath, targetFile);
    if (!fs.existsSync(src)) {
      return { ok: false, error: `Arquivo mod não encontrado: ${src}` };
    }
    const restoreRelPath = RESTORE_MAP[targetFile];
    const restoreSrc = restoreRelPath ? path.join(getRestorePath(), restoreRelPath) : null;
    const bakDest = dest + '.bak';
    if (!fs.existsSync(bakDest)) {
      if (restoreSrc && fs.existsSync(restoreSrc)) {
        fs.copyFileSync(restoreSrc, bakDest);
      } else if (fs.existsSync(dest)) {
        fs.copyFileSync(dest, bakDest);
      }
    }
    fs.copyFileSync(src, dest);
    return { ok: true, dest };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('restore-mod', async (_event, { targetFile, rlPath }) => {
  try {
    if (!rlPath || !fs.existsSync(rlPath)) {
      return { ok: false, error: 'Pasta do Rocket League não encontrada.' };
    }
    const dest = path.join(rlPath, targetFile);
    const bak  = dest + '.bak';
    if (fs.existsSync(bak)) {
      fs.copyFileSync(bak, dest);
      fs.unlinkSync(bak);
      return { ok: true, source: 'backup' };
    }
    const restoreRelPath = RESTORE_MAP[targetFile];
    if (restoreRelPath) {
      const restoreSrc = path.join(getRestorePath(), restoreRelPath);
      if (fs.existsSync(restoreSrc)) {
        fs.copyFileSync(restoreSrc, dest);
        return { ok: true, source: 'restaurar_mods' };
      }
    }
    return { ok: false, error: 'Nenhum arquivo original encontrado para restaurar.' };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});
