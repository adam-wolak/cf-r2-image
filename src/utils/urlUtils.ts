import { TransformOptions } from './deviceUtils';
import { config } from '../config';

export function modifyImageUrl(originalUrl: string, options: TransformOptions): string {
  const transformParams = new URLSearchParams();
  
  if (options.width) transformParams.set('width', options.width.toString());
  if (options.height) transformParams.set('height', options.height.toString());
  if (options.fit) transformParams.set('fit', options.fit);
  if (options.quality) transformParams.set('quality', options.quality.toString());
  if (options.format) transformParams.set('format', options.format);
  if (options.gravity) transformParams.set('gravity', options.gravity);

  const transformUrl = `${config.WORKER_URL}/cdn-cgi/image/${transformParams.toString()}/${encodeURIComponent(originalUrl)}`;
  return transformUrl;
}

export function isImageUrl(url: string): boolean {
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif'];
  return imageExtensions.some(ext => url.toLowerCase().endsWith(ext));
}

export function parseSrcset(srcset: string): Array<{url: string, width: number}> {
  return srcset.split(',').map(entry => {
    const [url, size] = entry.trim().split(' ');
    return {
      url,
      width: parseInt(size)
    };
  });
}
