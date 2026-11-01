import { handleReviewMcp } from "@/lib/reputation/agent-tools";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  return handleReviewMcp(request);
}

// This stateless JSON response transport does not create a server event stream.
export async function GET() {
  return new Response(null, {
    status: 405,
    headers: { Allow: "POST", "Cache-Control": "private, no-store" },
  });
}
