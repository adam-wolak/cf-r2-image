// src/types.ts

import {
  R2Bucket,
  R2Object,
  KVNamespace,
  DurableObjectNamespace,
  DurableObjectState,
  ExecutionContext,
  Fetcher,
} from '@cloudflare/workers-types';

// Dodajemy import dla Browser
import type { Browser } from 'puppeteer-core';

export type {
  R2Bucket,
  R2Object,
  KVNamespace,
  DurableObjectNamespace,
  DurableObjectState,
  ExecutionContext,
  Fetcher,
};

export interface ProcessedImage {
  url: string;
  base64: string;
}

export interface ProcessLog {
  requestId: string;
  steps: string[];
}

export interface ImageInfo {
  url: string;
}

export interface Env {
  R2_BUCKET: R2Bucket;
  IMAGE_BUCKET: R2Bucket;
  bielskoclinic: KVNamespace; 
  CACHE: KVNamespace;
  SITEMAP_PROCESSOR: DurableObjectNamespace;
  WORKER_URL: string;
  ZONE_ID: string;
  ORIGIN: string;
  R2_ENDPOINT: string;
  R2_PUB: string;
  R2_BUCKET_NAME: string;
  R2_BUCKET_URL: string;
  R2_REGION: string;
  R2_CACHE_CONTROL: string;
  CLOUDFLARE_ZONE: string;
  IMAGE_TRANSFORMER_WORKER: string;
  API_TOKEN: string;
  ACCOUNT_HASH: string;
  AUTH_KEY_SECRET: string;
  IMAGE_COLLECTOR_WORKER: string;
  IMAGE_COLLECTOR: Fetcher;
  IMAGE_TRANSFORMER: Fetcher;
  MYBROWSER: Browser; // Teraz Browser jest poprawnie zdefiniowany
  TRANSFORM_PARAMS: {
    fit: string;
    gravity: string;
    quality: string;
  };
}

export interface CollectorData {
  images: string[];
  // Additional fields if necessary
}
