// SmartLinks (Social): rules for addresses, button links and publishing, plus
// source checks: permissions on every API route, workspace + brand scoping, no
// open redirect, server-only tables, and a migration kept off the production list.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { DashboardLanguageProvider } from "../src/components/layout/dashboard-language";
import { SmartLinksManager } from "../src/components/social/smartlinks/smartlinks-manager";

import {
  SMARTLINK_LIMITS,
  canPublishSmartLink,
  normalizeSmartLinkSlug,
  normalizeSmartLinkUrl,
  smartLinkStatKey,
  validateSmartLinkInput,
} from "../src/lib/social/smartlinks/policy";

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`ok ${name}`);
}

const read = (path: string) => readFileSync(path, "utf8");

check("addresses are lower-case letters, digits and dashes, 3 to 40 characters", () => {
  assert.equal(normalizeSmartLinkSlug("Café Verdun"), "cafe-verdun");
  assert.equal(normalizeSmartLinkSlug("  --Pizza__Mtl--  "), "pizza-mtl");
  assert.equal(normalizeSmartLinkSlug("ab"), null);
  assert.equal(normalizeSmartLinkSlug("x".repeat(41)), null);
  assert.equal(normalizeSmartLinkSlug(42), null);
  for (const reserved of ["admin", "api", "dashboard", "login", "takatak"]) assert.equal(normalizeSmartLinkSlug(reserved), null, reserved);
});

check("button links are absolute http(s) only: never javascript:, data: or credentials", () => {
  assert.equal(normalizeSmartLinkUrl("https://example.com/menu"), "https://example.com/menu");
  assert.equal(normalizeSmartLinkUrl(" http://example.ca "), "http://example.ca/");
  for (const bad of [
    "javascript:alert(1)",
    "data:text/html,hi",
    "ftp://example.com",
    "https://user:pass@example.com",
    "/relative/path",
    "https://localhost",
    "",
    `https://example.com/${"a".repeat(SMARTLINK_LIMITS.url)}`,
  ]) {
    assert.equal(normalizeSmartLinkUrl(bad), null, bad);
  }
});

check("a page needs an address and a title; every button needs a label and a valid link", () => {
  const good = validateSmartLinkInput({
    slug: "Ma Marque",
    title: "  Ma   marque ",
    bio: "Bonjour",
    buttons: [{ label: "Menu", url: "https://example.com/menu" }, { id: "11111111-2222-3333-4444-555555555555", label: "Réserver", url: "https://example.com/r" }],
  });
  assert.ok(good.ok);
  if (good.ok) {
    assert.equal(good.value.slug, "ma-marque");
    assert.equal(good.value.title, "Ma marque");
    assert.equal(good.value.buttons[0].id, null);
    assert.equal(good.value.buttons[1].id, "11111111-2222-3333-4444-555555555555");
  }
  const noTitle = validateSmartLinkInput({ slug: "ma-marque", title: " ", buttons: [] });
  assert.ok(!noTitle.ok && noTitle.field === "title" && noTitle.messageFr.length > 0);
  const badLink = validateSmartLinkInput({ slug: "ma-marque", title: "T", buttons: [{ label: "X", url: "javascript:alert(1)" }] });
  assert.ok(!badLink.ok && badLink.field === "buttons");
  const forgedId = validateSmartLinkInput({ slug: "ma-marque", title: "T", buttons: [{ id: "../../x", label: "X", url: "https://e.com" }] });
  assert.ok(forgedId.ok && forgedId.value.buttons[0].id === null);
  const tooMany = validateSmartLinkInput({
    slug: "ma-marque",
    title: "T",
    buttons: Array.from({ length: SMARTLINK_LIMITS.buttons + 1 }, () => ({ label: "X", url: "https://e.com" })),
  });
  assert.ok(!tooMany.ok && tooMany.field === "buttons");
});

check("a page is published only with at least one button; counters have stable keys", () => {
  assert.equal(canPublishSmartLink(0), false);
  assert.equal(canPublishSmartLink(1), true);
  assert.equal(smartLinkStatKey(null), "page");
  assert.equal(smartLinkStatKey("abc"), "button:abc");
});

check("API routes check permissions, the request origin and scope every row to the workspace and brand", () => {
  const list = read("src/app/api/social/smartlinks/route.ts");
  const item = read("src/app/api/social/smartlinks/[id]/route.ts");
  assert.match(list, /requireWorkspaceApiPermission\("view_social"\)/);
  assert.match(list, /requireWorkspaceApiPermission\("manage_social_accounts"\)/);
  assert.match(list, /hasValidWriteOrigin\(request\)/);
  assert.match(item, /requireWorkspaceApiPermission\("manage_social_accounts"\)/);
  assert.match(item, /hasValidWriteOrigin\(request\)/);
  const store = read("src/lib/social/smartlinks/store.ts");
  assert.match(store, /^import "server-only";/);
  assert.match(store, /where: \{ id, clientId, businessBrandId \}/, "edits and deletes are scoped to the workspace and brand");
  assert.match(store, /where: \{ clientId: input\.clientId, businessBrandId: input\.businessBrandId \}/);
  assert.match(store, /where: \{ slug, status: "published" \}/, "the public page shows published pages only");
});

