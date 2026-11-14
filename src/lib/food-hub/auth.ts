import "server-only";

// Who is calling a Food Hub API, and what they may do.
// Identity = the TAKATAK session (Supabase Auth + workspace membership); see ./access.ts.
import { NextResponse } from 'next/server';
import type { Actor } from './activity';
import { getFoodHubAccess } from './access';
import { fail } from './http';
import { can, type Permission } from './session';
import type { Role } from './types';

export interface AuthUser extends Actor {
  role: Role;
  /** [] = all locations */
  locations: string[];
}

/** Who is calling. Null = not signed in, or no access to the Food Hub workspace. */
export async function getActor(_req?: Request): Promise<AuthUser | null> {
  const access = await getFoodHubAccess();
  return access.state === 'ok' ? access.actor : null;
}

/** Route wrapper: checks the permission, passes the actor, turns errors into clean JSON. */
export function withPerm<C = unknown>(perm: Permission, handler: (req: Request, ctx: C, actor: AuthUser) => Promise<Response>) {
  return async (req: Request, ctx: C): Promise<Response> => {
    try {
      const access = await getFoodHubAccess();
      if (access.state === 'signed_out') return fail('Please sign in.', 401);
      if (access.state !== 'ok') return fail(access.message, 403);
      if (!can(access.actor.role, perm)) return fail(`Your role (${access.actor.role}) cannot do this.`, 403);
      return await handler(req, ctx, access.actor);
    } catch (error) {
      console.error('[food-hub] request error:', error instanceof Error ? error.message : error);
      return fail(error instanceof Error ? error.message : String(error), 500);
    }
  };
}

export { inScope, scopeFilter } from './session';

export function json(data: Record<string, unknown>, init?: ResponseInit) {
  return NextResponse.json(data, init);
}
