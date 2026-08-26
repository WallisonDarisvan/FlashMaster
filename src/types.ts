export interface AudioStreamInfo {
  index: number;
  streamIndex: number;
  codec_name: string;
  codec_long_name: string;
  channels: number;
  channel_layout: string;
  sample_rate: number;
  bit_rate?: number;
  bits_per_sample?: number;
  language?: string;
  title?: string;
  selected: boolean;
  rms_db?: number;
  peak_db?: number;
}

export interface AudioChannelInfo {
  id: string; // Identificador único: "${streamIndex}:${channelIndex}"
  streamIndex: number;
  channelIndex: number;
  channelNumber: number;
  label: string; // Ex: "Canal 1: Esquerdo (L)"
  layoutName: string; // Ex: "Esquerdo (L)" ou "Direito (R)"
  codec_name: string;
  sample_rate: number;
  bit_rate?: number;
  bits_per_sample?: number;
  selected: boolean;
  sourceChannelId?: string; // ID do canal de onde este canal puxa o áudio (ex: "0:0" ou "0:1")
}

export interface VideoMetadata {
  filename: string;
  filepath?: string;
  filesize: number;
  format_name: string;
  format_long_name: string;
  duration: number;
  bit_rate: number;
  video_codec: string;
  width: number;
  height: number;
  fps: number;
  aspect_ratio: string;
  pixel_format: string;
  audio_streams: AudioStreamInfo[];
  audio_channels?: AudioChannelInfo[];
  video_stream_index: number;
  isChromiumCompatible: boolean;
  sampleUrl?: string;
}

export interface ConversionConfig {
  videoCodec: 'mpeg2video' | 'dnxhd' | 'prores' | 'copy';
  videoBitrate: string; // e.g. '50M'
  pixelFormat: string; // e.g. 'yuv422p'
  audioCodec: 'pcm_s24le' | 'pcm_s16le';
  audioSampleRate: number; // 48000
  gainDb: number; // 7
  limitDb: number; // -12
  attackMs: number; // 5
  releaseMs: number; // 50
  outputContainer: 'mxf' | 'mxf_d10';
  customFfmpegArgs?: string;
}

export interface ConversionProgress {
  status: 'idle' | 'probing' | 'converting' | 'completed' | 'error';
  percent: number;
  currentFrame: number;
  totalFrames: number;
  fps: number;
  speed: string;
  currentTime: number;
  totalTime: number;
  bitrate: string;
  logs: string[];
  outputFilename?: string;
  errorMessage?: string;
}

export interface ElectronCodeFile {
  name: string;
  path: string;
  language: 'javascript' | 'json' | 'html' | 'css' | 'markdown';
  description: string;
  code: string;
}

export interface ElectronAPI {
  isElectron?: boolean;
  openVideoDialog: () => Promise<{ filePath: string; fileName: string } | null>;
  selectOutputDialog: (defaultName?: string) => Promise<string | null>;
  openFolder: (folderPath: string) => Promise<boolean>;
  probeVideo: (filePath: string) => Promise<VideoMetadata>;
  getChannelWaveform?: (options: {
    filePath: string;
    streamIndex: number;
    channelIndex: number;
    numBars?: number;
  }) => Promise<number[]>;
  convertVideo: (options: {
    inputPath: string;
    outputPath: string;
    selectedAudioIndices?: number[];
    selectedChannels?: { id: string; streamIndex: number; channelIndex: number; selected: boolean; sourceChannelId?: string }[];
    videoCodec?: string;
    videoBitrate?: string;
    pixelFormat?: string;
    gainDb?: number;
    limitDb?: number;
  }) => Promise<{ success: boolean; outputPath: string }>;
  cancelConversion: () => Promise<boolean>;
  onProgress: (callback: (progress: {
    percent: number;
    frames: number;
    currentFps: number;
    currentKbps: number;
    targetSize: number;
    timemark: string;
  }) => void) => () => void;
  onLog: (callback: (logLine: string) => void) => () => void;
  onToggleLogs?: (callback: () => void) => () => void;
  onOpenAudioSettings?: (callback: () => void) => () => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

