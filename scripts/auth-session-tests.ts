import { createSessionForEmail } from "../src/lib/auth/otp/session";
import { normalizeEmail } from "../src/lib/auth/registration-validation";

let failed = 0;

function assert(name: string, ok: boolean, detail = "") {
  if (ok) {
    console.log(`  PASS ${name}`);
    return;
  }
  failed += 1;
  console.error(`  FAIL ${name}${detail ? ` ${detail}` : ""}`);
}

const AUTH_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const EMAIL = "owner@takatak.ca";

type AdminUser = { id: string; email?: string | null };

function mockAdmin(options: {
  user?: AdminUser | null;
  lookupError?: string;
  lookupThrow?: boolean;
  confirmError?: string;
  confirmThrow?: boolean;
  linkError?: string;
  linkThrow?: boolean;
  hashedToken?: string | null;
}) {
  return {
    auth: {
      admin: {
        getUserById: async () => {
          if (options.lookupThrow) throw new Error("lookup exploded");
          return {
            data: { user: options.user ?? null },
            error: options.lookupError ? { message: options.lookupError } : null,
          };
        },
        updateUserById: async () => {
          if (options.confirmThrow) throw new Error("confirm exploded");
          return {
            error: options.confirmError ? { message: options.confirmError } : null,
          };
        },
        generateLink: async () => {
          if (options.linkThrow) throw new Error("link exploded");
          return {
            data: {
              properties: { hashed_token: options.hashedToken ?? "hashed" },
            },
            error: options.linkError ? { message: options.linkError } : null,
          };
        },
      },
    },
  };
}

function mockBrowser(options: {
  signOutError?: string;
  signOutThrow?: boolean;
  verifyError?: string;
  verifyThrow?: boolean;
  user?: { id: string; email?: string | null } | null;
  session?: { access_token?: string; user?: { id: string } } | null;
}) {
  return (
    _url?: string,
    _anonKey?: string,
    _writes?: unknown,
    _existing?: unknown,
  ) => ({
    auth: {
      signOut: async () => {
        if (options.signOutThrow) throw new Error("signout exploded");
        return {
          error: options.signOutError ? { message: options.signOutError } : null,
        };
      },
      verifyOtp: async () => {
        if (options.verifyThrow) throw new Error("verify exploded");
        return {
          data: {
            user: options.user ?? { id: AUTH_ID, email: EMAIL },
            session: options.session ?? {
              access_token: "token",
              user: { id: AUTH_ID },
            },
          },
          error: options.verifyError ? { message: options.verifyError } : null,
        };
      },
    },
  });
}

