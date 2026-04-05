const ABSOLUTE_URL_PATTERN = /^(?:[a-z]+:)?\/\//i;

export function resolveProjectMediaUrl(projectId: string, value: string | null | undefined) {
  if (value == null) return value;
  if (!value || ABSOLUTE_URL_PATTERN.test(value) || value.startsWith("/")) {
    return value;
  }

  const params = new URLSearchParams({
    projectId,
    path: value,
  });

  return `/api/vfs?${params.toString()}`;
}
