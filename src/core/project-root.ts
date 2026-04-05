import path from "node:path";
import { fileExists } from "../logic/generation/utils";

export async function inferProjectRoot(filePath: string): Promise<string> {
  let current = path.dirname(path.resolve(filePath));

  while (true) {
    if (await fileExists(path.join(current, "project.json"))) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      throw new Error(
        `Unable to infer project root for ${filePath}. Expected an ancestor directory containing project.json.`,
      );
    }
    current = parent;
  }
}
