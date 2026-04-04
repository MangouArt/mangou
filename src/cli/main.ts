import { parseCliArgs } from "./utils";
import * as project from "./commands/project";
import * as storyboard from "./commands/storyboard";
import * as asset from "./commands/asset";
import * as server from "./commands/server";

export async function main() {
  const { resource, action, positionals, flags } = parseCliArgs(process.argv.slice(2));

  try {
    switch (resource) {
      case "project":
        switch (action) {
          case "init": return await project.init(positionals, flags);
          case "stitch": return await project.stitch(positionals, flags);
          default: throw new Error(`Unknown action "${action}" for resource "project"`);
        }
      case "storyboard":
        switch (action) {
          case "generate": return await storyboard.generate(positionals, flags);
          case "split": return await storyboard.split(positionals, flags);
          default: throw new Error(`Unknown action "${action}" for resource "storyboard"`);
        }
      case "asset":
        switch (action) {
          case "generate": return await asset.generate(positionals, flags);
          default: throw new Error(`Unknown action "${action}" for resource "asset"`);
        }
      case "server":
        switch (action) {
          case "start": return await server.start(positionals, flags);
          default: throw new Error(`Unknown action "${action}" for resource "server"`);
        }
      case "help":
      case "":
        return showHelp();
      default:
        throw new Error(`Unknown resource "${resource}"`);
    }
  } catch (err: any) {
    console.error(`[mangou] Error: ${err.message}`);
    process.exit(1);
  }
}

function showHelp() {
  console.log(`
Mangou CLI - AIGC Storyboard Engine

Usage:
  mangou <resource> <action> [options]

Resources:
  project      Initialize or process entire projects
  storyboard   Operations on individual storyboard YAML files
  asset        Operations on asset definition YAML files
  server       Launch the readonly mirror server (SSE)

Examples:
  mangou project init --name my-movie
  mangou storyboard generate --path storyboards/shot1.yaml --type image
  mangou server start --port 3000
`);
}

if (require.main === module || (process as any).isBun) {
  main();
}
