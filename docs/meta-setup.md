# Meta (Instagram) Setup

1. Create a Facebook Developer Account.
2. Create an App and add the **Instagram Graph API** product.
3. Link your Instagram Professional account to a Facebook Page.
4. Generate a User Access Token with `instagram_basic`, `instagram_content_publish`, `pages_show_list`, `pages_read_engagement`.
5. Obtain your Instagram Account ID using the Graph API Explorer.
6. Set `INSTAGRAM_ACCOUNT_ID` and `INSTAGRAM_ACCESS_TOKEN` in `.env`.
7. Set `INSTAGRAM_DRIVER=real` to use production publishing.
