import { Env } from '../types';
import { saveToR2, getFromR2 } from '../utils/r2Utils';
import { transformImage } from '../utils/imageUtils';
import { getOptimalImageFormat } from '../utils/browserUtils';
import { parseImageDimensions } from '../utils/htmlUtils';

async function transformImage(imageUrl: string, env: Env, userAgent: string, srcset?: string, sizes?: string): Promise<string> {
  console.log('Transforming image:', imageUrl);
  
  const url = new URL(imageUrl);
  const transformParams = JSON.parse(env.TRANSFORM_PARAMS);
  
  url.searchParams.set('format', 'avif');
  url.searchParams.set('width', 'auto');
  url.searchParams.set('height', 'auto');
  url.searchParams.set('fit', transformParams.fit || 'cover');
  url.searchParams.set('quality', transformParams.quality || '85');

  const transformedUrl = `${url.origin}/cdn-cgi/image/${url.searchParams.toString()}${url.pathname}`;
  console.log('Transformed URL:', transformedUrl);

  return transformedUrl;
}


export async function handleTransform(request: Request, env: Env): Promise<Response> {
  console.log('Image Transformer: Received transform request');
  try {
    let images;
    if (request.method === 'POST') {
      const body = await request.json() as { processedImages: { url: string; base64: string }[] };
      images = body.processedImages;
    } else if (request.method === 'GET') {
      const url = new URL(request.url);
      const targetUrl = url.searchParams.get('url');
      if (!targetUrl) {
        return new Response('Missing url parameter', { status: 400 });
      }
      images = [{ url: targetUrl, base64: '' }];
    } else {
      return new Response('Method Not Allowed', { status: 405 });
    }

    if (!Array.isArray(images)) {
      return new Response(JSON.stringify({ error: 'Invalid request body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const userAgent = request.headers.get('User-Agent') || '';

    const transformedImages = await Promise.all(images.map(async (image) => {
      try {
        const r2Key = new URL(image.url).pathname.slice(1);
        const existingImage = await getFromR2(env, r2Key);
        
        if (existingImage) {
          console.log(`Image already transformed: ${image.url}`);
          return `${env.R2_PUB}/${r2Key}`;
        }

        const transformedUrl = transformImageUrl(image.url, env);
        const response = await fetch(transformedUrl);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const imageData = await response.arrayBuffer();

        await saveToR2(env, r2Key, imageData, 'image/avif');

        return `${env.R2_PUB}/${r2Key}`;
      } catch (error) {
        console.error(`Error transforming image ${image.url}:`, error);
        return null;
      }
    }));

    return new Response(JSON.stringify({ transformedImages: transformedImages.filter(Boolean) }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error in handleTransform:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export default {
  fetch: handleTransform
};
