// const { contextBridge, ipcRenderer } = require('electron');

// // Expose protected methods that allow the renderer process to use
// // the ipcRenderer without exposing the entire object
// contextBridge.exposeInMainWorld('api', {
//   // Script loading
//   loadScripts: () => ipcRenderer.invoke('load-scripts'),
//   getScriptsPath: () => ipcRenderer.invoke('get-scripts-path'),
  
//   // README handling
//   readReadme: (readmePath) => ipcRenderer.invoke('read-readme', readmePath),
  
//   // Script execution
//   runScript: (options) => ipcRenderer.invoke('run-script', options),
//   sendStdin: (options) => ipcRenderer.invoke('send-stdin', options),
//   stopScript: (options) => ipcRenderer.invoke('stop-script', options),
  
//   // Logs
//   saveLogs: (options) => ipcRenderer.invoke('save-logs', options),
  
//   // Dialogs
//   openFolderDialog: () => ipcRenderer.invoke('open-folder-dialog'),
  
//   // Event listeners for script output
//   onScriptLog: (callback) => {
//     const subscription = (_event, data) => callback(data);
//     ipcRenderer.on('script-log', subscription);
//     return () => {
//       ipcRenderer.removeListener('script-log', subscription);
//     };
//   },
  
//   onScriptDone: (callback) => {
//     const subscription = (_event, data) => callback(data);
//     ipcRenderer.on('script-done', subscription);
//     return () => {
//       ipcRenderer.removeListener('script-done', subscription);
//     };
//   },
  
//   onScriptInputPrompt: (callback) => {
//     const subscription = (_event, data) => callback(data);
//     ipcRenderer.on('script-input-prompt', subscription);
//     return () => {
//       ipcRenderer.removeListener('script-input-prompt', subscription);
//     };
//   },
  
//   // Debug
//   checkProcess: (runId) => ipcRenderer.invoke('check-process', runId),
  
//   // Cleanup function to remove all listeners
//   removeAllListeners: () => {
//     ipcRenderer.removeAllListeners('script-log');
//     ipcRenderer.removeAllListeners('script-done');
//     ipcRenderer.removeAllListeners('script-input-prompt');
//   }
// });

// // Also expose Node.js version info if needed
// contextBridge.exposeInMainWorld('electron', {
//   platform: process.platform,
//   versions: process.versions
// });

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