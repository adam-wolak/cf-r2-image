import { optimizeImageUrl, shouldSkipOptimization, isImageUrl, normalizeImageUrl } from '../utils/urlUtils';
import { getImageFromR2, saveImageToR2 } from '../utils/r2Storage';
import { config } from '../config';
import { createImageResponse } from '../utils/responseUtils';

export async function handleRequest(request: Request, r2Bucket: R2Bucket): Promise<Response> {
  console.log('Handling request:', request.url);
  
  const url = new URL(request.url);
  const path = url.pathname.slice(1); // Remove leading slash
  
  if (path) {
    // This is a request for an image
    const imageUrl = decodeURIComponent(path);
    return handleImageRequest(request, r2Bucket, imageUrl);
  } else {
    // This is a request for HTML modification
    const targetUrl = url.searchParams.get('url');
    if (!targetUrl) {
      console.log('Missing URL parameter');
      return new Response('Missing URL parameter', { status: 400 });
    }
    return handleHtmlRequest(request, targetUrl);
  }
}

async function handleImageRequest(request: Request, r2Bucket: R2Bucket, imageUrl: string): Promise<Response> {
  console.log('Handling image request:', imageUrl);

  const url = new URL(request.url);

  const options = {
    format: url.searchParams.get('format') || 'auto',
    width: parseInt(url.searchParams.get('width') || url.searchParams.get('v')?.split('x')[0] || '0', 10) || undefined,
    height: parseInt(url.searchParams.get('height') || url.searchParams.get('v')?.split('x')[1] || '0', 10) || undefined,
    fit: url.searchParams.get('fit') || config.TRANSFORM_PARAMS.fit,
    gravity: url.searchParams.get('gravity') || config.TRANSFORM_PARAMS.gravity,
    quality: parseInt(url.searchParams.get('quality') || config.TRANSFORM_PARAMS.quality, 10)
  };

  console.log('Transformation options:', options);

  const parsedUrl = new URL(imageUrl);
  const originalKey = parsedUrl.pathname.slice(1); // Usuń początkowy '/'
  const optimizedKey = `${originalKey}?${new URLSearchParams(Object.entries(options).filter(([_, v]) => v !== undefined) as any).toString()}`;

  console.log('Original key:', originalKey);
  console.log('Optimized key:', optimizedKey);

  try {
    // Próba pobrania oryginalnego obrazu z R2
    let imageBuffer = await getImageFromR2(originalKey, r2Bucket);

    if (!imageBuffer) {
      console.log('Original image not found in R2, fetching from origin');
      const originalResponse = await fetch(imageUrl);
      if (!originalResponse.ok) {
        throw new Error(`Failed to fetch original image: ${originalResponse.statusText}`);
      }
      imageBuffer = await originalResponse.arrayBuffer();
      // Zapisz oryginalny obraz w R2
      await saveImageToR2(originalKey, imageBuffer, r2Bucket);
      console.log('Original image saved to R2');
    } else {
      console.log('Original image found in R2');
    }

    // Próba pobrania zoptymalizowanego obrazu z R2
    let optimizedBuffer = await getImageFromR2(optimizedKey, r2Bucket);

    if (!optimizedBuffer) {
      console.log('Optimized image not found in R2, optimizing');
      const optimizedUrl = optimizeImageUrl(imageUrl, options);
      console.log('Optimized image URL:', optimizedUrl);

      const response = await fetch(optimizedUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch optimized image: ${response.statusText}`);
      }
      
      optimizedBuffer = await response.arrayBuffer();
      
      // Zapisz zoptymalizowany obraz w R2
      await saveImageToR2(optimizedKey, optimizedBuffer, r2Bucket);
      console.log('Optimized image saved to R2');
    } else {
      console.log('Optimized image found in R2');
    }

    const contentType = getContentTypeFromFormat(options.format);
    console.log('Content-Type:', contentType);

    const response = new Response(optimizedBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000',
        'Access-Control-Allow-Origin': '*',
      },
    });

    return response;
  } catch (error) {
    console.error('Error in handleImageRequest:', error);
    return new Response('Error processing image', { status: 500 });
  }
}

function getContentTypeFromFormat(format: string): string {
  switch (format) {
    case 'webp':
      return 'image/webp';
    case 'avif':
      return 'image/avif';
    case 'png':
      return 'image/png';
    case 'jpeg':
    case 'jpg':
      return 'image/jpeg';
    default:
      return 'image/jpeg';
  }
}


async function handleHtmlRequest(request: Request, targetUrl: string): Promise<Response> {
  console.log('Handling HTML request:', targetUrl);
  try {
    const response = await fetch(targetUrl);
    const contentType = response.headers.get('content-type');

    if (contentType && contentType.includes('text/html')) {
      let html = await response.text();
      html = modifyHtmlContent(html, new URL(targetUrl).origin);

      return new Response(html, {
        headers: {
          'content-type': 'text/html;charset=UTF-8',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    return response;
  } catch (error) {
    console.error('Error in handleHtmlRequest:', error);
    return new Response('Error processing HTML', { status: 500 });
  }
}

function modifyHtmlContent(html: string, baseUrl: string): string {
  const workerUrl = 'https://r2-image.bielskoclinic.workers.dev';

  // Modyfikacja src dla obrazów
  html = html.replace(/<img[^>]+src=["']([^"']+)["']/gi, (match, src) => {
    const fullSrc = new URL(src, baseUrl).href;
    const optimizedSrc = `${workerUrl}/${encodeURIComponent(fullSrc)}`;
    return match.replace(src, optimizedSrc);
  });

  // Modyfikacja srcset dla obrazów
  html = html.replace(/srcset=["']([^"']+)["']/gi, (match, srcset) => {
    const newSrcset = srcset.split(',').map(src => {
      const [url, size] = src.trim().split(' ');
      const fullUrl = new URL(url, baseUrl).href;
      const optimizedUrl = `${workerUrl}/${encodeURIComponent(fullUrl)}`;
      return `${optimizedUrl} ${size || ''}`;
    }).join(', ');
    return `srcset="${newSrcset}"`;
  });

  return html;
}
