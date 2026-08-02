import type { RegistryEntry } from "../../../shared.ts";
import { githubProvider } from "../index.ts";

// API-key twin of the OAuth `github` provider (same pattern as kimi-coding →
// kimi-coding-apikey). Users who already hold a Copilot-entitled GitHub OAuth
// user token (gho_/ghu_ — e.g. from `gh auth token` or the VS Code Copilot
// sign-in) paste it as a plain API key; GithubExecutor mints the short-lived
// Copilot bearer from it exactly like the device flow's accessToken. Classic
// and fine-grained PATs (ghp_/github_pat_) do NOT work — GitHub's
// copilot_internal/v2/token exchange rejects them.
//
// Spread from githubProvider so the model catalog (and every Copilot endpoint
// quirk encoded there: claude targetFormat → /v1/messages, codex →
// /responses) can never drift between the twins. The oauth block is dropped —
// this twin has no device flow.
const { oauth: _oauthOnlyForDeviceFlow, ...githubShared } = githubProvider;

export const github_copilotProvider: RegistryEntry = {
  ...githubShared,
  id: "github-copilot",
  alias: "ghcp",
  authType: "apikey",
};
