"use client";

import {
  createContext,
  useCallback,
  useContext,
  type ReactNode,
} from "react";

interface WebsiteAuthUser {
  email?: string | null;
  firstName?: string;
  lastName?: string;
  phone?: string;
  upmindClientId?: string;
}

interface WebsiteAuthValue {
  isAuthenticated: boolean;
  user: WebsiteAuthUser | null;
  logout: () => void;
}

const WebsiteAuthContext = createContext<WebsiteAuthValue>({
  isAuthenticated: false,
  user: null,
  logout: () => undefined,
});

export function WebsiteAuthProvider({
  isAuthenticated,
  email = null,
  children,
}: {
  isAuthenticated: boolean;
  email?: string | null;
  children: ReactNode;
}) {
  const logout = useCallback(() => {
    const form = document.createElement("form");
    form.method = "post";
    form.action = "/auth/signout";
    document.body.appendChild(form);
    form.submit();
  }, []);

  return (
    <WebsiteAuthContext.Provider
      value={{
        isAuthenticated,
        user: email ? { email } : null,
        logout,
      }}
    >
      {children}
    </WebsiteAuthContext.Provider>
  );
}

export function useAuth(): WebsiteAuthValue {
  return useContext(WebsiteAuthContext);
}
