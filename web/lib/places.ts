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
