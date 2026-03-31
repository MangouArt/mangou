#!/usr/bin/env node
import path from 'path';
import { fileURLToPath } from 'url';
import {
  loadDotEnv,
  parseArgs,
  normalizeBaseUrl,
  buildPayload,
  normalizeStatus,
  resolveSubmitEndpoint,
  resolvePollEndpoint,
  submitTask,
  getTask,
  pollTask,
} from './bltai-lib.mjs';

function log(...args) {
  console.error('[BLTAI-MVP]', ...args);
}

export {
  loadDotEnv,
  parseArgs,
  normalizeBaseUrl,
  buildPayload,
  normalizeStatus,
  resolveSubmitEndpoint,
  resolvePollEndpoint,
  submitTask,
  getTask,
  pollTask,
} from './bltai-lib.mjs';

export async function main(argv = process.argv.slice(2)) {
  await loadDotEnv();
  const args = parseArgs(argv);
  const [scope, prompt] = args._;
  if (!scope || !prompt) {
    log('Usage: node scripts/bltai-mvp.mjs <scope> <prompt> [--model <name>] [--images url1,url2] [--videos url1,url2]');
    log('Example: node scripts/bltai-mvp.mjs videos "A cat" --images https://...');
    process.exit(1);
  }

  if (!process.env.BLTAI_API_KEY) {
    throw new Error('Missing BLTAI_API_KEY (set in .env.local or env var)');
  }

  const baseUrl = normalizeBaseUrl(process.env.BLTAI_BASE_URL || 'https://api.bltcy.ai');
  const payload = buildPayload(scope, { ...args, prompt });

  log('Submitting task...', { scope, baseUrl, payload });
  const taskId = await submitTask(baseUrl, process.env.BLTAI_API_KEY, scope, payload);
  log('Task submitted:', taskId);

  const timeoutMs = Number(args.timeout || 30 * 60 * 1000);
  const result = await pollTask(baseUrl, process.env.BLTAI_API_KEY, scope, taskId, timeoutMs, args.debug);
  let outputs = [];
  if (scope === 'images') {
    const dataBlock = result?.data?.data || result?.data;
    outputs = dataBlock?.data?.map((item) => item.url).filter(Boolean) || [];
    if (outputs.length === 0 && dataBlock?.url) outputs = [dataBlock.url];
  } else {
    outputs = result?.data?.outputs || (result?.data?.output ? [result.data.output] : []);
  }

  console.log(JSON.stringify({
    task_id: taskId,
    status: result.status,
    output: outputs[0] || '',
    outputs,
    raw: result,
  }, null, 2));
}

const isEntrypoint = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isEntrypoint) {
  main().catch((error) => {
    log('Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
