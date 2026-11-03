# Seasonal promotions (automatic)

*Promotions des fêtes et des saisons, automatiques. Résumé en français plus bas.*

Owner's order (2026-11-01): follow the seasons and the big retailers' calendar, every holiday, at **5, 7 or 10 %**,
automated; and **always 15 % when a monthly service is paid a year in advance**.

## How it works

- `src/lib/promotions/seasons.ts` computes every campaign for any year (no one adds them by hand). Dates are in Montréal
  time, with the right daylight-time offset. Movable dates are computed: Easter, Mother's Day (2nd Sunday of May),
  Father's Day (3rd Sunday of June), Canadian Thanksgiving (2nd Monday of October), Black Friday (day after the 4th
  Thursday of November) and Cyber Monday.
- `src/lib/promotions/catalog.ts` treats each one like any promo code, with `startsAt` and `endsAt`: the code exists only
  inside its window, so preview, claim and checkout refuse it before and after, and every countdown is true.
- While a campaign runs it appears in `GET /api/promotions/active` (homepage countdown), at `/offres/<CODE>` (landing
  page), in browser push alerts, and in the visitor's available promotions.
- One code per order (`quotePromo`); FIRST10 stays the welcome offer.

| Code (2026) | % | Window (Montréal) |
| --- | --- | --- |
| NOUVELAN2026 | 7 | Jan 2 – 15 |
| VALENTIN2026 | 5 | Feb 7 – 14 |
| PAQUES2026 | 5 | Mar 29 – Apr 6 |
| MERES2026 | 5 | May 3 – 10 |
| PERES2026 | 5 | Jun 14 – 21 |
| FETEJUIN2026 | 7 | Jun 20 – Jul 2 |
| ETE2026 | 7 | Jul 8 – 15 |
| RENTREE2026 | 7 | Aug 25 – Sep 8 |
| MERCI2026 | 5 | Oct 6 – 12 |
| HALLOWEEN2026 | 5 | Oct 25 – 31 |
| BF2026 | 10 | Nov 23 – 27 |
| CYBER2026 | 10 | Nov 28 – 30 |
| FETES2026 | 7 | Dec 8 – 24 |
| BOXING2026 | 10 | Dec 26 – 31 |

Next year's codes (`BF2027`…) are ready the same way. To change a percentage or a window, edit the `DEFS` list in
`seasons.ts`; `npm run qa:promotions` checks the dates.

## Yearly prepayment: 15 %

`ANNUAL_PREPAY_PERCENT = 15` and `annualPrepayQuote(monthlyCents)` in `catalog.ts`. The plan builder on the homepage
shows the yearly price of the monthly services ("Payé à l'année : -15 %") with the saving. MIMT keeps its own pricing
(12 months for the price of 11).

## Owner decision still open

Can a seasonal code be combined with the yearly 15 %? Today checkout takes one code, and the 15 % is shown on the plan
as a yearly price; the team applies it on the invoice. Say if both should stack.

---

## En bref (français)

- 14 promotions par année, calculées toutes seules : Nouvel An, Saint-Valentin, Pâques, fête des Mères et des Pères,
  Fête nationale et 1er juillet, soldes d'été, rentrée, Action de grâce, Halloween, Black Friday, Cyber lundi, les
  Fêtes, Boxing Day. 5, 7 ou 10 %. Chaque code n'existe que pendant sa période : les comptes à rebours sont vrais.
- Payer à l'année un service mensuel : toujours 15 %. Le constructeur de forfait affiche le prix annuel et l'économie.
- Question pour le propriétaire : un code saisonnier peut-il s'ajouter au 15 % annuel ?

— signé : Claude (cloud session upbeat-einstein) @ Claude Code cloud · 2026-11-01
