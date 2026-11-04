const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require('electron');
const http = require('http');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { spawn, spawnSync } = require('child_process');
const { autoUpdater } = require('electron-updater');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');
const ffprobeStatic = require('ffprobe-static');

// ============================================================================
// 1. CONFIGURAÇÃO E RESOLUÇÃO DOS BINÁRIOS DO FFMPEG / FFPROBE
// ============================================================================
function getBinaryPath(binaryPath) {
  if (!binaryPath) return null;
  return binaryPath.replace('app.asar', 'app.asar.unpacked');
}

const resolvedFfmpegPath = getBinaryPath(ffmpegStatic);
const resolvedFfprobePath = getBinaryPath(ffprobeStatic.path);

if (resolvedFfmpegPath && fs.existsSync(resolvedFfmpegPath)) {
  ffmpeg.setFfmpegPath(resolvedFfmpegPath);
  console.log('[FFmpeg] Binário carregado com sucesso:', resolvedFfmpegPath);
} else {
  console.warn('[FFmpeg] Binário estático não encontrado, tentando comando global...');
}

if (resolvedFfprobePath && fs.existsSync(resolvedFfprobePath)) {
  ffmpeg.setFfprobePath(resolvedFfprobePath);
  console.log('[FFprobe] Binário carregado com sucesso:', resolvedFfprobePath);
} else {
  console.warn('[FFprobe] Binário ffprobe não encontrado, tentando comando global...');
}

app.name = 'Flash Master v1.0.3';
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');

// Previne instâncias simultâneas disputando a pasta de cache do Windows
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  console.log('[Electron] Outra instância já está em execução. Encerrando esta.');
  app.quit();
  process.exit(0);
}

let mainWindow = null;
let currentCommand = null;

