import type { Metadata } from "next";

import { FoodHubPage } from "@/components/website/foodhub/FoodHubPage";

export const metadata: Metadata = {
  title: "TAKATAK Food Hub · Une tablette pour toutes vos commandes",
  description:
    "Uber Eats, DoorDash, SkipTheDishes, Too Good To Go et Clover sur un seul écran de cuisine, en français et en anglais : alertes qui ne se perdent pas, NIP du gérant, veille 24/7, menus partout, argent rapproché.",
  alternates: { canonical: "/foodhub" },
};

export default function FoodHubRoute() {
  return <FoodHubPage />;
}
