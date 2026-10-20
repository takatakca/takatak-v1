"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Download, Printer, Save, ScanLine } from "lucide-react";
import { LabelPreview } from "@/components/inventory/label-preview";
import { QuebecReviewEditor } from "@/components/inventory/quebec-review";
import {
  barcodeMatchesScan,
  defaultLabelConfig,
  mielAissaLabelConfig,
  readLabelConfig,
  type LabelConfig,
  type LabelProduct,
} from "@/lib/inventory/label-config";
import {
  buildLabelScene,
  planLabelPages,
  type LabelPaper,
  type LabelScene,
} from "@/lib/inventory/label-layout";
import { labelPdf } from "@/lib/inventory/label-pdf";
import { csvCell } from "@/lib/inventory/barcodes";
const input =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900";
const button =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 disabled:cursor-not-allowed disabled:opacity-50";
const primary = button + " !border-blue-600 !bg-[#1565D8] !text-white";
function aissaPreset(brand: string) {
  return /miel\s*aissa/i.test(brand)
    ? mielAissaLabelConfig()
    : defaultLabelConfig(brand);
}
function download(bytes: Uint8Array | string, type: string, name: string) {
  const url = URL.createObjectURL(
    new Blob([typeof bytes === "string" ? bytes : new Uint8Array(bytes)], {
      type,
    }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
export function LabelStudio({
  canManage,
  initialProductId,
}: {
  canManage: boolean;
  initialProductId: string;
}) {
  const [products, setProducts] = useState<LabelProduct[]>([]),
    [brands, setBrands] = useState<{ id: string; name: string }[]>([]);
  const [id, setId] = useState(""),
    [config, setConfig] = useState<LabelConfig>(defaultLabelConfig());
  const [scene, setScene] = useState<LabelScene | null>(null),
    [layoutError, setLayoutError] = useState(""),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const [paper, setPaper] = useState<LabelPaper>("letter"),
    [copies, setCopies] = useState(1),
    [busy, setBusy] = useState(false),
    [loaded, setLoaded] = useState(false);
  const [scan, setScan] = useState(""),
    [scanResult, setScanResult] = useState("");
  const scanInput = useRef<HTMLInputElement>(null);
  const [labelLoading, setLabelLoading] = useState(false);
  const product = products.find((p) => p.id === id);
  useEffect(() => {
    let active = true;
    fetch("/api/inventory/products", { cache: "no-store" })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.message || "Inventory unavailable");
        return data;
      })
      .then((data) => {
        if (!active) return;
        setProducts(data.products);
        setBrands(data.brands);
        const selected: LabelProduct | undefined =
          data.products.find((p: LabelProduct) => p.id === initialProductId) ??
          data.products[0];
        if (selected) {
          setId(selected.id);
          const brand =
            data.brands.find(
              (b: { id: string }) => b.id === selected.businessBrandId,
            )?.name ?? "";
          setConfig(
            selected.labelConfig
              ? readLabelConfig(selected.labelConfig, brand)
              : aissaPreset(brand),
          );
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [initialProductId]);
  useEffect(() => {
    let active = true;
    setScene(null);
    setLayoutError("");
    if (product)
      buildLabelScene(product, config)
        .then((result) => {
          if (active) setScene(result);
        })
        .catch((e) => {
          if (active) setLayoutError(e.message);
        });
    return () => {
      active = false;
    };
  }, [product, config]);
  useEffect(() => {
    if (!id) return;
    let active = true;
    setLabelLoading(true);
    setError("");
    fetch(`/api/inventory/labels?product=${encodeURIComponent(id)}`, {
      cache: "no-store",
    })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.message || "Label unavailable");
        return data.product as LabelProduct;
      })
      .then((p) => {
        if (!active) return;
        const brand =
          brands.find((b) => b.id === p.businessBrandId)?.name ?? "";
        setConfig(
          p.labelConfig
            ? readLabelConfig(p.labelConfig, brand)
            : aissaPreset(brand),
        );
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLabelLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id, brands]);
  function change<K extends keyof LabelConfig>(key: K, value: LabelConfig[K]) {
    setConfig((c) => ({
      ...c,
      [key]: value,
      ...(key !== "gs1Confirmed" && key !== "textReviewed"
        ? { textReviewed: false }
        : {}),
    }));
    setMessage("");
  }
  function selectProduct(next: string) {
    const p = products.find((p) => p.id === next);
    if (!p) return;
    const brand = brands.find((b) => b.id === p.businessBrandId)?.name ?? "";
    setId(next);
    setConfig(
      p.labelConfig
        ? readLabelConfig(p.labelConfig, brand)
        : aissaPreset(brand),
    );
    setScan("");
    setScanResult("");
    setMessage("");
  }
  async function loadNutrition(file: File | undefined) {
    if (!file) return;
    if (
      !["image/png", "image/jpeg"].includes(file.type) ||
      file.size > 300000
    ) {
      setMessage("Use approved PNG/JPEG nutrition artwork under 300 KB.");
      return;
    }
    try {
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("Image could not be read"));
        reader.readAsDataURL(file);
      });
      const ratio = await new Promise<number>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image.height / image.width);
        image.onerror = () => reject(new Error("Image could not be opened"));
        image.src = data;
      });
      if (ratio < 0.5 || ratio > 4)
        throw new Error(
          "Choose a portrait or square nutrition panel (height/width between 0.5 and 4).",
        );
      setConfig((c) => ({
        ...c,
        nutritionImage: data,
        nutritionRatio: ratio,
        nutritionStatus: "provided",
        textReviewed: false,
      }));
      setMessage(
        "Nutrition artwork loaded. Set the panel’s approved physical width and check the printed type size.",
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Image could not be loaded");
    }
  }
  async function save() {
    if (!product) return;
    setBusy(true);
    setMessage("");
    try {
      const r = await fetch("/api/inventory/labels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: id, config }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.message);
      setProducts((p) =>
        p.map((v) => (v.id === id ? { ...v, labelConfig: { ...config } } : v)),
      );
      setMessage("Layout saved to this product.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not save layout");
    } finally {
      setBusy(false);
    }
  }
  async function exportPdf(print = false) {
    if (!scene || !product) return;
    // Open synchronously to preserve browser popup permission.
    const popup = print ? window.open("", "_blank") : null;
    if (print && !popup) {
      setMessage(
        "Allow pop-ups to open the print PDF, or download it instead.",
      );
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const bytes = await labelPdf(scene, paper, copies);
      if (popup) {
        const url = URL.createObjectURL(
          new Blob([new Uint8Array(bytes)], { type: "application/pdf" }),
        );
        popup.location.href = url;
        setTimeout(() => URL.revokeObjectURL(url), 120000);
        setMessage(
          "PDF opened. Choose Print → Actual size / 100%; disable Fit and printer headers. Use the matching paper size.",
        );
      } else
        download(
          bytes,
          "application/pdf",
          `${product.sku}-${scene.draft ? "draft-" : ""}${config.widthMm}x${config.heightMm}mm-${paper}.pdf`,
        );
    } catch (e) {
      popup?.close();
      setMessage(e instanceof Error ? e.message : "PDF could not be generated");
    } finally {
      setBusy(false);
    }
  }
  function productSheet() {
    if (!product) return;
    const rows = [
      [
        "Brand",
        "Product EN",
        "Product FR",
        "SKU",
        "GTIN EAN13",
        "UPC-A (where applicable)",
        "Package size",
        "Ingredients EN",
        "Ingredients FR",
        "Business/address",
        "Origin",
        "Website",
      ],
      [
        config.brand,
        product.name,
        config.nameFr,
        product.sku,
        product.gtin ?? "",
        product.gtin?.startsWith("0") ? product.gtin.slice(1) : "",
        product.size,
        product.ingredients,
        config.ingredientsFr,
        config.business,
        config.origin,
        /miel\s*aissa/i.test(config.brand) ? "https://mielaissa.ca" : "",
      ],
    ];
    download(
      "\uFEFF" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n"),
      "text/csv;charset=utf-8",
      `${product.sku}-retailer-product-sheet.csv`,
    );
  }
  let printSummary = "";
  let printError = "";
  if (scene)
    try {
      const plan = planLabelPages(scene, paper, copies);
      printSummary = `${plan.width.toFixed(1)} × ${plan.height.toFixed(1)} mm paper · ${plan.perPage} per page · ${plan.pages} page(s)${plan.rotated ? " · artwork rotated for 4-inch feed" : ""}`;
    } catch (e) {
      printError = e instanceof Error ? e.message : "Invalid paper layout";
    }
  const textField = (
    key: keyof Pick<
      LabelConfig,
      | "brand"
      | "nameFr"
      | "ingredientsFr"
      | "business"
      | "origin"
      | "grade"
      | "colour"
      | "storage"
      | "notes"
      | "lot"
      | "bestBefore"
    >,
    label: string,
    rows = 1,
  ) => (
    <label className="block text-sm text-slate-700" key={key}>
      <span>{label}</span>
      {rows > 1 ? (
        <textarea
          className={input}
          value={config[key]}
          rows={rows}
          onChange={(e) => change(key, e.target.value)}
          maxLength={key === "business" ? 400 : 1500}
        />
      ) : (
        <input
          className={input}
          value={config[key]}
          onChange={(e) => change(key, e.target.value)}
          maxLength={160}
        />
      )}
    </label>
  );
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap justify-between gap-3">
        <Link href="/dashboard/inventory" className={button}>
          <ArrowLeft size={16} /> Inventory
        </Link>
        <Link href="/dashboard/inventory/labels/setup" className={button}>
          Retail setup & equipment
        </Link>
        <Link href="/dashboard/inventory/quebec" className={button}>
          Exigences de vente au Québec
        </Link>
      </div>
      {error ? (
        <p role="alert" className="rounded-lg bg-amber-50 p-4 text-amber-900">
          {error}
        </p>
      ) : !loaded ? (
        <p role="status">Loading products…</p>
      ) : !products.length ? (
        <p className="rounded-lg bg-blue-50 p-4">
          Add a product in Inventory, then open its label studio.
        </p>
      ) : null}
      {labelLoading ? <p role="status">Loading saved label…</p> : null}
      {product && !error && !labelLoading ? (
        <>
          <label className="block max-w-xl text-sm font-medium text-slate-700">
            Product
            <select
              aria-label="Label product"
              className={input}
              value={id}
              onChange={(e) => selectProduct(e.target.value)}
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {p.size} · {p.sku}
                </option>
              ))}
            </select>
          </label>
          <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
            <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="font-bold text-slate-900">1. Fit the jar</h2>
              <p className="text-xs leading-5 text-slate-500">
                Measure around the jar and the straight-sided label height.
                Label width is circumference minus a 2 mm gap. The starting 180
                × 65 mm is an example. The blank seam strip is white space on
                the label itself.
              </p>
              <label className="block text-sm text-slate-700">
                Jar shape
                <select
                  aria-label="Jar shape"
                  className={input}
                  value={config.jarShape}
                  onChange={(e) =>
                    change(
                      "jarShape",
                      e.target.value as LabelConfig["jarShape"],
                    )
                  }
                >
                  <option value="round">Round jar</option>
                  <option value="hexagonal">
                    Hexagonal jar — six flat faces
                  </option>
                </select>
              </label>
              {config.jarShape === "hexagonal" ? (
                <div className="space-y-2 rounded-lg bg-blue-50 p-3">
                  <label className="block text-sm text-slate-700">
                    Flat-face width mm
                    <input
                      className={input}
                      type="number"
                      min="0"
                      max="150"
                      step="0.1"
                      placeholder="Measure the flat glass face"
                      value={config.flatFaceWidthMm || ""}
                      onChange={(e) =>
                        change("flatFaceWidthMm", Number(e.target.value))
                      }
                    />
                  </label>
                  <p className="text-xs leading-5 text-blue-900">
                    Measure only the flat glass, excluding rounded corners. When
                    applying the wrap, centre the complete barcode on one flat
                    face and keep it off corners and seams. The studio checks
                    the symbol plus 2 mm application allowance on each side.
                    Paper fitting and a scan on the finished jar are still
                    required. A 288 mL capacity does not establish honey weight
                    or label dimensions.
                  </p>
                  {scene?.flatFaceFit ? (
                    <p
                      className="text-xs font-medium text-blue-900"
                      role="status"
                    >
                      Barcode requires{" "}
                      {scene.flatFaceFit.requiredWidthMm.toFixed(1)} mm;
                      measured flat face:{" "}
                      {scene.flatFaceFit.measuredWidthMm.toFixed(1)} mm. Centre
                      it on that face during application.
                    </p>
                  ) : null}
                </div>
              ) : null}
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    ["widthMm", "Width mm"],
                    ["heightMm", "Height mm"],
                    ["seamMm", "Blank seam mm"],
                  ] as const
                ).map(([k, label]) => (
                  <label className="text-xs text-slate-700" key={k}>
                    {label}
                    <input
                      className={input}
                      type="number"
                      step="0.1"
                      min={k === "seamMm" ? 0 : k === "widthMm" ? 90 : 40}
                      max={k === "seamMm" ? 15 : k === "widthMm" ? 350 : 150}
                      value={config[k]}
                      onChange={(e) => change(k, Number(e.target.value))}
                    />
                  </label>
                ))}
              </div>
              <label className="block text-sm text-slate-700">
                PSE vérifiée (cm²)
                <input
                  aria-label="PSE vérifiée (cm²)"
                  className={input}
                  type="number"
                  min="0"
                  max="10000"
                  step="0.1"
                  value={config.principalDisplayAreaCm2 || ""}
                  onChange={(e) =>
                    change("principalDisplayAreaCm2", Number(e.target.value))
                  }
                />
                <span className="text-xs">
                  Surface principale d’exposition déterminée selon les règles du
                  contenant; elle ne correspond pas automatiquement à toute la
                  surface de l’étiquette. Une valeur inconnue conserve le statut
                  d’épreuve.
                </span>
              </label>
              <label className="block text-sm text-slate-700">
                Printer resolution
                <select
                  aria-label="Printer resolution"
                  className={input}
                  value={config.dpi}
                  onChange={(e) =>
                    change("dpi", Number(e.target.value) as LabelConfig["dpi"])
                  }
                >
                  <option value="203">203 DPI (budget roll)</option>
                  <option value="300">300 DPI</option>
                  <option value="600">600 DPI (sheet laser/inkjet)</option>
                </select>
              </label>
              <label className="block text-sm text-slate-700">
                Barcode orientation
                <select
                  aria-label="Barcode orientation"
                  className={input}
                  value={config.orientation}
                  onChange={(e) =>
                    change(
                      "orientation",
                      e.target.value as LabelConfig["orientation"],
                    )
                  }
                >
                  <option value="ladder">
                    Rotated ladder — narrow or round panels
                  </option>
                  <option value="fence">
                    Horizontal fence — flatter panels
                  </option>
                </select>
              </label>
              <label className="block text-sm text-slate-700">
                Print style
                <select
                  className={input}
                  value={config.theme}
                  onChange={(e) =>
                    change("theme", e.target.value as LabelConfig["theme"])
                  }
                >
                  <option value="mono">Black and white — lowest cost</option>
                  <option value="blue">Blue accent — colour printer</option>
                  <option value="honey">
                    Signature miel — ivoire, noir et or
                  </option>
                </select>
              </label>
              <h2 className="pt-2 font-bold text-slate-900">
                2. Packaging text
              </h2>
              <button
                className={button}
                type="button"
                onClick={() =>
                  setConfig((c) => ({
                    ...c,
                    brand: mielAissaLabelConfig().brand,
                    theme: mielAissaLabelConfig().theme,
                    nameFr: mielAissaLabelConfig().nameFr,
                    business: mielAissaLabelConfig().business,
                    origin: mielAissaLabelConfig().origin,
                    quebec: mielAissaLabelConfig().quebec,
                    textReviewed: false,
                  }))
                }
              >
                Use MIEL AISSA business details
              </button>
              {textField("brand", "Honey-shop brand")}
              {textField("nameFr", "French product name")}
              {textField(
                "ingredientsFr",
                "French ingredients (if applicable)",
                2,
              )}
              {textField(
                "business",
                "Legal business name, address & website",
                4,
              )}
              {textField("origin", "Origin statement — verify wording")}
              {textField("grade", "Grade name (only if applicable)")}
              {textField("colour", "Honey colour class (if applicable)")}
              {textField("storage", "Storage instructions / conservation", 2)}
              {textField("notes", "Additional approved text", 2)}
              <h2 className="pt-2 font-bold text-slate-900">Nutrition panel</h2>
              <label className="block text-sm text-slate-700">
                Nutrition label review
                <select
                  className={input}
                  value={config.nutritionStatus}
                  onChange={(e) =>
                    change(
                      "nutritionStatus",
                      e.target.value as LabelConfig["nutritionStatus"],
                    )
                  }
                >
                  <option value="unreviewed">Not reviewed yet — draft</option>
                  <option value="provided">Include approved artwork</option>
                  <option value="exempt">Reviewed exemption applies</option>
                </select>
              </label>
              {config.nutritionStatus === "provided" ? (
                <label className="block text-sm text-slate-700">
                  Approved bilingual panel (PNG/JPEG, max 300 KB)
                  <input
                    className={input}
                    type="file"
                    accept="image/png,image/jpeg"
                    onChange={(e) => void loadNutrition(e.target.files?.[0])}
                  />
                  {config.nutritionImage ? (
                    <button
                      type="button"
                      className={button + " mt-2"}
                      onClick={() => {
                        setConfig((c) => ({
                          ...c,
                          nutritionImage: "",
                          nutritionStatus: "unreviewed",
                          textReviewed: false,
                        }));
                      }}
                    >
                      Remove artwork
                    </button>
                  ) : null}
                </label>
              ) : null}
              {config.nutritionStatus === "provided" ? (
                <label className="block text-sm text-slate-700">
                  Approved panel width (mm)
                  <input
                    className={input}
                    type="number"
                    min="25"
                    max="100"
                    step="0.1"
                    value={config.nutritionWidthMm}
                    onChange={(e) =>
                      change("nutritionWidthMm", Number(e.target.value))
                    }
                  />
                </label>
              ) : null}
              {config.nutritionStatus === "exempt" ? (
                <label className="block text-sm text-slate-700">
                  Reviewed exemption and basis
                  <textarea
                    className={input}
                    maxLength={400}
                    value={config.nutritionExemption}
                    onChange={(e) =>
                      change("nutritionExemption", e.target.value)
                    }
                  />
                </label>
              ) : null}
              <p className="text-xs leading-5 text-slate-500">
                The app does not invent nutrition values or determine legal
                exemptions. Supply reviewed artwork or record the exemption that
                applies to this product and sales channel.
              </p>
              <h2 className="pt-2 font-bold text-slate-900">
                3. This print batch
              </h2>
              {textField("lot", "Lot / batch reference")}
              {textField("bestBefore", "Best-before text (if applicable)")}
              <button
                className={primary}
                disabled={!canManage || busy || !!layoutError}
                onClick={() => void save()}
              >
                <Save size={16} /> Save product layout
              </button>
              {!canManage ? (
                <p className="text-xs text-slate-500">
                  You can make a local print preview. Saving requires inventory
                  management permission.
                </p>
              ) : null}
            </section>
            <div className="min-w-0 space-y-5">
              <section className="rounded-xl bg-[#060D1F] p-5">
                <div className="mb-4 flex flex-wrap justify-between gap-2 text-sm text-white">
                  <h2 className="font-bold">Full wrap preview</h2>
                  <span>
                    {config.widthMm} × {config.heightMm} mm
                  </span>
                </div>
                {layoutError ? (
                  <p
                    role="alert"
                    className="rounded-lg bg-white p-4 text-sm text-red-800"
                  >
                    {layoutError}
                  </p>
                ) : scene ? (
                  <div className="overflow-x-auto rounded-md">
                    <LabelPreview scene={scene} />
                  </div>
                ) : (
                  <p className="text-sm text-white">Preparing artwork…</p>
                )}
                <p className="mt-3 text-xs leading-5 text-slate-300">
                  Grey strip shows the blank seam area. It prints white. Barcode
                  bars and white space keep their size; long text must fit
                  before export.
                </p>
              </section>
              <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-5">
                <h2 className="font-bold">4. Retail label checklist</h2>
                <p className="text-sm text-slate-600">
                  {product.gtin
                    ? `Retail number: ${product.gtin.startsWith("0") ? product.gtin.slice(1) : product.gtin}`
                    : "No retail number yet. This proof uses an internal Code 39 SKU."}{" "}
                  <Link
                    className="text-blue-700 underline"
                    href="/dashboard/inventory"
                  >
                    Edit product barcode
                  </Link>
                </p>
                <label className="flex gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={config.gs1Confirmed}
                    onChange={(e) => change("gs1Confirmed", e.target.checked)}
                  />{" "}
                  This GS1 number is assigned to this product and business.
                </label>
                <label className="flex gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={config.textReviewed}
                    onChange={(e) => change("textReviewed", e.target.checked)}
                  />{" "}
                  I reviewed the packaging text, including required
                  nutrition/grade/colour/origin information and languages.
                </label>
                {scene?.issues.length ? (
                  <ul className="list-disc space-y-1 pl-5 text-xs text-amber-800">
                    {scene.issues.map((issue) => (
                      <li key={issue}>{issue}</li>
                    ))}
                  </ul>
                ) : scene ? (
                  <p className="text-xs text-blue-800">
                    Owner checklist complete. This is not retailer approval or
                    barcode quality certification.
                  </p>
                ) : (
                  <p className="text-xs text-amber-800">
                    Resolve the label fit before reviewing the packaging
                    checklist.
                  </p>
                )}
                <p className="text-xs leading-5 text-slate-500">
                  Unfinished proofs print a DRAFT banner. This editor can embed
                  your approved nutrition artwork. It does not calculate
                  nutrition values, assess exemptions, or replace a mandatory
                  panel with free text.
                </p>
              </section>
              <QuebecReviewEditor
                value={config.quebec}
                onChange={(next) => change("quebec", next)}
              />
              <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
                <h2 className="font-bold">5. Print your labels</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-sm">
                    Paper / output
                    <select
                      className={input}
                      aria-label="Paper / output"
                      value={paper}
                      onChange={(e) => setPaper(e.target.value as LabelPaper)}
                    >
                      <option value="letter">
                        Letter adhesive sheet (8.5 × 11 in)
                      </option>
                      <option value="a4">A4 adhesive sheet</option>
                      <option value="roll">
                        Custom roll — up to 104 mm print width
                      </option>
                    </select>
                  </label>
                  <label className="text-sm">
                    Number of labels
                    <input
                      className={input}
                      type="number"
                      min="1"
                      max="100"
                      step="1"
                      value={copies}
                      onChange={(e) => setCopies(Number(e.target.value))}
                    />
                  </label>
                </div>
                <p
                  className={`text-xs ${printError ? "text-red-700" : "text-slate-500"}`}
                  role={printError ? "alert" : undefined}
                >
                  {printError || printSummary}
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    className={primary}
                    disabled={!scene || !!printError || busy}
                    onClick={() => void exportPdf()}
                  >
                    <Download size={16} /> Download PDF
                  </button>
                  <button
                    className={button}
                    disabled={!scene || !!printError || busy}
                    onClick={() => void exportPdf(true)}
                  >
                    <Printer size={16} /> Open print PDF
                  </button>
                  <button className={button} onClick={productSheet}>
                    Retailer product CSV
                  </button>
                </div>
                <p className="text-xs leading-5 text-slate-500">
                  Print at 100% / Actual size. Disable Fit to page. Use
                  full-sheet adhesive stock and trim at the crop marks, or use a
                  matching custom roll size. A printer does not apply the label
                  to the jar. Wrap it smoothly, keep the barcode off the seam,
                  and on hexagonal jars keep it entirely on one flat face, then
                  scan it.
                </p>
              </section>
              <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-5">
                <h2 className="flex items-center gap-2 font-bold">
                  <ScanLine size={18} /> 6. Test the printed barcode
                </h2>
                <p className="text-xs leading-5 text-slate-500">
                  Plug in a USB keyboard scanner, click below and scan the
                  label. This checks the decoded product number, not print
                  quality or retailer listing.
                </p>
                <form
                  className="flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    setScanResult(
                      barcodeMatchesScan(product, scan)
                        ? "MATCH — scanner input identifies this product."
                        : "NO MATCH — check the scanned label and scanner UPC/EAN settings.",
                    );
                  }}
                >
                  <input
                    ref={scanInput}
                    aria-label="Scan printed label"
                    className={input}
                    placeholder="Click here, then scan…"
                    value={scan}
                    onChange={(e) => setScan(e.target.value)}
                    autoComplete="off"
                  />
                  <button className={button} type="submit">
                    Check
                  </button>
                </form>
                {scanResult ? (
                  <p
                    role="status"
                    className={`text-sm font-medium ${scanResult.startsWith("MATCH") ? "text-green-700" : "text-red-700"}`}
                  >
                    {scanResult}
                  </p>
                ) : null}
              </section>
              {message ? (
                <p
                  role="status"
                  className="rounded-lg bg-blue-50 p-4 text-sm text-blue-900"
                >
                  {message}
                </p>
              ) : null}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