async function main() {
  console.log("[auth-session] controlled Supabase session failures");

  const env = { url: "https://example.supabase.co", anonKey: "anon" };

  {
    const result = await createSessionForEmail(EMAIL, AUTH_ID, [], {
      getEnv: () => null,
      getAdmin: () => mockAdmin({ user: { id: AUTH_ID, email: EMAIL } }),
    });
    assert("missing configuration is controlled", result.ok === false && result.stage === "configuration");
    if (!result.ok) {
      assert("no raw provider error", result.message === "Unable to start a session. Please try again.");
    }
  }

  {
    const result = await createSessionForEmail(EMAIL, "", [], {
      getEnv: () => env,
      getAdmin: () => mockAdmin({ user: { id: AUTH_ID, email: EMAIL } }),
    });
    assert("missing authUserId rejected", !result.ok && result.stage === "auth_user_validation");
  }

  {
    const result = await createSessionForEmail(EMAIL, "not-a-uuid", [], {
      getEnv: () => env,
      getAdmin: () => mockAdmin({ user: { id: AUTH_ID, email: EMAIL } }),
    });
    assert("invalid authUserId rejected", !result.ok && result.stage === "auth_user_validation");
  }

  {
    const result = await createSessionForEmail(EMAIL, AUTH_ID, [], {
      getEnv: () => env,
      getAdmin: () => mockAdmin({ user: null }),
    });
    assert("missing Auth user rejected", !result.ok && result.stage === "auth_user_validation");
  }

  {
    const result = await createSessionForEmail(EMAIL, AUTH_ID, [], {
      getEnv: () => env,
      getAdmin: () =>
        mockAdmin({
          user: { id: AUTH_ID, email: "other@takatak.ca" },
        }),
    });
    assert("email mismatch rejected", !result.ok && result.stage === "auth_user_validation");
  }

  {
    const result = await createSessionForEmail(EMAIL, AUTH_ID, [], {
      getEnv: () => env,
      getAdmin: () =>
        mockAdmin({
          user: { id: AUTH_ID, email: EMAIL },
          confirmError: "cannot confirm",
        }),
    });
    assert("updateUserById API error controlled", !result.ok && result.stage === "confirm_email");
  }

  {
    const result = await createSessionForEmail(EMAIL, AUTH_ID, [], {
      getEnv: () => env,
      getAdmin: () =>
        mockAdmin({
          user: { id: AUTH_ID, email: EMAIL },
          confirmThrow: true,
        }),
    });
    assert("updateUserById throw controlled", !result.ok && result.stage === "confirm_email");
  }

  {
    const result = await createSessionForEmail(EMAIL, AUTH_ID, [], {
      getEnv: () => env,
      getAdmin: () =>
        mockAdmin({
          user: { id: AUTH_ID, email: EMAIL },
          linkError: "cannot link",
        }),
    });
    assert("generateLink API error controlled", !result.ok && result.stage === "generate_link");
  }

  {
    const result = await createSessionForEmail(EMAIL, AUTH_ID, [], {
      getEnv: () => env,
      getAdmin: () =>
        mockAdmin({
          user: { id: AUTH_ID, email: EMAIL },
          linkThrow: true,
        }),
    });
    assert("generateLink throw controlled", !result.ok && result.stage === "generate_link");
  }

  {
    const result = await createSessionForEmail(EMAIL, AUTH_ID, [], {
      getEnv: () => env,
      getAdmin: () => mockAdmin({ user: { id: AUTH_ID, email: EMAIL } }),
      createBrowserClient: mockBrowser({ signOutError: "cannot sign out" }) as never,
    });
    assert("local signOut API error controlled", !result.ok && result.stage === "local_signout");
  }

  {
    const result = await createSessionForEmail(EMAIL, AUTH_ID, [], {
      getEnv: () => env,
      getAdmin: () => mockAdmin({ user: { id: AUTH_ID, email: EMAIL } }),
      createBrowserClient: mockBrowser({ signOutThrow: true }) as never,
    });
    assert("local signOut throw controlled", !result.ok && result.stage === "local_signout");
  }

  {
    const result = await createSessionForEmail(EMAIL, AUTH_ID, [], {
      getEnv: () => env,
      getAdmin: () => mockAdmin({ user: { id: AUTH_ID, email: EMAIL } }),
      createBrowserClient: mockBrowser({ verifyError: "bad token" }) as never,
    });
    assert("verifyOtp API error controlled", !result.ok && result.stage === "verify_magiclink");
  }

  {
    const result = await createSessionForEmail(EMAIL, AUTH_ID, [], {
      getEnv: () => env,
      getAdmin: () => mockAdmin({ user: { id: AUTH_ID, email: EMAIL } }),
      createBrowserClient: mockBrowser({ verifyThrow: true }) as never,
    });
    assert("verifyOtp throw controlled", !result.ok && result.stage === "verify_magiclink");
  }

  {
    const result = await createSessionForEmail(EMAIL, AUTH_ID, [], {
      getEnv: () => env,
      getAdmin: () => mockAdmin({ user: { id: AUTH_ID, email: EMAIL } }),
      createBrowserClient: mockBrowser({
        user: { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", email: EMAIL },
        session: { access_token: "token", user: { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" } },
      }) as never,
    });
    assert("returned user mismatch rejected", !result.ok && result.stage === "session_validation");
  }

  {
    const writes: Array<{ name: string }> = [];
    const result = await createSessionForEmail(
      EMAIL,
      AUTH_ID,
      [{ name: "sb-takatak-auth-token.0", value: "stale" }],
      {
        getEnv: () => env,
        getAdmin: () => mockAdmin({ user: { id: AUTH_ID, email: EMAIL } }),
        createBrowserClient: (url, anon, cookieWrites) => {
          cookieWrites.push({ name: "sb-takatak-auth-token", value: "fresh" });
          return mockBrowser({})(url, anon, cookieWrites, []);
        },
      },
    );
    assert("happy path returns cookies", result.ok === true);
    if (result.ok) {
      writes.push(...result.cookies);
      assert(
        "chunked stale cookies are expired",
        result.cookies.some((cookie) => cookie.name.endsWith(".0") && cookie.value === ""),
      );
      assert(
        "previous workspace cookies are cleared",
        result.cookies.some((cookie) => cookie.name === "takatak_active_client" && cookie.value === "") &&
          result.cookies.some((cookie) => cookie.name === "takatak_active_brand" && cookie.value === ""),
      );
      assert(
        "identity cookie is bound to the authenticated user",
        result.cookies.some(
          (cookie) =>
            cookie.name === "takatak_auth_identity" && cookie.value === AUTH_ID,
        ),
      );
      assert(
        "session token is not a JSON field",
        !JSON.stringify({ ok: true, message: "User verified successfully" }).includes("fresh"),
      );
    }
  }

  assert(
    "email normalization is case-insensitive",
    normalizeEmail(" Owner@TAKATAK.CA ") === "owner@takatak.ca",
  );

  if (failed > 0) {
    process.exit(1);
  }
}

void main();
