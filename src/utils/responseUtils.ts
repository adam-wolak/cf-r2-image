export function createImageResponse(imageBuffer: ArrayBuffer, format: string, originalUrl: string): Response {
  const contentType = getContentTypeFromFormat(format);

  return new Response(imageBuffer, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000',
      'CF-Cache-Status': 'DYNAMIC',
      'ETag': `"${originalUrl}"`,
    },
    cf: { cacheTtl: 31536000, cacheEverything: true },
  });
}


export function corsHeaders(origin: string) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

export function getContentTypeFromFormat(format: string): string {
  switch (format.toLowerCase()) {
    case 'jpeg':
    case 'jpg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'avif':
      return 'image/avif';
    default:
      return 'application/octet-stream';
  }
}
