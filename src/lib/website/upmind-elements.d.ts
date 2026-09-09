import type { HTMLAttributes } from "react";

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "upm-dac": HTMLAttributes<HTMLElement> & {
        "order-config-url"?: string;
        "currency-code"?: string;
        "client-id"?: string;
      };
      "upm-widget": HTMLAttributes<HTMLElement> & {
        as?: string;
        locale?: string;
        bind?: string;
        "client-id"?: string;
      };
    }
  }
}

export {};
