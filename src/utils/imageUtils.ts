import { config } from '../config';

export async function optimizeImage(buffer: ArrayBuffer, format: string, width?: number, height?: number): Promise<ArrayBuffer> {
  const formData = new FormData();
  formData.append('file', new Blob([buffer]));

  const options = {
    format,
    width: width || 'auto',
    height: height || 'auto',
    fit: 'cover',
    quality: 80,
  };

  const optionsString = Object.entries(options)
    .map(([key, value]) => `${key}=${value}`)
    .join(',');

  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${config.CF_ACCOUNT_ID}/images/v1`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.CF_API_TOKEN}`,
    },
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Failed to optimize image: ${response.statusText}`);
  }

  const result = await response.json();
  const imageId = result.result.id;

  const optimizedResponse = await fetch(`https://imagedelivery.net/${config.CF_ACCOUNT_HASH}/${imageId}/${optionsString}`);
  
  if (!optimizedResponse.ok) {
    throw new Error(`Failed to fetch optimized image: ${optimizedResponse.statusText}`);
  }

  return optimizedResponse.arrayBuffer();
}