function setupApplicationMenu() {
  const isMac = process.platform === 'darwin';

  const template = [
    ...(isMac ? [{ role: 'appMenu' }] : []),
    {
      label: 'File',
      submenu: [
        isMac ? { role: 'close' } : { role: 'quit', label: 'Sair' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo', label: 'Desfazer' },
        { role: 'redo', label: 'Refazer' },
        { type: 'separator' },
        { role: 'cut', label: 'Recortar' },
        { role: 'copy', label: 'Copiar' },
        { role: 'paste', label: 'Colar' },
        { role: 'selectAll', label: 'Selecionar Tudo' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload', label: 'Recarregar' },
        { role: 'forceReload', label: 'Forçar Recarregamento' },
        { role: 'toggleDevTools', label: 'Ferramentas do Desenvolvedor' },
        { type: 'separator' },
        { role: 'resetZoom', label: 'Zoom 100%' },
        { role: 'zoomIn', label: 'Aumentar Zoom' },
        { role: 'zoomOut', label: 'Diminuir Zoom' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Tela Cheia' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize', label: 'Minimizar' },
        { role: 'zoom', label: 'Maximizar / Restaurar' },
        { type: 'separator' },
        {
          label: 'Configurações de Áudio...',
          accelerator: 'CmdOrCtrl+,',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('menu:open-audio-settings');
            }
          }
        },
        {
          label: 'Ver Logs',
          accelerator: 'CmdOrCtrl+L',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('menu:toggle-logs');
            }
          }
        },
        ...(isMac ? [
          { type: 'separator' },
          { role: 'front' },
          { type: 'separator' },
          { role: 'window' }
        ] : [
          { role: 'close', label: 'Fechar Janela' }
        ])
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Verificar Atualizações...',
          click: () => {
            if (!app.isPackaged) {
              if (mainWindow) {
                dialog.showMessageBox(mainWindow, {
                  type: 'info',
                  title: 'Verificar Atualizações',
                  message: 'Modo de Desenvolvimento',
                  detail: 'A checagem e instalação automática de atualizações via GitHub é ativada no aplicativo instalado (.exe).'
                });
              }
              return;
            }
            autoUpdater.checkForUpdates().then((result) => {
              const currentVer = app.getVersion();
              const latestVer = result?.updateInfo?.version;
              if (!result || !latestVer || latestVer === currentVer) {
                if (mainWindow) {
                  dialog.showMessageBox(mainWindow, {
                    type: 'info',
                    title: 'Flash Master',
                    message: 'Você já está usando a versão mais recente!',
                    detail: `Versão atual instalada: ${currentVer}`
                  });
                }
              }
            }).catch((err) => {
              if (mainWindow) {
                dialog.showMessageBox(mainWindow, {
                  type: 'warning',
                  title: 'Aviso de Atualização',
                  message: 'Não foi possível verificar atualizações no momento.',
                  detail: err.message
                });
              }
            });
          }
        },
        { type: 'separator' },
        {
          label: 'Sobre Flash Master',
          click: () => {
            if (mainWindow) {
              dialog.showMessageBox(mainWindow, {
                type: 'info',
                title: 'Flash Master',
                message: 'Flash Master',
                detail: 'Transcodificador Broadcast MXF OP-1a (XDCAM HD422) com nivelamento de áudio (+7dB linear / -12dBFS limiter).'
              });
            }
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1300,
    height: 900,
    minWidth: 1024,
    minHeight: 720,
    backgroundColor: '#0F1112',
    title: 'Flash Master v1.0.3',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: false // Permite carregar vídeos locais diretamente no player preview
    },
    show: false
  });

  setupApplicationMenu();

  const indexPath = path.join(__dirname, '../dist/index.html');

  if (app.isPackaged) {
    mainWindow.loadFile(indexPath);
  } else {
    const http = require('http');
    const req = http.get('http://localhost:3000', (res) => {
      mainWindow.loadURL('http://localhost:3000');
    });

    req.on('error', () => {
      if (fs.existsSync(indexPath)) {
        mainWindow.loadFile(indexPath);
      } else {
        mainWindow.loadURL('http://localhost:3000');
      }
    });
  }

  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`[Renderer]: ${message}`);
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.maximize();
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ============================================================================
// 2. SISTEMA DE ATUALIZAÇÕES AUTOMÁTICAS (GITHUB RELEASES VIA ELECTRON-UPDATER)
// ============================================================================
function setupAutoUpdater() {
  if (!app.isPackaged) {
    console.log('[AutoUpdater] Modo de desenvolvimento: ignorando verificação de atualizações.');
    return;
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => {
    console.log('[AutoUpdater] Consultando novas versões no GitHub...');
  });

  autoUpdater.on('update-available', (info) => {
    console.log('[AutoUpdater] Nova versão encontrada:', info.version);
    if (mainWindow) {
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Atualização Encontrada',
        message: `Nova versão (${info.version}) do Flash Master disponível!`,
        detail: 'O download da atualização foi iniciado automaticamente em segundo plano.'
      });
    }
  });

  autoUpdater.on('update-not-available', () => {
    console.log('[AutoUpdater] Aplicativo já está na versão mais recente.');
  });

  autoUpdater.on('error', (err) => {
    console.warn('[AutoUpdater] Erro na verificação:', err.message);
  });

  autoUpdater.on('update-downloaded', (info) => {
    console.log('[AutoUpdater] Nova versão baixada:', info.version);
    if (mainWindow) {
      dialog.showMessageBox(mainWindow, {
        type: 'question',
        buttons: ['Reiniciar e Atualizar Agora', 'Depois'],
        defaultId: 0,
        cancelId: 1,
        title: 'Atualização Pronta',
        message: `A versão ${info.version} do Flash Master foi baixada com sucesso!`,
        detail: 'Deseja reiniciar o aplicativo agora para aplicar as melhorias?'
      }).then((returnValue) => {
        if (returnValue.response === 0) {
          autoUpdater.quitAndInstall();
        }
      });
    }
  });

  // Verifica atualizações 5 segundos após abrir a janela
  setTimeout(() => {
    autoUpdater.checkForUpdatesAndNotify().catch((err) => {
      console.warn('[AutoUpdater] Falha na consulta automática:', err.message);
    });
  }, 5000);
}

// ============================================================================
// 3. CICLO DE VIDA DO APLICATIVO
// ============================================================================
app.whenReady().then(() => {
  createWindow();
  setupAutoUpdater();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  if (typeof activePreviewProcesses !== 'undefined') {
    for (const [_, proc] of activePreviewProcesses) {
      try { proc.kill('SIGKILL'); } catch (e) {}
    }
    activePreviewProcesses.clear();
  }
});

// ============================================================================
// 3. COMUNICAÇÃO IPC: DIÁLOGOS DE ARQUIVO
// ============================================================================
ipcMain.handle('dialog:open-video', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Selecionar Arquivos de Vídeo Broadcast',
    properties: ['openFile', 'multiSelections'],
    filters: [
      {
        name: 'Arquivos de Vídeo',
        extensions: ['mp4', 'mov', 'mkv', 'avi', 'mxf', 'webm', 'ts', 'm2ts', 'wmv', 'flv', 'm4v']
      },
      { name: 'Todos os Arquivos', extensions: ['*'] }
    ]
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  const files = result.filePaths.map(fp => ({
    filePath: fp,
    fileName: path.basename(fp)
  }));

  return {
    filePath: result.filePaths[0],
    fileName: path.basename(result.filePaths[0]),
    files: files
  };
});

ipcMain.handle('dialog:select-output', async (event, defaultName) => {
  const defaultPath = defaultName 
    ? defaultName.replace(/\.[^/.]+$/, '') + '_broadcast_master.mxf'
    : 'output_broadcast_master.mxf';
  
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Salvar Arquivo Broadcast MXF',
    defaultPath: defaultPath,
    filters: [
      { name: 'Broadcast MXF (*.mxf)', extensions: ['mxf'] }
    ]
  });

  if (result.canceled || !result.filePath) {
    return null;
  }

  return result.filePath;
});

