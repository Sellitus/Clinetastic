import { PipelineStage, MessageContext } from "../types"
import { EnhancedPipelineStage } from "./types"

/**
 * Adapter to make EnhancedPipelineStage compatible with PipelineStage
 */
export class PipelineStageAdapter implements PipelineStage {
	constructor(private enhancedStage: EnhancedPipelineStage) {}

	get id(): string {
		return this.enhancedStage.config.id
	}

	async process(context: MessageContext): Promise<MessageContext> {
		return this.enhancedStage.process(context)
	}

	/**
	 * Convert a base PipelineStage to an EnhancedPipelineStage
	 */
	static fromBasicStage(stage: PipelineStage): EnhancedPipelineStage {
		return {
			config: {
				id: stage.id,
				priority: 100, // Default priority
				parallel: false, // Default to sequential
				dependencies: [], // No dependencies by default
			},
			process: stage.process.bind(stage),
		}
	}
}

/**
 * Helper function to adapt an enhanced stage to base interface
 */
export function adaptStage(stage: EnhancedPipelineStage): PipelineStage {
	return new PipelineStageAdapter(stage)
}

/**
 * Helper function to enhance a base stage
 */
export function enhanceStage(stage: PipelineStage): EnhancedPipelineStage {
	return PipelineStageAdapter.fromBasicStage(stage)
}
