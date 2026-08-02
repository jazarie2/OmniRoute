/**
 * Validation for the `github-copilot` API-key twin provider.
 *
 * The stored key is a Copilot-entitled GitHub OAuth user token (gho_/ghu_),
 * not a Copilot bearer — so the generic OpenAI-format probe against
 * api.githubcopilot.com would always 401. Validate the same way the runtime
 * does: exchange the GitHub token for a short-lived Copilot token via
 * copilot_internal/v2/token. A successful mint proves both that the token is
 * a live GitHub OAuth user token AND that the account has a Copilot
 * entitlement; PATs (ghp_/github_pat_) and revoked tokens are rejected here.
 */
import { getGitHubCopilotRefreshHeaders } from "@omniroute/open-sse/config/providerHeaderProfiles.ts";
import { validationRead, toValidationErrorResult } from "./transport";

const COPILOT_TOKEN_URL = "https://api.github.com/copilot_internal/v2/token";

export async function validateGithubCopilotTokenProvider({ apiKey }: any) {
  try {
    const response = await validationRead(COPILOT_TOKEN_URL, {
      method: "GET",
      headers: getGitHubCopilotRefreshHeaders(`token ${apiKey}`),
    });

    if (response.ok) {
      const data = await response.json().catch(() => null);
      if (data?.token) {
        return { valid: true, error: null, method: "copilot_token_exchange" };
      }
      return { valid: false, error: "Copilot token exchange returned no token" };
    }

    if (response.status === 401 || response.status === 403) {
      return {
        valid: false,
        error:
          "GitHub rejected the token for Copilot. Use a Copilot-entitled GitHub OAuth user token (gho_/ghu_) — classic/fine-grained PATs do not work.",
      };
    }

    // Non-auth, non-OK status — transient upstream failure, not proof the token is bad.
    return { valid: false, error: `Copilot token exchange returned ${response.status}` };
  } catch (error: unknown) {
    return toValidationErrorResult(error);
  }
}
