import { MessageProcessor } from "./MessageProcessor"
import { createValidationStage } from "./stages/ValidationStage"
import { createToolParserStage } from "./stages/ToolParserStage"
import { createModelSelectionStage } from "./stages/ModelSelectionStage"
import { registerMessageProcessingStages } from "./stages"
import type {
	MessageContext,
	ProcessingResult,
	Tool,
	ToolHooks,
	ToolResult,
	PipelineStage,
	EnvironmentDetails,
} from "./types"

/**
 * Create a configured message processor with default stages
 */
export function createMessageProcessor(options: {
	tools?: Tool[]
	hooks?: ToolHooks
	additionalStages?: PipelineStage[]
}): MessageProcessor {
	const processor = new MessageProcessor()
	// Register semantic chunking and other core stages
	registerMessageProcessingStages(processor)

	// Add default processing stages in correct order
	processor.addPipelineStage(createModelSelectionStage()) // Add model selection first
	processor.addPipelineStage(createValidationStage())
	processor.addPipelineStage(createToolParserStage())

	// Add any additional custom stages
	// Add any additional stages
	if (options.additionalStages) {
		options.additionalStages.forEach((stage) => processor.addPipelineStage(stage))
	}

	// Register tools
	if (options.tools) {
		options.tools.forEach((tool) => processor.registerTool(tool))
	}

	// Set hooks
	if (options.hooks) {
		processor.setToolHooks(options.hooks)
	}

	return processor
}

/**
 * Create a message context with the given inputs
 */
export function createMessageContext(
	message: string,
	mode: string,
	environment: EnvironmentDetails,
	customInstructions?: string,
): MessageContext {
	return {
		message,
		mode,
		environment,
		customInstructions,
	}
}

// Export types
export type { MessageContext, ProcessingResult, Tool, ToolHooks, ToolResult, PipelineStage, EnvironmentDetails }

// Export classes
export { MessageProcessor }

// Export stages
export { createValidationStage, createToolParserStage, createModelSelectionStage }
