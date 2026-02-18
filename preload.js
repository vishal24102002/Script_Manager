// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Script loading
  loadScripts: () => ipcRenderer.invoke('load-scripts'),
  getScriptsPath: () => ipcRenderer.invoke('get-scripts-path'),
  
  // README handling
  readReadme: (readmePath) => ipcRenderer.invoke('read-readme', readmePath),
  
  // Script execution
  runScript: (options) => ipcRenderer.invoke('run-script', options),
  sendStdin: (options) => ipcRenderer.invoke('send-stdin', options),
  stopScript: (options) => ipcRenderer.invoke('stop-script', options),
  
  // Logs
  saveLogs: (options) => ipcRenderer.invoke('save-logs', options),
  
  // Dialogs - include BOTH names to support different HTML implementations
  openFolderDialog: () => ipcRenderer.invoke('open-folder-dialog'),
  openFolder: () => ipcRenderer.invoke('open-folder-dialog'), // Alias for backward compatibility

  // 📊 METADATA - Get script stats
  getScriptStats: (folderPath) => ipcRenderer.invoke('get-script-stats', folderPath),
  
  // ➕ CREATE - Add new script
  createScript: (options) => ipcRenderer.invoke('create-script', options),
  
  // 🗑️ DELETE - Remove script
  deleteScript: (scriptId, folderPath) => 
    ipcRenderer.invoke('delete-script', { scriptId, folderPath }),
  
  // ✏️ RENAME - Edit script name
  renameScript: (oldPath, newName) => 
    ipcRenderer.invoke('rename-script', { oldPath, newName }),
  
  // 📂 OPEN FOLDER - Open in file explorer
  openFolder: (folderPath) => ipcRenderer.invoke('open-folder', folderPath),
  
  
  // Event listeners
  onScriptLog: (callback) => {
    const subscription = (_event, data) => callback(data);
    ipcRenderer.on('script-log', subscription);
    return () => {
      ipcRenderer.removeListener('script-log', subscription);
    };
  },
  
  onScriptDone: (callback) => {
    const subscription = (_event, data) => callback(data);
    ipcRenderer.on('script-done', subscription);
    return () => {
      ipcRenderer.removeListener('script-done', subscription);
    };
  },
  
  onScriptInputPrompt: (callback) => {
    const subscription = (_event, data) => callback(data);
    ipcRenderer.on('script-input-prompt', subscription);
    return () => {
      ipcRenderer.removeListener('script-input-prompt', subscription);
    };
  },
  
  // Debug
  checkProcess: (runId) => ipcRenderer.invoke('check-process', runId),
  
  // Cleanup
  removeAllListeners: () => {
    ipcRenderer.removeAllListeners('script-log');
    ipcRenderer.removeAllListeners('script-done');
    ipcRenderer.removeAllListeners('script-input-prompt');
  }
});