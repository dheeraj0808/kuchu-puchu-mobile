import en from './en.json';

/**
 * All user-facing strings live in the locale files (guide §14). English only
 * for now; a Hindi file with the same shape can be added later.
 */

type Leaves<T, Prefix extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${Prefix}${K}` : Leaves<T[K], `${Prefix}${K}.`>;
}[keyof T & string];

export type TranslationKey = Leaves<typeof en>;

type Params = Record<string, string | number>;

function lookup(key: string): string | undefined {
  let node: unknown = en;
  for (const part of key.split('.')) {
    if (typeof node !== 'object' || node === null) return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === 'string' ? node : undefined;
}

function interpolate(template: string, params?: Params): string {
  if (!params) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

export function t(key: TranslationKey, params?: Params): string {
  return interpolate(lookup(key) ?? key, params);
}

/** For keys built at runtime (e.g. error codes). Returns null when missing. */
export function tOptional(key: string, params?: Params): string | null {
  const value = lookup(key);
  return value === undefined ? null : interpolate(value, params);
}
