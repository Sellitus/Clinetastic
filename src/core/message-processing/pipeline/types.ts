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
	/** Maximum number of retry attempts */
	maxRetries?: number
	/** Delay between retries in milliseconds */
	retryDelay?: number
	/** Whether to use exponential backoff for retries */
	useExponentialBackoff?: boolean
	/** Optional condition for stage execution */
	condition?: (context: MessageContext) => Promise<boolean>
	/** Branch configuration for conditional paths */
	branches?: PipelineBranch[]
	/** Resource limits */
	resourceLimits?: {
		maxMemory?: number
		maxCpu?: number
		timeout?: number
	}
	/** Error handling configuration */
	errorHandling?: {
		ignoreErrors?: boolean
		fallbackValue?: any
		errorTransform?: (error: Error) => Error
	}
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
 * Pipeline error details
 */
export interface PipelineError {
	stageId: string
	error: Error
	timestamp: number
	context?: Record<string, any>
}

/**
 * Pipeline warning details
 */
export interface PipelineWarning {
	stageId: string
	message: string
	timestamp: number
	context?: Record<string, any>
}

/**
 * Pipeline execution metrics with enhanced error tracking
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
			retryCount?: number
			recoveryTime?: number
			memoryUsage?: NodeJS.MemoryUsage
			cpuUsage?: NodeJS.CpuUsage
			heapStats?: {
				totalHeapSize: number
				usedHeapSize: number
				heapSizeLimit: number
			}
		}
	>
	/** Performance metrics */
	performance: {
		averageStageTime: number
		maxStageTime: number
		minStageTime: number
		totalMemoryUsage: number
		peakMemoryUsage: number
		cpuUtilization: number
		heapUtilization: number
	}
	/** Resource monitoring */
	resources: {
		memoryUsage: NodeJS.MemoryUsage
		cpuUsage: NodeJS.CpuUsage
		heapStats: {
			totalHeapSize: number
			usedHeapSize: number
			heapSizeLimit: number
		}
	}
	/** Stages executed in parallel */
	parallelGroups: string[][]
	/** Errors encountered during execution */
	errors: PipelineError[]
	/** Warnings generated during execution */
	warnings: PipelineWarning[]
	/** Number of recovery attempts made */
	recoveryAttempts: number
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
