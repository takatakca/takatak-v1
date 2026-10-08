import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateAccountAccessInput } from '../src/lib/account/account-access-validation';
import type { User } from '@supabase/supabase-js';
import { ensureProfileForSupabaseUser, getProfileIdentity } from '../src/lib/auth/profile-sync';
import { getPrisma } from '../src/lib/db/prisma';

const phoneUser = (extra: Partial<User> = {}): User => ({
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', aud: 'authenticated',
  app_metadata: {}, user_metadata: {}, created_at: '2026-10-08T00:00:00Z',
  phone: '15145550123', phone_confirmed_at: '2026-10-08T00:00:00Z', ...extra,
});
assert.equal(getProfileIdentity(phoneUser())?.email, null);
assert.equal(getProfileIdentity(phoneUser())?.phone, '+15145550123');
assert.equal(getProfileIdentity(phoneUser({ user_metadata: { email: 'victim@example.com', phone: '+15145550999', role: 'owner' } }))?.email, null);
assert.equal(getProfileIdentity(phoneUser({ phone_confirmed_at: undefined })), null);
assert.equal(getProfileIdentity(phoneUser({ email: 'pending@example.com' }))?.email, null);
assert.equal(getProfileIdentity(phoneUser({ email: 'bad', email_confirmed_at: 'now' }))?.emailVerified, false);
assert.equal(getProfileIdentity(phoneUser({ phone: undefined, phone_confirmed_at: undefined, email: 'VERIFIED@example.com', email_confirmed_at: 'now' }))?.email, 'verified@example.com');

const accessRoute = readFileSync('src/app/api/account/access/route.ts', 'utf8');
assert.ok(!accessRoute.includes('email_confirm: true'));
assert.ok(!accessRoute.includes('transaction.profile.update'));
assert.ok(accessRoute.includes('supabase.auth.updateUser'));
assert.ok(validateAccountAccessInput({ email: '', newPassword: 'Strong-test-Password1!' }).success);
assert.ok(!validateAccountAccessInput({ email: 'invalid' }).success);

// Transactional test double: no SMS/provider success is simulated or claimed here.
type Row = Record<string, unknown>;
function fixture(seed: { profiles?: Row[]; identities?: Row[]; memberships?: Row[]; failWorkspace?: boolean; race?: boolean } = {}) {
  let state = { profiles: seed.profiles ?? [], identities: seed.identities ?? [], memberships: seed.memberships ?? [], clients: [] as Row[], subscriptions: [] as Row[], audits: [] as Row[] };
  let attempts = 0;
  const match = (row: Row, where: Row) => Object.entries(where).every(([key, value]) => row[key] === value);
  const db = {
    async $transaction(fn: (tx: unknown) => Promise<unknown>, options: unknown) {
      assert.deepEqual(options, { isolationLevel: 'Serializable' });
      attempts++;
      if (seed.race && attempts === 1) throw { code: 'P2034' };
      const next = structuredClone(state);
      const model = (rows: Row[], prefix: string) => ({
        async findUnique({ where }: { where: Row }) { return rows.find(row => match(row, where)) ?? null; },
        async findFirst({ where }: { where: Row }) { return rows.find(row => match(row, where)) ?? null; },
        async create({ data }: { data: Row }) { const row = { id: `${prefix}-${rows.length}`, ...data }; rows.push(row); return row; },
        async update({ where, data }: { where: Row; data: Row }) { const row = rows.find(row => match(row, where))!; Object.assign(row, data); return row; },
        async createMany({ data }: { data: Row[] }) {
          if (seed.failWorkspace && prefix === 'client') throw new Error('test workspace failure');
          let count = 0;
          for (const row of data) {
            if (!rows.some(old => row.id ? old.id === row.id : old.profileId === row.profileId && old.clientId === row.clientId)) { rows.push(row); count++; }
          }
          return { count };
        },
      });
      const result = await fn({ profile: model(next.profiles, 'profile'), masterIdentity: model(next.identities, 'identity'), clientMembership: model(next.memberships, 'membership'), client: model(next.clients, 'client'), clientSubscription: model(next.subscriptions, 'subscription'), auditLog: model(next.audits, 'audit') });
      state = next;
      return result;
    },
  };
  return { run: (user = phoneUser()) => ensureProfileForSupabaseUser(user, {}, { getPrisma: () => db as unknown as NonNullable<ReturnType<typeof getPrisma>> }), state: () => state, attempts: () => attempts };
}

async function main() {
  const fresh = fixture();
  assert.equal((await fresh.run()).outcome, 'created');
  assert.equal((await fresh.run()).outcome, 'existing');
  assert.equal(fresh.state().profiles.length, 1);
  assert.equal(fresh.state().profiles[0].email, null);
  assert.equal(fresh.state().profiles[0].role, 'user');
  assert.equal(fresh.state().identities.length, 1);
  assert.equal(fresh.state().clients.length, 1);
  assert.equal(fresh.state().memberships.length, 1);
  assert.equal(fresh.state().audits.length, 1);
  const identityId = fresh.state().identities[0].id;
  assert.equal((await fresh.run(phoneUser({ email: 'verified@example.com', email_confirmed_at: 'now' }))).outcome, 'updated');
  assert.equal(fresh.state().identities[0].id, identityId);
  assert.equal(fresh.state().identities[0].primaryEmail, 'verified@example.com');

  for (const identity of [
    { authUserId: 'someone-else', primaryPhone: '+15145550123', accountStatus: 'active' },
    { authUserId: null, primaryPhone: '+15145550123', accountStatus: 'active' },
    { authUserId: phoneUser().id, primaryPhone: '+15145550123', accountStatus: 'disabled' },
  ]) {
    const conflict = fixture({ identities: [{ id: 'historical', profileId: null, ...identity }] });
    assert.equal((await conflict.run()).outcome, 'denied');
    assert.equal(conflict.state().profiles.length, 0);
    assert.equal(conflict.state().clients.length, 0);
  }
  const disabled = fixture({ profiles: [{ id: 'disabled', authUserId: phoneUser().id, status: 'disabled' }] });
  assert.equal((await disabled.run()).outcome, 'denied');
  assert.equal(disabled.state().identities.length, 0);
  const failure = fixture({ failWorkspace: true });
  assert.equal((await failure.run()).outcome, 'error');
  assert.equal(failure.state().profiles.length, 0);
  assert.equal(failure.state().identities.length, 0);
  const race = fixture({ race: true });
  assert.equal((await race.run()).outcome, 'created');
  assert.equal(race.attempts(), 2);
  const member = fixture({ memberships: [{ profileId: 'profile-0', clientId: 'existing-tenant', status: 'active' }] });
  assert.equal((await member.run()).outcome, 'created');
  assert.equal(member.state().clients.length, 0);
  assert.equal(member.state().memberships.length, 1);
  assert.equal(member.state().memberships[0].clientId, 'existing-tenant');
  const linked = fixture({ identities: [{ id: 'external-first', authUserId: phoneUser().id, profileId: null, accountStatus: 'active' }] });
  assert.equal((await linked.run()).outcome, 'created');
  assert.equal(linked.state().identities.length, 1);
  assert.equal(linked.state().identities[0].id, 'external-first');
  console.log('PASS profile sync: confirmed contacts, phone-only, repeat sync, email linking, conflicts, disabled users, rollback and retry');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
