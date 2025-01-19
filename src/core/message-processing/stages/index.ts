import { SemanticChunkingStage } from "./semantic-chunking"
import { TestDebugStage } from "./TestDebugStage"
import { MessageProcessor } from "../MessageProcessor"

/**
 * Registers all message processing stages in the correct order
 */
export function registerMessageProcessingStages(processor: MessageProcessor): void {
	// Add semantic chunking stage first to prioritize context before other processing
	processor.addPipelineStage(new SemanticChunkingStage())

	// Add test debugging stage after semantic chunking
	processor.addPipelineStage(new TestDebugStage())
}
