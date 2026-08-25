// Single-load live chat script layer. Guarantees one widget instance,
// never throws when a provider script is blocked or fails.

import { getLiveChatConfig, type ChatProvider } from "./live-chat-config";

export interface ChatContext {
  query?: string;
  intent?: string;
  page?: string;
  promo?: string;
  email?: string;
  /** Overrides the auto-detected page language ("en" | "fr"). */
  lang?: "en" | "fr";
}

export const TAKATAK_CHAT_EVENT = "takatak:open-support";

let loaded = false;
let failed = false;

function injectOnce(id: string, src: string, before?: () => void): void {
  if (typeof document === "undefined") return;
  if (document.getElementById(id)) return;
  try {
    before?.();
    const s = document.createElement("script");
    s.id = id;
    s.async = true;
    s.src = src;
    s.onerror = () => {
      failed = true;
    };
    document.head.appendChild(s);
  } catch {
    failed = true;
  }
}

/** Loads the configured external provider once. No-op for the built-in bubble. */
export function loadLiveChat(): ChatProvider {
  const cfg = getLiveChatConfig();
  if (!cfg.external || loaded || typeof window === "undefined") return cfg.provider;
  loaded = true;

  switch (cfg.provider) {
    case "tidio":
      injectOnce("takatak-tidio", `https://code.tidio.co/${cfg.tidioKey}.js`);
      break;
    case "crisp":
      injectOnce("takatak-crisp", "https://client.crisp.chat/l.js", () => {
        const w = window as unknown as Record<string, unknown>;
        w.$crisp = w.$crisp ?? [];
        w.CRISP_WEBSITE_ID = cfg.crispWebsiteId;
      });
      break;
    case "intercom":
      injectOnce("takatak-intercom", `https://widget.intercom.io/widget/${cfg.intercomAppId}`, () => {
        const w = window as unknown as Record<string, unknown>;
        w.intercomSettings = { app_id: cfg.intercomAppId };
      });
      break;
    case "hubspot":
      injectOnce("takatak-hubspot", `https://js.hs-scripts.com/${cfg.hubspotPortalId}.js`);
      break;
    default:
      break;
  }
  return cfg.provider;
}

function currentLang(ctx: ChatContext): "en" | "fr" {
  if (ctx.lang) return ctx.lang;
  if (typeof document === "undefined") return "en";
  return document.documentElement.lang?.toLowerCase().startsWith("fr") ? "fr" : "en";
}

function contextMessage(ctx: ChatContext): string {
  const fr = currentLang(ctx) === "fr";
  const bits = [
    ctx.query ? `${fr ? "Demande" : "Request"} : ${ctx.query}` : null,
    ctx.intent ? `${fr ? "Service détecté" : "Detected service"} : ${ctx.intent}` : null,
    ctx.page ? `${fr ? "Page" : "Page"} : ${ctx.page}` : null,
    ctx.promo ? `${fr ? "Promotion" : "Promo"} : ${ctx.promo}` : null,
    `${fr ? "Langue" : "Language"} : ${fr ? "fr-CA" : "en-CA"}`,
  ].filter(Boolean);
  return bits.join(" · ");
}

type ChatHostWindow = Window & {
  tidioChatApi?: {
    open: () => void;
    messageFromVisitor?: (message: string) => void;
  };
  $crisp?: unknown[];
  Intercom?: (command: string, message?: string) => void;
  HubSpotConversations?: {
    widget?: { open: () => void };
  };
};

/** Opens the active chat surface with prefilled context. Always safe to call. */
export function openLiveChat(ctx: ChatContext = {}): void {
  if (typeof window === "undefined") return;
  const provider = loadLiveChat();
  const message = contextMessage(ctx);
  const w = window as ChatHostWindow;

  try {
    if (!failed) {
      if (provider === "tidio" && w.tidioChatApi) {
        w.tidioChatApi.open();
        w.tidioChatApi.messageFromVisitor?.(message);
        return;
      }
      if (provider === "crisp" && Array.isArray(w.$crisp)) {
        w.$crisp.push(["do", "chat:open"]);
        w.$crisp.push(["set", "message:text", [message]]);
        if (ctx.email) w.$crisp.push(["set", "user:email", [ctx.email]]);
        return;
      }
      if (provider === "intercom" && typeof w.Intercom === "function") {
        w.Intercom("showNewMessage", message);
        return;
      }
      if (provider === "hubspot" && w.HubSpotConversations?.widget) {
        w.HubSpotConversations.widget.open();
        return;
      }
    }
  } catch {
    /* fall through to the built-in panel */
  }

  window.dispatchEvent(new CustomEvent(TAKATAK_CHAT_EVENT, { detail: { ...ctx, message } }));
}