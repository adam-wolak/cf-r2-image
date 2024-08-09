import { Env } from '../types';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      console.log(`Image Collector Worker URL: ${env.IMAGE_COLLECTOR_WORKER}`);
      
      const url = new URL(env.IMAGE_COLLECTOR_WORKER);
      url.searchParams.set('url', request.url);

      const collectorResponse = await env.IMAGE_COLLECTOR.fetch(url.toString(), {
        method: 'GET',
        headers: request.headers
      });

      if (!collectorResponse.ok) {
        throw new Error(`Image Collector failed with status ${collectorResponse.status}`);
      }

      const collectorData = await collectorResponse.json() as CollectorData;
      console.log('Collector data:', JSON.stringify(collectorData));

      // Przetwarzanie obrazów w mniejszych partiach, aby uniknąć timeoutu
      const batchSize = 10; // Możesz dostosować tę wartość
      const transformedImages = [];

      for (let i = 0; i < collectorData.images.length; i += batchSize) {
        const batch = collectorData.images.slice(i, i + batchSize);
        const batchPromises = batch.map(imageUrl => this.transformImage(imageUrl, env));
        const batchResults = await Promise.all(batchPromises);
        transformedImages.push(...batchResults);
      }

      const validTransformedImages = transformedImages.filter((img): img is object => img !== null);

      return new Response(JSON.stringify(validTransformedImages), {
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('Error in Image Optimization Pipeline:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      return new Response('Internal Server Error: ' + errorMessage, { status: 500 });
    }
  },
  async transformImage(imageUrl: string, env: Env): Promise<object | null> {
    try {
      const transformerUrl = new URL(env.IMAGE_TRANSFORMER_WORKER);
      transformerUrl.searchParams.set('url', imageUrl);

      const response = await env.IMAGE_TRANSFORMER.fetch(transformerUrl.toString(), {
        method: 'GET'
      });

      if (!response.ok) {
        console.error(`Failed to transform image ${imageUrl}: ${response.status}`);
        return null;
      }

      return response.json();
    } catch (error) {
      console.error(`Error transforming image ${imageUrl}:`, error);
      return null;
    }
  }
};


async function handleRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const targetUrl = url.searchParams.get('url');
  const userAgent = request.headers.get('User-Agent');

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
    if (!collectorData || typeof collectorData !== 'object') {
      throw new Error('Invalid response from Image Collector');
    }

    // Wywołanie Image Transformer
    const transformerResponse = await callImageTransformer(collectorData, env);
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
  console.log(`Image Collector Worker URL: ${env.IMAGE_COLLECTOR_WORKER}`);
  
  const url = new URL(env.IMAGE_COLLECTOR_WORKER);
  url.searchParams.set('url', targetUrl);
  console.log(`Full Image Collector URL: ${url.toString()}`);

  const headers = new Headers();
  if (userAgent) {
    headers.set('User-Agent', userAgent);
  }
  console.log(`Headers: ${JSON.stringify(Object.fromEntries(headers))}`);

  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: headers,
    });
    console.log(`Image Collector response status: ${response.status}`);
    return response;
  } catch (error) {
    console.error('Error fetching from Image Collector:', error);
    throw error;
  }
}


async function callImageTransformer(data: any, env: Env): Promise<Response> {
  console.log('Image Optimization Pipeline: Calling Image Transformer');
  
  try {
    const response = await env.IMAGE_TRANSFORMER.fetch(env.IMAGE_TRANSFORMER_WORKER, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
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
