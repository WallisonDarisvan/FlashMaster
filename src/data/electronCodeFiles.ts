import { ElectronCodeFile } from '../types';

export const ELECTRON_CODE_FILES: ElectronCodeFile[] = [
  {
    name: 'package.json',
    path: 'package.json',
    language: 'json',
    description: 'Manifesto do projeto com dependências do Electron, fluent-ffmpeg, binários estáticos e scripts de empacotamento.',
    code: `{
  "name": "electron-mxf-converter",
  "version": "1.0.0",
  "description": "Conversor e Processador de Vídeo para MXF com Mapeamento de Áudio e Nivelamento (+7dB / Limiter -12dB)",
  "main": "main.js",
  "scripts": {
    "start": "electron .",
    "pack": "electron-builder --dir",
    "dist": "electron-builder",
    "dist:win": "electron-builder --win",
    "dist:mac": "electron-builder --mac",
    "dist:linux": "electron-builder --linux"
  },
  "keywords": [
    "electron",
    "ffmpeg",
    "ffprobe",
    "mxf",
    "audio-mapping",
    "limiter",
    "broadcast"
  ],
  "author": "Especialista em Engenharia de Software",
  "license": "MIT",
  "dependencies": {
    "fluent-ffmpeg": "^2.1.3",
    "ffmpeg-static": "^5.2.0",
    "ffprobe-static": "^3.1.0"
  },
  "devDependencies": {
    "electron": "^28.2.0",
    "electron-builder": "^24.9.1"
  },
  "build": {
    "appId": "com.broadcast.mxfconverter",
    "productName": "MXF Audio Leveler Studio",
    "directories": {
      "output": "dist-app"
    },
    "files": [
      "main.js",
      "preload.js",
      "index.html",
      "renderer.js",
      "styles.css",
      "node_modules/**/*"
    ],
    "asarUnpack": [
      "**/node_modules/ffmpeg-static/**/*",
      "**/node_modules/ffprobe-static/**/*"
    ],
    "mac": {
      "category": "public.app-category.video",
      "target": ["dmg", "zip"]
    },
    "win": {
      "target": ["nsis", "portable"]
    },
    "linux": {
      "target": ["AppImage", "tar.gz"]
    }
  }
}`
  },
  {
    name: 'main.js',
    path: 'main.js',
    language: 'javascript',
    description: 'Processo principal (Main Process) com configuração de segurança, resolução de caminhos de binários FFmpeg e handlers IPC.',
    code: `const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');
const ffprobeStatic = require('ffprobe-static');

// ============================================================================
// 1. CONFIGURAÇÃO E RESOLUÇÃO DOS BINÁRIOS DO FFMPEG / FFPROBE
// ============================================================================
// Tratamento crucial: em produção empacotada com asar, os binários precisam
// ser apontados para o diretório descompactado (asarUnpack / app.asar.unpacked).
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
  console.warn('[FFmpeg] Binário estático não encontrado, tentando comando global do sistema...');
}

if (resolvedFfprobePath && fs.existsSync(resolvedFfprobePath)) {
  ffmpeg.setFfprobePath(resolvedFfprobePath);
  console.log('[FFprobe] Binário carregado com sucesso:', resolvedFfprobePath);
} else {
  console.warn('[FFprobe] Binário ffprobe não encontrado, tentando comando global...');
}

// Mantém referência global da janela para evitar coleta de lixo (garbage collection)
let mainWindow = null;
let currentCommand = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 850,
    minWidth: 960,
    minHeight: 650,
    backgroundColor: '#0f172a',
    title: 'MXF Audio Leveler Studio - Conversor de Vídeo Broadcast',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, // SEGURANÇA: Isola o contexto do renderer
      nodeIntegration: false,  // SEGURANÇA: Desativa Node.js no renderer
      sandbox: false           // Permite acesso seguro via preload
    },
    show: false
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ============================================================================
// 2. CICLO DE VIDA DO APLICATIVO
// ============================================================================
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// ============================================================================
// 3. COMUNICAÇÃO IPC: DIÁLOGOS DE ARQUIVO
// ============================================================================
ipcMain.handle('dialog:open-video', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Selecionar Arquivo de Vídeo',
    properties: ['openFile'],
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

  const filePath = result.filePaths[0];
  return {
    filePath,
    fileName: path.basename(filePath)
  };
});

ipcMain.handle('dialog:select-output', async (event, defaultName) => {
  const defaultPath = defaultName ? path.parse(defaultName).name + '_converted.mxf' : 'output.mxf';
  
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Salvar Arquivo MXF Convertido',
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

ipcMain.handle('shell:open-folder', async (event, folderPath) => {
  if (fs.existsSync(folderPath)) {
    shell.showItemInFolder(folderPath);
    return true;
  }
  return false;
});

// ============================================================================
// 4. COMUNICAÇÃO IPC: PROBE DE METADADOS (FFPROBE)
// ============================================================================
ipcMain.handle('ffmpeg:probe', async (event, filePath) => {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(filePath)) {
      return reject(new Error('Arquivo não encontrado no caminho especificado.'));
    }

    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        console.error('[FFprobe Error]:', err);
        return reject(new Error(\`Falha ao analisar metadados: \${err.message}\`));
      }

      // Separa e enriquece os streams de vídeo e áudio
      const videoStreams = metadata.streams.filter(s => s.codec_type === 'video');
      const audioStreams = metadata.streams.filter(s => s.codec_type === 'audio');

      const primaryVideo = videoStreams[0] || null;

      // Mapeia os canais/trilhas de áudio para o frontend
      const mappedAudio = audioStreams.map((stream, idx) => {
        let title = stream.tags && (stream.tags.title || stream.tags.handler_name || stream.tags.language);
        if (!title) {
          title = \`Trilha \${idx + 1} (\${stream.codec_name.toUpperCase()} - \${stream.channel_layout || stream.channels + ' canais'})\`;
        }

        return {
          index: stream.index,              // Índice global do stream no FFmpeg
          audioIndex: idx,                   // Índice relativo de áudio (0:a:0, 0:a:1, etc.)
          codec_name: stream.codec_name,
          codec_long_name: stream.codec_long_name || stream.codec_name,
          channels: stream.channels || 2,
          channel_layout: stream.channel_layout || (stream.channels === 1 ? 'mono' : 'stereo'),
          sample_rate: parseInt(stream.sample_rate || '48000', 10),
          bit_rate: stream.bit_rate ? parseInt(stream.bit_rate, 10) : undefined,
          bits_per_sample: stream.bits_per_raw_sample ? parseInt(stream.bits_per_raw_sample, 10) : 16,
          language: stream.tags && stream.tags.language ? stream.tags.language : 'und',
          title: title,
          selected: true // Marcado por padrão
        };
      });

      // Detecção de compatibilidade do preview no Chromium
      // Chromium suporta nativamente H.264 (avc1), VP8, VP9, AV1 em MP4/WebM
      const isChromiumCompatible = primaryVideo ? (
        ['h264', 'vp8', 'vp9', 'av1'].includes(primaryVideo.codec_name.toLowerCase()) &&
        ['mp4', 'webm', 'mov'].some(ext => filePath.toLowerCase().endsWith('.' + ext))
      ) : false;

      resolve({
        filename: path.basename(filePath),
        filepath: filePath,
        filesize: metadata.format.size || 0,
        duration: metadata.format.duration || 0,
        format_name: metadata.format.format_name,
        format_long_name: metadata.format.format_long_name,
        bit_rate: metadata.format.bit_rate || 0,
        video: primaryVideo ? {
          index: primaryVideo.index,
          codec: primaryVideo.codec_name,
          width: primaryVideo.width,
          height: primaryVideo.height,
          fps: evalFps(primaryVideo.r_frame_rate || primaryVideo.avg_frame_rate),
          pixel_format: primaryVideo.pix_fmt,
          aspect_ratio: primaryVideo.display_aspect_ratio || '16:9'
        } : null,
        audio_streams: mappedAudio,
        isChromiumCompatible
      });
    });
  });
});

function evalFps(fpsString) {
  if (!fpsString) return 29.97;
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
    selectedAudioIndices, // Array de índices de áudio relativos selecionados [0, 1, ...]
    videoCodec = 'mpeg2video', // Broadcast standard para MXF (XDCAM / D10 / DNxHD)
    videoBitrate = '50M',
    pixelFormat = 'yuv422p',
    gainDb = 7,
    limitDb = -12
  } = options;

  return new Promise((resolve, reject) => {
    if (!fs.existsSync(inputPath)) {
      return reject(new Error('Arquivo de entrada não existe.'));
    }

    if (!selectedAudioIndices || selectedAudioIndices.length === 0) {
      return reject(new Error('Nenhum canal de áudio foi selecionado para o arquivo final.'));
    }

    // Inicializa o comando FFmpeg
    const cmd = ffmpeg(inputPath);
    currentCommand = cmd;

    // 1. Mapeamento de Vídeo: Primeiro stream de vídeo (0:v:0)
    const outputOptions = [
      '-map 0:v:0'
    ];

    // 2. Mapeamento de Áudio e Construção do Filtro de Nivelamento
    // Regra estrita: +7 dB de ganho e Limiter em -12 dB (sem distorção/pico)
    // Filtro FFmpeg: volume=7dB,alimiter=limit=-12dB:attack=5:release=50:asc=0
    // Onde:
    // - volume=7dB: aumenta a amplitude de entrada em 7 decibéis
    // - alimiter=limit=-12dB: hard limiter ultra-rápido que impede que o pico exceda -12 dB
    // - attack=5 (5ms): tempo de ataque para capturar transientes instantâneos
    // - release=50 (50ms): recuperação suave do limiter
    // - asc=0: desativa auto-scaling para garantir conformidade estrita com o limite
    const audioFilterStr = \`volume=\${gainDb}dB,alimiter=limit=\${limitDb}dB:attack=5:release=50:asc=0\`;

    selectedAudioIndices.forEach((audioIdx) => {
      // Mapeia cada trilha de áudio escolhida pelo usuário
      outputOptions.push(\`-map 0:a:\${audioIdx}\`);
    });

    // Aplica o filtro de áudio e o codec PCM broadcast para MXF
    outputOptions.push(\`-af \${audioFilterStr}\`);
    outputOptions.push('-c:a pcm_s24le'); // Padrão de broadcast: PCM 24-bit linear
    outputOptions.push('-ar 48000');       // Taxa de amostragem padrão broadcast: 48kHz

    // Configurações de Vídeo e Container MXF
    if (videoCodec === 'mpeg2video') {
      // Perfil XDCAM HD422 / SMPTE RDD 9 padrão para emisssoras em container MXF OP-1a
      outputOptions.push('-c:v mpeg2video');
      outputOptions.push(\`-b:v \${videoBitrate}\`);
      outputOptions.push(\`-pix_fmt \${pixelFormat}\`);
      outputOptions.push('-g 12');
      outputOptions.push('-bf 2');
      outputOptions.push('-flags +ildct+ilme');
      outputOptions.push('-top 1');
    } else if (videoCodec === 'copy') {
      outputOptions.push('-c:v copy');
    } else if (videoCodec === 'dnxhd') {
      outputOptions.push('-c:v dnxhd');
      outputOptions.push('-b:v 120M');
      outputOptions.push('-pix_fmt yuv422p');
    }

    // Formato de saída explícito MXF OP-1a
    outputOptions.push('-f mxf');

    // Executa e monitora o processo
    cmd
      .outputOptions(outputOptions)
      .output(outputPath)
      .on('start', (commandLine) => {
        console.log('[FFmpeg Start]:', commandLine);
        event.sender.send('ffmpeg:log', \`[Comando FFmpeg Inicializado]: \${commandLine}\`);
      })
      .on('progress', (progress) => {
        // Envia progresso contínuo para a UI
        event.sender.send('ffmpeg:progress', {
          percent: progress.percent ? Math.min(Math.round(progress.percent), 100) : 0,
          frames: progress.frames || 0,
          currentFps: progress.currentFps || 0,
          currentKbps: progress.currentKbps || 0,
          targetSize: progress.targetSize || 0,
          timemark: progress.timemark || '00:00:00'
        });
      })
      .on('stderr', (stderrLine) => {
        event.sender.send('ffmpeg:log', stderrLine);
      })
      .on('error', (err, stdout, stderr) => {
        currentCommand = null;
        console.error('[FFmpeg Error]:', err.message);
        event.sender.send('ffmpeg:log', \`[ERRO CRÍTICO]: \${err.message}\`);
        reject(new Error(err.message));
      })
      .on('end', () => {
        currentCommand = null;
        console.log('[FFmpeg Concluído]: Arquivo MXF gerado com sucesso.');
        event.sender.send('ffmpeg:log', '[SUCESSO]: Conversão MXF finalizada com conformidade de áudio (+7dB / -12dB).');
        resolve({
          success: true,
          outputPath: outputPath
        });
      })
      .run();
  });
});

ipcMain.handle('ffmpeg:cancel', async () => {
  if (currentCommand) {
    currentCommand.kill('SIGKILL');
    currentCommand = null;
    return true;
  }
  return false;
});
`
  },
  {
    name: 'preload.js',
    path: 'preload.js',
    language: 'javascript',
    description: 'Bridge de contexto seguro (ContextBridge) expondo a API do Electron para o Renderer sem vazar Node.js.',
    code: `const { contextBridge, ipcRenderer } = require('electron');

// ============================================================================
// CONTEXT BRIDGE SEGURO
// Expõe métodos estritamente controlados na janela global: window.electronAPI
// ============================================================================
contextBridge.exposeInMainWorld('electronAPI', {
  // Diálogos de Seleção
  openVideoDialog: () => ipcRenderer.invoke('dialog:open-video'),
  selectOutputDialog: (defaultName) => ipcRenderer.invoke('dialog:select-output', defaultName),
  openFolder: (folderPath) => ipcRenderer.invoke('shell:open-folder', folderPath),

  // Operações de FFmpeg
  probeVideo: (filePath) => ipcRenderer.invoke('ffmpeg:probe', filePath),
  convertVideo: (options) => ipcRenderer.invoke('ffmpeg:convert', options),
  cancelConversion: () => ipcRenderer.invoke('ffmpeg:cancel'),

  // Listeners de Eventos (Event Streaming)
  onProgress: (callback) => {
    const subscription = (event, value) => callback(value);
    ipcRenderer.on('ffmpeg:progress', subscription);
    return () => ipcRenderer.removeListener('ffmpeg:progress', subscription);
  },

  onLog: (callback) => {
    const subscription = (event, value) => callback(value);
    ipcRenderer.on('ffmpeg:log', subscription);
    return () => ipcRenderer.removeListener('ffmpeg:log', subscription);
  }
});
`
  },
  {
    name: 'index.html',
    path: 'index.html',
    language: 'html',
    description: 'Interface gráfica moderna (Broadcast Studio Dark UI) com player, seleção de faixas de áudio e console de conversão.',
    code: `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MXF Audio Leveler Studio</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body class="app-body">
  <!-- CABEÇALHO DO APLICATIVO -->
  <header class="app-header">
    <div class="header-left">
      <div class="logo-badge">MXF</div>
      <div>
        <h1 class="app-title">MXF Audio Leveler Studio</h1>
        <p class="app-subtitle">Conversor Broadcast &bull; Mapeamento de Canais &bull; Ganho +7dB com Limiter em -12dB</p>
      </div>
    </div>
    <div class="header-right">
      <span class="status-tag ready" id="systemStatus">Pronto</span>
    </div>
  </header>

  <main class="app-main">
    <!-- COLUNA ESQUERDA: ENTRADA E PREVIEW -->
    <section class="panel left-panel">
      <!-- ÁREA DE CARREGAMENTO / DRAG-AND-DROP -->
      <div class="card dropzone-card" id="dropzone">
        <input type="file" id="fileInput" accept="video/*,.mxf,.mkv,.ts,.mov,.mp4" style="display: none;">
        <div class="dropzone-content" id="dropzoneContent">
          <svg class="icon-upload" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="17 8 12 3 7 8"></polyline>
            <line x1="12" y1="3" x2="12" y2="15"></line>
          </svg>
          <h3>Arraste e solte o vídeo aqui</h3>
          <p>ou clique para navegar nos seus arquivos (MP4, MOV, MKV, MXF, TS, etc.)</p>
          <button class="btn btn-primary" id="btnSelectFile" type="button">Selecionar Arquivo de Vídeo</button>
        </div>

        <div class="file-loaded-info" id="fileLoadedInfo" style="display: none;">
          <div class="file-badge">VÍDEO CARREGADO</div>
          <div class="file-name" id="displayFileName">video.mp4</div>
          <div class="file-meta" id="displayFileMeta">1920x1080 &bull; 29.97 fps &bull; H.264 &bull; 00:03:45</div>
          <button class="btn btn-sm btn-outline" id="btnChangeFile" type="button">Trocar Arquivo</button>
        </div>
      </div>

      <!-- PLAYER DE PREVIEW -->
      <div class="card preview-card">
        <div class="card-header">
          <h2>Preview do Vídeo</h2>
          <span class="badge" id="previewCodecBadge">Aguardando arquivo</span>
        </div>
        <div class="video-container">
          <video id="videoPlayer" controls playsinline></video>
          <div class="fallback-preview" id="fallbackPreview" style="display: none;">
            <p>Formato não suportado pelo player nativo do Chromium (ex: ProRes/DNxHD/MPEG-2 em MXF).</p>
            <small>O arquivo será processado e convertido perfeitamente via FFmpeg.</small>
          </div>
        </div>
      </div>
    </section>

    <!-- COLUNA DIREITA: MAPEAMENTO DE ÁUDIO E PROCESSAMENTO -->
    <section class="panel right-panel">
      <!-- MAPEAMENTO DE ÁUDIO (PROBE) -->
      <div class="card audio-mapping-card">
        <div class="card-header">
          <div>
            <h2>Mapeamento de Trilhas de Áudio</h2>
            <p class="section-desc">Selecione quais canais de áudio serão preservados no arquivo MXF final:</p>
          </div>
          <button class="btn btn-sm btn-ghost" id="btnSelectAllAudio" type="button">Marcar Todas</button>
        </div>

        <div class="audio-tracks-list" id="audioTracksList">
          <div class="empty-state">Nenhum arquivo carregado. Carregue um vídeo para analisar as trilhas de áudio.</div>
        </div>
      </div>

      <!-- REGRAS DE ÁUDIO & PERFIL DE SAÍDA -->
      <div class="card filter-spec-card">
        <div class="card-header">
          <h2>Processamento de Áudio Broadcast</h2>
          <span class="badge badge-accent">Regra Estrita Aplicada</span>
        </div>
        <div class="filter-boxes-grid">
          <div class="filter-box">
            <span class="filter-label">Ganho de Entrada</span>
            <span class="filter-val highlight-green">+7.0 dB</span>
            <span class="filter-desc">Aumento uniforme no sinal</span>
          </div>
          <div class="filter-box">
            <span class="filter-label">Limiter (Teto Máximo)</span>
            <span class="filter-val highlight-cyan">-12.0 dB</span>
            <span class="filter-desc">Corte sem distorção / Sem picos</span>
          </div>
          <div class="filter-box">
            <span class="filter-label">Filtro FFmpeg</span>
            <code class="filter-code">volume=7dB,alimiter=limit=-12dB</code>
          </div>
        </div>
      </div>

      <!-- PAINEL DE CONVERSÃO E PROGRESSO -->
      <div class="card conversion-card">
        <div class="conversion-actions">
          <button class="btn btn-success btn-lg" id="btnConvert" disabled type="button">
            <svg class="icon-btn" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
            Converter para MXF
          </button>
          <button class="btn btn-danger" id="btnCancel" style="display: none;" type="button">Cancelar</button>
        </div>

        <!-- BARRA DE PROGRESSO -->
        <div class="progress-section" id="progressSection" style="display: none;">
          <div class="progress-header">
            <span id="progressStatusText">Processando vídeo e nivelando áudio...</span>
            <span id="progressPercentage">0%</span>
          </div>
          <div class="progress-bar-bg">
            <div class="progress-bar-fill" id="progressBarFill" style="width: 0%;"></div>
          </div>
          <div class="progress-stats" id="progressStats">
            <span>FPS: <strong id="statFps">0</strong></span>
            <span>Bitrate: <strong id="statBitrate">0 kb/s</strong></span>
            <span>Tempo: <strong id="statTime">00:00:00</strong></span>
          </div>
        </div>

        <!-- TERMINAL DE LOGS DO FFMPEG -->
        <div class="terminal-container">
          <div class="terminal-header">
            <span>Terminal FFmpeg</span>
            <button class="btn btn-xs btn-ghost" id="btnClearLogs">Limpar</button>
          </div>
          <div class="terminal-body" id="terminalLogs">
            <div class="terminal-line text-muted">> Sistema pronto. Selecione um vídeo para iniciar.</div>
          </div>
        </div>
      </div>
    </section>
  </main>

  <script src="renderer.js"></script>
</body>
</html>
`
  },
  {
    name: 'renderer.js',
    path: 'renderer.js',
    language: 'javascript',
    description: 'Lógica do frontend no Renderer: interface, drag-and-drop, mapeamento de áudio dinâmico e controle de conversão.',
    code: `// ============================================================================
// MXF AUDIO LEVELER STUDIO - RENDERER SCRIPT
// ============================================================================

// Referências aos elementos do DOM
const dropzone = document.getElementById('dropzone');
const dropzoneContent = document.getElementById('dropzoneContent');
const fileLoadedInfo = document.getElementById('fileLoadedInfo');
const displayFileName = document.getElementById('displayFileName');
const displayFileMeta = document.getElementById('displayFileMeta');
const fileInput = document.getElementById('fileInput');
const btnSelectFile = document.getElementById('btnSelectFile');
const btnChangeFile = document.getElementById('btnChangeFile');

const videoPlayer = document.getElementById('videoPlayer');
const fallbackPreview = document.getElementById('fallbackPreview');
const previewCodecBadge = document.getElementById('previewCodecBadge');

const audioTracksList = document.getElementById('audioTracksList');
const btnSelectAllAudio = document.getElementById('btnSelectAllAudio');

const btnConvert = document.getElementById('btnConvert');
const btnCancel = document.getElementById('btnCancel');
const progressSection = document.getElementById('progressSection');
const progressStatusText = document.getElementById('progressStatusText');
const progressPercentage = document.getElementById('progressPercentage');
const progressBarFill = document.getElementById('progressBarFill');
const statFps = document.getElementById('statFps');
const statBitrate = document.getElementById('statBitrate');
const statTime = document.getElementById('statTime');
const terminalLogs = document.getElementById('terminalLogs');
const btnClearLogs = document.getElementById('btnClearLogs');
const systemStatus = document.getElementById('systemStatus');

// Estado interno do app
let currentVideoData = null;
let isConverting = false;

// ============================================================================
// 1. GERENCIAMENTO DE LOGS DO TERMINAL
// ============================================================================
function appendLog(message, type = 'normal') {
  const line = document.createElement('div');
  line.className = 'terminal-line';
  
  if (type === 'error' || message.includes('ERRO') || message.includes('Error')) {
    line.classList.add('text-error');
  } else if (type === 'success' || message.includes('SUCESSO')) {
    line.classList.add('text-success');
  } else if (message.includes('Comando FFmpeg')) {
    line.classList.add('text-accent');
  }

  line.textContent = \`[\${new Date().toLocaleTimeString()}] \${message}\`;
  terminalLogs.appendChild(line);
  terminalLogs.scrollTop = terminalLogs.scrollHeight;
}

btnClearLogs.addEventListener('click', () => {
  terminalLogs.innerHTML = '';
  appendLog('Terminal limpo.');
});

// ============================================================================
// 2. LISTENERS DE EVENTOS VINDOS DO MAIN PROCESS
// ============================================================================
if (window.electronAPI) {
  window.electronAPI.onLog((logMessage) => {
    appendLog(logMessage);
  });

  window.electronAPI.onProgress((data) => {
    progressBarFill.style.width = \`\${data.percent}%\`;
    progressPercentage.textContent = \`\${data.percent}%\`;
    statFps.textContent = data.currentFps || 0;
    statBitrate.textContent = \`\${data.currentKbps} kb/s\`;
    statTime.textContent = data.timemark || '00:00:00';
  });
}

// ============================================================================
// 3. CARREGAMENTO E PROBE DO VÍDEO
// ============================================================================
async function handleFileSelection(filePath) {
  if (!filePath) return;

  try {
    systemStatus.className = 'status-tag processing';
    systemStatus.textContent = 'Analisando Metadados...';
    appendLog(\`Iniciando ffprobe no arquivo: \${filePath}\`);

    const meta = await window.electronAPI.probeVideo(filePath);
    currentVideoData = meta;

    // Atualiza interface do arquivo carregado
    dropzoneContent.style.display = 'none';
    fileLoadedInfo.style.display = 'flex';
    displayFileName.textContent = meta.filename;
    
    const durationMin = Math.floor(meta.duration / 60);
    const durationSec = Math.floor(meta.duration % 60).toString().padStart(2, '0');
    
    displayFileMeta.textContent = meta.video 
      ? \`\${meta.video.width}x\${meta.video.height} • \${meta.video.fps} fps • \${meta.video.codec.toUpperCase()} • \${durationMin}:\${durationSec}\`
      : \`Duração: \${durationMin}:\${durationSec}\`;

    // Atualiza Player de Preview
    if (meta.isChromiumCompatible) {
      videoPlayer.src = \`file://\${meta.filepath}\`;
      videoPlayer.style.display = 'block';
      fallbackPreview.style.display = 'none';
      previewCodecBadge.textContent = \`Reprodução Nativa (\${meta.video?.codec.toUpperCase()})\`;
      previewCodecBadge.className = 'badge badge-success';
    } else {
      videoPlayer.style.display = 'none';
      fallbackPreview.style.display = 'flex';
      previewCodecBadge.textContent = \`Codec: \${meta.video?.codec.toUpperCase() || 'Desconhecido'}\`;
      previewCodecBadge.className = 'badge badge-warning';
    }

    // Renderiza lista de trilhas de áudio com checkboxes
    renderAudioTracks(meta.audio_streams);

    // Habilita botão de conversão
    btnConvert.disabled = meta.audio_streams.length === 0;
    systemStatus.className = 'status-tag ready';
    systemStatus.textContent = 'Pronto para Conversão';
    appendLog(\`Vídeo carregado com sucesso. \${meta.audio_streams.length} trilha(s) de áudio identificada(s).\`, 'success');

  } catch (err) {
    systemStatus.className = 'status-tag error';
    systemStatus.textContent = 'Erro ao Carregar';
    appendLog(\`Erro ao analisar vídeo: \${err.message}\`, 'error');
    alert(\`Erro ao ler o arquivo de vídeo: \${err.message}\`);
  }
}

// ============================================================================
// 4. RENDERIZAÇÃO DAS CHECKBOXES DE ÁUDIO
// ============================================================================
function renderAudioTracks(audioStreams) {
  audioTracksList.innerHTML = '';

  if (!audioStreams || audioStreams.length === 0) {
    audioTracksList.innerHTML = '<div class="empty-state">Nenhuma trilha de áudio encontrada no arquivo de vídeo original.</div>';
    return;
  }

  audioStreams.forEach((stream, idx) => {
    const trackItem = document.createElement('div');
    trackItem.className = 'audio-track-item';

    trackItem.innerHTML = \`
      <label class="track-label">
        <input type="checkbox" class="track-checkbox" data-index="\${stream.audioIndex}" \${stream.selected ? 'checked' : ''}>
        <div class="track-info">
          <div class="track-title">
            <strong>Trilha #\${idx + 1}: \${stream.title}</strong>
            <span class="track-badge">\${stream.codec_name.toUpperCase()}</span>
          </div>
          <div class="track-meta">
            Canais: <strong>\${stream.channel_layout} (\${stream.channels}ch)</strong> &bull; 
            Taxa: <strong>\${stream.sample_rate} Hz</strong> &bull; 
            Stream FFmpeg: <code>0:a:\${stream.audioIndex}</code>
          </div>
        </div>
      </label>
    \`;

    // Listener para alterar estado no modelo
    const checkbox = trackItem.querySelector('.track-checkbox');
    checkbox.addEventListener('change', (e) => {
      stream.selected = e.target.checked;
      validateAudioSelection();
    });

    audioTracksList.appendChild(trackItem);
  });
}

function validateAudioSelection() {
  const selectedCount = currentVideoData.audio_streams.filter(s => s.selected).length;
  btnConvert.disabled = selectedCount === 0 || isConverting;
  if (selectedCount === 0) {
    appendLog('Atenção: Você desmarcou todas as trilhas. Selecione pelo menos uma.', 'error');
  }
}

btnSelectAllAudio.addEventListener('click', () => {
  if (!currentVideoData) return;
  const allSelected = currentVideoData.audio_streams.every(s => s.selected);
  currentVideoData.audio_streams.forEach(s => s.selected = !allSelected);
  renderAudioTracks(currentVideoData.audio_streams);
  validateAudioSelection();
  btnSelectAllAudio.textContent = allSelected ? 'Marcar Todas' : 'Desmarcar Todas';
});

// ============================================================================
// 5. DRAG-AND-DROP E SELEÇÃO DE ARQUIVOS
// ============================================================================
btnSelectFile.addEventListener('click', async () => {
  if (window.electronAPI) {
    const file = await window.electronAPI.openVideoDialog();
    if (file) handleFileSelection(file.filePath);
  }
});

btnChangeFile.addEventListener('click', async () => {
  if (window.electronAPI) {
    const file = await window.electronAPI.openVideoDialog();
    if (file) handleFileSelection(file.filePath);
  }
});

// Drag & Drop
['dragenter', 'dragover'].forEach(eventName => {
  dropzone.addEventListener(eventName, (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropzone.classList.add('drag-active');
  });
});

['dragleave', 'drop'].forEach(eventName => {
  dropzone.addEventListener(eventName, (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropzone.classList.remove('drag-active');
  });
});

dropzone.addEventListener('drop', (e) => {
  const files = e.dataTransfer.files;
  if (files.length > 0) {
    const file = files[0];
    // No Electron, o objeto File tem a propriedade .path com o caminho absoluto real
    if (file.path) {
      handleFileSelection(file.path);
    }
  }
});

// ============================================================================
// 6. DISPARO DA CONVERSÃO PARA MXF
// ============================================================================
btnConvert.addEventListener('click', async () => {
  if (!currentVideoData || isConverting) return;

  const selectedIndices = currentVideoData.audio_streams
    .filter(s => s.selected)
    .map(s => s.audioIndex);

  if (selectedIndices.length === 0) {
    alert('Por favor, selecione ao menos uma trilha de áudio para incluir no MXF final.');
    return;
  }

  // Abre diálogo de salvar arquivo
  const outputPath = await window.electronAPI.selectOutputDialog(currentVideoData.filename);
  if (!outputPath) {
    appendLog('Conversão cancelada pelo usuário (destino não selecionado).');
    return;
  }

  try {
    isConverting = true;
    btnConvert.disabled = true;
    btnCancel.style.display = 'inline-flex';
    progressSection.style.display = 'block';
    systemStatus.className = 'status-tag processing';
    systemStatus.textContent = 'Convertendo para MXF...';

    appendLog(\`Iniciando transcodificação para MXF...\`);
    appendLog(\`Destino: \${outputPath}\`);
    appendLog(\`Trilhas mapeadas: \${selectedIndices.map(i => '0:a:' + i).join(', ')}\`);
    appendLog(\`Filtro de Áudio: +7dB ganho com Limiter em -12dB (volume=7dB,alimiter=limit=-12dB)\`);

    const result = await window.electronAPI.convertVideo({
      inputPath: currentVideoData.filepath,
      outputPath: outputPath,
      selectedAudioIndices: selectedIndices,
      videoCodec: 'mpeg2video',
      videoBitrate: '50M',
      gainDb: 7,
      limitDb: -12
    });

    if (result.success) {
      progressStatusText.textContent = 'Conversão Concluída com Sucesso!';
      systemStatus.className = 'status-tag ready';
      systemStatus.textContent = 'Concluído';
      appendLog(\`Arquivo salvo com sucesso em: \${result.outputPath}\`, 'success');
      
      const openFolder = confirm('Conversão MXF finalizada com sucesso! Deseja abrir a pasta onde o arquivo foi salvo?');
      if (openFolder) {
        window.electronAPI.openFolder(result.outputPath);
      }
    }

  } catch (err) {
    progressStatusText.textContent = 'Erro durante a conversão';
    systemStatus.className = 'status-tag error';
    systemStatus.textContent = 'Erro';
    appendLog(\`Falha na conversão: \${err.message}\`, 'error');
    alert(\`Erro na conversão: \${err.message}\`);
  } finally {
    isConverting = false;
    btnConvert.disabled = false;
    btnCancel.style.display = 'none';
  }
});

btnCancel.addEventListener('click', async () => {
  if (confirm('Deseja realmente cancelar o processo de conversão atual?')) {
    await window.electronAPI.cancelConversion();
    appendLog('Processo de conversão cancelado pelo usuário.', 'error');
    isConverting = false;
    btnConvert.disabled = false;
    btnCancel.style.display = 'none';
    progressSection.style.display = 'none';
    systemStatus.className = 'status-tag ready';
    systemStatus.textContent = 'Cancelado';
  }
});
`
  },
  {
    name: 'styles.css',
    path: 'styles.css',
    language: 'css',
    description: 'Folha de estilos CSS estilizada para visual dark de suíte de transmissão broadcast profissional.',
    code: `/* ==========================================================================
   MXF AUDIO LEVELER STUDIO - ESTILIZAÇÃO BROADCAST DARK THEME
   ========================================================================== */

:root {
  --bg-dark: #090d16;
  --panel-bg: #111827;
  --card-bg: #182234;
  --border-color: #26354a;
  --text-main: #f3f4f6;
  --text-muted: #9ca3af;
  --accent-cyan: #06b6d4;
  --accent-green: #10b981;
  --accent-red: #ef4444;
  --accent-amber: #f59e0b;
  --primary-blue: #2563eb;
  --primary-hover: #1d4ed8;
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
}

body.app-body {
  background-color: var(--bg-dark);
  color: var(--text-main);
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  overflow-x: hidden;
}

/* HEADER */
.app-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  background-color: var(--panel-bg);
  border-bottom: 1px solid var(--border-color);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 14px;
}

.logo-badge {
  background: linear-gradient(135deg, #0284c7, #2563eb);
  color: white;
  font-weight: 800;
  font-size: 16px;
  letter-spacing: 1px;
  padding: 6px 12px;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
}

.app-title {
  font-size: 18px;
  font-weight: 700;
  color: #ffffff;
}

.app-subtitle {
  font-size: 12px;
  color: var(--text-muted);
}

/* STATUS TAG */
.status-tag {
  font-size: 12px;
  font-weight: 600;
  padding: 4px 12px;
  border-radius: 20px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.status-tag.ready {
  background-color: rgba(16, 185, 129, 0.15);
  color: var(--accent-green);
  border: 1px solid rgba(16, 185, 129, 0.3);
}

.status-tag.processing {
  background-color: rgba(6, 182, 212, 0.15);
  color: var(--accent-cyan);
  border: 1px solid rgba(6, 182, 212, 0.3);
}

.status-tag.error {
  background-color: rgba(239, 68, 68, 0.15);
  color: var(--accent-red);
  border: 1px solid rgba(239, 68, 68, 0.3);
}

/* MAIN LAYOUT */
.app-main {
  display: grid;
  grid-template-columns: 1fr 1.2fr;
  gap: 20px;
  padding: 20px 24px;
  flex: 1;
}

@media (max-width: 992px) {
  .app-main {
    grid-template-columns: 1fr;
  }
}

.panel {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* CARDS */
.card {
  background-color: var(--panel-bg);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 18px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14px;
}

.card-header h2 {
  font-size: 15px;
  font-weight: 600;
  color: #f9fafb;
}

.section-desc {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 2px;
}

/* DROPZONE */
.dropzone-card {
  border: 2px dashed var(--border-color);
  text-align: center;
  transition: all 0.2s ease;
  cursor: pointer;
}

.dropzone-card:hover, .dropzone-card.drag-active {
  border-color: var(--accent-cyan);
  background-color: rgba(6, 182, 212, 0.05);
}

.icon-upload {
  width: 44px;
  height: 44px;
  color: var(--accent-cyan);
  margin-bottom: 10px;
}

.dropzone-content h3 {
  font-size: 15px;
  margin-bottom: 6px;
}

.dropzone-content p {
  font-size: 12px;
  color: var(--text-muted);
  margin-bottom: 14px;
}

.file-loaded-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.file-badge {
  font-size: 10px;
  background-color: rgba(16, 185, 129, 0.2);
  color: var(--accent-green);
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 4px;
}

.file-name {
  font-size: 15px;
  font-weight: 600;
  word-break: break-all;
}

.file-meta {
  font-size: 12px;
  color: var(--text-muted);
  margin-bottom: 8px;
}

/* VIDEO PREVIEW */
.video-container {
  width: 100%;
  height: 240px;
  background-color: #000;
  border-radius: 8px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

video {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.fallback-preview {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 20px;
  color: var(--text-muted);
}

.fallback-preview small {
  margin-top: 6px;
  color: var(--accent-cyan);
}

/* AUDIO TRACKS */
.audio-tracks-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 220px;
  overflow-y: auto;
}

.audio-track-item {
  background-color: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 10px 14px;
  transition: border-color 0.2s;
}

.audio-track-item:hover {
  border-color: #3b82f6;
}

.track-label {
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  width: 100%;
}

.track-checkbox {
  width: 18px;
  height: 18px;
  accent-color: var(--primary-blue);
  cursor: pointer;
}

.track-info {
  flex: 1;
}

.track-title {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
}

.track-badge {
  font-size: 10px;
  background-color: #1e293b;
  padding: 2px 6px;
  border-radius: 4px;
  color: var(--accent-cyan);
}

.track-meta {
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 2px;
}

.empty-state {
  text-align: center;
  color: var(--text-muted);
  font-size: 13px;
  padding: 24px;
}

/* FILTER SPECS */
.filter-boxes-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1.5fr;
  gap: 10px;
}

.filter-box {
  background-color: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.filter-label {
  font-size: 11px;
  color: var(--text-muted);
}

.filter-val {
  font-size: 16px;
  font-weight: 700;
}

.highlight-green { color: var(--accent-green); }
.highlight-cyan { color: var(--accent-cyan); }

.filter-desc {
  font-size: 10px;
  color: #6b7280;
}

.filter-code {
  font-size: 10px;
  background-color: #0d131f;
  padding: 6px;
  border-radius: 4px;
  color: #38bdf8;
  word-break: break-all;
}

/* BUTTONS */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  padding: 8px 16px;
  border-radius: 6px;
  border: none;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-primary { background-color: var(--primary-blue); color: white; }
.btn-primary:hover { background-color: var(--primary-hover); }

.btn-success { background-color: #059669; color: white; width: 100%; }
.btn-success:hover:not(:disabled) { background-color: #047857; }
.btn-success:disabled { opacity: 0.5; cursor: not-allowed; }

.btn-danger { background-color: var(--accent-red); color: white; }
.btn-danger:hover { background-color: #dc2626; }

.btn-outline { background: transparent; border: 1px solid var(--border-color); color: var(--text-main); }
.btn-ghost { background: transparent; color: var(--text-muted); padding: 4px 8px; }
.btn-ghost:hover { color: white; }
.btn-sm { font-size: 11px; padding: 4px 10px; }
.btn-xs { font-size: 10px; padding: 2px 6px; }
.btn-lg { font-size: 15px; padding: 12px 20px; }

/* PROGRESS */
.progress-section {
  margin-top: 14px;
}

.progress-header {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  margin-bottom: 6px;
}

.progress-bar-bg {
  height: 8px;
  background-color: #1f293d;
  border-radius: 4px;
  overflow: hidden;
}

.progress-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #06b6d4, #10b981);
  transition: width 0.2s ease;
}

.progress-stats {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 6px;
}

/* TERMINAL */
.terminal-container {
  margin-top: 16px;
  background-color: #090d16;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  overflow: hidden;
}

.terminal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background-color: #121927;
  padding: 6px 12px;
  font-size: 11px;
  color: var(--text-muted);
  border-bottom: 1px solid var(--border-color);
}

.terminal-body {
  height: 140px;
  overflow-y: auto;
  padding: 10px;
  font-family: "Courier New", Courier, monospace;
  font-size: 11px;
  line-height: 1.4;
}

.terminal-line { color: #d1d5db; word-break: break-all; }
.text-error { color: #f87171; }
.text-success { color: #34d399; }
.text-accent { color: #38bdf8; }
.text-muted { color: #6b7280; }

.badge {
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 4px;
}
.badge-accent { background-color: rgba(6, 182, 212, 0.2); color: var(--accent-cyan); }
.badge-success { background-color: rgba(16, 185, 129, 0.2); color: var(--accent-green); }
.badge-warning { background-color: rgba(245, 158, 11, 0.2); color: var(--accent-amber); }
`
  },
  {
    name: 'README.md',
    path: 'README.md',
    language: 'markdown',
    description: 'Guia completo de instalação do FFmpeg, execução local, empacotamento com electron-builder e detalhes dos filtros de áudio.',
    code: `# MXF Audio Leveler Studio (Electron + FFmpeg)

Aplicativo Desktop profissional para conversão e processamento de vídeo para o formato broadcast **.MXF** (SMPTE OP-1a), com inspeção detalhada de trilhas/canais de áudio (via ffprobe) e aplicação de filtro de nivelamento acústico estrito (**+7 dB de ganho** de entrada seguido de **limiter rígido em -12 dB**).

---

## 🚀 1. Como Instalar e Rodar Localmente

### Pré-requisitos
- **Node.js**: Versão 18 ou superior ([nodejs.org](https://nodejs.org))
- **npm** ou **yarn**

### Passo a Passo

\`\`\`bash
# 1. Instalar as dependências do projeto
npm install

# 2. Iniciar o aplicativo em modo de desenvolvimento
npm start
\`\`\`

---

## 📦 2. Como Funciona a Instalação e Embarque do FFmpeg

O projeto utiliza os pacotes **\`ffmpeg-static\`** e **\`ffprobe-static\`**, que baixam automaticamente os binários pré-compilados específicos para o seu sistema operacional (Windows x64, macOS Apple Silicon/Intel, Linux).

### Como o código localiza os binários em Desenvolvimento e Produção (\`main.js\`):

\`\`\`javascript
const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');
const ffprobeStatic = require('ffprobe-static');

// Trata caminhos empacotados com ASAR no Electron
function getBinaryPath(binaryPath) {
  if (!binaryPath) return null;
  return binaryPath.replace('app.asar', 'app.asar.unpacked');
}

ffmpeg.setFfmpegPath(getBinaryPath(ffmpegStatic));
ffmpeg.setFfprobePath(getBinaryPath(ffprobeStatic.path));
\`\`\`

### Configuração no \`package.json\` para Empacotamento (\`asarUnpack\`):
Para que o Electron consiga executar os binários após o instalador ser gerado, eles **NÃO podem ficar comprimidos dentro do arquivo \`app.asar\`**. O \`package.json\` já inclui:

\`\`\`json
"build": {
  "asarUnpack": [
    "**/node_modules/ffmpeg-static/**/*",
    "**/node_modules/ffprobe-static/**/*"
  ]
}
\`\`\`

---

## 🎛️ 3. O Filtro de Áudio: +7dB com Limiter em -12dB

A regra solicitada exige:
1. **Ganho de entrada**: aumento de volume de +7 dB.
2. **Pico máximo / Limiter**: corte rápido sem distorção em -12 dB True Peak.

### Argumento FFmpeg Utilizado:
\`\`\`bash
-af "volume=7dB,alimiter=limit=-12dB:attack=5:release=50:asc=0"
\`\`\`

- **\`volume=7dB\`**: Adiciona ganho linear de 7 decibéis ao stream de áudio.
- **\`alimiter\`**: Limitador lookahead com curva suave de joelho.
  - **\`limit=-12dB\`**: Teto rígido em decibéis. Qualquer sinal que ultrapassaria -12 dB é atenuado instantaneamente.
  - **\`attack=5\`**: Tempo de resposta de 5 milissegundos para capturar transientes sonoros imediatos.
  - **\`release=50\`**: Tempo de recuperação de 50 milissegundos para evitar efeitos de bombeamento (*pumping*).
  - **\`asc=0\`**: Desativa o ganho automático secundário (*auto scale*), mantendo a integridade absoluta do teto em -12dB.

---

## 🎬 4. Mapeamento de Canais com \`-map\`

Ao selecionar as trilhas na interface, o FFmpeg monta dinamicamente o comando:

\`\`\`bash
ffmpeg -i input.mp4 \\
  -map 0:v:0 \\
  -map 0:a:0 \\
  -map 0:a:1 \\
  -af "volume=7dB,alimiter=limit=-12dB:attack=5:release=50:asc=0" \\
  -c:v mpeg2video -b:v 50M -pix_fmt yuv422p \\
  -c:a pcm_s24le -ar 48000 \\
  -f mxf output.mxf
\`\`\`

---

## 🏗️ 5. Gerando Instaladores para Produção

\`\`\`bash
# Gerar instalador para Windows (.exe / installer NSIS)
npm run dist:win

# Gerar instalador para macOS (.dmg / .zip)
npm run dist:mac

# Gerar pacote para Linux (.AppImage / .tar.gz)
npm run dist:linux
\`\`\`
`
  }
];
