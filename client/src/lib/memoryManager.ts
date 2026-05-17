/**
 * Memory Management and Error Handling Utilities
 * 
 * Handles file size limits, memory warnings, and graceful error recovery
 */

const MAX_FILE_SIZE = 200 * 1024 * 1024; // 200MB
const MAX_TOTAL_SIZE = 500 * 1024 * 1024; // 500MB
const MEMORY_WARNING_THRESHOLD = 0.8; // 80% of available memory

export interface MemoryStatus {
  available: number;
  used: number;
  total: number;
  percentage: number;
  isWarning: boolean;
}

/**
 * Get current memory status
 */
export function getMemoryStatus(): MemoryStatus {
  const perfMemory = (performance as any).memory;
  if (!perfMemory) {
    // Fallback for browsers that don't support performance.memory
    return {
      available: 0,
      used: 0,
      total: 0,
      percentage: 0,
      isWarning: false,
    };
  }

  const { jsHeapSizeLimit, totalJSHeapSize, usedJSHeapSize } = perfMemory;
  const available = jsHeapSizeLimit - usedJSHeapSize;
  const percentage = usedJSHeapSize / jsHeapSizeLimit;

  return {
    available,
    used: usedJSHeapSize,
    total: jsHeapSizeLimit,
    percentage,
    isWarning: percentage > MEMORY_WARNING_THRESHOLD,
  };
}

/**
 * Check if file size is within limits
 */
export function validateFileSize(fileSize: number): { valid: boolean; error?: string } {
  if (fileSize > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `El archivo es demasiado grande. Máximo: ${formatBytes(MAX_FILE_SIZE)}`,
    };
  }

  return { valid: true };
}

/**
 * Check if total files size is within limits
 */
export function validateTotalSize(files: File[]): { valid: boolean; error?: string } {
  const totalSize = files.reduce((sum, file) => sum + file.size, 0);

  if (totalSize > MAX_TOTAL_SIZE) {
    return {
      valid: false,
      error: `El tamaño total de archivos excede el límite. Máximo: ${formatBytes(MAX_TOTAL_SIZE)}`,
    };
  }

  return { valid: true };
}

/**
 * Check if there's enough memory for processing
 */
export function checkAvailableMemory(): { sufficient: boolean; warning: string | null } {
  const status = getMemoryStatus();

  if (status.percentage > 0.95) {
    return {
      sufficient: false,
      warning: 'Memoria insuficiente. Por favor, cierra otras pestañas o aplicaciones.',
    };
  }

  if (status.isWarning) {
    return {
      sufficient: true,
      warning: `Memoria baja (${(status.percentage * 100).toFixed(1)}% utilizada). La velocidad de procesamiento puede ser más lenta.`,
    };
  }

  return { sufficient: true, warning: null };
}

/**
 * Format bytes to human readable format
 */
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Clean up object URLs to free memory
 */
export function cleanupObjectURLs(urls: string[]): void {
  urls.forEach((url) => {
    try {
      URL.revokeObjectURL(url);
    } catch (error) {
      console.warn('Failed to revoke object URL:', error);
    }
  });
}

/**
 * Create a safe error message
 */
export function createErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  return 'Ocurrió un error desconocido. Por favor, intenta de nuevo.';
}

/**
 * Retry logic for failed operations
 */
export async function retryOperation<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  delayMs = 1000
): Promise<T> {
  let lastError: Error | null = null;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (i < maxRetries - 1) {
        // Exponential backoff
        await new Promise((resolve) => setTimeout(resolve, delayMs * Math.pow(2, i)));
      }
    }
  }

  throw lastError || new Error('Operation failed after retries');
}
