"use client";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  Barcode,
  Download,
  Package,
  Plus,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { code39, csvCell, ean13 } from "@/lib/inventory/barcodes";

type Product = {
  id: string;
  businessBrandId: string;
  name: string;
  sku: string;
  category: string;
  size: string;
  ingredients: string;
  gtin: string | null;
  priceCents: number;
  quantity: number;
  threshold: number;
};
type Movement = {
  id: string;
  productId: string;
  delta: number;
  reason: string;
  lot: string | null;
  createdAt: string;
  product: { name: string; sku: string };
};
type Directory = {
  brands: { id: string; name: string }[];
  products: Product[];
  movements: Movement[];
};
const money = (value: number) =>
  new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(
    value / 100,
  );
const button =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed";
const primary =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-[#1565D8] px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed";
const input =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900";
async function request(path: string, method = "GET", body?: unknown) {
  const response = await fetch(`/api/inventory/${path}`, {
    method,
    cache: "no-store",
    ...(body
      ? {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : {}),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "The request failed.");
  return data;
}
function printLabel(product: Product) {
  const popup = window.open("", "_blank", "width=700,height=550");
  if (!popup) return false;
  const doc = popup.document;
  doc.title = `${product.sku} label`;
  const style = doc.createElement("style");
  style.textContent =
    "body{font:14px Arial;color:#000;background:#fff}article{margin:20px auto;width:100mm;text-align:center;padding:5mm;box-sizing:border-box}svg{display:block;margin:auto;max-width:100%;height:auto}p{font-size:11px} @media print{button{display:none}article{margin:0}}";
  doc.head.append(style);
  const button = doc.createElement("button");
  button.textContent = "Print label";
  button.onclick = () => popup.print();
  doc.body.append(button);
  const article = doc.createElement("article");
  doc.body.append(article);
  const title = doc.createElement("h3");
  title.textContent = `${product.name} · ${product.size}`;
  article.append(title);
  const code = product.gtin ? ean13(product.gtin) : code39(product.sku);
  const ns = "http://www.w3.org/2000/svg";
  const svg = doc.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", `0 0 ${code.width} 80`);
  // EAN at nominal 0.33mm per module. Code39 at 0.25mm narrow element.
  svg.setAttribute("width", `${code.width * (product.gtin ? 0.33 : 0.25)}mm`);
  for (const bar of code.bars) {
    const rect = doc.createElementNS(ns, "rect");
    rect.setAttribute("x", String(bar.x));
    rect.setAttribute("y", "0");
    rect.setAttribute("width", String(bar.width));
    rect.setAttribute("height", "70");
    svg.append(rect);
  }
  article.style.width = `${Math.max(100, code.width * (product.gtin ? 0.33 : 0.25) + 10)}mm`;
  article.append(svg);
  const text = doc.createElement("div");
  text.textContent = code.text;
  article.append(text);
  const note = doc.createElement("p");
  note.textContent = product.gtin
    ? "UPC / EAN · GS1 ownership and retailer approval must be verified"
    : "Code 39 · Internal inventory label";
  article.append(note);
  return true;
}
export function InventoryWorkspace({ canManage }: { canManage: boolean }) {
  const [data, setData] = useState<Directory | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  const [brand, setBrand] = useState(""),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all"),
    [tab, setTab] = useState("products");
  const [editor, setEditor] = useState<Product | "new" | null>(null),
    [stock, setStock] = useState<Product | null>(null),
    [saving, setSaving] = useState(false),
    [formError, setFormError] = useState(""),
    [message, setMessage] = useState("");
  const dialog = useRef<HTMLDialogElement>(null),
    lastFocus = useRef<HTMLElement | null>(null),
    requestId = useRef("");
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const next = await request("products");
      setData(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Inventory unavailable");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  function open(product: Product | "new", adjusting = false) {
    lastFocus.current = document.activeElement as HTMLElement;
    setFormError("");
    setMessage("");
    setEditor(adjusting ? null : product);
    setStock(adjusting && product !== "new" ? product : null);
    requestId.current = crypto.randomUUID();
    dialog.current?.showModal();
  }
  function close() {
    dialog.current?.close();
    setEditor(null);
    setStock(null);
    lastFocus.current?.focus();
  }
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setFormError("");
    const values = Object.fromEntries(new FormData(e.currentTarget));
    try {
      if (stock)
        await request("stock", "POST", {
          productId: stock.id,
          requestId: requestId.current,
          delta: Number(values.delta),
          reason: values.reason,
          lot: values.lot,
        });
      else
        await request("products", editor === "new" ? "POST" : "PATCH", {
          ...values,
          ...(editor && editor !== "new" ? { id: editor.id } : {}),
          priceCents: Math.round(Number(values.price) * 100),
          threshold: Number(values.threshold),
        });
      close();
      setMessage("Changes saved.");
      await load();
    } catch (e) {
      setFormError(
        e instanceof Error ? e.message : "Changes could not be saved",
      );
    } finally {
      setSaving(false);
    }
  }
  const products =
    data?.products.filter((p) => !brand || p.businessBrandId === brand) ?? [];
  const found = products.filter(
    (p) =>
      `${p.name} ${p.sku} ${p.category} ${p.gtin ?? ""}`
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (filter === "all" ||
        (filter === "low" && p.quantity > 0 && p.quantity <= p.threshold) ||
        (filter === "out" && p.quantity === 0)),
  );
  function exportCsv() {
    const rows: (string | number)[][] = [
      [
        "Business",
        "SKU",
        "Product",
        "Type",
        "Size",
        "Ingredients",
        "GTIN",
        "Price CAD",
        "Quantity",
        "Low stock threshold",
      ],
      ...products.map((p) => [
        data?.brands.find((b) => b.id === p.businessBrandId)?.name ??
          "Archived business",
        p.sku,
        p.name,
        p.category,
        p.size,
        p.ingredients,
        p.gtin ?? "",
        (p.priceCents / 100).toFixed(2),
        p.quantity,
        p.threshold,
      ]),
    ];
    const url = URL.createObjectURL(
      new Blob(
        ["\uFEFF" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n")],
        { type: "text/csv;charset=utf-8" },
      ),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "takatak-inventory.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const editing = editor && editor !== "new" ? editor : null;
  const field = (
    name: string,
    label: string,
    value: string | number = "",
    type = "text",
    required = true,
  ) => (
    <label className="space-y-1 text-sm text-slate-700" key={name}>
      <span>{label}</span>
      <input
        className={input}
        name={name}
        type={type}
        defaultValue={value}
        required={required}
        {...(type === "number"
          ? {
              step: name === "price" ? "0.01" : "1",
              ...(name !== "delta"
                ? { min: 0, max: 1_000_000_000 }
                : { min: -1_000_000_000, max: 1_000_000_000 }),
            }
          : {
              maxLength:
                name === "ingredients" ? 2000 : name === "reason" ? 500 : 160,
            })}
      />
    </label>
  );
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#060D1F] p-5 text-white">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-[#29C3FF]">
            Your products, accounted for
          </p>
          <p className="mt-2 text-sm text-slate-300">
            Manage each business from your TAKATAK workspace.
          </p>
        </div>
        <button
          className={primary}
          onClick={() => open("new")}
          disabled={!canManage || !data?.brands.length || !!error || loading}
        >
          <Plus size={16} /> Add product
        </button>
      </div>
      <div className="flex flex-wrap gap-3">
        <label className="min-w-56">
          <span className="sr-only">Business</span>
          <select
            className={input}
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
          >
            <option value="">All businesses</option>
            {data?.brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        <button
          className={button}
          onClick={() => void load()}
          disabled={loading}
        >
          <RefreshCw size={15} /> Refresh
        </button>
        <button
          className={button}
          onClick={exportCsv}
          disabled={!data || !!error || loading}
        >
          <Download size={15} /> Export CSV
        </button>
      </div>
      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900"
        >
          {error} Inventory actions are disabled until data can be loaded.
        </div>
      ) : null}
      {message ? (
        <p role="status" className="text-sm text-blue-700">
          {message}
        </p>
      ) : null}
      {!canManage ? (
        <p className="text-sm text-slate-500">
          You have read-only inventory access. Ask your workspace owner for
          permission to manage products and stock.
        </p>
      ) : null}
      {loading ? (
        <p role="status" className="text-sm text-slate-500">
          Loading inventory…
        </p>
      ) : null}
      {data && !error ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ["Products", products.length],
              [
                "Units on hand",
                products.reduce((n, p) => n + p.quantity, 0).toLocaleString(),
              ],
              [
                "Low stock alerts",
                products.filter((p) => p.quantity <= p.threshold).length,
              ],
              [
                "Retail stock value · CAD",
                money(
                  products.reduce((n, p) => n + p.quantity * p.priceCents, 0),
                ),
              ],
            ].map(([label, value]) => (
              <div
                className="rounded-xl border border-slate-200 bg-white p-5"
                key={label}
              >
                <p className="text-xs text-slate-500">{label}</p>
                <p className="mt-3 text-2xl font-bold text-[#0B1B3D]">
                  {value}
                </p>
              </div>
            ))}
          </div>
          {!data.brands.length ? (
            <p className="rounded-lg bg-blue-50 p-4 text-sm text-blue-900">
              Create a business in{" "}
              <Link href="/dashboard/brands" className="underline">
                Businesses / Brands
              </Link>{" "}
              before adding products.
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2" aria-label="Inventory views">
            {["products", "activity", "barcodes"].map((t) => (
              <button
                key={t}
                className={tab === t ? primary : button}
                aria-pressed={tab === t}
                onClick={() => setTab(t)}
              >
                {t === "products"
                  ? "Product inventory"
                  : t === "activity"
                    ? "Stock activity"
                    : "Barcode guide"}
              </button>
            ))}
          </div>
          {tab === "products" ? (
            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="flex flex-wrap gap-3 p-4">
                <label className="flex min-w-0 flex-1 items-center gap-2">
                  <Search size={18} className="text-slate-400" />
                  <input
                    className={input}
                    aria-label="Search products or scan barcode"
                    placeholder="Search products, SKU or scan barcode…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </label>
                <select
                  className={input + " sm:!w-auto"}
                  aria-label="Stock level"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  <option value="all">All stock levels</option>
                  <option value="low">Low stock</option>
                  <option value="out">Out of stock</option>
                </select>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      {[
                        "Product",
                        "SKU / barcode",
                        "Size",
                        "Price CAD",
                        "Stock",
                        "Actions",
                      ].map((h) => (
                        <th key={h} className="whitespace-nowrap px-4 py-3">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {found.map((p) => (
                      <tr key={p.id} className="border-t border-slate-100">
                        <td className="min-w-48 px-4 py-4">
                          <div className="flex items-center gap-3">
                            <Package
                              size={22}
                              className="shrink-0 text-blue-600"
                            />
                            <div>
                              <p className="font-semibold text-slate-900">
                                {p.name}
                              </p>
                              <p className="text-xs text-slate-500">
                                {p.category} ·{" "}
                                {data.brands.find(
                                  (b) => b.id === p.businessBrandId,
                                )?.name ?? "Archived business"}
                              </p>
                              <p className="mt-1 max-w-xs text-xs text-slate-500">
                                {p.ingredients}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 font-mono text-xs">
                          {p.sku}
                          <p className="mt-1 text-slate-500">
                            {p.gtin ?? "Internal SKU only"}
                          </p>
                        </td>
                        <td className="whitespace-nowrap px-4 py-4">
                          {p.size}
                        </td>
                        <td className="px-4 py-4">{money(p.priceCents)}</td>
                        <td className="whitespace-nowrap px-4 py-4">
                          <b>{p.quantity}</b>
                          <p
                            className={`mt-1 text-xs ${p.quantity === 0 ? "text-red-700" : p.quantity <= p.threshold ? "text-amber-700" : "text-green-700"}`}
                          >
                            {p.quantity === 0
                              ? "Out of stock"
                              : p.quantity <= p.threshold
                                ? "Low stock"
                                : "In stock"}
                          </p>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex gap-2">
                            <button
                              className={button}
                              disabled={!canManage}
                              onClick={() => open(p)}
                            >
                              Edit
                            </button>
                            <button
                              className={button}
                              disabled={!canManage}
                              onClick={() => open(p, true)}
                            >
                              ± Stock
                            </button>
                            <button
                              className={button}
                              onClick={() => {
                                if (!printLabel(p))
                                  setMessage(
                                    "Allow pop-ups to print barcode labels.",
                                  );
                              }}
                            >
                              <Barcode size={16} /> Label
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!found.length ? (
                <p className="p-8 text-center text-sm text-slate-500">
                  No matching products. Add your first product or change the
                  search.
                </p>
              ) : null}
              <p className="border-t border-slate-100 p-4 text-xs text-slate-500">
                Scanning finds a product. Record a stock adjustment to receive
                or remove units.
              </p>
            </section>
          ) : null}
          {tab === "activity" ? (
            <section className="rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="font-semibold">Latest stock movements</h2>
              <p className="mt-1 text-xs text-slate-500">
                Latest 100 movements across the workspace, filtered by business
                below. Times in UTC.
              </p>
              {data.movements
                .filter(
                  (m) => !brand || products.some((p) => p.id === m.productId),
                )
                .map((m) => (
                  <div
                    className="mt-4 flex justify-between gap-4 border-t border-slate-100 pt-4 text-sm"
                    key={m.id}
                  >
                    <div>
                      <p className="font-medium">
                        {m.product.name} · {m.product.sku}
                      </p>
                      <p className="text-slate-500">
                        {m.reason}
                        {m.lot ? ` · Lot ${m.lot}` : ""}
                      </p>
                      <p className="text-xs text-slate-500">
                        {new Date(m.createdAt)
                          .toISOString()
                          .replace("T", " ")
                          .slice(0, 19)}{" "}
                        UTC
                      </p>
                    </div>
                    <b>
                      {m.delta > 0 ? "+" : ""}
                      {m.delta} units
                    </b>
                  </div>
                ))}
              {!data.movements.some(
                (m) => !brand || products.some((p) => p.id === m.productId),
              ) ? (
                <p className="mt-4 text-sm text-slate-500">
                  No recent movements for this business.
                </p>
              ) : null}
            </section>
          ) : null}
          {tab === "barcodes" ? (
            <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 text-sm leading-6 text-slate-600">
              <h2 className="text-lg font-bold text-slate-900">
                From your shelf to the checkout
              </h2>
              <p>
                <b>Internal labels:</b> Code 39 encodes your SKU. Enable Code 39
                on your USB or Bluetooth keyboard scanner, focus the inventory
                search box, and scan.
              </p>
              <p>
                <b>Retail labels:</b> Obtain an assigned GS1 number for each
                product and package size. Enter a UPC-A or EAN-13 when adding
                the product. UPC-A is stored as equivalent EAN-13 with a leading
                zero. We check the check digit; GS1 ownership is not verified.
              </p>
              <p>
                Super C, Maxi, Walmart and local stores have their own supplier
                onboarding and product data requirements. A barcode identifies a
                product. Ingredients, pricing and other information must be
                supplied to the retailer separately.
              </p>
              <p>
                Print at actual size and verify with physical scanners before
                use. Long internal SKUs may need wider labels. This module does
                not generate compliant nutrition labels or connect to retailer
                tills.
              </p>
              <p>
                Lot references are recorded on stock movements. Expiry tracking,
                lot-level balances and recall workflows are not included yet.
              </p>
            </section>
          ) : null}
        </>
      ) : null}
      <dialog
        ref={dialog}
        aria-labelledby="inventory-dialog-title"
        onCancel={(e) => {
          if (saving) e.preventDefault();
          else close();
        }}
        className="m-auto max-h-[90vh] w-[min(95vw,640px)] overflow-auto rounded-xl border border-slate-200 bg-white p-6 shadow-xl backdrop:bg-slate-950/50"
      >
        <div className="mb-5 flex items-center justify-between">
          <h2
            id="inventory-dialog-title"
            className="text-xl font-bold text-slate-900"
          >
            {stock
              ? "Adjust stock"
              : editor === "new"
                ? "Add product"
                : "Edit product"}
          </h2>
          <button
            className={button}
            disabled={saving}
            onClick={close}
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>
        <form
          key={stock?.id ?? (editor === "new" ? "new" : editor?.id) ?? "closed"}
          onSubmit={save}
          className="space-y-4"
        >
          {stock ? (
            <>
              <p className="text-sm text-slate-600">
                {stock.name} · {stock.quantity} units available
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                {field(
                  "delta",
                  "Quantity change (+ received / − sold)",
                  "",
                  "number",
                )}
                {field("reason", "Reason")}
                {field(
                  "lot",
                  "Lot / batch reference (optional)",
                  "",
                  "text",
                  false,
                )}
              </div>
            </>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-1 text-sm text-slate-700">
                  <span>Business</span>
                  <select
                    name="businessBrandId"
                    required
                    className={input}
                    defaultValue={editing?.businessBrandId ?? brand}
                    disabled={!!editing}
                  >
                    {!editing ? (
                      <option value="">Select a business</option>
                    ) : null}
                    {data?.brands.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                  {editing ? (
                    <input
                      type="hidden"
                      name="businessBrandId"
                      value={editing.businessBrandId}
                    />
                  ) : null}
                </label>
                {field("name", "Product name", editing?.name)}
                {field("sku", "Internal SKU", editing?.sku)}
                {field("category", "Honey type / category", editing?.category)}
                {field("size", "Package size (e.g. 500 g)", editing?.size)}
                {field("ingredients", "Ingredients", editing?.ingredients)}
                {field(
                  "gtin",
                  "GS1 UPC / EAN (optional)",
                  editing?.gtin ?? "",
                  "text",
                  false,
                )}
                {field(
                  "price",
                  "Selling price · CAD",
                  editing ? (editing.priceCents / 100).toFixed(2) : "0.00",
                  "number",
                )}
                {field(
                  "threshold",
                  "Low stock threshold",
                  editing?.threshold ?? 10,
                  "number",
                )}
              </div>
              <p className="text-xs text-slate-500">
                New products start at zero stock. Use ± Stock to record opening
                quantities with a reason and lot reference. Retail barcodes
                require legitimate GS1 assignment.
              </p>
            </>
          )}
          {formError ? (
            <p role="alert" className="text-sm text-red-700">
              {formError}
            </p>
          ) : null}
          <button type="submit" className={primary} disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </button>
        </form>
      </dialog>
    </div>
  );
}
