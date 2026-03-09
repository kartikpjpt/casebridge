/**
 * Axios interceptor adapter.
 *
 * Returns a pair of request/response interceptor handlers ready to be
 * passed to `axios.interceptors.request.use()` and
 * `axios.interceptors.response.use()`.
 *
 * - Converts outgoing request data from camelCase → snake_case
 * - Converts incoming response data from snake_case → camelCase
 * - Skips transformation for configurable URL patterns
 * - Leaves FormData, Blob, ArrayBuffer, and string bodies untouched
 *
 * @example
 * import axios from 'axios';
 * import { createCaseBridgeAxiosInterceptors } from 'casebridge/axios';
 *
 * const { request, response } = createCaseBridgeAxiosInterceptors();
 * axios.interceptors.request.use(request.onFulfilled);
 * axios.interceptors.response.use(response.onFulfilled);
 */

import { transformKeys } from '../core/transform';
import { snakeToCamel, camelToSnake } from '../core/converters';

// Minimal type surface — avoids a hard axios peer dependency.
// Works with any axios version that exposes InternalAxiosRequestConfig / AxiosResponse shape.
interface AxiosRequestConfig {
  url?: string;
  data?: unknown;
  [key: string]: unknown;
}

interface AxiosResponse<T = unknown> {
  data: T;
  config?: AxiosRequestConfig;
  [key: string]: unknown;
}

export interface AxiosAdapterConfig {
  /**
   * URL substrings or RegExp patterns to skip ALL transformation for.
   */
  skipUrls?: ReadonlyArray<string | RegExp>;
  /**
   * Default case for outgoing request payloads.
   * - `'snake'` (default): converts camelCase → snake_case.
   * - `'camel'`: sends payload as-is (no conversion).
   */
  requestCase?: 'snake' | 'camel';
  /**
   * Default case for incoming response payloads.
   * - `'camel'` (default): converts snake_case → camelCase.
   * - `'snake'`: leaves response payload as-is (no conversion).
   */
  responseCase?: 'snake' | 'camel';
  /**
   * URL substrings or RegExp patterns for endpoints that accept camelCase
   * request bodies — snake_case conversion is skipped for these URLs,
   * regardless of the global `requestCase` setting.
   */
  avoidSnakeRequestConversion?: ReadonlyArray<string | RegExp>;
  /**
   * URL substrings or RegExp patterns for endpoints that return non-camelCase
   * responses — camelCase conversion is skipped for these URLs,
   * regardless of the global `responseCase` setting.
   */
  avoidCamelResponseConversion?: ReadonlyArray<string | RegExp>;
}

function shouldSkip(url: string | undefined, patterns: ReadonlyArray<string | RegExp>): boolean {
  if (!url) return false;
  for (const pattern of patterns) {
    if (typeof pattern === 'string' ? url.includes(pattern) : pattern.test(url)) {
      return true;
    }
  }
  return false;
}

function isJsonBody(body: unknown): boolean {
  if (body === null || body === undefined) return false;
  if (typeof body !== 'object') return false;
  if (body instanceof FormData) return false;
  if (body instanceof Blob) return false;
  if (body instanceof ArrayBuffer) return false;
  if (ArrayBuffer.isView(body)) return false;
  return true;
}

export interface CaseBridgeAxiosInterceptors {
  request: {
    onFulfilled: (config: AxiosRequestConfig) => AxiosRequestConfig;
  };
  response: {
    onFulfilled: (response: AxiosResponse) => AxiosResponse;
  };
}

/**
 * Creates a pair of Axios interceptors that transparently transform
 * camelCase ↔ snake_case on the way in and out.
 */
export function createCaseBridgeAxiosInterceptors(
  config: AxiosAdapterConfig = {},
): CaseBridgeAxiosInterceptors {
  const skipPatterns = config.skipUrls ?? [];
  const requestCase = config.requestCase ?? 'snake';
  const responseCase = config.responseCase ?? 'camel';
  const avoidSnakeReq = config.avoidSnakeRequestConversion ?? [];
  const avoidCamelRes = config.avoidCamelResponseConversion ?? [];

  return {
    request: {
      onFulfilled(reqConfig: AxiosRequestConfig): AxiosRequestConfig {
        if (shouldSkip(reqConfig.url, skipPatterns)) return reqConfig;
        if (!isJsonBody(reqConfig.data)) return reqConfig;
        const skipSnake = requestCase === 'camel' || shouldSkip(reqConfig.url, avoidSnakeReq);
        if (skipSnake) return reqConfig;
        return { ...reqConfig, data: transformKeys(reqConfig.data, camelToSnake) };
      },
    },
    response: {
      onFulfilled(response: AxiosResponse): AxiosResponse {
        if (shouldSkip(response.config?.url, skipPatterns)) return response;
        const skipCamel = responseCase === 'snake' || shouldSkip(response.config?.url, avoidCamelRes);
        if (skipCamel) return response;
        return { ...response, data: transformKeys(response.data, snakeToCamel) };
      },
    },
  };
}
