import Link from "next/link";
import { ModuleHeader } from "@/components/saas/module-header";
import { requireWorkspacePermission } from "@/lib/security/workspace-guard";
export const dynamic = "force-dynamic";
export default async function InventoryRetailSetupPage() {
  await requireWorkspacePermission(
    "view_inventory",
    "/dashboard/inventory/labels/setup",
  );
  const steps = [
    [
      "1. List the products you will sell",
      "Each honey type and jar size needs its own product number. Start with the real sizes and recipes you intend to sell. Add them in Inventory; use stock adjustments for physical quantities.",
    ],
    [
      "2. Register MIEL AISSA with GS1 Canada",
      "Use the legal business details and choose enough licensed numbers for those variants. GS1 Canada lists one barcode at C$26.25/year (gross revenue below C$250,000) or ten at C$157.50/year (below C$500,000). Confirm eligibility, tax and renewal terms at signup. TakaTak does not invent GS1 product numbers.",
    ],
    [
      "3. Assign the numbers to the products",
      "Enter each assigned UPC/EAN into its Inventory record. The label studio checks its check digit and prints the barcode. One jar variant keeps the same product number when sold through different merchants.",
    ],
    [
      "4. Finish and print the wrap label",
      "Measure the jar circumference and usable straight-sided height. Enter bilingual product information, business details, verified origin wording and any required grade, colour or Nutrition Facts panel. Download a sheet or roll PDF at the exact millimetre size. Print at Actual size / 100%, apply smoothly and keep the barcode off the seam.",
    ],
    [
      "5. Scan the applied label",
      "Set your scanner to USB keyboard mode with UPC-A, EAN-13 and Code 39 enabled. Scan in the label studio’s test box. A matching number confirms decoding; professional barcode verification checks print quality on the finished jar.",
    ],
    [
      "6. Have each retailer list the product",
      "Give the buyer the assigned number, product data and a finished sample. The retailer must approve the supplier/product and load its own checkout catalog and price. Run a test scan at that retailer before first delivery. A scannable barcode alone does not create a retailer listing.",
    ],
  ];
  return (
    <div className="space-y-6">
      <ModuleHeader
        title="From jar to checkout"
        description="Your own TakaTak inventory and label system, with standard retail product identifiers."
      />
      <Link
        href="/dashboard/inventory/labels"
        className="text-sm font-medium text-blue-700 underline"
      >
        Back to label studio
      </Link>
      <div className="grid gap-4 lg:grid-cols-2">
        {steps.map(([title, text]) => (
          <section
            key={title}
            className="rounded-xl border border-slate-200 bg-white p-5"
          >
            <h2 className="font-bold text-[#0B1B3D]">{title}</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">{text}</p>
          </section>
        ))}
      </div>
      <div className="flex flex-wrap gap-4 text-sm text-blue-700 underline">
        <a
          href="https://gs1ca.org/small-business/"
          target="_blank"
          rel="noreferrer"
        >
          GS1 Canada registration and fees
        </a>
        <a
          href="https://gs1ca.org/barcode-scan-verification/"
          target="_blank"
          rel="noreferrer"
        >
          Barcode print verification
        </a>
        <a
          href="https://inspection.canada.ca/en/food-labels/labelling/industry/honey"
          target="_blank"
          rel="noreferrer"
        >
          Canadian honey label requirements
        </a>
      </div>
      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-bold">Low-cost equipment shortlist</h2>
        <p className="text-sm text-slate-600">
          Prices checked October 20, 2026, in CAD before tax, shipping, labels
          and replacement ink/toner. Recheck price, stock, Québec delivery and
          return terms before buying. These are researched candidates, not
          hardware tested with this app.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr>
                {["Equipment", "Observed price", "Best use", "Tradeoff"].map(
                  (h) => (
                    <th className="border-b p-3" key={h}>
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="p-3">
                  <a
                    className="text-blue-700 underline"
                    href="https://www.walmart.ca/en/ip/Barcode-Scanner-U20-2D-USB-Wired-Handheld-Reader-Image-Sensor-Supports-Paper-Screen-Codes-80-Meters-Connection-Easy-Set-Up-Supermarket-Inventory-Mana/3EU5LXKQFA3N"
                    target="_blank"
                    rel="noreferrer"
                  >
                    U20 USB/2.4 GHz 2D scanner
                  </a>
                </td>
                <td className="whitespace-nowrap p-3">$36.32</td>
                <td className="p-3">Low-cost paper/screen scanning</td>
                <td className="p-3">
                  Marketplace seller; confirm USB keyboard mode and UPC/EAN
                  support. No reviews shown when checked.
                </td>
              </tr>
              <tr>
                <td className="p-3">
                  <a
                    className="text-blue-700 underline"
                    href="https://www.staples.ca/products/24501714-en-canon-pixma-tr4720-wireless-all-in-one-printer-black"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Canon PIXMA TR4720
                  </a>
                </td>
                <td className="whitespace-nowrap p-3">$79.99</td>
                <td className="p-3">Low upfront cost, colour sheet labels</td>
                <td className="p-3">
                  Ink refills and water resistance matter. Use compatible inkjet
                  label stock and test the finished label.
                </td>
              </tr>
              <tr>
                <td className="p-3">
                  <a
                    className="text-blue-700 underline"
                    href="https://www.staples.ca/products/3082604-en-brother-hl-l2405w-home-office-ready-monochrome-laser-printer"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Brother HL-L2405W
                  </a>
                </td>
                <td className="whitespace-nowrap p-3">$119.99</td>
                <td className="p-3">Black-and-white adhesive sheet batches</td>
                <td className="p-3">
                  Use laser-compatible label stock. Cut full-sheet labels at the
                  PDF crop marks.
                </td>
              </tr>
              <tr>
                <td className="p-3">
                  <a
                    className="text-blue-700 underline"
                    href="https://ca.munbyn.com/products/munbyn-rw403b-bluetooth-thermal-label-printer"
                    target="_blank"
                    rel="noreferrer"
                  >
                    MUNBYN RW403B
                  </a>
                </td>
                <td className="whitespace-nowrap p-3">$99.99</td>
                <td className="p-3">
                  Quick black-and-white roll labels, 203 DPI
                </td>
                <td className="p-3">
                  Direct thermal can fade with heat/light. Confirm a matching
                  custom label length and media; better suited to
                  trials/short-life labels than long shelf-life packaging.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="rounded-lg bg-blue-50 p-4 text-sm text-blue-900">
          Lowest additional cost: reuse a suitable printer you already own. The
          listed scanner plus Canon costs $116.31 before tax and supplies;
          scanner plus Brother costs $156.31. A roll printer feeds a long wrap
          lengthwise—the label height must fit across its printhead. Measure
          before ordering media.
        </p>
      </section>
      <section className="rounded-xl border border-slate-200 bg-white p-5 text-sm leading-6 text-slate-600">
        <h2 className="font-bold text-slate-900">
          What you can do without a monthly EDI service
        </h2>
        <p className="mt-2">
          Manage products and stock, generate and print your labels, scan your
          product numbers and export a retailer product sheet. An EDI connection
          is needed only if the buyer’s ordering/shipping process requires it;
          it is not what makes a UPC/EAN barcode readable.
        </p>
        <p className="mt-2">
          No registration, purchase or retailer submission has been made by this
          page. Registration requires the actual business contact details,
          eligibility and agreement to the provider’s terms; retailer acceptance
          remains the retailer’s decision.
        </p>
      </section>
    </div>
  );
}