ipcMain.handle('dialog:select-output-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Selecionar Pasta de Destino para os Arquivos MXF (Lote)',
    properties: ['openDirectory', 'createDirectory']
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  return result.filePaths[0];
});

ipcMain.handle('shell:open-folder', async (event, folderPath) => {
  if (fs.existsSync(folderPath)) {
    shell.showItemInFolder(folderPath);
    return true;
  }
  return false;
});

// Extração real de picos da forma de onda de áudio de alta velocidade
ipcMain.handle('ffmpeg:get-channel-waveform', async (event, { filePath, streamIndex = 0, channelIndex = 0, numBars = 100 }) => {
  return new Promise((resolve) => {
    if (!filePath || !fs.existsSync(filePath)) {
      return resolve([]);
    }

    try {
      const ffmpegBin = resolvedFfmpegPath || 'ffmpeg';
      const args = [
        '-y',
        '-i', filePath,
        '-vn',
        '-filter_complex', `[0:a:${streamIndex}]pan=1c|c0=c${channelIndex},aresample=1000`,
        '-ac', '1',
        '-f', 's16le',
        'pipe:1'
      ];

      const child = spawn(ffmpegBin, args, { windowsHide: true });
      const chunks = [];

      child.stdout.on('data', (chunk) => {
        chunks.push(chunk);
      });

      child.stderr.on('data', () => {
        // Silencia stderr para performance
      });

      child.on('error', (err) => {
        console.warn('[Waveform] Erro ao extrair picos reais:', err.message);
        resolve([]);
      });

      child.on('close', (code) => {
        if (code !== 0 || chunks.length === 0) {
          return resolve([]);
        }

        const buffer = Buffer.concat(chunks);
        const totalSamples = Math.floor(buffer.length / 2);
        if (totalSamples === 0) return resolve([]);

        const bars = Math.max(10, Math.min(250, numBars));
        const samplesPerBar = Math.max(1, Math.floor(totalSamples / bars));
        const rawPeaks = [];
        let maxGlobal = 0;

        for (let i = 0; i < bars; i++) {
          let maxVal = 0;
          const start = i * samplesPerBar;
          const end = Math.min(totalSamples, start + samplesPerBar);
          for (let s = start; s < end; s++) {
            const val = Math.abs(buffer.readInt16LE(s * 2));
            if (val > maxVal) maxVal = val;
          }
          if (maxVal > maxGlobal) maxGlobal = maxVal;
          rawPeaks.push(maxVal);
        }

        // Normalização proporcional (0.0 a 1.0)
        const divisor = maxGlobal > 0 ? maxGlobal : 32768;
        const normalized = rawPeaks.map((p) => Number((p / divisor).toFixed(3)));

        resolve(normalized);
      });
    } catch (err) {
      console.warn('[Waveform] Exceção ao extrair forma de onda:', err);
      resolve([]);
    }
  });
});

// ============================================================================
// CACHE E PROCESSAMENTO DE PREVIEW PROXY (MXF, MPEG-2, DNxHD -> H.264 MP4)
// ============================================================================
const previewCacheDir = path.join(app.getPath('temp'), 'flashmaster_previews');
try {
  if (!fs.existsSync(previewCacheDir)) {
    fs.mkdirSync(previewCacheDir, { recursive: true });
  }
} catch (e) {
  console.warn('[Preview Proxy] Falha ao criar pasta de cache:', e);
}

function getPreviewPathForFile(filePath) {
  try {
    const stats = fs.statSync(filePath);
    const hash = crypto.createHash('md5').update(`v2_${filePath}_${stats.size}_${stats.mtimeMs}`).digest('hex');
    return path.join(previewCacheDir, `preview_${hash}.mp4`);
  } catch (err) {
    const hash = crypto.createHash('md5').update(`v2_${filePath}`).digest('hex');
    return path.join(previewCacheDir, `preview_${hash}.mp4`);
  }
}

let cachedH264Encoder = null;

function getBestH264Encoder() {
  if (cachedH264Encoder) {
    return cachedH264Encoder;
  }

  const ffmpegBin = resolvedFfmpegPath || 'ffmpeg';
  const candidates = ['h264_nvenc', 'h264_qsv', 'h264_amf'];

  for (const enc of candidates) {
    try {
      const probe = spawnSync(ffmpegBin, [
        '-f', 'lavfi',
        '-i', 'testsrc=size=320x240:rate=1',
        '-vframes', '1',
        '-c:v', enc,
        '-f', 'null',
        '-'
      ], { windowsHide: true, timeout: 3000 });

      if (probe.status === 0) {
        console.log(`[FFmpeg] Codificador de hardware acelerado detectado: ${enc}`);
        cachedH264Encoder = enc;
        return enc;
      }
    } catch (e) {
      // Ignora e testa o próximo
    }
  }

  console.log('[FFmpeg] Nenhum codificador GPU detectado, utilizando CPU (libx264)');
  cachedH264Encoder = 'libx264';
  return 'libx264';
}

