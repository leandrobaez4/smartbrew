import { MarketplaceClient, MarketplaceProduct } from './types';

type MercadoLibreAttribute = {
  id?: string;
  name?: string;
  value_name?: string | number | null;
  value_struct?: { number?: string | number | null } | null;
};

type MercadoLibreItem = {
  id: string;
  title: string;
  category_id: string | null;
  price: number | null;
  currency_id: string | null;
  permalink: string;
  thumbnail?: string | null;
  pictures?: Array<{ secure_url?: string; url?: string }>;
  attributes?: MercadoLibreAttribute[];
  seller?: { id?: string | number; nickname?: string; seller_reputation?: { power_seller_status?: string | null } };
  available_quantity?: number;
  shipping?: { logistic_type?: string; free_shipping?: boolean };
  sold_quantity?: number;
};

const MARKETPLACE_IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);

export function isMarketplaceImageUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return false;
    const pathname = url.pathname.toLowerCase();
    return [...MARKETPLACE_IMAGE_EXTENSIONS].some((extension) => pathname.endsWith(extension));
  } catch {
    return false;
  }
}

function higherResolutionThumbnail(value: unknown) {
  if (!isMarketplaceImageUrl(value)) return null;
  return value.replace(/-I\.jpg(?=\?|$)/i, '-O.jpg');
}

export class MercadoLibreClient implements MarketplaceClient {
  private baseUrl = process.env.MERCADO_LIBRE_API_BASE_URL || 'https://api.mercadolibre.com';
  private siteId = process.env.MERCADO_LIBRE_SITE_ID || 'MLA';

  async searchProducts(): Promise<MarketplaceProduct[]> {
    throw new Error('searchProducts is deprecated via API due to 403. Use scrapeProductIds and getProduct instead.');
  }

  async scrapeProductIds(query: string, limit: number = 20): Promise<string[]> {
    // Keep scraper-only dependencies out of the Next.js server bundle.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const puppeteer = require('puppeteer-extra');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
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
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const cheerio = require('cheerio');
      const $ = cheerio.load(html);
      
      const ids: string[] = [];
      
      const links: Array<{ attribs?: Record<string, string> }> = $('a.ui-search-link').toArray();
      for (const el of links) {
        if (ids.length >= limit) break;
        
        const href = $(el).attr('href') || '';
        const match = href.match(/MLA-?(\d+)/i);
        if (match) {
          const id = `MLA${match[1]}`;
          if (!ids.includes(id)) {
            ids.push(id);
          }
        }
      }
      
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
    const data = await response.json() as MercadoLibreItem;
    let originalDescription: string | null = null;
    try {
      const descriptionResponse = await fetch(`${url}/description`, { headers });
      if (descriptionResponse.ok) {
        const description = await descriptionResponse.json();
        originalDescription = typeof description?.plain_text === 'string' && description.plain_text.trim()
          ? description.plain_text.trim()
          : null;
      }
    } catch {
      // Description is optional and must never make the product import fail.
    }
    return this.mapToProduct(data, originalDescription);
  }

  private mapToProduct(item: MercadoLibreItem, originalDescription: string | null): MarketplaceProduct {
    const attributes = Array.isArray(item.attributes)
      ? Object.fromEntries(item.attributes.flatMap((attribute) => {
          const key = attribute?.id || attribute?.name;
          const value = attribute?.value_name ?? attribute?.value_struct?.number;
          return typeof key === 'string' && value != null ? [[key, String(value)]] : [];
        }))
      : null;
    const imageUrls = Array.isArray(item.pictures)
      ? [...new Set(item.pictures.flatMap((picture) => {
          const value = [picture?.secure_url, picture?.url].find(isMarketplaceImageUrl);
          return value ? [value] : [];
        }))]
      : [];
    const primaryImageUrl = higherResolutionThumbnail(item.thumbnail) || imageUrls[0] || null;
    return {
      externalId: item.id,
      title: item.title,
      originalDescription,
      categoryId: item.category_id,
      price: item.price,
      currencyId: item.currency_id,
      originalPermalink: item.permalink,
      primaryImageUrl,
      imageUrls,
      attributesJson: attributes,
      sellerId: item.seller?.id?.toString() || null,
      seller: item.seller?.nickname || null,
      sellerReputation: item.seller?.seller_reputation?.power_seller_status || 'good', // Approximation from search endpoint
      isAvailable: (item.available_quantity ?? 0) > 0,
      hasFastShipping: item.shipping?.logistic_type === 'fulfillment' || item.shipping?.free_shipping,
      salesCount: item.sold_quantity || 0, // Note: sold_quantity might be removed in newer API versions
    };
  }
}
