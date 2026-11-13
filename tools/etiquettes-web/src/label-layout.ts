import { PDFDocument, StandardFonts, type PDFFont } from "pdf-lib";
import { normalizeGtin } from "./validation";
import { code39, ean13 } from "./barcodes";
import {
  labelConfigInput,
  labelReadiness,
  type LabelConfig,
  type LabelProduct,
} from "./label-config";
export const POINTS_PER_MM = 72 / 25.4;
/** RSAC schedule 6. The packaging reviewer determines the applicable PSE. */
export function minimumDeclarationHeightMm(areaCm2: number): number {
  if (areaCm2 <= 32) return 1.6;
  if (areaCm2 <= 258) return 3.2;
  if (areaCm2 <= 645) return 6.4;
  if (areaCm2 <= 2580) return 9.5;
  return 12.7;
}
export type LabelElement =
  | {
      kind: "image";
      x: number;
      y: number;
      width: number;
      height: number;
      data: string;
    }
  | {
      kind: "rect";
      x: number;
      y: number;
      width: number;
      height: number;
      colour: string;
    }
  | {
      kind: "text";
      x: number;
      y: number;
      text: string;
      size: number;
      bold: boolean;
      colour: string;
    }
  | {
      kind: "barcode";
      x: number;
      y: number;
      width: number;
      height: number;
      rotated: boolean;
      bars: { x: number; width: number; height: number }[];
      text: string;
      moduleMm: number;
      barHeight: number;
    };
