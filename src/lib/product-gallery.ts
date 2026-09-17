export function mergeProductImages(...groups: (string[] | undefined)[]) {
  const images = new Map<string, string>();
  for (const raw of groups.flatMap(group => group || [])) {
    const key = raw.match(/(\d+-(?:MLA|MLU|MLM|MLB|CBT)\d+_\d+)/i)?.[1] || raw;
    if (!images.has(key)) images.set(key, raw);
  }
  return [...images.values()].slice(0, 40);
}
