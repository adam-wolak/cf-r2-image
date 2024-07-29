import { TransformParams } from '../types';
import { config } from '../config';

export async function transformImage(imagePath: string, params: TransformParams, format: string): Promise<ArrayBuffer | null> {
  const transformUrl = new URL(`${config.CLOUDFLARE_ZONE}/cdn-cgi/image/`);

  // Dodaj parametry transformacji do URL
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      transformUrl.searchParams.append(key, value.toString());
    }
  });

  // Dodaj format do parametrów URL
  transformUrl.searchParams.append('format', format);

  // Dodaj ścieżkę obrazu do URL
  transformUrl.pathname += imagePath.startsWith('/') ? imagePath.slice(1) : imagePath;

  console.log(`Transforming image with URL: ${transformUrl.toString()}`);

  try {
    const response = await fetch(transformUrl.toString());

    if (!response.ok) {
      console.error(`Error transforming image: ${response.status} ${response.statusText}`);
      return null;
    }

    return response.arrayBuffer();
  } catch (error) {
    console.error(`Error fetching transformed image: ${error}`);
    return null;
  }
}
