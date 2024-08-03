import { Env } from '../types';
import { ensureTransformedImageInR2 } from '../utils/r2Utils';
import { getOptimalImageFormat } from '../utils/browserUtils';

async function handleTransform(request: Request, env: Env): Promise<Response> {

  console.log('Image Transformer: Received transform request');
  const body = await request.json();
  console.log('Image Transformer: Received body:', body);
  console.log('Image Transformer: Starting transform process');
  const userAgent = request.headers.get('User-Agent') || '';
  const optimalFormat = getOptimalImageFormat(userAgent);

  try {
    const body = await request.json() as { images: string[] };
    const { images } = body;
    const transformedImages = [];

    for (const imageKey of images) {
      try {
        const dimensions = extractDimensions(imageKey);
        const transformedKey = await ensureTransformedImageInR2(imageKey, env.R2_BUCKET, env, optimalFormat, dimensions.width, dimensions.height);
        transformedImages.push(transformedKey);
      } catch (error) {
        console.error(`Error transforming image ${imageKey}:`, error);
      }
    }

    console.log('Image Transformer: Process completed successfully');
    return new Response(JSON.stringify({
      imagesTransformed: transformedImages.length,
      transformedImages
    }), {
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

function extractDimensions(key: string): { width?: number, height?: number } {
  const match = key.match(/-(\d+)x(\d+)\.[^.]+$/);
  if (match) {
    return { width: parseInt(match[1]), height: parseInt(match[2]) };
  }
  return {};
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    console.log(`Received ${request.method} request for ${request.url}`);
    
    if (request.method === 'POST' && new URL(request.url).pathname === '/transform') {
      return handleTransform(request, env);
    }
    
    // Handle other requests
    return new Response('Not Found', { status: 404 });
  },
};
