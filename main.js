// const { app, BrowserWindow, ipcMain, dialog } = require('electron');
// const path  = require('path');
// const { spawn } = require('child_process');
// const fs    = require('fs');

// let mainWindow;

// function createWindow() {
//   mainWindow = new BrowserWindow({
//     width: 1500, height: 880, minWidth: 1000, minHeight: 620,
//     webPreferences: {
//       nodeIntegration: false, contextIsolation: true,
//       preload: path.join(__dirname, 'preload.js')
//     },
//     backgroundColor: '#141520'
//   });
//   mainWindow.loadFile('index.html');
//   // mainWindow.webContents.openDevTools();
//   mainWindow.on('closed', () => { mainWindow = null; });
// }

// app.on('ready', createWindow);
// app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
// app.on('activate', () => { if (!mainWindow) createWindow(); });

// // ── Scripts base ──────────────────────────────────────────────────────────────
// const SCRIPTS_BASE = path.join(__dirname, 'scripts');
// if (!fs.existsSync(SCRIPTS_BASE)) fs.mkdirSync(SCRIPTS_BASE, { recursive: true });

// // ── Recursive file finder ─────────────────────────────────────────────────────
// function findFileInDir(dirPath, testFn) {
//   try {
//     const entries = fs.readdirSync(dirPath, { withFileTypes: true });
//     for (const e of entries)
//       if (!e.isDirectory() && testFn(e.name)) return path.join(dirPath, e.name);
//     for (const e of entries)
//       if (e.isDirectory()) {
//         const found = findFileInDir(path.join(dirPath, e.name), testFn);
//         if (found) return found;
//       }
//   } catch (_) {}
//   return null;
// }

// // ── Load scripts ──────────────────────────────────────────────────────────────
// ipcMain.handle('load-scripts', () => {
//   try {
//     if (!fs.existsSync(SCRIPTS_BASE))
//       return { success: false, error: `Folder missing: ${SCRIPTS_BASE}`, scripts: [] };

//     const scripts = [];
//     fs.readdirSync(SCRIPTS_BASE, { withFileTypes: true }).forEach((entry, idx) => {
//       if (!entry.isDirectory()) return;
//       const folderPath    = path.join(SCRIPTS_BASE, entry.name);
//       const scriptPath    = findFileInDir(folderPath, f => f.endsWith('.py'));
//       const readmePath    = findFileInDir(folderPath, f => /^readme\.(md|txt)$/i.test(f));
//       const configPath    = path.join(folderPath, 'inputs.json');
//       let inputConfig = [];
//       if (fs.existsSync(configPath)) {
//         try { inputConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8')); } catch (_) {}
//       }
//       let createdOn = '';
//       try { createdOn = fs.statSync(folderPath).birthtime.toISOString().split('T')[0]; } catch (_) {}

//       scripts.push({
//         id: idx + 1, name: entry.name, folder: folderPath,
//         scriptPath:  scriptPath || null,
//         scriptFile:  scriptPath  ? path.basename(scriptPath)  : null,
//         readmePath:  readmePath  || null,
//         readmeFile:  readmePath  ? path.basename(readmePath)  : null,
//         createdOn, hasScript: !!scriptPath, hasReadme: !!readmePath, inputConfig
//       });
//     });
//     return { success: true, scripts };
//   } catch (err) {
//     return { success: false, error: err.message, scripts: [] };
//   }
// });

// // ── Read README ───────────────────────────────────────────────────────────────
// ipcMain.handle('read-readme', (_, readmePath) => {
//   try {
//     if (!readmePath || !fs.existsSync(readmePath))
//       return { success: false, content: '# No README found\n\nNo documentation available.' };
//     return { success: true, content: fs.readFileSync(readmePath, 'utf-8') };
//   } catch (err) {
//     return { success: false, content: `# Error\n\n${err.message}` };
//   }
// });

// // ── Active processes keyed by integer runId ───────────────────────────────────
// const procs = {};   // runId -> { proc, scriptPath }
// let runIdCounter = 0;

