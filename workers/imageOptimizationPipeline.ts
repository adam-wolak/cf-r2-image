import { Env } from '../types';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const imageCollectorUrl = `https://${env.IMAGE_COLLECTOR_WORKER}${url.pathname}${url.search}`;
    return fetch(imageCollectorUrl, request);
  }
};
