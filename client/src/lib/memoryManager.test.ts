import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getMemoryStatus,
  validateFileSize,
  validateTotalSize,
  checkAvailableMemory,
  formatBytes,
  cleanupObjectURLs,
  createErrorMessage,
  retryOperation,
} from './memoryManager';

describe('memoryManager', () => {
  describe('formatBytes', () => {
    it('formats 0 bytes correctly', () => {
      expect(formatBytes(0)).toBe('0 Bytes');
    });

    it('formats bytes correctly', () => {
      expect(formatBytes(500)).toBe('500 Bytes');
    });

    it('formats kilobytes correctly', () => {
      expect(formatBytes(1024)).toBe('1 KB');
      expect(formatBytes(2048)).toBe('2 KB');
    });

    it('formats megabytes correctly', () => {
      expect(formatBytes(1048576)).toBe('1 MB');
      expect(formatBytes(5242880)).toBe('5 MB');
    });

    it('formats gigabytes correctly', () => {
      expect(formatBytes(1073741824)).toBe('1 GB');
    });

    it('respects decimal places', () => {
      expect(formatBytes(1536, 0)).toBe('2 KB');
      expect(formatBytes(1536, 2)).toBe('1.5 KB');
    });
  });

  describe('validateFileSize', () => {
    it('accepts files under 200MB', () => {
      const result = validateFileSize(100 * 1024 * 1024);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('rejects files over 200MB', () => {
      const result = validateFileSize(201 * 1024 * 1024);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('demasiado grande');
    });

    it('accepts files exactly at 200MB', () => {
      const result = validateFileSize(200 * 1024 * 1024);
      expect(result.valid).toBe(true);
    });
  });

  describe('validateTotalSize', () => {
    it('accepts files under 500MB total', () => {
      const files = [
        { size: 100 * 1024 * 1024 } as unknown as File,
        { size: 100 * 1024 * 1024 } as unknown as File,
      ];

      const result = validateTotalSize(files);
      expect(result.valid).toBe(true);
    });

    it('rejects files over 500MB total', () => {
      const files = [
        { size: 300 * 1024 * 1024, name: 'file1' } as unknown as File,
        { size: 300 * 1024 * 1024, name: 'file2' } as unknown as File,
      ];

      const result = validateTotalSize(files);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('excede el límite');
    });
  });

  describe('getMemoryStatus', () => {
    it('returns zeros when performance.memory is not available', () => {
      delete (performance as any).memory;
      const status = getMemoryStatus();
      expect(status).toEqual({
        available: 0,
        used: 0,
        total: 0,
        percentage: 0,
        isWarning: false,
      });
    });

    it('returns correct status when performance.memory is available', () => {
      (performance as any).memory = {
        jsHeapSizeLimit: 1000,
        totalJSHeapSize: 500,
        usedJSHeapSize: 300,
      };
      const status = getMemoryStatus();
      expect(status.available).toBe(700);
      expect(status.used).toBe(300);
      expect(status.total).toBe(1000);
      expect(status.percentage).toBe(0.3);
      expect(status.isWarning).toBe(false);
    });

    it('sets isWarning when usage exceeds 80%', () => {
      (performance as any).memory = {
        jsHeapSizeLimit: 1000,
        totalJSHeapSize: 900,
        usedJSHeapSize: 850,
      };
      const status = getMemoryStatus();
      expect(status.isWarning).toBe(true);
    });
  });

  describe('checkAvailableMemory', () => {
    it('returns sufficient with no warning when memory is fine', () => {
      (performance as any).memory = {
        jsHeapSizeLimit: 1000,
        totalJSHeapSize: 500,
        usedJSHeapSize: 300,
      };
      const result = checkAvailableMemory();
      expect(result.sufficient).toBe(true);
      expect(result.warning).toBeNull();
    });

    it('returns warning when memory usage is above 80%', () => {
      (performance as any).memory = {
        jsHeapSizeLimit: 1000,
        totalJSHeapSize: 900,
        usedJSHeapSize: 850,
      };
      const result = checkAvailableMemory();
      expect(result.sufficient).toBe(true);
      expect(result.warning).toContain('Memoria baja');
    });

    it('returns insufficient when memory usage is above 95%', () => {
      (performance as any).memory = {
        jsHeapSizeLimit: 1000,
        totalJSHeapSize: 990,
        usedJSHeapSize: 960,
      };
      const result = checkAvailableMemory();
      expect(result.sufficient).toBe(false);
      expect(result.warning).toContain('insuficiente');
    });
  });

  describe('cleanupObjectURLs', () => {
    const originalRevokeObjectURL = URL.revokeObjectURL;

    beforeEach(() => {
      URL.revokeObjectURL = vi.fn();
    });

    afterEach(() => {
      URL.revokeObjectURL = originalRevokeObjectURL;
    });

    it('revokes all provided URLs', () => {
      const urls = ['blob:url1', 'blob:url2', 'blob:url3'];
      cleanupObjectURLs(urls);
      expect(URL.revokeObjectURL).toHaveBeenCalledTimes(3);
      urls.forEach((url) => {
        expect(URL.revokeObjectURL).toHaveBeenCalledWith(url);
      });
    });

    it('handles empty array', () => {
      cleanupObjectURLs([]);
      expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    });

    it('continues if one URL fails', () => {
      (URL.revokeObjectURL as any).mockImplementation((url: string) => {
        if (url === 'blob:url2') throw new Error('fail');
      });
      const urls = ['blob:url1', 'blob:url2', 'blob:url3'];
      expect(() => cleanupObjectURLs(urls)).not.toThrow();
    });
  });

  describe('createErrorMessage', () => {
    it('returns message from Error instance', () => {
      const error = new Error('test error');
      expect(createErrorMessage(error)).toBe('test error');
    });

    it('returns string if error is a string', () => {
      expect(createErrorMessage('something broke')).toBe('something broke');
    });

    it('returns default message for unknown types', () => {
      expect(createErrorMessage(null)).toContain('desconocido');
      expect(createErrorMessage(undefined)).toContain('desconocido');
      expect(createErrorMessage(42)).toContain('desconocido');
      expect(createErrorMessage({})).toContain('desconocido');
    });
  });

  describe('retryOperation', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('succeeds on first attempt', async () => {
      const operation = vi.fn().mockResolvedValue('success');
      const result = retryOperation(operation, 3, 100);
      await vi.advanceTimersByTimeAsync(0);
      expect(await result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('retries on failure and eventually succeeds', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('fail 1'))
        .mockRejectedValueOnce(new Error('fail 2'))
        .mockResolvedValue('success');

      const promise = retryOperation(operation, 3, 100);

      await vi.advanceTimersByTimeAsync(100);
      await vi.advanceTimersByTimeAsync(200);

      expect(await promise).toBe('success');
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('throws after max retries', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('always fails'));
      const promise = retryOperation(operation, 3, 100);

      await vi.advanceTimersByTimeAsync(100);
      await vi.advanceTimersByTimeAsync(200);
      await vi.advanceTimersByTimeAsync(400);

      await expect(promise).rejects.toThrow('always fails');
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('uses exponential backoff', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('fail'));
      const promise = retryOperation(operation, 3, 100);

      await vi.advanceTimersByTimeAsync(100);
      await vi.advanceTimersByTimeAsync(200);
      await vi.advanceTimersByTimeAsync(400);

      await expect(promise).rejects.toThrow();
      expect(operation).toHaveBeenCalledTimes(3);
    });
  });
});
