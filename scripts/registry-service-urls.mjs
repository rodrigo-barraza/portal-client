// ============================================================
// Registry service URLs — dev fallback for next.config.ts
// ============================================================
// vault-service/projects.json is the workspace's source of truth
// for hosts, ports and domains. The vault serves URLs derived
// from it; when the vault is unreachable (common in WSL dev),
// next.config derives the same values straight from the file
// instead of guessing or hardcoding them. The file is gitignored
// and absent from Docker build contexts — there the vault must
// answer.
// ============================================================

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REGISTRY_RELATIVE_PATH = path.join("vault-service", "projects.json");

/**
 * Walk up from `startDirectory` to the workspace that holds the registry
 * (worktrees sit several levels below it). Returns null when absent.
 * @param {string} startDirectory
 * @returns {string | null}
 */
export function findRegistryPath(startDirectory) {
  let directory = path.resolve(startDirectory);
  for (;;) {
    const candidate = path.join(directory, REGISTRY_RELATIVE_PATH);
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(directory);
    if (parent === directory) return null;
    directory = parent;
  }
}

/**
 * "portal-service" → "PORTAL_SERVICE"
 * @param {string} projectId
 */
function toEnvironmentPrefix(projectId) {
  return projectId.toUpperCase().replace(/[^A-Z0-9]+/g, "_");
}

/**
 * `<ID>_URL` (http://<defaultHost>:<port>) and `<ID>_PUBLIC_URL`
 * (https://<domain>) for each requested project — the same derivation the
 * vault applies. Projects missing from the registry are skipped.
 * @param {{ defaultHost?: string, projects?: Array<{ id: string, port?: number, domain?: string }> }} registry
 * @param {readonly string[]} projectIds
 * @returns {Record<string, string>}
 */
export function deriveServiceUrls(registry, projectIds) {
  /** @type {Record<string, string>} */
  const urls = {};
  for (const projectId of projectIds) {
    const project = registry.projects?.find((entry) => entry.id === projectId);
    if (!project) continue;
    const prefix = toEnvironmentPrefix(projectId);
    if (registry.defaultHost && project.port) {
      urls[`${prefix}_URL`] = `http://${registry.defaultHost}:${project.port}`;
    }
    if (project.domain)
      urls[`${prefix}_PUBLIC_URL`] = `https://${project.domain}`;
  }
  return urls;
}

/**
 * Read the registry near `startDirectory` and derive the URLs; {} when the
 * registry is not on this machine or cannot be parsed.
 * @param {string} startDirectory
 * @param {readonly string[]} projectIds
 * @returns {Record<string, string>}
 */
export function readRegistryServiceUrls(startDirectory, projectIds) {
  const registryPath = findRegistryPath(startDirectory);
  if (!registryPath) return {};
  try {
    const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
    return deriveServiceUrls(registry, projectIds);
  } catch {
    return {};
  }
}

// CLI: `node scripts/registry-service-urls.mjs <project-id>…` prints the
// derived KEY=VALUE lines (deploy.sh uses it for build args).
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
  const urls = readRegistryServiceUrls(scriptDirectory, process.argv.slice(2));
  for (const [key, value] of Object.entries(urls))
    console.log(`${key}=${value}`);
}
