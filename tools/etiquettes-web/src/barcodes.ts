export type Bar = { x: number; width: number };
const characters = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ-. $/+%*";
const patterns = [
  0x034, 0x121, 0x061, 0x160, 0x031, 0x130, 0x070, 0x025, 0x124, 0x064, 0x109,
  0x049, 0x148, 0x019, 0x118, 0x058, 0x00d, 0x10c, 0x04c, 0x01c, 0x103, 0x043,
  0x142, 0x013, 0x112, 0x052, 0x007, 0x106, 0x046, 0x016, 0x181, 0x0c1, 0x1c0,
  0x091, 0x190, 0x0d0, 0x085, 0x184, 0x0c4, 0x0a8, 0x0a2, 0x08a, 0x02a, 0x094,
];
export function code39(value: string): {
  bars: Bar[];
  width: number;
  text: string;
} {
  if (!/^[A-Z0-9 -]{1,40}$/.test(value))
    throw new Error("Unsupported internal SKU");
  let x = 20;
  const bars: Bar[] = [];
  for (const char of `*${value}*`) {
    const pattern = patterns[characters.indexOf(char)];
    for (let i = 0; i < 9; i++) {
      const width = pattern & (1 << (8 - i)) ? 3 : 1;
      if (i % 2 === 0) bars.push({ x, width });
      x += width;
    }
    x++;
  }
  return { bars, width: x + 20, text: value };
}
const left = [
  "0001101",
  "0011001",
  "0010011",
  "0111101",
  "0100011",
  "0110001",
  "0101111",
  "0111011",
  "0110111",
  "0001011",
];
const even = [
  "0100111",
  "0110011",
  "0011011",
  "0100001",
  "0011101",
  "0111001",
  "0000101",
  "0010001",
  "0001001",
  "0010111",
];
const parity = [
  "LLLLLL",
  "LLGLGG",
  "LLGGLG",
  "LLGGGL",
  "LGLLGG",
  "LGGLLG",
  "LGGGLL",
  "LGLGLG",
  "LGLGGL",
  "LGGLGL",
];
export function ean13(value: string): {
  bars: Bar[];
  width: number;
  text: string;
} {
  const s = value.padStart(13, "0");
  if (!/^\d{13}$/.test(s)) throw new Error("Unsupported retail barcode");
  let bits = "101";
  for (let i = 1; i < 7; i++)
    bits += (parity[Number(s[0])][i - 1] === "L" ? left : even)[Number(s[i])];
  bits += "01010";
  for (let i = 7; i < 13; i++)
    bits += left[Number(s[i])].replace(/[01]/g, (bit) =>
      bit === "0" ? "1" : "0",
    );
  bits += "101";
  return {
    bars: [...bits].flatMap((bit, i) =>
      bit === "1" ? [{ x: i + 11, width: 1 }] : [],
    ),
    width: 117,
    text: s,
  };
}
export function csvCell(value: string | number): string {
  const s = String(value);
  return (
    '"' + (/^[\s]*[=+\-@]/.test(s) ? "'" + s : s).replace(/"/g, '""') + '"'
  );
}
