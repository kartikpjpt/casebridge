/**
 * Key conversion functions with memoization.
 *
 * Each unique key is transformed exactly once via regex.
 * Subsequent lookups are O(1) Map.get — critical for large arrays
 * where the same set of keys repeats across thousands of objects.
 */

const snakeToCamelCache = new Map<string, string>();
const camelToSnakeCache = new Map<string, string>();

/**
 * Converts a single snake_case or kebab-case key to camelCase.
 *
 * member_profile_id  →  memberProfileId
 * member-profile-id  →  memberProfileId
 * iso3166_alpha2     →  iso3166Alpha2
 */
export function snakeToCamel(key: string): string {
  let cached = snakeToCamelCache.get(key);
  if (cached === undefined) {
    cached = key.replace(/[_-]([a-z0-9])/g, (_, char: string) =>
      char.toUpperCase(),
    );
    snakeToCamelCache.set(key, cached);
  }
  return cached;
}

/**
 * Converts a single camelCase key to snake_case.
 *
 * memberProfileId  →  member_profile_id
 * iso3166Alpha2    →  iso3166_alpha2
 * MyKey            →  my_key  (PascalCase handled)
 */
export function camelToSnake(key: string): string {
  let cached = camelToSnakeCache.get(key);
  if (cached === undefined) {
    cached = key
      .replace(/([A-Z])/g, '_$1')
      .toLowerCase()
      .replace(/^_+/, ''); // strip accidental leading underscore from PascalCase
    camelToSnakeCache.set(key, cached);
  }
  return cached;
}

/** Clears both memoization caches. Useful in tests or long-running processes. */
export function clearConverterCaches(): void {
  snakeToCamelCache.clear();
  camelToSnakeCache.clear();
}
