import yaml from "js-yaml";
import fs from "fs";

export function parseDbDoc(content: string) {
  try {
    return yaml.load(content);
  } catch (err: any) {
    throw new Error("YAML Parse Error: " + err.message);
  }
}
