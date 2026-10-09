# AHMV public source inventory for TAKATAK event provenance

Purpose: define which public systems are currently referenced by the AHM Verdun website and which of those may be approved as event provenance for the TAKATAK Parent Premium backend.

This inventory is a **configuration review aid**, not permission to scrape or republish third-party content. The production allowlist must still be explicitly approved and configured.

## Canonical presentation domain

- `https://ahmverdun.ca`
- Role: new AHM Verdun public website / presentation layer.
- Do not automatically treat this host as an authoritative schedule source. Doing so would create circular provenance when TAKATAK is feeding the presentation layer.

## Current public schedule/data references

### Legacy AHM Verdun public schedule surface

- Host: `ahmverdun.com`
- Current website code still points individual public team schedule links to `https://ahmverdun.com/schedules?teamId=...`.
- Role: legacy/public AHMV schedule surface during migration.
- Candidate event-provenance host: **yes, subject to cutover approval**.

### Scoresheets

- Host: `scoresheets.ca`
- Current website configuration references public simple-letter schedule pages there.
- Candidate event-provenance host: **yes, subject to source/usage approval**.

### Spordle

- Host: `page.spordle.com`
- Current website configuration references Spordle for registration and multiple public schedule/tournament surfaces, including girls hockey.
- Candidate event-provenance host: **yes, only for the specific approved public schedule surfaces**.
- TAKATAK must not treat Spordle registration, roster, payment or private account data as part of this event projection.

### WLLV

- Host: `www.wllv.org`
- Current website configuration links to WLLV and its schedules for AA/BB.
- Candidate event-provenance host: **yes, for approved public WLLV schedule information only**.

## Explicitly not pre-approved

Any host not listed in the production environment variable `AHMV_EVENT_ALLOWED_SOURCE_HOSTS` is rejected.

There is no fallback domain list in the event service. Enabling AHMV event synchronization without an explicit allowlist causes the ingestion endpoint to fail closed.

The allowlist accepts exact HTTPS hostnames only. No wildcards, ports, embedded credentials, lookalike suffixes or URL prefixes are accepted as host configuration.

## Production recommendation

Before cutover, configure only the exact hosts actually used by the approved ingestion flow, for example:

```text
AHMV_EVENT_REQUIRE_SOURCE_URL=true
AHMV_EVENT_ALLOWED_SOURCE_HOSTS=ahmverdun.com,scoresheets.ca,page.spordle.com,www.wllv.org
```

That example is a candidate based on the current website's public references. Remove any host that is not part of the final approved event ingestion path.

## Data minimization

Even from an approved public source, the event normalizer retains only:

- source event ID;
- exact public team ID;
- event type/title;
- start/end/timezone;
- public arena information;
- public event status;
- HTTPS provenance URL;
- source revision timestamp.

Roster, birth date, private contact, medical, guardian and other person-level fields are discarded.
