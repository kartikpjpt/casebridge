# casebridge

Bidirectional **camelCase ↔ snake_case** key transformation for TypeScript/JavaScript.

- **O(n)** single-pass iterative traversal — no recursive call-stack risk
- **Memoized** key conversion — each unique key is transformed exactly once
- Preserves `Date`, `File`, `Blob`, `FormData`, `ArrayBuffer`, and `TypedArray` references untouched
- Full **TypeScript** types: `ObjectToCamel<T>`, `ObjectToSnake<T>` (compile-time key inference)
- Framework-agnostic core with optional adapters for **Angular**, **Fetch API**, and **Axios**

---

## Install

```bash
npm install casebridge
```

---

## Core API

### `transformKeys(input, keyFn)`

Recursively walks an object/array tree and applies `keyFn` to every key.

```ts
import { transformKeys, snakeToCamel, camelToSnake } from 'casebridge';

const camel = transformKeys(snakePayload, snakeToCamel);
const snake = transformKeys(camelPayload, camelToSnake);
```

### `toCamel<T>(input: T): ObjectToCamel<T>`

Typed convenience wrapper — return type is fully inferred at compile time.

```ts
import { toCamel } from 'casebridge';

interface UserSnake {
  first_name: string;
  profile_id: number;
}

const user = toCamel(apiResponse as UserSnake);
user.firstName; // ✅ TypeScript knows this exists
```

### `toSnake<T>(input: T): ObjectToSnake<T>`

```ts
import { toSnake } from 'casebridge';

const body = toSnake({ firstName: 'Jane', profileId: 42 });
// → { first_name: 'Jane', profile_id: 42 }
```

### `snakeToCamel(key)` / `camelToSnake(key)`

Single-key converters with memoization cache.

```ts
import { snakeToCamel, camelToSnake } from 'casebridge';

snakeToCamel('member_profile_id'); // → 'memberProfileId'
snakeToCamel('member-profile-id'); // → 'memberProfileId'  (kebab supported)
camelToSnake('memberProfileId');   // → 'member_profile_id'
camelToSnake('MyKey');             // → 'my_key'            (PascalCase handled)
```

---

## Adapters

All adapters share the same `skipUrls` option — a list of URL substrings or RegExp patterns that bypass transformation entirely.

### Fetch API

Works in any environment with native `fetch` (browser, Node 18+, Deno, Bun, Cloudflare Workers).

```ts
import { createCaseBridgeFetch } from 'casebridge/fetch';

const fetch = createCaseBridgeFetch({
  skipUrls: ['/exchange-router', /\/no-transform\//],
});

// Drop-in replacement for globalThis.fetch
const data = await fetch('/api/users', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ firstName: 'Jane', profileId: 42 }),
  // body sent as → { first_name: 'Jane', profile_id: 42 }
}).then(r => r.json());
// data keys are already camelCase
```

### Axios

```ts
import axios from 'axios';
import { createCaseBridgeAxiosInterceptors } from 'casebridge/axios';

const { request, response } = createCaseBridgeAxiosInterceptors({
  skipUrls: ['/exchange-router'],
});

axios.interceptors.request.use(request.onFulfilled);
axios.interceptors.response.use(response.onFulfilled);
```

Or on a custom instance:

```ts
const api = axios.create({ baseURL: 'https://api.example.com' });
const { request, response } = createCaseBridgeAxiosInterceptors();
api.interceptors.request.use(request.onFulfilled);
api.interceptors.response.use(response.onFulfilled);
```

### Angular

Add to your `app.config.ts`:

```ts
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { caseTransformInterceptor, provideCaseBridgeConfig } from 'casebridge/angular';

export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(withInterceptors([caseTransformInterceptor])),
    provideCaseBridgeConfig({
      skipUrls: ['/exchange-router', /\/no-transform\//],
    }),
  ],
};
```

---

## Performance

| Approach | Time | Space | Notes |
|---|---|---|---|
| `transformKeys` (this lib) | O(n) | O(d) | Iterative stack, memoized keys |
| JSON.stringify + parse | O(n) | O(n) | Two full traversals + string alloc |
| Regex loop (non-global) | O(n²) | O(d) | Re-scans string per replacement |

Where `n` = total key-value pairs, `d` = max nesting depth.

---

## TypeScript Types

Types adapted from [ts-case-convert](https://github.com/syndg/ts-case-convert) (Apache-2.0).
Runtime implementation is original.

```ts
import type { ObjectToCamel, ObjectToSnake, ToCamel, ToSnake } from 'casebridge';
```

---

## License

MIT © Kartik
