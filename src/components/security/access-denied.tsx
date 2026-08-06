import { ShieldX } from "lucide-react";

/** Safe denial screen: explains the state without leaking access details. */
export function AccessDenied({ title, message }: { title: string; message: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <ShieldX className="mx-auto h-8 w-8 text-slate-300" />
        <h1 className="mt-3 text-xl font-semibold text-slate-900">{title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">{message}</p>
        <form action="/auth/signout" method="post" className="mt-5">
          <button type="submit" className="rounded-lg bg-slate-100 px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200">
            Sign out
          </button>
        </form>
      </div>
    </main>
  );
}
