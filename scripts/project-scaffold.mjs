import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';
import { inferContext } from './generation/context.mjs';
import { fileExists } from './generation/utils.mjs';

function parseGrid(gridValue) {
  const [cols, rows] = String(gridValue || '').toLowerCase().split('x').map(Number);
  if (!Number.isInteger(cols) || !Number.isInteger(rows) || cols <= 0 || rows <= 0) {
    throw new Error(`Invalid meta.grid: ${gridValue}`);
  }
  return { cols, rows };
}

function buildChildDoc(masterDoc, parentId, index) {
  const content = masterDoc?.content || {};
  const sequenceBase = Number(content.sequence || 0);
  const titleBase = String(content.title || parentId).trim() || parentId;

  return {
    meta: {
      id: `${parentId}-sub-${String(index).padStart(2, '0')}`,
      version: masterDoc?.meta?.version || '1.0',
      parent: parentId,
      grid_index: index,
    },
    content: {
      sequence: sequenceBase + index,
      title: `${titleBase} 子镜 ${String(index).padStart(2, '0')}`,
      story: String(content.story || ''),
      action: '',
      scene: String(content.scene || ''),
      duration: content.duration || '4s',
      characters: Array.isArray(content.characters) ? content.characters : [],
    },
    tasks: {},
    refs: {},
  };
}

export async function scaffoldGridChildren({
  gridYamlPath,
  projectRoot = '',
  workspaceRoot = '',
}) {
  if (!gridYamlPath) {
    throw new Error('gridYamlPath is required');
  }

  const absoluteGridYamlPath = path.resolve(process.cwd(), gridYamlPath);
  if (!(await fileExists(absoluteGridYamlPath))) {
    throw new Error(`Cannot find grid master YAML: ${absoluteGridYamlPath}`);
  }

  const context = await inferContext(absoluteGridYamlPath, {
    projectRoot,
    workspaceRoot,
  });
  const resolvedProjectRoot = context.projectRoot;

  const raw = await fs.readFile(absoluteGridYamlPath, 'utf-8');
  const docs = yaml.loadAll(raw).filter(Boolean);
  const masterDoc = docs[0];
  if (!masterDoc) {
    throw new Error(`Grid master YAML is empty: ${gridYamlPath}`);
  }

  const parentId = masterDoc?.meta?.id;
  if (!parentId) {
    throw new Error(`Grid master YAML missing meta.id: ${gridYamlPath}`);
  }

  const gridValue = masterDoc?.meta?.grid;
  if (!gridValue) {
    throw new Error(`Grid master YAML missing meta.grid: ${gridYamlPath}`);
  }

  const { cols, rows } = parseGrid(gridValue);
  const total = cols * rows;
  const storyboardsDir = path.dirname(absoluteGridYamlPath);
  const created = [];

  for (let index = 1; index <= total; index += 1) {
    const filename = `${parentId}-sub-${String(index).padStart(2, '0')}.yaml`;
    const absoluteChildPath = path.join(storyboardsDir, filename);
    if (await fileExists(absoluteChildPath)) {
      throw new Error(`Refusing to overwrite existing storyboard scaffold: ${absoluteChildPath}`);
    }

    const childDoc = buildChildDoc(masterDoc, parentId, index);
    const serialized = yaml.dump(childDoc, {
      indent: 2,
      lineWidth: -1,
      noRefs: true,
      sortKeys: false,
    });
    await fs.writeFile(absoluteChildPath, serialized, 'utf-8');
    created.push(path.relative(resolvedProjectRoot, absoluteChildPath).split(path.sep).join('/'));
  }

  return {
    parentId,
    grid: `${cols}x${rows}`,
    created,
  };
}
