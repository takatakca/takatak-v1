import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { localizeLoginEmailError, loginCopy, loginPath } from "../src/lib/auth/login-copy.ts";
import { requestPresentationLanguage } from "../src/lib/website/home-seo.ts";

assert.equal(requestPresentationLanguage("/", "fr"), "fr");
assert.equal(requestPresentationLanguage("/", null), "en");
assert.equal(requestPresentationLanguage("/login", "fr"), "fr");
assert.equal(requestPresentationLanguage("/login", "en"), "en");
assert.equal(requestPresentationLanguage("/login", null), null);
assert.equal(requestPresentationLanguage("/login", "es"), null);

const fr = loginCopy("fr");
const en = loginCopy("en");
assert.equal(en.title, "Welcome back");
assert.equal(fr.title, "Bon retour");
assert.equal(fr.title.includes("Welcome back"), false);
assert.equal(fr.metaTitle, "Connexion");
assert.equal(en.metaTitle, "Sign in");
assert.equal(fr.email, "Courriel");
assert.equal(fr.createAccount, "Créer un compte");
assert.equal(localizeLoginEmailError("Email is required.", "fr"), "Le courriel est obligatoire.");
assert.equal(localizeLoginEmailError("Email address is too long.", "fr"), "L'adresse courriel est trop longue.");
assert.equal(localizeLoginEmailError("Enter a valid email address.", "fr"), "Entrez une adresse courriel valide.");
assert.equal(localizeLoginEmailError("Email is required.", "en"), "Email is required.");
assert.equal(localizeLoginEmailError("Unmapped server message.", "fr"), "Unmapped server message.");
assert.equal(loginPath("/register", "fr"), "/register?lang=fr");
assert.equal(loginPath("/otp", "en"), "/otp");

const page = readFileSync("src/app/(website)/login/page.tsx", "utf8");
const panel = readFileSync("src/components/auth/login-panel.tsx", "utf8");
const form = readFileSync("src/components/auth/master-phone-login-form.tsx", "utf8");
const proxy = readFileSync("src/proxy.ts", "utf8");
for (const source of [page, panel, form]) {
  assert.equal(source.includes(">Welcome back<"), false);
  assert.equal(source.includes("New to TAKATAK?"), false);
}
assert.match(panel, /loginCopy\(lang\)/);
assert.match(form, /loginCopy\(lang\)/);
assert.match(proxy, /requestPresentationLanguage\(/);
assert.equal(proxy.includes('pathname === "/"'), false);

console.log("PASS login language FR and EN");
