import { Env } from '../types';
import { getImageDimensions } from '../utils/imageUtils';
import { transformImage } from '../transformers/imageHandler';
import { getFromR2, saveToR2 } from '../utils/r2Storage';
import { isImagePath, getOptimizedImagePath, getOriginalImagePath } from '../utils/imageUtils';
import { config } from '../config';

export async function handleImageRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const imagePath = url.pathname;

  if (!isImagePath(imagePath)) {
    return fetch(request);
  }

  const optimizedPath = getOptimizedImagePath(imagePath);
  const optimizedImage = await getFromR2(env.MY_BUCKET, optimizedPath);

  if (optimizedImage) {
    return new Response(optimizedImage, {
      headers: { 'Content-Type': 'image/avif' }
    });
  }

  const originalPath = getOriginalImagePath(imagePath);
  let originalImage = await getFromR2(env.MY_BUCKET, originalPath);

  if (!originalImage) {
    const originResponse = await fetch(`${config.ORIGIN}${originalPath}`);
    if (!originResponse.ok) {
      return new Response('Image not found', { status: 404 });
    }
    originalImage = await originResponse.arrayBuffer();
    await saveToR2(env.MY_BUCKET, originalPath, originalImage);
  }

  const transformedImage = await transformImage(originalImage, imagePath);
  await saveToR2(env.MY_BUCKET, optimizedPath, transformedImage);

  return new Response(transformedImage, {
    headers: { 'Content-Type': 'image/avif' }
  });
}
