// src/utils/utils.ts

import { parse } from 'parse5';
import { R2Bucket } from '@cloudflare/workers-types';

/**
 * Function to extract image URLs from sliders
 * @param html HTML content of the page to process
 * @returns List of image URLs
 */
export function extractSliderImageUrls(html: string): string[] {
  const document = parse(html);
  const urls: string[] = [];

  function traverse(node: any) {
    if (node.tagName) {
      // Check for elements with class `n2-ss-slide-background-image`
      const classAttr = node.attrs?.find((attr: any) => attr.name === 'class');
      const hasTargetClass = classAttr?.value.includes('n2-ss-slide-background-image');

      if (hasTargetClass) {
        if (node.tagName === 'img') {
          // Extract `src` attribute from `img` elements
          const srcAttr = node.attrs.find((attr: any) => attr.name === 'src');
          if (srcAttr) {
            urls.push(srcAttr.value);
          }
        } else if (node.tagName === 'source') {
          // Extract `srcset` attribute from `source` elements
          const srcsetAttr = node.attrs.find((attr: any) => attr.name === 'srcset');
          if (srcsetAttr) {
            const srcArray = srcsetAttr.value.split(',').map((src: string) => src.trim().split(' ')[0]);
            urls.push(...srcArray);
          }
        }
      }
    }

    // Recursively traverse child nodes
    if (node.childNodes) {
      node.childNodes.forEach((child: any) => traverse(child));
    }
  }

  traverse(document);

  return urls;
}

/**
 * Function to save images to Cloudflare R2
 * @param imageUrl URL of the image to download
 * @param bucket R2 Bucket to save the image
 */
export async function saveImageToR2(imageUrl: string, bucket: R2Bucket): Promise<void> {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.statusText}`);
  }
  const imageData = await response.arrayBuffer();
  const imageName = imageUrl.split('/').pop() || 'unknown';
  await bucket.put(imageName, imageData, {
    httpMetadata: {
      contentType: response.headers.get('content-type') || 'application/octet-stream',
    },
  });
}
