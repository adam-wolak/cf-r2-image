import { extractImagePath } from './imageUtils';

const MAX_RETRIES = 5;
const INITIAL_RETRY_DELAY = 5000; // 5 sekund
const MAX_RETRY_DELAY = 30000; // 30 sekund

export async function downloadImages(imageUrls: string[], requestId: string): Promise<Map<string, ArrayBuffer>> {
  const imageMap = new Map<string, ArrayBuffer>();
  console.log(`[${requestId}] Attempting to fetch ${imageUrls.length} images`);

  for (const url of imageUrls) {
    await downloadImage(url, imageMap, requestId, 0);
    // Dodaj losowe opóźnienie między 1 a 3 sekundy
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
  }

  console.log(`[${requestId}] Successfully fetched ${imageMap.size} out of ${imageUrls.length} images`);
  return imageMap;
}

async function downloadImage(url: string, imageMap: Map<string, ArrayBuffer>, requestId: string, retryCount: number): Promise<void> {
  try {
    const imagePath = extractImagePath(url);
    if (!imagePath) {
      console.log(`[${requestId}] Skipping image with invalid path: ${url}`);
      return;
    }

    const response = await fetch(url);
    if (response.ok) {
      const buffer = await response.arrayBuffer();
      imageMap.set(imagePath, buffer);
      console.log(`[${requestId}] Successfully fetched and mapped: ${imagePath}`);
    } else {
      console.log(`[${requestId}] Failed to fetch image (status ${response.status}): ${url}`);
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('Too many subrequests') && retryCount < MAX_RETRIES) {
      const delay = Math.min(INITIAL_RETRY_DELAY * Math.pow(2, retryCount), MAX_RETRY_DELAY);
      console.log(`[${requestId}] Too many subrequests for ${url}, retrying in ${delay / 1000} seconds...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      await downloadImage(url, imageMap, requestId, retryCount + 1);
    } else {
      console.log(`[${requestId}] Error fetching image ${url}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
