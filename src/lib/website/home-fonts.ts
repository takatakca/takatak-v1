// Display accent for the homepage below the hero: an editorial serif italic for
// the quiet second half of headlines ("Ten services. *One team for all of them.*").
import { Instrument_Serif } from "next/font/google";

export const serifAccent = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-serif",
});
