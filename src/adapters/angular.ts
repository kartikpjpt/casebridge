/**
 * Angular HTTP interceptor adapter.
 *
 * Drop-in interceptor that:
 *  - Converts outgoing request bodies from camelCase → snake_case
 *  - Converts incoming response bodies from snake_case → camelCase
 *  - Skips transformation for configurable URL patterns (e.g. services
 *    that already return camelCase)
 *  - Leaves FormData, Blob, ArrayBuffer, and string bodies untouched
 *
 * @example
 * // app.config.ts
 * provideHttpClient(withInterceptors([caseTransformInterceptor])),
 * provideCaseBridgeConfig({ skipUrls: ['/exchange-router'] })
 */

import { inject, InjectionToken } from '@angular/core';
import {
  HttpEvent,
  HttpInterceptorFn,
  HttpResponse,
} from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { transformKeys } from '../core/transform';
import { snakeToCamel, camelToSnake } from '../core/converters';

// ── Configuration ─────────────────────────────────────────────────────────────

export interface CaseBridgeConfig {
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

export const CASEBRIDGE_CONFIG = new InjectionToken<CaseBridgeConfig>(
  'CaseBridgeConfig',
);

export function provideCaseBridgeConfig(
  config: CaseBridgeConfig,
): { provide: typeof CASEBRIDGE_CONFIG; useValue: CaseBridgeConfig } {
  return { provide: CASEBRIDGE_CONFIG, useValue: config };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function shouldSkip(
  url: string,
  patterns: ReadonlyArray<string | RegExp>,
): boolean {
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

// ── Interceptor ───────────────────────────────────────────────────────────────

export const caseTransformInterceptor: HttpInterceptorFn = (
  req,
  next,
): Observable<HttpEvent<unknown>> => {
  const config = inject(CASEBRIDGE_CONFIG, { optional: true });
  const skipPatterns = config?.skipUrls ?? [];
  const requestCase = config?.requestCase ?? 'snake';
  const responseCase = config?.responseCase ?? 'camel';
  const avoidSnakeReq = config?.avoidSnakeRequestConversion ?? [];
  const avoidCamelRes = config?.avoidCamelResponseConversion ?? [];

  if (shouldSkip(req.url, skipPatterns)) {
    return next(req);
  }

  // Outgoing: camelCase → snake_case
  const skipSnake = requestCase === 'camel' || shouldSkip(req.url, avoidSnakeReq);
  const outReq = !skipSnake && isJsonBody(req.body)
    ? req.clone({ body: transformKeys(req.body, camelToSnake) })
    : req;

  // Incoming: snake_case → camelCase
  return next(outReq).pipe(
    map((event) => {
      if (event instanceof HttpResponse && event.body != null) {
        const skipCamel = responseCase === 'snake' || shouldSkip(req.url, avoidCamelRes);
        if (skipCamel) return event;
        return event.clone({
          body: transformKeys(event.body, snakeToCamel),
        });
      }
      return event;
    }),
  );
};
