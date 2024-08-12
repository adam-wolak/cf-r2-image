import { Env } from '../types';
import { extractImageUrls } from '../utils/htmlUtils';
import { normalizeUrl } from '../utils/imageUtils';
import { downloadImages } from '../utils/imageDownloader';
import { getNewImages, saveNewImagesToR2 } from '../utils/r2Diff';
import { enqueueUrls, dequeueUrl, getQueueSize } from '../utils/queueSystem';

async function handleRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const targetUrl = url.searchParams.get('url') || env.ORIGIN;

  try {
    // Najpierw ekstrahujemy URL-e
    const extractResult = await handleExtract(targetUrl, env);
    
    // Następnie przetwarzamy obrazy
    const processResults = await processAllImages(env);

    return new Response(JSON.stringify({
      extractResult,
      processResults
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error in handleRequest:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
  }
}

async function handleExtract(targetUrl: string, env: Env): Promise<any> {
  const baseUrl = new URL(targetUrl).origin;
  const response = await fetch(targetUrl);
  const html = await response.text();
  const imageUrls = extractImageUrls(html, baseUrl);
  
  await enqueueUrls(env, imageUrls);

  return {
    message: 'URLs extracted and enqueued',
    count: imageUrls.length,
    queueSize: await getQueueSize(env)
  };
}

async function processAllImages(env: Env): Promise<any[]> {
  const results = [];
  const BATCH_SIZE = 5; // Przetwarzaj obrazy w partiach po 5

  while (await getQueueSize(env) > 0) {
    const batch = [];
    for (let i = 0; i < BATCH_SIZE; i++) {
      const url = await dequeueUrl(env);
      if (url) batch.push(url);
      else break;
    }

    if (batch.length === 0) break;

    try {
      const imageMap = await downloadImages(batch, 'process');
      const newImages = await getNewImages(env.R2_BUCKET, imageMap, 'process');
      const savedImages = await saveNewImagesToR2(env.R2_BUCKET, newImages, 'process');

      results.push({
        message: 'Images processed',
        urls: batch,
        saved: savedImages.length
      });

      // Dodaj opóźnienie między partiami
      await new Promise(resolve => setTimeout(resolve, 5000));
    } catch (error) {
      console.error('Error processing image batch:', error);
      // Re-enqueue the URLs if processing failed
      await enqueueUrls(env, batch);
      results.push({
        error: 'Failed to process image batch',
        urls: batch
      });
    }
  }
  return results;
}


export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return handleRequest(request, env);
  }
};
