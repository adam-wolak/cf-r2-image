// src/utils/htmlUtils.ts

export function extractImageUrls(html: string, baseUrl: string): string[] {
  const imageUrls = new Set<string>();
  const srcRegex = /<img[^>]+src\s*=\s*['"]([^'"]+)['"][^>]*>/gi;
  const srcsetRegex = /<img[^>]+srcset\s*=\s*['"]([^'"]+)['"][^>]*>/gi;

  let match;
  while ((match = srcRegex.exec(html)) !== null) {
    try {
      imageUrls.add(new URL(match[1], baseUrl).href);
    } catch (error) {
      console.error(`Error processing src URL: ${match[1]}`, error);
    }
  }

  while ((match = srcsetRegex.exec(html)) !== null) {
    const srcset = match[1];
    srcset.split(',').forEach(src => {
      try {
        const url = src.trim().split(' ')[0];
        imageUrls.add(new URL(url, baseUrl).href);
      } catch (error) {
        console.error(`Error processing srcset URL: ${src}`, error);
      }
    });
  }

  return Array.from(imageUrls);
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
