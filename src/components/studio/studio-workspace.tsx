"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { STUDIO_TRACKS, parseStudioPack, studioPack, type StudioBrief, type StudioTrack } from "@/lib/studio/production";

type Project = StudioBrief & { id: string; createdAt: string };
type Output = { id: string; title: string; content: string; metadata: { projectId?: string; track?: string } };
const initial: StudioBrief = { title: "", brief: "", language: "en", audience: "", characters: [] };
const labels = { video: "Video script", book: "Book outline", music: "Lyrics & composition brief" };
async function api(url: string, body?: unknown) {
  const response = await fetch(url, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : { cache: "no-store" });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message ?? data.code ?? "Request unavailable");
  return data;
}
export function StudioWorkspace({ creditsPerDraft }: { creditsPerDraft: number | null }) {
  const [brief, setBrief] = useState<StudioBrief>(initial);
  const [projects, setProjects] = useState<Project[]>([]);
  const [outputs, setOutputs] = useState<Output[]>([]);
  const [unlinked, setUnlinked] = useState<{ projectId: string; track: StudioTrack; text: string }[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const requests = useRef<Record<string, string>>({});
  const active = projects.find(p => p.id === activeId);
  async function load(offset = 0) {
    const data = await api(`/api/studio/projects?offset=${offset}`);
    setProjects(p => offset ? [...p, ...data.projects] : data.projects);
    setOutputs(data.outputs); setNextOffset(data.nextOffset);
  }
  useEffect(() => { void load().catch(e => setMessage(e.message)); }, []);
  const field = "mt-2 w-full rounded-lg border border-slate-300 bg-white p-3 text-sm text-slate-900";
  const button = "rounded-lg bg-blue-700 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50";
  async function create() {
    setBusy(true); setMessage("");
    try { const result = await api("/api/studio/projects", brief); await load(); setActiveId(result.id); setBrief(initial); setMessage("Creative production saved in your TAKATAK workspace."); }
    catch (e) { setMessage(e instanceof Error ? e.message : "Could not save production"); } finally { setBusy(false); }
  }
  async function generate(track: StudioTrack) {
    if (!active) return;
    const key = `${active.id}:${track}`;
    const requestId = requests.current[key] ?? crypto.randomUUID();
    requests.current[key] = requestId;
    setBusy(true); setMessage("");
    try {
      const result = await api("/api/studio/generate", { projectId: active.id, track, requestId });
      delete requests.current[key];
      if (!result.linked) setUnlinked(old => [...old, { projectId: active.id, track, text: result.text }]);
      setMessage(result.linked ? `Draft saved. ${result.credits} TAK-TAK credits used. Nothing published.` : "Generation completed. The Studio link could not be saved; check AI Studio Saved Outputs before generating again.");
      await load();
    } catch (e) { setMessage(`${e instanceof Error ? e.message : "Request uncertain"}. Check AI Studio Saved Outputs before starting another generation. This screen retains the request ID for retries.`); }
    finally { setBusy(false); }
  }
  function download() {
    if (!active) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(studioPack(active), null, 2)], { type: "application/json" }));
    const link = document.createElement("a"); link.href = url; link.download = "takatakstudio-production.json"; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <div className="space-y-6">
    <section className="rounded-2xl bg-[#060D1F] p-6 text-[#F5F8FC] sm:p-9"><p className="text-xs font-semibold tracking-widest text-[#29C3FF]">GROUPE TAKATAK · CREATIVE ENGINE</p><h1 className="mt-3 text-3xl font-bold">TAKATAKSTUDIO</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-[#B8C4D3]">One creative project. Video, books and music. Powered by your existing TAK-TAK engines and workspace.</p><div className="mt-5 flex flex-wrap gap-4 text-sm"><Link href="/dashboard/ai-studio/saved" className="text-[#29C3FF] underline">Saved AI outputs</Link><Link href="/dashboard/ai-studio/usage" className="text-[#29C3FF] underline">Credits & usage</Link><Link href="/dashboard/social" className="text-[#29C3FF] underline">Social connections</Link></div></section>
    <p role="status" className="min-h-6 text-sm text-slate-700">{message}</p>
    <div className="grid gap-6 xl:grid-cols-[minmax(280px,1fr)_2fr]">
      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5"><h2 className="text-lg font-bold text-slate-900">Your productions</h2>{projects.length === 0 && <p className="text-sm text-slate-600">Create your first production below, or import a Studio request pack.</p>}{projects.map(p => <button type="button" key={p.id} onClick={() => setActiveId(p.id)} className={`w-full rounded-xl border p-4 text-left ${p.id === activeId ? "border-blue-600 bg-blue-50" : "border-slate-200"}`}><span className="block font-semibold text-slate-900">{p.title}</span><span className="text-xs text-slate-600">{p.language.toUpperCase()} · {p.audience}</span></button>)}{nextOffset !== null && <button disabled={busy} className="text-sm text-blue-700 underline" onClick={() => void load(nextOffset).catch(e => setMessage(e.message))}>Load more productions</button>}</section>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">{active ? <><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-bold text-slate-900">{active.title}</h2><p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{active.brief}</p></div><button className="text-sm text-blue-700 underline" onClick={download}>Export creative brief</button></div><div className="mt-6 grid gap-4 md:grid-cols-3">{STUDIO_TRACKS.map(track => <div key={track} className="rounded-xl border border-slate-200 p-4"><h3 className="font-semibold text-slate-900">{labels[track]}</h3><p className="my-3 text-xs leading-5 text-slate-600">{creditsPerDraft === null ? "Pricing unavailable" : `${creditsPerDraft} existing TAK-TAK credits per draft`}. Text draft for review.</p><button disabled={busy || creditsPerDraft === null} className={button} onClick={() => void generate(track)}>Generate draft</button></div>)}</div><p className="mt-5 text-xs leading-5 text-slate-600">No video rendering, music synthesis, private KnowledgeAI retrieval or automatic publishing runs from these buttons.</p><div className="mt-6 space-y-4">{unlinked.filter(o => o.projectId === active.id).map((o, i) => <details open key={`unlinked-${i}`} className="rounded-xl border border-amber-300 p-4"><summary className="font-semibold text-slate-900">{labels[o.track]} — Studio link not saved</summary><p className="my-3 text-xs text-slate-600">Copy this text before leaving. Check Saved AI Outputs for the central saved record; do not regenerate to repair a link.</p><pre className="whitespace-pre-wrap font-sans text-sm text-slate-700">{o.text}</pre></details>)}{outputs.filter(o => o.metadata.projectId === active.id).map(o => <details key={o.id} className="rounded-xl border border-slate-200 p-4"><summary className="cursor-pointer font-semibold text-slate-900">{labels[o.metadata.track as StudioTrack] ?? "Saved draft"}</summary><pre className="mt-4 whitespace-pre-wrap font-sans text-sm leading-6 text-slate-700">{o.content}</pre></details>)}</div><p className="mt-4 text-xs text-slate-600">Showing the latest 30 Studio outputs across this workspace. Older drafts remain in Saved AI Outputs.</p></> : <div className="py-10 text-center"><h2 className="text-xl font-bold text-slate-900">Choose an idea to develop.</h2><p className="mt-3 text-sm text-slate-600">Your workspace owns its briefs, character profiles and outputs.</p></div>}</section>
    </div>
    <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7"><h2 className="text-xl font-bold text-slate-900">Create a production</h2><form onSubmit={e => { e.preventDefault(); void create(); }} className="mt-5 grid gap-5 md:grid-cols-2"><label className="text-sm text-slate-700">Title<input className={field} required maxLength={120} value={brief.title} onChange={e => setBrief({ ...brief, title: e.target.value })} /></label><label className="text-sm text-slate-700">Audience<input className={field} required maxLength={150} value={brief.audience} onChange={e => setBrief({ ...brief, audience: e.target.value })} /></label><label className="text-sm text-slate-700 md:col-span-2">Creative brief<textarea className={field} rows={4} required maxLength={1000} value={brief.brief} onChange={e => setBrief({ ...brief, brief: e.target.value })} /></label><label className="text-sm text-slate-700">Output language<select className={field} value={brief.language} onChange={e => setBrief({ ...brief, language: e.target.value as "en" | "fr" })}><option value="en">English</option><option value="fr">Français canadien</option></select></label><div><p className="text-sm text-slate-700">Characters ({brief.characters.length}/3)</p><button type="button" disabled={brief.characters.length >= 3} onClick={() => setBrief({ ...brief, characters: [...brief.characters, { name: "", profile: "" }] })} className="mt-3 text-sm text-blue-700 underline disabled:opacity-50">Add a character</button></div>{brief.characters.map((c, i) => <div key={i} className="rounded-xl border border-slate-200 p-4"><label className="text-sm text-slate-700">Character name<input className={field} maxLength={60} required value={c.name} onChange={e => setBrief({ ...brief, characters: brief.characters.map((old, n) => n === i ? { ...old, name: e.target.value } : old) })} /></label><label className="mt-3 block text-sm text-slate-700">Confirmed character details<textarea className={field} maxLength={250} value={c.profile} onChange={e => setBrief({ ...brief, characters: brief.characters.map((old, n) => n === i ? { ...old, profile: e.target.value } : old) })} /></label><button type="button" className="mt-3 text-xs text-slate-600 underline" onClick={() => setBrief({ ...brief, characters: brief.characters.filter((_, n) => n !== i) })}>Remove character</button></div>)}<div className="flex flex-wrap items-center gap-4 md:col-span-2"><button className={button} disabled={busy} type="submit">Save creative production</button><label className="cursor-pointer text-sm text-blue-700 underline">Import Studio JSON<input className="sr-only" type="file" accept="application/json,.json" onChange={async e => { const file = e.target.files?.[0]; if (!file) return; if (file.size > 16384) { setMessage("Import must be under 16 KiB."); return; } try { const imported = parseStudioPack(JSON.parse(await file.text())); if (!imported) throw Error("Invalid Studio pack. Brief: 1,000 characters; up to three character profiles: 250 characters each; output language: en or fr."); setBrief(imported); setMessage("Creative brief loaded. Review and save it to your active workspace. Approval and publishing states were not imported."); } catch (error) { setMessage(error instanceof Error ? error.message : "Invalid file"); } e.target.value = ""; }} /></label></div></form></section>
  </div>;
}
