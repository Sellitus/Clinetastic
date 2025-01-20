import { SemanticChunkingStage } from "./semantic-chunking"
import { TestDebugStage } from "./TestDebugStage"
import { PerformanceMetricsStage } from "./PerformanceMetricsStage"
import { MessageProcessor } from "../MessageProcessor"

/**
 * Registers all message processing stages in the correct order
 */
export function registerMessageProcessingStages(processor: MessageProcessor): void {
	// Add performance metrics stage first to measure entire processing time
	processor.addPipelineStage(new PerformanceMetricsStage())

	// Add semantic chunking stage to prioritize context before other processing
	processor.addPipelineStage(new SemanticChunkingStage())

	// Add test debugging stage after semantic chunking
	processor.addPipelineStage(new TestDebugStage())
}
