// Minimal vitest-compatible runner (describe / it / beforeEach / expect) on node:assert,
// so the Food Hub unit tests run with tsx like the other TAKATAK test scripts.
import assert from "node:assert/strict";

type Fn = () => unknown | Promise<unknown>;
type Test = { name: string; fn: Fn; befores: Fn[] };

const tests: Test[] = [];
const names: string[] = [];
const beforeStack: Fn[][] = [[]];

export function describe(name: string, fn: () => void) {
  names.push(name);
  beforeStack.push([]);
  fn();
  beforeStack.pop();
  names.pop();
}

export function beforeEach(fn: Fn) {
  beforeStack[beforeStack.length - 1].push(fn);
}

export function it(name: string, fn: Fn) {
  tests.push({ name: [...names, name].join(" › "), fn, befores: beforeStack.flat() });
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

/** Asymmetric matchers: expect.any(String), expect.arrayContaining([...]). */
class Asymmetric {
  constructor(readonly test: (actual: unknown) => boolean, readonly label: string) {}
  toJSON() { return this.label; }
}

function asym(a: unknown, b: unknown): boolean | null {
  if (b instanceof Asymmetric) return b.test(a);
  if (a instanceof Asymmetric) return a.test(b);
  return null;
}

/** vitest toEqual semantics: recursive, ignores properties whose value is undefined. */
function equals(a: unknown, b: unknown): boolean {
  const special = asym(a, b);
  if (special !== null) return special;
  if (Object.is(a, b)) return true;
  if (typeof a === "number" && typeof b === "number") return a === b;
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (a instanceof RegExp && b instanceof RegExp) return String(a) === String(b);
  if (ArrayBuffer.isView(a) && ArrayBuffer.isView(b)) {
    const x = new Uint8Array(a.buffer, a.byteOffset, a.byteLength);
    const y = new Uint8Array(b.buffer, b.byteOffset, b.byteLength);
    return x.length === y.length && x.every((v, i) => v === y[i]);
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((v, i) => equals(v, b[i]));
  }
  if (isObject(a) && isObject(b)) {
    const ka = Object.keys(a).filter((k) => a[k] !== undefined);
    const kb = Object.keys(b).filter((k) => b[k] !== undefined);
    if (ka.length !== kb.length) return false;
    return ka.every((k) => Object.prototype.hasOwnProperty.call(b, k) && equals(a[k], b[k]));
  }
  return false;
}

/** vitest toMatchObject semantics: every property of `expected` must match (recursively). */
function matchesObject(actual: unknown, expected: unknown): boolean {
  if (expected instanceof Asymmetric) return expected.test(actual);
  if (Array.isArray(expected)) {
    return Array.isArray(actual) && actual.length === expected.length && expected.every((e, i) => matchesObject(actual[i], e));
  }
  if (isObject(expected) && !(expected instanceof Date) && !(expected instanceof RegExp)) {
    if (!isObject(actual)) return false;
    return Object.keys(expected).every((k) => matchesObject(actual[k], expected[k]));
  }
  return equals(actual, expected);
}

const show = (v: unknown) => {
  try { return JSON.stringify(v); } catch { return String(v); }
};

function matchers(actual: unknown, negate: boolean) {
  const check = (pass: boolean, message: string) => {
    if (pass === negate) assert.fail(negate ? `Expected NOT: ${message}` : message);
  };
  return {
    toBe: (e: unknown) => check(Object.is(actual, e), `${show(actual)} to be ${show(e)}`),
    toEqual: (e: unknown) => check(equals(actual, e), `${show(actual)} to equal ${show(e)}`),
    toMatchObject: (e: unknown) => check(matchesObject(actual, e), `${show(actual)} to match ${show(e)}`),
    toBeNull: () => check(actual === null, `${show(actual)} to be null`),
    toBeUndefined: () => check(actual === undefined, `${show(actual)} to be undefined`),
    toBeCloseTo: (e: number, digits = 2) => check(Math.abs((actual as number) - e) < 10 ** -digits / 2, `${actual} to be close to ${e}`),
    toBeGreaterThan: (e: number) => check((actual as number) > e, `${actual} > ${e}`),
    toBeLessThanOrEqual: (e: number) => check((actual as number) <= e, `${actual} <= ${e}`),
    toHaveLength: (n: number) => check((actual as { length: number }).length === n, `length ${(actual as { length: number })?.length} to be ${n}`),
    toContain: (e: unknown) => check(typeof actual === "string" ? actual.includes(String(e)) : (actual as unknown[]).includes(e), `${show(actual)} to contain ${show(e)}`),
    toMatch: (e: RegExp | string) => check(typeof e === "string" ? String(actual).includes(e) : e.test(String(actual)), `${show(actual)} to match ${e}`),
    toThrow: (e?: RegExp | string) => {
      let threw = false;
      let message = "";
      try { (actual as () => unknown)(); } catch (err) { threw = true; message = err instanceof Error ? err.message : String(err); }
      const ok = threw && (!e || (typeof e === "string" ? message.includes(e) : e.test(message)));
      check(ok, `function to throw ${e ?? ""} (got ${threw ? message : "no error"})`);
    },
  };
}

const PRIMITIVE: Array<[unknown, string]> = [[String, "string"], [Number, "number"], [Boolean, "boolean"]];

export function expect(actual: unknown) {
  return {
    ...matchers(actual, false),
    not: matchers(actual, true),
    rejects: {
      toThrow: async (e?: RegExp | string) => {
        let message: string | null = null;
        try { await actual; } catch (err) { message = err instanceof Error ? err.message : String(err); }
        assert.ok(message !== null, "promise to reject");
        if (e) assert.ok(typeof e === "string" ? message!.includes(e) : e.test(message!), `rejection ${message} to match ${e}`);
      },
    },
  };
}

expect.any = (ctor: unknown) =>
  new Asymmetric((v) => {
    const prim = PRIMITIVE.find(([c]) => c === ctor);
    if (prim) return typeof v === prim[1];
    return typeof ctor === "function" && v instanceof (ctor as new (...args: never[]) => unknown);
  }, "Any");

expect.arrayContaining = (items: unknown[]) =>
  new Asymmetric((v) => Array.isArray(v) && items.every((i) => v.some((x) => equals(x, i))), `ArrayContaining ${show(items)}`);

export async function run(): Promise<void> {
  let failed = 0;
  for (const t of tests) {
    try {
      for (const b of t.befores) await b();
      await t.fn();
      console.log(`  ✓ ${t.name}`);
    } catch (error) {
      failed += 1;
      console.error(`  ✗ ${t.name}\n    ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  console.log(`\n[food-hub] ${tests.length - failed}/${tests.length} tests passed`);
  if (failed) process.exit(1);
}
