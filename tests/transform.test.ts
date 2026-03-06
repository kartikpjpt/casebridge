import { transformKeys, toCamel, toSnake } from '../src/core/transform';
import { snakeToCamel, camelToSnake, clearConverterCaches } from '../src/core/converters';

beforeEach(() => clearConverterCaches());

// ── snakeToCamel ──────────────────────────────────────────────────────────────

describe('snakeToCamel', () => {
  it('converts snake_case', () => {
    expect(snakeToCamel('member_profile_id')).toBe('memberProfileId');
  });

  it('converts kebab-case', () => {
    expect(snakeToCamel('member-profile-id')).toBe('memberProfileId');
  });

  it('handles digits in key', () => {
    expect(snakeToCamel('iso3166_alpha2')).toBe('iso3166Alpha2');
  });

  it('returns already-camel unchanged', () => {
    expect(snakeToCamel('alreadyCamel')).toBe('alreadyCamel');
  });

  it('memoizes — same object reference on second call', () => {
    const first = snakeToCamel('foo_bar');
    const second = snakeToCamel('foo_bar');
    expect(first).toBe(second);
  });
});

// ── camelToSnake ──────────────────────────────────────────────────────────────

describe('camelToSnake', () => {
  it('converts camelCase', () => {
    expect(camelToSnake('memberProfileId')).toBe('member_profile_id');
  });

  it('handles PascalCase without leading underscore', () => {
    expect(camelToSnake('MyKey')).toBe('my_key');
  });

  it('handles digits in key', () => {
    expect(camelToSnake('iso3166Alpha2')).toBe('iso3166_alpha2');
  });

  it('returns already-snake unchanged', () => {
    expect(camelToSnake('already_snake')).toBe('already_snake');
  });

  it('memoizes', () => {
    const first = camelToSnake('fooBar');
    const second = camelToSnake('fooBar');
    expect(first).toBe(second);
  });
});

// ── transformKeys ─────────────────────────────────────────────────────────────

describe('transformKeys', () => {
  it('converts top-level object keys', () => {
    const result = transformKeys({ first_name: 'Jane', last_name: 'Doe' }, snakeToCamel);
    expect(result).toEqual({ firstName: 'Jane', lastName: 'Doe' });
  });

  it('recursively converts nested objects', () => {
    const input = { user_info: { profile_id: 1 } };
    const result = transformKeys(input, snakeToCamel);
    expect(result).toEqual({ userInfo: { profileId: 1 } });
  });

  it('handles arrays of objects', () => {
    const input = [{ member_id: 1 }, { member_id: 2 }];
    const result = transformKeys(input, snakeToCamel) as unknown[];
    expect(result).toEqual([{ memberId: 1 }, { memberId: 2 }]);
  });

  it('handles mixed arrays (primitives)', () => {
    const input = { tags: ['a', 'b', 'c'] };
    const result = transformKeys(input, snakeToCamel);
    expect(result).toEqual({ tags: ['a', 'b', 'c'] });
  });

  it('passes through Date objects without mutation', () => {
    const date = new Date('2026-01-01');
    const input = { created_at: date };
    const result = transformKeys(input, snakeToCamel) as { createdAt: Date };
    expect(result.createdAt).toBe(date); // same reference
  });

  it('passes through Blob objects without mutation', () => {
    const blob = new Blob(['hello']);
    const input = { file_data: blob };
    const result = transformKeys(input, snakeToCamel) as { fileData: Blob };
    expect(result.fileData).toBe(blob);
  });

  it('passes through ArrayBuffer without mutation', () => {
    const buf = new ArrayBuffer(8);
    const input = { raw_bytes: buf };
    const result = transformKeys(input, snakeToCamel) as { rawBytes: ArrayBuffer };
    expect(result.rawBytes).toBe(buf);
  });

  it('passes through TypedArray (Float32Array) without corruption', () => {
    const typed = new Float32Array([1.0, 2.0, 3.0]);
    const input = { values: typed };
    const result = transformKeys(input, snakeToCamel) as { values: Float32Array };
    expect(result.values).toBe(typed);
    expect(result.values[0]).toBe(1.0);
  });

  it('handles deeply nested objects (>50 levels) without stack overflow', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let deep: any = { leaf_value: 42 };
    for (let i = 0; i < 100; i++) {
      deep = { nested_level: deep };
    }
    // Should not throw
    expect(() => transformKeys(deep, snakeToCamel)).not.toThrow();
  });

  it('returns primitives as-is', () => {
    expect(transformKeys(42, snakeToCamel)).toBe(42);
    expect(transformKeys('hello', snakeToCamel)).toBe('hello');
    expect(transformKeys(null, snakeToCamel)).toBe(null);
    expect(transformKeys(undefined, snakeToCamel)).toBe(undefined);
  });

  it('handles empty object', () => {
    expect(transformKeys({}, snakeToCamel)).toEqual({});
  });

  it('handles empty array', () => {
    expect(transformKeys([], snakeToCamel)).toEqual([]);
  });
});

// ── toCamel / toSnake typed wrappers ─────────────────────────────────────────

describe('toCamel', () => {
  it('returns typed result', () => {
    const result = toCamel({ first_name: 'Jane' });
    // TypeScript: result.firstName should exist at compile time
    expect((result as { firstName: string }).firstName).toBe('Jane');
  });
});

describe('toSnake', () => {
  it('returns typed result', () => {
    const result = toSnake({ firstName: 'Jane' });
    expect((result as { first_name: string }).first_name).toBe('Jane');
  });
});

// ── Round-trip ────────────────────────────────────────────────────────────────

describe('round-trip', () => {
  it('snake → camel → snake is lossless for word-only keys', () => {
    // Keys with trailing numeric segments (e.g. street_line_1) are intentionally
    // lossy: _1 collapses to 1 since digits have no uppercase equivalent.
    const original = {
      member_profile_id: 1,
      corporate_name: 'Acme',
      address: {
        street_name: '123 Main St',
        zip_code: '10001',
      },
    };

    const camel = transformKeys(original, snakeToCamel);
    const backToSnake = transformKeys(camel, camelToSnake);
    expect(backToSnake).toEqual(original);
  });

  it('numeric suffix is a known lossy case', () => {
    // street_line_1 → streetLine1 → street_line1 (underscore before digit is dropped)
    const result = transformKeys(
      transformKeys({ street_line_1: 'x' }, snakeToCamel),
      camelToSnake,
    );
    expect(result).toEqual({ street_line1: 'x' });
  });
});
