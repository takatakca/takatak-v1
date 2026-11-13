import { PDFDocument, StandardFonts, degrees, rgb } from "pdf-lib";
import {
  POINTS_PER_MM as P,
  planLabelPages,
  type LabelPaper,
  type LabelScene,
} from "@/lib/inventory/label-layout";
function colour(hex: string) {
  return rgb(
    parseInt(hex.slice(1, 3), 16) / 255,
    parseInt(hex.slice(3, 5), 16) / 255,
    parseInt(hex.slice(5, 7), 16) / 255,
  );
}
export async function labelPdf(
  scene: LabelScene,
  paper: LabelPaper,
  copies: number,
): Promise<Uint8Array> {
  const layout = planLabelPages(scene, paper, copies);
  const artwork = await PDFDocument.create();
  const normal = await artwork.embedFont(StandardFonts.Helvetica);
  const bold = await artwork.embedFont(StandardFonts.HelveticaBold);
  const page = artwork.addPage([scene.width * P, scene.height * P]);
  page.drawRectangle({
    x: 0,
    y: 0,
    width: scene.width * P,
    height: scene.height * P,
    color: rgb(1, 1, 1),
  });
  for (const element of scene.elements) {
    if (element.kind === "image") {
      const image = element.data.startsWith("data:image/png")
        ? await artwork.embedPng(element.data)
        : await artwork.embedJpg(element.data);
      page.drawImage(image, {
        x: element.x * P,
        y: (scene.height - element.y - element.height) * P,
        width: element.width * P,
        height: element.height * P,
      });
    }
    if (element.kind === "rect")
      page.drawRectangle({
        x: element.x * P,
        y: (scene.height - element.y - element.height) * P,
        width: element.width * P,
        height: element.height * P,
        color: colour(element.colour),
      });
    if (element.kind === "text")
      page.drawText(element.text.normalize("NFC"), {
        x: element.x * P,
        y: (scene.height - element.y) * P,
        size: element.size * P,
        font: element.bold ? bold : normal,
        color: colour(element.colour),
      });
    if (element.kind === "barcode") {
      for (const bar of element.bars) {
        const x = element.rotated
          ? element.x + element.height - bar.height
          : element.x + bar.x;
        const y = element.rotated ? element.y + bar.x : element.y;
        const width = element.rotated ? bar.height : bar.width;
        const height = element.rotated ? bar.width : bar.height;
        page.drawRectangle({
          x: x * P,
          y: (scene.height - y - height) * P,
          width: width * P,
          height: height * P,
          color: rgb(0, 0, 0),
        });
      }
      const textSize = 3;
      const tx =
        (element.width - normal.widthOfTextAtSize(element.text, textSize)) / 2;
      const ty = element.barHeight + 4.5;
      page.drawText(element.text, {
        x:
          (element.rotated ? element.x + element.height - ty : element.x + tx) *
          P,
        y:
          (scene.height - (element.rotated ? element.y + tx : element.y + ty)) *
          P,
        size: textSize * P,
        font: normal,
        rotate: degrees(element.rotated ? -90 : 0),
        color: rgb(0, 0, 0),
      });
    }
  }
  const doc = await PDFDocument.create();
  doc.setTitle("TAKATAK product labels");
  doc.setSubject("Print at actual size / 100%. Do not fit to page.");
  doc.setProducer("TAKATAK Inventory - owned label renderer");
  const [embedded] = await doc.embedPdf(await artwork.save(), [0]);
  let remaining = copies;
  for (let i = 0; i < layout.pages; i++) {
    const sheet = doc.addPage([layout.width * P, layout.height * P]);
    for (const position of layout.positions) {
      if (!remaining--) break;
      if (layout.rotated)
        sheet.drawPage(embedded, {
          x: scene.height * P,
          y: 0,
          rotate: degrees(90),
        });
      else
        sheet.drawPage(embedded, {
          x: position.x * P,
          y: (layout.height - position.y - scene.height) * P,
        });
      if (paper !== "roll") {
        // Crop marks are outside the label, including its barcode quiet zones.
        for (const [cx, cy] of [
          [position.x, position.y],
          [position.x + scene.width, position.y],
          [position.x, position.y + scene.height],
          [position.x + scene.width, position.y + scene.height],
        ]) {
          const left = cx === position.x,
            top = cy === position.y;
          sheet.drawLine({
            start: {
              x: (cx + (left ? -2 : 0.5)) * P,
              y: (layout.height - cy) * P,
            },
            end: {
              x: (cx + (left ? -0.5 : 2)) * P,
              y: (layout.height - cy) * P,
            },
            thickness: 0.25,
            color: rgb(0.5, 0.5, 0.5),
          });
          sheet.drawLine({
            start: {
              x: cx * P,
              y: (layout.height - cy - (top ? -2 : 0.5)) * P,
            },
            end: { x: cx * P, y: (layout.height - cy - (top ? -0.5 : 2)) * P },
            thickness: 0.25,
            color: rgb(0.5, 0.5, 0.5),
          });
        }
      }
    }
  }
  return doc.save();
}
