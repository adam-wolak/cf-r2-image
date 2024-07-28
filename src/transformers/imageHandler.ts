import { config } from '../config';
import { getImageDimensions } from '../utils/imageUtils';

export async function transformImage(originalImage: ArrayBuffer, imagePath: string, format: string): Promise<ArrayBuffer> {
  const { width, height } = getImageDimensions(imagePath);
  
  const transformUrl = new URL(`${config.ORIGIN}/cdn-cgi/image/`);
  transformUrl.searchParams.set('format', format);
  if (width) transformUrl.searchParams.set('width', width.toString());
  if (height) transformUrl.searchParams.set('height', height.toString());
  transformUrl.searchParams.set('fit', config.TRANSFORM_PARAMS.fit);
  transformUrl.searchParams.set('gravity', config.TRANSFORM_PARAMS.gravity);
  transformUrl.searchParams.set('quality', config.TRANSFORM_PARAMS.quality);

  console.log(`Transforming image: ${transformUrl.toString()}`);

  const response = await fetch(transformUrl.toString(), {
    method: 'POST',
    body: originalImage
  });

  if (!response.ok) {
    throw new Error('Error transforming image');
  }

  return response.arrayBuffer();
}
