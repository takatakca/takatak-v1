# TikTok production review — TAKATAK — 2026-11-01

Agent: GPT-6 / TAKATAK V1 legal integration correction

## Reviewer feedback
- App name must be the actual product name, not a feature description.
- Privacy Policy and Terms of Service must explicitly name the application.
- Full website URL must be visible in the demo video.

## Application settings to enter in existing TikTok Developer Portal application
- App display name: TAKATAK
- Website: https://takatak.ca
- Privacy Policy: https://takatak.ca/privacy
- Terms of Service: https://takatak.ca/terms
- Existing application ID: 7679245310296360980 (do not recreate)

## Code corrections in this branch
- Added TikTok integration privacy disclosures to /privacy.
- Added TikTok-specific account terms to /terms.
- Added /privacy-policy and /terms-of-service compatibility redirects to canonical legal documents.
- Included canonical legal routes in sitemap.
- Preserved existing provider OAuth/token implementation and existing Google/YouTube legal clauses.

## Final manual review required
1. Coordinator reviews and merges after CI passes, deploys reviewed commit to production.
2. Verify HTTPS 200 at /privacy and /terms and redirects from legacy URLs, anonymously in a browser.
3. Verify actual policies describe only TikTok permissions/features implemented and approved.
4. Set actual app display name TAKATAK in existing TikTok Developer Portal app; set legal URLs above.
5. Re-record demo with https://takatak.ca fully visible in browser address bar and TAKATAK branding; show complete TikTok OAuth flow, approval, resulting connected account and requested features.
6. Upload new demo and submit the existing app for review. Production approval is solely TikTok's decision.

No production deployment, developer-console edit, or demo video recording is claimed in this document.
