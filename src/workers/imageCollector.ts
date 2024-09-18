import { Env } from '../types';
import { SitemapProcessor } from '../utils/sitemapProcessor';
import { CONFIG } from '../config'; // Import konfiguracji

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    
    if (request.method === 'POST' && url.pathname === '/process-sitemap') {
      try {
        const requestBody = await request.json().catch(() => ({ sitemapUrl: '' })) as { sitemapUrl: string };

        if (!requestBody.sitemapUrl) {
          return new Response('Invalid sitemap URL', { status: 400 });
        }

        const processor = env.SITEMAP_PROCESSOR.get(env.SITEMAP_PROCESSOR.idFromName('default'));
        const sitemapUrls = CONFIG.RELEVANT_SITEMAPS.map(path => new URL(path, requestBody.sitemapUrl).toString());

        let allUrls: string[] = [];
        for (const sitemapUrl of sitemapUrls) {
          const response = await processor.fetch('https://example.com/process-sitemap', {
            method: 'POST',
            body: JSON.stringify({ sitemapUrl }),
          });

          const responseData = await response.json() as { urls: string[] };
          const { urls } = responseData;
          allUrls = allUrls.concat(urls);
        }

        return new Response(JSON.stringify({ urls: allUrls }), { status: 200 });

      } catch (error) {
        return new Response('Error processing sitemap', { status: 500 });
      }
    }

    // Obsługa GET dla `/`
    if (request.method === 'GET' && url.pathname === '/') {
      return new Response('Worker is running. Use POST /process-sitemap to process a sitemap.', { status: 200 });
    }

    return new Response('Invalid request', { status: 400 });
  },
};

// Eksport obiektu Durable Object SitemapProcessor
export { SitemapProcessor };
