import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL, fetchFile } from '@ffmpeg/util';
import { validateAudioType, validateVideoType, withTimeout } from './validation';

let ffmpeg: FFmpeg | null = null;
let isInitializing = false;
let initPromise: Promise<void> | null = null;

/**
 * Initialize FFmpeg instance
 */
const CDN_SOURCES = [
  'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm',
  'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm',
  'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm',
];

export async function initFFmpeg(): Promise<void> {
  if ((ffmpeg as any)?.loaded) {
    return;
  }

  if (isInitializing && initPromise) {
    return initPromise;
  }

  isInitializing = true;

  initPromise = (async () => {
    try {
      ffmpeg = new FFmpeg();

      (ffmpeg as any).on('log', ({ type, message }: any) => {
        if (type === 'error') {
          console.error('[FFmpeg]', message);
        }
      });

      (ffmpeg as any).on('progress', ({ progress }: any) => {
        console.log(`[FFmpeg] Progress: ${(progress * 100).toFixed(2)}%`);
      });

      let lastError: Error | null = null;

      for (const baseURL of CDN_SOURCES) {
        try {
          await (ffmpeg as any).load({
            coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
            wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
          });
          return;
        } catch (err) {
          lastError = err as Error;
          console.warn(`FFmpeg CDN failed: ${baseURL}`, err);
        }
      }

      throw lastError ?? new Error('All FFmpeg CDN sources failed');
    } catch (error) {
      console.error('FFmpeg initialization failed:', error);
      throw error;
    } finally {
      isInitializing = false;
    }
  })();

  return initPromise;
}

/**
 * Get FFmpeg instance
 */
function getFFmpeg(): FFmpeg {
  if (!ffmpeg) {
    throw new Error('FFmpeg not initialized. Call initFFmpeg first.');
  }
  return ffmpeg;
}

export interface AudioConversionOptions {
  bitrate?: string;
  sampleRate?: number;
  onProgress?: (progress: number) => void;
}

export interface VideoConversionOptions {
  resolution?: '480p' | '720p' | '1080p';
  bitrate?: string;
  fps?: number;
  fastMode?: boolean;
  onProgress?: (progress: number) => void;
}

/**
 * Convert audio file
 */
