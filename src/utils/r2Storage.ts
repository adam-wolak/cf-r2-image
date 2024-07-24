export async function getImageFromR2(key: string, r2Bucket: R2Bucket): Promise<ArrayBuffer | null> {
  const object = await r2Bucket.get(key);
  if (object === null) {
    return null;
  }
  return await object.arrayBuffer();
}

export async function saveImageToR2(key: string, buffer: ArrayBuffer, r2Bucket: R2Bucket): Promise<void> {
  await r2Bucket.put(key, buffer);
}
