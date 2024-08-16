// src/utils/htmlUtils.ts


export function extractImageUrls(html: string, baseUrl: string): string[] {
  const imgRegex = /<img[^>]+(?:src|data-src)=["']?([^"'\s>]+)["']?[^>]*>/g;
  const urls: string[] = [];
  const baseUrlObj = new URL(baseUrl);
  
  let totalImagesFound = 0;
  let match;
  while ((match = imgRegex.exec(html)) !== null) {
    totalImagesFound++;
    let url = match[1];
    
    // Pomijamy pliki SVG
    if (url.toLowerCase().endsWith('.svg')) {
      continue;
    }
    
    // Tworzymy pełny URL
    if (url.startsWith('//')) {
      url = 'https:' + url;
    } else if (url.startsWith('/')) {
      url = new URL(url, baseUrl).href;
    } else if (!url.startsWith('http')) {
      url = new URL(url, baseUrl).href;
    }
    
    // Sprawdzamy, czy obraz jest z tej samej domeny
    const imageUrlObj = new URL(url);
    if (imageUrlObj.hostname === baseUrlObj.hostname) {
      urls.push(url);
    }
  }
  
  console.log(`Total images found: ${totalImagesFound}`);
  console.log(`Images after filtering: ${urls.length}`);
  console.log(`Filtered out images: ${totalImagesFound - urls.length}`);
  console.log(`Extracted ${urls.length} valid image URLs from ${baseUrl}`);
  
  return urls;
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
