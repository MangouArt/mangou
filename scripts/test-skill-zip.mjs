#!/usr/bin/env bun
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const MANGOU_ROOT = path.resolve(SCRIPT_DIR, '..');
const ZIP_PATH = path.join(MANGOU_ROOT, 'bundled-skills', 'mangou.zip');

async function run() {
  console.log('--- Mangou Skill Zip E2E Test ---');

  // 1. Verify zip exists
  try {
    await fs.access(ZIP_PATH);
    console.log('✅ Zip file found at:', ZIP_PATH);
  } catch {
    console.error('❌ Zip file not found! Run npm run build:skill first.');
    process.exit(1);
  }

  // 2. Create temp directory for extraction
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mangou-e2e-zip-test-'));
  const extractionBase = path.join(tempDir, 'extracted');
  await fs.mkdir(extractionBase);
  console.log('✅ Using temp directory:', tempDir);

  // 3. Extract zip
  console.log('📦 Extracting zip...');
  execFileSync('unzip', ['-q', ZIP_PATH, '-d', extractionBase]);
  const extractionDir = path.join(extractionBase, 'mangou');
  console.log('✅ Extracted successfully to:', extractionDir);

  // 4. Verify base structure
  const requiredFiles = [
    'SKILL.md',
    'dist/index.html',
    'scripts/init-workspace.mjs',
    'scripts/create-project.mjs',
    'scripts-src/aigc-runner.mjs',
    'workspace_template/.env.example'
  ];

  for (const file of requiredFiles) {
    const fullPath = path.join(extractionDir, file);
    await fs.access(fullPath);
    console.log(`✅ File exists: ${file}`);
  }

  // 5. Test Workspace Initialization
  const workspaceRoot = path.join(tempDir, 'test-workspace');
  console.log('🛠️  Testing workspace initialization at:', workspaceRoot);
  
  const initScript = path.join(extractionDir, 'scripts', 'init-workspace.mjs');
  try {
    const output = execFileSync('node', [initScript, '--workspace', workspaceRoot], { stdio: 'pipe', encoding: 'utf-8' });
    console.log('Output from init-workspace:', output.trim());
  } catch (err) {
    console.error('❌ init-workspace failed!');
    console.error('STDOUT:', err.stdout);
    console.error('STDERR:', err.stderr);
    throw err;
  }

  // Verify workspace structure
  const workspaceFiles = [
    'projects.json',
    'config.json',
    '.env.example',
    'projects',
    '.mangou'
  ];

  for (const file of workspaceFiles) {
    const fullPath = path.join(workspaceRoot, file);
    await fs.access(fullPath);
    console.log(`✅ Workspace file exists: ${file}`);
  }

  const projectsJson = JSON.parse(await fs.readFile(path.join(workspaceRoot, 'projects.json'), 'utf-8'));
  if (!Array.isArray(projectsJson.projects) || projectsJson.projects.length !== 0) {
    throw new Error('New workspace projects list should be empty');
  }
  console.log('✅ projects.json is correct.');

  // 6. Test Project Creation
  console.log('🚀 Testing project creation...');
  const createProjectScript = path.join(extractionDir, 'scripts', 'create-project.mjs');
  const projectName = 'my-first-comic';
  try {
    const output = execFileSync('node', [createProjectScript, '--workspace', workspaceRoot, '--name', projectName], { stdio: 'pipe', encoding: 'utf-8' });
    console.log('Output from create-project:', output.trim());
  } catch (err) {
    console.error('❌ create-project failed!');
    console.error('STDOUT:', err.stdout);
    console.error('STDERR:', err.stderr);
    throw err;
  }

  // Verify project structure
  const projectPath = path.join(workspaceRoot, 'projects', projectName);
  const projectFiles = [
    'project.json',
    'storyboards',
    'tasks.jsonl'
  ];

  for (const file of projectFiles) {
    const fullPath = path.join(projectPath, file);
    await fs.access(fullPath);
    console.log(`✅ Project file exists: ${file}`);
  }

  const projectJson = JSON.parse(await fs.readFile(path.join(projectPath, 'project.json'), 'utf-8'));
  if (projectJson.name !== projectName) {
    throw new Error('Project name in project.json mismatch');
  }
  console.log('✅ project.json is correct.');

  const projectsJsonUpdated = JSON.parse(await fs.readFile(path.join(workspaceRoot, 'projects.json'), 'utf-8'));
  if (projectsJsonUpdated.projects.length !== 1 || projectsJsonUpdated.projects[0].name !== projectName) {
    throw new Error('projects.json was not updated correctly after project creation');
  }
  console.log('✅ projects.json updated successfully.');

  // 7. Cleanup
  console.log('🧹 Cleaning up...');
  await fs.rm(tempDir, { recursive: true, force: true });
  console.log('✅ Cleanup finished.');

  console.log('\n✨ END-TO-END TEST PASSED! ✨');
}

run().catch(err => {
  console.error('\n❌ TEST FAILED!');
  if (err.message) console.error('Error message:', err.message);
  process.exit(1);
});
