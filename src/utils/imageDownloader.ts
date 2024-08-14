import { extractImagePath } from './imageUtils';

const MAX_RETRIES = 5;
const INITIAL_RETRY_DELAY = 5000; // 5 sekund
const MAX_RETRY_DELAY = 30000; // 30 sekund

export async function downloadImage(imageUrl: string): Promise<ArrayBuffer> {
  console.log(`Attempting to download image: ${imageUrl}`);
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.statusText}`);
  }
  const buffer = await response.arrayBuffer();
  console.log(`Successfully downloaded image: ${imageUrl}, size: ${buffer.byteLength} bytes`);
  return buffer;
}

export async function downloadImages(imageUrls: string[], requestId: string): Promise<Map<string, ArrayBuffer>> {
  console.log(`[${requestId}] Downloading ${imageUrls.length} images`);
  const images = new Map<string, ArrayBuffer>();

  const downloadPromises = imageUrls.map(async (url) => {
    try {
      const imageBuffer = await downloadImage(url);
      images.set(url, imageBuffer);
      console.log(`[${requestId}] Downloaded image: ${url}`);
    } catch (error) {
      console.error(`[${requestId}] Failed to download image ${url}: ${error}`);
    }
  });

  await Promise.all(downloadPromises);

  console.log(`[${requestId}] Downloaded ${images.size} out of ${imageUrls.length} images`);
  return images;
}



