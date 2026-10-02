/**
 * Resolve the deployment-owned Auth.js secret without shipping it to the browser.
 */
export function resolveAuthSecret(): string {
  const secret = process.env.AUTH_SECRET;
  return secret && secret.length >= 32 ? secret : "";
}
