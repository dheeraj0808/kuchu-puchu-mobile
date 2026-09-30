/**
 * Compares dotted numeric versions ("1.4.0" vs "1.10"). Missing parts count
 * as 0; pre-release or build suffixes ("1.4.0-rc.1", "1.4.0+42") are ignored.
 * Returns -1, 0 or 1.
 */
export function compareVersions(a: string, b: string): -1 | 0 | 1 {
  const pa = parse(a);
  const pb = parse(b);
  for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (x !== y) return x < y ? -1 : 1;
  }
  return 0;
}

export function isBelowVersion(current: string, minimum: string): boolean {
  return compareVersions(current, minimum) < 0;
}

function parse(version: string): number[] {
  return version
    .trim()
    .replace(/^v/i, '')
    .split(/[-+]/)[0]
    .split('.')
    .map((part) => {
      const n = Number.parseInt(part, 10);
      return Number.isFinite(n) && n >= 0 ? n : 0;
    });
}
