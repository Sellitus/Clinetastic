const mockDisposable = { dispose: jest.fn() }
const mockEventEmitter = {
	event: jest.fn(),
	fire: jest.fn(),
}

const mockTextDocument = {
	uri: {
		fsPath: "/mock/workspace/path/file.ts",
	},
}

const mockTextEditor = {
	document: mockTextDocument,
}

const mockTab = {
	input: {
		uri: {
			fsPath: "/mock/workspace/path/file.ts",
		},
	},
}

const mockTabGroup = {
	tabs: [mockTab],
}

const mockFileSystemWatcher = {
	onDidCreate: jest.fn(() => mockDisposable),
	onDidDelete: jest.fn(() => mockDisposable),
	onDidChange: jest.fn(() => mockDisposable),
	dispose: jest.fn(),
}

module.exports = {
	window: {
		createTextEditorDecorationType: jest.fn().mockReturnValue({
			dispose: jest.fn(),
		}),
		visibleTextEditors: [mockTextEditor],
		tabGroups: {
			all: [mockTabGroup],
		},
		showInformationMessage: jest.fn(),
		showErrorMessage: jest.fn(),
		showWarningMessage: jest.fn(),
	},
	workspace: {
		workspaceFolders: [
			{
				uri: {
					fsPath: "/mock/workspace/path",
				},
				name: "mock-workspace",
				index: 0,
			},
		],
		createFileSystemWatcher: jest.fn(() => mockFileSystemWatcher),
		fs: {
			stat: jest.fn().mockResolvedValue({ type: 1 }), // FileType.File = 1
		},
		onDidSaveTextDocument: jest.fn(() => mockDisposable),
		onDidChangeConfiguration: jest.fn(() => mockDisposable),
	},
	env: {
		uriScheme: "vscode",
		language: "en",
		openExternal: jest.fn(),
	},
	EventEmitter: jest.fn().mockImplementation(() => mockEventEmitter),
	Disposable: {
		from: jest.fn(),
	},
	TabInputText: jest.fn(),
	Uri: {
		parse: jest.fn(),
	},
	FileType: {
		File: 1,
		Directory: 2,
		SymbolicLink: 64,
	},
	FileSystemError: {
		FileNotFound: jest.fn(),
		FileExists: jest.fn(),
		NoPermissions: jest.fn(),
	},
	ConfigurationTarget: {
		Global: 1,
		Workspace: 2,
		WorkspaceFolder: 3,
	},
	LanguageModelChat: jest.fn(),
	LanguageModelChatMessage: {
		Assistant: jest.fn(),
		User: jest.fn(),
	},
	LanguageModelTextPart: jest.fn(),
	LanguageModelToolCallPart: jest.fn(),
	CancellationTokenSource: jest.fn(() => ({
		token: {
			isCancellationRequested: false,
			onCancellationRequested: jest.fn(),
		},
		cancel: jest.fn(),
		dispose: jest.fn(),
	})),
	CancellationError: class extends Error {
		constructor() {
			super("Operation cancelled")
			this.name = "CancellationError"
		}
	},
	lm: {
		selectChatModels: jest.fn(),
	},
}
