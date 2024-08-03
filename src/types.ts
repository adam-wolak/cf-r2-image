export interface Env {
  R2_BUCKET: R2Bucket;
  IMAGE_TRANSFORMER_WORKER: string;
  WORKER_URL: string;
  API_TOKEN: string;
  ZONE_ID: string;
  ACCOUNT_HASH: string;
  AUTH_KEY_SECRET: string;
  ORIGIN: string;
  R2_ENDPOINT: string;
  R2_PUB: string;
  R2_BUCKET_NAME: string;
  R2_BUCKET_URL: string;
  R2_REGION: string;
  R2_CACHE_CONTROL: string;
  CLOUDFLARE_ZONE: string;
  TRANSFORM_PARAMS: {
    fit: string;
    gravity: string;
    quality: string;
  };
}