check("the public click link follows only the page's own saved buttons, checked again", () => {
  const go = read("src/app/l/[slug]/go/[button]/route.ts");
  assert.match(go, /getSmartLinkButtonTarget\(slug, button\)/);
  assert.match(go, /normalizeSmartLinkUrl\(target\.url\)/);
  assert.match(go, /originFromRequest\(request\)/, "the fallback redirect is built on the public origin");
  assert.doesNotMatch(go, /searchParams\.get\(/, "no target taken from the address");
  const store = read("src/lib/social/smartlinks/store.ts");
  assert.match(store, /where: \{ id: buttonId, smartLink: \{ slug, status: "published" \} \}/);
  assert.doesNotMatch(store, /x-forwarded-for|remoteAddress|userAgent/i, "no visitor identifier is stored");
});

check("the migration keeps the tables server-only and stays off the production deploy list", () => {
  const sql = read("prisma/migrations/20261127070000_social_smartlinks/migration.sql");
  for (const table of ["social_smartlinks", "social_smartlink_buttons", "social_smartlink_daily_stats"]) {
    assert.match(sql, new RegExp(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY;`), table);
    assert.match(sql, new RegExp(`REVOKE ALL ON TABLE "${table}" FROM anon;`), table);
    assert.match(sql, new RegExp(`REVOKE ALL ON TABLE "${table}" FROM authenticated;`), table);
  }
  assert.doesNotMatch(read("scripts/reconcile-production-migrations.mjs"), /social_smartlinks/);
  const store = read("src/lib/social/smartlinks/store.ts");
  assert.match(store, /P2021/, "a missing table reads as 'not activated', not a crash");
});

check("the Social menu opens SmartLinks", () => {
  const shell = read("src/components/social/navigation/social-workspace-shell.tsx");
  assert.match(shell, /label: 'SmartLinks',\n {4}href: '\/dashboard\/social\/smartlinks',\n {4}icon: Link2,\n {4}enabled: true,/);
});

check("the editor says plainly when SmartLinks is not activated, in French first", () => {
  const props = { activated: false, hasBrand: true, brandName: "Café Test", canManage: true, origin: "https://takatak.ca", initialLinks: [] };
  const fr = renderToStaticMarkup(createElement(DashboardLanguageProvider, { language: "fr", children: createElement(SmartLinksManager, props) }));
  assert.match(fr, /SmartLinks n’est pas encore activé/);
  assert.doesNotMatch(fr, /Nouvelle page de liens/, "no create button before activation");
  const en = renderToStaticMarkup(createElement(DashboardLanguageProvider, { language: "en", children: createElement(SmartLinksManager, props) }));
  assert.match(en, /SmartLinks is not activated yet/);
});

check("the editor lists pages with their address, status and 30-day numbers", () => {
  const props = {
    activated: true,
    hasBrand: true,
    brandName: "Café Test",
    canManage: true,
    origin: "https://takatak.ca/",
    initialLinks: [
      {
        id: "11111111-2222-3333-4444-555555555555",
        slug: "cafe-test",
        title: "Café Test",
        bio: "",
        status: "published" as const,
        publishedAt: "2026-11-27T00:00:00.000Z",
        updatedAt: "2026-11-27T00:00:00.000Z",
        views30d: 42,
        clicks30d: 7,
        buttons: [{ id: "aaaaaaaa-2222-3333-4444-555555555555", label: "Menu", url: "https://example.com/menu", clicks30d: 7 }],
      },
    ],
  };
  const fr = renderToStaticMarkup(createElement(DashboardLanguageProvider, { language: "fr", children: createElement(SmartLinksManager, props) }));
  assert.match(fr, /https:\/\/takatak\.ca\/l\/cafe-test/);
  assert.match(fr, /Publiée/);
  assert.match(fr, />42</);
  assert.match(fr, /Retirer de la publication/);
  assert.match(fr, /Nouvelle page de liens/);
  const viewer = renderToStaticMarkup(
    createElement(DashboardLanguageProvider, { language: "fr", children: createElement(SmartLinksManager, { ...props, canManage: false }) }),
  );
  assert.doesNotMatch(viewer, /Supprimer|Modifier|Nouvelle page de liens/, "people who can only view see no edit buttons");
});

console.log(`\n${passed} SmartLinks checks passed`);
