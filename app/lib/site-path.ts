const configuredBasePath = (
  process.env.NEXT_PUBLIC_BASE_PATH ?? ""
).replace(/\/$/, "");

export function appPath(path = "/") {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  if (!configuredBasePath) return normalizedPath;
  if (normalizedPath === "/") return `${configuredBasePath}/`;

  return `${configuredBasePath}${normalizedPath}`;
}
