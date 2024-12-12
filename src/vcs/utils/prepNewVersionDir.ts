import fs from "node:fs";
import path from "node:path";

import { copyDir } from "./copyDir";
import { MYGIT_DIRNAME, MYGIT_REPO } from "../constants";
import { workDirVersionInrepo } from "./workDirVersionInRepo";
import resolveRoot from "./resolveRoot";

/**
 * Handles generation of new version directory; ready to take new changes from _work dir_
 * @param {string} mygitMsg The message for the commit operation
 * @param {string} [copySrc] The _absolute path_ to source contents for the new version. Default is the immediate previous version for the current 'checked out' branch.
 */
export async function prepNewVersionDir(mygitMsg: string, copySrc?: string) {
  const myGitParentDir = resolveRoot.find();
  const new_V_DirName =
    Math.trunc(Math.random() * 1000000)
      .toString(32)
      .toUpperCase() +
    "_" +
    Date.now().toString();
  const repoBase = path.resolve(myGitParentDir, MYGIT_DIRNAME, MYGIT_REPO);
  const new_V_Base = path.join(repoBase, new_V_DirName, "store"); // Location for version snapshot
  const mygitMsgBase = path.join(repoBase, new_V_DirName, "meta"); // Location for snapshot message

  // Make Version tracking directory
  fs.mkdirSync(new_V_Base, { recursive: true });
  // Make version meta directory
  fs.mkdirSync(mygitMsgBase); // not specifying `recursive`

  // Save version message
  fs.writeFileSync(path.join(mygitMsgBase, "MYGITMSG"), mygitMsg, {
    encoding: "utf-8",
  });

  // A version to source contents for current version (before it is later overwritten with newer content)
  const copyOverVersionDir = await workDirVersionInrepo();
  if (copyOverVersionDir) {
    // If prev vers dir DOES NOT EXIST(e.g in init commit): Copy working directory. NOTE: No need for this, because staging will list all paths(if not in VERSION REPO)
    // Overwrite files in current version dir with file paths from staging
    copyDir({
      src: copySrc || path.resolve(repoBase, copyOverVersionDir, "store"),
      dest: new_V_Base,
    });
  }

  return {
    /** Absolute path to `REPO` in `.mygit` */
    repoBase,
    /** Absolute path to directory of immediate previous version for the current branch; whose contents were used to create new version dir: `new_V_Base` */
    copyOverVersionDir,
    /**Absolute path to the `REPO` 'store' of the new generated version */
    new_V_Base,
    /** Random generated directory name to carry the new version in creation */
    new_V_DirName,
  };
}
