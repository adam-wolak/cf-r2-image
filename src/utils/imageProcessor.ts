import { R2Bucket } from '@cloudflare/workers-types';

export async function downloadAndSaveImage(imageUrl: string, bucket: R2Bucket): Promise<any> {
  try {
    const imagePath = new URL(imageUrl).pathname;
    
    // Sprawdź, czy obraz już istnieje w R2
    const existingObject = await bucket.head(imagePath);
    if (existingObject) {
      return {
        status: 'skipped',
        message: 'Image already exists in R2',
        url: imageUrl
      };
    }

    // Pobierz obraz
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const arrayBuffer = await response.arrayBuffer();

    // Zapisz obraz w R2
    await bucket.put(imagePath, arrayBuffer, {
      httpMetadata: { contentType: contentType }
    });

    return {
      status: 'saved',
      message: 'Image successfully saved to R2',
      url: imageUrl
    };
  } catch (error) {
    console.error(`Error processing image ${imageUrl}:`, error);
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error',
      url: imageUrl
    };
  }
}

