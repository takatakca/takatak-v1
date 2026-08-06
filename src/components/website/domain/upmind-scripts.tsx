"use client";

import {
  useEffect,
  useState,
} from "react";

import {
  UPMIND_DAC_SCRIPT_URL,
  UPMIND_WIDGET_SCRIPT_URL,
} from "@/lib/website/upmind-config";

type Status =
  | "idle"
  | "loading"
  | "ready"
  | "error";

let status: Status = "idle";

let loadPromise:
  | Promise<void>
  | null = null;

const subscribers =
  new Set<(next: Status) => void>();

function notify(next: Status): void {
  status = next;

  for (const subscriber of subscribers) {
    subscriber(next);
  }
}

function isElementDefined(
  tag: string,
): boolean {
  try {
    return (
      typeof customElements !==
        "undefined" &&
      Boolean(customElements.get(tag))
    );
  } catch {
    return false;
  }
}

function injectScript(
  src: string,
  isModule = false,
): Promise<void> {
  return new Promise(
    (resolve, reject) => {
      const existing =
        document.querySelector<HTMLScriptElement>(
          `script[data-upmind-src="${src}"]`,
        );

      if (existing) {
        if (
          existing.dataset
            .upmindLoaded === "1"
        ) {
          resolve();
          return;
        }

        existing.addEventListener(
          "load",
          () => resolve(),
          {
            once: true,
          },
        );

        existing.addEventListener(
          "error",
          () =>
            reject(
              new Error(
                `load_failed:${src}`,
              ),
            ),
          {
            once: true,
          },
        );

        return;
      }

      const script =
        document.createElement(
          "script",
        );

      if (isModule) {
        script.type = "module";
      }

      script.src = src;
      script.async = true;
      script.dataset.upmindSrc = src;

      script.onload = () => {
        script.dataset.upmindLoaded =
          "1";

        resolve();
      };

      script.onerror = () =>
        reject(
          new Error(
            `load_failed:${src}`,
          ),
        );

      document.body.appendChild(
        script,
      );
    },
  );
}

function ensureLoaded(): Promise<void> {
  if (status === "ready") {
    return Promise.resolve();
  }

  if (
    isElementDefined("upm-dac") &&
    isElementDefined("upm-widget")
  ) {
    notify("ready");
    return Promise.resolve();
  }

  if (loadPromise) {
    return loadPromise;
  }

  notify("loading");

  const tasks: Promise<void>[] = [];

  if (
    !isElementDefined("upm-widget")
  ) {
    tasks.push(
      injectScript(
        UPMIND_WIDGET_SCRIPT_URL,
        true,
      ),
    );
  }

  if (
    !isElementDefined("upm-dac")
  ) {
    tasks.push(
      injectScript(
        UPMIND_DAC_SCRIPT_URL,
      ),
    );
  }

  loadPromise = Promise.all(tasks)
    .then(
      () =>
        new Promise<void>(
          (resolve) => {
            const start = Date.now();

            function tick(): void {
              if (
                isElementDefined(
                  "upm-dac",
                ) &&
                isElementDefined(
                  "upm-widget",
                )
              ) {
                resolve();
                return;
              }

              if (
                Date.now() - start >
                5000
              ) {
                resolve();
                return;
              }

              window.setTimeout(
                tick,
                100,
              );
            }

            tick();
          },
        ),
    )
    .then(() => {
      notify("ready");
    })
    .catch((error) => {
      notify("error");
      loadPromise = null;

      throw error;
    });

  return loadPromise;
}

export function UpmindScripts({
  onReady,
  onError,
}: {
  onReady?: () => void;
  onError?: (error: Error) => void;
}) {
  const [, setLocal] =
    useState<Status>(status);

  useEffect(() => {
    let cancelled = false;

    function subscriber(
      next: Status,
    ): void {
      if (cancelled) {
        return;
      }

      setLocal(next);

      if (next === "ready") {
        onReady?.();
      }
    }

    subscribers.add(subscriber);

    if (status === "ready") {
      onReady?.();
    } else {
      ensureLoaded().catch(
        (error: unknown) => {
          if (!cancelled) {
            onError?.(
              error instanceof Error
                ? error
                : new Error(
                    "Upmind failed to load.",
                  ),
            );
          }
        },
      );
    }

    return () => {
      cancelled = true;

      subscribers.delete(
        subscriber,
      );
    };
  }, [onError, onReady]);

  return null;
}