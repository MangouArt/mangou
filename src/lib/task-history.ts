function resolveVfsUrl(projectId: string, value?: string): string | undefined {
  if (!value || typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  if (trimmed.startsWith('data:')) return trimmed;
  if (trimmed.startsWith('/api/')) return trimmed;
  const normalized = trimmed.startsWith('/') || trimmed.startsWith('./')
    ? trimmed
    : `./${trimmed}`;
  return `/api/vfs?projectId=${projectId}&path=${encodeURIComponent(normalized)}`;
}

export function getTaskRefPath(task: any): string {
  return String(
    task?.ref?.yamlPath ||
    task?.ref ||
    task?.input?.path ||
    task?.input?.yamlPath ||
    task?.input?.vfsPath ||
    task?.input?.params?.path ||
    task?.input?.params?.yamlPath ||
    task?.input?.params?.vfsPath ||
    ''
  );
}

export function getTaskOutputUrl(projectId: string, task: any): string | undefined {
  const output = task?.output;
  const rawValue =
    output?.url ||
    output?.urls?.[0] ||
    output?.file ||
    output?.files?.[0] ||
    task?.outputUrl ||
    (typeof output === 'string' ? output : undefined);

  return resolveVfsUrl(projectId, rawValue);
}

export function normalizeHistoryTask(projectId: string, task: any): any {
  return {
    ...task,
    refPath: getTaskRefPath(task),
    outputUrl: getTaskOutputUrl(projectId, task),
    params: task?.input?.params || task?.input || task?.params,
  };
}
