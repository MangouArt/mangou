import path from 'path';
import { fileURLToPath } from 'url';
import Module from 'module';

const dirname =
  typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url));

const srcRoot = path.resolve(dirname, '../src');
const originalResolve = (Module as any)._resolveFilename;

(Module as any)._resolveFilename = function (
  request: string,
  parent: any,
  isMain: boolean,
  options: any
) {
  if (request.startsWith('@/')) {
    const mapped = path.join(srcRoot, request.slice(2));
    return originalResolve.call(this, mapped, parent, isMain, options);
  }
  return originalResolve.call(this, request, parent, isMain, options);
};
