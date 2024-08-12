import { R2Bucket as CloudflareR2Bucket, R2Object as CloudflareR2Object } from '@cloudflare/workers-types';

export type R2Object = CloudflareR2Object;
export interface ProcessedImage {
  url: string;
  base64: string;
}

export interface ProcessLog {
  requestId: string;
  steps: string[];
}

export interface Env {
  R2_BUCKET: CloudflareR2Bucket;
  bielskoclinic: KVNamespace;
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
  TRANSFORM_PARAMS: {
    fit: string;
    gravity: string;
    quality: string;
  };
}

export interface CollectorData {
  images: string[];
  // inne pola, jeśli są
}

export interface ExecutionContext {
  waitUntil(promise: Promise<any>): void;
  passThroughOnException(): void;
}

