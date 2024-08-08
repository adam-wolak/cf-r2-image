import { Env } from '../types';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    console.log('Image Optimization Pipeline: Received request');
    try {
      const url = new URL(request.url);
      const targetUrl = url.searchParams.get('url');

      if (!targetUrl) {
        console.log('Image Optimization Pipeline: Missing url parameter');
        return new Response(JSON.stringify({ error: 'Missing url parameter' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Call Image Collector
      console.log('Image Optimization Pipeline: Calling Image Collector');
      const collectorUrl = `https://${env.IMAGE_COLLECTOR_WORKER}/?url=${encodeURIComponent(targetUrl)}`;
      const collectorResponse = await fetch(collectorUrl);
      console.log('Image Optimization Pipeline: Collector URL:', collectorUrl);

      
      if (!collectorResponse.ok) {
        console.error('Image Optimization Pipeline: Image Collector responded with non-OK status:', collectorResponse.status);
        throw new Error(`Image Collector responded with status: ${collectorResponse.status}`);
      }

      const collectorData = await collectorResponse.json();
      console.log('Image Optimization Pipeline: Received data from Image Collector:', JSON.stringify(collectorData));

      // Call Image Transformer
      console.log('Image Optimization Pipeline: Calling Image Transformer');
      const transformerUrl = `https://${env.IMAGE_TRANSFORMER_WORKER}`;
      const transformerResponse = await fetch(transformerUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(collectorData),
      });

      if (!transformerResponse.ok) {
        console.error('Image Optimization Pipeline: Image Transformer responded with non-OK status:', transformerResponse.status);
        throw new Error(`Image Transformer responded with status: ${transformerResponse.status}`);
      }

      const transformerData = await transformerResponse.json();
      console.log('Image Optimization Pipeline: Received data from Image Transformer:', JSON.stringify(transformerData));

      return new Response(JSON.stringify(transformerData), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('Error in Image Optimization Pipeline:', error);
      return new Response(JSON.stringify({ 
        error: 'Error in Image Optimization Pipeline', 
        details: error instanceof Error ? error.message : String(error) 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
};