// // ── Run script ────────────────────────────────────────────────────────────────
// // ipcMain.handle('run-script', (event, { scriptPath, args, stdinLines }) => {
// //   if (!scriptPath || !fs.existsSync(scriptPath)) {
// //     event.sender.send('script-log',  { type: 'error', text: `Script not found: ${scriptPath}` });
// //     event.sender.send('script-done', { code: 1, runId: -1 });
// //     return { success: false, runId: -1 };
// //   }
// //   console.log('PATH:', process.env.PATH);

// //   const runId = ++runIdCounter;

// //   const send = (type, text) => event.sender.send('script-log', { type, text, runId });

// //   send('system',  `▶  ${path.basename(scriptPath)}`);
// //   send('system',  `   ${scriptPath}`);
// //   send('system',  `   ${new Date().toLocaleString()}`);
// //   if (args && args.length) send('system', `   Args: ${args.join(' ')}`);
// //   send('divider', '─'.repeat(64));

// //   // -u = unbuffered stdout/stderr so print() flushes immediately
// //   const python = process.env.PYTHON || (
// //     process.platform === 'win32' ? 'python' : 'python3'
// //   );

// //   const cmdArgs = ['-u', scriptPath, ...(args || [])];

// //   const proc = spawn(python, cmdArgs, {
// //     cwd: path.dirname(scriptPath),
// //     env: { ...process.env, PYTHONUNBUFFERED: '1' }
// //   });

// //   procs[runId] = { proc, scriptPath };

// //   // If upfront stdin lines were provided, write them now and keep stdin open
// //   if (stdinLines && stdinLines.length) {
// //     stdinLines.forEach(line => proc.stdin.write(line + '\n'));
// //     // Don't close stdin — script may ask for more input interactively
// //   }

// //   // stdout — forward every chunk immediately (don't wait for \n)
// //   proc.stdout.on('data', chunk => {
// //     const text = chunk.toString();
// //     // Each physical line → individual log entry; preserve partial lines too
// //     const lines = text.split('\n');
// //     lines.forEach((line, i) => {
// //       // last element may be '' (after trailing \n) — skip
// //       if (i === lines.length - 1 && line === '') return;
// //       event.sender.send('script-log', { type: 'stdout', text: line, runId });
// //     });
// //     // Signal UI that script may be waiting for input (heuristic: ends without \n)
// //     const lastChunk = text;
// //     if (!lastChunk.endsWith('\n')) {
// //       event.sender.send('script-input-prompt', { runId, prompt: lastChunk.trim() });
// //     }
// //   });

// //   proc.stderr.on('data', chunk => {
// //     chunk.toString().split('\n').forEach(line => {
// //       if (line.trim()) event.sender.send('script-log', { type: 'stderr', text: line, runId });
// //     });
// //   });

// //   proc.on('close', code => {
// //     delete procs[runId];
// //     event.sender.send('script-log', { type: 'divider', text: '─'.repeat(64), runId });
// //     event.sender.send('script-log', {
// //       type: code === 0 ? 'success' : 'error',
// //       text: `${code === 0 ? '✓' : '✗'} Exited with code ${code}`, runId
// //     });
// //     event.sender.send('script-done', { code, runId });
// //   });

// //   proc.on('error', err => {
// //     event.sender.send('script-log',  { type: 'error', text: `✗ Spawn failed: ${err.message}`, runId });
// //     event.sender.send('script-done', { code: 1, runId });
// //   });

// //   return { success: true, runId };
// // });

// // ── Run script ────────────────────────────────────────────────────────────────
// ipcMain.handle('run-script', (event, { scriptPath, args, stdinLines }) => {
//   if (!scriptPath || !fs.existsSync(scriptPath)) {
//     event.sender.send('script-log',  { type: 'error', text: `Script not found: ${scriptPath}` });
//     event.sender.send('script-done', { code: 1, runId: -1 });
//     return { success: false, runId: -1 };
//   }

//   const runId = ++runIdCounter;

//   const send = (type, text) => event.sender.send('script-log', { type, text, runId });

//   send('system',  `▶  ${path.basename(scriptPath)}`);
//   send('system',  `   ${scriptPath}`);
//   send('system',  `   ${new Date().toLocaleString()}`);
//   if (args && args.length) send('system', `   Args: ${args.join(' ')}`);
//   send('divider', '─'.repeat(64));

