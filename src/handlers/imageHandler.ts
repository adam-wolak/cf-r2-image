import { getImageFromR2, saveImageToR2 } from '../utils/r2Storage';
import { optimizeImage } from '../utils/imageUtils';
import { config } from '../config';

export async function handleImageRequest(request: Request, r2Bucket: R2Bucket, imageUrl: string): Promise<Response> {
  console.log('Handling image request:', imageUrl);

  const url = new URL(request.url);
  const parsedImageUrl = new URL(imageUrl);
  const pathParts = parsedImageUrl.pathname.split('/').filter(Boolean);
  
  const originalKey = pathParts.join('/');
  const originalFormat = pathParts[pathParts.length - 1].split('.').pop()?.toLowerCase();

  // Skupiamy się tylko na plikach JPG
  if (originalFormat !== 'jpg' && originalFormat !== 'jpeg') {
    console.log('Not a JPG file, returning original URL');
    return Response.redirect(imageUrl, 302);
  }

  const bestFormat = 'avif'; // Zawsze używamy AVIF

  const options = {
    format: bestFormat,
    width: parseInt(url.searchParams.get('width') || '0', 10) || undefined,
    height: parseInt(url.searchParams.get('height') || '0', 10) || undefined,
    fit: url.searchParams.get('fit') as 'cover' | 'contain' | 'fill' | 'inside' | 'outside' || 'cover',
    quality: parseInt(url.searchParams.get('quality') || '80', 10)
  };

  console.log('Transformation options:', options);

  const optimizedKey = `${originalKey.replace(/\.\w+$/, '')}-${options.width}x${options.height || options.width}.${bestFormat}`;

  console.log('Original key:', originalKey);
  console.log('Optimized key:', optimizedKey);

  try {
    // Sprawdź, czy zoptymalizowany obraz już istnieje w R2
    let optimizedBuffer = await getImageFromR2(optimizedKey, r2Bucket);
    
    if (!optimizedBuffer) {
      console.log('Optimized image not found in R2, optimizing...');

      // Pobierz oryginalny obraz
      const originalResponse = await fetch(imageUrl);
      if (!originalResponse.ok) {
        throw new Error(`Failed to fetch original image: ${originalResponse.statusText}`);
      }
      const originalBuffer = await originalResponse.arrayBuffer();

      // Optymalizuj obraz
      optimizedBuffer = await optimizeImage(originalBuffer, bestFormat, options.width, options.height);

      // Zapisz zoptymalizowany obraz w R2
      await saveImageToR2(optimizedKey, optimizedBuffer, r2Bucket);
      console.log('Optimized image saved to R2');
    } else {
      console.log('Optimized image found in R2');
    }

    const publicOptimizedUrl = `${config.R2_PUB}/${optimizedKey}`;
    
    return Response.redirect(publicOptimizedUrl, 302);
  } catch (error) {
    console.error('Error in handleImageRequest:', error);
    return new Response('Error processing image', { status: 500 });
  }
}
