import type { Env } from '../types';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return handleRequest(request, env);
  },
};

async function handleRequest(request: Request, env: Env): Promise<Response> {
  console.log('Image Optimization Pipeline: Received request');
  console.log('Request URL:', request.url);
  console.log('Request method:', request.method);
  console.log('Environment variables:', JSON.stringify(env, null, 2))

  const url = new URL(request.url);

  // Obsługa żądania favicon.ico
  if (url.pathname === '/favicon.ico') {
    return new Response('No favicon', { status: 404 });
  }

  const targetUrl = url.searchParams.get('url');

if (!targetUrl) {
  console.log('Image Optimization Pipeline: Missing url parameter');
  return new Response(JSON.stringify({
    status: 'error',
    message: 'Missing url parameter'
  }), {
    status: 400,
    headers: { 'Content-Type': 'application/json' }
  });
}

console.log(`Image Optimization Pipeline: Processing URL: ${targetUrl}`);

try {
  // Wywołanie Image Collector
  const collectorResponse = await callImageCollector(targetUrl, env, userAgent);
  if (!collectorResponse.ok) {
    throw new Error(`Image Collector responded with status: ${collectorResponse.status}`);
  }
  const collectorData = await collectorResponse.json();

  // Sprawdzenie, czy collectorData zawiera oczekiwane dane
  if (!collectorData || !Array.isArray(collectorData.images) || collectorData.images.length === 0) {
    throw new Error('Invalid or empty response from Image Collector');
  }

  // Wywołanie Image Transformer
  const transformerResponse = await callImageTransformer(collectorData.images, env);
  if (!transformerResponse.ok) {
    throw new Error(`Image Transformer responded with status: ${transformerResponse.status}`);
  }
  const transformedData = await transformerResponse.json();

  // Zwrócenie przetworzonego wyniku
  return new Response(JSON.stringify({
    status: 'success',
    data: transformedData
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });

} catch (error) {
  console.error('Error in Image Optimization Pipeline:', error);
  return new Response(JSON.stringify({
    status: 'error',
    message: error instanceof Error ? error.message : 'An unknown error occurred'
  }), {
    status: 500,
    headers: { 'Content-Type': 'application/json' }
  });
}
}

async function callImageCollector(targetUrl: string, env: Env, userAgent: string | null): Promise<Response> {
  console.log('Image Optimization Pipeline: Calling Image Collector');
  
  const params = new URLSearchParams();
  params.set('url', targetUrl);
  if (userAgent) {
    params.set('ua', userAgent);
  }

  console.log(`Image Optimization Pipeline: Calling Collector with params: ${params.toString()}`);


  try {
    const response = await env.IMAGE_TRANSFORMER.fetch(env.IMAGE_TRANSFORMER_WORKER, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(collectorData),
    });  
    console.log(`Image Optimization Pipeline: Collector response status: ${response.status}`);
    if (!response.ok) {
      const responseText = await response.text();
      console.error(`Image Optimization Pipeline: Collector error response: ${responseText}`);
      throw new Error(`Image Collector responded with status: ${response.status}`);
    }
    return response;
  } catch (error) {
    console.error('Error fetching from Image Collector:', error);
    throw error;
  }
}

async function callImageTransformer(images: string[], env: Env): Promise<Response> {
  console.log('Image Optimization Pipeline: Calling Image Transformer');
  
  const collectorData = { images };  // Tworzymy obiekt collectorData

  try {
    const response = await env.IMAGE_TRANSFORMER.fetch(env.IMAGE_TRANSFORMER_WORKER, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(collectorData),
    });
    console.log(`Image Optimization Pipeline: Transformer response status: ${response.status}`);
    if (!response.ok) {
      const responseText = await response.text();
      console.error(`Image Optimization Pipeline: Transformer error response: ${responseText}`);
      throw new Error(`Image Transformer responded with status: ${response.status}`);
    }
    return response;
  } catch (error) {
    console.error('Error fetching from Image Transformer:', error);
    throw error;
  }
}

