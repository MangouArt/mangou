import fs from 'fs/promises';
import path from 'path';
import * as YAMLUtils from '../../core/vfs/yaml';
const updateGenerationStatus = YAMLUtils.updateGenerationStatus || (YAMLUtils.default ? YAMLUtils.default.updateGenerationStatus : null);

import { log } from './utils';

export async function updateYamlProjection(payload: any) {
  const {
    projectRoot,
    taskId,
    upstreamTaskId,
    status,
    output,
    yamlPath,
    taskType,
    error,
    docIndex = 0,
  } = payload;

  if (!projectRoot || !yamlPath) return;

  try {
    const fullYamlPath = path.join(projectRoot, yamlPath);
    const current = await fs.readFile(fullYamlPath, 'utf-8');
    const updated = updateGenerationStatus(current, taskType, {
      status,
      output: Array.isArray(output?.files) ? output.files[0] : (typeof output === 'string' ? output : null),
      error: typeof error === 'string' ? error : (error?.message || null),
      task_id: taskId ?? null,
      upstream_task_id: upstreamTaskId ?? taskId ?? null,
    }, docIndex);
    await fs.writeFile(fullYamlPath, updated, 'utf-8');
  } catch (writeError) {
    log(`Warning: failed to update YAML directly: ${writeError instanceof Error ? writeError.message : String(writeError)}`);
  }
}
