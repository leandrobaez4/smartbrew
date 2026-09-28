const SMARTBREW_ORIGIN = 'https://www.smartbrew.tech';

export function getSiteUrl() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();

  if (configured) {
    try {
      const url = new URL(configured);
      if ((url.protocol === 'https:' || url.hostname === 'localhost') && !url.username && !url.password) {
        return new URL(url.origin);
      }
    } catch {
      // Fall through to the public production origin.
    }
  }

  return new URL(SMARTBREW_ORIGIN);
}

export function absoluteSiteUrl(path = '/') {
  return new URL(path, getSiteUrl()).href;
}