export async function convertAudio(
  file: File,
  outputFormat: 'mp3' | 'wav' | 'aac',
  options: AudioConversionOptions = {}
): Promise<Blob> {
  const mimeValidation = validateAudioType(file);
  if (!mimeValidation.valid) {
    throw new Error(mimeValidation.error);
  }

  const ffmpeg = getFFmpeg();

  const inputName = `input_${Date.now()}.${file.type.split('/')[1]}`;
  const outputName = `output_${Date.now()}.${outputFormat}`;

  try {
    return await withTimeout((async () => {
    await (ffmpeg as any).writeFile(inputName, await fetchFile(file));

    const cmd: string[] = ['-i', inputName];

    if (options.bitrate) {
      cmd.push('-b:a', options.bitrate);
    }

    if (options.sampleRate) {
      cmd.push('-ar', options.sampleRate.toString());
    }

    cmd.push(outputName);

    const progressHandler = options.onProgress
      ? ({ progress }: any) => options.onProgress!(Math.min(progress * 100, 100))
      : null;

    if (progressHandler) {
      (ffmpeg as any).on('progress', progressHandler);
    }

    try {
      await (ffmpeg as any).exec(cmd);
    } finally {
      if (progressHandler) {
        (ffmpeg as any).off('progress', progressHandler);
      }
    }

    const data = await (ffmpeg as any).readFile(outputName);

    const dataArray = typeof data === 'string' ? new TextEncoder().encode(data) : data;
    return new Blob([dataArray], { type: `audio/${outputFormat}` });
    })());
  } catch (error) {
    throw new Error(`Audio conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  } finally {
    await (ffmpeg as any).deleteFile(inputName);
    await (ffmpeg as any).deleteFile(outputName);
  }
}

/**
 * Convert video file
 */
export async function convertVideo(
  file: File,
  outputFormat: 'mp4' | 'webm' | 'mkv' | 'ts',
  options: VideoConversionOptions = {}
): Promise<Blob> {
  const mimeValidation = validateVideoType(file);
  if (!mimeValidation.valid) {
    throw new Error(mimeValidation.error);
  }

  const ffmpeg = getFFmpeg();

  const inputName = `input_${Date.now()}.${file.type.split('/')[1]}`;
  const outputName = `output_${Date.now()}.${outputFormat}`;

  try {
    return await withTimeout((async () => {
    await (ffmpeg as any).writeFile(inputName, await fetchFile(file));

    const cmd: string[] = ['-i', inputName];

    if (options.resolution) {
      const resolutionMap: Record<string, string> = {
        '480p': '854:480',
        '720p': '1280:720',
        '1080p': '1920:1080',
      };
      cmd.push('-vf', `scale=${resolutionMap[options.resolution]}`);
    }

    if (options.bitrate) {
      cmd.push('-b:v', options.bitrate);
    }

    if (options.fps) {
      cmd.push('-r', options.fps.toString());
    }

    if (outputFormat === 'mp4') {
      cmd.push('-c:v', 'libx264', '-c:a', 'aac');
      if (options.fastMode) {
        cmd.push('-preset', 'ultrafast');
      }
    } else if (outputFormat === 'webm') {
      cmd.push('-c:v', 'libvpx-vp9', '-c:a', 'libopus');
      if (options.fastMode) {
        cmd.push('-cpu-used', '8', '-deadline', 'realtime');
      }
    } else if (outputFormat === 'ts') {
      cmd.push('-c:v', 'libx264', '-c:a', 'aac', '-f', 'mpegts');
      if (options.fastMode) {
        cmd.push('-preset', 'ultrafast');
      }
    }

    cmd.push(outputName);

    const progressHandler = options.onProgress
      ? ({ progress }: any) => options.onProgress!(Math.min(progress * 100, 100))
      : null;

    if (progressHandler) {
      (ffmpeg as any).on('progress', progressHandler);
    }

    try {
      await (ffmpeg as any).exec(cmd);
    } finally {
      if (progressHandler) {
        (ffmpeg as any).off('progress', progressHandler);
      }
    }

    const data = await (ffmpeg as any).readFile(outputName);

    const mimeType = {
      mp4: 'video/mp4',
      webm: 'video/webm',
      mkv: 'video/x-matroska',
      ts: 'video/MP2T',
    }[outputFormat];

    const dataArray = typeof data === 'string' ? new TextEncoder().encode(data) : data;
    return new Blob([dataArray], { type: mimeType });
    })());
  } catch (error) {
    throw new Error(`Video conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  } finally {
    await (ffmpeg as any).deleteFile(inputName);
    await (ffmpeg as any).deleteFile(outputName);
  }
}

/**
 * Extract audio from video
 */
export async function extractAudio(
  file: File,
  outputFormat: 'mp3' | 'wav' | 'aac',
  options: AudioConversionOptions = {}
): Promise<Blob> {
  const mimeValidation = validateVideoType(file);
  if (!mimeValidation.valid) {
    throw new Error(mimeValidation.error);
  }

  const ffmpeg = getFFmpeg();

  const inputName = `input_${Date.now()}.${file.type.split('/')[1]}`;
  const outputName = `output_${Date.now()}.${outputFormat}`;

  try {
    return await withTimeout((async () => {
    await (ffmpeg as any).writeFile(inputName, await fetchFile(file));

    const codecMap: Record<'mp3' | 'wav' | 'aac', string> = {
      'mp3': 'libmp3lame',
      'wav': 'pcm_s16le',
      'aac': 'aac',
    };

    const cmd: string[] = ['-i', inputName, '-vn', '-acodec', codecMap[outputFormat]];

    if (options.bitrate) {
      cmd.push('-b:a', options.bitrate);
    }

    if (options.sampleRate) {
      cmd.push('-ar', options.sampleRate.toString());
    }

    cmd.push(outputName);

    const progressHandler = options.onProgress
      ? ({ progress }: any) => options.onProgress!(Math.min(progress * 100, 100))
      : null;

    if (progressHandler) {
      (ffmpeg as any).on('progress', progressHandler);
    }

    try {
      await (ffmpeg as any).exec(cmd);
    } finally {
      if (progressHandler) {
        (ffmpeg as any).off('progress', progressHandler);
      }
    }

    const data = await (ffmpeg as any).readFile(outputName);

    const dataArray = typeof data === 'string' ? new TextEncoder().encode(data) : data;
    return new Blob([dataArray], { type: `audio/${outputFormat}` });
    })());
  } catch (error) {
    throw new Error(`Audio extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  } finally {
    await (ffmpeg as any).deleteFile(inputName);
    await (ffmpeg as any).deleteFile(outputName);
  }
}

/**
 * Get video/audio duration
 */
export async function getMediaDuration(file: File): Promise<number> {
  const ffmpeg = getFFmpeg();

  const inputName = `input_${Date.now()}.${file.type.split('/')[1]}`;

  try {
    await (ffmpeg as any).writeFile(inputName, await fetchFile(file));

    let output = '';
    (ffmpeg as any).on('log', ({ message }: any) => {
      output += message;
    });

    await (ffmpeg as any).exec(['-i', inputName]);

    const match = output.match(/Duration: (\d+):(\d+):(\d+\.\d+)/);
    if (match) {
      const hours = parseInt(match[1], 10);
      const minutes = parseInt(match[2], 10);
      const seconds = parseFloat(match[3]);
      return hours * 3600 + minutes * 60 + seconds;
    }

    return 0;
  } catch (error) {
    console.error('Failed to get media duration:', error);
    return 0;
  } finally {
    await (ffmpeg as any).deleteFile(inputName);
  }
}

/**
 * Check if FFmpeg is loaded
 */
export function isFFmpegLoaded(): boolean {
  return (ffmpeg as any)?.loaded ?? false;
}
