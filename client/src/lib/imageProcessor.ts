import imageCompression from 'browser-image-compression';
import piexifjs from 'piexifjs';
import { validateImageType, withTimeout } from './validation';

export type ImageFormat = 'jpeg' | 'png' | 'webp';

interface ConversionOptions {
  format: ImageFormat;
  quality: number; // 0-100
  removeExif: boolean;
  maxWidth?: number;
  maxHeight?: number;
}

interface ConversionResult {
  blob: Blob;
  originalSize: number;
  compressedSize: number;
  format: ImageFormat;
  compressionRatio: number;
}

/**
 * Remove EXIF metadata from image blob
 */
async function removeExifData(blob: Blob): Promise<Blob> {
  // Note: piexifjs is primarily for JPEG files
  // For other formats, we return the original blob
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      try {
        const data = reader.result as string;
        const base64 = data.split(',')[1];
        const binary = atob(base64);

        // Remove EXIF data using piexifjs
        const removed = piexifjs.remove(binary);
        const binaryString = typeof removed === 'string' ? removed : removed;

        // Convert back to blob
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        resolve(new Blob([bytes], { type: blob.type }));
  } catch (error) {
    // If EXIF removal fails, return original blob
    console.warn('EXIF removal failed, returning original blob:', error);
    resolve(blob);
  }
    };

    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/**
 * Convert image to canvas and export as specified format
 */
async function canvasConvert(
  canvas: HTMLCanvasElement,
  format: ImageFormat,
  quality: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const mimeType = {
      jpeg: 'image/jpeg',
      png: 'image/png',
      webp: 'image/webp',
    }[format];

    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Canvas conversion failed'));
        }
      },
      mimeType,
      quality / 100
    );
  });
}

/**
 * Load image from blob and return canvas
 */
async function loadImageToCanvas(blob: Blob): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();

    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }

      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      resolve(canvas);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };

    img.src = url;
  });
}

/**
 * Resize image on canvas
 */
function resizeCanvas(
  canvas: HTMLCanvasElement,
  maxWidth?: number,
  maxHeight?: number
): HTMLCanvasElement {
  if (!maxWidth && !maxHeight) {
    return canvas;
  }

  const newCanvas = document.createElement('canvas');
  let width = canvas.width;
  let height = canvas.height;

  if (maxWidth && width > maxWidth) {
    height = (height * maxWidth) / width;
    width = maxWidth;
  }

  if (maxHeight && height > maxHeight) {
    width = (width * maxHeight) / height;
    height = maxHeight;
  }

  newCanvas.width = width;
  newCanvas.height = height;

  const ctx = newCanvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }

  ctx.drawImage(canvas, 0, 0, width, height);
  return newCanvas;
}

/**
 * Convert SVG to PNG
 */
async function convertSvgToPng(blob: Blob): Promise<Blob> {
  const url = URL.createObjectURL(blob);
  const svg = await fetch(url).then((r) => r.text());
  URL.revokeObjectURL(url);

  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      reject(new Error('Failed to get canvas context'));
      return;
    }

    const img = new Image();
    let svgUrl: string | null = null;

    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      canvas.toBlob(
        (blob) => {
          if (svgUrl) URL.revokeObjectURL(svgUrl);
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('SVG conversion failed'));
          }
        },
        'image/png'
      );
    };

    img.onerror = () => {
      if (svgUrl) URL.revokeObjectURL(svgUrl);
      reject(new Error('Failed to load SVG'));
    };

    const svgBlob = new Blob([svg], { type: 'image/svg+xml' });
    svgUrl = URL.createObjectURL(svgBlob);
    img.src = svgUrl;
  });
}

/**
 * Main conversion function
 */
export async function convertImage(
  file: File,
  options: ConversionOptions
): Promise<ConversionResult> {
  const mimeValidation = validateImageType(file);
  if (!mimeValidation.valid) {
    throw new Error(mimeValidation.error);
  }

  const originalSize = file.size;
  let blob: Blob = file;

  try {
    return await withTimeout((async () => {
    // Handle SVG to PNG conversion
    if (file.type === 'image/svg+xml') {
      blob = await convertSvgToPng(blob as Blob);
      if (options.format === 'png') {
        const result: ConversionResult = {
          blob,
          originalSize,
          compressedSize: blob.size,
          format: 'png',
          compressionRatio: (blob.size / originalSize) * 100,
        };
        return result;
      }
    }

    // Load image to canvas
    let canvas = await loadImageToCanvas(blob);

    // Resize if needed
    if (options.maxWidth || options.maxHeight) {
      canvas = resizeCanvas(canvas, options.maxWidth, options.maxHeight);
    }

    // Convert to target format
    blob = await canvasConvert(canvas, options.format, options.quality);

    // Remove EXIF if requested
    if (options.removeExif && (options.format === 'jpeg' || options.format === 'png')) {
      blob = await removeExifData(blob);
    }

    const compressedSize = blob.size;

    return {
      blob,
      originalSize,
      compressedSize,
      format: options.format,
      compressionRatio: (compressedSize / originalSize) * 100,
    };
    })());
  } catch (error) {
    throw new Error(`Image conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get estimated file size for quality level
 */
export async function estimateFileSize(
  file: File,
  format: ImageFormat,
  quality: number
): Promise<number> {
  try {
    const result = await convertImage(file, {
      format,
      quality,
      removeExif: false,
    });
    return result.compressedSize;
  } catch (error) {
    console.warn('Failed to estimate file size:', error);
    return file.size;
  }
}

/**
 * Get image dimensions
 */
export async function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      resolve({ width: img.width, height: img.height });
      URL.revokeObjectURL(url);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };

    img.src = url;
  });
}
