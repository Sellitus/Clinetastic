import {
	MessageContext,
	MessageProcessor as IMessageProcessor,
	ProcessingResult,
	Tool,
	ToolHooks,
	PipelineStage,
} from "./types"
import { EnhancedPipeline } from "./pipeline/EnhancedPipeline"
import { EnhancedPipelineStage } from "./pipeline/types"
import { EnhancedValidationStage } from "./stages/EnhancedValidationStage"
import { adaptStage, enhanceStage } from "./pipeline/StageAdapter"
import fs from "fs/promises" // Import fs module

const requestFileContentTool = {
	name: "request_file_content",
	description: "Requests the content of a specific file.",
	validate: (params: any) => {
		return typeof params === "object" && params !== null && typeof params.path === "string"
	},
	execute: async (params: { path: string }) => {
		try {
			const content = await fs.readFile(params.path, "utf-8")
			return { success: true, content: content, error: undefined } // Ensure error is explicitly undefined
		} catch (error: any) {
			return { success: false, content: "", error: error.message } // Provide an empty string for content on error
		}
	},
	getParameterSchema: () => ({
		type: "object",
		properties: {
			path: {
				type: "string",
				description: "The path to the file to read.",
			},
		},
		required: ["path"],
	}),
}

const codeExplanationTool = {
	name: "code_explanation",
	description: "Explains a selected block of code.",
	validate: (params: any) => {
		return (
			typeof params === "object" &&
			params !== null &&
			typeof params.path === "string" &&
			typeof params.startLine === "number" &&
			typeof params.endLine === "number"
		)
	},
	execute: async (params: { path: string; startLine: number; endLine: number }) => {
		try {
			const content = await fs.readFile(params.path, "utf-8")
			const lines = content.split("\n").slice(params.startLine - 1, params.endLine)
			const codeSnippet = lines.join("\n")
			// In a real implementation, this would involve calling an LLM
			// For now, we'll just return the code snippet itself.
			return { success: true, content: `Explanation for:\n${codeSnippet}\n(LLM explanation would go here)` }
		} catch (error: any) {
			return { success: false, content: "", error: error.message }
		}
	},
	getParameterSchema: () => ({
		type: "object",
		properties: {
			path: {
				type: "string",
				description: "The path to the file containing the code.",
			},
			startLine: {
				type: "number",
				description: "The starting line number of the code block.",
			},
			endLine: {
				type: "number",
				description: "The ending line number of the code block.",
			},
		},
		required: ["path", "startLine", "endLine"],
	}),
}

/**
 * Enhanced message processor implementation with support for:
 * - Parallel processing
 * - Conditional execution
 * - Pipeline branching
 * - Stage prioritization
 */
export class EnhancedMessageProcessor implements IMessageProcessor {
	private pipeline: EnhancedPipeline
	private tools: Map<string, Tool> = new Map()
	private hooks: ToolHooks = {}

	constructor() {
		this.pipeline = new EnhancedPipeline()

		// Add default validation stage
		this.addPipelineStage(new EnhancedValidationStage())

		// Register the new tools
		this.registerTool(requestFileContentTool)
		this.registerTool(codeExplanationTool)
	}

	/**
	 * Process a message through the enhanced pipeline
	 */
	async process(context: MessageContext): Promise<ProcessingResult> {
		try {
			// Run through enhanced pipeline
			const pipelineResult = await this.pipeline.process(context)
			const enrichedContext = pipelineResult.context

			// Handle tool execution if needed
			if (enrichedContext.requiresToolExecution && enrichedContext.toolExecution) {
				const toolResult = await this.executeTool(enrichedContext)
				return {
					success: toolResult.success,
					content: toolResult.content,
					error: toolResult.error,
					toolResult,
					metadata: {
						pipelineMetrics: pipelineResult.metrics,
						executionPath: pipelineResult.executionPath,
					},
				}
			}

			// Return normal processing result with pipeline metrics
			return {
				success: true,
				content: enrichedContext.message,
				metadata: {
					pipelineMetrics: pipelineResult.metrics,
					executionPath: pipelineResult.executionPath,
				},
			}
		} catch (error) {
			return {
				success: false,
				content: "",
				error: error instanceof Error ? error : new Error(String(error)),
			}
		}
	}

	/**
	 * Add a stage to the enhanced pipeline
	 * Supports both enhanced and basic pipeline stages
	 */
	addPipelineStage(stage: PipelineStage | EnhancedPipelineStage): void {
		if ("config" in stage) {
			// It's already an enhanced stage
			this.pipeline.addStage(stage)
		} else {
			// Convert basic stage to enhanced stage
			this.pipeline.addStage(enhanceStage(stage))
		}
	}

	/**
	 * Register a new tool
	 */
	registerTool(tool: Tool): void {
		this.tools.set(tool.name, tool)
	}

	/**
	 * Set hooks for tool execution
	 */
	setToolHooks(hooks: ToolHooks): void {
		this.hooks = hooks
	}

	/**
	 * Execute a tool with the given context
	 */
	private async executeTool(context: MessageContext): Promise<ProcessingResult> {
		if (!context.toolExecution) {
			throw new Error("Tool execution context missing")
		}

		const { toolName, params } = context.toolExecution
		const tool = this.tools.get(toolName)

		if (!tool) {
			throw new Error(`Tool ${toolName} not found`)
		}

		try {
			// Run pre-execution hook
			if (this.hooks.beforeExecution) {
				await this.hooks.beforeExecution(context)
			}

			// Validate parameters
			if (!tool.validate(params)) {
				throw new Error(`Invalid parameters for tool ${toolName}`)
			}

			// Execute tool
			const result = await tool.execute(params)

			// Run post-execution hook
			if (this.hooks.afterExecution) {
				await this.hooks.afterExecution(result)
			}

			return {
				success: result.success,
				content: result.content,
				error: result.error,
				toolResult: result,
			}
		} catch (error) {
			// Run error hook
			if (this.hooks.onError) {
				await this.hooks.onError(error instanceof Error ? error : new Error(String(error)))
			}

			return {
				success: false,
				content: "",
				error: error instanceof Error ? error : new Error(String(error)),
			}
		}
	}
}
