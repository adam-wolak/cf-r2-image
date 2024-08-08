import type { Env } from '../types';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return handleRequest(request, env);
  },
};

async function handleRequest(request: Request, env: Env): Promise<Response> {
  console.log('Image Optimization Pipeline: Received request');

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
    const collectorResponse = await callImageCollector(targetUrl, env, request.headers.get('User-Agent'));
    if (!collectorResponse.ok) {
      throw new Error(`Image Collector responded with status: ${collectorResponse.status}`);
    }

    const collectorData = await collectorResponse.json();
    console.log('Image Optimization Pipeline: Image Collector response:', collectorData);

    // Wywołanie Image Transformer
    const transformerResponse = await callImageTransformer(collectorData, env);
    if (!transformerResponse.ok) {
      throw new Error(`Image Transformer responded with status: ${transformerResponse.status}`);
    }

    const transformerData = await transformerResponse.json();
    console.log('Image Optimization Pipeline: Image Transformer response:', transformerData);

    return new Response(JSON.stringify({
      status: 'success',
      message: 'Image optimization complete',
      data: transformerData
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    console.error('Error in Image Optimization Pipeline:', error);
    let errorMessage: string;
    if (error instanceof Error) {
      errorMessage = `${error.name}: ${error.message}`;
      console.error('Error stack:', error.stack);
    } else {
      errorMessage = String(error);
    }
    return new Response(JSON.stringify({
      status: 'error',
      message: errorMessage
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function callImageCollector(targetUrl: string, env: Env, userAgent: string | null): Promise<Response> {
  console.log('Image Optimization Pipeline: Calling Image Collector');
  
  const url = new URL(env.IMAGE_COLLECTOR_WORKER);
  url.searchParams.set('url', targetUrl);
  if (userAgent) {
    url.searchParams.set('ua', userAgent);
  }

  console.log(`Image Optimization Pipeline: Final Collector URL: ${url.toString()}`);
  
  try {
    const response = await fetch(url.toString());
    console.log(`Image Optimization Pipeline: Collector response status: ${response.status}`);
    if (!response.ok) {
      const responseText = await response.text();
      console.error(`Image Optimization Pipeline: Collector error response: ${responseText}`);
    }
    return response;
  } catch (error) {
    console.error('Error fetching from Image Collector:', error);
    throw error;
  }
}

async function callImageTransformer(collectorData: any, env: Env): Promise<Response> {
  console.log('Image Optimization Pipeline: Calling Image Transformer');
  
  const url = new URL(env.IMAGE_TRANSFORMER_WORKER);
  
  try {
    const response = await fetch(url.toString(), {
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
    }
    return response;
  } catch (error) {
    console.error('Error fetching from Image Transformer:', error);
    throw error;
  }
}

