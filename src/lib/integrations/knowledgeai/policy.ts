// Pure TAKATAK authority decision: deliberately independent of any UI or
// browser claims. Every token needs a *central* product grant + scope grant,
// an active session, an active membership and an effective role permission.
export const KNOWLEDGEAI_SCOPES = [
  "knowledge:read","knowledge:write","knowledge:delete","knowledge:export",
] as const;
export type KnowledgeAiScope=(typeof KNOWLEDGEAI_SCOPES)[number];

const requiredPermission: Record<KnowledgeAiScope,string> = {
  "knowledge:read":"view_reports",
  "knowledge:write":"create_content",
  "knowledge:delete":"manage_services",
  "knowledge:export":"manage_settings",
};

export interface KnowledgeAiGrantDecision {
  enabled:boolean;
  allowRead:boolean;
  allowWrite:boolean;
  allowDelete:boolean;
  allowExport:boolean;
  expiresAt:Date|null;
}
export interface KnowledgeAiIdentityDecision {
  mode:string;
  profileId:string;
  activeClientId:string;
  allowedClientIds:readonly string[];
  sessionMatchesProfile:boolean;
  profileActive:boolean;
  membershipActive:boolean;
  clientActive:boolean;
  productActive:boolean;
  effectivePermissions:readonly string[];
}
export function isKnowledgeAiScope(value:unknown):value is KnowledgeAiScope {
  return typeof value==="string" &&
    (KNOWLEDGEAI_SCOPES as readonly string[]).includes(value);
}
export function canIssueKnowledgeAiScope(
  identity:KnowledgeAiIdentityDecision,
  grant:KnowledgeAiGrantDecision|null,
  scope:KnowledgeAiScope,
  now:Date=new Date()
):boolean {
  if (!identity || identity.mode!=="client_scoped" ||
      !identity.profileId || !identity.activeClientId ||
      !identity.allowedClientIds?.includes(identity.activeClientId) ||
      !identity.sessionMatchesProfile || !identity.profileActive ||
      !identity.membershipActive || !identity.clientActive ||
      !identity.productActive || !grant?.enabled ||
      !(grant.expiresAt instanceof Date) ||
      !Number.isFinite(grant.expiresAt.getTime()) ||
      grant.expiresAt.getTime()<=now.getTime() ||
      !identity.effectivePermissions.includes(requiredPermission[scope])) {
    return false;
  }
  const allowFlag:Record<KnowledgeAiScope,boolean>={
    "knowledge:read":grant.allowRead,
    "knowledge:write":grant.allowWrite,
    "knowledge:delete":grant.allowDelete,
    "knowledge:export":grant.allowExport
  };
  return allowFlag[scope]===true;
}