//   // Better Python detection for Linux
//   let python;
//   if (process.env.PYTHON) {
//     python = process.env.PYTHON;
//   } else {
//     // Try multiple Python commands in order of preference
//     const pythonCommands = process.platform === 'win32' 
//       ? ['python', 'py'] 
//       : ['python3', 'python'];
    
//     // Find the first working Python command
//     for (const cmd of pythonCommands) {
//       try {
//         require('child_process').execSync(`${cmd} --version`, { stdio: 'ignore' });
//         python = cmd;
//         break;
//       } catch (e) {
//         continue;
//       }
//     }
//   }

//   if (!python) {
//     send('error', '✗ Python not found. Please install Python 3 and ensure it\'s in PATH.');
//     event.sender.send('script-done', { code: 1, runId });
//     return { success: false, runId: -1 };
//   }

//   send('system', `   Using Python: ${python}`);

//   const cmdArgs = ['-u', scriptPath, ...(args || [])];

//   try {
//     const proc = spawn(python, cmdArgs, {
//       cwd: path.dirname(scriptPath),
//       env: { 
//         ...process.env, 
//         PYTHONUNBUFFERED: '1',
//         // Force unbuffered output on Linux
//         PYTHONIOENCODING: 'utf-8'
//       },
//       // Important for Linux: use shell: false (default) but ensure stdio is properly set
//       stdio: ['pipe', 'pipe', 'pipe', 'ipc']
//     });

//     procs[runId] = { proc, scriptPath };

//     // Log process ID for debugging
//     send('system', `   PID: ${proc.pid}`);

//     // Handle stdin if provided
//     if (stdinLines && stdinLines.length) {
//       stdinLines.forEach(line => {
//         if (proc.stdin.writable) {
//           proc.stdin.write(line + '\n');
//         }
//       });
//     }

//     // Better stdout handling with immediate flushing
//     proc.stdout.on('data', chunk => {
//       const text = chunk.toString();
//       const lines = text.split(/\r?\n/);
      
//       lines.forEach((line, i) => {
//         if (i === lines.length - 1) {
//           if (line !== '') {
//             event.sender.send('script-log', { type: 'stdout', text: line, runId });
//           }
//           // Check if we need an input prompt (line doesn't end with newline and we have more data)
//           if (!text.endsWith('\n') && i === lines.length - 1) {
//             // Small delay to ensure we have all data
//             setTimeout(() => {
//               event.sender.send('script-input-prompt', { runId, prompt: line.trim() });
//             }, 10);
//           }
//         } else {
//           event.sender.send('script-log', { type: 'stdout', text: line, runId });
//         }
//       });
//     });

//     proc.stderr.on('data', chunk => {
//       chunk.toString().split(/\r?\n/).forEach(line => {
//         if (line.trim()) {
//           event.sender.send('script-log', { type: 'stderr', text: line, runId });
//         }
//       });
//     });

//     proc.on('close', (code, signal) => {
//       delete procs[runId];
//       send('divider', '─'.repeat(64));
//       if (signal) {
//         send('system', `⏹  Process terminated with signal ${signal}`);
//       } else {
//         send(code === 0 ? 'success' : 'error', 
//              `${code === 0 ? '✓' : '✗'} Exited with code ${code}`);
//       }
//       event.sender.send('script-done', { code, runId, signal });
//     });

//     proc.on('error', err => {
//       send('error', `✗ Spawn failed: ${err.message}`);
//       delete procs[runId];
//       event.sender.send('script-done', { code: 1, runId });
//     });

//     // Add disconnect handler
//     proc.on('disconnect', () => {
//       send('system', 'Process disconnected');
//     });

//     return { success: true, runId };

//   } catch (err) {
//     send('error', `✗ Failed to start process: ${err.message}`);
//     event.sender.send('script-done', { code: 1, runId });
//     return { success: false, runId: -1 };
//   }
// });

// // ── Send stdin line to running process ────────────────────────────────────────
// ipcMain.handle('send-stdin', (event, { runId, line }) => {
//   const entry = procs[runId];
//   if (!entry) return { success: false, error: 'Process not running' };
//   try {
//     entry.proc.stdin.write(line + '\n');
//     // Echo the input back as a log line
//     event.sender.send('script-log', { type: 'stdin', text: line, runId });
//     return { success: true };
//   } catch (err) {
//     return { success: false, error: err.message };
//   }
// });

