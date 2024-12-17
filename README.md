# `mygit` ― A Distributed Source Control System (Git-like)

This project implements a distributed source control system in the style of Git. It is called `mygit`. It provides core functionalities required for version control, such as initializing repositories, staging files, committing changes, and more. The tool is built to manage repositories on the local disk and is designed to be used as a CLI tool.

## Features

- **Initialize Repository**: Create a repository in a directory, with the repository data stored in a `.mygit` subdirectory.
- **Staging Files**: Add files to the staging area. (`mygit add .`)
- **Committing Changes**: Commit staged files with _messages_.
- **Branching**: Create and switch between branches.
- **Merging**: Merge branches with parallel work into mainline. _Fast-forward_ and _3-way merge_ are intelligently used to merge.
- **Conflicts marking**: Conflicts are detected during merge and affected region in files are marked with symbols: `<<<<<<<`, `=======` and `>>>>>>>`.(conflicts require manual resolution)
- **File Ignoring**: Specify files to be ignored during commits in `.mygitignore` file. Will look for `.gitignore` file if missing.
- **Viewing Commit History**: View the commit history with detailed information in a colorized output.

  ### Upcoming features

  - **Diffs**: View differences between commits and branches.
  - **Cloning Repositories**: Clone a repository locally, copying the contents of the original repository to a new directory.

The project doesn't yet include advanced features like rebasing or conflict resolution beyond detection, but it covers the essential functionalities of version control systems like Git.

## Software requirements

`mygit` is **platform agnostic**. It runs on node.js.  
You need to ensure you have [_node.js_](https://nodejs.org/en/download/package-manager) installed on your machine. The recommended version is at least version **>=20**.

## Installation

1. **Clone the repository**:

   ```bash
   git clone https://github.com/hane-smitter/mygit.git
   cd mygit
   ```

2. **Install dependencies**:

   ```bash
   npm install
   ```

3. **Build CLI tool**:

   ```bash
   npm run build
   ```

4. **Link the CLI tool globally**:
   After cloning the project and building, use the `npm link` command to make the tool available globally on your machine.

   ```bash
   npm link
   ```

   This will allow you to use the `mygit` command in any repository.

## Usage

Once the project is linked globally, you can use it directly from the command line. Here are some example commands:

- **Initialize a repository**:

  ```bash
  mygit init
  ```

  This creates a new repository in the current directory, storing the repository data in a `.mygit` subdirectory.

- **Stage files**:

  ```bash
  mygit add <file1> <file2> ...
  ```

  This stages the specified files, preparing them for commit.  
  Alternatively, you can use:

  ```bash
  mygit add .
  ```

  This will intelligently pick files that are modified in your repository, and stage them preparing for commit.

- **Commit changes**:

  ```bash
  mygit commit -m "Commit message"
  ```

  This commits the staged changes with the provided commit message.

- **View commit history**:

  ```bash
  mygit log
  ```

  This displays the commit history, showing commit hashes, messages, and timestamps.

  <figure>
    <img width=900 src="https://raw.githubusercontent.com/hane-smitter/mygit/refs/heads/assets/mygit-commit-hist2.jpg" alt="commit history looge from CLI too called mygit" />
    <figcaption>Sample output of <code>mygit log</code></figcaption>
  </figure>

- **Create branches**:

  ```bash
  mygit branch <branch-name>
  ```

  This creates a new branch.

  - **Switch branches**:

  ```bash
  mygit switch <branch-name>
  ```

  This switches to a created branch.

- **Merge branches**:

  ```bash
  mygit merge <branch-name>
  ```

  This merges the specified branch into the current branch, with conflict detection.  
  Currently fast-forward merge is fully supported. 3-way merge works but refinements still needed which is work tracked under progress and will be fully stable soon.

<!-- - **View diffs**:

  ```bash
  mygit diff <commit-hash1> <commit-hash2>
  ```

  This shows the differences between two commits or branches. -->

- **Ignore files**:
  Create a `.mygitignore` file in your repository root and list the files to be ignored.  
  It accepts the same patterns as `git`.

<!-- - **Clone a repository**:
  ```bash
  mygit clone <source-directory> <destination-directory>
  ```
  This clones the repository from the source directory to the destination directory. -->

## Contribution

Feel free to open issues or submit pull requests to contribute to the project. Contributions are welcome!

## License

Distributed under the _MIT_ License. See `LICENSE` for more information.

## Author

[Zacky](https://lookupzach.netlify.app)

---

### Star✨ the project if you think you've seen some good work👍