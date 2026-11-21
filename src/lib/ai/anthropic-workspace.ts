// A Claude API key created for "All workspaces" (organization scope) must name
// a workspace on every request, or the API answers 400. Set
// ANTHROPIC_WORKSPACE_ID (wrkspc_…) on the server for such a key. Leave it
// unset for a key that belongs to one workspace: nothing extra is sent.

const WORKSPACE_ID = /^wrkspc_[A-Za-z0-9]{8,64}$/;

export function anthropicWorkspaceHeaders(env: Record<string, string | undefined> = process.env): Record<string, string> {
  const id = env.ANTHROPIC_WORKSPACE_ID?.trim();
  return id && WORKSPACE_ID.test(id) ? { "anthropic-workspace-id": id } : {};
}
