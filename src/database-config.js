export function databaseOptions(value, env = process.env) {
  let url;
  try {
    url = new URL(String(value || "").replace(/^postgresql:/, "postgres:"));
  } catch {
    throw new Error("DATABASE_URL must be a valid PostgreSQL URL");
  }
  if (url.protocol !== "postgres:" || !url.hostname)
    throw new Error("DATABASE_URL must use PostgreSQL");
  const hostname = url.hostname.toLowerCase();
  const loopback = ["localhost", "127.0.0.1", "[::1]", "::1"].includes(
    hostname,
  );
  const transport = String(env.DATABASE_TRANSPORT || "").trim();
  if (!["", "verify-full", "railway-private"].includes(transport))
    throw new Error("Unsupported DATABASE_TRANSPORT");
  const routingKeys = new Set([
    "host",
    "hostaddr",
    "port",
    "service",
    "servicefile",
  ]);
  if (
    [...url.searchParams.keys()].some((key) =>
      routingKeys.has(key.toLowerCase()),
    )
  )
    throw new Error(
      "DATABASE_URL cannot override connection routing through query parameters",
    );
  const requested = url.searchParams.get("sslmode");
  const ca = String(env.DATABASE_SSL_CA || "")
    .replace(/\\n/g, "\n")
    .trim();
  const privateMode = transport === "railway-private";
  if (privateMode) {
    if (
      ![
        env.RAILWAY_PROJECT_ID,
        env.RAILWAY_ENVIRONMENT_ID,
        env.RAILWAY_SERVICE_ID,
      ].every((value) => typeof value === "string" && value.trim())
    )
      throw new Error(
        "Railway-private transport requires Railway deployment variables",
      );
    if (
      hostname.length > 253 ||
      !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+railway\.internal$/.test(
        hostname,
      )
    )
      throw new Error(
        "Railway-private transport requires a valid railway.internal hostname",
      );
    if (
      ca ||
      [...url.searchParams.entries()].some(
        ([key, value]) =>
          (key.toLowerCase().startsWith("ssl") ||
            key.toLowerCase() === "uselibpqcompat") &&
          !(key === "sslmode" && value === "disable"),
      )
    )
      throw new Error("Railway-private transport conflicts with TLS settings");
  }
  const tls =
    transport === "verify-full" ||
    !loopback ||
    ["require", "verify-full", "verify-ca"].includes(requested);
  for (const key of [
    "sslmode",
    "sslcert",
    "sslkey",
    "sslrootcert",
    "ssl",
    "uselibpqcompat",
  ])
    url.searchParams.delete(key);
  return {
    connectionString: url.toString(),
    ssl: privateMode
      ? false
      : tls
        ? { rejectUnauthorized: true, ...(ca ? { ca } : {}) }
        : undefined,
  };
}
