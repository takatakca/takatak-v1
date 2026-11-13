// Display accent for the homepage below the hero: an editorial serif italic for
// the quiet second half of headlines ("Ten services. *One team for all of them.*").
import localFont from "next/font/local";

export const serifAccent = localFont({
  src: [
    { path: "../../../node_modules/@fontsource/instrument-serif/files/instrument-serif-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../../../node_modules/@fontsource/instrument-serif/files/instrument-serif-latin-400-italic.woff2", weight: "400", style: "italic" },
  ],
  adjustFontFallback: "Times New Roman",
  display: "swap",
  variable: "--font-serif",
  // Used below the hero only: load it when a heading needs it, not with the first paint.
  preload: false,
});
