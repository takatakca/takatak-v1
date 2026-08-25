"use client";

import NextLink from "next/link";
import {
  usePathname,
  useRouter,
} from "next/navigation";
import type { ComponentProps, ReactNode } from "react";

type SearchValues = Record<string, unknown>;

function mapSignup(path: string): string {
  if (path === "/signup" || path.startsWith("/signup?")) {
    return path.replace("/signup", "/register");
  }

  return path;
}

export function buildHref(
  to: string,
  params?: Record<string, string | number>,
  search?: SearchValues,
  hash?: string,
): string {
  let href = mapSignup(to);

  if (params) {
    href = href.replace(/\$(\w+)/g, (_, key: string) =>
      encodeURIComponent(String(params[key] ?? "")),
    );
  }

  if (search) {
    const query = new URLSearchParams();

    for (const [key, value] of Object.entries(search)) {
      if (value === undefined || value === null || value === "") {
        continue;
      }

      query.set(key, String(value));
    }

    const serialized = query.toString();

    if (serialized) {
      href += href.includes("?") ? `&${serialized}` : `?${serialized}`;
    }
  }

  if (hash) {
    href += `#${String(hash).replace(/^#/, "")}`;
  }

  return href;
}

type WebsiteLinkProps = Omit<ComponentProps<typeof NextLink>, "href"> & {
  to?: string;
  href?: ComponentProps<typeof NextLink>["href"];
  params?: Record<string, string | number>;
  search?: SearchValues;
  hash?: string;
  activeProps?: unknown;
  children?: ReactNode;
};

export function Link({
  to,
  href,
  params,
  search,
  hash,
  activeProps: _activeProps,
  children,
  ...rest
}: WebsiteLinkProps) {
  const resolved = href ?? buildHref(String(to ?? "/"), params, search, hash);

  return (
    <NextLink href={resolved} {...rest}>
      {children}
    </NextLink>
  );
}

export function useNavigate() {
  const router = useRouter();

  return (
    options:
      | string
      | {
          to: string;
          params?: Record<string, string | number>;
          search?: SearchValues;
          hash?: string;
        },
  ) => {
    if (typeof options === "string") {
      router.push(mapSignup(options));
      return;
    }

    router.push(buildHref(options.to, options.params, options.search, options.hash));
  };
}

export function useLocation() {
  const pathname = usePathname();

  return { pathname };
}

export function useRouterState<T>({
  select,
}: {
  select: (state: { location: { pathname: string } }) => T;
}): T {
  const pathname = usePathname();

  return select({ location: { pathname } });
}
