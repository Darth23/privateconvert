import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockFFmpeg = {
  loaded: true,
  on: vi.fn(),
  load: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
  deleteFile: vi.fn().mockResolvedValue(undefined),
  exec: vi.fn().mockResolvedValue(undefined),
};

vi.mock('@ffmpeg/ffmpeg', () => ({
  FFmpeg: vi.fn(() => mockFFmpeg),
}));

vi.mock('@ffmpeg/util', () => ({
  toBlobURL: vi.fn().mockResolvedValue('blob:url'),
  fetchFile: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
}));

describe('ffmpegProcessor', () => {
  let initFFmpeg: any;
  let convertAudio: any;
  let convertVideo: any;
  let extractAudio: any;
  let getMediaDuration: any;
  let isFFmpegLoaded: any;
  let ffmpegModule: any;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();

    mockFFmpeg.loaded = true;
    mockFFmpeg.exec.mockResolvedValue(undefined);
    mockFFmpeg.readFile.mockResolvedValue(new Uint8Array([1, 2, 3]));

    ffmpegModule = await import('./ffmpegProcessor');
    initFFmpeg = ffmpegModule.initFFmpeg;
    convertAudio = ffmpegModule.convertAudio;
    convertVideo = ffmpegModule.convertVideo;
    extractAudio = ffmpegModule.extractAudio;
    getMediaDuration = ffmpegModule.getMediaDuration;
    isFFmpegLoaded = ffmpegModule.isFFmpegLoaded;

    await initFFmpeg();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initFFmpeg', () => {
    it('returns immediately if FFmpeg is already loaded', async () => {
      await expect(initFFmpeg()).resolves.toBeUndefined();
    });

    it('prevents duplicate initialization', async () => {
      const promise1 = initFFmpeg();
      const promise2 = initFFmpeg();
      await expect(promise1).resolves.toBeUndefined();
      await expect(promise2).resolves.toBeUndefined();
    });
  });

  describe('convertAudio', () => {
    it('converts audio to mp3', async () => {
      const file = new Blob(['audio data'], { type: 'audio/wav' }) as File;
      Object.defineProperty(file, 'size', { value: 1000 });
      Object.defineProperty(file, 'type', { value: 'audio/wav' });

      const result = await convertAudio(file, 'mp3', { bitrate: '192k' });

      expect(mockFFmpeg.writeFile).toHaveBeenCalled();
      expect(mockFFmpeg.exec).toHaveBeenCalled();
      expect(mockFFmpeg.readFile).toHaveBeenCalled();
      expect(result).toBeInstanceOf(Blob);
      expect(result.type).toBe('audio/mp3');
    });

    it('converts audio to wav', async () => {
      const file = new Blob(['audio data'], { type: 'audio/mp3' }) as File;
      Object.defineProperty(file, 'size', { value: 1000 });
      Object.defineProperty(file, 'type', { value: 'audio/mp3' });

      const result = await convertAudio(file, 'wav', { sampleRate: 44100 });

      expect(mockFFmpeg.exec).toHaveBeenCalled();
      expect(result.type).toBe('audio/wav');
    });

    it('converts audio to aac', async () => {
      const file = new Blob(['audio data'], { type: 'audio/mp3' }) as File;
      Object.defineProperty(file, 'size', { value: 1000 });
      Object.defineProperty(file, 'type', { value: 'audio/mp3' });

      const result = await convertAudio(file, 'aac', { bitrate: '128k' });

      expect(result.type).toBe('audio/aac');
    });

    it('cleans up temp files after conversion', async () => {
      const file = new Blob(['audio data'], { type: 'audio/wav' }) as File;
      Object.defineProperty(file, 'size', { value: 1000 });
      Object.defineProperty(file, 'type', { value: 'audio/wav' });

      await convertAudio(file, 'mp3');

      expect(mockFFmpeg.deleteFile).toHaveBeenCalledTimes(2);
    });

    it('throws error on conversion failure', async () => {
      mockFFmpeg.exec.mockRejectedValue(new Error('FFmpeg error'));

      const file = new Blob(['audio data'], { type: 'audio/wav' }) as File;
      Object.defineProperty(file, 'size', { value: 1000 });
      Object.defineProperty(file, 'type', { value: 'audio/wav' });

      await expect(convertAudio(file, 'mp3')).rejects.toThrow('Audio conversion failed');
    });
  });

  describe('convertVideo', () => {
    it('converts video to mp4', async () => {
      const file = new Blob(['video data'], { type: 'video/webm' }) as File;
      Object.defineProperty(file, 'size', { value: 5000 });
      Object.defineProperty(file, 'type', { value: 'video/webm' });

      const result = await convertVideo(file, 'mp4', {
        resolution: '720p',
        bitrate: '2000k',
      });

      expect(mockFFmpeg.writeFile).toHaveBeenCalled();
      expect(mockFFmpeg.exec).toHaveBeenCalled();
      expect(result.type).toBe('video/mp4');
    });

    it('converts video to webm', async () => {
      const file = new Blob(['video data'], { type: 'video/mp4' }) as File;
      Object.defineProperty(file, 'size', { value: 5000 });
      Object.defineProperty(file, 'type', { value: 'video/mp4' });

      const result = await convertVideo(file, 'webm', { resolution: '1080p' });

      expect(result.type).toBe('video/webm');
    });

    it('converts video to mkv', async () => {
      const file = new Blob(['video data'], { type: 'video/mp4' }) as File;
      Object.defineProperty(file, 'size', { value: 5000 });
      Object.defineProperty(file, 'type', { value: 'video/mp4' });

      const result = await convertVideo(file, 'mkv');

      expect(result.type).toBe('video/x-matroska');
    });

    it('sets FPS when provided', async () => {
      const file = new Blob(['video data'], { type: 'video/mp4' }) as File;
      Object.defineProperty(file, 'size', { value: 5000 });
      Object.defineProperty(file, 'type', { value: 'video/mp4' });

      await convertVideo(file, 'mp4', { fps: 30 });

      const execCall = mockFFmpeg.exec.mock.calls[0][0];
      expect(execCall).toContain('-r');
      expect(execCall).toContain('30');
    });

    it('throws error on conversion failure', async () => {
      mockFFmpeg.exec.mockRejectedValue(new Error('FFmpeg error'));

      const file = new Blob(['video data'], { type: 'video/mp4' }) as File;
      Object.defineProperty(file, 'size', { value: 5000 });
      Object.defineProperty(file, 'type', { value: 'video/mp4' });

      await expect(convertVideo(file, 'mp4')).rejects.toThrow('Video conversion failed');
    });
  });

  describe('extractAudio', () => {
    it('extracts audio with mp3 codec', async () => {
      const file = new Blob(['video data'], { type: 'video/mp4' }) as File;
      Object.defineProperty(file, 'size', { value: 5000 });
      Object.defineProperty(file, 'type', { value: 'video/mp4' });

      const result = await extractAudio(file, 'mp3', { bitrate: '192k' });

      const execCall = mockFFmpeg.exec.mock.calls[0][0];
      expect(execCall).toContain('-acodec');
      expect(execCall).toContain('libmp3lame');
      expect(result.type).toBe('audio/mp3');
    });

    it('extracts audio with wav codec', async () => {
      const file = new Blob(['video data'], { type: 'video/mp4' }) as File;
      Object.defineProperty(file, 'size', { value: 5000 });
      Object.defineProperty(file, 'type', { value: 'video/mp4' });

      const result = await extractAudio(file, 'wav');

      const execCall = mockFFmpeg.exec.mock.calls[0][0];
      expect(execCall).toContain('-acodec');
      expect(execCall).toContain('pcm_s16le');
      expect(result.type).toBe('audio/wav');
    });

    it('extracts audio with aac codec', async () => {
      const file = new Blob(['video data'], { type: 'video/mp4' }) as File;
      Object.defineProperty(file, 'size', { value: 5000 });
      Object.defineProperty(file, 'type', { value: 'video/mp4' });

      const result = await extractAudio(file, 'aac');

      const execCall = mockFFmpeg.exec.mock.calls[0][0];
      expect(execCall).toContain('-acodec');
      expect(execCall).toContain('aac');
      expect(result.type).toBe('audio/aac');
    });

    it('uses -vn flag to remove video', async () => {
      const file = new Blob(['video data'], { type: 'video/mp4' }) as File;
      Object.defineProperty(file, 'size', { value: 5000 });
      Object.defineProperty(file, 'type', { value: 'video/mp4' });

      await extractAudio(file, 'mp3');

      const execCall = mockFFmpeg.exec.mock.calls[0][0];
      expect(execCall).toContain('-vn');
    });

    it('cleans up temp files', async () => {
      const file = new Blob(['video data'], { type: 'video/mp4' }) as File;
      Object.defineProperty(file, 'size', { value: 5000 });
      Object.defineProperty(file, 'type', { value: 'video/mp4' });

      await extractAudio(file, 'mp3');

      expect(mockFFmpeg.deleteFile).toHaveBeenCalledTimes(2);
    });

    it('throws error on extraction failure', async () => {
      mockFFmpeg.exec.mockRejectedValue(new Error('FFmpeg error'));

      const file = new Blob(['video data'], { type: 'video/mp4' }) as File;
      Object.defineProperty(file, 'size', { value: 5000 });
      Object.defineProperty(file, 'type', { value: 'video/mp4' });

      await expect(extractAudio(file, 'mp3')).rejects.toThrow('Audio extraction failed');
    });
  });

  describe('getMediaDuration', () => {
    it('parses duration from FFmpeg log output', async () => {
      const file = new Blob(['video data'], { type: 'video/mp4' }) as File;
      Object.defineProperty(file, 'size', { value: 5000 });
      Object.defineProperty(file, 'type', { value: 'video/mp4' });

      let logCallback: any;
      mockFFmpeg.on.mockImplementation((event: string, cb: any) => {
        if (event === 'log') {
          logCallback = cb;
          cb({ message: 'Input #0, mov,mp4,m4a,3gp,3g2,mj2:\n  Duration: 00:02:30.50, start: 0.000000' });
        }
      });

      const duration = await getMediaDuration(file);
      expect(duration).toBe(150.5);
    });

    it('returns 0 when duration cannot be parsed', async () => {
      const file = new Blob(['video data'], { type: 'video/mp4' }) as File;
      Object.defineProperty(file, 'size', { value: 5000 });
      Object.defineProperty(file, 'type', { value: 'video/mp4' });

      let logCallback: any;
      mockFFmpeg.on.mockImplementation((event: string, cb: any) => {
        if (event === 'log') logCallback = cb;
      });

      const durationPromise = getMediaDuration(file);

      if (logCallback) {
        logCallback({ message: 'No duration info here' });
      }

      const duration = await durationPromise;
      expect(duration).toBe(0);
    });

    it('returns 0 on error', async () => {
      mockFFmpeg.exec.mockRejectedValue(new Error('FFmpeg error'));

      const file = new Blob(['video data'], { type: 'video/mp4' }) as File;
      Object.defineProperty(file, 'size', { value: 5000 });
      Object.defineProperty(file, 'type', { value: 'video/mp4' });

      const duration = await getMediaDuration(file);
      expect(duration).toBe(0);
    });

    it('cleans up temp file', async () => {
      const file = new Blob(['video data'], { type: 'video/mp4' }) as File;
      Object.defineProperty(file, 'size', { value: 5000 });
      Object.defineProperty(file, 'type', { value: 'video/mp4' });

      await getMediaDuration(file);

      expect(mockFFmpeg.deleteFile).toHaveBeenCalled();
    });
  });

  describe('isFFmpegLoaded', () => {
    it('returns true when FFmpeg is loaded', () => {
      expect(isFFmpegLoaded()).toBe(true);
    });
  });
});
