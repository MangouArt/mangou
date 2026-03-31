export function getContentTypeByPath(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  switch (ext) {
    case 'yaml':
    case 'yml':
      return 'text/yaml; charset=utf-8';
    case 'json':
      return 'application/json; charset=utf-8';
    case 'txt':
      return 'text/plain; charset=utf-8';
    case 'md':
      return 'text/markdown; charset=utf-8';
    case 'png':
      return 'image/png';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'gif':
      return 'image/gif';
    case 'webp':
      return 'image/webp';
    case 'mp4':
      return 'video/mp4';
    default:
      return 'application/octet-stream';
  }
}

export function getCacheControlByContentType(contentType: string): string {
  const lower = contentType.toLowerCase();
  if (lower.startsWith('text/') || lower.includes('json') || lower.includes('yaml') || lower.includes('markdown')) {
    return 'no-store';
  }
  return 'public, max-age=31536000, immutable';
}
