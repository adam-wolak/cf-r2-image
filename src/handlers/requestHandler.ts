import { handleImageRequest } from './imageHandler';
import { shouldSkipOptimization } from '../utils/urlUtils';
import { getDeviceType, getBestImageFormat } from '../utils/deviceUtils';
import { config } from '../config';
import { ImageHandler } from '../transformers/imageHandler';

export async function handleRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);

  if (url.pathname.startsWith('/cdn-cgi/image')) {
    return handleImageRequest(request);
  }

  if (shouldSkipOptimization(url.pathname)) {
    return fetch(`${config.ORIGIN}${url.pathname}${url.search}`);
  }

  // Specjalna obsługa dla favicon
  if (url.pathname.endsWith('favicon.ico') || url.pathname.includes('favicon')) {
    return fetch(`${config.ORIGIN}${url.pathname}`);
  }

  const response = await fetch(`${config.ORIGIN}${url.pathname}${url.search}`);
  const deviceType = getDeviceType(request);
  const bestFormat = getBestImageFormat(request);

  return new HTMLRewriter()
    .on('img', new ImageHandler(deviceType, bestFormat, request))
    .transform(response);
}
