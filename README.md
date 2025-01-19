# Clinetastic

A next-generation autonomous coding agent focused on token efficiency and model flexibility. Built as a fork of Cline, Clinetastic aims to revolutionize AI-assisted development through smarter context management and adaptive decision-making.

## Vision & Goals

Clinetastic is evolving the autonomous coding agent paradigm with:

- **Token Efficiency**: Smart context management and surgical precision in API requests
- **Model Flexibility**: Seamless adaptation to different AI models and their unique capabilities
- **Intelligent Decision Making**: Enhanced ability to choose optimal approaches based on task context
- **Extensible Architecture**: Modular design enabling easy addition of new capabilities

## Key Features

### 💡 Intelligent Context Management

- Dynamic sliding window for optimal token usage
- Smart file chunking and context prioritization
- Surgical precision in code modifications using diffs
- Efficient handling of large codebases

### 🔄 Model Adaptability

- Support for multiple AI providers (OpenAI, Anthropic, Google, etc.)
- Dynamic capability detection and adaptation
- Optimal prompt strategies per model
- Easy configuration switching between models

### 🛠 Core Capabilities

#### File Operations

- Create and edit files with surgical precision
- Smart diff-based modifications
- Automatic error detection and correction
- Built-in linting and formatting support

#### Terminal Integration

- Execute commands with real-time output monitoring
- Intelligent command chaining
- Environment-aware operations
- Safe execution with approval system

#### Browser Integration

- Interactive debugging and testing
- Visual verification of changes
- Console log monitoring
- End-to-end testing capabilities

#### Model Context Protocol (MCP)

- Extensible tool creation
- Custom capability integration
- API integrations (GitHub, Jira, etc.)
- Workflow automation

## Getting Started

1. Install dependencies:

    ```bash
    npm run install:all
    ```

2. Build the VSIX file:

    ```bash
    npm run build
    ```

3. Install the extension:
    - Option 1: Drag and drop the `.vsix` file into VSCode's Extensions panel
    - Option 2: Use the CLI:
        ```bash
        code --install-extension bin/clinetastic-1.0.0.vsix
        ```

## Usage Tips

- Use `CMD/CTRL + Shift + P` and type "Clinetastic: Open In New Tab" for side-by-side view
- Leverage @-mentions for efficient context addition:
    - `@url`: Add web documentation
    - `@problems`: Include workspace diagnostics
    - `@file`: Add specific file contents
    - `@folder`: Include entire directory contents

## Contributing

We welcome contributions! Whether it's bug fixes, feature additions, or documentation improvements, your help makes Clinetastic better.

### Development Setup

1. Install dependencies:

    ```bash
    npm run install:all
    ```

2. Launch with F5 or Run -> Start Debugging

Note: You may need the [esbuild problem matchers extension](https://marketplace.visualstudio.com/items?itemName=connor4312.esbuild-problem-matchers).

## License

Apache 2.0 © 2024
