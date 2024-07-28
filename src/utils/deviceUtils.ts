import { config } from '../config';

export interface TransformOptions {
  format?: string;
  width?: number;
  height?: number;
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
  quality?: number;
  gravity?: string;
}

export function getBestImageFormat(request: Request): string {
  const accept = request.headers.get('Accept') || '';
  if (accept.includes('image/avif')) return 'avif';
  if (accept.includes('image/webp')) return 'webp';
  return 'jpeg';
}

export function getOptimalImageTransformOptions(request: Request, originalWidth?: number, originalHeight?: number): TransformOptions {
  const format = getBestImageFormat(request);
  const userAgent = request.headers.get('User-Agent') || '';
  
  let width = originalWidth;
  let height = originalHeight;
  
  // Dostosowanie rozmiaru w zależności od urządzenia
  if (userAgent.includes('Mobile') && width && width > 800) {
    const ratio = 800 / width;
    width = 800;
    height = height ? Math.round(height * ratio) : undefined;
  } else if (userAgent.includes('Tablet') && width && width > 1200) {
    const ratio = 1200 / width;
    width = 1200;
    height = height ? Math.round(height * ratio) : undefined;
  }

  return {
    format,
    width,
    height,
    fit: config.TRANSFORM_PARAMS.fit,
    quality: parseInt(config.TRANSFORM_PARAMS.quality),
    gravity: config.TRANSFORM_PARAMS.gravity
  };
}
