import { config } from '../config';

export function shouldSkipOptimization(pathname: string): boolean {
  return pathname.includes('wp-admin') ||
         pathname.includes('login.php') ||
         pathname.includes('/promocje');
}

export function optimizeImageUrl(imageUrl: string, options: TransformOptions): string {
  const url = new URL('https://r2-image.bielskoclinic.workers.dev');
  url.pathname = `/${encodeURIComponent(imageUrl)}`;
  
  if (options.format) url.searchParams.set('format', options.format);
  if (options.width) url.searchParams.set('width', options.width.toString());
  if (options.height) url.searchParams.set('height', options.height.toString());
  if (options.fit) url.searchParams.set('fit', options.fit);
  if (options.gravity) url.searchParams.set('gravity', options.gravity);
  if (options.quality) url.searchParams.set('quality', options.quality.toString());

  return url.toString();
}


export function getR2ObjectKey(url: string): string {
  const parsedUrl = new URL(url);
  return parsedUrl.pathname.slice(1) || parsedUrl.hostname;
}

export function getOriginalImageUrl(url: string): string {
  return url.replace(/-\d+x\d+\.(jpg|jpeg|png|gif)$/i, '.$1');
}

export function normalizeImageUrl(url: string): string {
  return url.startsWith('//') ? `https:${url}` : url;
}

export function isImageUrl(url: string): boolean {
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif', '.svg'];
  const parsedUrl = new URL(url);
  const path = parsedUrl.pathname.toLowerCase();
  return imageExtensions.some(ext => path.endsWith(ext));
}
