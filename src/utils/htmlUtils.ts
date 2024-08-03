// src/utils/htmlUtils.ts

export function extractImageUrls(html: string, baseUrl: string): string[] {
  const imageUrls = new Set<string>();

  // Regex do wyodrębnienia src z tagów img
  const srcRegex = /<img[^>]+src\s*=\s*['"]([^'"]+)['"][^>]*>/gi;
  let match;
  while ((match = srcRegex.exec(html)) !== null) {
    imageUrls.add(new URL(match[1], baseUrl).href);
  }

  // Regex do wyodrębnienia srcset z tagów img
  const srcsetRegex = /<img[^>]+srcset\s*=\s*['"]([^'"]+)['"][^>]*>/gi;
  while ((match = srcsetRegex.exec(html)) !== null) {
    const srcset = match[1];
    srcset.split(',').forEach(src => {
      const url = src.trim().split(' ')[0];
      imageUrls.add(new URL(url, baseUrl).href);
    });
  }

  return Array.from(imageUrls);
}