// // ── Stop script ───────────────────────────────────────────────────────────────
// // ipcMain.handle('stop-script', (event, { runId }) => {
// //   const entry = procs[runId];
// //   if (!entry) return { success: false, error: 'No process for that runId' };

// //   const { proc } = entry;
// //   try {
// //     // Try graceful first, then force-kill
// //     proc.kill('SIGTERM');
// //     setTimeout(() => {
// //       try { proc.kill('SIGKILL'); } catch (_) {}
// //     }, 800);
// //   } catch (err) {
// //     return { success: false, error: err.message };
// //   }
// //   delete procs[runId];
// //   event.sender.send('script-log',  { type: 'system', text: '⏹  Stopped by user.', runId });
// //   event.sender.send('script-done', { code: -1, runId });
// //   return { success: true };
// // });

// ipcMain.handle('stop-script', (event, { runId }) => {
//   const entry = procs[runId];
//   if (!entry) return { success: false, error: 'No process for that runId' };

//   const { proc } = entry;
  
//   try {
//     // Check if process is still running
//     if (proc.exitCode !== null || proc.signalCode !== null) {
//       delete procs[runId];
//       return { success: true, message: 'Process already exited' };
//     }

//     // Try graceful shutdown first
//     const killResult = proc.kill('SIGTERM');
    
//     if (!killResult) {
//       // If SIGTERM fails, try SIGKILL
//       setTimeout(() => {
//         try {
//           if (proc.exitCode === null && proc.signalCode === null) {
//             proc.kill('SIGKILL');
//           }
//         } catch (e) {
//           console.error('Force kill failed:', e);
//         }
//       }, 1000);
//     }

//     event.sender.send('script-log', { 
//       type: 'system', 
//       text: '⏹  Stopping process...', 
//       runId 
//     });

//     // Don't delete immediately - let the close handler handle it
//     // But set a timeout to force cleanup
//     setTimeout(() => {
//       if (procs[runId]) {
//         delete procs[runId];
//         event.sender.send('script-log', { 
//           type: 'system', 
//           text: '⏹  Process force stopped.', 
//           runId 
//         });
//         event.sender.send('script-done', { code: -1, runId });
//       }
//     }, 5000);

//     return { success: true };
//   } catch (err) {
//     console.error('Stop script error:', err);
//     return { success: false, error: err.message };
//   }
// });

// // ── Save logs ─────────────────────────────────────────────────────────────────
// ipcMain.handle('save-logs', async (_, { scriptName, logs }) => {
//   const { filePath } = await dialog.showSaveDialog(mainWindow, {
//     title: 'Save Logs',
//     defaultPath: path.join(app.getPath('desktop'), `${scriptName}_${Date.now()}.txt`),
//     filters: [{ name: 'Text', extensions: ['txt', 'log'] }]
//   });
//   if (!filePath) return { success: false };
//   try { fs.writeFileSync(filePath, logs.join('\n'), 'utf-8'); return { success: true, filePath }; }
//   catch (err) { return { success: false, error: err.message }; }
// });

// // ── Helpers ───────────────────────────────────────────────────────────────────
// ipcMain.handle('open-folder-dialog', async () => {
//   const { filePaths } = await dialog.showOpenDialog(mainWindow, {
//     properties: ['openDirectory'], title: 'Select Scripts Folder'
//   });
//   return filePaths[0] || null;
// });

// ipcMain.handle('get-scripts-path', () => SCRIPTS_BASE);

// // Debug handler to check process status
// ipcMain.handle('check-process', (event, { runId }) => {
//   const entry = procs[runId];
//   if (!entry) return { running: false };
  
//   const { proc } = entry;
//   return {
//     running: proc.exitCode === null && proc.signalCode === null,
//     exitCode: proc.exitCode,
//     signalCode: proc.signalCode,
//     pid: proc.pid
//   };
// });

const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1500, height: 880, minWidth: 1000, minHeight: 620,
    webPreferences: {
      nodeIntegration: false, contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    backgroundColor: '#141520'
  });
  mainWindow.loadFile('index.html');
  // mainWindow.webContents.openDevTools();
  mainWindow.on('closed', () => { mainWindow = null; });
}

app.on('ready', createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (!mainWindow) createWindow(); });

