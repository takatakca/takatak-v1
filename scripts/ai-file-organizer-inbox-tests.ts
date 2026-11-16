import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { OrganizerFilingInbox } from "../src/components/studio/organizer-filing-inbox";

const a="11111111-1111-4111-8111-111111111111";
const b="22222222-2222-4222-8222-222222222222";
const other="33333333-3333-4333-8333-333333333333";
const props={
  projects:[{id:a,title:"Projet autorisé"},{id:other,title:"Projet non autorisé"}],
  outputs:[{id:b,title:"Brouillon de test"}],
  allowedDestinationIds:[a],
  canPropose:true,
};
const fr=renderToStaticMarkup(React.createElement(OrganizerFilingInbox,{
  ...props,language:"fr",
}));
assert.match(fr,/Propositions de classement/);
assert.match(fr,/Proposer un classement/);
assert.match(fr,/Brouillon de test/);
assert.match(fr,/Projet autorisé/);
assert.doesNotMatch(fr,/Projet non autorisé/);
assert.match(fr,/aucun fichier n’est déplacé/);
const en=renderToStaticMarkup(React.createElement(OrganizerFilingInbox,{
  ...props,language:"en",
}));
assert.match(en,/Filing proposals/);
assert.match(en,/Propose filing/);
assert.match(en,/metadata changes/);
const off=renderToStaticMarkup(React.createElement(OrganizerFilingInbox,{
  ...props,language:"en",canPropose:false,
}));
assert.match(off,/Enable and save a consented policy/);
assert.match(off,/<button[^>]+disabled/);
assert.doesNotMatch(off,/value="33333333-3333-4333-8333-333333333333"/);
console.log("AI organizer bilingual filing inbox SSR and tenant-filtered destinations: 12 assertions passed");
