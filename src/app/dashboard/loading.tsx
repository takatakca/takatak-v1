export default function DashboardLoading() {
  // Honest copy: this is the app preparing the page — it never claims
  // provider data is syncing.
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <div className="flex items-center gap-3 text-slate-400">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-500" />
        <span className="text-sm">Preparing page…</span>
      </div>
    </div>
  );
}
