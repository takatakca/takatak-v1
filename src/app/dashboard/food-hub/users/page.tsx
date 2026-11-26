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
            Chacun se connecte avec son propre compte TAKATAK. Pour ajouter quelqu’un, invitez-le dans cet espace sous TAKATAK → Équipe et autorisations ; son rôle dans l’espace décide de ce qu’il peut faire dans Food Hub. · Everyone signs in with their own TAKATAK account. To add someone, invite them to this workspace in TAKATAK → Team &amp; Permissions; their workspace role decides what they can do in Food Hub.
          </div>
        </div>
        <Link className="button" href="/dashboard/team">Inviter ou changer les rôles · Invite or change roles</Link>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h2 style={{ marginTop: 0, fontSize: 16 }}>People in {access.workspaceName ?? 'this workspace'}</h2>
        {team.length === 0 ? <div className="small">Aucun membre trouvé. · No members found.</div> : (
          <table>
            <thead><tr><th>Nom · Name</th><th>Courriel · Email</th><th>Rôle TAKATAK · TAKATAK role</th><th>Dans Food Hub · In Food Hub</th><th>Statut · Status</th></tr></thead>
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
        <h2 style={{ marginTop: 0, fontSize: 16 }}>Comment les rôles TAKATAK s’appliquent à Food Hub · How TAKATAK roles map to Food Hub</h2>
        <table>
          <thead><tr><th>Rôle dans l’espace TAKATAK · TAKATAK workspace role</th><th>Accès à Food Hub · Food Hub access</th></tr></thead>
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
