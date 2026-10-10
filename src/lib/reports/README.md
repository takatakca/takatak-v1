# Reporting Engine Data Layer (Phase 10)

Pattern: all reporting data flows through `reporting-data.ts`; pages never
import Prisma directly. Every function returns `{ source, sourceLabel, ... }`
— database when configured and queries succeed, otherwise typed mock
foundation data mirroring the seed, with safe error logging and no crashes.

Hard boundaries of this layer:
- PDF export is an authenticated download for one workspace (`/dashboard/reports/export/pdf`).
- Delivery writes a ReportShare (`shared_internal`) and an in-dashboard notification. It does not send email and it does not create a public link.
- NO AI summary calls — every summary/section is hand-written foundation text
  prefixed "[Internal foundation summary — …not AI-generated]" or
  "[Foundation content — internal preview, not AI-generated]".
- NO provider calls: OpenAI, TryHolo, Metricool, and Upmind are never touched.
- Schedules: `active_internal` displays as "Active (internal only)" — a
  record exists but no background worker runs anywhere.

Metric sources declare provenance honestly: internal, social_foundation,
web_hosting_foundation, ai_foundation, manual — with `future_provider`
reserved for real provider analytics after verified connections. The
`ai_generated_outputs` metric is seeded at 0 because nothing is AI-generated.

Future phases: report generation via the jobs system, module data assembly,
real PDF export, delivery, share links, and AI summaries — each behind its
own verified activation boundary.
