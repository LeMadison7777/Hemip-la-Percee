/** Keep each stateless web replica's Neon pool bounded. DATABASE_URL contents must never be logged. */
export function prismaRuntimeUrl(rawUrl: string | undefined, perReplicaLimit = 5): string | undefined {
  if (!rawUrl) return undefined;
  const url = new URL(rawUrl);
  if (!url.searchParams.has("connection_limit")) {
    url.searchParams.set("connection_limit", String(perReplicaLimit));
  }
  if (!url.searchParams.has("pool_timeout")) {
    url.searchParams.set("pool_timeout", "20");
  }
  return url.toString();
}
