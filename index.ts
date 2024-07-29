import { Env } from './types';
import { handleRequest } from './handlers/requestHandler';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    console.log("Worker started processing request");
    console.log("Available environment variables:", Object.keys(env));
    console.log("R2_BUCKET available:", !!env.R2_BUCKET);
    try {
      const response = await handleRequest(request, env, ctx);
      console.log("Request processed successfully");
      return response;
    } catch (error) {
      console.error("Error in worker:", error);
      return new Response("Internal Server Error", { status: 500 });
    }
  }
};
