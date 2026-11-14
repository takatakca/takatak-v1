import {
  mielAissaLabelConfig,
  readLabelConfig,
  barcodeMatchesScan,
  type LabelConfig,
  type LabelProduct,
} from "./src/label-config";
import {
  buildLabelScene,
  type LabelScene,
  type LabelPaper,
} from "./src/label-layout";
import { labelPdf } from "./src/label-pdf";
import { quebecRequirements } from "./src/quebec-requirements";
const $ = (id: string) => document.getElementById(id) as HTMLInputElement;
type SavedLabel = {
  id: string;
  version: number;
  title: string;
  payload: { product: LabelProduct; config: LabelConfig };
};
const errorMessage = (e: unknown) =>
  e instanceof Error ? e.message : "Action impossible. Réessayez.";
let config = mielAissaLabelConfig(),
  scene: LabelScene | null = null,
  revision = 0,
  current: { id: string; version: number } | null = null,
  records: SavedLabel[] = [];
config.heightMm = 80;
config.origin = "";
const fields = [
  "brand",
  "nameFr",
  "ingredientsFr",
  "business",
  "origin",
  "lot",
  "bestBefore",
  "widthMm",
  "heightMm",
  "jarShape",
  "flatFaceWidthMm",
  "principalDisplayAreaCm2",
  "dpi",
  "orientation",
  "theme",
  "gs1Confirmed",
  "textReviewed",
  "grade",
  "colour",
  "storage",
  "nutritionStatus",
  "nutritionWidthMm",
  "nutritionExemption",
];
const numeric = new Set([
  "widthMm",
  "heightMm",
  "flatFaceWidthMm",
  "principalDisplayAreaCm2",
  "dpi",
  "nutritionWidthMm",
]);
const escape = (v: unknown) =>
  String(v).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
