import type { ObjectToCamel, ObjectToSnake } from './types';
import { snakeToCamel, camelToSnake } from './converters';

type PlainObject = Record<string, unknown>;
type TransformableNode = PlainObject | unknown[];

/**
 * Returns true only for plain objects and arrays.
 * Preserves Dates, Files, Blobs, FormData, ArrayBuffer, and all TypedArrays
 * as opaque pass-through references — they are never mutated or recursed into.
 */
function isTransformable(value: unknown): value is TransformableNode {
  if (value === null || value === undefined) return false;
  if (typeof value !== 'object') return false;
  if (value instanceof Date) return false;
  if (value instanceof File) return false;
  if (value instanceof Blob) return false;
  if (value instanceof FormData) return false;
  if (value instanceof ArrayBuffer) return false;
  if (ArrayBuffer.isView(value)) return false; // Float32Array, Uint8Array, etc.
  return true;
}

/**
 * Iteratively walks the entire object/array tree, returning a new tree with
 * all object keys transformed by `keyFn`.
 *
 * Design decisions:
 * - Iterative (explicit stack) — no call-stack risk on deeply nested payloads,
 *   no function-frame overhead per level.
 * - Primitives passed by reference — only new container objects are allocated.
 * - No JSON.stringify/parse — avoids two full traversals and intermediate
 *   string allocation, and preserves Date/File/Blob references.
 *
 * Time:  O(n)  — n = total key-value pairs across all nodes
 * Space: O(d)  — d = max nesting depth (stack frames)
 */
export function transformKeys(
  input: unknown,
  keyFn: (key: string) => string,
): unknown {
  if (!isTransformable(input)) return input;

  const root: TransformableNode = Array.isArray(input) ? [] : {};
  const stack: Array<[TransformableNode, TransformableNode]> = [[input, root]];

  while (stack.length > 0) {
    const [src, tgt] = stack.pop()!;

    if (Array.isArray(src)) {
      const tgtArr = tgt as unknown[];
      tgtArr.length = src.length; // pre-allocate

      for (let i = 0; i < src.length; i++) {
        const val = src[i];
        if (isTransformable(val)) {
          const child: TransformableNode = Array.isArray(val) ? [] : {};
          tgtArr[i] = child;
          stack.push([val, child]);
        } else {
          tgtArr[i] = val;
        }
      }
    } else {
      const srcObj = src as PlainObject;
      const tgtObj = tgt as PlainObject;
      const keys = Object.keys(srcObj);

      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        const newKey = keyFn(key);
        const val = srcObj[key];

        if (isTransformable(val)) {
          const child: TransformableNode = Array.isArray(val) ? [] : {};
          tgtObj[newKey] = child;
          stack.push([val, child]);
        } else {
          tgtObj[newKey] = val;
        }
      }
    }
  }

  return root;
}

// ── Typed convenience wrappers ────────────────────────────────────────────────

/**
 * Recursively converts all object keys from snake_case / kebab-case to camelCase.
 * Return type is fully inferred when T is a typed interface.
 */
export function toCamel<T extends object>(input: T): ObjectToCamel<T> {
  return transformKeys(input, snakeToCamel) as ObjectToCamel<T>;
}

/**
 * Recursively converts all object keys from camelCase to snake_case.
 * Return type is fully inferred when T is a typed interface.
 */
export function toSnake<T extends object>(input: T): ObjectToSnake<T> {
  return transformKeys(input, camelToSnake) as ObjectToSnake<T>;
}
