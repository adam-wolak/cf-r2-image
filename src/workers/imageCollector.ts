import { XMLParser } from 'fast-xml-parser';
import { Env, DurableObjectState } from '../types';
import { CONFIG } from '../config';

const BATCH_SIZE = 10;
const DELAY_BETWEEN_REQUESTS = 1000; // 1 second
const MAX_IMAGES_PER_INVOCATION = 50

interface ProcessingRequest {
  env: Env;
  domain: string;
}

export class SitemapProcessor {
  state: DurableObjectState;
  parser: XMLParser;

  constructor(state: DurableObjectState) {
    this.state = state;
    this.parser = new XMLParser({ ignoreAttributes: false });
  }

async fetch(request: Request) {
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

async startProcessing(request: Request) {
  const { domain, env } = await request.json() as { domain: string, env: Env };
  this.state.blockConcurrencyWhile(async () => {
    await this.processEntireSitemap(env, domain);
  });
  return new Response('Processing started', { status: 202 });
}


  async getStatus() {
    const status = await this.state.storage.get('status') || 'Not started';
    const processedUrls = await this.state.storage.get('processedUrls') || [];
    return new Response(JSON.stringify({ status, processedUrls }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  async processEntireSitemap(env: Env, domain: string) {
    await this.state.storage.put('status', 'Processing');
    const sitemapIndexUrl = `${domain}${CONFIG.SITEMAP_INDEX_PATH}`;
    const sitemaps = await this.getSitemapsFromIndex(sitemapIndexUrl);
    
    const relevantSitemaps = CONFIG.RELEVANT_SITEMAPS.map(path => `${domain}${path}`);
    
    for (const sitemapUrl of sitemaps.filter(url => relevantSitemaps.includes(url))) {
      await this.processSitemap(sitemapUrl, env);
    }

    await this.state.storage.put('status', 'Completed');
  }

  async getSitemapsFromIndex(indexUrl: string): Promise<string[]> {
    const response = await fetch(indexUrl);
    const xmlData = await response.text();
    const result = this.parser.parse(xmlData);
    return result.sitemapindex.sitemap.map((item: any) => item.loc);
  }

  async processSitemap(sitemapUrl: string, env: Env) {
    const response = await fetch(sitemapUrl);
    const xmlData = await response.text();
    const result = this.parser.parse(xmlData);
    const urls = result.urlset.url.map((item: any) => item.loc);

    for (const url of urls) {
      console.log(`Processing page: ${url}`);
      await this.processPage(url, env);
      const processedUrls = await this.state.storage.get('processedUrls') || [];
      processedUrls.push(url);
      await this.state.storage.put('processedUrls', processedUrls);
    }
  }

  async processPage(url: string, env: Env) {
    const images = await processAllImages(url, env);
    if (i % 10 === 0) {
    console.log(`Processed ${i} out of ${Math.min(imageUrls.length, MAX_IMAGES_PER_INVOCATION)} images`);
  }    

}

async function processAllImages(url: string, env: Env): Promise<any[]> {
  console.log(`Processing page: ${url}`);
  const response = await fetch(url);
  const html = await response.text();
  
  const imageUrls = extractImageUrls(html, url);
  
  let newImagesSaved = 0;
  let imagesUpdated = 0;
  let imagesUnchanged = 0;
  let failedToProcess = 0;
  
  for (let i = 0; i < Math.min(imageUrls.length, MAX_IMAGES_PER_INVOCATION); i++) {
    const imageUrl = imageUrls[i];
    try {
      const result = await processImageWithRetry(imageUrl, env);
      if (result.status === 'saved') newImagesSaved++;
      else if (result.status === 'updated') imagesUpdated++;
      else if (result.status === 'unchanged') imagesUnchanged++;
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


async function processImageWithRetry(imageUrl: string, env: Env, retries = 3): Promise<any> {
  for (let i = 0; i < retries; i++) {
    try {
      return await processImage(imageUrl, env);
    } catch (error) {
      console.error(`Attempt ${i + 1} failed for ${imageUrl}: ${error}`);
      if (i === retries - 1) throw error;
    }
  }
}

async function processImage(imageUrl: string, env: Env): Promise<any> {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();

  const objectKey = new URL(imageUrl).pathname.slice(1);
  
  try {
    const existingObject = await env.IMAGE_BUCKET.get(objectKey, { onlyIf: { etagDoesNotMatch: '*' } });
    
    if (existingObject === null) {
      // Obraz nie istnieje, zapisz go
      await env.IMAGE_BUCKET.put(objectKey, arrayBuffer, {
        httpMetadata: {
          cacheControl: env.R2_CACHE_CONTROL,
        },
      });
      return { status: 'saved', message: 'Image successfully saved to R2' };
    } else {
      // Obraz istnieje, sprawdź rozmiar
      const existingSize = existingObject.size;
      const newSize = arrayBuffer.byteLength;
      
      if (existingSize === newSize) {
        return { status: 'unchanged', message: 'Image already exists and has the same size' };
      } else {
        // Aktualizuj obraz
        await env.IMAGE_BUCKET.put(objectKey, arrayBuffer, {
          httpMetadata: {
            cacheControl: env.R2_CACHE_CONTROL,
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


function extractImageUrls(html: string, baseUrl: string): string[] {
  const imgRegex = /<img[^>]+(?:src|data-src|srcset|data-srcset)=["']?([^"'\s>]+)["']?[^>]*>/g;
  const urls: string[] = [];
  let match;
  while ((match = imgRegex.exec(html)) !== null) {
    let url = match[1];
    if (url.startsWith('//')) {
      url = 'https:' + url;
    } else if (url.startsWith('/')) {
      url = new URL(url, baseUrl).href;
    } else if (!url.startsWith('http')) {
      url = new URL(url, baseUrl).href;
    }
    urls.push(url);
  }
  return urls;
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

    switch (action) {
      case 'start':
        return obj.fetch(new Request(request.url, {
          method: 'POST',
          body: JSON.stringify({ domain, env }),
        }));
      case 'status':
        return obj.fetch(request);
      default:
        return new Response('Invalid action', { status: 400 });
    }
  }
};

