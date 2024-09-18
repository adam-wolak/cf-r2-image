import { Env } from '../types';

const QUEUE_KEY = 'IMAGE_PROCESSING_QUEUE';

export async function enqueueUrls(env: Env, urls: string[]): Promise<void> {
  const existingQueue = JSON.parse(await env.bielskoclinic.get(QUEUE_KEY) || '[]');
  const newQueue = [...new Set([...existingQueue, ...urls])];
  await env.bielskoclinic.put(QUEUE_KEY, JSON.stringify(newQueue));
}

export async function dequeueUrl(env: Env): Promise<string | null> {
  const queueStr = await env.bielskoclinic.get(QUEUE_KEY);
  if (!queueStr) return null;
  
  const queue = JSON.parse(queueStr);
  if (queue.length === 0) return null;
  
  const url = queue.shift();
  await env.bielskoclinic.put(QUEUE_KEY, JSON.stringify(queue));
  return url;
}

export async function getQueueSize(env: Env): Promise<number> {
  const queueStr = await env.bielskoclinic.get(QUEUE_KEY);
  if (!queueStr) return 0;
  
  const queue = JSON.parse(queueStr);
  return queue.length;
}
