import { Env, R2Object } from '../types';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (request.url.endsWith('favicon.ico')) {
      return new Response('Not Found', { status: 404 });
    }

    try {
      const objects = await env.R2_BUCKET.list();
      const results = await processImages(objects.objects, env, ctx);
      return new Response(JSON.stringify(results), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      return new Response(`Error processing images: ${error}`, { status: 500 });
    }
  }
};

async function processImages(objects: R2Object[], env: Env, ctx: ExecutionContext): Promise<any[]> {
  const queue = new AsyncQueue();
  const results: any[] = [];

  for (const object of objects) {
    if (object.key.includes('/slider/cache/')) {
      continue; // Pomijamy pliki w katalogu cache
    }

    queue.enqueue(async () => {
      try {
        const originalImageUrl = `${env.R2_PUB}/${object.key}`;
        const sizes = getSizesFromKey(object.key);

        for (const size of sizes) {
          for (const format of ['webp', 'avif']) {
            const newKey = `${object.key.replace(/\.[^/.]+$/, '')}-${size.width}x${size.height}.${format}`;
            
            // Sprawdź, czy obraz już istnieje
            const existingObject = await env.R2_BUCKET.head(newKey);
            if (existingObject) {
              results.push({ originalKey: object.key, newKey, format, size, status: 'skipped' });
              continue;
            }

            const transformedImageUrl = `${env.CLOUDFLARE_ZONE}/cdn-cgi/image/format=${format},width=${size.width},height=${size.height},fit=${env.TRANSFORM_PARAMS.fit},gravity=${env.TRANSFORM_PARAMS.gravity},quality=${env.TRANSFORM_PARAMS.quality}/${originalImageUrl}`;
            const response = await fetch(transformedImageUrl);
            
            if (!response.ok) {
              throw new Error(`Failed to fetch transformed image: ${response.status} ${response.statusText}`);
            }

            const transformedImage = await response.arrayBuffer();

            await env.R2_BUCKET.put(newKey, transformedImage, {
              httpMetadata: {
                contentType: `image/${format}`,
              },
            });

            results.push({ originalKey: object.key, newKey, format, size, status: 'transformed' });
          }
        }
      } catch (error) {
        results.push({ key: object.key, error: `Error processing: ${error}` });
      }
    });
  }

  ctx.waitUntil(queue.run());
  return results;
}

function getSizesFromKey(key: string): Array<{width: number, height: number}> {
  const sizes = [{width: 800, height: 600}]; // Default size
  const sizeMatch = key.match(/-(\d+)x(\d+)\./);
  if (sizeMatch) {
    sizes.push({
      width: parseInt(sizeMatch[1]),
      height: parseInt(sizeMatch[2])
    });
  }
  return sizes;
}

class AsyncQueue {
  private queue: (() => Promise<void>)[] = [];
  private running = false;

  enqueue(task: () => Promise<void>) {
    this.queue.push(task);
  }

  async run() {
    if (this.running) return;
    this.running = true;
    while (this.queue.length > 0) {
      const task = this.queue.shift();
      if (task) await task();
    }
    this.running = false;
  }
}
