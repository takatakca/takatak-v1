# MIMT wholesale telecom, Internet reseller and compliance decision log

**Status:** commercial research + supplier outreach, NOT a claim of active reseller authorization, API production access, signed rate card or CRTC service-launch approval. Confidential contracts belong in controlled records, not this public GitHub repository.

## Evidence vs ambition

- **Vidéotron**: correspondence on TAKATAK's connected Gmail around November–December 2025 documents a wholesale-channel relationship, NDA circulation and subsequent **AITP (third-party Internet access)** information. This is actual supplier engagement. However, an NDA/informational document does not by itself prove a **signed wholesale resale agreement**, price approval, credentials, provisioning integration or launch authorization. Vidéotron explained AITP as infrastructure for independently delivered Internet service, not simple resale of retail subscriptions. Preserve original evidence in access-restricted contract storage.
- **Bell**: external channel-partner application/meeting discussion in late 2025. Does not prove enrolled partner privileges, verified prices or API rights.
- **Rogers Unison**: business wireless telephony offering with number-porting support, but not verified as a reseller-grade programmable DID/SMS/SIP carrier. Unison virtual/auto-attendant numbers may not support SMS; check exact plan, base wireless cost, reseller terms and supported provisioning before any technical dependency.
- **TELUS/Fido/other host operators**: future channels to negotiate. Being a telecom registrant, approved agent or salesperson does **not automatically** grant wholesale rates, white-label resale, SIM/eSIM provisioning rights, customer account API access or instant number transfer.
- **Programmable providers**: compare Twilio, Telnyx, SignalWire, VoIP.ms, Bandwidth, Flowroute and DIDWW by real Quebec DID coverage, Canadian SMS support, voice quality, port-in/out, wholesale tiers, emergency support, APIs and contract terms. **Published list price is not a guaranteed wholesale quote.**

## Requirement matrix — fill with documentary evidence, do not guess

| Attribute | Must be verified before selection |
| --- | --- |
| Reseller/legal status | Exact entity, resale rights, territory, minimum commitment, branding |
| Inventory | Canada/Québec rate centres, inventory API, DID monthly fee, number ownership/portability |
| Voice | SIP / programmable calls / mobile SDK / hunt groups, inbound + outbound metered rates, audio QoS |
| SMS/MMS | 2-way Canadian SMS/MMS, long/short code/verification limitations, carrier passthrough |
| E911 | Per-DID address, mobile/nomadic notices, 933 test method, routing provider and legal attestation |
| Lifecycle API | Sandbox, authentication, number buy/hold/release, port orders, event webhooks, tenant delegation |
| Billing | Currency, per-seat/month, SIM/data/underlying plan, minimums, FX, taxes, install, termination |
| Support | Hours, escalation, incident/outage SLA, fraud/abuse and data export |
| Wireless | eSIM ICCID/EID, MNO host, voice/SMS vs data-only, activation and porting contracts |
| Internet | Residential AITP/TPIA vs referral vs authorized retail resale vs business transport; address check, installation, CPE, billing responsibility |

## Design for wholesale switching without lost customers

```text
MIMT subscriber + immutable line_id (our IDs)
  -> provider registry/capability matrix (voice, SMS, DID, 911, SIM, internet)
  -> Twilio adapter initially OR validated carrier adapter
  -> port order with consent & async states
  -> parallel readiness checks for inbound/outbound voice, SMS, caller ID, 911
  -> cut over routing only after success; retire old provider inventory only after finalization
```

Do **not** port automatically on first payment or promise instant number movement. Carrier ports may take business days and require documentation, buyer authorization and manual provider approval. It may cost less to assign paying/free customers on the same low-cost provider from day 1 rather than repeatedly porting. A migration to Rogers or another provider MUST preserve SMS, emergency routing and operational mobile-app access or be prohibited.

**Emergency calling:** 911 cannot be suspended as punishment for exhausted ads or minute credits. Operational readiness requires approved carrier emergency arrangement, validated addresses, bilingual disclosure, consent, test procedure and regulatory documentation. Never test real emergency numbers casually.

## Canadian regulatory and consumer obligations

- Owner reports CRTC telecom reseller/registration/licence activity already undertaken; **verify current official status, applicable STIB/BITS affidavit/filings and entity names** against signed confirmation (not merely an application or email).
- Local nomadic VoIP requires provider-specific CRTC 9-1-1 obligations and potentially filing/approved customer notifications. Consult https://crtc.gc.ca/eng/phone/911/voip.htm and qualified counsel before public PSTN release.
- Québec privacy Law 25, PIPEDA where applicable, customer access/correction/export, French-language contracts/customer service, CASL marketing permissions, account and number porting, CCTS/telecom consumer protection where applicable.
- Maintain phone number assignments, service addresses, CDR usage, incident records and disclosures with proper lawful retention; restrict recordings/SMS contents and never feed private conversations into a general agency knowledge base.
- When building cellular and Internet services, determine relevant wholesale/commercial technical onboarding and registrations separately from VoIP; contracts govern access.

## Next commercial step (after AUTH)

Send a standardized, private request for quotation to each supplier, not a public press release: legal reseller rights; CAD DID monthly fee per 10/100/1k/10k DIDs; inbound/outbound and 2-leg calls; Canadian SMS/MMS; 911; porting SLA/API; BYOC/SIP/mobile SDK; wholesale SIM/eSIM and data; residential/business internet wholesale and provisioning; per-brand dashboards; support/SLA; termination and data export.

Collect dated quote, exact plan/tenant, signed authorization, credential readiness, dev API documentation and owner decision in access-restricted records; publish only safe provider status summaries to code/issue. P0 remains TAKATAK AUTH.
