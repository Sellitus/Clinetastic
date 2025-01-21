# Clinetastic

A fork of Cline, an autonomous coding agent. This fork aims to provide a streamlined experience while maintaining the powerful core capabilities of Cline.

## Features

- **Code Mode:** The default mode where Clinetastic helps you write code and execute tasks.
- **Architect Mode:** For thinking through high-level technical design and system architecture.
- **Ask Mode:** Perfect for asking questions about the codebase or digging into concepts.

## Disclaimer

This software is provided "AS IS", without warranty of any kind, express or implied. You assume all risks associated with the use of any tools or outputs. Such risks may include, without limitation, intellectual property infringement, cyber vulnerabilities or attacks, bias, inaccuracies, errors, defects, viruses, downtime, property loss or damage, and/or personal injury. You are solely responsible for your use of any such tools or outputs (including, without limitation, the legality, appropriateness, and results thereof).

## Contributing

### Local Setup

1. Install dependencies:

    ```bash
    npm run install:all
    ```

2. Build the VSIX file:
    ```bash
    npm run build
    ```
3. The new VSIX file will be created in the `bin/` directory
4. Install the extension from the VSIX file as described below:

    - **Option 1:** Drag and drop the `.vsix` file into your VSCode-compatible editor's Extensions panel (Cmd/Ctrl+Shift+X).

    - **Option 2:** Install the plugin using the CLI, make sure you have your VSCode-compatible CLI installed and in your `PATH` variable.

    ```bash
    # Ex: code --install-extension bin/clinetastic-1.0.0.vsix
    ```

5. Launch by pressing `F5` (or `Run`->`Start Debugging`) to open a new VSCode window with the extension loaded. (You may need to install the [esbuild problem matchers extension](https://marketplace.visualstudio.com/items?itemName=connor4312.esbuild-problem-matchers) if you run into issues building the project.)

### Publishing

We use [changesets](https://github.com/changesets/changesets) for versioning and publishing this package. To make changes:

1. Create a PR with your changes
2. Create a new changeset by running `npm run changeset`
    - Select the appropriate kind of change - `patch` for bug fixes, `minor` for new features, or `major` for breaking changes
    - Write a clear description of your changes that will be included in the changelog
3. Get the PR approved and pass all checks
4. Merge it

Once your merge is successful:

- The release workflow will automatically create a new "Changeset version bump" PR
- This PR will:
    - Update the version based on your changeset
    - Update the `CHANGELOG.md` file
- Once the PR is approved and merged, a new version will be published

---

# Core Capabilities

Meet Clinetastic, an AI assistant that can use your **CLI** a**N**d **E**ditor.

Thanks to Claude's agentic coding capabilities, Clinetastic can handle complex software development tasks step-by-step. With tools that let him create & edit files, explore large projects, use the browser, and execute terminal commands (after you grant permission), he can assist you in ways that go beyond code completion or tech support. Clinetastic can even use the Model Context Protocol (MCP) to create new tools and extend his own capabilities.

1. Enter your task and add images to convert mockups into functional apps or fix bugs with screenshots.
2. Clinetastic starts by analyzing your file structure & source code ASTs, running regex searches, and reading relevant files to get up to speed in existing projects. By carefully managing what information is added to context, Clinetastic can provide valuable assistance even for large, complex projects without overwhelming the context window.
3. Once Clinetastic has the information he needs, he can:
    - Create and edit files + monitor linter/compiler errors along the way, letting him proactively fix issues like missing imports and syntax errors on his own.
    - Execute commands directly in your terminal and monitor their output as he works, letting him e.g., react to dev server issues after editing a file.
    - For web development tasks, Clinetastic can launch the site in a headless browser, click, type, scroll, and capture screenshots + console logs, allowing him to fix runtime errors and visual bugs.
4. When a task is completed, Clinetastic will present the result to you with a terminal command like `open -a "Google Chrome" index.html`, which you run with a click of a button.

> [!TIP]
> Use the `CMD/CTRL + Shift + P` shortcut to open the command palette and type "Clinetastic: Open In New Tab" to open the extension as a tab in your editor. This lets you use Clinetastic side-by-side with your file explorer, and see how he changes your workspace more clearly.

## License

[Apache 2.0](./LICENSE)