setTimeout(() => {
  try { getBestH264Encoder(); } catch (e) {}
}, 200);

function getEncoderVideoArgs(encoder) {
  if (encoder === 'h264_nvenc') {
    return [
      '-c:v', 'h264_nvenc',
      '-preset', 'p1',
      '-tune', 'ull',
      '-rc', 'vbr',
      '-cq', '28',
      '-pix_fmt', 'yuv420p'
    ];
  }
  if (encoder === 'h264_qsv') {
    return [
      '-c:v', 'h264_qsv',
      '-preset', 'veryfast',
      '-global_quality', '28',
      '-pix_fmt', 'yuv420p'
    ];
  }
  if (encoder === 'h264_amf') {
    return [
      '-c:v', 'h264_amf',
      '-quality', 'speed',
      '-rc', 'cqp',
      '-qp_i', '28',
      '-qp_p', '28',
      '-pix_fmt', 'yuv420p'
    ];
  }
  return [
    '-c:v', 'libx264',
    '-preset', 'ultrafast',
    '-tune', 'fastdecode',
    '-crf', '28',
    '-pix_fmt', 'yuv420p'
  ];
}

function safeAtomicReplace(source, target) {
  try {
    if (fs.existsSync(target)) {
      try { fs.unlinkSync(target); } catch (e) {}
    }
    fs.renameSync(source, target);
    return true;
  } catch (err) {
    try {
      fs.copyFileSync(source, target);
      try { fs.unlinkSync(source); } catch (e) {}
      return true;
    } catch (e2) {
      console.warn('[Preview Proxy] Erro no atomic replace:', e2);
      return false;
    }
  }
}

// ============================================================================
// SERVIDOR LOCAL DE BUFFER CONTÍNUO (STREAMING HTTP FRAGMENTED MP4)
// Transmite o vídeo em pedaços contínuos (Fragmented MP4) em tempo real
// ============================================================================
let streamServerPort = 0;
const activeStreamProcesses = new Map();

const streamServer = http.createServer((req, res) => {
  try {
    const parsedUrl = new URL(req.url, `http://127.0.0.1:${streamServerPort}`);
    const targetFilePath = parsedUrl.searchParams.get('file');
    const isMono = parsedUrl.searchParams.get('mono') === '1';

    if (!targetFilePath || !fs.existsSync(targetFilePath)) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('Arquivo não encontrado');
    }

    const cachedPreviewPath = getPreviewPathForFile(targetFilePath);

    // 1. Se o arquivo completo já existe no cache, serve diretamente com Byte-Range (Seek / Frame a Frame)
    if (fs.existsSync(cachedPreviewPath) && fs.statSync(cachedPreviewPath).size > 1024) {
      const stat = fs.statSync(cachedPreviewPath);
      const fileSize = stat.size;
      const range = req.headers.range;

      if (range) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunksize = (end - start) + 1;
        const fileStream = fs.createReadStream(cachedPreviewPath, { start, end });
        res.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunksize,
          'Content-Type': 'video/mp4'
        });
        return fileStream.pipe(res);
      } else {
        res.writeHead(200, {
          'Content-Length': fileSize,
          'Content-Type': 'video/mp4',
          'Accept-Ranges': 'bytes'
        });
        return fs.createReadStream(cachedPreviewPath).pipe(res);
      }
    }

    // 2. Se ainda não foi gerado, inicia STREAMING CONTÍNUO AO VIVO (Fragmented MP4)
    if (activeStreamProcesses.has(targetFilePath)) {
      try { activeStreamProcesses.get(targetFilePath).kill('SIGKILL'); } catch (e) {}
      activeStreamProcesses.delete(targetFilePath);
    }

    res.writeHead(200, {
      'Content-Type': 'video/mp4',
      'Connection': 'keep-alive',
      'Transfer-Encoding': 'chunked'
    });

    const ffmpegBin = resolvedFfmpegPath || 'ffmpeg';
    const encoder = getBestH264Encoder();
    const hwaccel = encoder !== 'libx264' ? ['-hwaccel', 'auto'] : [];
    const vArgs = getEncoderVideoArgs(encoder);

    const filterComplex = isMono
      ? '[0:v:0]scale=-2:480,format=yuv420p[vout];[0:a:0][0:a:1]amerge=inputs=2[aout]'
      : '[0:v:0]scale=-2:480,format=yuv420p[vout]';

    const args = [
      '-y',
      ...hwaccel,
      '-i', targetFilePath,
      '-filter_complex', filterComplex,
      '-map', '[vout]',
      ...(isMono ? ['-map', '[aout]'] : ['-map', '0:a:0?']),
      ...vArgs,
      '-g', '15',
      '-c:a', 'aac',
      '-b:a', '128k',
      '-ac', '2',
      '-f', 'mp4',
      '-movflags', 'frag_keyframe+empty_moov+default_base_moof',
      'pipe:1'
    ];

    console.log(`[StreamServer] Iniciando buffer contínuo com [${encoder}] para:`, targetFilePath);
    const child = spawn(ffmpegBin, args, { windowsHide: true });
    activeStreamProcesses.set(targetFilePath, child);

    const tempCacheOutput = cachedPreviewPath + '.temp.mp4';
    const cacheStream = fs.createWriteStream(tempCacheOutput);

    child.stdout.on('data', (chunk) => {
      try { res.write(chunk); } catch (e) {}
      try { cacheStream.write(chunk); } catch (e) {}
    });

    child.on('close', (code) => {
      try { res.end(); } catch (e) {}
      try { cacheStream.end(); } catch (e) {}
      activeStreamProcesses.delete(targetFilePath);
      if (code === 0 && fs.existsSync(tempCacheOutput) && fs.statSync(tempCacheOutput).size > 1024) {
        safeAtomicReplace(tempCacheOutput, cachedPreviewPath);
        console.log('[StreamServer] Transmissão contínua concluída e gravada em cache:', cachedPreviewPath);
      }
    });

    req.on('close', () => {
      if (activeStreamProcesses.get(targetFilePath) === child) {
        try { child.kill('SIGKILL'); } catch (e) {}
        activeStreamProcesses.delete(targetFilePath);
      }
      try { cacheStream.end(); } catch (e) {}
    });
  } catch (err) {
    console.error('[StreamServer Error]:', err);
    try { res.end(); } catch (e) {}
  }
});

