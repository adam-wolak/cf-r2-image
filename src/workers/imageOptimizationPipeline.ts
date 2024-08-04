import { Env } from '../types';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const targetUrl = url.searchParams.get('url');

    if (!targetUrl) {
      return new Response('Missing url parameter', { status: 400 });
    }

    // Call Image Collector
    const collectorUrl = `https://${env.IMAGE_COLLECTOR_WORKER}/?url=${encodeURIComponent(targetUrl)}`;
    const collectorResponse = await fetch(collectorUrl);
    const collectorData = await collectorResponse.json();

    // Call Image Transformer
    const transformerUrl = `https://${env.IMAGE_TRANSFORMER_WORKER}`;
    const transformerResponse = await fetch(transformerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(collectorData),
    });
    const transformerData = await transformerResponse.json();

    return new Response(JSON.stringify(transformerData), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
