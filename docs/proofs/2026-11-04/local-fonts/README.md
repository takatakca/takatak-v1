# Local font build and browser proof

Scope: actual local production build from latest-main base `b853bb6` plus `feature/cloud-local-fonts`. The result records the build ID and SHA256 of the four loader modules and dependency lockfile; the recorded Git head is the base because those reviewed changes were still uncommitted during the proof. No database credentials or service secrets were supplied.

The actual emitted six WOFF2 files byte-match their integrity-locked Fontsource packages; each contains the tested Canadian French accented letters and Œ/œ. All six return HTTP200 with `font/woff2`. The five original font licenses return HTTP200 unchanged. Chromium loads all five families and both serif styles on English desktop, French mobile and the French OAuth notice, using only same-origin font requests. No page errors or external font requests occurred. Only Inter and Montserrat preload on the website; only Montserrat preloads in OAuth. Geist, Geist Mono and the below-hero serif remain unpreloaded. The OAuth content retains its existing `main lang=fr-CA` language boundary.

[Results](results.json) · [English desktop](home-en-desktop.png) · [French mobile](home-fr-mobile.png) · [French OAuth notice](oauth-fr.png). These captures contain the actual public local UI, not authenticated production accounts.

Reproduce after a successful V1 build in the full owner workspace:

```sh
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium node scripts/verify-local-fonts.mjs
```

The optional verifier uses FoodHub's installed pinned Playwright from the sibling checkout. For a separate installed Playwright tool package, set `LOCAL_FONT_PROOF_PLAYWRIGHT_ROOT`. Set `LOCAL_FONT_PROOF_OUTPUT` to save captures/results elsewhere and `LOCAL_FONT_PROOF_PORT` to choose a free loopback port. The verifier starts/stops only its own built V1 process, supplies no provider/DB/auth credentials, keeps proxy/CA settings and refuses external browser requests.

Full build/typecheck, required-source/module-load checks, access/auth/identity suites,11 website SEO checks and website theme check passed. Full lint has zero errors and12 pre-existing warnings; changed loader modules and the verifier lint clean. The compiled-module audit deliberately skips the normal generated checksum stamp because this cloud uses the official types-only Prisma bootstrap. Database queries/migrations, authenticated provider behavior, CI, main merge and production deployment are not certified by this proof.

— signé : Codex build continuation @ Codex cloud · 2026-11-04
