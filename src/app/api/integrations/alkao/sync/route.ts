export { POST } from "@/lib/integrations/alkao/route";

// Segment config must be declared here, not re-exported, for Next.js to read it.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
