import { Env } from '../types';

/**
 * Sprawdza, czy obraz już istnieje w R2.
 * @param imageUrl URL obrazu do sprawdzenia.
 * @param env Obiekt środowiska zawierający odniesienie do bucketa R2.
 * @returns Zwraca 'exists' jeśli obraz już istnieje, 'not_found' w przeciwnym razie.
 */
export async function ensureImageInR2(imageUrl: string, env: Env): Promise<'exists' | 'not_found'> {
  const imageName = new URL(imageUrl).pathname.split('/').pop() || 'unknown';
  const object = await env.IMAGE_BUCKET.get(imageName);

  if (object) {
    console.log(`Image already exists in R2: ${imageName}`);
    return 'exists';
  }

  return 'not_found';
}

/**
 * Zapisuje obraz w R2, jeśli nie istnieje.
 * @param imageUrl URL obrazu do zapisania.
 * @param env Obiekt środowiska zawierający odniesienie do bucketa R2.
 * @returns Zwraca 'saved', 'skipped' lub 'error' w zależności od rezultatu operacji.
 */
export async function putImageToR2(imageUrl: string, env: Env): Promise<'saved' | 'skipped' | 'error'> {
  try {
    const exists = await ensureImageInR2(imageUrl, env);
    if (exists === 'exists') return 'skipped';

    const response = await fetch(imageUrl);
    if (!response.ok) {
      console.error(`Failed to fetch image: ${response.statusText}`);
      return 'error';
    }

    const imageData = await response.arrayBuffer();
    const imageName = new URL(imageUrl).pathname.split('/').pop() || 'unknown';

    await env.IMAGE_BUCKET.put(imageName, imageData);
    console.log(`Image saved in R2: ${imageName}`);
    return 'saved';
  } catch (error) {
    console.error(`Error saving image ${imageUrl}: ${(error as Error).message}`);
    return 'error';
  }
}
