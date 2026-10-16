/*
 * Which file registered a tool. pi reports a tool's `sourceInfo.path` as the
 * path it was configured with, but `import.meta.url` names the module's real
 * path. The two differ when the path has a symlink, such as macOS `/tmp` or a
 * linked agent directory, so both are compared after resolving symlinks.
 */
import { existsSync, realpathSync } from "node:fs";

const OWN = realpathSync(new URL("index.ts", import.meta.url)),
  /**
   * Whether `path` is this package's extension entry. A path that does not
   * exist, such as a synthetic source, cannot be this file.
   * @param {string} path A tool's `sourceInfo.path`.
   * @returns {boolean} Whether the file is this package's `index.ts`.
   */
  isOwnSource = (path: string): boolean => existsSync(path) && realpathSync(path) === OWN;

export { isOwnSource };
