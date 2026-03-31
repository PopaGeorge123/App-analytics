import crypto from "crypto";

/**
 * Generates a PKCE code_verifier and code_challenge (S256).
 * Used for OAuth flows that require PKCE (Klaviyo, Etsy, Twitter OAuth 2.0).
 */
export async function generatePKCE(): Promise<{ codeVerifier: string; codeChallenge: string }> {
  const codeVerifier = crypto.randomBytes(32).toString("base64url");
  const hash = crypto.createHash("sha256").update(codeVerifier).digest();
  const codeChallenge = Buffer.from(hash).toString("base64url");
  return { codeVerifier, codeChallenge };
}
