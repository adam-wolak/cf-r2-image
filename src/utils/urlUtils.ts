import { TransformOptions } from './deviceUtils';

export function optimizeImageUrl(imageUrl: string, options: TransformOptions): string {
  const url = new URL('https://r2-image.bielskoclinic.workers.dev');
  url.pathname = `/${encodeURIComponent(imageUrl)}`;
  
  if (options.format) url.searchParams.set('format', options.format);
  if (options.width) url.searchParams.set('width', options.width.toString());
  if (options.height) url.searchParams.set('height', options.height.toString());
  if (options.fit) url.searchParams.set('fit', options.fit);
  if (options.quality) url.searchParams.set('quality', options.quality.toString());

  return url.toString();
}