streamServer.listen(0, '127.0.0.1', () => {
  streamServerPort = streamServer.address().port;
  console.log('[StreamServer] Servidor de buffer contínuo ativo na porta:', streamServerPort);
});

function getStreamUrl(filePath, hasMultipleMono = false) {
  if (streamServerPort > 0) {
    const monoParam = hasMultipleMono ? '&mono=1' : '';
    return `http://127.0.0.1:${streamServerPort}/stream?file=${encodeURIComponent(filePath)}${monoParam}`;
  }
  return null;
}

const activePreviewProcesses = new Map();

// ============================================================================
// 4. COMUNICAÇÃO IPC: PROBE DE METADADOS (FFPROBE)
// ============================================================================
ipcMain.handle('ffmpeg:probe', async (event, filePath) => {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(filePath)) {
      return reject(new Error('Arquivo não encontrado no caminho especificado: ' + filePath));
    }

    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        console.error('[FFprobe Error]:', err);
        return reject(new Error(`Falha ao analisar metadados: ${err.message}`));
      }

      const videoStreams = metadata.streams.filter(s => s.codec_type === 'video');
      const audioStreams = metadata.streams.filter(s => s.codec_type === 'audio');
      const primaryVideo = videoStreams[0] || null;

      const mappedAudio = audioStreams.map((stream, idx) => {
        let channelLayout = stream.channel_layout;
        if (!channelLayout) {
          channelLayout = stream.channels === 1 ? 'mono' : stream.channels === 2 ? 'stereo' : `${stream.channels || 1} canais`;
        }

        let title = stream.tags && (stream.tags.title || stream.tags.handler_name);
        if (!title) {
          title = `Trilha ${idx + 1} (${(stream.codec_name || 'audio').toUpperCase()} • ${channelLayout})`;
        }

        return {
          index: stream.index,
          streamIndex: idx,
          codec_name: stream.codec_name || 'pcm',
          codec_long_name: stream.codec_long_name || stream.codec_name || 'Áudio',
          channels: stream.channels || 1,
          channel_layout: channelLayout,
          sample_rate: parseInt(stream.sample_rate || '48000', 10),
          bit_rate: stream.bit_rate ? parseInt(stream.bit_rate, 10) : undefined,
          bits_per_sample: stream.bits_per_raw_sample ? parseInt(stream.bits_per_raw_sample, 10) : (stream.bits_per_sample ? parseInt(stream.bits_per_sample, 10) : undefined),
          language: stream.tags && stream.tags.language ? stream.tags.language : 'und',
          title: title,
          selected: true
        };
      });

      const mappedChannels = [];
      let globalChannelNumber = 1;

      audioStreams.forEach((stream, streamIdx) => {
        const numChannels = stream.channels || 1;
        for (let chIdx = 0; chIdx < numChannels; chIdx++) {
          let layoutLabel = 'Mono';
          if (numChannels === 2) {
            layoutLabel = chIdx === 0 ? 'Esquerdo (L)' : 'Direito (R)';
          } else if (numChannels === 6) {
            const labels51 = ['Frontal Esq (FL)', 'Frontal Dir (FR)', 'Centro (FC)', 'Subwoofer (LFE)', 'Surround Esq (SL)', 'Surround Dir (SR)'];
            layoutLabel = labels51[chIdx] || `Canal ${chIdx + 1}`;
          } else if (numChannels > 2) {
            layoutLabel = `Canal ${chIdx + 1}`;
          }

          const chId = `${streamIdx}:${chIdx}`;
          mappedChannels.push({
            id: chId,
            streamIndex: streamIdx,
            channelIndex: chIdx,
            channelNumber: globalChannelNumber++,
            label: `Canal ${globalChannelNumber - 1}: ${layoutLabel}`,
            layoutName: layoutLabel,
            codec_name: stream.codec_name || 'pcm',
            sample_rate: parseInt(stream.sample_rate || '48000', 10),
            bit_rate: stream.bit_rate ? parseInt(stream.bit_rate, 10) : undefined,
            bits_per_sample: stream.bits_per_raw_sample ? parseInt(stream.bits_per_raw_sample, 10) : (stream.bits_per_sample ? parseInt(stream.bits_per_sample, 10) : undefined),
            selected: true,
            sourceChannelId: chId
          });
        }
      });

      const isChromiumCompatible = primaryVideo ? (
        ['h264', 'vp8', 'vp9', 'av1'].includes(primaryVideo.codec_name.toLowerCase()) &&
        ['mp4', 'webm', 'mov'].some(ext => filePath.toLowerCase().endsWith('.' + ext))
      ) : false;

      let sampleUrl = `file://${filePath.replace(/\\/g, '/')}`;
      let hasPreviewProxy = false;

      // Se não for compatível nativamente pelo Chromium (ex: MXF, MPEG-2), conecta no streaming contínuo
      if (!isChromiumCompatible) {
        const cachedPath = getPreviewPathForFile(filePath);
        if (fs.existsSync(cachedPath) && fs.statSync(cachedPath).size > 1024) {
          sampleUrl = `file://${cachedPath.replace(/\\/g, '/')}`;
          hasPreviewProxy = true;
        } else if (streamServerPort > 0) {
          const hasMultiMono = Array.isArray(mappedAudio) && mappedAudio.length >= 2 && mappedAudio[0].channels === 1 && mappedAudio[1].channels === 1;
          sampleUrl = getStreamUrl(filePath, hasMultiMono);
          hasPreviewProxy = true;
        } else {
          sampleUrl = undefined;
        }
      }

      const duration = parseFloat(metadata.format.duration || (primaryVideo && primaryVideo.duration) || 0);
      let realFilesize = metadata.format.size || 0;
      if (!realFilesize) {
        try {
          realFilesize = fs.statSync(filePath).size;
        } catch (e) {}
      }

      resolve({
        filename: path.basename(filePath),
        filepath: filePath,
        filesize: realFilesize,
        duration: duration,
        format_name: metadata.format.format_name || path.extname(filePath).replace('.', ''),
        format_long_name: metadata.format.format_long_name || metadata.format.format_name || 'Mídia',
        bit_rate: metadata.format.bit_rate || 0,
        video_codec: primaryVideo ? primaryVideo.codec_name : 'desconhecido',
        width: primaryVideo ? (primaryVideo.width || 0) : 0,
        height: primaryVideo ? (primaryVideo.height || 0) : 0,
        fps: primaryVideo ? evalFps(primaryVideo.r_frame_rate || primaryVideo.avg_frame_rate) : 29.97,
        pixel_format: primaryVideo ? (primaryVideo.pix_fmt || 'desconhecido') : 'desconhecido',
        aspect_ratio: primaryVideo ? (primaryVideo.display_aspect_ratio || `${primaryVideo.width}:${primaryVideo.height}`) : '16:9',
        video_stream_index: primaryVideo ? primaryVideo.index : 0,
        audio_streams: mappedAudio,
        audio_channels: mappedChannels,
        isChromiumCompatible,
        hasPreviewProxy,
        sampleUrl
      });
    });
  });
});

