import assert from "node:assert/strict";

import { normalize, respond, suggest, understand } from "../src/lib/website/concierge";
import { FICHE_ORDER, answer, emptyFiche, fichePayload, question } from "../src/lib/website/sales-fiche";
import { resolveIntent } from "../src/lib/website/service-intent";

assert.equal(normalize("Hébergement Ça!").trim(), "hebergement ca");
assert.deepEqual(understand("J'ai besoin d'un site web et d'un nom de domaine").services, ["website", "domains"]);
assert.equal(understand("Je suis un restaurant à Laval").business, "restaurant");
assert.ok(understand("Combien pour des avis Google ?").services.includes("reviews"));
assert.ok(understand("combien ça coûte").intents.includes("price"));

// Business only -> the preset for that business, from the catalog.
const resto = respond("j'ai un café", false);
assert.ok(resto.services.includes("website"));
assert.ok(resto.actions.includes("offer_welcome") && resto.actions.includes("finalize"));
// The welcome offer is shown once, unless asked for.
assert.ok(!respond("un site web", true).actions.includes("offer_welcome"));
assert.ok(respond("un rabais ?", true).actions.includes("offer_welcome"));
// A person, on request.
assert.deepEqual(respond("je veux parler à une personne", false).actions, ["human"]);
// Nothing understood -> ask for the goal, no invented answer.
assert.deepEqual(respond("bonjour", false).actions, ["ask_goal"]);
// Suggestions while typing.
assert.equal(suggest("heber")[0], "hosting");
assert.ok(suggest("insta").includes("social"));
assert.deepEqual(suggest("a"), []);

// Sales only: a problem with an existing service goes to support, with no service pushed.
const sup = respond("Mon téléphone ne fonctionne pas", false);
assert.deepEqual(sup.actions, ["support"]);
assert.deepEqual(sup.services, []);
assert.notDeepEqual(respond("Je veux un site web", false).actions, ["support"]);

// The request form: one question at a time, emails checked, phone optional, then confirm.
let f = emptyFiche();
assert.equal(FICHE_ORDER[0], "name");
let r = answer("name", "  Marie   Tremblay ", f);
assert.ok(r.ok && r.next === "company");
if (r.ok) f = r.fiche;
assert.equal(f.name, "Marie Tremblay");
assert.ok(question("company", f, "fr").includes("Marie"));
r = answer("company", "Café Lune", f);
assert.ok(r.ok && r.next === "address");
if (r.ok) f = r.fiche;
r = answer("address", "passer", f);
assert.ok(r.ok && r.fiche.address === "" && r.next === "email", "address is optional");
r = answer("address", "1234, rue Exemple, Montréal", f);
assert.ok(r.ok);
if (r.ok) f = r.fiche;
assert.ok(!answer("email", "pas-un-courriel", f).ok, "bad email asked again");
r = answer("email", "Marie@Exemple.CA", f);
assert.ok(r.ok && r.fiche.email === "marie@exemple.ca");
if (r.ok) f = r.fiche;
assert.ok(!answer("phone", "abc", f).ok);
r = answer("phone", "passer", f);
assert.ok(r.ok && r.next === "confirm" && r.fiche.phone === "");
if (r.ok) f = r.fiche;
const payload = fichePayload(f, { services: ["Site web"], conversation: ["> Je veux un site"], lang: "fr" });
assert.equal(payload.kind, "project_request");
assert.equal(payload.category, "sales-assistant");
assert.ok(payload.title.includes("Site web") && payload.title.length <= 160);
assert.equal(payload.phone, undefined);
assert.ok(payload.message.includes("Adresse: 1234, rue Exemple, Montréal"), "address travels in the message");
assert.ok(!("price" in payload) && !("amount" in payload), "prices are never sent from the browser");

// Hero search: review requests go to the reviews page, maps to local listings.
assert.equal(resolveIntent("Plus d'avis Google pour mon salon").intent, "reviews");
assert.equal(resolveIntent("More Google reviews for my salon").to, "/services/reviews");
assert.equal(resolveIntent("Être trouvé sur Google Maps").intent, "local_visibility");
assert.equal(resolveIntent("Trouver un domaine .ca pour ma boutique").intent, "domain");
assert.equal(resolveIntent("Je veux un site web premium pour mon restaurant").intent, "website");

console.log("concierge tests: OK");
