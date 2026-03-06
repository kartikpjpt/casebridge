/**
 * Framework-agnostic adapter for the native Fetch API.
 *
 * Wraps any fetch-compatible function and:
 *  - Converts outgoing JSON request bodies from camelCase → snake_case
 *  - Converts incoming JSON response bodies from snake_case → camelCase
 *  - Leaves non-JSON bodies (FormData, Blob, string, ArrayBuffer) untouched
 *  - Skips transformation for configurable URL patterns
 *
 * @example
 * import { createCaseBridgeFetch } from 'casebridge/fetch';
 *
 * const fetch = createCaseBridgeFetch();
 * const data = await fetch('/api/users').then(r => r.json());
 * // data keys are already camelCase
 */

import { transformKeys } from '../core/transform';
import { snakeToCamel, camelToSnake } from '../core/converters';

export interface FetchAdapterConfig {
  /**
   * URL substrings or RegExp patterns to skip transformation for.
   */
  skipUrls?: ReadonlyArray<string | RegExp>;
  /**
   * Base fetch implementation to wrap. Defaults to globalThis.fetch.
   */
  fetch?: typeof globalThis.fetch;
}

function shouldSkip(url: string, patterns: ReadonlyArray<string | RegExp>): boolean {
  for (const pattern of patterns) {
    if (typeof pattern === 'string' ? url.includes(pattern) : pattern.test(url)) {
      return true;
    }
  }
  return false;
}

function isJsonContentType(headers: HeadersInit | undefined): boolean {
  if (!headers) return false;
  const h = headers instanceof Headers ? headers : new Headers(headers as Record<string, string>);
  return (h.get('content-type') ?? '').includes('application/json');
}

/**
 * Returns a fetch-compatible function that transparently transforms
 * camelCase ↔ snake_case on the way in and out.
 */
export function createCaseBridgeFetch(config: FetchAdapterConfig = {}): typeof globalThis.fetch {
  const baseFetch = config.fetch ?? globalThis.fetch;
  const skipPatterns = config.skipUrls ?? [];

  return async function caseBridgeFetch(
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

    if (shouldSkip(url, skipPatterns)) {
      return baseFetch(input, init);
    }

    // Outgoing: camelCase → snake_case (only for JSON bodies)
    let transformedInit = init;
    if (
      init?.body != null &&
      typeof init.body === 'string' &&
      isJsonContentType(init.headers)
    ) {
      try {
        const parsed: unknown = JSON.parse(init.body);
        transformedInit = {
          ...init,
          body: JSON.stringify(transformKeys(parsed, camelToSnake)),
        };
      } catch {
        // not valid JSON — pass through as-is
      }
    }

    const response = await baseFetch(input, transformedInit);

    // Incoming: snake_case → camelCase (only for JSON responses)
    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json')) {
      return response;
    }

    const raw: unknown = await response.json();
    const transformed = transformKeys(raw, snakeToCamel);

    return new Response(JSON.stringify(transformed), {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  } as typeof globalThis.fetch;
}
