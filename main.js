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

// Get script folder contents and stats
ipcMain.handle('get-script-stats', async (_, folderPath) => {
  try {
    const files = fs.readdirSync(folderPath);
    let totalSize = 0;
    const fileDetails = [];

    files.forEach(file => {
      const filePath = path.join(folderPath, file);
      const stats = fs.statSync(filePath);
      totalSize += stats.size;
      
      // Format file size
      const size = stats.size < 1024 ? `${stats.size} B` :
                  stats.size < 1024 * 1024 ? `${(stats.size / 1024).toFixed(1)} KB` :
                  `${(stats.size / (1024 * 1024)).toFixed(1)} MB`;

      fileDetails.push({
        name: file,
        size: size,
        isDirectory: stats.isDirectory(),
        modified: stats.mtime
      });
    });

    return {
      success: true,
      files: fileDetails,
      totalSize: totalSize < 1024 ? `${totalSize} B` :
                 totalSize < 1024 * 1024 ? `${(totalSize / 1024).toFixed(1)} KB` :
                 `${(totalSize / (1024 * 1024)).toFixed(1)} MB`,
      modified: new Date().toLocaleDateString()
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Create new script
ipcMain.handle('create-script', async (_, { name, description, template }) => {
  try {
    const scriptFolder = path.join(USER_SCRIPTS_BASE, name);
    
    // Create folder
    fs.mkdirSync(scriptFolder, { recursive: true });

    // Create script based on template
    const scriptContent = getScriptTemplate(template, name, description);
    fs.writeFileSync(path.join(scriptFolder, 'script.py'), scriptContent);

    // Create README
    const readmeContent = `# ${name}\n\n${description || 'No description provided.'}\n`;
    fs.writeFileSync(path.join(scriptFolder, 'readme.md'), readmeContent);

    // Create inputs.json for input template
    if (template === 'input') {
      const inputsConfig = [
        {
          "name": "input_text",
          "type": "text",
          "label": "Input Text",
          "description": "Enter your input",
          "required": true,
          "passAs": "stdin"
        }
      ];
      fs.writeFileSync(path.join(scriptFolder, 'inputs.json'), JSON.stringify(inputsConfig, null, 2));
    }

    return { success: true, folder: scriptFolder };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Delete script
ipcMain.handle('delete-script', async (_, { scriptId, folderPath }) => {
  try {
    fs.rmSync(folderPath, { recursive: true, force: true });
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Rename script
ipcMain.handle('rename-script', async (_, { oldPath, newName }) => {
  try {
    const newPath = path.join(path.dirname(oldPath), newName);
    fs.renameSync(oldPath, newPath);
    return { success: true, newPath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Open folder in file explorer
ipcMain.handle('open-folder', (_, folderPath) => {
  const { shell } = require('electron');
  shell.openPath(folderPath);
  return { success: true };
});

// Helper function for script templates
function getScriptTemplate(template, name, description) {
  const templates = {
    basic: `#!/usr/bin/env python3
"""
${name}
${description ? '\\n' + description : ''}
"""

def main():
    print("Hello from ${name}!")
    
if __name__ == "__main__":
    main()
`,
    cli: `#!/usr/bin/env python3
"""
${name}
${description ? '\\n' + description : ''}
"""

import argparse

def main():
    parser = argparse.ArgumentParser(description='${description || name}')
    parser.add_argument('--input', '-i', help='Input file path')
    parser.add_argument('--verbose', '-v', action='store_true', help='Verbose output')
    
    args = parser.parse_args()
    
    if args.verbose:
        print("Verbose mode enabled")
    
    print("Hello from ${name}!")
    print(f"Input: {args.input}")

if __name__ == "__main__":
    main()
`,
    input: `#!/usr/bin/env python3
"""
${name}
${description ? '\\n' + description : ''}
"""

import sys

def main():
    print("${name} started")
    
    # Read input from stdin (from inputs.json)
    for line in sys.stdin:
        line = line.strip()
        if line:
            print(f"Received: {line}")
    
    print("Done!")

if __name__ == "__main__":
    main()
`,
    empty: `# Empty script - add your code here
`
  };

  return templates[template] || templates.basic;
}