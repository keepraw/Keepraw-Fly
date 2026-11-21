import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

function installedPackage(name, from) {
  const entry = createRequire(from).resolve(name);
  // Package exports can hide package.json. Start at the resolved runtime entry
  // and walk to its own manifest, not a hoisted or declared dependency version.
  for (let directory = dirname(entry); ; directory = dirname(directory)) {
    let manifest;
    try {
      manifest = JSON.parse(
        readFileSync(join(directory, "package.json"), "utf8"),
      );
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    if (manifest?.name === name) {
      if (
        typeof manifest.version !== "string" ||
        !/^\d+\.\d+\.\d+(?:-[\w.-]+)?(?:\+[\w.-]+)?$/.test(manifest.version)
      )
        throw new Error(`Cannot confirm the installed ${name} version.`);
      return { entry, version: manifest.version };
    }
    if (dirname(directory) === directory)
      throw new Error(`Cannot find the installed ${name} manifest.`);
  }
}

export function worldMapGeneratorVersions(from = import.meta.url) {
  const geo = installedPackage("d3-geo", from);
  const array = installedPackage("d3-array", geo.entry);
  const internmap = installedPackage("internmap", array.entry);
  return {
    d3Geo: geo.version,
    d3Array: array.version,
    internmap: internmap.version,
  };
}
