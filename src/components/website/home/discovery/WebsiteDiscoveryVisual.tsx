import { Check, ShoppingCart } from "lucide-react";
import { SceneShell, SceneBar, SceneChip, SceneBrowser } from "./SceneShell";

/** Websites & Ecommerce: wireframe → header locks → mobile preview → CTA → confirmation. */
export function WebsiteDiscoveryVisual() {
  return (
    <SceneShell ratio="aspect-[16/9]">
      <div className="absolute inset-0 p-4">
        <SceneBrowser label="yourbusiness.ca" delay={0} className="h-full">
          <div className="p-2.5">
            <div className="flex items-center gap-1.5">
              <SceneBar delay={160} tone="primary" className="h-1.5 w-8" />
              <SceneBar delay={220} className="h-1.5 w-6" />
              <SceneBar delay={260} className="h-1.5 w-6" />
              <SceneBar delay={300} tone="primary" className="ml-auto h-3 w-10" />
            </div>
            <div className="mt-2.5 grid grid-cols-[1.4fr_1fr] gap-2">
              <div>
                <SceneBar delay={380} tone="strong" className="h-2.5 w-[85%]" />
                <SceneBar delay={430} tone="strong" className="mt-1.5 h-2.5 w-[60%]" />
                <SceneBar delay={480} className="mt-2 h-1.5 w-[92%]" />
                <SceneBar delay={520} className="mt-1 h-1.5 w-[70%]" />
                <span
                  style={{ animationDelay: "900ms" }}
                  className="tk-step mt-2.5 inline-flex items-center gap-1 rounded bg-primary px-2 py-1 text-[9px] font-semibold text-primary-foreground"
                >
                  <ShoppingCart size={9} /> Checkout
                </span>
              </div>
              <div className="grid gap-1.5">
                <SceneBar delay={560} className="h-6 w-full rounded-md" />
                <SceneBar delay={620} className="h-6 w-full rounded-md" />
              </div>
            </div>
          </div>
        </SceneBrowser>
      </div>

      {/* Mobile preview slides in over the desktop frame */}
      <div
        style={{ animationDelay: "700ms" }}
        className="tk-step absolute bottom-3 right-4 w-14 overflow-hidden rounded-md border border-border bg-card shadow-lg"
      >
        <div className="h-1 w-full bg-secondary" />
        <div className="space-y-1 p-1.5">
          <SceneBar delay={760} tone="primary" className="h-1 w-6" />
          <SceneBar delay={800} className="h-1 w-full" />
          <SceneBar delay={840} className="h-1 w-[70%]" />
          <SceneBar delay={880} tone="primary" className="h-2 w-full rounded" />
        </div>
      </div>

      <SceneChip delay={1150} className="absolute left-4 top-3 text-primary">
        <Check size={9} /> Order confirmed
      </SceneChip>
    </SceneShell>
  );
}