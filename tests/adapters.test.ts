import { createCaseBridgeFetch } from '../src/adapters/fetch';
import { createCaseBridgeAxiosInterceptors } from '../src/adapters/axios';
import { clearConverterCaches } from '../src/core/converters';

beforeEach(() => clearConverterCaches());

// ── Fetch adapter ─────────────────────────────────────────────────────────────

describe('createCaseBridgeFetch', () => {
  function mockFetch(responseBody: unknown): typeof globalThis.fetch {
    return async (_input, _init) => {
      return new Response(JSON.stringify(responseBody), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    };
  }

  it('transforms response snake_case keys to camelCase', async () => {
    const fetch = createCaseBridgeFetch({ fetch: mockFetch({ first_name: 'Jane', profile_id: 1 }) });
    const data = await fetch('/api/user').then(r => r.json());
    expect(data).toEqual({ firstName: 'Jane', profileId: 1 });
  });

  it('transforms nested response keys', async () => {
    const fetch = createCaseBridgeFetch({
      fetch: mockFetch({ user_info: { profile_id: 1 } }),
    });
    const data = await fetch('/api/user').then(r => r.json());
    expect(data).toEqual({ userInfo: { profileId: 1 } });
  });

  it('transforms outgoing JSON body keys to snake_case', async () => {
    let capturedBody: unknown;
    const baseFetch: typeof globalThis.fetch = async (_input, init) => {
      capturedBody = JSON.parse(init?.body as string);
      return new Response('{}', { headers: { 'content-type': 'application/json' } });
    };

    const fetch = createCaseBridgeFetch({ fetch: baseFetch });
    await fetch('/api/user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firstName: 'Jane', profileId: 42 }),
    });

    expect(capturedBody).toEqual({ first_name: 'Jane', profile_id: 42 });
  });

  it('skips transformation for matching skipUrls (string)', async () => {
    const fetch = createCaseBridgeFetch({
      fetch: mockFetch({ first_name: 'Jane' }),
      skipUrls: ['/no-transform'],
    });
    const data = await fetch('/no-transform/user').then(r => r.json());
    // should NOT be transformed
    expect(data).toEqual({ first_name: 'Jane' });
  });

  it('skips transformation for matching skipUrls (RegExp)', async () => {
    const fetch = createCaseBridgeFetch({
      fetch: mockFetch({ first_name: 'Jane' }),
      skipUrls: [/\/skip\//],
    });
    const data = await fetch('/skip/user').then(r => r.json());
    expect(data).toEqual({ first_name: 'Jane' });
  });

  it('passes non-JSON responses through unchanged', async () => {
    const baseFetch: typeof globalThis.fetch = async () =>
      new Response('<html></html>', { headers: { 'content-type': 'text/html' } });

    const fetch = createCaseBridgeFetch({ fetch: baseFetch });
    const text = await fetch('/page').then(r => r.text());
    expect(text).toBe('<html></html>');
  });

  it('does not convert request body when requestCase is camel', async () => {
    let capturedBody: unknown;
    const baseFetch: typeof globalThis.fetch = async (_input, init) => {
      capturedBody = JSON.parse(init?.body as string);
      return new Response('{}', { headers: { 'content-type': 'application/json' } });
    };

    const fetch = createCaseBridgeFetch({ fetch: baseFetch, requestCase: 'camel' });
    await fetch('/api/user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firstName: 'Jane', profileId: 42 }),
    });

    expect(capturedBody).toEqual({ firstName: 'Jane', profileId: 42 });
  });

  it('does not convert response when responseCase is snake', async () => {
    const fetch = createCaseBridgeFetch({
      fetch: mockFetch({ first_name: 'Jane', profile_id: 1 }),
      responseCase: 'snake',
    });
    const data = await fetch('/api/user').then(r => r.json());
    expect(data).toEqual({ first_name: 'Jane', profile_id: 1 });
  });

  it('skips snake request conversion for avoidSnakeRequestConversion urls', async () => {
    let capturedBody: unknown;
    const baseFetch: typeof globalThis.fetch = async (_input, init) => {
      capturedBody = JSON.parse(init?.body as string);
      return new Response('{}', { headers: { 'content-type': 'application/json' } });
    };

    const fetch = createCaseBridgeFetch({
      fetch: baseFetch,
      avoidSnakeRequestConversion: ['/camel-api'],
    });
    await fetch('/camel-api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firstName: 'Jane', profileId: 42 }),
    });

    expect(capturedBody).toEqual({ firstName: 'Jane', profileId: 42 });
  });

  it('still converts snake request for non-matching avoidSnakeRequestConversion urls', async () => {
    let capturedBody: unknown;
    const baseFetch: typeof globalThis.fetch = async (_input, init) => {
      capturedBody = JSON.parse(init?.body as string);
      return new Response('{}', { headers: { 'content-type': 'application/json' } });
    };

    const fetch = createCaseBridgeFetch({
      fetch: baseFetch,
      avoidSnakeRequestConversion: ['/camel-api'],
    });
    await fetch('/snake-api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firstName: 'Jane', profileId: 42 }),
    });

    expect(capturedBody).toEqual({ first_name: 'Jane', profile_id: 42 });
  });

  it('skips camel response conversion for avoidCamelResponseConversion urls', async () => {
    const fetch = createCaseBridgeFetch({
      fetch: mockFetch({ first_name: 'Jane' }),
      avoidCamelResponseConversion: ['/legacy-api'],
    });
    const data = await fetch('/legacy-api/user').then(r => r.json());
    expect(data).toEqual({ first_name: 'Jane' });
  });
});

