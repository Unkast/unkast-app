import { notFound } from "next/navigation";
import UiShowcase from "./UiShowcase";

// Vitrine des briques UI — dev uniquement, non liee dans la navigation.
export default function DevUiPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return <UiShowcase />;
}
