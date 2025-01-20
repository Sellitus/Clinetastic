import * as vscode from "vscode"
import * as assert from "assert"
import * as path from "path"
import * as dotenv from "dotenv"

// Load test environment variables
const testEnvPath = path.join(__dirname, ".test_env")
dotenv.config({ path: testEnvPath })

suite("Clinetastic Extension Test Suite", () => {
	let activePanel: vscode.WebviewPanel | undefined
	let providers: any[] = []

	// Cleanup after each test
	afterEach(async () => {
		if (activePanel) {
			activePanel.dispose()
			activePanel = undefined
		}
	})

	// Global cleanup
	afterAll(async () => {
		// Clean up any remaining panels
		if (activePanel) {
			activePanel.dispose()
			activePanel = undefined
		}

		// Clean up any providers
		for (const provider of providers) {
			if (provider?.dispose) {
				await provider.dispose()
			}
		}
		providers = []

		// Force garbage collection
		if (global.gc) {
			global.gc()
		}
	})

	vscode.window.showInformationMessage("Starting Clinetastic extension tests.")

	test("Extension should be present", () => {
		const extension = vscode.extensions.getExtension("RooVeterinaryInc.clinetastic")
		assert.notStrictEqual(extension, undefined)
	})

	test("Extension should activate", async () => {
		const extension = vscode.extensions.getExtension("RooVeterinaryInc.clinetastic")
		if (!extension) {
			assert.fail("Extension not found")
		}
		await extension.activate()
		assert.strictEqual(extension.isActive, true)
	})

	test("OpenRouter API key and models should be configured correctly", async function () {
		// @ts-ignore
		this.timeout(60000) // Increase timeout to 60s for network requests

		// Get extension instance
		const extension = vscode.extensions.getExtension("RooVeterinaryInc.clinetastic")
		assert.notStrictEqual(extension, undefined, "Extension not found")
		if (!extension) {
			assert.fail("Extension not found")
		}

		// Verify API key is set and valid
		const apiKey = process.env.OPEN_ROUTER_API_KEY
		assert.notStrictEqual(apiKey, undefined, "OPEN_ROUTER_API_KEY environment variable is not set")
		assert.strictEqual(apiKey?.startsWith("sk-or-v1-"), true, "OpenRouter API key should have correct format")

		// Activate extension and get provider
		const api = await extension.activate()
		assert.notStrictEqual(api, undefined, "Extension API not found")

		// Get the provider from the extension's exports
		const provider = api.sidebarProvider
		assert.notStrictEqual(provider, undefined, "Provider not found")
		providers.push(provider)

		// Set up the API configuration
		await provider.updateGlobalState("apiProvider", "openrouter")
		await provider.storeSecret("openRouterApiKey", apiKey)

		// Trigger model loading
		await provider.refreshOpenRouterModels()

		// Wait for models with timeout
		const startTime = Date.now()
		const timeout = 30000
		let models = null

		while (Date.now() - startTime < timeout) {
			models = await provider.readOpenRouterModels()
			if (models) break
			await new Promise((resolve) => setTimeout(resolve, 1000))
		}

		assert.notStrictEqual(models, null, "Timeout waiting for models to load")

		// Verify expected Claude models are available
		const expectedModels = [
			"anthropic/claude-3.5-sonnet:beta",
			"anthropic/claude-3-sonnet:beta",
			"anthropic/claude-3.5-sonnet",
			"anthropic/claude-3.5-sonnet-20240620",
			"anthropic/claude-3.5-sonnet-20240620:beta",
			"anthropic/claude-3.5-haiku:beta",
		]

		for (const modelId of expectedModels) {
			assert.strictEqual(modelId in models, true, `Model ${modelId} should be available`)
		}
	})

	test("Commands should be registered", async () => {
		const commands = await vscode.commands.getCommands(true)

		// Test core commands are registered
		const expectedCommands = [
			"clinetastic.plusButtonClicked",
			"clinetastic.mcpButtonClicked",
			"clinetastic.historyButtonClicked",
			"clinetastic.popoutButtonClicked",
			"clinetastic.settingsButtonClicked",
			"clinetastic.openInNewTab",
		]

		for (const cmd of expectedCommands) {
			assert.strictEqual(commands.includes(cmd), true, `Command ${cmd} should be registered`)
		}
	})

	test("Views should be registered", () => {
		activePanel = vscode.window.createWebviewPanel(
			"clinetastic.SidebarProvider",
			"Clinetastic",
			vscode.ViewColumn.One,
			{},
		)
		assert.notStrictEqual(activePanel, undefined)
	})

	test("Should handle prompt and response correctly", async function () {
		// @ts-ignore
		this.timeout(60000) // Increase timeout for API request

		const timeout = 30000
		const interval = 1000

		// Get extension instance
		const extension = vscode.extensions.getExtension("RooVeterinaryInc.clinetastic")
		assert.notStrictEqual(extension, undefined, "Extension not found")
		if (!extension) {
			assert.fail("Extension not found")
		}

		// Activate extension and get API
		const api = await extension.activate()
		assert.notStrictEqual(api, undefined, "Extension API not found")

		// Get provider
		const provider = api.sidebarProvider
		assert.notStrictEqual(provider, undefined, "Provider not found")
		providers.push(provider)

		// Set up API configuration
		await provider.updateGlobalState("apiProvider", "openrouter")
		await provider.updateGlobalState("openRouterModelId", "anthropic/claude-3.5-sonnet")
		const apiKey = process.env.OPEN_ROUTER_API_KEY
		assert.notStrictEqual(apiKey, undefined, "OPEN_ROUTER_API_KEY environment variable is not set")
		await provider.storeSecret("openRouterApiKey", apiKey)

		// Create webview panel with development options
		const extensionUri = extension.extensionUri
		activePanel = vscode.window.createWebviewPanel(
			"clinetastic.SidebarProvider",
			"Clinetastic",
			vscode.ViewColumn.One,
			{
				enableScripts: true,
				enableCommandUris: true,
				retainContextWhenHidden: true,
				localResourceRoots: [extensionUri],
			},
		)

		// Store original postMessage for cleanup
		const originalPostMessage = provider.postMessageToWebview.bind(provider)

		try {
			// Initialize webview with development context
			activePanel.webview.options = {
				enableScripts: true,
				enableCommandUris: true,
				localResourceRoots: [extensionUri],
			}

			// Initialize provider with panel
			provider.resolveWebviewView(activePanel)

			// Set up message tracking
			let webviewReady = false
			let messagesReceived = false
			// @ts-ignore
			provider.postMessageToWebview = async (message) => {
				if (message.type === "state") {
					webviewReady = true
					if (message.state?.clineMessages?.length > 0) {
						messagesReceived = true
					}
				}
				await originalPostMessage(message)
			}

			// Wait for webview to launch and receive initial state
			let startTime = Date.now()
			while (Date.now() - startTime < timeout && !webviewReady) {
				await new Promise((resolve) => setTimeout(resolve, interval))
			}

			assert.strictEqual(webviewReady, true, "Timeout waiting for webview to be ready")

			// Send webviewDidLaunch to initialize chat
			await provider.postMessageToWebview({ type: "webviewDidLaunch" })

			// Wait for OpenRouter models to be fully loaded
			startTime = Date.now()
			while (Date.now() - startTime < timeout) {
				const models = await provider.readOpenRouterModels()
				if (models && Object.keys(models).length > 0) break
				await new Promise((resolve) => setTimeout(resolve, interval))
			}

			// Send prompt
			const prompt = "Hello world, what is your name?"
			await api.startNewTask(prompt)

			// Wait for task to appear in history with tokens
			startTime = Date.now()
			while (Date.now() - startTime < timeout) {
				const state = await provider.getState()
				const task = state.taskHistory?.[0]
				if (task && task.tokensOut > 0) break
				await new Promise((resolve) => setTimeout(resolve, interval))
			}

			// Wait for messages to be processed
			startTime = Date.now()
			let responseReceived = false
			while (Date.now() - startTime < timeout && !responseReceived) {
				// Check provider.clineMessages
				const messages = provider.clineMessages
				if (messages && messages.length > 0) {
					// @ts-ignore
					responseReceived = messages.some(
						(m: { type: string; text: string }) =>
							m.type === "say" && m.text && m.text.toLowerCase().includes("cline"),
					)
				}

				// Check provider.cline.clineMessages
				const clineMessages = provider.cline?.clineMessages
				if (clineMessages && clineMessages.length > 0) {
					// @ts-ignore
					responseReceived = clineMessages.some(
						(m: { type: string; text: string }) =>
							m.type === "say" && m.text && m.text.toLowerCase().includes("cline"),
					)
				}

				if (!responseReceived) {
					await new Promise((resolve) => setTimeout(resolve, interval))
				}
			}

			assert.strictEqual(responseReceived, true, 'Did not receive expected response containing "Cline"')
		} finally {
			// Restore original postMessage
			provider.postMessageToWebview = originalPostMessage

			// Clean up webview panel
			if (activePanel) {
				activePanel.dispose()
				activePanel = undefined
			}

			// Clean up provider
			if (provider?.dispose) {
				await provider.dispose()
			}
		}
	})
})
