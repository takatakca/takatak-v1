# MIMT.CA — website launch rescue and full redesign specification

**Status:** Observed public `https://mimt.ca` HTML on 2026-10-08. The site resolves, but its content is **not reliable enough to accept telecom orders**. **Website source/CMS and deploy pipeline have not been established**; inventory before editing or replacing.

## Verified public-page failures to fix

1. Main navigation and service links still say **Fongo Mobile, Fongo Works, Fongo Internet, Fongo Wireless**; about/support menus say Fongo. The About copy presents a Fongo description instead of MIMT. This must be fully rewritten with original MIMT copy and branding.
2. MIMT Mobile page asserts an app is available on iOS/Android/macOS/ChromeOS, a free Canadian number and unlimited nationwide calls. None has been verified in a published MIMT product build. Remove or change to clearly tagged **planned / join waitlist**, not actionable false promises.
3. Home Phone copy claims **$4.95/mo** unlimited CAN/US calling. MIMT Works says **free unlimited calling** and **$10/mo Pro**, includes the phrase **Fongo Works Pro**. Internet advertises **$40/month unlimited**. Suspend these unapproved quotes until provisioning, costs, coverage, terms, contract and billing are real.
4. Links `href` that route to third-party offerings, dead pages or demo placeholders must not be presented as functional MIMT signup/support. Check every CTA/login link, footer/contact, mobile nav, language toggle and form by actual click test.
5. A telecom storefront requires clear business identity, subscriber terms, valid French-language Québec customer-facing text, privacy/CASL, number retention and transfer, realistic coverage, VoIP 9-1-1 limitations, complaints/support, no unsupported 24/7 support promise.

Public observation: https://mimt.ca (2026-10-08); inspect source and analytics before changes.

## Intended site information architecture

```text
/                     Trustworthy home page with what is available NOW
/mobile               Free/Plus/Pro concept, supported vs planned clear
/works                Business phone/IVR/seat-based solutions
/wireless             SIM/eSIM waitlist until signed carrier
/internet             Residential / Business interest + address inquiry
/pricing              Versioned public prices ONLY after finance signoff
/coverage             Provider-backed live availability, not invented map
/port-your-number     Explain portability; no instant-port promise
/help                 FAQ, human support routes, incident/status
/login                TAKATAK master identity, correct tenant/redirect
/register             Real OTP, terms and account verification
/terms, /privacy      Bilingual legal/consent & telecom disclosures
/911                  Emergency limitations, address updates, assistance
```

## Brand, design, UX

- Create a **distinct MIMT communications design system** with coherent logo/typography/colors/iconography; do not copy Fongo/TextNow trademarks, wording, screenshots or UI trade dress. No images without rights.
- Bilingual FR-first Québec + EN with consistent translation keys and no fake translation. Mobile-first accessible responsive design WCAG AA ambition, readable tables, clear service status, sticky top navigation, price comparison, understandable mobile and business funnels.
- Honest conversion: CTA options `Join waitlist`, `Contact sales`, `Try available service` only when checkout works; no misrepresented download link. Real forms with rate-limit/anti-spam/consent and TAKATAK scoped CRM lead event, without labeling anonymous visitor a verified subscriber.
- Site sections: trust/CRTC status only when verified, explain VoIP vs SIM/eSIM, business savings calculator with source-defined rates, hero + feature illustrations, simple pricing, handset/number FAQs, support.
- Separate web marketing from MIMT softphone/app backend; at most use shared contracts/brand tokens. Analytics privacy-first and explicit marketing consent, not automatic cross-business profiling.
- Security: CSP, HTTPS, anti-abuse forms, proper redirect URI and auth callback, privacy/terms language, SEO canonical, structured data, sitemap, robots, error pages, uptime checks.

## Build order — no launch without evidence

1. **DISCOVER**: Identify exact current CMS/project/repository and domain DNS/CDN/host; screenshot desktop/mobile; extract URL/link inventory; retain backup and rollback. Do not overwrite current hosting blindly.
2. **URGENT COPY SAFETY**: remove all Fongo marks/links and false availability/unlimited/price promises; substitute a truthful bilingual coming-soon/lead-capture front page if launch-ready stack is not available. Obtain owner review.
3. **DESIGN**: page map, brand, wireframes, desktop/mobile UI and legal content; review screenshots.
4. **IMPLEMENT**: production-ready site in its actual owning repo (not by dumping a second web app inside takatak-v1); auth via TAKATAK, forms to authorized Leads, marketing analytics/SEO.
5. **VERIFY**: Lighthouse, accessibility, bilingual copy, FR legal pages, mobile/tablet/desktop, every navigation and CTA, form/CRM data isolation, security/consent, search previews, backups and redirect rollback.
6. **RELEASE**: staged smoke, domain routing and owner approval; collect real screenshots and test logs. Do not claim the mobile app exists until its actual public download is verified.

## Acceptance

No Fongo/TextNow brand names or third-party links anywhere; no fake app download, fake telecom/Internet price, false unlimited/coverage/911 claims; correct French/English; functional login/signup/waitlist; documented source, deployment and rollback; responsive clean original experience. Site is not a substitute for the auth-first P0 task in #141.
