import { Env } from '../types';
import { getOptimalImageFormat } from '../utils/browserUtils';

async function transformImage(imageUrl: string, env: Env, optimalFormat: string): Promise<string> {
  // Implementacja transformacji obrazu
  console.log(`Transforming image: ${imageUrl} to format: ${optimalFormat}`);
  // Tutaj dodaj logikę transformacji obrazu
  // Na razie zwracamy oryginalny URL jako przykład
  return imageUrl;
}

export async function handleTransform(request: Request, env: Env): Promise<Response> {
  console.log('Image Transformer: Received transform request');
  try {
    const body = await request.json() as { images: string[] };
    console.log('Image Transformer: Received body:', body);

    if (!body || !body.images || !Array.isArray(body.images)) {
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

     return new Response(JSON.stringify({ 
      transformedImages: transformedImages.filter(Boolean) 
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

export default {
  fetch: handleTransform,
};
