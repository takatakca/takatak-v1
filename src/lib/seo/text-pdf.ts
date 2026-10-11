// One-page text PDF (Helvetica, WinAnsi) so a report can be downloaded without a PDF library.

const WINANSI: Record<string, string> = {
  "é": "\\351",
  "è": "\\350",
  "ê": "\\352",
  "ë": "\\353",
  "à": "\\340",
  "â": "\\342",
  "á": "\\341",
  "ç": "\\347",
  "ô": "\\364",
  "ö": "\\366",
  "î": "\\356",
  "ï": "\\357",
  "ù": "\\371",
  "û": "\\373",
  "ü": "\\374",
  "œ": "oe",
  "Œ": "OE",
  "’": "'",
  "«": "\\253",
  "»": "\\273",
  "–": "-",
  "—": "-",
};

export function pdfEscape(text: string): string {
  let out = "";
  for (const ch of text) {
    if (WINANSI[ch]) {
      out += WINANSI[ch];
      continue;
    }
    if (ch === "\\") out += "\\\\";
    else if (ch === "(") out += "\\(";
    else if (ch === ")") out += "\\)";
    else if (ch.charCodeAt(0) >= 32 && ch.charCodeAt(0) <= 126) out += ch;
    else out += "?";
  }
  return out;
}

export function textPdf(lines: string[]): Buffer {
  const commands = ["BT", "/F1 11 Tf", "50 760 Td", "14 TL"];
  for (const line of lines.slice(0, 48)) {
    commands.push(`(${pdfEscape(line)}) Tj`, "T*");
  }
  commands.push("ET");
  const stream = commands.join("\n");
  const objects = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n",
    "2 0 obj << /Type /Pages /Count 1 /Kids [3 0 R] >> endobj\n",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj\n",
    `4 0 obj << /Length ${Buffer.byteLength(stream)} >> stream\n${stream}\nendstream\nendobj\n`,
    "5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >> endobj\n",
  ];
  let body = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (const object of objects) {
    offsets.push(Buffer.byteLength(body));
    body += object;
  }
  const xrefAt = Buffer.byteLength(body);
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) xref += `${String(offset).padStart(10, "0")} 00000 n \n`;
  body += xref;
  body += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF`;
  return Buffer.from(body, "latin1");
}