// ============================================================================
// ============================================================================
// 4.1 BUFFER CONTÍNUO INSTANTÂNEO & REMUX DIRETO
// ============================================================================
ipcMain.handle('ffmpeg:generate-preview', async (event, options) => {
  const filePath = typeof options === 'string' ? options : options?.filePath;
  const audioStreams = typeof options === 'object' ? options?.audioStreams : null;
  const videoCodec = (typeof options === 'object' && options?.videoCodec ? options.videoCodec : '').toLowerCase();
  const pixelFormat = (typeof options === 'object' && options?.pixelFormat ? options.pixelFormat : '').toLowerCase();

  if (!filePath || !fs.existsSync(filePath)) {
    throw new Error('Arquivo não encontrado: ' + filePath);
  }

  const previewPath = getPreviewPathForFile(filePath);
  if (fs.existsSync(previewPath) && fs.statSync(previewPath).size > 1024) {
    return {
      success: true,
      previewPath,
      sampleUrl: `file://${previewPath.replace(/\\/g, '/')}`,
      isPartial: false
    };
  }

  const ffmpegBin = resolvedFfmpegPath || 'ffmpeg';
  const hasMultipleMono = Array.isArray(audioStreams) && audioStreams.length >= 2 && audioStreams[0].channels === 1 && audioStreams[1].channels === 1;

  // Se o vídeo já for H.264 yuv420p, faz remux direto (< 0.2s)
  const isDirectRemuxCompatible = (
    (videoCodec === 'h264' || videoCodec === 'avc1') &&
    (pixelFormat === 'yuv420p' || pixelFormat === 'yuvj420p')
  );

  if (isDirectRemuxCompatible) {
    console.log('[Preview Proxy: Remux] Executando remux instantâneo:', filePath);
    const tempRemux = previewPath + '.remux.mp4';
    if (fs.existsSync(tempRemux)) {
      try { fs.unlinkSync(tempRemux); } catch (e) {}
    }

    const remuxArgs = [
      '-y',
      '-i', filePath,
      ...(hasMultipleMono ? ['-filter_complex', '[0:a:0][0:a:1]amerge=inputs=2[aout]'] : []),
      '-map', '0:v:0',
      '-c:v', 'copy',
      ...(hasMultipleMono ? ['-map', '[aout]'] : ['-map', '0:a:0?']),
      '-c:a', 'aac',
      '-b:a', '128k',
      '-ac', '2',
      '-map_metadata', '-1',
      '-movflags', '+faststart',
      tempRemux
    ];

    try {
      const remuxProc = spawnSync(ffmpegBin, remuxArgs, { windowsHide: true });
      if (remuxProc.status === 0 && fs.existsSync(tempRemux) && fs.statSync(tempRemux).size > 1024) {
        safeAtomicReplace(tempRemux, previewPath);
        return {
          success: true,
          previewPath,
          sampleUrl: `file://${previewPath.replace(/\\/g, '/')}`,
          isPartial: false
        };
      }
    } catch (e) {}
  }

  // Para qualquer vídeo broadcast (MXF XDCAM, MPEG-2, DNxHD, etc.), conecta no buffer de streaming contínuo
  const streamUrl = getStreamUrl(filePath, hasMultipleMono);
  return {
    success: true,
    previewPath,
    sampleUrl: streamUrl || `file://${previewPath.replace(/\\/g, '/')}`,
    isPartial: false
  };
});

