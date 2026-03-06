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
   * URL substrings or RegExp patterns to skip transformation for.
   */
  skipUrls?: ReadonlyArray<string | RegExp>;
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

  return {
    request: {
      onFulfilled(reqConfig: AxiosRequestConfig): AxiosRequestConfig {
        if (shouldSkip(reqConfig.url, skipPatterns)) return reqConfig;
        if (!isJsonBody(reqConfig.data)) return reqConfig;
        return { ...reqConfig, data: transformKeys(reqConfig.data, camelToSnake) };
      },
    },
    response: {
      onFulfilled(response: AxiosResponse): AxiosResponse {
        if (shouldSkip(response.config?.url, skipPatterns)) return response;
        return { ...response, data: transformKeys(response.data, snakeToCamel) };
      },
    },
  };
}
