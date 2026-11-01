import assert from "node:assert/strict";

import { normalize, respond, suggest, understand } from "../src/lib/website/concierge";

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

console.log("concierge tests: OK");
