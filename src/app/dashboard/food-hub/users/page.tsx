import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getFoodHubAccess, listFoodHubTeam, WORKSPACE_ROLE_TO_FOOD_HUB } from '@/lib/food-hub/access';
import { can, ROLE_LABELS } from '@/lib/food-hub/session';

export const dynamic = 'force-dynamic';

// Users, sign-up, invitations and roles are TAKATAK's (Team & Permissions).
// This screen only shows what each person can do in Food Hub.
export default async function FoodHubUsersPage() {
  const access = await getFoodHubAccess();
  if (access.state !== 'ok' || !can(access.actor.role, 'admin')) redirect('/dashboard/food-hub');
  const team = await listFoodHubTeam(access.clientId);
  return (
    <>
      <div className="fh-head">
        <div>
          <h1>Users &amp; Roles</h1>
          <div className="small" style={{ maxWidth: 760 }}>
            Everyone signs in with their own TAKATAK account. To add someone, invite them to this workspace in TAKATAK → Team &amp; Permissions;
            their workspace role decides what they can do in Food Hub.
          </div>
        </div>
        <Link className="button" href="/dashboard/team">Invite or change roles</Link>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h2 style={{ marginTop: 0, fontSize: 16 }}>People in {access.workspaceName ?? 'this workspace'}</h2>
        {team.length === 0 ? <div className="small">No members found.</div> : (
          <table>
            <thead><tr><th>Name</th><th>Email</th><th>TAKATAK role</th><th>In Food Hub</th><th>Status</th></tr></thead>
            <tbody>
              {team.map((m) => (
                <tr key={m.email}>
                  <td>{m.name}</td>
                  <td className="fh-mono">{m.email}</td>
                  <td>{m.workspaceRole}</td>
                  <td>{ROLE_LABELS[m.foodHubRole]}</td>
                  <td><span className={`badge ${m.status === 'active' ? 'badge-green' : 'badge-yellow'}`}>{m.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0, fontSize: 16 }}>How TAKATAK roles map to Food Hub</h2>
        <table>
          <thead><tr><th>TAKATAK workspace role</th><th>Food Hub access</th></tr></thead>
          <tbody>
            {Object.entries(WORKSPACE_ROLE_TO_FOOD_HUB).map(([ws, fh]) => (
              <tr key={ws}><td>{ws}</td><td>{ROLE_LABELS[fh]}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
