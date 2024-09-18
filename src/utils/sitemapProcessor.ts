// src/utils/sitemapProcessor.ts

import { Env } from '../types';

export class SitemapProcessor {
  private env: Env;

  constructor(env: Env) {
    this.env = env;
  }

  async fetchUrlsFromSitemap(sitemapUrl: string): Promise<string[]> {
    try {
      // Użyj Puppeteer do pobierania zawartości strony
      const page = await this.env.MYBROWSER.newPage();
      await page.goto(sitemapUrl, { waitUntil: 'load' });

      // Pobierz zawartość strony jako HTML
      const html = await page.content();
      await page.close();

      // Analizuj HTML, aby wyodrębnić URL-e
      const urls = this.extractUrlsFromHtml(html);
      return urls;
    } catch (error) {
      console.error(`Error fetching sitemap from ${sitemapUrl}:`, error);
      return [];
    }
  }

  private extractUrlsFromHtml(html: string): string[] {
    const urls: string[] = [];
    const urlRegex = /<loc>(.*?)<\/loc>/g;
    let match;

    while ((match = urlRegex.exec(html)) !== null) {
      urls.push(match[1]);
    }

    return urls;
  }
}
