import * as vscode from "vscode"
import * as path from "path"

export class ClineProvider {
	context: vscode.ExtensionContext
	outputChannel: vscode.OutputChannel

	constructor(context: vscode.ExtensionContext, outputChannel: vscode.OutputChannel) {
		this.context = context
		this.outputChannel = outputChannel
	}

	async ensureSettingsDirectoryExists(): Promise<string> {
		return process.env.TEST_SETTINGS_PATH || "/mock/settings/path"
	}

	async ensureMcpServersDirectoryExists(): Promise<string> {
		return process.env.TEST_MCP_SERVERS_PATH || "/mock/mcp/servers/path"
	}

	async postMessageToWebview(): Promise<void> {
		return Promise.resolve()
	}

	async postStateToWebview(): Promise<void> {
		return Promise.resolve()
	}

	async getState(): Promise<any> {
		return {
			alwaysApproveResubmit: false,
			requestDelaySeconds: 5,
			mode: "code",
			mcpEnabled: true,
		}
	}

	async updateGlobalState(): Promise<void> {
		return Promise.resolve()
	}

	async storeSecret(): Promise<void> {
		return Promise.resolve()
	}

	async readOpenRouterModels(): Promise<any> {
		return {}
	}

	async refreshOpenRouterModels(): Promise<void> {
		return Promise.resolve()
	}

	async getTaskWithId(id: string) {
		return {
			historyItem: {
				id,
				ts: Date.now(),
				task: "historical task",
				tokensIn: 100,
				tokensOut: 200,
				cacheWrites: 0,
				cacheReads: 0,
				totalCost: 0.001,
			},
			taskDirPath: path.join(process.env.TEST_TEMP_DIR || "/mock/storage/path", "tasks", id),
			apiConversationHistoryFilePath: path.join(
				process.env.TEST_TEMP_DIR || "/mock/storage/path",
				"tasks",
				id,
				"api_conversation_history.json",
			),
			uiMessagesFilePath: path.join(
				process.env.TEST_TEMP_DIR || "/mock/storage/path",
				"tasks",
				id,
				"ui_messages.json",
			),
			apiConversationHistory: [],
		}
	}

	dispose(): void {
		// Cleanup
	}
}
