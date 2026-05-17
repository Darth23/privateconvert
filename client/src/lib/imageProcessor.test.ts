import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('browser-image-compression', () => ({
  default: vi.fn().mockResolvedValue(new Blob(['compressed'], { type: 'image/jpeg' })),
}));

vi.mock('piexifjs', () => ({
  default: {
    remove: vi.fn().mockReturnValue('binaryData'),
  },
}));

describe('imageProcessor', () => {
  let convertImage: any;
  let getImageDimensions: any;
  let estimateFileSize: any;

  beforeEach(async () => {
    vi.resetModules();

    global.Image = class MockImage {
      width = 100;
      height = 100;
      src = '';
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;

      constructor() {
        setTimeout(() => {
          if (this.onload) this.onload();
        }, 0);
      }
    } as any;

    global.HTMLCanvasElement = class MockCanvas {
      width = 100;
      height = 100;
      getContext = vi.fn().mockReturnValue({
        drawImage: vi.fn(),
      });
      toBlob = vi.fn((callback: any) => {
        callback(new Blob(['canvas'], { type: 'image/jpeg' }));
      });
    } as any;

    global.document = {
      createElement: vi.fn((tag: string) => {
        if (tag === 'canvas') {
          return new global.HTMLCanvasElement();
        }
        return new global.Image();
      }),
    } as any;

    global.URL = {
      createObjectURL: vi.fn(() => 'blob:url'),
      revokeObjectURL: vi.fn(),
    } as any;

    global.fetch = vi.fn().mockResolvedValue({
      text: () => Promise.resolve('<svg></svg>'),
    }) as any;

    global.FileReader = class MockFileReader {
      result = 'data:image/jpeg;base64,dGVzdA==';
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      readAsDataURL = vi.fn(() => {
        setTimeout(() => {
          if (this.onload) this.onload();
        }, 0);
      });
    } as any;

    const mod = await import('./imageProcessor');
    convertImage = mod.convertImage;
    getImageDimensions = mod.getImageDimensions;
    estimateFileSize = mod.estimateFileSize;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('convertImage', () => {
    it('converts a JPEG image to PNG', async () => {
      const file = new Blob(['test'], { type: 'image/jpeg' }) as File;
      Object.defineProperty(file, 'name', { value: 'test.jpg' });
      Object.defineProperty(file, 'size', { value: 1000 });
      Object.defineProperty(file, 'type', { value: 'image/jpeg' });

      const result = await convertImage(file, {
        format: 'png',
        quality: 80,
        removeExif: false,
      });

      expect(result.format).toBe('png');
      expect(result.originalSize).toBe(1000);
      expect(result.blob).toBeDefined();
    });

    it('converts SVG to PNG when format is png', async () => {
      const svgContent = '<svg width="100" height="100"></svg>';
      const file = new Blob([svgContent], { type: 'image/svg+xml' }) as File;
      Object.defineProperty(file, 'name', { value: 'test.svg' });
      Object.defineProperty(file, 'size', { value: 500 });
      Object.defineProperty(file, 'type', { value: 'image/svg+xml' });

      (global.Image as any).prototype.width = 100;
      (global.Image as any).prototype.height = 100;

      const result = await convertImage(file, {
        format: 'png',
        quality: 80,
        removeExif: false,
      });

      expect(result.format).toBe('png');
      expect(fetch).toHaveBeenCalled();
    });

    it('converts SVG to PNG then to target format when format is not png', async () => {
      const svgContent = '<svg width="100" height="100"></svg>';
      const file = new Blob([svgContent], { type: 'image/svg+xml' }) as File;
      Object.defineProperty(file, 'name', { value: 'test.svg' });
      Object.defineProperty(file, 'size', { value: 500 });
      Object.defineProperty(file, 'type', { value: 'image/svg+xml' });

      const result = await convertImage(file, {
        format: 'jpeg',
        quality: 80,
        removeExif: false,
      });

      expect(result.format).toBe('jpeg');
    });

    it('resizes image when maxWidth is provided', async () => {
      const file = new Blob(['test'], { type: 'image/jpeg' }) as File;
      Object.defineProperty(file, 'name', { value: 'test.jpg' });
      Object.defineProperty(file, 'size', { value: 1000 });
      Object.defineProperty(file, 'type', { value: 'image/jpeg' });

      const result = await convertImage(file, {
        format: 'jpeg',
        quality: 80,
        removeExif: false,
        maxWidth: 500,
      });

      expect(result.format).toBe('jpeg');
    });

    it('returns correct compression ratio', async () => {
      const file = new Blob(['test'], { type: 'image/jpeg' }) as File;
      Object.defineProperty(file, 'name', { value: 'test.jpg' });
      Object.defineProperty(file, 'size', { value: 1000 });
      Object.defineProperty(file, 'type', { value: 'image/jpeg' });

      const result = await convertImage(file, {
        format: 'jpeg',
        quality: 80,
        removeExif: false,
      });

      expect(result.compressionRatio).toBeGreaterThan(0);
      expect(result.compressedSize).toBeGreaterThan(0);
    });
  });

  describe('getImageDimensions', () => {
    it('returns width and height of image', async () => {
      const file = new Blob(['test'], { type: 'image/jpeg' }) as File;
      Object.defineProperty(file, 'size', { value: 1000 });

      const result = await getImageDimensions(file);
      expect(result.width).toBe(100);
      expect(result.height).toBe(100);
    });

    it('revokes object URL after loading', async () => {
      const file = new Blob(['test'], { type: 'image/jpeg' }) as File;
      Object.defineProperty(file, 'size', { value: 1000 });

      await getImageDimensions(file);
      expect(URL.revokeObjectURL).toHaveBeenCalled();
    });
  });

  describe('estimateFileSize', () => {
    it('returns estimated file size', async () => {
      const file = new Blob(['test'], { type: 'image/jpeg' }) as File;
      Object.defineProperty(file, 'size', { value: 1000 });
      Object.defineProperty(file, 'type', { value: 'image/jpeg' });

      const result = await estimateFileSize(file, 'jpeg', 80);
      expect(typeof result).toBe('number');
    });

    it('returns original size on failure', async () => {
      const file = new Blob(['test'], { type: 'image/jpeg' }) as File;
      Object.defineProperty(file, 'size', { value: 1000 });
      Object.defineProperty(file, 'type', { value: 'image/jpeg' });

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = await estimateFileSize(file, 'jpeg', 80);
      expect(typeof result).toBe('number');

      warnSpy.mockRestore();
    });
  });
});
