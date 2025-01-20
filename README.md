# Clinetastic

A next-generation autonomous coding agent focused on token efficiency and model flexibility. Built as a fork of Cline, Clinetastic revolutionizes AI-assisted development through smarter context management and adaptive decision-making.

## Features

### 💡 Intelligent Context Management

- **Dynamic Sliding Window**: Automatically manages context size for optimal token usage
- **Semantic Chunking**: Intelligently breaks down large files and codebases
- **Knowledge Graph Integration**: Maintains relationships between code components
- **Smart File Operations**: Uses diff-based modifications for surgical precision
- **Efficient Token Usage**: Optimizes API requests through context prioritization

### 🤖 AI Model Support

- **Multiple Providers**:

    - OpenAI (GPT-3.5, GPT-4)
    - Anthropic (Claude)
    - Google (Gemini)
    - Mistral AI
    - AWS Bedrock
    - Vertex AI
    - OpenRouter
    - Local Models (LM Studio, Ollama)
    - VSCode Language Models

- **Model Adaptability**:
    - Dynamic capability detection
    - Provider-specific optimizations
    - Automatic prompt formatting
    - Seamless fallback handling

### 🛠 Core Tools

#### File Operations

- Create and modify files with surgical precision
- Smart diff-based modifications
- Automatic directory creation
- Binary file detection
- PDF and DOCX parsing support

#### Terminal Integration

- Execute commands with real-time monitoring
- Environment-aware operations
- Configurable allowed commands
- Intelligent command chaining
- Safe execution with approval system

#### Browser Integration

- Interactive webpage testing
- Visual verification of changes
- Console log monitoring
- Screenshot capabilities
- Click and type simulation

#### Model Context Protocol (MCP)

- Custom tool creation
- External API integration
- Resource management
- Workflow automation
- Extensible architecture

### 📊 Advanced Features

- **@-mentions for Context**:

    - `@url`: Add web documentation
    - `@problems`: Include workspace diagnostics
    - `@file`: Add specific file contents
    - `@folder`: Include entire directory contents

- **Knowledge Management**:

    - Code relationship tracking
    - Semantic understanding
    - Context prioritization
    - Memory optimization

- **Error Handling**:
    - Automatic error detection
    - Smart recovery strategies
    - Detailed error reporting
    - Linting integration

## Installation

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

## Configuration

### VSCode Settings

- `clinetastic.allowedCommands`: Configure auto-approved commands
- `clinetastic.vsCodeLmModelSelector`: Configure VSCode Language Model settings

### Model Configuration

1. Configure API keys in VSCode settings
2. Select preferred model provider
3. Adjust model-specific settings (temperature, context size, etc.)

## Usage

### Basic Commands

- `Clinetastic: Open In New Tab`: Open in editor view
- `Clinetastic: New Task`: Start a new task
- `Clinetastic: MCP Servers`: Manage MCP integrations
- `Clinetastic: Prompts`: Access prompt templates
- `Clinetastic: History`: View task history
- `Clinetastic: Settings`: Configure extension

### Context Management

Use @-mentions to add specific context:

```
@file src/main.ts
@folder src/utils
@url https://docs.example.com
@problems
```

### MCP Integration

1. Create custom tools using the MCP SDK
2. Configure tool settings in MCP configuration
3. Access tools through the MCP interface
4. Manage resources and capabilities

## Development

### Setup

1. Install dependencies:

    ```bash
    npm run install:all
    ```

2. Launch with debugging:
    - Press F5 or select Run -> Start Debugging

### Testing

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:webview
npm run test:extension
```

### Building

```bash
# Build extension
npm run build

# Build webview only
npm run build:webview

# Create VSIX package
npm run vsix
```

### Code Quality

- TypeScript for type safety
- ESLint for code quality
- Prettier for formatting
- Jest for testing
- Husky for git hooks

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## Requirements

- VSCode 1.84.0 or higher
- Node.js 20.x
- npm 9.x or higher

## License

Apache 2.0 © 2024
