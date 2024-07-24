import { config } from '../config';
import { optimizeImage } from '../utils/imageUtils';

export function modifyHtmlContent(html: string, baseUrl: string): string {
  // Modyfikacja src dla obrazów
  html = html.replace(/<img[^>]+src=["']([^"']+)["']/gi, (match, src) => {
    const fullSrc = new URL(src, baseUrl).href;
    if (!fullSrc.toLowerCase().endsWith('.jpg') && !fullSrc.toLowerCase().endsWith('.jpeg')) {
      return match; // Nie modyfikuj, jeśli to nie jest JPG
    }
    const optimizedSrc = getOptimizedImageUrl(fullSrc);
    return match.replace(src, optimizedSrc);
  });

  // Modyfikacja srcset dla obrazów
  html = html.replace(/srcset=["']([^"']+)["']/gi, (match, srcset) => {
    const newSrcset = srcset.split(',').map(src => {
      const [url, size] = src.trim().split(' ');
      const fullUrl = new URL(url, baseUrl).href;
      if (!fullUrl.toLowerCase().endsWith('.jpg') && !fullUrl.toLowerCase().endsWith('.jpeg')) {
        return `${url} ${size || ''}`; // Nie modyfikuj, jeśli to nie jest JPG
      }
      const optimizedUrl = getOptimizedImageUrl(fullUrl, size);
      return `${optimizedUrl} ${size || ''}`;
    }).join(', ');
    return `srcset="${newSrcset}"`;
  });

  return html;
}

async function getOptimizedImageUrl(url: string, r2Bucket: R2Bucket, bestFormat: string, size?: string): Promise<string> {
  const parsedUrl = new URL(url);
  const pathParts = parsedUrl.pathname.split('/').filter(Boolean);
  const fileName = pathParts[pathParts.length - 1];
  const fileNameWithoutExtension = fileName.replace(/\.\w+$/, '');
  
  let width, height;
  if (size) {
    [width, height] = size.split('x').map(Number);
  } else {
    const match = fileName.match(/-(\d+)x(\d+)\./);
    if (match) {
      [, width, height] = match.map(Number);
    }
  }

  const optimizedFileName = width && height 
    ? `${fileNameWithoutExtension}-${width}x${height}.${bestFormat}`
    : `${fileNameWithoutExtension}.${bestFormat}`;
  const optimizedKey = `${pathParts.slice(0, -1).join('/')}/${optimizedFileName}`;

  // Sprawdź, czy zoptymalizowany obraz istnieje w R2
  let optimizedBuffer = await getImageFromR2(optimizedKey, r2Bucket);
  
  if (!optimizedBuffer) {
    console.log('Optimized image not found in R2, optimizing...');

    // Pobierz oryginalny obraz
    const originalResponse = await fetch(url);
    if (!originalResponse.ok) {
      throw new Error(`Failed to fetch original image: ${originalResponse.statusText}`);
    }
    const originalBuffer = await originalResponse.arrayBuffer();

    // Zapisz oryginalny obraz w R2
    await saveImageToR2(pathParts.join('/'), originalBuffer, r2Bucket);

    // Optymalizuj obraz
    optimizedBuffer = await optimizeImage(originalBuffer, bestFormat, width, height);

    // Zapisz zoptymalizowany obraz w R2
    await saveImageToR2(optimizedKey, optimizedBuffer, r2Bucket);
    console.log('Optimized image saved to R2');
  } else {
    console.log('Optimized image found in R2');
  }

  return `${config.R2_PUB}/${optimizedKey}`;
}
