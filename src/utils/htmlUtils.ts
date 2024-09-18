// src/utils/htmlUtils.ts

import { parse } from 'parse5';
import type { Browser } from 'puppeteer-core';
import { Env } from '../types';

export async function fetchRenderedPage(url: string, browser: Browser): Promise<string> {
  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'load' });
    const content = await page.content();
    await page.close();
    return content;
  } catch (error) {
    console.error(`Failed to render page ${url}: ${(error as Error).message}`);
    return '';
  }
}

export function extractImageUrlsFromHtml(html: string, baseUrl: string): string[] {
  const document = parse(html);
  const urlsSet = new Set<string>();

  function traverse(node: any) {
    if (node.tagName) {
      if (node.tagName === 'img' && node.attrs) {
        const srcAttr = node.attrs.find((attr: any) => attr.name === 'src');
        if (srcAttr) {
          const url = normalizeImageUrl(srcAttr.value, baseUrl);
          if (url) {
            urlsSet.add(url);
          }
        }

        const srcsetAttr = node.attrs.find((attr: any) => attr.name === 'srcset');
        if (srcsetAttr) {
          const srcsetUrls = extractUrlsFromSrcset(srcsetAttr.value, baseUrl);
          srcsetUrls.forEach((url) => urlsSet.add(url));
        }
      }

      const styleAttr = node.attrs?.find((attr: any) => attr.name === 'style');
      if (styleAttr) {
        const backgroundUrlMatch = /background(?:-image)?:\s*url\(['"]?(.*?)['"]?\)/i.exec(styleAttr.value);
        if (backgroundUrlMatch) {
          const bgUrl = normalizeImageUrl(backgroundUrlMatch[1], baseUrl);
          if (bgUrl) {
            urlsSet.add(bgUrl);
          }
        }
      }

      if (node.tagName === 'source' && node.attrs) {
        const srcsetAttr = node.attrs.find((attr: any) => attr.name === 'srcset');
        if (srcsetAttr) {
          const srcsetUrls = extractUrlsFromSrcset(srcsetAttr.value, baseUrl);
          srcsetUrls.forEach((url) => urlsSet.add(url));
        }
      }
    }

    if (node.childNodes) {
      node.childNodes.forEach((child: any) => traverse(child));
    }
  }

  traverse(document);

  return Array.from(urlsSet).filter(filterOriginalImages);
}

function normalizeImageUrl(src: string, baseUrl: string): string | null {
  try {
    return new URL(src, baseUrl).href;
  } catch {
    console.error(`Invalid image URL: ${src} on page ${baseUrl}`);
    return null;
  }
}

function extractUrlsFromSrcset(srcset: string, baseUrl: string): string[] {
  return srcset
    .split(',')
    .map((src: string) => src.trim().split(' ')[0])
    .map((src) => normalizeImageUrl(src, baseUrl))
    .filter((url): url is string => url !== null);
}

function filterOriginalImages(url: string): boolean {
  const excludePatterns = ['-150x150', '-370x208', '-300x300', '-768x1024', '-370x208'];
  return !excludePatterns.some((pattern) => url.includes(pattern));
}
