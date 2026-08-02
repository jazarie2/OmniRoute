/**
 * `github-copilot` — API-key twin of the OAuth `github` provider.
 *
 * Users paste a Copilot-entitled GitHub OAuth user token (gho_/ghu_ — e.g.
 * from `gh auth token` or the VS Code Copilot sign-in) as a plain API key;
 * one connection per token gives clean multi-account support. The twin is
 * spread from the github registry entry so endpoints and the model catalog
 * can never drift, and GithubExecutor mints the short-lived Copilot bearer
 * from `apiKey` exactly like the device flow's accessToken.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { GithubExecutor } from "../../open-sse/executors/github.ts";
import { getExecutor } from "../../open-sse/executors/index.ts";
import { REGISTRY } from "@omniroute/open-sse/config/providerRegistry.ts";
import { isManagedProviderConnectionId } from "@/lib/providers/catalog";

test("registry: github-copilot is an apikey twin sharing github's catalog", () => {
  const twin = REGISTRY["github-copilot"];
  const github = REGISTRY["github"];
  assert.ok(twin, "github-copilot registry entry missing");
  assert.equal(twin.id, "github-copilot");
  assert.equal(twin.alias, "ghcp");
  assert.equal(twin.authType, "apikey");
  assert.equal(twin.oauth, undefined, "apikey twin must not carry an oauth block");
  assert.equal(twin.baseUrl, github.baseUrl);
  assert.equal(twin.responsesBaseUrl, github.responsesBaseUrl);
  assert.equal(twin.messagesUrl, github.messagesUrl);
  assert.equal(twin.models, github.models, "model catalog must be shared, not forked");
});

test("catalog: github-copilot is a managed API-key provider connection", () => {
  assert.equal(isManagedProviderConnectionId("github-copilot"), true);
});

test("executor: github-copilot resolves to GithubExecutor with its own provider id", () => {
  const executor = getExecutor("github-copilot");
  assert.ok(executor instanceof GithubExecutor);
  assert.equal(executor.getProvider(), "github-copilot");
  // The OAuth twin keeps its identity.
  assert.equal(getExecutor("github").getProvider(), "github");
});

test("buildHeaders falls back to apiKey when no copilotToken/accessToken", () => {
  const executor = new GithubExecutor("github-copilot");
  const headers = executor.buildHeaders({ apiKey: "gho_test123" }, false);
  assert.equal(headers.Authorization, "Bearer gho_test123");
});

test("buildHeaders still prefers copilotToken over apiKey", () => {
  const executor = new GithubExecutor("github-copilot");
  const headers = executor.buildHeaders(
    { apiKey: "gho_test123", providerSpecificData: { copilotToken: "copilot-tok" } },
    false
  );
  assert.equal(headers.Authorization, "Bearer copilot-tok");
});

test("refreshCredentials mints the Copilot token from apiKey when accessToken is absent", async () => {
  const executor = new GithubExecutor("github-copilot");
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
