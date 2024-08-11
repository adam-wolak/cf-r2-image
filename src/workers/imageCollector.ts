import type { R2Bucket } from '@cloudflare/workers-types';
import { Env } from '../types';
import { extractImageUrls } from '../utils/htmlUtils';
import { normalizeUrl, addOriginalVersion, removeImageDimensions } from '../utils/imageUtils';


interface ProcessLog {
  requestId: string;
  steps: string[];
}



function extractImagePath(url: string): string | null {
  const match = url.match(/wp-content\/uploads\/.+/);
  return match ? match[0] : null;
}

function getMimeType(url: string): string {
  if (url.endsWith('.webp')) return 'image/webp';
  if (url.endsWith('.png')) return 'image/png';
  if (url.endsWith('.jpg') || url.endsWith('.jpeg')) return 'image/jpeg';
  if (url.endsWith('.gif')) return 'image/gif';
  return 'application/octet-stream';
}

async function fetchAllImages(imageUrls: string[]): Promise<Map<string, ArrayBuffer>> {
  const imageMap = new Map<string, ArrayBuffer>();
  console.log(`Attempting to fetch ${imageUrls.length} images`);


  const fetchPromises = imageUrls.map(async (url) => {
    try {
      const imagePath = extractImagePath(url);
      if (!imagePath) {
        console.log(`Skipping image with invalid path: ${url}`);
        return;
      }

      const response = await fetch(url);
      if (response.ok) {
        const buffer = await response.arrayBuffer();
        imageMap.set(imagePath, buffer);
        console.log(`Successfully fetched and mapped: ${imagePath}`);
      } else {
        console.log(`Failed to fetch image (status ${response.status}): ${url}`);
      }
    } catch (error) {
      console.error(`Error fetching image ${url}:`, error);
    }
  });

  await Promise.all(fetchPromises);

  console.log(`Successfully fetched ${imageMap.size} out of ${imageUrls.length} images`);
  return imageMap;
}


async function listExistingImagesInR2(bucket: R2Bucket): Promise<Set<string>> {

  addLog(requestId, `Processing URL: ${targetUrl}`);

  const existingImages = new Set<string>();
  let truncated = true;
  let cursor: string | undefined;

  while (truncated) {
    const listed = await bucket.list({ prefix: 'wp-content/uploads/', cursor });
    for (const object of listed.objects) {
      existingImages.add(object.key);
    }
    truncated = listed.truncated;
    cursor = listed.truncated ? listed.cursor : undefined;
  }

  return existingImages;
}

async function saveNewImagesToR2(bucket: R2Bucket, imageMap: Map<string, ArrayBuffer>, existingImages: Set<string>): Promise<string[]> {
  const savedImages: string[] = [];
  addLog(requestId, `Processing URL: ${targetUrl}`);

  const savePromises = Array.from(imageMap.entries()).map(async ([path, buffer]) => {
    if (!existingImages.has(path)) {
      await bucket.put(path, buffer, {
        httpMetadata: { contentType: getMimeType(path) },
      });
      savedImages.push(path);
    }
  });

  await Promise.all(savePromises);
  return savedImages;
}

interface ProcessLog {
  requestId: string;
  steps: string[];
}

const processLogs: Map<string, ProcessLog> = new Map();

function addLog(requestId: string, message: string) {
  let log = processLogs.get(requestId);
  if (!log) {
    log = { requestId, steps: [] };
    processLogs.set(requestId, log);
  }
  log.steps.push(`${new Date().toISOString()} - ${message}`);
  console.log(`[${requestId}] ${message}`);
}

export async function handleRequest(request: Request, env: Env): Promise<Response> {
  const startTime = Date.now();
  const requestId = Math.random().toString(36).substring(7);
  addLog(requestId, 'Image Collector: Starting process');
  
  const url = new URL(request.url);
  const targetUrl = normalizeUrl(url.searchParams.get('url') || env.ORIGIN);
  const baseUrl = new URL(targetUrl).origin;

  addLog(requestId, `Processing URL: ${targetUrl}`);

  try {
    const originalResponse = await fetch(targetUrl);
    const html = await originalResponse.text();
    addLog(requestId, `Raw HTML length: ${html.length}`);

    let imageUrls = extractImageUrls(html, baseUrl)
      .filter(url => url.includes('/wp-content/uploads/') && !url.endsWith('.svg') && !url.includes('favicon'));
    addLog(requestId, `Image Collector: Found ${imageUrls.length} unique image URLs (including srcset, excluding SVG and favicon)`);

    // Add original versions of images and versions without dimensions
    const originalVersions = imageUrls.map(addOriginalVersion).filter(Boolean) as string[];
    const noDimensionsVersions = imageUrls.map(removeImageDimensions).filter(Boolean);
    imageUrls = [...new Set([...imageUrls, ...originalVersions, ...noDimensionsVersions])];

    addLog(requestId, `Total unique image URLs to process: ${imageUrls.length}`);

    const imageMap = await fetchAllImages(imageUrls, requestId);
    addLog(requestId, `Successfully fetched ${imageMap.size} images`);

    const existingImages = await listExistingImagesInR2(env.R2_BUCKET as any);
    addLog(requestId, `Found ${existingImages.size} existing images in R2`);

    const savedImages = await saveNewImagesToR2(env.R2_BUCKET as any, imageMap, existingImages, requestId);
    addLog(requestId, `Saved ${savedImages.length} new images to R2`);

    const endTime = Date.now();
    const totalTime = (endTime - startTime) / 1000;
    addLog(requestId, `Image Collector: Finished processing images. Total time: ${totalTime} seconds`);

    const log = processLogs.get(requestId);
    processLogs.delete(requestId);

    return new Response(JSON.stringify({
      requestId,
      processedUrl: targetUrl,
      imagesFound: imageUrls.length,
      imagesProcessed: savedImages.length + existingImages.size,
      newImagesSaved: savedImages.length,
      existingImages: existingImages.size,
      totalTime: totalTime,
      log: log?.steps
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    addLog(requestId, `Error in handleRequest: ${error instanceof Error ? error.message : 'Unknown error'}`);
    const log = processLogs.get(requestId);
    processLogs.delete(requestId);
    return new Response(JSON.stringify({ 
      requestId,
      error: 'Internal Server Error', 
      message: error instanceof Error ? error.message : 'Unknown error',
      log: log?.steps
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function fetchAllImages(imageUrls: string[], requestId: string): Promise<Map<string, ArrayBuffer>> {
  const imageMap = new Map<string, ArrayBuffer>();
  addLog(requestId, `Attempting to fetch ${imageUrls.length} images`);

  for (const url of imageUrls) {
    try {
      const imagePath = extractImagePath(url);
      if (!imagePath) {
        addLog(requestId, `Skipping image with invalid path: ${url}`);
        continue;
      }

      const response = await fetch(url);
      if (response.ok) {
        const buffer = await response.arrayBuffer();
        imageMap.set(imagePath, buffer);
        addLog(requestId, `Successfully fetched and mapped: ${imagePath}`);
      } else {
        addLog(requestId, `Failed to fetch image (status ${response.status}): ${url}`);
      }
    } catch (error) {
      addLog(requestId, `Error fetching image ${url}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  addLog(requestId, `Successfully fetched ${imageMap.size} out of ${imageUrls.length} images`);
  return imageMap;
}

// Podobnie zmodyfikuj funkcje listExistingImagesInR2 i saveNewImagesToR2, dodając parametr requestId i używając addLog


export default {
  fetch: handleRequest,
};
