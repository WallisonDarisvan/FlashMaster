const { contextBridge, ipcRenderer } = require('electron');

// ============================================================================
// CONTEXT BRIDGE SEGURO
// Expõe métodos estritamente controlados na janela global: window.electronAPI
// ============================================================================
contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,

  // Diálogos de Seleção
  openVideoDialog: () => ipcRenderer.invoke('dialog:open-video'),
  selectOutputDialog: (defaultName) => ipcRenderer.invoke('dialog:select-output', defaultName),
  openFolder: (folderPath) => ipcRenderer.invoke('shell:open-folder', folderPath),

  // Operações de FFmpeg
  probeVideo: (filePath) => ipcRenderer.invoke('ffmpeg:probe', filePath),
  getChannelWaveform: (options) => ipcRenderer.invoke('ffmpeg:get-channel-waveform', options),
  convertVideo: (options) => ipcRenderer.invoke('ffmpeg:convert', options),
  cancelConversion: () => ipcRenderer.invoke('ffmpeg:cancel'),

  // Listeners de Eventos (Event Streaming)
  onProgress: (callback) => {
    const subscription = (_event, value) => callback(value);
    ipcRenderer.on('ffmpeg:progress', subscription);
    return () => ipcRenderer.removeListener('ffmpeg:progress', subscription);
  },

  onLog: (callback) => {
    const subscription = (_event, value) => callback(value);
    ipcRenderer.on('ffmpeg:log', subscription);
    return () => ipcRenderer.removeListener('ffmpeg:log', subscription);
  },

  onToggleLogs: (callback) => {
    const subscription = () => callback();
    ipcRenderer.on('menu:toggle-logs', subscription);
    return () => ipcRenderer.removeListener('menu:toggle-logs', subscription);
  },

  onOpenAudioSettings: (callback) => {
    const subscription = () => callback();
    ipcRenderer.on('menu:open-audio-settings', subscription);
    return () => ipcRenderer.removeListener('menu:open-audio-settings', subscription);
  }
});
