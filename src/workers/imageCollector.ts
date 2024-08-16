import { Env } from '../types';
import { CONFIG } from '../config';
import { extractImageUrls } from '../utils/htmlUtils';
import { XMLParser } from 'fast-xml-parser';

export class SitemapProcessor {
  state: DurableObjectState;
  env: Env;
  parser: XMLParser;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
    this.parser = new XMLParser({ ignoreAttributes: false });
  
    // Inicjalizacja processedUrls jako pustej tablicy, jeśli nie istnieje
    this.state.storage.get('processedUrls').then((processedUrls: unknown) => {
     if (!Array.isArray(processedUrls)) {
      this.state.storage.put('processedUrls', []);
    }
   });
  }


  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const action = url.searchParams.get('action');

    switch (action) {
      case 'start':
        return this.startProcessing(request);
      case 'status':
        return this.getStatus();
      default:
        return new Response('Invalid action', { status: 400 });
    }
  }

  async startProcessing(request: Request): Promise<Response> {
    const { domain } = await request.json() as { domain: string };
    this.state.blockConcurrencyWhile(async () => {
      await this.processEntireSitemap(domain);
    });
    return new Response('Processing started', { status: 202 });
  }

  async getStatus(): Promise<Response> {
    const status = await this.state.storage.get('status') || 'Not started';
    const processedUrls = await this.state.storage.get('processedUrls') || [];
    return new Response(JSON.stringify({ status, processedUrls }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  async processEntireSitemap(domain: string): Promise<void> {
    await this.state.storage.put('status', 'Processing');
    const sitemapIndexUrl = `${domain}${CONFIG.SITEMAP_INDEX_PATH}`;
    const sitemaps = await this.getSitemapsFromIndex(sitemapIndexUrl);
    
    const relevantSitemaps = CONFIG.RELEVANT_SITEMAPS.map(path => `${domain}${path}`);
    
    for (const sitemapUrl of sitemaps.filter(url => relevantSitemaps.includes(url))) {
      await this.processSitemap(sitemapUrl);
    }

    await this.state.storage.put('status', 'Completed');
  }

  async getSitemapsFromIndex(indexUrl: string): Promise<string[]> {
    const response = await fetch(indexUrl);
    const xmlData = await response.text();
    const result = this.parser.parse(xmlData);
    return result.sitemapindex.sitemap.map((item: any) => item.loc);
  }

  async processSitemap(sitemapUrl: string): Promise<void> {
    const response = await fetch(sitemapUrl);
    const xmlData = await response.text();
    const result = this.parser.parse(xmlData);
    const urls = result.urlset.url.map((item: any) => item.loc);

   for (const url of urls) {
    console.log(`Processing page: ${url}`);
    await this.processPage(url);
    
    const processedUrls = await this.state.storage.get('processedUrls') as string[] | null;
    if (Array.isArray(processedUrls)) {
      processedUrls.push(url);
      await this.state.storage.put('processedUrls', processedUrls);
    } else {
      await this.state.storage.put('processedUrls', [url]);
    }
  }
}


  async processPage(url: string): Promise<void> {
    const images = await this.processAllImages(url);
    console.log(`Processed ${images[0] + images[1] + images[2]} images for ${url}`);
  }

  async processAllImages(url: string): Promise<number[]> {
    const response = await fetch(url);
    const html = await response.text();
    
    const imageUrls = extractImageUrls(html, url);
    
    let newImagesSaved = 0;
    let imagesUpdated = 0;
    let imagesUnchanged = 0;
    let failedToProcess = 0;
    
    const MAX_IMAGES_PER_INVOCATION = 50;
    
    for (let i = 0; i < Math.min(imageUrls.length, MAX_IMAGES_PER_INVOCATION); i++) {
      const imageUrl = imageUrls[i];
      try {
        const result = await this.processImageWithRetry(imageUrl);
        if (result.status === 'saved') newImagesSaved++;
        else if (result.status === 'updated') imagesUpdated++;
        else if (result.status === 'unchanged') imagesUnchanged++;
        
        if (i % 10 === 0) {
          console.log(`Processed ${i} out of ${Math.min(imageUrls.length, MAX_IMAGES_PER_INVOCATION)} images`);
        }
      } catch (error) {
        console.error(`Failed to process image ${imageUrl}: ${error}`);
        failedToProcess++;
      }
    }
    
    console.log(`New images saved: ${newImagesSaved}`);
    console.log(`Images updated: ${imagesUpdated}`);
    console.log(`Images unchanged: ${imagesUnchanged}`);
    console.log(`Failed to process: ${failedToProcess}`);
    console.log(`Total processed images: ${newImagesSaved + imagesUpdated + imagesUnchanged}`);
    
    return [newImagesSaved, imagesUpdated, imagesUnchanged, failedToProcess];
  }

  async processImageWithRetry(imageUrl: string, retries = 3): Promise<any> {
    for (let i = 0; i < retries; i++) {
      try {
        return await this.processImage(imageUrl);
      } catch (error) {
        console.error(`Attempt ${i + 1} failed for ${imageUrl}: ${error}`);
        if (i === retries - 1) throw error;
      }
    }
  }

  async processImage(imageUrl: string): Promise<any> {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();

    const objectKey = new URL(imageUrl).pathname.slice(1);
    
    try {
      const existingObject = await this.env.IMAGE_BUCKET.get(objectKey, { onlyIf: { etagDoesNotMatch: '*' } });
      
      if (existingObject === null) {
        await this.env.IMAGE_BUCKET.put(objectKey, arrayBuffer, {
          httpMetadata: {
            cacheControl: this.env.R2_CACHE_CONTROL,
          },
        });
        return { status: 'saved', message: 'Image successfully saved to R2' };
      } else {
        const existingSize = existingObject.size;
        const newSize = arrayBuffer.byteLength;
        
        if (existingSize === newSize) {
          return { status: 'unchanged', message: 'Image already exists and has the same size' };
        } else {
          await this.env.IMAGE_BUCKET.put(objectKey, arrayBuffer, {
            httpMetadata: {
              cacheControl: this.env.R2_CACHE_CONTROL,
            },
          });
          return { status: 'updated', message: 'Image successfully updated in R2' };
        }
      }
    } catch (error) {
      console.error(`Error processing image ${imageUrl}: ${error}`);
      throw error;
    }
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const action = url.searchParams.get('action') || 'start';
    const domain = url.searchParams.get('domain');

    if (!domain) {
      return new Response('Missing domain parameter', { status: 400 });
    }

    const id = env.SITEMAP_PROCESSOR.idFromName(domain);
    const obj = env.SITEMAP_PROCESSOR.get(id);

    let durableObjectResponse;
    switch (action) {
      case 'start':
        durableObjectResponse = await obj.fetch(new Request(request.url, {
          method: 'POST',
          body: JSON.stringify({ domain }),
        }));
        break;
      case 'status':
        durableObjectResponse = await obj.fetch(request);
        break;
      default:
        return new Response('Invalid action', { status: 400 });
    }

    return durableObjectResponse;
  }
};
