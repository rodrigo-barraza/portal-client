import { writeCatalog } from "../scripts/generate-component-catalog.mjs";

/**
 * The component catalog is generated (gitignored) at prebuild; tests that
 * import it need it on disk, so generate it once before the suite runs.
 */
export default function setup() {
  writeCatalog({ quiet: true });
}
