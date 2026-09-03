import { MarketplaceClient, MarketplaceProduct, SearchProductsInput } from './types';

export class MercadoLibreClient implements MarketplaceClient {
  private baseUrl = process.env.MERCADO_LIBRE_API_BASE_URL || 'https://api.mercadolibre.com';
  private siteId = process.env.MERCADO_LIBRE_SITE_ID || 'MLA';

  async searchProducts(input: SearchProductsInput): Promise<MarketplaceProduct[]> {
    throw new Error('searchProducts is deprecated via API due to 403. Use scrapeProductIds and getProduct instead.');
  }

  async scrapeProductIds(query: string, limit: number = 20): Promise<string[]> {
    const puppeteer = require('puppeteer-extra');
    const StealthPlugin = require('puppeteer-extra-plugin-stealth');
    puppeteer.use(StealthPlugin());

    const browser = await puppeteer.launch({
      executablePath: process.env.CHROME_BIN || '/usr/bin/chromium-browser',
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 800 });
      
      const searchUrl = `https://listado.mercadolibre.com.ar/${query.replace(/\s+/g, '-')}`;
      console.log(`Scraping ML list: ${searchUrl}`);
      
      await page.goto(searchUrl, { waitUntil: 'networkidle2' });
      
      const html = await page.content();
      const cheerio = require('cheerio');
      const $ = cheerio.load(html);
      
      const ids: string[] = [];
      
      $('a.ui-search-link').each((i: number, el: any) => {
        if (ids.length >= limit) return;
        
        const href = $(el).attr('href') || '';
        const match = href.match(/MLA-?(\d+)/i);
        if (match) {
          const id = `MLA${match[1]}`;
          if (!ids.includes(id)) {
            ids.push(id);
          }
        }
      });
      
      return ids;
    } finally {
      await browser.close();
    }
  }

  async getProduct(externalId: string): Promise<MarketplaceProduct> {
    const url = `${this.baseUrl}/items/${externalId}`;
    const headers = {
      'Authorization': `Bearer ${process.env.MERCADO_LIBRE_ACCESS_TOKEN}`,
      'Content-Type': 'application/json'
    };
    
    const response = await fetch(url, { headers });
    if (!response.ok) {
      throw new Error(`ML API Error: ${response.statusText}`);
    }
    const data = await response.json();
    return this.mapToProduct(data);
  }

  private mapToProduct(item: any): MarketplaceProduct {
    return {
      externalId: item.id,
      title: item.title,
      categoryId: item.category_id,
      price: item.price,
      currencyId: item.currency_id,
      originalPermalink: item.permalink,
      primaryImageUrl: item.thumbnail ? item.thumbnail.replace('-I.jpg', '-O.jpg') : null, // Try to get higher res
      attributesJson: item.attributes || [],
      sellerId: item.seller?.id?.toString() || null,
      sellerReputation: item.seller?.seller_reputation?.power_seller_status || 'good', // Approximation from search endpoint
      isAvailable: item.available_quantity > 0,
      hasFastShipping: item.shipping?.logistic_type === 'fulfillment' || item.shipping?.free_shipping,
      salesCount: item.sold_quantity || 0, // Note: sold_quantity might be removed in newer API versions
    };
  }
}