function product() {
  return {
    id: "label",
    businessBrandId: "label",
    name: $("nameFr").value,
    category: "Honey",
    sku: $("sku").value.trim().toUpperCase(),
    size: $("size").value.trim() || "Poids à confirmer",
    ingredients: $("ingredientsFr").value,
    gtin: $("gtin").value.trim() || null,
  };
}
function renderReviews() {
  const host = $("quebec");
  host.innerHTML = "";
  for (const r of quebecRequirements) {
    const box = document.createElement("div");
    box.innerHTML = `<label>${escape(r.title)}<select id="review-${r.key}"><option value="pending">À vérifier</option><option value="recorded">Vérifié — pièce référencée</option>${r.allowNotApplicable ? '<option value="not_applicable">Non applicable — justification</option>' : ""}</select></label><label>Référence du document<input id="ref-${r.key}" maxlength="600"></label>`;
    host.append(box);
    $(`review-${r.key}`).value = config.quebec.items[r.key].status;
    $(`ref-${r.key}`).value = config.quebec.items[r.key].reference;
  }
}
function formToConfig() {
  for (const f of fields) {
    const el = $(f);
    (config as unknown as Record<string, unknown>)[f] =
      el.type === "checkbox"
        ? el.checked
        : numeric.has(f)
          ? Number(el.value)
          : el.value;
  }
  for (const r of quebecRequirements) {
    config.quebec.items[r.key] = {
      status: $(`review-${r.key}`).value as
        "pending" | "recorded" | "not_applicable",
      reference: $(`ref-${r.key}`).value,
    };
  }
}
function configToForm() {
  for (const f of fields) {
    const el = $(f);
    if (el.type === "checkbox")
      el.checked = !!(config as unknown as Record<string, unknown>)[f];
    else
      el.value = String(
        (config as unknown as Record<string, unknown>)[f] ?? "",
      );
  }
  renderReviews();
}
function paint(s: LabelScene) {
  const elements = s.elements.map((e) => {
    if (e.kind === "rect")
      return `<rect x="${e.x}" y="${e.y}" width="${e.width}" height="${e.height}" fill="${e.colour}"/>`;
    if (e.kind === "text")
      return `<text x="${e.x}" y="${e.y}" font-size="${e.size}" font-family="Arial,Helvetica,sans-serif" font-weight="${e.bold ? 700 : 400}" fill="${e.colour}">${escape(e.text)}</text>`;
    if (e.kind === "image")
      return `<image x="${e.x}" y="${e.y}" width="${e.width}" height="${e.height}" href="${escape(e.data)}"/>`;
    return `<g transform="${e.rotated ? `translate(${e.x + e.height} ${e.y}) rotate(90)` : `translate(${e.x} ${e.y})`}">${e.bars.map((b) => `<rect x="${b.x}" y="0" width="${b.width}" height="${b.height}" fill="#111"/>`).join("")}<text x="${e.width / 2}" y="${e.barHeight + 4}" text-anchor="middle" font-family="Arial" font-size="3.2">${escape(e.text)}</text></g>`;
  });
  $("preview").innerHTML =
    `<svg role="img" aria-label="Aperçu de l’étiquette" viewBox="0 0 ${s.width} ${s.height}" xmlns="http://www.w3.org/2000/svg">${elements.join("")}</svg>`;
}
async function preview() {
  const n = ++revision;
  try {
    formToConfig();
    const s = await buildLabelScene(product(), config);
    if (n !== revision) return;
    scene = s;
    paint(s);
    $("pdf").disabled = false;
    $("readiness").textContent = s.draft
      ? `ÉPREUVE — ${s.issues.length} vérifications à compléter.\nLe PDF d’essai reste disponible; consultez les mentions alimentaires avant la vente.`
      : "Vérifications déclarées complètes. Vérifiez l’épreuve imprimée et la lecture réelle avant la production.";
  } catch (e: unknown) {
    if (n !== revision) return;
    scene = null;
    $("pdf").disabled = true;
    $("readiness").textContent =
      errorMessage(e) || "Vérifiez les dimensions et le code-barres.";
  }
}
async function api<T = { ok: boolean }>(path: string, body?: unknown) {
  const res = await fetch(
    "/api/" + path,
    body === undefined
      ? {}
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
  );
  const data: unknown = await res.json();
  if (!res.ok)
    throw new Error(
      typeof data === "object" && data !== null && "error" in data
        ? String(data.error)
        : "Action impossible",
    );
  return data as T;
}
async function load() {
  records = (await api<{ labels: SavedLabel[] }>("labels")).labels;
  const select = $("saved");
  select.innerHTML = '<option value="">Mes étiquettes sauvegardées</option>';
  for (const r of records) {
    const opt = document.createElement("option");
    opt.value = r.id;
    opt.textContent = r.title;
    select.append(opt);
  }
  if (current) select.value = current.id;
}
async function show() {
  $("login").hidden = true;
  $("app").hidden = false;
  $("logout").hidden = false;
  await load();
  await preview();
}
$("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.currentTarget as HTMLFormElement;
  const btn = form.querySelector("button")!;
  btn.disabled = true;
  try {
    await api("login", Object.fromEntries(new FormData(form)));
    form.reset();
    await show();
  } catch (err: unknown) {
    $("login-error").textContent = errorMessage(err);
  } finally {
    btn.disabled = false;
  }
});
$("logout").onclick = async () => {
  try {
    await api("logout", {});
    location.reload();
  } catch (e: unknown) {
    $("messages").textContent = errorMessage(e);
  }
};
$("editor").addEventListener("input", (event) => {
  const target = event.target as HTMLInputElement;
  if (
    [
      "brand",
      "nameFr",
      "ingredientsFr",
      "business",
      "origin",
      "size",
      "sku",
      "gtin",
      "lot",
      "widthMm",
      "heightMm",
      "jarShape",
      "flatFaceWidthMm",
      "principalDisplayAreaCm2",
      "grade",
      "colour",
      "storage",
    ].includes(target.id)
  ) {
    config.gs1Confirmed = false;
    config.textReviewed = false;
    $("gs1Confirmed").checked = false;
    $("textReviewed").checked = false;
    for (const r of quebecRequirements)
      config.quebec.items[r.key].status = "pending";
    renderReviews();
  }
  $("messages").textContent = "";
  void preview();
});
$("editor").addEventListener("submit", (e) => e.preventDefault());
$("save").onclick = async () => {
  const btn = $("save");
  btn.disabled = true;
  try {
    formToConfig();
    const p = product();
    if (!$("size").value.trim())
      throw new Error("Indiquez le poids net à sauvegarder.");
    if (!p.name.trim() || !p.sku) throw new Error("Nom et SKU requis.");
    const result = await api<{ id: string; version: number }>("labels", {
      id: current?.id,
      version: current?.version,
      title: `${config.brand} — ${p.name} — ${p.size}`,
      payload: { product: p, config },
    });
    current = result;
    await load();
    $("messages").textContent = "Étiquette sauvegardée en ligne.";
  } catch (e: unknown) {
    $("messages").textContent = errorMessage(e);
  } finally {
    btn.disabled = false;
  }
};
$("saved").onchange = () => {
  const r = records.find((x) => x.id === $("saved").value);
  if (!r) return;
  current = r;
  config = readLabelConfig(r.payload.config, "MIEL AISSA");
  configToForm();
  for (const f of ["sku", "size", "gtin"] as const)
    $(f).value = r.payload.product[f] || "";
  void preview();
};
$("new").onclick = () => {
  current = null;
  config = mielAissaLabelConfig();
  config.origin = "";
  config.heightMm = 80;
  configToForm();
  $("size").value = "";
  $("gtin").value = "";
  $("sku").value = "AISSA";
  $("saved").value = "";
  $("messages").textContent = "";
  void preview();
};
$("pdf").onclick = async () => {
  try {
    await preview();
    if (!scene) throw new Error("Corrigez la mise en page.");
    const bytes = await labelPdf(
      scene,
      $("paper").value as LabelPaper,
      1,
    );
    const url = URL.createObjectURL(
      new Blob([new Uint8Array(bytes)], { type: "application/pdf" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `MIEL-AISSA-${scene.draft ? "epreuve" : "etiquette"}-${scene.width}x${scene.height}mm.pdf`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
    $("messages").textContent = "PDF créé. Imprimez à taille réelle (100 %).";
  } catch (e: unknown) {
    $("messages").textContent = errorMessage(e);
  }
};
$("scan").oninput = () => {
  $("scan-result").textContent = barcodeMatchesScan(product(), $("scan").value)
    ? "Lecture correspondante au produit."
    : "En attente d’un code correspondant.";
};
$("nutrition-file").onchange = async () => {
  try {
    const file = $("nutrition-file").files?.[0];
    if (!file) return;
    if (!["image/png", "image/jpeg"].includes(file.type) || file.size > 300000)
      throw new Error("Image PNG/JPEG de 300 Ko maximum.");
    const data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    const image = new Image();
    image.src = data;
    await image.decode();
    config.nutritionImage = data;
    config.nutritionRatio = image.width / image.height;
    await preview();
  } catch (e: unknown) {
    $("messages").textContent = errorMessage(e);
  }
};
configToForm();
void api<{ signedIn: boolean }>("session")
  .then((s) => (s.signedIn ? show() : null))
  .catch((e) => {
    $("login-error").textContent = errorMessage(e);
  });
