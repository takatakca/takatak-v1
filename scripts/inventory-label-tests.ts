import assert from "node:assert/strict";
import { PDFDocument, PDFRef, PDFDict, PDFArray, PDFStream } from "pdf-lib";
import { mkdir, writeFile } from "node:fs/promises";
import {
  defaultLabelConfig,
  labelConfigInput,
  labelReadiness,
  barcodeMatchesScan,
  mielAissaLabelConfig,
  readLabelConfig,
  type LabelProduct,
} from "../src/lib/inventory/label-config";
import {
  minimumDeclarationHeightMm,
  buildLabelScene,
  planLabelPages,
  POINTS_PER_MM,
} from "../src/lib/inventory/label-layout";
import { labelPdf } from "../src/lib/inventory/label-pdf";
import {
  defaultQuebecReview,
  hasMetricHoneyMass,
  invalidateQuebecReview,
  quebecRequirements,
  quebecReviewInput,
  quebecReviewIssues,
} from "../src/lib/inventory/quebec-requirements";
function assertPdfReferences(pdf: PDFDocument) {
  const checked = new Set<string>();
  function walk(value: unknown) {
    if (value instanceof PDFRef) {
      if (checked.has(value.toString())) return;
      checked.add(value.toString());
      const resolved = pdf.context.lookup(value);
      assert.ok(resolved, `Unresolved PDF resource ${value}`);
      walk(resolved);
    } else if (value instanceof PDFDict)
      for (const [, entry] of value.entries()) walk(entry);
    else if (value instanceof PDFArray)
      for (const entry of value.asArray()) walk(entry);
    else if (value instanceof PDFStream) walk(value.dict);
  }
  for (const [, object] of pdf.context.enumerateIndirectObjects()) walk(object);
}
async function main() {
  const product: LabelProduct = {
    id: "00000000-0000-4000-8000-000000000001",
    businessBrandId: "00000000-0000-4000-8000-000000000002",
    name: "Honey",
    category: "Honey",
    sku: "HNY-500",
    size: "500 g",
    ingredients: "Honey",
    gtin: "0036000291452",
  };
  const config = {
    ...mielAissaLabelConfig(),
    ingredientsFr: "Miel",
    lot: "LOT-001",
    bestBefore: "",
  };
  assert.ok(labelReadiness(product, config).length);
  assert.equal(barcodeMatchesScan(product, "036000291452\r\n"), true);
  assert.equal(barcodeMatchesScan(product, "0036000291452"), true);
  assert.equal(barcodeMatchesScan(product, "03600029145"), false);
  assert.equal(barcodeMatchesScan(product, "HNY-500"), true);
  for (const invalid of [
    { widthMm: 0 },
    { heightMm: 20 },
    { dpi: 72 },
    { seamMm: 99 },
    { brand: "x".repeat(161) },
    { nutritionImage: "data:image/svg+xml;base64,PHN2Zz4=" },
    { nutritionRatio: Infinity },
    { jarShape: "octagonal" },
    { flatFaceWidthMm: -1 },
    { flatFaceWidthMm: Infinity },
    { flatFaceWidthMm: "40" },
  ])
    assert.throws(() => labelConfigInput({ ...config, ...invalid }));
  for (const [area, height] of [
    [32, 1.6],
    [32.1, 3.2],
    [258, 3.2],
    [258.1, 6.4],
    [645, 6.4],
    [645.1, 9.5],
    [2580, 9.5],
    [2580.1, 12.7],
  ])
    assert.equal(minimumDeclarationHeightMm(area), height);
  for (const area of [-1, NaN, Infinity, 10001])
    assert.throws(() =>
      labelConfigInput({ ...config, principalDisplayAreaCm2: area }),
    );
  const finalConfig = {
    ...config,
    quebec: structuredClone(config.quebec),
    principalDisplayAreaCm2: 22,
    gs1Confirmed: true,
    textReviewed: true,
    nutritionStatus: "exempt" as const,
    nutritionExemption: "Synthetic test only - not an actual exemption",
  };
  for (const row of Object.values(finalConfig.quebec.items)) {
    row.status = "recorded";
    row.reference = "Synthetic QA evidence only; no real business approval.";
  }
  assert.equal(labelReadiness(product, finalConfig).length, 0);
  assert.equal(
    quebecReviewIssues(defaultQuebecReview(true)).length,
    quebecRequirements.length,
  );
  assert.equal(quebecReviewIssues(defaultQuebecReview(false)).length, 0);
  const noReferences = defaultQuebecReview(true);
  for (const row of Object.values(noReferences.items)) row.status = "recorded";
  assert.equal(
    quebecReviewIssues(noReferences).length,
    quebecRequirements.length,
  );
  for (const mass of ["500 g", "375g", "1,5 kg", "0.5 kg"])
    assert.equal(hasMetricHoneyMass(mass), true);
  for (const mass of ["288 mL", "500", "-1 kg", "0 g", "1e3 g", "500 g extra"])
    assert.equal(hasMetricHoneyMass(mass), false);
  assert.ok(
    labelReadiness({ ...product, size: "288 mL" }, finalConfig).some((s) =>
      s.includes("poids net confirmé"),
    ),
  );
  assert.ok(
    labelReadiness(product, { ...finalConfig, lot: "" }).some((s) =>
      s.includes("lot de conditionnement"),
    ),
  );
  const exemptPermit = structuredClone(finalConfig.quebec);
  exemptPermit.items.permits.status = "not_applicable";
  assert.equal(quebecReviewIssues(quebecReviewInput(exemptPermit)).length, 0);
  exemptPermit.items.permits.reference = "";
  assert.equal(quebecReviewIssues(quebecReviewInput(exemptPermit)).length, 1);
  for (const invalid of [
    null,
    { enabled: "true", items: {} },
    { enabled: true, items: [] },
    {
      enabled: true,
      items: { label: { status: "not_applicable", reference: "not allowed" } },
    },
    {
      enabled: true,
      items: {
        permits: { status: "approved", reference: "not a valid status" },
      },
    },
    {
      enabled: true,
      items: { permits: { status: "pending", reference: "x".repeat(601) } },
    },
  ])
    assert.throws(() => quebecReviewInput(invalid));
  const reset = invalidateQuebecReview(finalConfig.quebec);
  assert.equal(reset.items.quantity.status, "pending");
  assert.equal(
    reset.items.quantity.reference,
    finalConfig.quebec.items.quantity.reference,
  );
  const oldQuebecConfig = { ...finalConfig } as Record<string, unknown>;
  delete oldQuebecConfig.quebec;
  assert.equal(readLabelConfig(oldQuebecConfig).quebec.enabled, true);
  assert.equal(
    quebecReviewIssues(readLabelConfig(oldQuebecConfig).quebec).length,
    quebecRequirements.length,
  );
  assert.equal(defaultLabelConfig("Another business").quebec.enabled, false);
  const legacyConfig: Record<string, unknown> = { ...config };
  delete legacyConfig.jarShape;
  delete legacyConfig.flatFaceWidthMm;
  const legacy = readLabelConfig(legacyConfig);
  assert.equal(legacy.jarShape, "round");
  assert.equal(legacy.flatFaceWidthMm, 0);
  assert.equal(legacy.brand, "MIEL AISSA");
  for (const dpi of [203, 300, 600] as const) {
    for (const orientation of ["ladder", "fence"] as const) {
      const scene = await buildLabelScene(product, {
        ...config,
        dpi,
        orientation,
      });
      const symbol = scene.elements.find((e) => e.kind === "barcode");
      assert.ok(symbol && symbol.kind === "barcode");
      assert.ok(symbol.moduleMm >= 0.33 && symbol.moduleMm <= 0.66);
      assert.ok(
        Math.abs(
          (symbol.moduleMm * dpi) / 25.4 -
            Math.round((symbol.moduleMm * dpi) / 25.4),
        ) < 0.00001,
      );
      assert.ok(symbol.barHeight >= 22.85);
      const bytes = await labelPdf(scene, "letter", 5);
      const pdf = await PDFDocument.load(bytes);
      assert.equal(pdf.getPageCount(), 2);
      assertPdfReferences(pdf);
      assert.ok(
        Math.abs(pdf.getPage(0).getWidth() / POINTS_PER_MM - 215.9) < 0.001,
      );
      if (process.env.INVENTORY_LABEL_ARTIFACTS) {
        await mkdir(process.env.INVENTORY_LABEL_ARTIFACTS, { recursive: true });
        await writeFile(
          `${process.env.INVENTORY_LABEL_ARTIFACTS}/retail-test-${dpi}-${orientation}.pdf`,
          await labelPdf(scene, "roll", 1),
        );
      }
    }
  }
  await assert.rejects(
    buildLabelScene({ ...product, gtin: "0036000291453" }, config),
    /check digit/,
  );
  const imageConfig = {
    ...config,
    widthMm: 230,
    heightMm: 90,
    nutritionStatus: "provided" as const,
    nutritionImage:
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aVJkAAAAASUVORK5CYII=",
    nutritionRatio: 1,
  };
  const imageScene = await buildLabelScene(product, imageConfig);
  await assert.rejects(
    buildLabelScene(product, {
      ...imageConfig,
      jarShape: "hexagonal",
      flatFaceWidthMm: 40,
    }),
    /surface continue/,
  );
  const hexNutrition = await buildLabelScene(product, {
    ...imageConfig,
    jarShape: "hexagonal",
    flatFaceWidthMm: 44,
  });
  assert.ok(
    hexNutrition.elements.some(
      (e) => e.kind === "image" && e.width === imageConfig.nutritionWidthMm,
    ),
  );
  assert.ok(
    imageScene.elements.some(
      (e) => e.kind === "image" && e.width === imageConfig.nutritionWidthMm,
    ),
  );
  assertPdfReferences(
    await PDFDocument.load(await labelPdf(imageScene, "roll", 1)),
  );
  const scene = await buildLabelScene(product, config);
  const rollBytes = await labelPdf(scene, "roll", 3);
  const roll = await PDFDocument.load(rollBytes);
  assert.equal(roll.getPageCount(), 3);
  assert.ok(Math.abs(roll.getPage(0).getWidth() / POINTS_PER_MM - 65) < 0.001);
  assert.ok(
    Math.abs(roll.getPage(0).getHeight() / POINTS_PER_MM - 180) < 0.001,
  );
  await assert.rejects(
    buildLabelScene(product, {
      ...config,
      notes: "Very long text ".repeat(100),
    }),
    /overflows/,
  );
  assert.throws(
    () => planLabelPages({ width: 300, height: 100 }, "letter", 1),
    /does not fit/,
  );
  assert.throws(
    () => planLabelPages({ width: 200, height: 110 }, "roll", 1),
    /4-inch/,
  );
  assert.throws(() => planLabelPages(scene, "letter", 1.5));
  const internalProduct = { ...product, sku: "AISSA-500", gtin: null };
  const hexConfig = {
    ...config,
    heightMm: 100,
    jarShape: "hexagonal" as const,
  };
  await assert.rejects(
    buildLabelScene(product, hexConfig),
    /Measure the width of one completely flat glass face/,
  );
  for (const dpi of [203, 300, 600] as const) {
    for (const orientation of ["ladder", "fence"] as const) {
      for (const item of [product, internalProduct]) {
        const fittingConfig = {
          ...hexConfig,
          flatFaceWidthMm: 90,
          dpi,
          orientation,
        };
        const fitted = await buildLabelScene(item, fittingConfig);
        const barcode = fitted.elements.find((e) => e.kind === "barcode");
        assert.ok(barcode && barcode.kind === "barcode");
        assert.equal(barcode.rotated, orientation === "ladder");
        assert.equal(
          fitted.flatFaceFit?.requiredWidthMm,
          (barcode.rotated ? barcode.height : barcode.width) + 4,
        );
        const required = fitted.flatFaceFit!.requiredWidthMm;
        // A 0.1 mm boundary distinguishes a fitting face from one too narrow.
        const roundedUp = Math.ceil(required * 10) / 10;
        await buildLabelScene(item, {
          ...fittingConfig,
          flatFaceWidthMm: roundedUp,
        });
        await assert.rejects(
          buildLabelScene(item, {
            ...fittingConfig,
            flatFaceWidthMm: roundedUp - 0.1,
          }),
          /was not reduced or allowed across a corner/,
        );
        const hexPdf = await PDFDocument.load(
          await labelPdf(fitted, "roll", 1),
        );
        assertPdfReferences(hexPdf);
        if (process.env.INVENTORY_LABEL_ARTIFACTS)
          await writeFile(
            `${process.env.INVENTORY_LABEL_ARTIFACTS}/hex-test-${item.gtin ? "retail" : "internal"}-${dpi}-${orientation}.pdf`,
            await labelPdf(fitted, "roll", 1),
          );
      }
    }
  }
  await assert.rejects(
    buildLabelScene(internalProduct, {
      ...hexConfig,
      heightMm: 65,
      flatFaceWidthMm: 35,
      dpi: 203,
      orientation: "ladder",
    }),
    /does not fit at a readable barcode size/,
  );
  const proof = await buildLabelScene(internalProduct, {
    ...config,
    notes: "Proof only: recipe and 500 g size not confirmed.",
  });
  assert.ok(proof.draft);
  if (process.env.INVENTORY_LABEL_ARTIFACTS) {
    await writeFile(
      `${process.env.INVENTORY_LABEL_ARTIFACTS}/MIEL-AISSA-draft-wrap-180x65mm-letter.pdf`,
      await labelPdf(proof, "letter", 3),
    );
    await writeFile(
      `${process.env.INVENTORY_LABEL_ARTIFACTS}/MIEL-AISSA-draft-wrap-180x65mm-roll.pdf`,
      await labelPdf(proof, "roll", 1),
    );
  }
  assert.equal(defaultLabelConfig().gs1Confirmed, false);
  console.log(
    "Label checks passed: Québec evidence/draft controls, mass/lot requirements, nutrition face fit, dimensions, protected barcode geometry, PDF pages, text overflow and scan matching.",
  );
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
