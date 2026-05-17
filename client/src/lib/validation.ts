const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/bmp',
  'image/svg+xml',
  'image/tiff',
  'image/x-icon',
] as const;

const ALLOWED_AUDIO_TYPES = [
  'audio/mp3',
  'audio/mpeg',
  'audio/wav',
  'audio/x-wav',
  'audio/aac',
  'audio/mp4',
  'audio/x-m4a',
  'audio/ogg',
  'audio/flac',
  'audio/webm',
] as const;

const ALLOWED_VIDEO_TYPES = [
  'video/mp4',
  'video/webm',
  'video/ogg',
  'video/quicktime',
  'video/x-msvideo',
  'video/x-matroska',
  'video/x-flv',
  'video/avi',
] as const;

const ALLOWED_DOCUMENT_TYPES = [
  'application/pdf',
  'text/plain',
  'text/markdown',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
] as const;

export const ALLOWED_MIME_TYPES = [
  ...ALLOWED_IMAGE_TYPES,
  ...ALLOWED_AUDIO_TYPES,
  ...ALLOWED_VIDEO_TYPES,
  ...ALLOWED_DOCUMENT_TYPES,
] as const;

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

const CONVERSION_TIMEOUT_MS = 30 * 60 * 1000;

export function validateMimeType(file: File, allowedTypes?: readonly string[]): { valid: boolean; error?: string } {
  const types = allowedTypes || ALLOWED_MIME_TYPES;

  if (!types.includes(file.type as any)) {
    return {
      valid: false,
      error: `Tipo de archivo no soportado: "${file.type}". Tipos permitidos: ${types.join(', ')}`,
    };
  }

  return { valid: true };
}

export function validateImageType(file: File): { valid: boolean; error?: string } {
  return validateMimeType(file, ALLOWED_IMAGE_TYPES);
}

export function validateAudioType(file: File): { valid: boolean; error?: string } {
  return validateMimeType(file, ALLOWED_AUDIO_TYPES);
}

export function validateVideoType(file: File): { valid: boolean; error?: string } {
  return validateMimeType(file, ALLOWED_VIDEO_TYPES);
}

export function validateDocumentType(file: File): { valid: boolean; error?: string } {
  return validateMimeType(file, ALLOWED_DOCUMENT_TYPES);
}

export function withTimeout<T>(promise: Promise<T>, timeoutMs: number = CONVERSION_TIMEOUT_MS): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`La operación excedió el tiempo límite de ${timeoutMs / 1000} segundos`)), timeoutMs)
    ),
  ]);
}

export function getExtensionFromMimeType(mimeType: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/bmp': 'bmp',
    'image/svg+xml': 'svg',
    'image/tiff': 'tiff',
    'audio/mpeg': 'mp3',
    'audio/mp3': 'mp3',
    'audio/wav': 'wav',
    'audio/x-wav': 'wav',
    'audio/aac': 'aac',
    'audio/ogg': 'ogg',
    'audio/flac': 'flac',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'video/ogg': 'ogv',
    'video/quicktime': 'mov',
    'video/x-msvideo': 'avi',
    'video/x-matroska': 'mkv',
    'application/pdf': 'pdf',
  };
  return map[mimeType] || 'bin';
}
