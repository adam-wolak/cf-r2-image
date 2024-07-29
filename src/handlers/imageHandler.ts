import { Env } from '../types';
import { Queue } from '../utils/queue';
import { fetchOriginalImage, saveOriginalToR2, saveTransformedToR2 } from '../utils/r2Storage';
import { transformImage } from '../transformers/imageTransformer';
import { config } from '../config';
import { getOptimalImageFormat } from '../utils/imageUtils';

const imageQueue = new Queue(5);

export async function handleImage(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const imagePath = url.pathname.replace(/^\//, '');

  if (imagePath.includes('slider')) {
    return fetch(request);
  }

  const optimalFormat = getOptimalImageFormat(request.headers.get('Accept') || '');
  const optimizedImagePath = imagePath.replace(/\.(jpg|jpeg|png|gif|webp)$/i, `.${optimalFormat}`);

  return imageQueue.enqueue(async () => {
    try {
      const optimizedImage = await env.R2_BUCKET.get(optimizedImagePath);
      if (optimizedImage) {
        return new Response(optimizedImage.body, {
          headers: {
            'Content-Type': `image/${optimalFormat}`,
            'Cache-Control': config.R2_CACHE_CONTROL,
          },
        });
      }

      const originalImage = await fetchOriginalImage(imagePath, env);
      if (!originalImage) {
        console.log(`Original image not found: ${imagePath}`);
        return fetch(request);
      }

      await saveOriginalToR2(originalImage, imagePath, env);

      const transformedImage = await transformImage(originalImage, config.TRANSFORM_PARAMS, optimalFormat);
      if (!transformedImage) {
        console.error(`Failed to transform image: ${imagePath}`);
        return fetch(request);
      }

      await saveTransformedToR2(transformedImage, optimizedImagePath, env, optimalFormat);

      return new Response(transformedImage, {
        headers: {
          'Content-Type': `image/${optimalFormat}`,
          'Cache-Control': config.R2_CACHE_CONTROL,
        },
      });
    } catch (error) {
      console.error(`Error processing image ${imagePath}:`, error);
      return fetch(request);
    }
  });
}
