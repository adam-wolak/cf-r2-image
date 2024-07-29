import { TransformParams } from '../types';
import { config } from '../config';

export async function transformImage(imageBuffer: ArrayBuffer, params: any, format: string): Promise<ArrayBuffer | null> {
  const blob = new Blob([imageBuffer]);
  const formData = new FormData();
  formData.append('file', blob, 'image');
  
  const transformUrl = new URL(`${config.ORIGIN}/cdn-cgi/image/`);
  Object.entries(params).forEach(([key, value]) => {
    transformUrl.searchParams.append(key, value.toString());
  });
  transformUrl.searchParams.append('format', format);

  console.log(`Transforming image with URL: ${transformUrl.toString()}`);

  const response = await fetch(transformUrl.toString(), {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    console.error(`Error transforming image: ${response.status} ${response.statusText}`);
    return null;
  }

  return response.arrayBuffer();