// ── Scripts base - Use userData directory for writable scripts ─────────────────
const USER_SCRIPTS_BASE = path.join(app.getPath('userData'), 'scripts');
const APP_SCRIPTS_BASE = path.join(__dirname, 'scripts');

// Ensure user scripts directory exists
if (!fs.existsSync(USER_SCRIPTS_BASE)) {
  fs.mkdirSync(USER_SCRIPTS_BASE, { recursive: true });
}

// Copy scripts from app to user data on first run or if they don't exist
function copyScriptsToUserData() {
  try {
    if (fs.existsSync(APP_SCRIPTS_BASE)) {
      const scripts = fs.readdirSync(APP_SCRIPTS_BASE, { withFileTypes: true });
      
      scripts.forEach(entry => {
        if (entry.isDirectory()) {
          const srcDir = path.join(APP_SCRIPTS_BASE, entry.name);
          const destDir = path.join(USER_SCRIPTS_BASE, entry.name);
          
          // Only copy if destination doesn't exist
          if (!fs.existsSync(destDir)) {
            console.log(`Copying script ${entry.name} to user data...`);
            copyDirSync(srcDir, destDir);
          }
        }
      });
    }
  } catch (err) {
    console.error('Error copying scripts:', err);
  }
}

// Helper function to copy directories recursively
function copyDirSync(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
      // Make Python scripts executable on Unix
      if (process.platform !== 'win32' && entry.name.endsWith('.py')) {
        fs.chmodSync(destPath, '755');
      }
    }
  }
}

// Call this when app is ready
app.whenReady().then(() => {
  copyScriptsToUserData();
});

// ── Helper to get the actual script path (handles ASAR and user data) ────
function getActualScriptPath(scriptName) {
  // First check in user data directory
  const userScriptPath = findFileInDir(USER_SCRIPTS_BASE, scriptName, f => f.endsWith('.py'));
  if (userScriptPath) {
    return { path: userScriptPath, isTemp: false };
  }
  
  // If not in user data, check in app directory and copy it
  const appScriptPath = findFileInDir(APP_SCRIPTS_BASE, scriptName, f => f.endsWith('.py'));
  if (appScriptPath) {
    // Copy to user data
    const relativePath = path.relative(APP_SCRIPTS_BASE, appScriptPath);
    const destPath = path.join(USER_SCRIPTS_BASE, relativePath);
    
    // Ensure directory exists
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    
    // Copy the file
    fs.copyFileSync(appScriptPath, destPath);
    if (process.platform !== 'win32') {
      fs.chmodSync(destPath, '755');
    }
    
    return { path: destPath, isTemp: false };
  }
  
  return null;
}

// ── Recursive file finder ─────────────────────────────────────────────────────
function findFileInDir(baseDir, scriptName, testFn) {
  if (!fs.existsSync(baseDir)) return null;
  
  try {
    const entries = fs.readdirSync(baseDir, { withFileTypes: true });
    for (const e of entries) {
      if (!e.isDirectory() && testFn(e.name)) {
        if (!scriptName || e.name === scriptName) {
          return path.join(baseDir, e.name);
        }
      }
    }
    for (const e of entries) {
      if (e.isDirectory()) {
        const found = findFileInDir(path.join(baseDir, e.name), scriptName, testFn);
        if (found) return found;
      }
    }
  } catch (_) {}
  return null;
}

