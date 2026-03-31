import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { readLocalMediaAsDataUrl } from '@/lib/agent/image-input';

describe('image input', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    while (tempDirs.length > 0) {
      const dir = tempDirs.pop();
      if (dir) await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it('reads local media from workspace projects directory', async () => {
    const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'mangou-image-input-'));
    tempDirs.push(workspaceRoot);

    const imagePath = path.join(workspaceRoot, 'projects', 'demo', 'assets', 'images', 'frame.png');
    await fs.mkdir(path.dirname(imagePath), { recursive: true });
    await fs.writeFile(
      imagePath,
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]),
    );

    const dataUrl = await readLocalMediaAsDataUrl(
      workspaceRoot,
      'demo',
      './assets/images/frame.png'
    );

    expect(dataUrl).toMatch(/^data:image\/png;base64,/);
  });
});
