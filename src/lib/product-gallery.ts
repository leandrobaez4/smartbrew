const VIDEO_EXTENSIONS = /\.(?:3g2|3gp|avi|m4v|mkv|mov|mp4|mpeg|mpg|webm|wmv)$/i;

export function isVideoMediaUrl(raw: string) {
  try {
    return VIDEO_EXTENSIONS.test(new URL(raw).pathname);
  } catch {
    return VIDEO_EXTENSIONS.test(raw.split(/[?#]/, 1)[0]);
  }
}

export function mergeProductImages(...groups: (string[] | undefined)[]) {
  const images = new Map<string, string>();
  for (const raw of groups.flatMap(group => group || [])) {
    if (isVideoMediaUrl(raw)) continue;
    const key = raw.match(/(\d+-(?:MLA|MLU|MLM|MLB|CBT)\d+_\d+)/i)?.[1] || raw;
    if (!images.has(key)) images.set(key, raw);
  }
  return [...images.values()].slice(0, 40);
}