// ── Load scripts from user data directory ─────────────────────────────────────
ipcMain.handle('load-scripts', () => {
  try {
    if (!fs.existsSync(USER_SCRIPTS_BASE)) {
      return { success: false, error: `Folder missing: ${USER_SCRIPTS_BASE}`, scripts: [] };
    }

    const scripts = [];
    fs.readdirSync(USER_SCRIPTS_BASE, { withFileTypes: true }).forEach((entry, idx) => {
      if (!entry.isDirectory()) return;
      
      const folderPath = path.join(USER_SCRIPTS_BASE, entry.name);
      const scriptPath = findFileInDir(folderPath, null, f => f.endsWith('.py'));
      const readmePath = findFileInDir(folderPath, null, f => /^readme\.(md|txt)$/i.test(f));
      const configPath = path.join(folderPath, 'inputs.json');
      
      let inputConfig = [];
      if (fs.existsSync(configPath)) {
        try { inputConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8')); } catch (_) {}
      }
      
      let createdOn = '';
      try { createdOn = fs.statSync(folderPath).birthtime.toISOString().split('T')[0]; } catch (_) {}

      scripts.push({
        id: idx + 1, 
        name: entry.name, 
        folder: folderPath,
        scriptPath: scriptPath || null,
        scriptFile: scriptPath ? path.basename(scriptPath) : null,
        readmePath: readmePath || null,
        readmeFile: readmePath ? path.basename(readmePath) : null,
        createdOn, 
        hasScript: !!scriptPath, 
        hasReadme: !!readmePath, 
        inputConfig
      });
    });
    return { success: true, scripts };
  } catch (err) {
    return { success: false, error: err.message, scripts: [] };
  }
});

// ── Read README ───────────────────────────────────────────────────────────────
ipcMain.handle('read-readme', (_, readmePath) => {
  try {
    if (!readmePath || !fs.existsSync(readmePath))
      return { success: false, content: '# No README found\n\nNo documentation available.' };
    return { success: true, content: fs.readFileSync(readmePath, 'utf-8') };
  } catch (err) {
    return { success: false, content: `# Error\n\n${err.message}` };
  }
});

// ── Active processes ───────────────────────────────────────────────────
const procs = {};
let runIdCounter = 0;

// ── Run script ────────────────────────────────────────────────────────────────
ipcMain.handle('run-script', (event, { scriptPath, args, stdinLines }) => {
  const runId = ++runIdCounter;
  const send = (type, text) => event.sender.send('script-log', { type, text, runId });

  // Get the actual script path from user data
  let actualScriptPath = scriptPath;
  
  // If the path is from ASAR, we need to get it from user data
  if (scriptPath.includes('.asar')) {
    const scriptName = path.basename(scriptPath);
    const scriptFolder = path.basename(path.dirname(scriptPath));
    
    // Look for the script in user data
    const userScriptPath = path.join(USER_SCRIPTS_BASE, scriptFolder, scriptName);
    
    if (fs.existsSync(userScriptPath)) {
      actualScriptPath = userScriptPath;
      send('system', `   Using user data copy: ${actualScriptPath}`);
    } else {
      send('error', `   Script not found in user data directory`);
      event.sender.send('script-done', { code: 1, runId });
      return { success: false, runId: -1 };
    }
  }

  if (!fs.existsSync(actualScriptPath)) {
    send('error', `Script not found: ${actualScriptPath}`);
    event.sender.send('script-done', { code: 1, runId });
    return { success: false, runId: -1 };
  }

  send('system', `▶  ${path.basename(actualScriptPath)}`);
  send('system', `   ${actualScriptPath}`);
  send('system', `   ${new Date().toLocaleString()}`);
  if (args && args.length) send('system', `   Args: ${args.join(' ')}`);
  send('divider', '─'.repeat(64));

  // Python detection
  let python;
  if (process.env.PYTHON) {
    python = process.env.PYTHON;
  } else {
    const pythonCommands = process.platform === 'win32' 
      ? ['python', 'py'] 
      : ['python3', 'python'];
    
    for (const cmd of pythonCommands) {
      try {
        require('child_process').execSync(`${cmd} --version`, { stdio: 'ignore' });
        python = cmd;
        break;
      } catch (e) {
        continue;
      }
    }
  }

  if (!python) {
    send('error', '✗ Python not found. Please install Python 3 and ensure it\'s in PATH.');
    event.sender.send('script-done', { code: 1, runId });
    return { success: false, runId: -1 };
  }

  send('system', `   Using Python: ${python}`);

  const cmdArgs = ['-u', actualScriptPath, ...(args || [])];

  try {
    const proc = spawn(python, cmdArgs, {
      cwd: path.dirname(actualScriptPath),
      env: { 
        ...process.env, 
        PYTHONUNBUFFERED: '1',
        PYTHONIOENCODING: 'utf-8'
      },
      stdio: ['pipe', 'pipe', 'pipe', 'ipc']
    });

    procs[runId] = { proc, scriptPath: actualScriptPath };

    send('system', `   PID: ${proc.pid}`);

    // Handle stdin if provided
    if (stdinLines && stdinLines.length) {
      stdinLines.forEach(line => {
        if (proc.stdin.writable) {
          proc.stdin.write(line + '\n');
        }
      });
    }

    // stdout handling
    proc.stdout.on('data', chunk => {
      const text = chunk.toString();
      const lines = text.split(/\r?\n/);
      
      lines.forEach((line, i) => {
        if (line || i < lines.length - 1) {
          if (i === lines.length - 1 && line === '' && text.endsWith('\n')) return;
          event.sender.send('script-log', { type: 'stdout', text: line, runId });
        }
      });
      
      if (!text.endsWith('\n')) {
        setTimeout(() => {
          event.sender.send('script-input-prompt', { runId, prompt: lines[lines.length - 1] });
        }, 10);
      }
    });

    // stderr handling
    proc.stderr.on('data', chunk => {
      chunk.toString().split(/\r?\n/).forEach(line => {
        if (line.trim()) {
          event.sender.send('script-log', { type: 'stderr', text: line, runId });
        }
      });
    });

    proc.on('close', (code, signal) => {
      delete procs[runId];
      send('divider', '─'.repeat(64));
      if (signal) {
        send('system', `⏹  Process terminated with signal ${signal}`);
      } else {
        send(code === 0 ? 'success' : 'error', 
             `${code === 0 ? '✓' : '✗'} Exited with code ${code}`);
      }
      event.sender.send('script-done', { code, runId, signal });
    });

    proc.on('error', err => {
      send('error', `✗ Spawn failed: ${err.message}`);
      delete procs[runId];
      event.sender.send('script-done', { code: 1, runId });
    });

    return { success: true, runId };

  } catch (err) {
    send('error', `✗ Failed to start process: ${err.message}`);
    event.sender.send('script-done', { code: 1, runId });
    return { success: false, runId: -1 };
  }
});

// ── Send stdin line to running process ────────────────────────────────────────
ipcMain.handle('send-stdin', (event, { runId, line }) => {
  const entry = procs[runId];
  if (!entry) return { success: false, error: 'Process not running' };
  try {
    entry.proc.stdin.write(line + '\n');
    event.sender.send('script-log', { type: 'stdin', text: line, runId });
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// ── Stop script ───────────────────────────────────────────────────────────────
ipcMain.handle('stop-script', (event, { runId }) => {
  const entry = procs[runId];
  if (!entry) return { success: false, error: 'No process for that runId' };

  const { proc } = entry;
  
  try {
    if (proc.exitCode !== null || proc.signalCode !== null) {
      delete procs[runId];
      return { success: true, message: 'Process already exited' };
    }

    const killResult = proc.kill('SIGTERM');
    
    if (!killResult) {
      setTimeout(() => {
        try {
          if (proc.exitCode === null && proc.signalCode === null) {
            proc.kill('SIGKILL');
          }
        } catch (e) {
          console.error('Force kill failed:', e);
        }
      }, 1000);
    }

    event.sender.send('script-log', { type: 'system', text: '⏹  Stopping process...', runId });

    setTimeout(() => {
      if (procs[runId]) {
        delete procs[runId];
        event.sender.send('script-log', { type: 'system', text: '⏹  Process force stopped.', runId });
        event.sender.send('script-done', { code: -1, runId });
      }
    }, 5000);

    return { success: true };
  } catch (err) {
    console.error('Stop script error:', err);
    return { success: false, error: err.message };
  }
});

// ── Save logs ─────────────────────────────────────────────────────────────────
ipcMain.handle('save-logs', async (_, { scriptName, logs }) => {
  const { filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Save Logs',
    defaultPath: path.join(app.getPath('desktop'), `${scriptName}_${Date.now()}.txt`),
    filters: [{ name: 'Text', extensions: ['txt', 'log'] }]
  });
  if (!filePath) return { success: false };
  try { 
    fs.writeFileSync(filePath, logs.join('\n'), 'utf-8'); 
    return { success: true, filePath }; 
  } catch (err) { 
    return { success: false, error: err.message }; 
  }
});

// ── Dialogs ───────────────────────────────────────────────────────────────────
ipcMain.handle('open-folder-dialog', async () => {
  const { filePaths } = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'], title: 'Select Scripts Folder'
  });
  return filePaths[0] || null;
});

ipcMain.handle('get-scripts-path', () => USER_SCRIPTS_BASE); 