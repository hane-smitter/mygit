import fs from "node:fs";
import path from "node:path";
// import chalk from "chalk";
import { type ArgumentsCamelCase } from "yargs";
import * as Diff from "diff";

import resolveRoot from "../utils/resolveRoot";
import {
  MYGIT_ACTIVE_BRANCH,
  MYGIT_BRANCH,
  MYGIT_BRANCH_ACTIVITY,
  MYGIT_BRANCH_MAPPER,
  MYGIT_DIRNAME,
  MYGIT_HEAD,
  MYGIT_REPO,
} from "../constants";
import { getFilePathsUnderDir } from "../utils";
import { synchronizeDestWithSrc } from "../utils/synchronizeDestWithSrc";
import { styleText } from "node:util";
import { prepNewVersionDir } from "../utils/prepNewVersionDir";
import { commitCloseRoutine } from "../utils/commitCloseRoutine";

export const merge = async (
  argv: ArgumentsCamelCase<{
    branchName: string;
  }>
) => {
  // Parlance to understand here
  // Branch1 is the branched you are checked out on
  // Branch2 is the branch you want into you current checkedout branch
  const { branchName } = argv;
  const branchToMerge = branchName.trim();

  const myGitParentDir = resolveRoot.find();
  const myGitBranchDir = path.resolve(
    myGitParentDir,
    MYGIT_DIRNAME,
    MYGIT_BRANCH
  );

  const branchMapsFilePath = path.resolve(
    myGitParentDir,
    MYGIT_DIRNAME,
    MYGIT_BRANCH,
    `${MYGIT_BRANCH_MAPPER}.json`
  );
  const branchMappings = await fs.promises
    .readFile(branchMapsFilePath, "utf-8")
    .then((mappings): [string, string][] => JSON.parse(mappings));

  // Check if given branch name already exists
  const sysNamedBranch = (function () {
    const found = branchMappings.find(
      ([_systemNamed, userNamed]) => userNamed === branchToMerge
    );

    return found ? found[0] : undefined;
  })();
  if (!sysNamedBranch) {
    console.error(
      `${branchToMerge} is unknown. See 'mygit branch --list' for available branches`
    );
    process.exit(1);
  }

  /**  Active branch: Currently checked out */
  const mergeBranch1 = (
    await fs.promises.readFile(
      path.resolve(myGitBranchDir, MYGIT_ACTIVE_BRANCH),
      "utf-8"
    )
  ).split(/\r?\n/)[0];
  /** The 'branch 2' we want to introduce its work onto 'branch 1' */
  const mergeBranch2 = sysNamedBranch;

  const branch_1_Activity = (
    await fs.promises.readFile(
      path.resolve(myGitBranchDir, mergeBranch1, MYGIT_BRANCH_ACTIVITY),
      "utf-8"
    )
  ).split(/\r?\n/);
  const branch_1_ActivitySet = new Set(branch_1_Activity);
  const branch_2_Activity = (
    await fs.promises.readFile(
      path.resolve(myGitBranchDir, mergeBranch2, MYGIT_BRANCH_ACTIVITY),
      "utf-8"
    )
  ).split(/\r?\n/);

  if (!branch_2_Activity.length) {
    console.error(
      styleText("red", "Branch: " + branchToMerge + " has nothing to merge.")
    );
    process.exit(1);
  }

  const branch_1_tip = branch_1_Activity[0];
  const branch_2_tip = branch_2_Activity[0];
  // const branch_2_Base = branch_2_Activity[branch_2_Activity.length - 1];

  if (branch_2_tip === branch_1_tip) {
    console.log("Already up to date!");
    process.exit();
  }
  // Detect if fast-forward is possible between the branches
  let canFastforward = false;
  /** Common ancestor by index position: btwn `branch1` and `branch2`, deduced from branch2 line */
  let branch2LineCommonBaseIdx: number | -1 = -1;

  // Logic to get common ancestor/base
  // Find index of latest common ancestor
  branch2LineCommonBaseIdx = branch_2_Activity.findIndex((activity) =>
    branch_1_ActivitySet.has(activity)
  );
  // Find if branch 2 commit is directly ahead of branch 1
  canFastforward =
    branch2LineCommonBaseIdx === -1
      ? false
      : branch_1_tip === branch_2_Activity[branch2LineCommonBaseIdx];

  // 1. Do a fast-forward merge
  if (canFastforward && branch2LineCommonBaseIdx !== -1) {
    const orderedBranch_1_activity = [
      ...branch_2_Activity.slice(0, branch2LineCommonBaseIdx), // NOTE: `slice()` does not include `end` in result
      ...branch_1_Activity,
    ];

    // Diffing files
    // Diff files in tip of both branches
    // This merge base is also the tip of branch 1(in fast-forward)
    const mergeBase = branch_2_Activity[branch2LineCommonBaseIdx];
    const brach2Tip = branch_2_Activity[0];
    const branch_1_TipSnapPath = path.resolve(
      myGitParentDir,
      MYGIT_DIRNAME,
      MYGIT_REPO,
      mergeBase,
      "store"
    );
    const branch_2_TipSnapPath = path.resolve(
      myGitParentDir,
      MYGIT_DIRNAME,
      MYGIT_REPO,
      brach2Tip,
      "store"
    );

    const br_2_SnapshotFiles = await getFilePathsUnderDir(
      undefined,
      branch_2_TipSnapPath
    );

    for (let idx = 0; idx < br_2_SnapshotFiles.length; idx++) {
      // NOTE: It is possible for branch 2 files to be missing in branch 1. A case where new file were created.
      //   const file_1_Path = br_1_SnapshotFiles[idx];
      //   const file_1_Contents = path.join(branch_1_TipSnapPath, file_1_Path);

      const filePath = br_2_SnapshotFiles[idx];
      const br_2_FileContents = await fs.promises.readFile(
        path.join(branch_2_TipSnapPath, filePath),
        "utf-8"
      );
      // Below file read OP has posssibilty of missing file, So we handle `ENOENT` error code that will be thrown
      let br_1_FileContents = "";
      try {
        br_1_FileContents = await fs.promises.readFile(
          path.join(branch_1_TipSnapPath, filePath),
          "utf-8"
        );
      } catch (error) {
        if (error instanceof Error && (error as NodeJS.ErrnoException).code) {
          const fsError = error as NodeJS.ErrnoException;

          // If error is due to file not found then it is a new file getting merged
          if (fsError.code === "ENOENT") {
            br_1_FileContents = "";
          }
        } else {
          console.error(
            styleText("red", "An error occurred in ff merge OP:"),
            error
          );
          process.exit(1);
        }
      }

      beautyDiffsPrint(br_1_FileContents, br_2_FileContents, filePath);
    }

    // Update working directory with latest repo changes
    await synchronizeDestWithSrc({
      src: branch_2_TipSnapPath,
      dest: myGitParentDir,
    });

    // Update branch1 activity
    await fs.promises.writeFile(
      path.resolve(myGitBranchDir, mergeBranch1, MYGIT_BRANCH_ACTIVITY),
      orderedBranch_1_activity.join("\n")
    );
    // Update HEAD
    const headFilePath = path.resolve(
      myGitParentDir,
      MYGIT_DIRNAME,
      MYGIT_HEAD
    );
    const headContent = await fs.promises.readFile(headFilePath, "utf-8");
    const newHeadContent = headContent.replace(
      /@.+$/,
      `@${orderedBranch_1_activity[0]}`
    );
    await fs.promises.writeFile(headFilePath, newHeadContent);
  }

  // 2. Do a 3-way merge
  else if (branch2LineCommonBaseIdx !== -1) {
    // Br 1
    // Br 2
    // Base
    const mergeBase = branch_2_Activity[branch2LineCommonBaseIdx];
    const branch1Tip = branch_1_Activity[0];
    const branch2Tip = branch_2_Activity[0];
    /**`REPO` 'store' path to the version pointed by 'common ancestor' between 'branch 1' and 'branch 2' */
    const mergeBaseSnapPath = path.resolve(
      myGitParentDir,
      MYGIT_DIRNAME,
      MYGIT_REPO,
      mergeBase,
      "store"
    );
    /**`REPO` 'store' path to the version pointed by tip of' branch 1' */
    const branch_1_TipSnapPath = path.resolve(
      myGitParentDir,
      MYGIT_DIRNAME,
      MYGIT_REPO,
      branch1Tip,
      "store"
    );
    /**`REPO` 'store' path to the version pointed by tip of' branch 2' */
    const branch_2_TipSnapPath = path.resolve(
      myGitParentDir,
      MYGIT_DIRNAME,
      MYGIT_REPO,
      branch2Tip,
      "store"
    );

    if (
      !fs.existsSync(mergeBaseSnapPath) ||
      !fs.existsSync(branch_1_TipSnapPath) ||
      !fs.existsSync(branch_2_TipSnapPath)
    ) {
      console.error(
        styleText("red", "Merge could not complete due to missing repository!")
      );
      process.exit(1);
    }

    // get files under 'mergeBase' snapshot store
    const mergeBaseFilesSet = await getFilePathsUnderDir(
      undefined,
      mergeBaseSnapPath
    ).then((filePaths) => new Set(filePaths));
    // get files under 'br 1 tip' snapshot store, then diff against base
    const br_1_SnapshotFiles = await getFilePathsUnderDir(
      undefined,
      branch_1_TipSnapPath
    );

    const br1MergeConflicts: {
      file: string;
      application: string;
      msg: string;
    }[] = [];
    const br2MergeConflicts: {
      file: string;
      application: string;
      msg: string;
    }[] = [];
    const mergeCommitMsg = `Merge '${mergeBranch2}' branch into ${mergeBranch1}`;
    const { repoBase, copyOverVersionDir, new_V_Base, new_V_DirName } =
      await prepNewVersionDir(mergeCommitMsg, mergeBaseSnapPath);

    for (let i = 0; i < br_1_SnapshotFiles.length; i++) {
      const filePath = br_1_SnapshotFiles[i];

      const br1FilePathContents = await fs.promises.readFile(
        path.join(branch_1_TipSnapPath, filePath),
        "utf-8"
      );
      // Files existing in 'branch 1' may be missing in base/ancestor commit since 'branch 1' may have evolved
      let basePathContents: string | undefined;
      try {
        // NOTE: Contents of Base/ancestor commit is copied to `new_V_Base` that will contain merge commit
        basePathContents = await fs.promises.readFile(
          path.join(new_V_Base, filePath),
          "utf-8"
        );
      } catch (error) {
        if (error instanceof Error && (error as NodeJS.ErrnoException).code) {
          const fsError = error as NodeJS.ErrnoException;

          // If error is due to file not found then it is a new file getting merged
          if (fsError.code === "ENOENT") {
            basePathContents = "";
          }
        } else {
          console.error(
            styleText("red", "An error occurred in lvl 1 3-way merge OP: "),
            error
          );
          process.exit(1);
        }
      }

      const br1Patch = Diff.createPatch(
        "br1-applyTo-base",
        basePathContents || "",
        br1FilePathContents
      );

      const patchApplyPath = path.join(new_V_Base, filePath);
      const patchApplyPathContents = await fs.promises
        .readFile(patchApplyPath, "utf-8")
        .catch((err) => "");
      const dirPath = path.dirname(patchApplyPath);

      if (dirPath && !fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }

      const mergedContent = Diff.applyPatch(patchApplyPathContents, br1Patch);
      // This should be less likely to cause conflicts though
      if (mergedContent === false) {
        br1MergeConflicts.push({
          file: filePath,
          msg: "Conflict detected when applying patch",
          application: `${mergeBranch1} onto ${mergeBase}`,
        });
      } else {
        await fs.promises.writeFile(patchApplyPath, mergedContent, {
          encoding: "utf-8",
        });
      }
    }

    // get files under 'br 2 tip' snapshot store, then diff against base
    const br_2_SnapshotFiles = await getFilePathsUnderDir(
      undefined,
      branch_2_TipSnapPath
    );
    for (let i = 0; i < br_2_SnapshotFiles.length; i++) {
      const filePath = br_2_SnapshotFiles[i];

      const br2FilePathContents = await fs.promises.readFile(
        path.join(branch_2_TipSnapPath, filePath),
        "utf-8"
      );
      // Files existing in 'branch 1' may be missing in base/ancestor commit since 'branch 1' may have evolved
      let basePathContents: string | undefined;
      try {
        // NOTE: Contents of Base/ancestor commit is copied to `new_V_Base` that will contain merge commit
        basePathContents = await fs.promises.readFile(
          path.join(new_V_Base, filePath),
          "utf-8"
        );
      } catch (error) {
        if (error instanceof Error && (error as NodeJS.ErrnoException).code) {
          const fsError = error as NodeJS.ErrnoException;

          // If error is due to file not found then it is a new file getting merged
          if (fsError.code === "ENOENT") {
            basePathContents = "";
          }
        } else {
          console.error(
            styleText("red", "An error occurred in lvl 1 3-way merge OP: "),
            error
          );
          process.exit(1);
        }
      }

      const br2Patch = Diff.createPatch(
        "br2-applyTo-base",
        basePathContents || "",
        br2FilePathContents
      );

      const patchApplyPath = path.join(new_V_Base, filePath);
      const patchApplyPathContents = await fs.promises
        .readFile(patchApplyPath, "utf-8")
        .catch((err) => "");
      const dirPath = path.dirname(patchApplyPath);

      if (dirPath && !fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }

      const mergedContent = Diff.applyPatch(patchApplyPathContents, br2Patch);
      // Conflicts more likely with branch2 patch application
      if (mergedContent === false) {
        br2MergeConflicts.push({
          file: filePath,
          msg: "Conflict detected when applying patch",
          application: `${mergeBranch2} onto ${mergeBase}`,
        });
      } else {
        await fs.promises.writeFile(patchApplyPath, mergedContent, {
          encoding: "utf-8",
        });

        beautyDiffsPrint(patchApplyPath, mergedContent, filePath);
      }
    }

    // Log commits that occured
    if (br1MergeConflicts.length || br2MergeConflicts.length) {
      const groupedConflicts = [...br1MergeConflicts, ...br2MergeConflicts];

      console.group("Merge encountered conflicts in the following paths:");
      groupedConflicts.forEach((conflict) => {
        console.log(styleText("red", conflict.file + "\n"));
      });
      console.groupEnd();
      console.log(
        "Changes could not be merged for above path.\nYou can manually apply changes then commit."
      );

      // Undo the merge REPO created. NOTE: This will leave changes aplied to files
      await fs.promises.rm(new_V_Base, { recursive: true });
    }

    // Do commit(Only when there are no conflicts. Otherwise version created is undone)
    else {
      commitCloseRoutine(new_V_DirName);
    }
  } else {
    console.error(
      styleText(
        ["blackBright", "bgRed"],
        "Branches have unrelated history and cannot be merged"
      )
    );
    process.exit(1);
  }
};

function beautyDiffsPrint(
  receivercontent: string,
  producerContents: string,
  filePath: string
) {
  // Console log diffs summary symbols
  const diff = Diff.diffLines(receivercontent, producerContents);
  const editedTkns = diff.reduce(
    (prev, current) => {
      if (current.added) {
        prev.addedCount += 1;
      } else if (current.removed) {
        prev.removedCount += 1;
      }

      return prev;
    },
    {
      addedCount: 0,
      removedCount: 0,
      path: filePath,
    }
  );

  const addedDecoratorSymbol = editedTkns.addedCount
    ? Array.from({ length: editedTkns.addedCount }, () => "+").join("")
    : "";
  const removedDecoratorSymbol = editedTkns.removedCount
    ? Array.from({ length: editedTkns.removedCount }, () => "-").join("")
    : "";

  if (addedDecoratorSymbol || removedDecoratorSymbol) {
    console.log(
      `${editedTkns.path}: ${styleText(
        "green",
        addedDecoratorSymbol
      )}${styleText("red", removedDecoratorSymbol)}`
    );
  }
}
