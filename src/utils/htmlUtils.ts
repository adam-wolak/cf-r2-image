// src/utils/htmlUtils.ts

export function extractImageUrls(html: string, baseUrl: string): string[] {
  const imgRegex = /<img[^>]+src\s*=\s*['"]([^'"]+)['"][^>]*>/gi;
  const srcsetRegex = /srcset\s*=\s*['"]([^'"]+)['"]/gi;
  
  const urls = new Set<string>();
  
  let match;
  while ((match = imgRegex.exec(html)) !== null) {
    urls.add(new URL(match[1], baseUrl).href);
  }
  
  while ((match = srcsetRegex.exec(html)) !== null) {
    const srcset = match[1].split(',');
    for (const src of srcset) {
      const [url] = src.trim().split(' ');
      urls.add(new URL(url, baseUrl).href);
    }
  }
  
  return Array.from(urls);
}


export function parseImageDimensions(srcset?: string, sizes?: string): { width?: number, height?: number } {
  if (!srcset) {
    return {};
  }

  const srcsetEntries = srcset.split(',').map(entry => entry.trim().split(' '));
  let largestWidth = 0;
  let largestHeight = 0;

  srcsetEntries.forEach(entry => {
    const [, descriptor] = entry;
    if (descriptor) {
      const match = descriptor.match(/(\d+)([wx])/);
      if (match) {
        const [, value, unit] = match;
        const numValue = parseInt(value, 10);
        if (unit === 'w' && numValue > largestWidth) {
          largestWidth = numValue;
        } else if (unit === 'h' && numValue > largestHeight) {
          largestHeight = numValue;
        }
      }
    }
  });

  if (sizes) {
    const sizeEntries = sizes.split(',').map(entry => entry.trim());
    sizeEntries.forEach(entry => {
      const match = entry.match(/(\d+)px/);
      if (match) {
        const [, value] = match;
        const numValue = parseInt(value, 10);
        if (numValue > largestWidth) {
          largestWidth = numValue;
        }
      }
    });
  }

  const result: { width?: number, height?: number } = {};
  if (largestWidth > 0) {
    result.width = largestWidth;
  }
  if (largestHeight > 0) {
    result.height = largestHeight;
  }

  return result;
}
