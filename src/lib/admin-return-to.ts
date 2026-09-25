const allowedAdminPaths = ['/admin/', '/dashboard/'];

export function normalizeAdminReturnTo(value: unknown) {
  if (typeof value !== 'string' || value.length > 50_000 || value.includes('\\')) return null;
  if (!allowedAdminPaths.some((prefix) => value.startsWith(prefix))) return null;

  try {
    const url = new URL(value, 'https://smartbrew.local');
    if (url.origin !== 'https://smartbrew.local' || url.pathname === '/admin/login') return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}
