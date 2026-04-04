export interface AppConfig {
  bltai?: {
    apiKey: string;
    baseUrl: string;
  };
  workspaceDir: string;
  lastProjectId?: string;
}

const DEFAULT_CONFIG: AppConfig = {
  workspaceDir: 'projects',
};

class ConfigStore {
  private config: AppConfig;
  private isBrowser: boolean;

  constructor() {
    this.isBrowser = typeof window !== 'undefined';
    this.config = { ...DEFAULT_CONFIG };
    if (this.isBrowser) {
      try {
        const stored = localStorage.getItem('mangou-config');
        if (stored) {
          this.config = { ...DEFAULT_CONFIG, ...JSON.parse(stored) };
        }
      } catch (e) {
        console.warn('Failed to load config from localStorage', e);
      }
    } else {
      try {
        const req = Function('return typeof require !== "undefined" ? require : null')();
        if (!req) return;
        const fs = req('fs');
        const path = req('path');
        const envRoot = process.env.MANGOU_HOME || process.cwd();
        const configPath = path.resolve(envRoot, 'config.json');

        if (fs.existsSync(configPath)) {
          const data = fs.readFileSync(configPath, 'utf-8');
          this.config = { ...DEFAULT_CONFIG, ...JSON.parse(data) };
        }
      } catch {
        // ignore
      }
    }
  }
  
  get<K extends keyof AppConfig>(key: K): AppConfig[K] {
    return this.config[key];
  }

  set<K extends keyof AppConfig>(key: K, value: AppConfig[K]): void {
    this.config[key] = value;
    this.saveConfig();
  }

  update(patch: Partial<AppConfig>): void {
    this.config = { ...this.config, ...patch };
    this.saveConfig();
  }

  private saveConfig() {
    if (this.isBrowser) {
      localStorage.setItem('mangou-config', JSON.stringify(this.config));
    } else {
      try {
        const req = Function('return typeof require !== "undefined" ? require : null')();
        if (!req) return;
        const fs = req('fs');
        const path = req('path');
        const envRoot = process.env.MANGOU_HOME || process.cwd();
        const configPath = path.resolve(envRoot, 'config.json');
        fs.writeFileSync(configPath, JSON.stringify(this.config, null, 2), 'utf-8');
      } catch {
        // ignore
      }
    }
  }

  getAll(): AppConfig {
    return { ...this.config };
  }
}

export const configStore = new ConfigStore();
