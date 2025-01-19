import { MessageProcessor } from "../MessageProcessor"
import { ContextCompressionStage } from "../stages/context-compression"

/**
 * Example of how to set up a pipeline with context compression
 */
export function createCompressionEnabledPipeline(): MessageProcessor {
	const processor = new MessageProcessor()

	// Add compression stage early in pipeline to optimize context
	processor.addPipelineStage(new ContextCompressionStage())

	// Add other stages as needed...

	return processor
}

/**
 * Usage example:
 *
 * const pipeline = createCompressionEnabledPipeline()
 * const result = await pipeline.process({
 *   message: "Your message here",
 *   mode: "code",
 *   environment: { ... }
 * })
 *
 * // Compression metadata available in result if compression was applied
 * console.log(result.metadata?.compression)
 */
