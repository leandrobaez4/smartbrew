# Mercado Libre Setup

1. Register at Mercado Libre Developers.
2. The current MVP uses unauthenticated public endpoints (`/sites/MLA/search`, `/items/:id`) for basic data fetching. No token is strictly required for read-only public endpoints, but rate limits apply.
3. For affiliate links, you must manually generate them inside the Mercado Libre Affiliate Program dashboard and paste them into the Admin Panel.
4. Set `MERCADO_LIBRE_SITE_ID=MLA` and `MERCADO_LIBRE_ALLOWED_AFFILIATE_HOSTS` in your `.env`.
