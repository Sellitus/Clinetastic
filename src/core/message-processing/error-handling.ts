import { ToolResult, MessageContext } from "./types"

export interface ToolMetrics {
	avgExecutionTime: number
	successCount: number
	failureCount: number
	lastNExecutionTimes: number[]
}

export type ErrorPattern = "timeout" | "validation" | "permission" | "resource" | "system" | "unknown"

export type ErrorSeverity = "low" | "medium" | "high"

export interface ErrorAnalysis {
	pattern: ErrorPattern
	frequency: number
	isRecurring: boolean
	severity: ErrorSeverity
	recommendation: string
}

export interface ErrorContext {
	toolName: string
	executionTime: number
	errorHistory: Error[]
	retryCount: number
	errorPattern?: ErrorAnalysis
	performance?: ToolMetrics
	systemState?: {
		memoryUsage: NodeJS.MemoryUsage
		uptime: number
	}
}

export interface EnhancedToolHooks {
	beforeExecution?(context: MessageContext): Promise<void>
	afterExecution?(result: ToolResult): Promise<void>
	onError?(error: Error, context: ErrorContext): Promise<void>
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
	analyzeErrorPatterns(errors: Error[]): ErrorAnalysis
	categorizeError(errorMessage: string): ErrorPattern
	calculateErrorSeverity(pattern: ErrorPattern, frequency: number, isRecurring: boolean): ErrorSeverity
	getErrorRecommendation(pattern: ErrorPattern, severity: ErrorSeverity, isRecurring: boolean): string
	determineRetryStrategy(toolName: string, errorPattern: ErrorAnalysis, retryCount: number): boolean
}

export interface PerformanceTracker {
	getToolPerformanceStats(toolName: string): ToolMetrics
	updateToolPerformance(toolName: string, executionTime: number, success: boolean): void
	calculateBackoffDelay(toolName: string, retryCount: number): number
}
