# takatak.ca video plan (Runway)

Eight 5-second loops that bring the homepage pictures to life. Each starts from a licensed photo of a
real person (`public/photos`, Unsplash licence, see `CREDITS.md`), so nobody on the site is an AI face.
Total: 40 seconds of video. Shot list and prompts: `scripts/media/runway-shots.json`.

## Run it

Needs a Runway API key and a network that can reach `api.dev.runwayml.com` (your computer, or this
cloud environment once that host is allowed in its network settings).

```bash
export RUNWAYML_API_SECRET=…        # from the Runway developer portal; never commit it
npm run media:videos                 # dry run: lists the shots and total seconds
npm run media:videos -- --run        # generates the 8 clips (spends credits)
npm run media:videos -- --run --only website,local   # just some
npm run media:videos -- --run --vertical             # 9:16 copies for Reels, TikTok, Shorts
```

Horizontal clips land in `public/media/videos/<key>.mp4` and are added to
`src/lib/website/media-manifest.json`. The site plays them automatically (muted, looping, only when on
screen, never with reduced motion), with the photo as the still frame until the video loads. Commit the
`.mp4` files and the manifest together.

## The shots, and a ready-to-post caption for each

| Key | Where it plays | Shows | Caption FR | Caption EN |
| --- | --- | --- | --- | --- |
| website | Story 1, Website card | Café owner on the phone behind his counter | Votre commerce mérite un site à sa hauteur. On le bâtit, on l’héberge, on s’en occupe. | Your business deserves a website that matches it. We build it, host it and look after it. |
| domains | Domains card | Customer smiling at her phone in a café | Votre nom, en ligne, aujourd’hui. Trouvez votre domaine .ca sur takatak.ca. | Your name, online, today. Find your .ca domain at takatak.ca. |
| social | Social media card | Hands scrolling a phone over a café table | Une publication, tous vos réseaux. Planifiée, mesurée, sans y passer vos soirées. | One post, every network. Scheduled and measured, without losing your evenings. |
| local | Story 2, Local listings card | Craftsman celebrating in his workshop | Quand on cherche près d’ici, c’est vous qu’on trouve. Fiche Google, cartes, annuaires. | When people search nearby, they find you. Google profile, maps, directories. |
| reviews | Reviews card | Craftsman reading good news | Plus d’avis, de meilleures réponses. Vos clients parlent, on vous aide à répondre. | More reviews, better replies. Your customers talk, we help you answer. |
| marketing | Story 3, Marketing card | Designer on the phone in her studio | Des clients qui reviennent, semaine après semaine. Publicités Meta et Google, mesurées. | Customers who come back, week after week. Meta and Google ads, measured. |
| hosting | Hosting card | Professional on a call at her laptop | Un site rapide, sécurisé et sauvegardé chaque jour, avec une vraie équipe derrière. | A fast, secure site backed up every day, with a real team behind it. |
| billing | Billing card | Professional finishing her call, smiling | Factures avec TPS et TVQ, payées en ligne. Moins de suivi, plus de temps. | Invoices with GST and QST, paid online. Less chasing, more time. |

Rules for every caption and post: no prices that are not in `src/lib/website/pricing.ts`, no client
names, no results we cannot prove, and each delivery platform is only ever named on its own.

## Phase 2: product videos from the agents' raw material

Food Hub, the Clover suite, QMAPS, FLEXS, MIMT and TAK bot need screen recordings of the real products
(without merchant or customer data). The request to each product's agent is in
`docs/media/RAW_MATERIAL_REQUEST.md`. When the recordings arrive, cut each to 5–8 seconds and add it to
`media-manifest.json` under the product's key.

## Related: Clover Marketplace film pack

A marketing agent already wrote 12 Clover app films (scripts, storyboards, Runway prompts, voice-over
FR/EN) in `foodhubca/docs/2026-10-28 18-23 — Pack vidéos Marketplace Clover — scripts storyboards prompts Runway.md`.
Reuse it for the Clover suite; do not rewrite it. One correction before production: that pack uses a
black-and-gold palette, but `BRAND.md` retired the gold. Use electric blue on deep navy, or the light
theme of the new site, in its prompts and title cards.
