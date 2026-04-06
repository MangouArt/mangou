#!/usr/bin/env bun
export interface BuildSkillBundleOptions {
  packageRoot?: string;
  skillName?: string;
  outputRoot?: string;
  distSource?: string;
  includeDistInSkill?: boolean;
}

export interface BuildSkillBundleResult {
  skillRoot: string;
  archivePath: string;
  distRoot?: string;
  distArchivePath?: string;
}

export function buildSkillBundle(options?: BuildSkillBundleOptions): Promise<BuildSkillBundleResult>;
