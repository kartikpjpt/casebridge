/**
 * Compile-time TypeScript types for case transformation.
 *
 * ToCamel / ToSnake are recursive template literal types — they transform
 * key names at the type level with zero runtime cost.
 *
 * Type logic adapted from ts-case-convert (Apache-2.0).
 * Runtime implementation is original (iterative, memoized).
 */

// ── String-level types ────────────────────────────────────────────────────────

export type ToCamel<S extends string | number | symbol> =
  S extends string
    ? S extends `${infer Head}_${infer Tail}`
      ? `${ToCamel<Uncapitalize<Head>>}${Capitalize<ToCamel<Tail>>}`
      : S extends `${infer Head}-${infer Tail}`
      ? `${ToCamel<Uncapitalize<Head>>}${Capitalize<ToCamel<Tail>>}`
      : Uncapitalize<S>
    : never;

type CapitalLetters =
  | 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J'
  | 'K' | 'L' | 'M' | 'N' | 'O' | 'P' | 'Q' | 'R' | 'S' | 'T'
  | 'U' | 'V' | 'W' | 'X' | 'Y' | 'Z';

type Numbers = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9';

type CapitalChars = CapitalLetters | Numbers;

export type ToSnake<S extends string | number | symbol> =
  S extends string
    ? S extends `${infer Head}${CapitalChars}${infer Tail}`
      ? Head extends ''
        ? Tail extends ''
          ? Lowercase<S>
          : S extends `${infer Caps}${Tail}`
          ? Caps extends CapitalChars
            ? Tail extends CapitalLetters
              ? `${Lowercase<Caps>}_${Lowercase<Tail>}`
              : Tail extends `${CapitalLetters}${string}`
              ? `${ToSnake<Caps>}_${ToSnake<Tail>}`
              : `${ToSnake<Caps>}${ToSnake<Tail>}`
            : never
          : never
        : Tail extends ''
        ? S extends `${Head}${infer Caps}`
          ? Caps extends CapitalChars
            ? Head extends Lowercase<Head>
              ? Caps extends Numbers
                ? Head extends `${string}${Numbers}`
                  ? never
                  : `${ToSnake<Head>}_${Caps}`
                : `${ToSnake<Head>}_${ToSnake<Caps>}`
              : never
            : never
          : never
        : S extends `${Head}${infer Caps}${Tail}`
        ? Caps extends CapitalChars
          ? Head extends Lowercase<Head>
            ? Tail extends CapitalLetters
              ? `${ToSnake<Head>}_${ToSnake<Caps>}_${Lowercase<Tail>}`
              : Tail extends `${CapitalLetters}${string}`
              ? Head extends Numbers
                ? never
                : Head extends `${string}${Numbers}`
                ? never
                : `${Head}_${ToSnake<Caps>}_${ToSnake<Tail>}`
              : `${ToSnake<Head>}_${Lowercase<Caps>}${ToSnake<Tail>}`
            : never
          : never
        : never
      : S
    : never;

// ── Object-level types ────────────────────────────────────────────────────────

export type ObjectToCamel<T extends object | undefined | null> =
  T extends undefined
    ? undefined
    : T extends null
    ? null
    : T extends Array<infer ArrayType>
    ? ArrayType extends object
      ? Array<ObjectToCamel<ArrayType>>
      : Array<ArrayType>
    : T extends Uint8Array
    ? Uint8Array
    : T extends Date
    ? Date
    : {
        [K in keyof T as ToCamel<K>]: T[K] extends
          | Array<infer ArrayType>
          | undefined
          | null
          ? ArrayType extends object
            ? Array<ObjectToCamel<ArrayType>>
            : Array<ArrayType>
          : T[K] extends object | undefined | null
          ? ObjectToCamel<T[K]>
          : T[K];
      };

export type ObjectToSnake<T extends object | undefined | null> =
  T extends undefined
    ? undefined
    : T extends null
    ? null
    : T extends Array<infer ArrayType>
    ? ArrayType extends object
      ? Array<ObjectToSnake<ArrayType>>
      : Array<ArrayType>
    : T extends Uint8Array
    ? Uint8Array
    : T extends Date
    ? Date
    : {
        [K in keyof T as ToSnake<K>]: T[K] extends
          | Array<infer ArrayType>
          | undefined
          | null
          ? ArrayType extends object
            ? Array<ObjectToSnake<ArrayType>>
            : Array<ArrayType>
          : T[K] extends object | undefined | null
          ? ObjectToSnake<T[K]>
          : T[K];
      };
