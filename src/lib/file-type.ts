const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_MAGIC = [0xff, 0xd8, 0xff];
const GIF87 = 'GIF87a';
const GIF89 = 'GIF89a';

function startsWithBytes(buffer: Uint8Array, magic: number[]): boolean {
  if (buffer.length < magic.length) return false;
  for (let i = 0; i < magic.length; i += 1) {
    if (buffer[i] !== magic[i]) return false;
  }
  return true;
}

export function normalizeContentType(contentType: string): string {
  return contentType.split(';')[0]?.trim().toLowerCase() || '';
}

export function sniffContentType(buffer: Uint8Array): string | null {
  if (startsWithBytes(buffer, PNG_MAGIC)) return 'image/png';
  if (startsWithBytes(buffer, JPEG_MAGIC)) return 'image/jpeg';

  const header6 = Buffer.from(buffer).toString('ascii', 0, 6);
  if (header6 === GIF87 || header6 === GIF89) return 'image/gif';

  const riff = Buffer.from(buffer).toString('ascii', 0, 4);
  const webp = Buffer.from(buffer).toString('ascii', 8, 12);
  if (riff === 'RIFF' && webp === 'WEBP') return 'image/webp';

  const ftyp = Buffer.from(buffer).toString('ascii', 4, 8);
  if (ftyp === 'ftyp') return 'video/mp4';

  return null;
}

export function getExtensionForContentType(contentType: string): string | null {
  const normalized = normalizeContentType(contentType);
  switch (normalized) {
    case 'image/png':
      return 'png';
    case 'image/jpeg':
      return 'jpg';
    case 'image/gif':
      return 'gif';
    case 'image/webp':
      return 'webp';
    case 'video/mp4':
      return 'mp4';
    default:
      return null;
  }
}

export function isMediaContentType(contentType: string): boolean {
  const normalized = normalizeContentType(contentType);
  return normalized.startsWith('image/') || normalized.startsWith('video/');
}
