import { SemanticChunkingStage } from "./semantic-chunking"
import { MessageProcessor } from "../MessageProcessor"

/**
 * Registers all message processing stages in the correct order
 */
export function registerMessageProcessingStages(processor: MessageProcessor): void {
	// Add semantic chunking stage first to prioritize context before other processing
	processor.addPipelineStage(new SemanticChunkingStage())
}
