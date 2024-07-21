import { config } from '../config';

export function shouldSkipOptimization(pathname: string): boolean {
  return pathname.includes('wp-admin') ||
         pathname.includes('login.php') ||
         pathname.includes('/promocje');
}

export function optimizeImageUrl(url: string, options: ImageOptions): string {
  const parsedUrl = new URL(url);
  const transformParams = new URLSearchParams();

  if (options.format) transformParams.set('format', options.format);
  if (options.width) transformParams.set('width', options.width.toString());
  if (options.height) transformParams.set('height', options.height.toString());
  if (options.fit) transformParams.set('fit', options.fit);
  if (options.gravity) transformParams.set('gravity', options.gravity);
  if (options.quality) transformParams.set('quality', options.quality.toString());

  const transformString = transformParams.toString();
  const optimizedUrl = `${parsedUrl.origin}/cdn-cgi/image/${transformString}${parsedUrl.pathname}`;
  
  console.log('Transformation URL:', optimizedUrl);
  
  return optimizedUrl;
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
