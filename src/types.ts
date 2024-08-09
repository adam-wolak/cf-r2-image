
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
  IMAGE_COLLECTOR: Fetcher;
  IMAGE_TRANSFORMER: Fetcher;
  TRANSFORM_PARAMS: {
    fit: string;
    gravity: string;
    quality: string;
  };
}

// Dodane interfejsy R2

export interface CollectorData {
  images: string[];
  // inne pola, jeśli są
}
export interface ExecutionContext {
  waitUntil(promise: Promise<any>): void;
  passThroughOnException(): void;
}

export interface R2Bucket {
  head(key: string): Promise<R2Object | null>;
  put(key: string, value: ReadableStream | ArrayBuffer, options?: R2PutOptions): Promise<R2Object>;
  get(key: string): Promise<R2ObjectBody | null>;
  delete(key: string): Promise<void>;
  list(options?: R2ListOptions): Promise<R2Objects>;
}

export interface R2Object {
  key: string;
  version: string;
  size: number;
  etag: string;
  httpEtag: string;
  checksums: R2Checksums;
  uploaded: Date;
  httpMetadata: {
    contentType?: string;
    [key: string]: string | undefined;
  };
  customMetadata: Record<string, string>;
  storageClass?: string;
}


export interface R2MultipartUpload {
  uploadId: string;
  key: string;
  // Dodaj inne potrzebne właściwości
}

export interface R2MultipartOptions {
  httpMetadata?: Headers | Record<string, string>;
  customMetadata?: Record<string, string>;
}


export interface R2ObjectBody extends R2Object {
  body: ReadableStream;
  bodyUsed: boolean;
  arrayBuffer(): Promise<ArrayBuffer>;
  text(): Promise<string>;
  json<T>(): Promise<T>;
  blob(): Promise<Blob>;
}

export interface R2PutOptions {
  onlyIf?: R2Conditional;
  httpMetadata?: Headers | Record<string, string>;
  customMetadata?: Record<string, string>;
  md5?: ArrayBuffer;
}

export interface R2Conditional {
  etagMatches?: string;
  etagDoesNotMatch?: string;
  uploadedBefore?: Date;
  uploadedAfter?: Date;
}

export interface R2ListOptions {
  limit?: number;
  prefix?: string;
  cursor?: string;
  delimiter?: string;
  include?: Array<'httpMetadata' | 'customMetadata'>;
}

export interface R2Objects {
  objects: R2Object[];
  truncated: boolean;
  cursor?: string;
  delimitedPrefixes: string[];
}

export interface R2Checksums {
  md5?: ArrayBuffer;
  sha1?: ArrayBuffer;
  sha256?: ArrayBuffer;
  sha384?: ArrayBuffer;
  sha512?: ArrayBuffer;
}

// Dodatkowe typy, które mogą być przydatne

export type R2Range =
  | { offset: number; length?: number }
  | { suffix: number }
  | { offset: number; suffix: number };

export interface R2GetOptions {
  onlyIf?: R2Conditional;
  range?: R2Range;
}