// ── Axios adapter ─────────────────────────────────────────────────────────────

describe('createCaseBridgeAxiosInterceptors', () => {
  it('transforms request data camelCase → snake_case', () => {
    const { request } = createCaseBridgeAxiosInterceptors();
    const result = request.onFulfilled({
      url: '/api/user',
      data: { firstName: 'Jane', profileId: 42 },
    });
    expect(result.data).toEqual({ first_name: 'Jane', profile_id: 42 });
  });

  it('transforms response data snake_case → camelCase', () => {
    const { response } = createCaseBridgeAxiosInterceptors();
    const result = response.onFulfilled({
      data: { first_name: 'Jane', profile_id: 1 },
      config: { url: '/api/user' },
    });
    expect(result.data).toEqual({ firstName: 'Jane', profileId: 1 });
  });

  it('skips request transformation for skipUrls', () => {
    const { request } = createCaseBridgeAxiosInterceptors({ skipUrls: ['/no-transform'] });
    const config = { url: '/no-transform/user', data: { firstName: 'Jane' } };
    const result = request.onFulfilled(config);
    expect(result.data).toEqual({ firstName: 'Jane' }); // unchanged
  });

  it('skips response transformation for skipUrls', () => {
    const { response } = createCaseBridgeAxiosInterceptors({ skipUrls: ['/no-transform'] });
    const result = response.onFulfilled({
      data: { first_name: 'Jane' },
      config: { url: '/no-transform/user' },
    });
    expect(result.data).toEqual({ first_name: 'Jane' }); // unchanged
  });

  it('leaves FormData request body untouched', () => {
    const { request } = createCaseBridgeAxiosInterceptors();
    const fd = new FormData();
    const result = request.onFulfilled({ url: '/upload', data: fd });
    expect(result.data).toBe(fd);
  });

  it('handles missing request data gracefully', () => {
    const { request } = createCaseBridgeAxiosInterceptors();
    const result = request.onFulfilled({ url: '/api/user' });
    expect(result.data).toBeUndefined();
  });

  it('does not convert request body when requestCase is camel', () => {
    const { request } = createCaseBridgeAxiosInterceptors({ requestCase: 'camel' });
    const result = request.onFulfilled({
      url: '/api/user',
      data: { firstName: 'Jane', profileId: 42 },
    });
    expect(result.data).toEqual({ firstName: 'Jane', profileId: 42 });
  });

  it('does not convert response when responseCase is snake', () => {
    const { response } = createCaseBridgeAxiosInterceptors({ responseCase: 'snake' });
    const result = response.onFulfilled({
      data: { first_name: 'Jane', profile_id: 1 },
      config: { url: '/api/user' },
    });
    expect(result.data).toEqual({ first_name: 'Jane', profile_id: 1 });
  });

  it('skips snake request conversion for avoidSnakeRequestConversion urls', () => {
    const { request } = createCaseBridgeAxiosInterceptors({
      avoidSnakeRequestConversion: ['/camel-api'],
    });
    const result = request.onFulfilled({
      url: '/camel-api/users',
      data: { firstName: 'Jane', profileId: 42 },
    });
    expect(result.data).toEqual({ firstName: 'Jane', profileId: 42 });
  });

  it('still converts snake request for non-matching avoidSnakeRequestConversion urls', () => {
    const { request } = createCaseBridgeAxiosInterceptors({
      avoidSnakeRequestConversion: ['/camel-api'],
    });
    const result = request.onFulfilled({
      url: '/snake-api/users',
      data: { firstName: 'Jane', profileId: 42 },
    });
    expect(result.data).toEqual({ first_name: 'Jane', profile_id: 42 });
  });

  it('skips camel response conversion for avoidCamelResponseConversion urls', () => {
    const { response } = createCaseBridgeAxiosInterceptors({
      avoidCamelResponseConversion: ['/legacy-api'],
    });
    const result = response.onFulfilled({
      data: { first_name: 'Jane' },
      config: { url: '/legacy-api/user' },
    });
    expect(result.data).toEqual({ first_name: 'Jane' });
  });
});
