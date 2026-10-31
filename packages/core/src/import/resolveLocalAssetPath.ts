function normalizePath(path: string): string | null {
  const parts: string[] = [];
  for (const part of path.split("/")) {
    if (!part || part === ".") continue;
    if (part !== "..") {
      parts.push(part);
      continue;
    }
    if (parts.length === 0) return null;
    parts.pop();
  }
  return parts.join("/");
}

export function resolveLocalAssetPath(
  entry: string,
  reference: string,
  files: Record<string, string>
): string | null {
  const path = reference.trim().split(/[?#]/)[0] ?? "";
  if (!path || /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(path)) return null;
  const directory = entry.slice(0, entry.lastIndexOf("/") + 1);
  const relative = normalizePath(path.startsWith("/") ? path : directory + path);
  if (relative === null) return null;
  const legacy = normalizePath(path);
  const candidates = [relative, ...(legacy ? [`source/${legacy}`, legacy] : [])];
  return candidates.find((candidate) => Object.hasOwn(files, candidate)) ?? null;
}
