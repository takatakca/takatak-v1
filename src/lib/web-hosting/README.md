# Web / Hosting Data Layer (Phase 7)

Pattern: identical to the social module — all data flows through
`web-hosting-data.ts`; pages never import Prisma directly. Every function
returns `{ source, sourceLabel, ... }`: database when configured and queries
succeed, otherwise typed mock foundation data (mirroring the seed) with safe
error logging and no crashes.

Status meanings that require care:
- HostingService `active_internal` = internal database status only. It never
  means a real provider provisioned anything.
- ProvisioningStep `completed_internal` = internal/demo completion only.
- DnsRecord / SslCertificate `source: internal_demo` = placeholder tracking
  rows; values are clearly labeled and never claimed live.

Upmind boundary: nothing in this folder calls Upmind. Domain search,
registration, hosting provisioning, DNS editing, SSL installation, and
invoice sync all arrive with the Phase 8 adapter in
`src/lib/integrations/upmind`, gated behind the same honest state ladder used
for Metricool (never "connected" without a real credentialed API success).
