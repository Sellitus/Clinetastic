import { PipelineStage } from "../types"
import { EnhancedPipelineStage, PipelineStageConfig } from "./types"

/**
 * Creates a default configuration for a pipeline stage
 */
function createDefaultConfig(stage: PipelineStage): PipelineStageConfig {
	return {
		id: stage.id,
		priority: 0,
		parallel: false,
		dependencies: [],
		maxRetries: 3,
		retryDelay: 1000,
		useExponentialBackoff: true,
		resourceLimits: {
			maxMemory: 1024 * 1024 * 100, // 100MB
			maxCpu: 30000, // 30 seconds
			timeout: 30000, // 30 seconds
		},
		errorHandling: {
			ignoreErrors: false,
			fallbackValue: undefined,
			errorTransform: (error: Error) => error,
		},
	}
}

/**
 * Adapts a basic pipeline stage to an enhanced stage
 */
export function adaptStage(stage: PipelineStage): EnhancedPipelineStage {
	return {
		config: createDefaultConfig(stage),
		process: stage.process,
	}
}

/**
 * Enhances an existing pipeline stage with additional configuration
 */
export function enhanceStage(stage: PipelineStage, config: Partial<PipelineStageConfig> = {}): EnhancedPipelineStage {
	return {
		config: {
			...createDefaultConfig(stage),
			...config,
		},
		process: stage.process,
	}
}

/**
 * Checks if a stage is already enhanced
 */
export function isEnhancedStage(stage: PipelineStage | EnhancedPipelineStage): stage is EnhancedPipelineStage {
	return "config" in stage
}
