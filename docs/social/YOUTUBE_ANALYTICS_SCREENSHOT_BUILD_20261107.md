# TAKATAK YouTube Analytics — single-page screenshot work (2026-11-07)

**Owner directive:** Build from Metricool reference screenshots one at a time; **do not merge to main until owner explicitly sends LAST PAGE**. Preserve the Google OAuth, selected brand, protected API, and TAKATAK billing rules.

## Single-page architecture
The ONLY top-level sections in order are: Community; Published videos; Viewed videos; Competitors.
The titles are intra-page navigation anchors, not separate page routes. Screenshot 1 contains the page-wide header and beginning of Community. The owner explicitly corrected any interpretation that the first screenshot is itself a separate section.

## Work delivered on isolated branch (Screenshot 1 groundwork)
- Connected YouTube dashboard embeds Community growth visual in existing /dashboard/social/youtube page.
- In-page four-anchor navigation and main-period selection. Empty anchors for later screenshot sections are temporary and NOT a release.
- Community cards: current subscriber count; daily net subscriber gains/losses; video views; authorized estimated revenue; current channel video count.
- Uses official YouTube Data API channels.list and YouTube Analytics API reports.query. No synthetic metrics or Metricool data.
- Uses encrypted existing Google credential, scope-aware handling, and active Client/Brand/selected YouTube channel boundaries. No tokens in response.
- API enforces view_social, effective Social paid or exemption access (SOCIAL_CONNECTION_SETUP_CLIENT_IDS), configured history limits, and comparison entitlement.
- Metricool upgrade messaging is not copied; no subscription prompts for paid or exempt TAKATAK accounts. Non-exempt unsubscribed accounts see TAKATAK signup callout only.
- Unavailable revenue or reporting data is not rendered as real zero.

## Verification / blockers
- This is an unmerged feature. Real YouTube account validation and complete integration tests NOT yet complete.
- OAuth source requests yt-analytics.readonly but ongoing Google verification screenshot lists yt-analytics-monetary.readonly; resolve the discrepancy later without prematurely changing Google's in-progress review.
- Run TypeScript, lint, build and negative access tests. Verify actual YouTube token refresh, empty API responses and per-tenant isolation.
- Fill the other three screenshot sections exactly when received; do not invent their content.
- No database migration or production environment variables added.

## Handoff
Branch: feature/youtube-analytics-single-page-20261107
Keep draft until LAST PAGE, then complete QA, review and merge only with the owner's previously stated release gate. Rebase/reconcile latest main prior to final merge.

Signed: GPT-6 @ ChatGPT — 2026-11-07.
## Screenshot batch received 2026-11-07 (three images)
- Published videos: searchable video list with Columns and CSV, plus the published-video engagement chart from the preceding screenshot.
- Viewed videos: real daily Views, Likes, Dislikes, Comments and Shares chart, followed by a separate searchable list with Columns and CSV. Empty list states remain honest.
- Main period is now a start/end date selector with presets. The server validates calendar dates, max 365 days and the paid plan's oldest-allowed day. Client and server share the same selected reporting range.
- New server-only provider builds a bounded 200-video uploads list from the selected channel's official uploads playlist, verifies video metadata against the channel, and requests owner-authorized YouTube Analytics video/day reports. Viewed videos includes older uploads with activity during period. Download CSV exports only loaded rows, escapes spreadsheet formula triggers.
- No YouTube access tokens, arbitrary channel IDs, or cross-tenant query selectors are returned to the browser.
- The screenshot's Add to dashboard action is visible but **disabled**, since a persistent workspace-scoped pinning contract has not yet been verified. Do not represent it as implemented.
- Comparison charts for Published and Viewed remain an acceptance gap; the earlier Community comparison is preserved. Do not claim full comparison functionality yet.
- Competitors remains an empty in-page anchor pending user's final screenshots. **Do not merge main until LAST PAGE**.
- Current commits are source-only, production unchanged, remote Google API evidence not available in this session. Check PR CI and real provider-backed acceptance before release.

Signed: GPT-6 @ ChatGPT — 2026-11-07.
