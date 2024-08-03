import { Env } from '../types';
import { transformImage } from '../utils/imageUtils';
import { getOptimalImageFormat } from '../utils/browserUtils';

export async function handleTransform(request: Request, env: Env): Promise<Response> {
  console.log('Image Transformer: Received transform request');
  try {
    const body = await request.json();
    console.log('Image Transformer: Received body:', body);

    if (!body.images || !Array.isArray(body.images)) {
      return new Response(JSON.stringify({ error: 'Invalid request body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const userAgent = request.headers.get('User-Agent') || '';
    const optimalFormat = getOptimalImageFormat(userAgent);

    const transformedImages = await Promise.all(body.images.map(async (image: string) => {
      try {
        return await transformImage(image, env, optimalFormat);
      } catch (error) {
        console.error(`Error transforming image ${image}:`, error);
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
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    console.log(`Received ${request.method} request for ${request.url}`);
    
    if (request.method === 'POST' && new URL(request.url).pathname === '/transform') {
      return handleTransform(request, env);
    }
    
    return new Response('Not Found', { status: 404 });
  },
};
