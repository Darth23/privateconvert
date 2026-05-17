import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockPDFDoc = {
  numPages: 5,
  getPage: vi.fn().mockResolvedValue({
    getViewport: vi.fn().mockReturnValue({ width: 612, height: 792 }),
    render: vi.fn().mockReturnValue({
      promise: Promise.resolve(),
    }),
  }),
};

const mockGetDocument = vi.fn().mockReturnValue({
  promise: Promise.resolve(mockPDFDoc),
});

vi.mock('pdfjs-dist', () => ({
  getDocument: (...args: any[]) => mockGetDocument(...args),
  GlobalWorkerOptions: {
    workerSrc: '',
  },
  version: '5.7.284',
}));

vi.mock('jspdf', () => {
  const MockJsPDF = vi.fn().mockImplementation(() => ({
    internal: {
      pageSize: {
        getWidth: () => 210,
        getHeight: () => 297,
      },
      pages: [null, {}],
    },
    addPage: vi.fn(),
    addImage: vi.fn(),
    output: vi.fn().mockReturnValue(new Blob(['pdf content'], { type: 'application/pdf' })),
  }));
  return { default: MockJsPDF };
});

describe('pdfProcessor', () => {
  let imagesToPDF: any;
  let optimizePDF: any;
  let getPDFInfo: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    mockGetDocument.mockReturnValue({
      promise: Promise.resolve(mockPDFDoc),
    });
    mockPDFDoc.getPage.mockResolvedValue({
      getViewport: vi.fn().mockReturnValue({ width: 612, height: 792 }),
      render: vi.fn().mockReturnValue({
        promise: Promise.resolve(),
      }),
    });

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
      toDataURL = vi.fn(() => 'data:image/jpeg;base64,test');
    } as any;

    global.document = {
      createElement: vi.fn((tag: string) => {
        if (tag === 'canvas') {
          return new global.HTMLCanvasElement();
        }
        return new global.Image();
      }),
    } as any;

    global.FileReader = class MockFileReader {
      result = 'data:image/jpeg;base64,dGVzdA==';
      onload: ((e: { target: { result: string } }) => void) | null = null;
      onerror: (() => void) | null = null;
      readAsDataURL = vi.fn(() => {
        setTimeout(() => {
          if (this.onload) this.onload({ target: { result: this.result } });
        }, 0);
      });
    } as any;

    const mod = await import('./pdfProcessor');
    imagesToPDF = mod.imagesToPDF;
    optimizePDF = mod.optimizePDF;
    getPDFInfo = mod.getPDFInfo;
  });

  describe('getPDFInfo', () => {
    it('returns correct page count from PDF', async () => {
      const file = new Blob(['pdf content'], { type: 'application/pdf' }) as File;
      Object.defineProperty(file, 'size', { value: 50000 });
      Object.defineProperty(file, 'type', { value: 'application/pdf' });

      const info = await getPDFInfo(file);

      expect(info.pageCount).toBe(5);
      expect(info.size).toBe(50000);
    });

    it('returns 0 page count on error', async () => {
      mockGetDocument.mockReturnValueOnce({
        promise: Promise.reject(new Error('Invalid PDF')),
      });

      const file = new Blob(['invalid'], { type: 'application/pdf' }) as File;
      Object.defineProperty(file, 'size', { value: 100 });
      Object.defineProperty(file, 'type', { value: 'application/pdf' });

      const info = await getPDFInfo(file);

      expect(info.pageCount).toBe(0);
      expect(info.size).toBe(100);
    });
  });

  describe('imagesToPDF', () => {
    it('creates PDF from images', async () => {
      const files = [
        new Blob(['image1'], { type: 'image/jpeg' }) as File,
        new Blob(['image2'], { type: 'image/png' }) as File,
      ];
      Object.defineProperty(files[0], 'size', { value: 10000 });
      Object.defineProperty(files[0], 'type', { value: 'image/jpeg' });
      Object.defineProperty(files[1], 'size', { value: 15000 });
      Object.defineProperty(files[1], 'type', { value: 'image/png' });

      const result = await imagesToPDF(files);

      expect(result.blob).toBeDefined();
      expect(result.originalSize).toBe(25000);
      expect(result.pdfSize).toBeGreaterThan(0);
    });

    it('handles single image', async () => {
      const files = [
        new Blob(['image1'], { type: 'image/jpeg' }) as File,
      ];
      Object.defineProperty(files[0], 'size', { value: 10000 });
      Object.defineProperty(files[0], 'type', { value: 'image/jpeg' });

      const result = await imagesToPDF(files);

      expect(result.blob).toBeDefined();
      expect(result.originalSize).toBe(10000);
    });
  });

  describe('optimizePDF', () => {
    it('optimizes PDF and returns result', async () => {
      const file = new Blob(['pdf content'], { type: 'application/pdf' }) as File;
      Object.defineProperty(file, 'size', { value: 100000 });
      Object.defineProperty(file, 'type', { value: 'application/pdf' });

      const result = await optimizePDF(file, 70);

      expect(result.blob).toBeDefined();
      expect(result.originalSize).toBe(100000);
      expect(result.pageCount).toBe(5);
    });

    it('throws error on optimization failure', async () => {
      const errorResponse = {
        promise: Promise.reject(new Error('Corrupt PDF')),
      };
      mockGetDocument.mockReturnValue(errorResponse);

      const file = new Blob(['corrupt'], { type: 'application/pdf' }) as File;
      Object.defineProperty(file, 'size', { value: 100 });
      Object.defineProperty(file, 'type', { value: 'application/pdf' });

      await expect(optimizePDF(file)).rejects.toThrow('PDF optimization failed');
    });
  });
});
