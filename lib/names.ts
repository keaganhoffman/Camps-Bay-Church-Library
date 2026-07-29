/** "Grace Ndlovu" → "Grace" — for warm, personal copy on screen and in email. */
export function firstName(fullName: string): string {
  return fullName.split(" ")[0];
}

/** "Grace Ndlovu" → "GN" — for the little circular badges in lists. */
export function initials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

/** Stable colour bucket for a name, so the same person always gets the same badge colour. */
export function colorIndex(text: string, buckets: number): number {
  let hash = 0;
  for (const ch of text) hash = (hash * 31 + ch.charCodeAt(0)) % 997;
  return hash % buckets;
}
