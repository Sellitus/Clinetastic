import { ToolResult, MessageContext } from "./types"

export interface ToolMetrics {
	avgExecutionTime: number
	successCount: number
	failureCount: number
	lastNExecutionTimes: number[]
}

export type ErrorPattern = "timeout" | "validation" | "permission" | "resource" | "system" | "unknown"

export type ErrorSeverity = "low" | "medium" | "high"

export interface TimingAnalysis {
	hasBurst: boolean
	avgTimeBetweenErrors: number
	isRegularPattern: boolean
}

export interface ErrorAnalysis {
	pattern: ErrorPattern
	frequency: number
	isRecurring: boolean
	severity: ErrorSeverity
	recommendation: string
	timing: TimingAnalysis // Made non-optional since we always provide it
}

export interface EnhancedErrorEntry {
	error: Error
	timestamp: number
	context: {
		input: Record<string, unknown>
		memory: number
		cpu: number
	}
}

export interface EnhancedPerformanceStats {
	avgExecutionTime: number
	successRate: number
	lastNExecutions: number[]
	peakMemoryUsage: number
}

export interface ErrorContext {
	toolName: string
	executionTime: number
	errorHistory: EnhancedErrorEntry[]
	retryCount: number
	errorPattern?: ErrorAnalysis
	performance?: ToolMetrics & Partial<EnhancedPerformanceStats>
	systemState?: {
		memoryUsage: NodeJS.MemoryUsage
		uptime: number
		lastExecutionStats?: {
			avgTime: number
			successRate: number
			peakMemory: number
		}
	}
}

export interface EnhancedToolHooks {
	beforeExecution?(context: MessageContext): Promise<void>
	afterExecution?(result: ToolResult): Promise<void>
	onError?(error: Error, context: ErrorContext & { enhancedErrors?: EnhancedErrorEntry[] }): Promise<void>
}

export const ERROR_PATTERNS: Record<string, ErrorPattern> = {
	TIMEOUT: "timeout",
	VALIDATION: "validation",
	PERMISSION: "permission",
	RESOURCE: "resource",
	SYSTEM: "system",
	UNKNOWN: "unknown",
} as const

export interface ErrorHandler {
	analyzeErrorPatterns(errors: (Error | EnhancedErrorEntry)[]): ErrorAnalysis
	categorizeError(errorMessage: string): ErrorPattern
	calculateErrorSeverity(pattern: ErrorPattern, frequency: number, isRecurring: boolean): ErrorSeverity
	getErrorRecommendation(pattern: ErrorPattern, severity: ErrorSeverity, isRecurring: boolean): string
	determineRetryStrategy(toolName: string, errorPattern: ErrorAnalysis, retryCount: number): boolean
	getErrorFromEntry(entry: Error | EnhancedErrorEntry): Error
}

export function isEnhancedErrorEntry(error: Error | EnhancedErrorEntry): error is EnhancedErrorEntry {
	return "error" in error && "timestamp" in error && "context" in error
}

export interface PerformanceTracker {
	getToolPerformanceStats(toolName: string): ToolMetrics
	updateToolPerformance(toolName: string, executionTime: number, success: boolean): void
	calculateBackoffDelay(toolName: string, retryCount: number): number
}
