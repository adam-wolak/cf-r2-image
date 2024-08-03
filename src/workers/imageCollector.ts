import { Env } from '../types';
import { extractImageUrls } from '../utils/htmlUtils';
import { ensureImageInR2 } from '../utils/r2Utils';
import { normalizeUrl, addOriginalVersion, removeImageDimensions } from '../utils/imageUtils';

export async function handleRequest(request: Request, env: Env): Promise<Response> {
  console.log('Image Collector: Starting process');
  const url = new URL(request.url);
  const targetUrl = normalizeUrl(url.searchParams.get('url') || env.ORIGIN);
  const baseUrl = new URL(targetUrl).origin;
  console.log(`Processing URL: ${targetUrl}`);

  try {
    const originalResponse = await fetch(targetUrl);
    const html = await originalResponse.text();
    console.log('Image Collector: Extracted HTML');

    let imageUrls = extractImageUrls(html, baseUrl);
    console.log(`Image Collector: Found ${imageUrls.length} image URLs`);

    const originalVersions = imageUrls.map(addOriginalVersion).filter(Boolean) as string[];
    const noDimensionsVersions = imageUrls.map(removeImageDimensions);
    imageUrls = [...new Set([...imageUrls, ...originalVersions, ...noDimensionsVersions])];

    const processedImages = [];
    for (const imageUrl of imageUrls) {
      try {
        const key = await ensureImageInR2(normalizeUrl(imageUrl), env.R2_BUCKET, env);
        processedImages.push(key);
      } catch (error) {
        console.error(`Error processing image ${imageUrl}:`, error);
      }
    }

    console.log('Image Collector: Finished processing images');

    // Call the Image Transformer
    try {
      console.log('Calling Image Transformer...');
      const transformerResponse = await fetch(`https://${env.IMAGE_TRANSFORMER_WORKER}/transform`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': request.headers.get('User-Agent') || '',
        },
        body: JSON.stringify({ images: processedImages }),
      });

      console.log('Image Transformer response status:', transformerResponse.status);
      const responseText = await transformerResponse.text();
      console.log('Image Transformer response body:', responseText);
      const transformerResult = JSON.parse(responseText);
      console.log('Image Transformer result:', transformerResult);

      return new Response(JSON.stringify({
        collectorResult: {
          processedUrl: targetUrl,
          imagesFound: imageUrls.length,
          imagesProcessed: processedImages.length,
          images: processedImages
        },
        transformerResult
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Error calling Image Transformer:', error);
      console.error('Error details:', error.stack);
      return new Response(JSON.stringify({ error: 'Error calling Image Transformer' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  } catch (error) {
    console.error('Error in Image Collector:', error);
    return new Response(JSON.stringify({ error: 'Error in Image Collector' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export default {
  fetch: handleRequest,
};
