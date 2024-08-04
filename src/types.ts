export interface ProcessedImage {
  url: string;
  base64: string;
}

export interface Env {
  R2_BUCKET: R2Bucket;
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
  TRANSFORM_PARAMS: {
    fit: string;
    gravity: string;
    quality: string;
  };
}
