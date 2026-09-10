// Request-boundary cookie mutation only. Domain/tenant resolvers report
// stale selection; they never import next/headers or delete cookies.

export type CookieMutator = {
  delete: (name: string) => void;
};

export function applyWorkspaceCookieClear(
  shouldClear: boolean,
  cookieName: string,
  mutator: CookieMutator | undefined,
): boolean {
  if (!shouldClear) {
    return false;
  }
  if (!mutator) {
    return false;
  }
  mutator.delete(cookieName);
  return true;
}
