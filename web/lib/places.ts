// Matching place names typed by residents against the official 2025 ward and constituency names.

/**
 * Spelling-tolerant key: letters only, and no "h" or vowels after the first letter, so "B.T.M Layout" matches
 * "btm layout", "Malleswaram" matches "Malleshwaram" and "KR Puram" matches "K.R. Pura".
 * (The same idea as the ward matching in pipeline/civictrace/geo.py.)
 */
function skeleton(s: string): string {
  const letters = s.toLowerCase().replace(/[^a-z]/g, "");
  return letters.slice(0, 1) + letters.slice(1).replace(/[aeiouh]/g, "");
}

/** Does a ward or area name match what someone typed? Plain substring first, then the tolerant key. */
export function matchesPlace(name: string, query: string): boolean {
  if (name.toLowerCase().includes(query.toLowerCase())) return true;
  const b = skeleton(query);
  if (b.length < 3) return false;
  // The tolerant match must start at a word, or "kengeri" would match "Tilak Nagara".
  const words = name.split(/\s+/);
  for (let i = 0; i < words.length; i++) {
    const a = skeleton(words.slice(i).join(" "));
    if (a.startsWith(b) || (a.length >= 4 && b.startsWith(a))) return true;
  }
  return false;
}

/** URL slug for a name: "B.T.M Layout" → "btm-layout". */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[.']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Page for a constituency area: /areas/btm-layout/ (the 28 names are unique). */
export function areaHref(name: string): string {
  return `/areas/${slugify(name)}/`;
}

/** Page for a ward: /wards/hebbal-north-56/ (the ward key keeps names that repeat across corporations apart). */
export function wardSlug(name: string, key: string): string {
  return `${slugify(name)}-${slugify(key)}`;
}
export function wardHref(name: string, key: string): string {
  return `/wards/${wardSlug(name, key)}/`;
}
