import { NextResponse } from 'next/server';

export function ok(data: Record<string, unknown> = {}) {
  return NextResponse.json({ ok: true, ...data });
}

export function fail(message: string, status = 400, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ ok: false, error: message, ...extra }, { status });
}

/** Wraps a route handler so unexpected errors become clean JSON instead of HTML 500 pages. */
export function guard<A extends unknown[]>(handler: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (error) {
      return fail(error instanceof Error ? error.message : String(error), 500);
    }
  };
}

export async function readJson(req: Request): Promise<Record<string, any>> {
  try { return (await req.json()) ?? {}; } catch { return {}; }
}
