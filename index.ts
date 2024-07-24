import { handleRequest } from './handlers/requestHandler';
import { config } from './config';

export interface Env {
  R2_BUCKET: R2Bucket;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return handleRequest(request, env.R2_BUCKET);
  },
};
