import {
	ErrorHandler,
	PerformanceTracker,
	ToolMetrics,
	ErrorPattern,
	ErrorSeverity,
	ErrorAnalysis,
	ERROR_PATTERNS,
} from "./error-handling"

export class ErrorHandlingService implements ErrorHandler, PerformanceTracker {
	private readonly MAX_HISTORY_SIZE = 10
	private readonly ERROR_THRESHOLD = 3
	private readonly BACKOFF_MULTIPLIER = 1.5
	private readonly MIN_RETRY_DELAY = 1000 // 1 second
	private readonly MAX_RETRY_DELAY = 10000 // 10 seconds

	private toolPerformance = new Map<string, ToolMetrics>()

	getToolPerformanceStats(toolName: string): ToolMetrics {
		if (!this.toolPerformance.has(toolName)) {
			this.toolPerformance.set(toolName, {
				avgExecutionTime: 0,
				successCount: 0,
				failureCount: 0,
				lastNExecutionTimes: [],
			})
		}
		return this.toolPerformance.get(toolName)!
	}

	updateToolPerformance(toolName: string, executionTime: number, success: boolean): void {
		const stats = this.getToolPerformanceStats(toolName)

		// Update execution times (keep last N)
		stats.lastNExecutionTimes.push(executionTime)
		if (stats.lastNExecutionTimes.length > this.MAX_HISTORY_SIZE) {
			stats.lastNExecutionTimes.shift()
		}

		// Update average
		stats.avgExecutionTime = stats.lastNExecutionTimes.reduce((a, b) => a + b, 0) / stats.lastNExecutionTimes.length

		// Update success/failure counts
		if (success) {
			stats.successCount++
		} else {
			stats.failureCount++
		}
	}

	calculateBackoffDelay(toolName: string, retryCount: number): number {
		const stats = this.getToolPerformanceStats(toolName)
		const baseDelay = Math.min(
			this.MIN_RETRY_DELAY * Math.pow(this.BACKOFF_MULTIPLIER, retryCount),
			this.MAX_RETRY_DELAY,
		)

		// Adjust based on error rate
		const errorRate = stats.failureCount / (stats.successCount + stats.failureCount)
		const errorMultiplier = errorRate > 0.5 ? 1.5 : 1

		// Adjust based on average execution time
		const timeMultiplier = stats.avgExecutionTime > this.MAX_RETRY_DELAY * 0.5 ? 1.5 : 1

		return Math.min(baseDelay * errorMultiplier * timeMultiplier, this.MAX_RETRY_DELAY)
	}

	analyzeErrorPatterns(errors: Error[]): ErrorAnalysis {
		const lastError = errors[errors.length - 1]?.message.toLowerCase() || ""
		const pattern = this.categorizeError(lastError)

		// Calculate frequency of similar errors
		const similarErrors = errors.filter((e) => this.categorizeError(e.message.toLowerCase()) === pattern)
		const frequency = similarErrors.length / errors.length
		const isRecurring = similarErrors.length >= this.ERROR_THRESHOLD

		// Determine severity
		const severity = this.calculateErrorSeverity(pattern, frequency, isRecurring)

		// Generate recommendation
		const recommendation = this.getErrorRecommendation(pattern, severity, isRecurring)

		return {
			pattern,
			frequency,
			isRecurring,
			severity,
			recommendation,
		}
	}

	categorizeError(errorMessage: string): ErrorPattern {
		if (errorMessage.includes("timeout") || errorMessage.includes("timed out")) {
			return ERROR_PATTERNS.TIMEOUT
		}
		if (errorMessage.includes("validation") || errorMessage.includes("invalid")) {
			return ERROR_PATTERNS.VALIDATION
		}
		if (errorMessage.includes("permission") || errorMessage.includes("access")) {
			return ERROR_PATTERNS.PERMISSION
		}
		if (errorMessage.includes("not found") || errorMessage.includes("missing")) {
			return ERROR_PATTERNS.RESOURCE
		}
		if (errorMessage.includes("system") || errorMessage.includes("internal")) {
			return ERROR_PATTERNS.SYSTEM
		}
		return ERROR_PATTERNS.UNKNOWN
	}

	calculateErrorSeverity(pattern: ErrorPattern, frequency: number, isRecurring: boolean): ErrorSeverity {
		if (pattern === ERROR_PATTERNS.SYSTEM || frequency > 0.7) {
			return "high"
		}
		if (isRecurring || frequency > 0.4 || pattern === ERROR_PATTERNS.PERMISSION) {
			return "medium"
		}
		return "low"
	}

	getErrorRecommendation(pattern: ErrorPattern, severity: ErrorSeverity, isRecurring: boolean): string {
		const recommendations = new Map<ErrorPattern, string>([
			["timeout", "Consider breaking operation into smaller steps or increasing timeout threshold"],
			["validation", "Review parameter requirements and input formats"],
			["permission", "Verify access rights and consider using alternative approaches"],
			["resource", "Confirm resource existence and check path accuracy"],
			["system", "Wait for system stability or try alternative method"],
			["unknown", "Review error details and consider simpler approach"],
		])

		let baseRecommendation = recommendations.get(pattern) || recommendations.get("unknown")!

		if (severity === "high") {
			baseRecommendation += ". Immediate attention required."
		}
		if (isRecurring) {
			baseRecommendation += " Pattern suggests systematic issue."
		}

		return baseRecommendation
	}

	determineRetryStrategy(toolName: string, errorPattern: ErrorAnalysis, retryCount: number): boolean {
		// Don't retry on high severity system errors
		if (errorPattern.pattern === ERROR_PATTERNS.SYSTEM && errorPattern.severity === "high") {
			return false
		}

		// Don't retry on recurring permission errors
		if (errorPattern.pattern === ERROR_PATTERNS.PERMISSION && errorPattern.isRecurring) {
			return false
		}

		// Don't retry if we've hit the max retries
		if (retryCount >= this.ERROR_THRESHOLD) {
			return false
		}

		// Calculate success probability based on error pattern
		const stats = this.getToolPerformanceStats(toolName)
		const successRate = stats.successCount / (stats.successCount + stats.failureCount)
		const patternWeight =
			errorPattern.pattern === ERROR_PATTERNS.TIMEOUT
				? 0.8
				: errorPattern.pattern === ERROR_PATTERNS.VALIDATION
					? 0.7
					: 0.5

		return successRate * patternWeight > 0.3
	}
}
