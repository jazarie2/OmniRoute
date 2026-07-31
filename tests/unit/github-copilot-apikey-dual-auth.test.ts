/**
 * GitHub Copilot dual-auth (BYOK token) support.
 *
 * The `github` provider is OAuth-primary (device flow), but users who already
 * hold a Copilot-entitled GitHub OAuth user token (gho_/ghu_ — e.g. from
 * `gh auth token` or the VS Code Copilot login) must be able to paste it as an
 * API key instead of re-running the device flow. Mirrors the clinepass
 * dual-auth precedent:
 *
 *  1. `isManagedProviderConnectionId("github")` admits the provider through
 *     POST /api/providers' API-key gate (DUAL_AUTH_APIKEY_PROVIDER_IDS)…
 *  2. …WITHOUT flipping the provider to apikey-primary in the dashboard
 *     (it must stay OUT of FREE_APIKEY_PROVIDER_IDS).
 *  3. GithubExecutor treats `credentials.apiKey` as the GitHub access token:
 *     `refreshCredentials()` mints the short-lived Copilot token from it, and
 *     `buildHeaders()` falls back to it when no Copilot token exists yet.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { GithubExecutor } from "../../open-sse/executors/github.ts";
import { isManagedProviderConnectionId } from "@/lib/providers/catalog";
import { supportsApiKeyOnFreeProvider } from "@/shared/constants/providers";

test("github is admitted through the managed API-key connection gate", () => {
  assert.equal(isManagedProviderConnectionId("github"), true);
});

test("github stays OAuth-primary (not in FREE_APIKEY_PROVIDER_IDS)", () => {
  assert.equal(supportsApiKeyOnFreeProvider("github"), false);
});

test("buildHeaders falls back to apiKey when no copilotToken/accessToken", () => {
  const executor = new GithubExecutor();
  const headers = executor.buildHeaders({ apiKey: "gho_test123" }, false);
  assert.equal(headers.Authorization, "Bearer gho_test123");
});

test("buildHeaders still prefers copilotToken over apiKey", () => {
  const executor = new GithubExecutor();
  const headers = executor.buildHeaders(
    { apiKey: "gho_test123", providerSpecificData: { copilotToken: "copilot-tok" } },
    false
  );
  assert.equal(headers.Authorization, "Bearer copilot-tok");
});

test("refreshCredentials mints the Copilot token from apiKey when accessToken is absent", async () => {
  const executor = new GithubExecutor();
  const originalFetch = globalThis.fetch;
  let seenAuth: string | null = null;
  globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
    const headers = (init?.headers || {}) as Record<string, string>;
    seenAuth = headers.Authorization || headers.authorization || null;
    return {
      ok: true,
      json: async () => ({ token: "minted-copilot-tok", expires_at: "2099-01-01T00:00:00Z" }),
    };
  }) as unknown as typeof fetch;
  try {
    const result = await executor.refreshCredentials({ apiKey: "gho_test123" }, null);
    assert.equal(seenAuth, "token gho_test123");
    assert.equal(result?.copilotToken, "minted-copilot-tok");
    assert.equal(result?.copilotTokenExpiresAt, "2099-01-01T00:00:00Z");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
