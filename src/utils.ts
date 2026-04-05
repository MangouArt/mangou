/**
 * CLI Utilities
 */

export interface ParsedArgs {
  resource: string;
  action: string;
  positionals: string[];
  flags: Record<string, any>;
}

export function parseCliArgs(argv: string[]): ParsedArgs {
  const flags: Record<string, any> = {};
  const rawPositionals: string[] = [];
  
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token.startsWith("--")) {
      const key = token.slice(2).replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase());
      const next = argv[i + 1];
      if (!next || next.startsWith("--")) {
        flags[key] = true;
      } else {
        flags[key] = next;
        i += 1;
      }
      continue;
    }
    rawPositionals.push(token);
  }

  return {
    resource: rawPositionals[0] || "",
    action: rawPositionals[1] || "",
    positionals: rawPositionals.slice(2),
    flags,
  };
}
