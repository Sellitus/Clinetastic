import { MessageContext } from "../types"

/**
 * Enhanced pipeline stage configuration
 */
export interface PipelineStageConfig {
	/** Unique identifier for the stage */
	id: string
	/** Stage execution priority (lower numbers run first) */
	priority: number
	/** Whether stage can run in parallel with others */
	parallel: boolean
	/** IDs of stages that must complete before this one */
	dependencies: string[]
	/** Optional condition for stage execution */
	condition?: (context: MessageContext) => Promise<boolean>
	/** Branch configuration for conditional paths */
	branches?: PipelineBranch[]
}

/**
 * Enhanced pipeline stage interface
 */
export interface EnhancedPipelineStage {
	/** Stage configuration */
	config: PipelineStageConfig
	/** Process the message context */
	process(context: MessageContext): Promise<MessageContext>
}

/**
 * Pipeline branch for conditional execution paths
 */
export interface PipelineBranch {
	/** Branch identifier */
	id: string
	/** Condition for taking this branch */
	condition: (context: MessageContext) => Promise<boolean>
	/** Stages to execute in this branch */
	stages: EnhancedPipelineStage[]
}

/**
 * Pipeline execution metrics
 */
export interface PipelineMetrics {
	/** Total execution time */
	totalTime: number
	/** Time per stage */
	stageMetrics: Map<
		string,
		{
			startTime: number
			endTime: number
			duration: number
		}
	>
	/** Stages executed in parallel */
	parallelGroups: string[][]
}

/**
 * Pipeline execution result
 */
export interface PipelineResult {
	/** Final message context */
	context: MessageContext
	/** Execution metrics */
	metrics: PipelineMetrics
	/** Execution path taken */
	executionPath: string[]
}
