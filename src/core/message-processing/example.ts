import { createMessageProcessor, createMessageContext, Tool, ToolResult, ToolHooks } from "./index"

/**
 * Example tool implementation
 */
class ReadFileTool implements Tool {
	name = "read_file"
	description = "Read contents of a file"

	async execute(params: Record<string, any>): Promise<ToolResult> {
		try {
			const { path } = params
			// Simulated file read
			const content = `Content of file at ${path}`

			return {
				success: true,
				content,
			}
		} catch (error) {
			return {
				success: false,
				content: "",
				error: error instanceof Error ? error : new Error(String(error)),
			}
		}
	}

	validate(params: Record<string, any>): boolean {
		return typeof params.path === "string" && params.path.length > 0
	}

	getParameterSchema(): Record<string, any> {
		return {
			path: {
				type: "string",
				required: true,
				description: "Path to the file to read",
			},
		}
	}
}

/**
 * Example hooks implementation
 */
const hooks: ToolHooks = {
	async beforeExecution(context) {
		console.log(`Executing tool: ${context.toolExecution?.toolName}`)
	},
	async afterExecution(result) {
		console.log(`Tool execution ${result.success ? "succeeded" : "failed"}`)
	},
	async onError(error) {
		console.error("Tool execution error:", error)
	},
}

/**
 * Example usage
 */
async function example() {
	// Create processor with tools and hooks
	const processor = createMessageProcessor({
		tools: [new ReadFileTool()],
		hooks,
	})

	// Create message context
	const context = createMessageContext("<read_file><path>example.txt</path></read_file>", "code", {
		workingDirectory: "/path/to/workspace",
		visibleFiles: ["example.txt"],
		openTabs: ["example.txt"],
		activeTerminals: [],
		currentTime: new Date(),
		mode: "code",
	})

	try {
		// Process message
		const result = await processor.process(context)

		if (result.success) {
			console.log("Processing succeeded:", result.content)
			if (result.toolResult) {
				console.log("Tool result:", result.toolResult.content)
			}
		} else {
			console.error("Processing failed:", result.error)
		}
	} catch (error) {
		console.error("Processing error:", error)
	}
}

// Run example
example().catch(console.error)

/**
 * This example demonstrates:
 * 1. Creating a custom tool implementation
 * 2. Setting up hooks for monitoring tool execution
 * 3. Creating a message processor with tools and hooks
 * 4. Processing a message with tool usage
 * 5. Handling results and errors
 *
 * Expected output:
 * > Executing tool: read_file
 * > Tool execution succeeded
 * > Processing succeeded:
 * > Tool result: Content of file at example.txt
 */