export type LabelScene = {
  width: number;
  height: number;
  seamMm: number;
  draft: boolean;
  elements: LabelElement[];
  issues: string[];
  flatFaceFit?: { requiredWidthMm: number; measuredWidthMm: number };
  minimumDeclarationHeightMm: number;
};
let fonts: Promise<{ normal: PDFFont; bold: PDFFont }> | null = null;
function metrics() {
  return (fonts ??= PDFDocument.create().then(async (doc) => ({
    normal: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
  })));
}
function linesFor(
  text: string,
  font: PDFFont,
  size: number,
  max: number,
): string[] {
  const result: string[] = [];
  for (const paragraph of text.normalize("NFC").split(/\r?\n/)) {
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      if (font.widthOfTextAtSize(word, size) > max)
        throw new Error(
          "A label word is too long for its panel. Shorten it or increase the label width.",
        );
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) > max) {
        result.push(line);
        line = word;
      } else line = candidate;
    }
    if (line) result.push(line);
  }
  return result;
}
export async function buildLabelScene(
  product: LabelProduct,
  value: LabelConfig,
): Promise<LabelScene> {
  const config = labelConfigInput(value);
  const font = await metrics();
  const issues = labelReadiness(product, config);
  const draft = issues.length > 0;
  const scene: LabelScene = {
    width: config.widthMm,
    height: config.heightMm,
    seamMm: config.seamMm,
    draft,
    issues,
    elements: [],
    minimumDeclarationHeightMm: minimumDeclarationHeightMm(
      config.principalDisplayAreaCm2,
    ),
  };
  const black = "#111111",
    accent =
      config.theme === "blue"
        ? "#1565D8"
        : config.theme === "honey"
          ? "#95661B"
          : black;
  if (config.theme === "honey")
    scene.elements.push({
      kind: "rect",
      x: 0,
      y: 0,
      width: scene.width,
      height: scene.height,
      colour: "#FFFCF4",
    });
  if (product.gtin) normalizeGtin(product.gtin);
  const code = product.gtin ? ean13(product.gtin) : code39(product.sku);
  const moduleMm =
    (Math.ceil(((product.gtin ? 0.33 : 0.254) * config.dpi) / 25.4) * 25.4) /
    config.dpi;
  const barHeight = product.gtin ? moduleMm * (22.85 / 0.33) : 20;
  const symbolWidth = code.width * moduleMm;
  const symbolHeight = barHeight + 6;
  const rotated =
    config.orientation === "ladder" &&
    (!!product.gtin || config.jarShape === "hexagonal");
  const occupiedWidth = rotated ? symbolHeight : symbolWidth,
    occupiedHeight = rotated ? symbolWidth : symbolHeight;
  if (config.jarShape === "hexagonal") {
    if (!config.flatFaceWidthMm)
      throw new Error(
        "Measure the width of one completely flat glass face, excluding the rounded corners, and enter it before printing a hexagonal-jar label. Capacity in mL does not determine this measurement.",
      );
    // Include the complete symbol, quiet zones and human-readable text, plus
    // 2 mm of application tolerance on each side. This is a fit allowance,
    // not a substitute for GS1 verification on the applied label.
    const requiredWidthMm = occupiedWidth + 4;
    if (requiredWidthMm > config.flatFaceWidthMm)
      throw new Error(
        `This barcode needs a flat face at least ${requiredWidthMm.toFixed(1)} mm wide, including white space and application allowance; the measured face is ${config.flatFaceWidthMm.toFixed(1)} mm. Try ladder orientation, another resolution, a shorter internal SKU or a wider flat panel. The barcode was not reduced or allowed across a corner.`,
      );
    scene.flatFaceFit = {
      requiredWidthMm,
      measuredWidthMm: config.flatFaceWidthMm,
    };
  }
  const barcodePanelWidth = Math.max(40, occupiedWidth + 4);
  const edge = 4,
    top = draft ? 8 : 5,
    bottom = config.heightMm - 5;
  const nutritionImage =
    config.nutritionStatus === "provided" ? config.nutritionImage : "";
  const nutritionWidth = nutritionImage ? config.nutritionWidthMm : 0;
  if (
    nutritionImage &&
    config.jarShape === "hexagonal" &&
    nutritionWidth + 4 > config.flatFaceWidthMm
  )
    throw new Error(
      "Le tableau de la valeur nutritive approuvé doit tenir sur une surface continue. Sa largeur, avec 2 mm de marge d’application de chaque côté, dépasse la face plane mesurée. Revoir le panneau approuvé ou l’emballage; ne pas le plier sur un coin ni réduire ses caractères pour le faire tenir.",
    );
  const infoX = edge + (nutritionWidth ? nutritionWidth + 4 : 0);
  const available =
    config.widthMm -
    config.seamMm -
    edge * 2 -
    barcodePanelWidth -
    8 -
    (nutritionWidth ? nutritionWidth + 4 : 0);
  const infoWidth = available * 0.52,
    frontWidth = available * 0.48;
  if (infoWidth < 32 || frontWidth < 30 || occupiedHeight > bottom - top)
    throw new Error(
      "This layout does not fit at a readable barcode size. Increase label width/height, switch barcode orientation, or shorten an internal SKU. Barcodes are never squeezed to fit.",
    );
  const contentRight = config.widthMm - config.seamMm - edge;
  const barcodePanelX = contentRight - barcodePanelWidth;
  const frontX = infoX + infoWidth + 5;
  // Helvetica regular/bold have an x-height above half the em. Using half
  // the em here conservatively sizes both letters and digits; the applied
  // print still needs actual-size measurement and the reviewed PSE.
  const declarationSize = Math.max(3.2, scene.minimumDeclarationHeightMm / 0.5);
  if (config.theme === "honey")
    scene.elements.push({
      kind: "rect",
      x: barcodePanelX - 1,
      y: top,
      width: barcodePanelWidth + 2,
      height: bottom - top,
      colour: "#FFFFFF",
    });
  function addText(
    text: string,
    x: number,
    y: number,
    width: number,
    size = 3.1,
    bold = false,
    colour = black,
    center = false,
  ) {
    const selected = bold ? font.bold : font.normal;
    let lines: string[];
    try {
      lines = linesFor(text, selected, size, width);
    } catch (e) {
      if (e instanceof Error && /WinAnsi|encode/.test(e.message))
        throw new Error(
          "Use English/French Latin characters in label text; this font cannot print the supplied symbol.",
        );
      throw e;
    }
    for (const line of lines) {
      y += size;
      if (y > bottom)
        throw new Error(
          "Label text overflows its panel. Shorten the text or increase the label height. No text was clipped.",
        );
      const dx = center
        ? (width - selected.widthOfTextAtSize(line, size)) / 2
        : 0;
      scene.elements.push({
        kind: "text",
        x: x + dx,
        y,
        text: line,
        size,
        bold,
        colour,
      });
      y += size * 0.3;
    }
    return y;
  }
  if (draft)
    scene.elements.push({
      kind: "text",
      x: edge,
      y: 3.7,
      text: "ÉPREUVE / DRAFT - Informations et vérifications à compléter",
      size: 2.2,
      bold: true,
      colour: black,
    });
  if (nutritionImage) {
    const imageHeight = nutritionWidth * config.nutritionRatio;
    if (imageHeight > bottom - top)
      throw new Error(
        "Nutrition artwork does not fit. Increase label height; the panel was not reduced to unreadable text.",
      );
    scene.elements.push({
      kind: "rect",
      x: edge,
      y: top,
      width: nutritionWidth,
      height: imageHeight,
      colour: "#FFFFFF",
    });
    scene.elements.push({
      kind: "image",
      x: edge,
      y: top,
      width: nutritionWidth,
      height: imageHeight,
      data: nutritionImage,
    });
  }
  let iy = top;
  iy = addText("Ingrédients / Ingredients", infoX, iy, infoWidth, 3.1, true);
  if (config.ingredientsFr)
    iy = addText(config.ingredientsFr, infoX, iy + 1, infoWidth);
  if (
    product.ingredients.toLocaleLowerCase() !==
    config.ingredientsFr.toLocaleLowerCase()
  )
    iy = addText(
      product.ingredients,
      infoX,
      iy + (config.ingredientsFr ? 0.5 : 1),
      infoWidth,
    );
  if (config.storage)
    iy = addText(config.storage, infoX, iy + 2, infoWidth, 2.8);
  iy = addText(
    config.business || "Business name and address required",
    infoX,
    iy + 3,
    infoWidth,
    3.1,
  );
  if (config.origin) iy = addText(config.origin, infoX, iy + 1, infoWidth, 3.1);
  if (config.notes) addText(config.notes, infoX, iy + 1, infoWidth, 2.8);
  let fy = top + 1;
  fy = addText(
    config.brand || "YOUR HONEY BRAND",
    frontX,
    fy,
    frontWidth,
    4.2,
    true,
    accent,
    true,
  );
  if (config.theme === "honey") {
    const ruleWidth = Math.min(26, frontWidth * 0.65);
    scene.elements.push({
      kind: "rect",
      x: frontX + (frontWidth - ruleWidth) / 2,
      y: fy + 1.5,
      width: ruleWidth,
      height: 0.25,
      colour: accent,
    });
  }
  fy = addText(
    config.nameFr || product.name,
    frontX,
    fy + 3,
    frontWidth,
    5.2,
    true,
    black,
    true,
  );
  if (
    config.nameFr &&
    config.nameFr.toLocaleLowerCase() !== product.name.toLocaleLowerCase()
  )
    fy = addText(
      product.name,
      frontX,
      fy + 1,
      frontWidth,
      3.6,
      false,
      black,
      true,
    );
  if (config.grade)
    fy = addText(
      config.grade,
      frontX,
      fy + 2,
      frontWidth,
      declarationSize,
      false,
      black,
      true,
    );
  if (config.colour)
    fy = addText(
      config.colour,
      frontX,
      fy + 0.5,
      frontWidth,
      declarationSize,
      false,
      black,
      true,
    );
  addText(
    product.size,
    frontX,
    fy + 3,
    frontWidth,
    Math.max(5.3, declarationSize),
    true,
    black,
    true,
  );
  const symbolY = top + 1;
  const symbolX = barcodePanelX + (barcodePanelWidth - occupiedWidth) / 2;
  scene.elements.push({
    kind: "barcode",
    x: symbolX,
    y: symbolY,
    width: symbolWidth,
    height: symbolHeight,
    rotated,
    moduleMm,
    barHeight,
    text: product.gtin?.startsWith("0") ? product.gtin.slice(1) : code.text,
    bars: code.bars.map((bar) => ({
      x: bar.x * moduleMm,
      width: bar.width * moduleMm,
      height:
        barHeight +
        (product.gtin && [0, 2, 46, 48, 92, 94].includes(Math.round(bar.x - 11))
          ? 5 * moduleMm
          : 0),
    })),
  });
  let by = symbolY + occupiedHeight + 2;
  if (config.lot)
    by = addText(
      `Lot: ${config.lot}`,
      barcodePanelX,
      by,
      barcodePanelWidth,
      2.7,
    );
  if (config.bestBefore)
    addText(
      `Best before / Meilleur avant: ${config.bestBefore}`,
      barcodePanelX,
      by + 1,
      barcodePanelWidth,
      2.7,
    );
  if (!product.gtin)
    addText(
      "INTERNAL SKU ONLY",
      barcodePanelX,
      bottom - 3.5,
      barcodePanelWidth,
      2.3,
      true,
    );
  return scene;
}
export type LabelPaper = "letter" | "a4" | "roll";
export function planLabelPages(
  scene: Pick<LabelScene, "width" | "height">,
  paper: LabelPaper,
  copies: number,
) {
  if (!Number.isInteger(copies) || copies < 1 || copies > 100)
    throw new Error("Choose 1 to 100 labels.");
  if (paper === "roll") {
    const rotated = scene.width > scene.height;
    const width = rotated ? scene.height : scene.width;
    const height = rotated ? scene.width : scene.height;
    if (width > 104)
      throw new Error(
        "A 4-inch printer cannot print this cross-feed label size. Use sheet printing or a wider printer.",
      );
    return {
      width,
      height,
      perPage: 1,
      rotated,
      positions: [{ x: 0, y: 0 }],
      pages: copies,
    };
  }
  const width = paper === "a4" ? 210 : 215.9,
    height = paper === "a4" ? 297 : 279.4;
  const margin = 7,
    gap = 4;
  const columns = Math.floor((width - margin * 2 + gap) / (scene.width + gap));
  const rows = Math.floor((height - margin * 2 + gap) / (scene.height + gap));
  if (!columns || !rows)
    throw new Error(
      "The label does not fit this sheet at 100% size. Choose roll output or a smaller label.",
    );
  const perPage = columns * rows;
  const positions = Array.from({ length: perPage }, (_, i) => ({
    x: margin + (i % columns) * (scene.width + gap),
    y: margin + Math.floor(i / columns) * (scene.height + gap),
  }));
  return {
    width,
    height,
    perPage,
    rotated: false,
    positions,
    pages: Math.ceil(copies / perPage),
  };
}