ipcMain.handle('ffmpeg:cancel-preview', async (event, filePath) => {
  if (filePath) {
    if (activeStreamProcesses.has(filePath)) {
      const child = activeStreamProcesses.get(filePath);
      try { child.kill('SIGKILL'); } catch (e) {}
      activeStreamProcesses.delete(filePath);
    }
    if (activePreviewProcesses.has(filePath)) {
      const child = activePreviewProcesses.get(filePath);
      try { child.kill('SIGKILL'); } catch (e) {}
      activePreviewProcesses.delete(filePath);
    }
    return true;
  }
  return false;
});

function evalFps(fpsString) {
  if (!fpsString) return 29.97;
  if (typeof fpsString === 'number') return fpsString;
  if (fpsString.includes('/')) {
    const [num, den] = fpsString.split('/').map(Number);
    return den ? Number((num / den).toFixed(2)) : 29.97;
  }
  return Number(parseFloat(fpsString).toFixed(2)) || 29.97;
}

// ============================================================================
// 5. COMUNICAÇÃO IPC: CONVERSÃO PARA MXF COM NIVELAMENTO (+7dB / -12dB)
// ============================================================================
ipcMain.handle('ffmpeg:convert', async (event, options) => {
  const {
    inputPath,
    outputPath,
    selectedAudioIndices = [0],
    selectedChannels,
    videoCodec = 'mpeg2video',
    videoBitrate = '50M',
    pixelFormat = 'yuv422p',
    gainDb = 0,
    limitDb = 0
  } = options;

  return new Promise((resolve, reject) => {
    if (!fs.existsSync(inputPath)) {
      return reject(new Error('Arquivo de entrada não existe: ' + inputPath));
    }

    const ffmpegBin = resolvedFfmpegPath || 'ffmpeg';
    const args = ['-y', '-i', inputPath];

    if (selectedChannels && selectedChannels.length > 0) {
      const activeChannels = selectedChannels.filter(ch => ch.selected);

      if (activeChannels.length === 0) {
        return reject(new Error('Nenhum canal de áudio selecionado. Marque ao menos um canal para exportar.'));
      }

      // Constrói o filter_complex como array de strings separadas
      const filterParts = [];
      const outLabels = [];
      const safeLimitDb = Math.min(0, Number(limitDb) || 0);

      activeChannels.forEach((ch, idx) => {
        const outLabel = `out_ch_${idx}`;
        outLabels.push(`[${outLabel}]`);
        const sourceCh = selectedChannels.find(c => c.id === ch.sourceChannelId) || ch;
        const filterStr = `[0:a:${sourceCh.streamIndex}]pan=1c|c0=c${sourceCh.channelIndex},volume=${gainDb}dB,alimiter=limit=${safeLimitDb}dB:attack=5:release=50:asc=0:level=false[${outLabel}]`;
        filterParts.push(filterStr);
      });

      args.push('-filter_complex', filterParts.join('; '));
      args.push('-map', '0:v:0');
      outLabels.forEach(lbl => {
        args.push('-map', lbl);
      });
    } else {
      const safeLimitDb = Math.min(0, Number(limitDb) || 0);
      args.push('-map', '0:v:0');
      selectedAudioIndices.forEach(audioIdx => {
        args.push('-map', `0:a:${audioIdx}`);
      });
      args.push('-af', `volume=${gainDb}dB,alimiter=limit=${safeLimitDb}dB:attack=5:release=50:asc=0:level=false`);
    }

    // Codec de vídeo
    if (videoCodec === 'mpeg2video') {
      args.push('-c:v', 'mpeg2video', '-b:v', videoBitrate, '-pix_fmt', pixelFormat, '-g', '12', '-bf', '2', '-flags', '+ildct+ilme', '-top', '1');
    } else if (videoCodec === 'copy') {
      args.push('-c:v', 'copy');
    } else if (videoCodec === 'dnxhd') {
      args.push('-c:v', 'dnxhd', '-b:v', '120M', '-pix_fmt', 'yuv422p');
    }

    // Codec de áudio e formato de saída
    args.push('-c:a', 'pcm_s24le', '-ar', '48000', '-f', 'mxf', outputPath);

    console.log('[FFmpeg] Iniciando conversão com args:', args.join(' '));
    event.sender.send('ffmpeg:log', `[Comando]: ${ffmpegBin} ${args.join(' ')}`);

    const child = spawn(ffmpegBin, args, { windowsHide: true });
    currentCommand = child;

    child.stderr.on('data', (data) => {
      const line = data.toString();
      event.sender.send('ffmpeg:log', line.trim());

      // Tenta extrair progresso do stderr do FFmpeg
      const timeMatch = line.match(/time=(\d{2}:\d{2}:\d{2}\.\d{2})/);
      const fpsMatch = line.match(/fps=\s*(\d+\.?\d*)/);
      const bitrateMatch = line.match(/bitrate=\s*([0-9.]+\s*\w+\/s)/);
      const sizeMatch = line.match(/size=\s*(\d+kB)/);

      if (timeMatch) {
        const parts = timeMatch[1].split(':');
        const seconds = parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2]);
        const totalDuration = options.duration || 1;
        const percent = Math.min(100, Math.round((seconds / totalDuration) * 100));
        event.sender.send('ffmpeg:progress', {
          percent,
          frames: 0,
          currentFps: fpsMatch ? parseFloat(fpsMatch[1]) : 0,
          currentKbps: 0,
          targetSize: sizeMatch ? parseInt(sizeMatch[1]) : 0,
          timemark: timeMatch[1]
        });
      }
    });

    child.on('error', (err) => {
      currentCommand = null;
      console.error('[FFmpeg Error]:', err.message);
      event.sender.send('ffmpeg:log', `[ERRO CRÍTICO]: ${err.message}`);
      reject(new Error(err.message));
    });

    child.on('close', (code) => {
      currentCommand = null;
      if (code === 0) {
        console.log('[FFmpeg Concluído]:', outputPath);
        event.sender.send('ffmpeg:log', `[SUCESSO]: Arquivo MXF OP-1a gerado com conformidade total em: ${outputPath}`);
        resolve({ success: true, outputPath });
      } else {
        const errMsg = `FFmpeg encerrou com código ${code}. Verifique os logs do terminal para detalhes.`;
        event.sender.send('ffmpeg:log', `[ERRO]: ${errMsg}`);
        reject(new Error(errMsg));
      }
    });
  });
});

ipcMain.handle('ffmpeg:cancel', async () => {
  if (currentCommand) {
    // Funciona tanto com ChildProcess (spawn) quanto com fluent-ffmpeg
    if (typeof currentCommand.kill === 'function') {
      currentCommand.kill();
    }
    currentCommand = null;
    return true;
  }
  return false;
});

