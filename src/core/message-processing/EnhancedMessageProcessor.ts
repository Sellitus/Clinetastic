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
