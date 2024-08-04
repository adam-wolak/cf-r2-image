import { Env } from '../types';
import { getOptimalImageFormat } from '../utils/browserUtils';
import { parseImageDimensions } from '../utils/htmlUtils';

async function transformImage(
  imageUrl: string, 
  env: Env, 
  userAgent: string, 
  srcset?: string, 
  sizes?: string
): Promise<string> {
  console.log(`Transforming image: ${imageUrl}`);
  
  const url = new URL(imageUrl);
  const imagePath = url.pathname;
  
  // Określamy optymalny format na podstawie User-Agent
  const optimalFormat = getOptimalImageFormat(userAgent);
  
  // Parsujemy wymiary obrazu z srcset i sizes
  const dimensions = parseImageDimensions(srcset, sizes);
  
  // Ustawienia transformacji
  const width = dimensions.width || 'auto';
  const height = dimensions.height || 'auto';
  const fit = env.TRANSFORM_PARAMS.fit;
  const quality = env.TRANSFORM_PARAMS.quality;
  
  // Tworzymy URL transformacji
  const transformedUrl = `${env.CLOUDFLARE_ZONE}/cdn-cgi/image/format=${optimalFormat},width=${width},height=${height},fit=${fit},quality=${quality}${imagePath}`;
  
  console.log(`Transformed URL: ${transformedUrl}`);
  return transformedUrl;
}

export async function handleTransform(request: Request, env: Env): Promise<Response> {
  console.log('Image Transformer: Received transform request');
  try {
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    const contentType = request.headers.get('Content-Type');
    if (!contentType || !contentType.includes('application/json')) {
      return new Response('Invalid Content-Type', { status: 400 });
    }

    const body = await request.json() as { images: Array<{ url: string, srcset?: string, sizes?: string }> };
    console.log('Image Transformer: Received body:', body);

    if (!body || !body.images || !Array.isArray(body.images)) {
      return new Response(JSON.stringify({ error: 'Invalid request body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const userAgent = request.headers.get('User-Agent') || '';

    const transformedImages = await Promise.all(body.images.map(async (image) => {
      try {
        return await transformImage(image.url, env, userAgent, image.srcset, image.sizes);
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
  fetch: handleTransform,
} as const;
