export interface BuildSkillBundleOptions {
  packageRoot?: string;
  skillName?: string;
  outputRoot?: string;
  distSource?: string;
}

export interface BuildSkillBundleResult {
  skillRoot: string;
  archivePath: string;
}

export function buildSkillBundle(options?: BuildSkillBundleOptions): Promise<BuildSkillBundleResult>;
