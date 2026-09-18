import { z } from 'zod';
import { requestMeta } from './meta-api';
import { productUrl } from './product-url';

export const adInput = z.object({
  productId: z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/),
  // First version supports only currencies with two decimal places.
  currency: z.enum(['ARS', 'USD']),
  budgetMinor: z.number().int().min(100).max(100_000_000),
  days: z.number().int().min(1).max(30),
  confirmed: z.literal(true),
});
export type AdInput = z.infer<typeof adInput>;
export function adsConfig() {
  const token = process.env.META_ADS_ACCESS_TOKEN;
  const account = process.env.META_ADS_ACCOUNT_ID;
  const page = process.env.META_ADS_PAGE_ID;
  const instagram = process.env.META_ADS_INSTAGRAM_ID;
  const version = process.env.META_ADS_API_VERSION || 'v26.0';
  if (process.env.META_ADS_ENABLED !== 'true' || !token || !account || !page || !instagram) throw Error('Publicidad deshabilitada o faltan las variables META_ADS.');
  if (![account, page, instagram].every(id => /^\d+$/.test(id)) || !/^v\d+\.0$/.test(version)) throw Error('Configuración publicitaria inválida.');
  return { token, account, page, instagram, root: `https://graph.facebook.com/${version}` };
}

// Never accepts status from a client. Every delivery-bearing entity starts PAUSED.
export async function createPausedAd(
  input: AdInput,
  product: { title: string; primaryImageUrl: string },
  checkpoint: (ids: Record<string, string>) => Promise<void>,
) {
  const c = adsConfig();
  const headers = { Authorization: `Bearer ${c.token}` };
  const root = `${c.root}/act_${c.account}`;
  const account = await requestMeta<{ currency: string; account_status: number }>('verificar cuenta publicitaria', `${root}?fields=currency,account_status`, { headers, signal: AbortSignal.timeout(10000), cache: 'no-store' });
  if (account.currency !== input.currency || account.account_status !== 1) throw Error('La moneda no coincide o la cuenta publicitaria no está habilitada.');
  const ids: Record<string, string> = {};
  async function create(edge: string, fields: Record<string, string>) {
    const result = await requestMeta<{ id?: string }>(`crear ${edge} pausado`, `${root}/${edge}`, {
      method: 'POST', headers, body: new URLSearchParams(fields), signal: AbortSignal.timeout(10000),
    });
    if (!result?.id || !/^\d+$/.test(result.id)) throw Error('Meta no confirmó el ID. Requiere revisión manual.');
    ids[edge] = result.id;
    await checkpoint({ ...ids });
    return result.id;
  }
  const name = `SmartBrew · ${product.title.slice(0, 120)}`;
  const campaign = await create('campaigns', { name, objective: 'OUTCOME_TRAFFIC', special_ad_categories: '[]', status: 'PAUSED', is_adset_budget_sharing_enabled: 'false' });
  const start = Math.floor(Date.now() / 1000) + 3600;
  const adset = await create('adsets', {
    name, campaign_id: campaign, status: 'PAUSED', destination_type: 'WEBSITE',
    optimization_goal: 'LINK_CLICKS', billing_event: 'IMPRESSIONS', bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
    lifetime_budget: String(input.budgetMinor), start_time: String(start), end_time: String(start + input.days * 86400),
    targeting: JSON.stringify({ geo_locations: { countries: ['AR'] }, age_min: 18, publisher_platforms: ['instagram'], instagram_positions: ['stream'] }),
  });
  const link = productUrl(input.productId);
  const creative = await create('adcreatives', {
    name,
    object_story_spec: JSON.stringify({
      page_id: c.page, instagram_user_id: c.instagram,
      link_data: { link, picture: product.primaryImageUrl, name: product.title,
        message: `Conocé ${product.title}. Más información en SmartBrew.`,
        call_to_action: { type: 'SHOP_NOW', value: { link } } },
    }),
  });
  await create('ads', { name, adset_id: adset, creative: JSON.stringify({ creative_id: creative }), status: 'PAUSED' });
  return ids;
}
