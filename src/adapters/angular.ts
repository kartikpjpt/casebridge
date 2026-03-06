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
   * URL substrings or RegExp patterns for services that already return
   * camelCase — their requests and responses are passed through untouched.
   */
  skipUrls?: ReadonlyArray<string | RegExp>;
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

  if (shouldSkip(req.url, skipPatterns)) {
    return next(req);
  }

  // Outgoing: camelCase → snake_case
  const outReq = isJsonBody(req.body)
    ? req.clone({ body: transformKeys(req.body, camelToSnake) })
    : req;

  // Incoming: snake_case → camelCase
  return next(outReq).pipe(
    map((event) => {
      if (event instanceof HttpResponse && event.body != null) {
        return event.clone({
          body: transformKeys(event.body, snakeToCamel),
        });
      }
      return event;
    }),
  );
};
