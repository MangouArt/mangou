#!/usr/bin/env node
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';
import dotenv from 'dotenv';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const MANGOU_ROOT = path.resolve(SCRIPT_DIR, '..');
const ZIP_PATH = path.join(MANGOU_ROOT, 'bundled-skills', 'mangou.zip');

async function run() {
  console.log('--- Mangou AIGC E2E Heavy Test (Zipped Skill) ---');
  console.warn('⚠️  WARNING: This test will call real AI APIs and incur COSTS.');
  console.warn('⚠️  Current Provider configured in .env will be used.');

  // Load Env
  dotenv.config({ path: path.join(MANGOU_ROOT, '.env') });
  
  const provider = process.env.MANGOU_AIGC_PROVIDER || 'bltai';
  console.log(`📡 Using Provider: ${provider}`);

  // 1. Verify zip exists
  try {
    await fs.access(ZIP_PATH);
  } catch {
    console.error('❌ Zip file not found! Run npm run build:skill first.');
    process.exit(1);
  }

  // 2. Setup temp environment
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mangou-aigc-e2e-'));
  const extractionBase = path.join(tempDir, 'extracted');
  await fs.mkdir(extractionBase);
  
  console.log('📦 Extracting zip...');
  execFileSync('unzip', ['-q', ZIP_PATH, '-d', extractionBase]);
  const skillRoot = path.join(extractionBase, 'mangou');

  // 3. Init Workspace
  const workspaceRoot = path.join(tempDir, 'workspace');
  const initScript = path.join(skillRoot, 'scripts', 'init-workspace.mjs');
  console.log('🛠️  Initializing workspace...');
  execFileSync('node', [initScript, '--workspace', workspaceRoot]);

  // 4. Create Project
  const projectName = 'aigc-test';
  const createProjectScript = path.join(skillRoot, 'scripts', 'create-project.mjs');
  console.log(`🚀 Creating project: ${projectName}`);
  execFileSync('node', [createProjectScript, '--workspace', workspaceRoot, '--name', projectName]);

  const projectRoot = path.join(workspaceRoot, 'projects', projectName);

  // 5. Create Test Storyboard YAML
  const storyboardPath = path.join(projectRoot, 'storyboards', 'test.yaml');
  const storyboardContent = {
    meta: {
      id: 'test-scene',
      title: 'AIGC Test Scene',
    },
    content: 'A detailed 3D render of a cute yellow mango character wearing sunglasses on a beach.',
    params: {
      prompt: 'cat',
      negative_prompt: 'blurry, low quality, distorted anatomy, text, watermark',
      width: 1024,
      height: 1024,
    },
    tasks: {
      image: {
        provider: provider,
        params: {
          model: provider === 'kie' ? 'nano-banana-2' : 'nano-banana',
          prompt: 'cat',
          width: 512,
          height: 512,
          steps: 20
        }
      },
      video: {
        provider: provider,
        params: {
          model: provider === 'kie' ? 'bytedance/v1-pro-fast-image-to-video' : 'doubao-seedance-1-0-pro-250528',
          prompt: 'mango waving',
          image_url: '{{tasks.image.latest.output}}',
          duration: 5,
          resolution: '720p'
        }
      }
    }
  };

  await fs.writeFile(storyboardPath, yaml.dump(storyboardContent), 'utf-8');
  console.log('📝 Created storyboard YAML with test prompt.');

  // 6. Run Image Generation
  const generateScript = path.join(skillRoot, 'scripts', 'agent-generate.mjs');
  console.log('🎨 Generating IMAGE (this may take a minute)...');
  
  // Note: we run the script with the storyboard YAML as argument.
  // We need to be careful about where we run it.
  // The script's inferContext looks for "/projects/..." or falls back to CWD.
  
  const env = { 
    ...process.env, 
    MANGOU_WEB_PORT: '3333',
    NODE_TLS_REJECT_UNAUTHORIZED: '0'
  }; 

  try {
    const imageOutput = execFileSync('node', [generateScript, storyboardPath, 'image', '--debug'], {
      env,
      stdio: 'pipe',
      encoding: 'utf-8'
    });
    console.log('✅ Image task output:', imageOutput.trim());
  } catch (err) {
    console.error('❌ Image generation FAILED!');
    console.error('STDOUT:', err.stdout);
    console.error('STDERR:', err.stderr);
    process.exit(1);
  }

  // 7. Verify Image Downloaded
  const assetsDir = path.join(projectRoot, 'assets', 'images');
  const imageFiles = await fs.readdir(assetsDir);
  if (imageFiles.length === 0) {
    throw new Error('No image was downloaded to assets/images');
  }
  console.log(`📸 Found ${imageFiles.length} generated images:`, imageFiles);

  /* Skip video generation for now as requested
  console.log('🎬 Generating VIDEO (this may take several minutes)...');
  try {
    const videoOutput = execFileSync('node', [generateScript, storyboardPath, 'video', '--debug'], {
      env,
      stdio: 'pipe',
      encoding: 'utf-8'
    });
    console.log('✅ Video task output:', videoOutput.trim());
  } catch (err) {
    console.error('❌ Video generation FAILED!');
    console.error('STDOUT:', err.stdout);
    console.error('STDERR:', err.stderr);
    process.exit(1);
  }
  */
  console.log('🚧 Video generation skipped (upstream API issues).');

  // 9. Verify Image Downloaded (Verified in step 7, but double check in YAML)
  const updatedYaml = yaml.load(await fs.readFile(storyboardPath, 'utf-8'));
  console.log('📊 Task Status Check:');
  console.log(`   Image Status: ${updatedYaml.tasks?.image?.latest?.status}`);
  
  if (updatedYaml.tasks?.image?.latest?.status !== 'completed') {
    throw new Error('Image task did not finish with "completed" status in YAML');
  }

  // 11. Optional Cleanup
  console.log('🧹 Cleaning up workspace...');
  await fs.rm(tempDir, { recursive: true, force: true });
  console.log('✅ Cleanup finished.');

  console.log('\n✨ AIGC HEAVY E2E TEST PASSED! ✨');
}

run().catch(err => {
  console.error('\n❌ TEST FAILED!');
  console.error(err);
  process.exit(1);
});
