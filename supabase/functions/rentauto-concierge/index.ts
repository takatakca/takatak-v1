import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { convertToModelMessages, streamText, tool, stepCountIs, type UIMessage } from "npm:ai";
import { z } from "npm:zod";
import {
  createLovableAiGatewayProvider,
  getLovableAiGatewayRunId,
  getLovableAiGatewayResponseHeaders,
  withLovableAiGatewayRunIdHeader,
} from "./ai-gateway.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const KNOWLEDGE: Record<string, string> = {
  ev_charging:
    "Rentauto EV listings show battery range and charge type. Level 2 chargers (240V) add roughly 30-50 km of range per hour; DC fast chargers reach 80% in 20-40 minutes. In Quebec the Circuit Electrique network is the largest. Guests return EVs at the same charge level they received, or pay a recharge fee set by the host.",
  insurance:
    "Every Rentauto trip includes a protection plan chosen at checkout. Plans differ by deductible and coverage of collision, third-party liability and theft. Personal auto insurance and credit card coverage may not extend to peer-to-peer rentals in Quebec, so the platform plan is the primary coverage during the trip.",
  gps_privacy:
    "Vehicles may carry a GPS device, disclosed on the listing. Location is only recorded while a trip is active: pings are dropped before check-in and after check-out. Hosts see location for their own active rentals only, and guests can see the same live map from their trip page.",
  cancellation:
    "Each listing carries a cancellation policy shown before payment and snapshotted onto the booking. Use the policy tool or booking snapshot for exact refund rules; do not invent a cancellation window.",
  host_ratings:
    "Host ratings average guest reviews across cleanliness, maintenance, communication, convenience and listing accuracy. All Star hosts maintain high ratings, fast responses and very few cancellations.",
  checkout:
    "Checkout flow: pick dates on the listing, choose extras and a protection plan, press Reserve to create the booking, then pay through the secure Stripe session. A successful Stripe Checkout is confirmed only after the verified payment webhook updates the booking; then pickup preparation becomes available.",
  host_publishing:
    "To publish a vehicle: complete host onboarding (profile, ID verification, payout account), add the vehicle with photos, registration and insurance documents, set daily price, included kilometres and rules, then submit for review. Listings go live once documents pass review and the payout account is enabled.",
  airports:
    "Supported Quebec airports include YUL (Montreal-Trudeau), YQB (Quebec City Jean-Lesage) and YHU (Saint-Hubert). Airport-enabled listings support meet-and-greet or nearby-lot handover; allow 20-30 minutes between landing and pickup.",
  pickup_times:
    "Best pickup times avoid rush hours (7-9 AM, 4-6 PM). For flights, book pickup 45-60 minutes after landing for domestic and 90 minutes for international. Returns are smoothest before 10 AM.",
  monthly:
    "Monthly-eligible vehicles apply the largest multi-day discount and suit stays of 28 days or more. Compare the monthly total against the daily rate over the same period before booking.",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return json({ error: "AI is not configured." }, 500);

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) return json({ error: "Not authenticated" }, 401);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    const user = userData?.user;
    const db = admin.schema("rentauto");
    if (userErr || !user) return json({ error: "Not authenticated" }, 401);

    const body = await req.json().catch(() => null);
    const parsed = z
      .object({
        threadId: z.string().uuid(),
        messages: z.array(z.any()).max(200),
      })
      .safeParse(body);
    if (!parsed.success) return json({ error: "Invalid request" }, 400);

    const { threadId } = parsed.data;
    const messages = parsed.data.messages as UIMessage[];

    const { data: thread } = await admin
      .from("concierge_threads")
      .select("id, user_id, title")
      .eq("id", threadId)
      .maybeSingle();
    if (!thread || thread.user_id !== user.id) return json({ error: "Thread not found" }, 404);

    // Persist the latest user message
    const last = messages[messages.length - 1];
    if (last && last.role === "user") {
      const { error: insErr } = await db.from("concierge_messages").insert({
        thread_id: threadId,
        user_id: user.id,
        role: "user",
        client_message_id: (last as any).id ?? null,
        message: last as any,
      });
      if (insErr) console.error("persist user message failed", insErr.message);

      const text = (last.parts ?? [])
        .filter((p: any) => p.type === "text")
        .map((p: any) => p.text)
        .join(" ")
        .trim();
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (thread.title === "New conversation" && text) patch.title = text.slice(0, 60);
      await db.from("concierge_threads").update(patch).eq("id", threadId);
    }

    const tools = {
      search_vehicles: tool({
        description:
          "Search live Rentauto inventory for active vehicles. Use for any 'find me a car' request.",
        inputSchema: z.object({
          city: z.string().describe("City or location keyword, empty string for anywhere"),
          category: z.string().describe("Category such as suv, electric, luxury, or empty string"),
          maxDailyPriceCad: z.number().describe("Max daily price in CAD, 0 for no limit"),
          minSeats: z.number().describe("Minimum seats, 0 for no limit"),
          airportPickup: z.boolean().describe("Only airport-pickup enabled vehicles"),
          monthlyEligible: z.boolean().describe("Only monthly-eligible vehicles"),
        }),
        execute: async (i) => {
          let q = admin
            .from("cars")
            .select(
              "id,title,make,model,year,category,seats,doors,fuel_type,transmission,consumption_l_per_100km,base_daily_price_cents,included_km_per_day,extra_km_price_cents,location_label,airport_pickup_enabled,monthly_enabled,instant_book",
            )
            .eq("status", "active")
            .order("base_daily_price_cents", { ascending: true })
            .limit(12);
          if (i.city) q = q.ilike("location_label", `%${i.city}%`);
          if (i.category) q = q.eq("category", i.category.toLowerCase());
          if (i.maxDailyPriceCad > 0) q = q.lte("base_daily_price_cents", Math.round(i.maxDailyPriceCad * 100));
          if (i.minSeats > 0) q = q.gte("seats", i.minSeats);
          if (i.airportPickup) q = q.eq("airport_pickup_enabled", true);
          if (i.monthlyEligible) q = q.eq("monthly_enabled", true);
          const { data, error } = await q;
          if (error) return { error: error.message };
          return { count: data?.length ?? 0, vehicles: data ?? [] };
        },
      }),
      get_vehicle: tool({
        description: "Get full detail for one vehicle by id, including host rating and reviews count.",
        inputSchema: z.object({ carId: z.string() }),
        execute: async ({ carId }) => {
          const { data: car, error } = await admin
            .from("cars")
            .select(
              "id,title,make,model,year,trim,description,category,body_type,seats,doors,fuel_type,transmission,consumption_l_per_100km,features,rules,base_daily_price_cents,included_km_per_day,extra_km_price_cents,location_label,airport_pickup_enabled,monthly_enabled,instant_book,status,host_id",
            )
            .eq("id", carId)
            .maybeSingle();
          if (error || !car) return { error: "Vehicle not found" };
          const { data: reviews } = await admin
            .from("reviews")
            .select("rating_overall")
            .eq("car_id", carId);
          const ratings = (reviews ?? []).map((r: any) => Number(r.rating_overall));
          const { host_id, ...safe } = car as any;
          return {
            vehicle: safe,
            rating_avg: ratings.length ? Number((ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1)) : null,
            rating_count: ratings.length,
          };
        },
      }),
      quote_trip: tool({
        description:
          "Authoritative trip price from the quote engine. Always use this before quoting a total cost.",
        inputSchema: z.object({
          carId: z.string(),
          startAt: z.string().describe("ISO datetime"),
          endAt: z.string().describe("ISO datetime"),
          protectionPlanId: z.string().describe("Protection plan id, empty string for none"),
        }),
        execute: async (i) => {
          const { data, error } = await admin.rpc("rentauto_quote_trip", {
            p_car_id: i.carId,
            p_start_at: i.startAt,
            p_end_at: i.endAt,
            p_selected_extras: [],
            p_protection_plan_id: i.protectionPlanId || null,
          });
          if (error) return { error: "Unable to calculate this trip quote." };
          return data;
        },
      }),
      list_protection_plans: tool({
        description: "List active protection plans with pricing and deductibles.",
        inputSchema: z.object({}),
        execute: async () => {
          const { data } = await admin
            .from("protection_plans")
            .select("id,name,tier,description,price_per_day_cents,deductible_cents,coverage_details")
            .eq("is_active", true)
            .order("sort_order");
          return { plans: data ?? [] };
        },
      }),
      list_cancellation_policies: tool({
        description: "List cancellation policies and their rules.",
        inputSchema: z.object({}),
        execute: async () => {
          const { data } = await db.from("cancellation_policies").select("id,name,summary,rules");
          return { policies: data ?? [] };
        },
      }),
      platform_knowledge: tool({
        description:
          "Rentauto policy and how-to knowledge base. Topics: ev_charging, insurance, gps_privacy, cancellation, host_ratings, checkout, host_publishing, airports, pickup_times, monthly.",
        inputSchema: z.object({ topic: z.string() }),
        execute: async ({ topic }) => {
          const key = topic.toLowerCase().replace(/[\s-]+/g, "_");
          return { topic: key, answer: KNOWLEDGE[key] ?? "No entry. Answer from the other tools instead." };
        },
      }),
      my_trips: tool({
        description: "The signed-in user's own bookings, newest first. Use for trip-specific help.",
        inputSchema: z.object({}),
        execute: async () => {
          const { data } = await admin
            .from("trips")
            .select("id,car_id,start_at,end_at,status,payment_status,total_cents,currency,pickup_location")
            .eq("guest_id", user.id)
            .order("created_at", { ascending: false })
            .limit(10);
          return { trips: data ?? [] };
        },
      }),
    };

    const initialRunId = getLovableAiGatewayRunId(req);
    const gateway = createLovableAiGatewayProvider(apiKey, initialRunId);

    const result = streamText({
      model: gateway("google/gemini-3.6-flash"),
      system: `You are the Rentauto Concierge, the AI rental assistant for Rentauto.ca, a peer-to-peer car rental marketplace in Canada (Quebec-focused). Today is ${new Date().toISOString().slice(0, 10)}.

You help with: finding the best vehicle for a trip, comparing vehicles, recommending protection plans, estimating total trip cost, suggesting airports and pickup times, explaining cancellation rules, host ratings, EV charging, insurance coverage, completing checkout, and helping new hosts publish a vehicle.

Rules:
- Always use tools for facts. Never invent vehicles, prices, plans or policies.
- The quote engine is authoritative for cost. Anything you compute yourself is an estimate; say so.
- All prices are CAD. Values from tools are in cents; present them as dollars.
- Link vehicles as markdown links to /cars/<id>.
- Be concise: short paragraphs, bullets, and a clear recommendation. Offer one next step.
- If the user gives no dates, assume a sensible near-future range and state your assumption.`,
      messages: await convertToModelMessages(messages),
      tools,
      stopWhen: stepCountIs(50),
    });

    const response = result.toUIMessageStreamResponse({
      originalMessages: messages,
      onFinish: async ({ responseMessage }) => {
        const { error } = await db.from("concierge_messages").insert({
          thread_id: threadId,
          user_id: user.id,
          role: "assistant",
          client_message_id: (responseMessage as any)?.id ?? null,
          message: responseMessage as any,
        });
        if (error) console.error("persist assistant message failed", error.message);
        await admin
          .from("concierge_threads")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", threadId);
      },
      headers: getLovableAiGatewayResponseHeaders(undefined, {
        ...corsHeaders,
        ...(initialRunId ? { "X-Lovable-AIG-Run-ID": initialRunId } : {}),
      }),
    });

    return await withLovableAiGatewayRunIdHeader(response, gateway, corsHeaders);
  } catch (e) {
    console.error("concierge error", e);
    return json({ error: e instanceof Error ? e.message : "Unexpected error" }, 500);
  }
});
