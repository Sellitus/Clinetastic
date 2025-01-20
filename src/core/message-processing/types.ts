import { Mode } from "../../shared/modes"
import { ApiConfiguration, ModelInfo } from "../../shared/api"

export interface EnvironmentDetails {
	workingDirectory: string
	visibleFiles: string[]
	openTabs: string[]
	activeTerminals: string[]
	currentTime: Date
	mode: Mode
}

export interface MessageAttachment {
	type: "image" | "file"
	content: string
	mimeType?: string
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
	/** API configuration */
	apiConfig?: ApiConfiguration
	/** Model information */
	modelInfo?: ModelInfo
	/** Message attachments */
	attachments?: MessageAttachment[]
	/** Stage processing metadata */
	metadata?: {
		/** Branch execution details */
		branchExecution?: {
			branchId: string
			evaluatedBranches: number
			startTime: number
			totalStages: number
			completedStages?: number
			progress?: number
		}
		/** Parallel execution details */
		parallelExecution?: {
			totalTime: number
			stageId: string
		}
		/** Stage-specific metadata */
		[key: string]: any
	}
}

export interface ToolExecutionContext {
	/** Name of the tool to execute */
	toolName: string
	/** Parameters for tool execution */
	params: Record<string, any>
	/** Validation state */
	validated: boolean
	/** Maximum number of retry attempts */
	maxRetries?: number
	/** Delay between retries in milliseconds */
	retryDelay?: number
	/** Whether to use exponential backoff for retries */
	useExponentialBackoff?: boolean
	/** Resource limits */
	resourceLimits?: {
		/** Maximum memory usage in bytes */
		maxMemory?: number
		/** Maximum CPU time in milliseconds */
		maxCpu?: number
		/** Operation timeout in milliseconds */
		timeout?: number
	}
	/** Error handling configuration */
	errorHandling?: {
		/** Whether to ignore errors and continue */
		ignoreErrors?: boolean
		/** Value to return on error if ignoring errors */
		fallbackValue?: any
		/** Function to transform errors before handling */
		errorTransform?: (error: Error) => Error
	}
}

/** Common metadata structure for results */
export interface ResultMetadata {
	/** Execution timing information */
	timing: {
		/** Total execution time */
		totalTime: number
		/** Time spent in initialization */
		initTime: number
		/** Time spent in actual execution */
		executionTime: number
		/** Time spent in cleanup */
		cleanupTime: number
		/** Time spent waiting for resources */
		waitTime?: number
	}
	/** Pipeline metrics if applicable */
	pipelineMetrics?: {
		/** Total pipeline execution time */
		totalTime: number
		/** Metrics per pipeline stage */
		stageMetrics: Map<
			string,
			{
				startTime: number
				endTime: number
				duration: number
			}
		>
		/** Groups of stages executed in parallel */
		parallelGroups: string[][]
	}
	/** Execution path through pipeline */
	executionPath?: string[]
	/** Resource utilization metrics */
	resources: {
		/** Memory usage statistics */
		memory: {
			/** Peak memory usage */
			peakUsage: number
			/** Average memory usage */
			averageUsage: number
			/** Memory allocated */
			allocated: number
			/** Memory freed */
			freed: number
		}
		/** CPU utilization */
		cpu: {
			/** Peak CPU usage */
			peakUsage: number
			/** Average CPU usage */
			averageUsage: number
			/** User CPU time */
			userTime: number
			/** System CPU time */
			systemTime: number
		}
		/** File system operations */
		io?: {
			/** Bytes read */
			bytesRead: number
			/** Bytes written */
			bytesWritten: number
			/** Number of read operations */
			readOps: number
			/** Number of write operations */
			writeOps: number
		}
	}
	/** Performance optimization hints */
	optimizationHints?: {
		/** Suggested improvements */
		suggestions: string[]
		/** Potential bottlenecks */
		bottlenecks: string[]
		/** Resource usage warnings */
		warnings: string[]
		/** Caching recommendations */
		cacheRecommendations?: string[]
	}
	/** Tool-specific metrics */
	toolMetrics?: Record<string, any>
}

export interface ToolResult {
	/** Whether tool execution was successful */
	success: boolean
	/** Result content */
	content: string
	/** Any errors that occurred */
	error?: Error
	/** Execution metrics and metadata */
	metadata?: ResultMetadata
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
	/** Processing metrics and metadata */
	metadata?: ResultMetadata
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

export interface ToolErrorMetadata {
	toolName: string
	executionTime: number
	errorHistory: Error[]
	retryCount: number
}

export interface ToolHooks {
	/** Called before tool execution */
	beforeExecution?(context: MessageContext): Promise<void>
	/** Called after tool execution */
	afterExecution?(result: ToolResult): Promise<void>
	/** Called if tool execution fails */
	onError?(error: Error, metadata?: ToolErrorMetadata): Promise<void>
}

export interface PipelineStage {
	/** Unique identifier for the stage */
	id: string
	/** Process the message context */
	process(context: MessageContext): Promise<MessageContext>
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
