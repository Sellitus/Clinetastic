import {
	MessageContext,
	MessageProcessor as IMessageProcessor,
	PipelineStage,
	ProcessingResult,
	Tool,
	ToolHooks,
	ToolResult,
} from "./types"

/**
 * Core message processing implementation
 */
export class MessageProcessor implements IMessageProcessor {
	private stages: PipelineStage[] = []
	private tools: Map<string, Tool> = new Map()
	private hooks: ToolHooks = {}

	/**
	 * Process a message through the pipeline and execute tools if needed
	 */
	async process(context: MessageContext): Promise<ProcessingResult> {
		try {
			// Run through pipeline stages
			const enrichedContext = await this.processPipeline(context)

			// Handle tool execution if needed
			if (enrichedContext.requiresToolExecution && enrichedContext.toolExecution) {
				const toolResult = await this.executeTool(enrichedContext)
				return {
					success: toolResult.success,
					content: toolResult.content,
					error: toolResult.error,
					toolResult,
				}
			}

			// Return normal processing result
			return {
				success: true,
				content: enrichedContext.message,
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
	 * Add a stage to the processing pipeline
	 */
	addPipelineStage(stage: PipelineStage): void {
		this.stages.push(stage)
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
	 * Process the message through all pipeline stages
	 */
	private async processPipeline(context: MessageContext): Promise<MessageContext> {
		let currentContext = context

		for (const stage of this.stages) {
			try {
				currentContext = await stage.process(currentContext)
			} catch (error) {
				throw new Error(
					`Pipeline stage ${stage.id} failed: ${error instanceof Error ? error.message : String(error)}`,
				)
			}
		}

		return currentContext
	}

	/**
	 * Execute a tool with the given context
	 */
	private async executeTool(context: MessageContext): Promise<ToolResult> {
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

			return result
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
