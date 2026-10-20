# MIEL AISSA — from your jar to a store checkout

The software is yours: TAKATAK Inventory inside TakaTak Dash V1. It manages the products, quantities, barcode artwork and wraparound labels. No Orderful subscription is needed to generate and scan product barcodes.

## What I prepared

- A saved, editable label studio with the business details you supplied:
  - MIEL AISSA / MIELAISSA.CA
  - 5837 Rue Jean-Talon E, H1S 1M4
  - Produit du Québec
- Full wrap PDF output for Letter/A4 adhesive sheets or a matching custom roll.
- Batch quantities, crop marks for sheets, protected barcode size/white space, English/French text fields, lot/date fields and an approved nutrition-artwork slot.
- A scanner test box and a retailer product-data CSV export.

The included PDF is a **draft example at 180 × 65 mm for a sample 500 g jar**. Its Code 39 value `AISSA-500` is an internal test code, not a registered retail product number. The jar dimensions, weight and recipe must be confirmed before final packaging.

## What you need to do, in order

1. **Confirm each product.** List the honey varieties, ingredients and jar weights. Each variety/size gets its own product record and retail number. Different jars of the same variant reuse that number.
2. **Register the business with GS1 Canada.** Obtain enough licensed GTINs for those variants. Published annual fees are C$26.25 for one number if gross revenue is under C$250,000, or C$157.50 for ten if under C$500,000. Tax, renewal terms and retailer data-service requirements must be confirmed at registration. The business owner supplies the contact, legal entity, eligibility and payment details and accepts the terms. Registration has not been submitted.
   - https://gs1ca.org/small-business/
3. **Enter each assigned UPC/EAN into TakaTak.** Do not make up a number or reuse a number from another business. Save the product, then open **Label studio**.
4. **Measure the jar.** Use paper or a flexible tape to measure the circumference and the usable straight-sided label height in millimetres. Set label width to circumference minus a 2 mm gap; enter the usable height. The separate blank seam strip is white space on the label itself.
5. **Finish the packaging text.** Use the correct English/French common name, metric quantity, business details, applicable origin/grade/colour information and nutrition panel or reviewed exemption. “Produit du Québec” was supplied by you; its required wording and any other origin declaration must be checked for the actual product. The studio does not invent nutrition values or award a honey grade.
   - https://inspection.canada.ca/en/food-labels/labelling/industry/honey
6. **Print at Actual size / 100%.** Use compatible adhesive label stock. On sheets, trim at the crop marks; on a roll printer, choose a matching media size and supported feed length. Apply to a clean jar smoothly, without creases or a seam over the barcode.
7. **Test the applied label.** Scan into TakaTak’s test box and check the correct product appears. For retailer acceptance, get a barcode-quality verification on the finished printed label/jar as requested by the buyer.
   - https://gs1ca.org/barcode-scan-verification/
8. **Get the merchant to list it.** Provide the buyer your assigned number, product information and finished sample. The merchant must approve the product and load that number and its retail price into its checkout system. Test a sample at that store before delivering stock. A readable barcode and an accepted product listing are separate requirements.

The same assigned product number can identify the same product at multiple merchants. It does not automatically create a listing, price or stock record in every store.

## Lowest-cost equipment shortlist

Prices checked October 20, 2026; CAD before tax, labels, shipping and consumables. Recheck Québec delivery, stock and return terms. These are observed candidates, not a claim to have found the absolute lowest price everywhere or to have physically tested them.

| Item | Observed price | Use |
| --- | ---: | --- |
| Reuse your existing suitable printer | C$0 extra printer cost | Lowest upfront route; use label stock compatible with that printer |
| U20 USB/2.4 GHz 2D scanner, Walmart Marketplace | C$36.32 | Paper/screen codes; confirm USB keyboard mode, UPC-A/EAN-13/Code 39 support and seller returns |
| Canon PIXMA TR4720, Staples Canada | C$79.99 | Low upfront colour sheet printing; allow for ink refills, suitable stock and water-resistance tests |
| Brother HL-L2405W, Staples Canada | C$119.99 | Black-and-white sheet batches; use laser-compatible adhesive stock |
| MUNBYN RW403B, manufacturer Canada store | C$99.99 | 203 DPI black-and-white roll trials; direct-thermal labels can fade in heat/light; confirm your label length is supported |

- Scanner + Canon: **C$116.31** before tax and supplies.
- Scanner + Brother: **C$156.31** before tax and supplies.
- Reusing your printer avoids buying a printer before you know the real label dimensions and volume.

A cheaper C$35.09 scanner search result was excluded because its live page showed out of stock. One Best Buy marketplace option was also excluded because the seller’s page excluded Québec shipping. The Canon’s live page showed C$79.99 even though an older search result showed C$59.99; the live price is used here.

For long shelf-life packaging, durability matters: use tested ink/toner and label material, or a suitable thermal-transfer printer/ribbon/media combination. A direct-thermal shipping-label printer is not automatically the right printer for honey jars that stay on shelves a long time. The printer produces an adhesive wrap label; it does not print directly onto the curved glass or apply the label for you.

Equipment links:

- Scanner: https://www.walmart.ca/en/ip/Barcode-Scanner-U20-2D-USB-Wired-Handheld-Reader-Image-Sensor-Supports-Paper-Screen-Codes-80-Meters-Connection-Easy-Set-Up-Supermarket-Inventory-Mana/3EU5LXKQFA3N
- Colour printer: https://www.staples.ca/products/24501714-en-canon-pixma-tr4720-wireless-all-in-one-printer-black
- Monochrome laser: https://www.staples.ca/products/3082604-en-brother-hl-l2405w-home-office-ready-monochrome-laser-printer
- Roll printer: https://ca.munbyn.com/products/munbyn-rw403b-bluetooth-thermal-label-printer

## Retailer starting points

- **Maxi / Loblaw:** the Small Supplier Program is the official starting point for emerging/local suppliers. Ask the category team which Maxi banner/region and product-data process apply: https://www.loblaw.ca/en/small-supplier/
- **Super C / METRO:** request the appropriate honey/local-products buyer and confirm the current supplier/product setup. GS1 Canada’s grocery checklist links retailer requirements: https://gs1ca.org/grocery/checklist/
- **Walmart Canada stores:** start with the supplier resources and ask about in-store supply. A Walmart.ca marketplace account is not the same as an in-store listing: https://www.walmartcanada.ca/suppliers
- **Independent store:** ask the owner to create the product in its POS catalog using your assigned number and its selling price, then scan the sample at its checkout.

A buyer may require more than the barcode licence, including product data/image services, food-business documentation and supply terms. Confirm the actual buyer’s checklist before spending on those services.

## Deployment status

The implementation is in https://github.com/takatakca/takatak-v1/pull/218. It has not been merged or deployed to the live dashboard. The existing release process must review the new database migrations and deploy V1. No GS1 registration, equipment order, retailer submission or claim of retailer approval has been made.
