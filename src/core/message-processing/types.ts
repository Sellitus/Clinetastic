import { Mode } from "../../shared/modes"

/**
 * Core types for the message processing system
 */

export interface EnvironmentDetails {
	workingDirectory: string
	visibleFiles: string[]
	openTabs: string[]
	activeTerminals: string[]
	currentTime: Date
	mode: Mode
}

export interface MessageContext {
	/** The raw message content */
	message: string
	/** Current processing mode */
	mode: Mode
	/** Environmental context */
	environment: EnvironmentDetails
	/** Custom user instructions */
	customInstructions?: string
	/** Whether tool execution is needed */
	requiresToolExecution?: boolean
	/** Tool execution details if needed */
	toolExecution?: ToolExecutionContext
}

export interface ToolExecutionContext {
	/** Name of the tool to execute */
	toolName: string
	/** Parameters for tool execution */
	params: Record<string, any>
	/** Validation state */
	validated: boolean
}

export interface ProcessingResult {
	/** Whether processing was successful */
	success: boolean
	/** Processing result content */
	content: string
	/** Any errors that occurred */
	error?: Error
	/** Tool execution result if applicable */
	toolResult?: ToolResult
}

export interface ToolResult {
	/** Whether tool execution was successful */
	success: boolean
	/** Result content */
	content: string
	/** Any errors that occurred */
	error?: Error
	/** Additional metadata */
	metadata?: Record<string, any>
}

export interface PipelineStage {
	/** Unique identifier for the stage */
	id: string
	/** Process the message context */
	process(context: MessageContext): Promise<MessageContext>
}

export interface Tool {
	/** Tool name */
	name: string
	/** Tool description */
	description: string
	/** Execute the tool */
	execute(params: Record<string, any>): Promise<ToolResult>
	/** Validate tool parameters */
	validate(params: Record<string, any>): boolean
	/** Get parameter schema */
	getParameterSchema(): Record<string, any>
}

export interface ToolHooks {
	/** Called before tool execution */
	beforeExecution?(context: MessageContext): Promise<void>
	/** Called after tool execution */
	afterExecution?(result: ToolResult): Promise<void>
	/** Called if tool execution fails */
	onError?(error: Error): Promise<void>
}

export interface PromptCache {
	/** Get cached prompt */
	get(key: string): Promise<string | null>
	/** Set prompt in cache */
	set(key: string, prompt: string): Promise<void>
	/** Clear cache */
	clear(): Promise<void>
}

export interface PromptBuilder {
	/** Add system prompt */
	withSystemPrompt(): PromptBuilder
	/** Add custom instructions */
	withCustomInstructions(instructions?: string): PromptBuilder
	/** Add environment details */
	withEnvironmentDetails(details: EnvironmentDetails): PromptBuilder
	/** Build final prompt */
	build(): Promise<string>
}

export interface MessageProcessor {
	/** Process a message */
	process(context: MessageContext): Promise<ProcessingResult>
	/** Add a pipeline stage */
	addPipelineStage(stage: PipelineStage): void
	/** Register a tool */
	registerTool(tool: Tool): void
	/** Set tool hooks */
	setToolHooks(hooks: ToolHooks): void
}
