import { handleRequest } from './handlers/imageHandler';
import { corsHeaders } from './utils/responseUtils';

export interface Env {
  R2_BUCKET: R2Bucket;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    console.log('Received request:', request.url);
    console.log('R2_BUCKET available:', !!env.R2_BUCKET);

    // Ignoruj żądania favicon.ico
    if (request.url.endsWith('favicon.ico')) {
      return new Response(null, { status: 204 });
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: corsHeaders(request.headers.get('Origin') || '*'),
      });
    }

    try {
      const response = await handleRequest(request, env.R2_BUCKET);
      console.log('Response status:', response.status);
      return response;
    } catch (error) {
      console.error('Error in fetch handler:', error);
      return new Response('Internal Server Error', { status: 500 });
    }
  },
};
