const vscode = {
	window: {
		showInformationMessage: jest.fn(),
		showErrorMessage: jest.fn(),
		createTextEditorDecorationType: jest.fn().mockReturnValue({
			dispose: jest.fn(),
		}),
		createWebviewPanel: jest.fn().mockReturnValue({
			webview: {
				options: {},
				html: "",
				onDidReceiveMessage: jest.fn(),
				postMessage: jest.fn(),
			},
			dispose: jest.fn(),
		}),
	},
	workspace: {
		onDidSaveTextDocument: jest.fn(),
	},
	extensions: {
		getExtension: jest.fn().mockReturnValue({
			activate: jest.fn().mockResolvedValue({
				sidebarProvider: {
					updateGlobalState: jest.fn().mockResolvedValue(undefined),
					storeSecret: jest.fn().mockResolvedValue(undefined),
					readOpenRouterModels: jest.fn().mockResolvedValue({
						"anthropic/claude-3.5-sonnet:beta": {},
						"anthropic/claude-3-sonnet:beta": {},
						"anthropic/claude-3.5-sonnet": {},
						"anthropic/claude-3.5-sonnet-20240620": {},
						"anthropic/claude-3.5-sonnet-20240620:beta": {},
						"anthropic/claude-3.5-haiku:beta": {},
					}),
					refreshOpenRouterModels: jest.fn().mockResolvedValue(undefined),
					resolveWebviewView: jest.fn(),
					postMessageToWebview: jest.fn().mockResolvedValue(undefined),
					getState: jest.fn().mockResolvedValue({
						taskHistory: [{ tokensOut: 10 }],
					}),
					clineMessages: [{ type: "say", text: "I am Cline" }],
					cline: {
						clineMessages: [{ type: "say", text: "I am Cline" }],
					},
				},
				startNewTask: jest.fn().mockResolvedValue(undefined),
			}),
			isActive: true,
			extensionUri: { fsPath: "/test/extension/path" },
		}),
	},
	commands: {
		getCommands: jest
			.fn()
			.mockResolvedValue([
				"clinetastic.plusButtonClicked",
				"clinetastic.mcpButtonClicked",
				"clinetastic.historyButtonClicked",
				"clinetastic.popoutButtonClicked",
				"clinetastic.settingsButtonClicked",
				"clinetastic.openInNewTab",
			]),
	},
	Disposable: class {
		dispose() {}
	},
	Uri: {
		file: (path) => ({
			fsPath: path,
			scheme: "file",
			authority: "",
			path: path,
			query: "",
			fragment: "",
			with: jest.fn(),
			toJSON: jest.fn(),
		}),
	},
	EventEmitter: class {
		constructor() {
			this.event = jest.fn()
			this.fire = jest.fn()
		}
	},
	ConfigurationTarget: {
		Global: 1,
		Workspace: 2,
		WorkspaceFolder: 3,
	},
	Position: class {
		constructor(line, character) {
			this.line = line
			this.character = character
		}
	},
	Range: class {
		constructor(startLine, startCharacter, endLine, endCharacter) {
			this.start = new vscode.Position(startLine, startCharacter)
			this.end = new vscode.Position(endLine, endCharacter)
		}
	},
	ThemeColor: class {
		constructor(id) {
			this.id = id
		}
	},
	ViewColumn: {
		One: 1,
		Two: 2,
		Three: 3,
	},
}

module.exports = vscode
