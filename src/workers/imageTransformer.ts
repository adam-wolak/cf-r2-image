import { Env, R2Object } from '../types';
import { getOptimalImageFormat } from '../utils/browserUtils';

async function transformAndSaveImage(imageUrl: string, env: Env, userAgent: string): Promise<string> {
  const optimalFormat = getOptimalImageFormat(userAgent);

  const transformParams = [
    `format=${optimalFormat}`,
    `quality=${env.TRANSFORM_PARAMS.quality}`,
    `fit=${env.TRANSFORM_PARAMS.fit}`,
    `gravity=${env.TRANSFORM_PARAMS.gravity}`
  ].join(',');

  const cdnUrl = new URL('https://bielskoclinic.pl/cdn-cgi/image/');
  cdnUrl.pathname += `${transformParams}/${imageUrl}`;

  console.log(`Transforming image: ${cdnUrl}`);

  const transformedResponse = await fetch(cdnUrl.toString(), {
    headers: {
      'Accept': `image/${optimalFormat}`,
      'User-Agent': userAgent,
    },
  });

  if (!transformedResponse.ok) {
    throw new Error(`Transform failed with status: ${transformedResponse.status}`);
  }

  const arrayBuffer = await transformedResponse.arrayBuffer();
  const contentType = transformedResponse.headers.get('Content-Type') || `image/${optimalFormat}`;

  const urlObj = new URL(imageUrl);
  const key = urlObj.pathname.replace(/^\//, '').replace(/\.[^/.]+$/, `.${optimalFormat}`);

  await env.R2_BUCKET.put(key, arrayBuffer, {
    httpMetadata: { contentType: contentType },
  });

  console.log(`Image saved to R2: ${key}`);
  return key;  // Zwracamy klucz
}

async function handleImageRetrieval(imagePath: string, env: Env): Promise<Response> {
  const object = await env.R2_BUCKET.get(imagePath);
  
  if (!object) {
    return new Response('Image not found', { status: 404 });
  }
  
  console.log('Full object structure:', JSON.stringify(object, null, 2));
  
  const contentType = object.httpMetadata?.contentType || 'image/avif';
  console.log('Retrieved object Content-Type:', contentType);
  console.log('Retrieved object size:', object.size);

  const arrayBuffer = await object.arrayBuffer();
  const signature = new Uint8Array(arrayBuffer.slice(0, 12));
  console.log('Retrieved file signature:', Array.from(signature).map(b => b.toString(16).padStart(2, '0')).join(' '));
  
  const headers = new Headers();
  headers.set('Content-Type', contentType);
  headers.set('Cache-Control', 'public, max-age=31536000');
  
  return new Response(arrayBuffer, { headers });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    
    if (url.pathname.startsWith('/retrieve/')) {
      const imagePath = url.pathname.replace(/^\/retrieve\//, '');
      return handleImageRetrieval(imagePath, env);
    }
    
    const imageUrl = url.searchParams.get('url');
    if (!imageUrl) {
      return new Response('Missing image URL', { status: 400 });
    }

    try {
      new URL(imageUrl);
    } catch (error) {
      return new Response('Invalid image URL', { status: 400 });
    }

    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif'];
    if (!imageExtensions.some(ext => imageUrl.toLowerCase().endsWith(ext))) {
      return new Response('URL does not point to an image', { status: 400 });
    }

    const userAgent = request.headers.get('User-Agent') || '';

    try {
      const savedKey = await transformAndSaveImage(imageUrl, env, userAgent);
      const retrieveUrl = new URL(request.url);
      retrieveUrl.pathname = `/retrieve/${savedKey}`;
      return Response.redirect(retrieveUrl.toString(), 302);
    } catch (error) {
      console.error('Error during image transformation:', error);
      return new Response('Internal server error', { status: 500 });
    }
  }
};

