import {
	ErrorHandler,
	PerformanceTracker,
	ToolMetrics,
	ErrorPattern,
	ErrorSeverity,
	ErrorAnalysis,
	ERROR_PATTERNS,
	EnhancedErrorEntry,
	isEnhancedErrorEntry,
	TimingAnalysis,
} from "./error-handling"

export class ErrorHandlingService implements ErrorHandler, PerformanceTracker {
	private readonly MAX_HISTORY_SIZE = 10
	private readonly ERROR_THRESHOLD = 3
	private readonly BACKOFF_MULTIPLIER = 1.5
	private readonly MIN_RETRY_DELAY = 1000 // 1 second
	private readonly MAX_RETRY_DELAY = 10000 // 10 seconds
	private readonly TIME_WINDOW = 300000 // 5 minutes
	private readonly BURST_THRESHOLD = 3 // Number of errors in time window to consider a burst

	private toolPerformance = new Map<string, ToolMetrics>()

	private analyzeErrorTiming(errors: (Error | EnhancedErrorEntry)[]): {
		hasBurst: boolean
		avgTimeBetweenErrors: number
		isRegularPattern: boolean
	} {
		const timestamps = errors
			.filter(isEnhancedErrorEntry)
			.map((e) => e.timestamp)
			.sort((a, b) => a - b)

		if (timestamps.length < 2) {
			return {
				hasBurst: false,
				avgTimeBetweenErrors: 0,
				isRegularPattern: false,
			}
		}

		// Calculate time gaps between errors
		const timeGaps: number[] = []
		for (let i = 1; i < timestamps.length; i++) {
			timeGaps.push(timestamps[i] - timestamps[i - 1])
		}

		// Check for error bursts in time window
		const now = Date.now()
		const recentErrors = timestamps.filter((t) => now - t < this.TIME_WINDOW)
		const hasBurst = recentErrors.length >= this.BURST_THRESHOLD

		// Calculate average time between errors
		const avgTimeBetweenErrors = timeGaps.reduce((a, b) => a + b, 0) / timeGaps.length

		// Check if errors follow a regular pattern
		const stdDev = Math.sqrt(
			timeGaps.reduce((acc, gap) => acc + Math.pow(gap - avgTimeBetweenErrors, 2), 0) / timeGaps.length,
		)
		const isRegularPattern = stdDev / avgTimeBetweenErrors < 0.5 // Coefficient of variation < 50%

		return {
			hasBurst,
			avgTimeBetweenErrors,
			isRegularPattern,
		}
	}

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

	getErrorFromEntry(entry: Error | EnhancedErrorEntry): Error {
		if ("error" in entry && "timestamp" in entry && "context" in entry) {
			return entry.error
		}
		return entry
	}

	analyzeErrorPatterns(errors: (Error | EnhancedErrorEntry)[]): ErrorAnalysis {
		const lastError = this.getErrorFromEntry(errors[errors.length - 1])?.message.toLowerCase() || ""
		const pattern = this.categorizeError(lastError)

		// Enhanced error pattern analysis
		const similarErrors = errors.filter((e) => {
			const error = this.getErrorFromEntry(e)
			const samePattern = this.categorizeError(error.message.toLowerCase()) === pattern

			// If it's an enhanced error entry, use additional context
			if (isEnhancedErrorEntry(e)) {
				// Check for similar resource usage patterns
				const highMemory = e.context.memory > 1_000_000_000 // 1GB
				const highCPU = e.context.cpu > 80 // 80% CPU usage

				// Consider errors similar if they have similar resource patterns
				if (highMemory || highCPU) {
					return true
				}
			}

			return samePattern
		})

		const frequency = similarErrors.length / errors.length
		const isRecurring = similarErrors.length >= this.ERROR_THRESHOLD

		// Analyze timing patterns
		const timing = this.analyzeErrorTiming(errors)

		// Determine severity with timing information
		const severity = this.calculateErrorSeverity(pattern, frequency, isRecurring, timing)

		// Generate recommendation with timing information
		const recommendation = this.getErrorRecommendation(pattern, severity, isRecurring, timing)

		// Ensure we always return timing information
		const result: ErrorAnalysis = {
			pattern,
			frequency,
			isRecurring,
			severity,
			recommendation,
			timing: {
				hasBurst: timing.hasBurst,
				avgTimeBetweenErrors: timing.avgTimeBetweenErrors,
				isRegularPattern: timing.isRegularPattern,
			},
		}

		return result
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

	calculateErrorSeverity(
		pattern: ErrorPattern,
		frequency: number,
		isRecurring: boolean,
		timing?: TimingAnalysis,
	): ErrorSeverity {
		// Base severity calculation
		let severity: ErrorSeverity = "low"

		// Pattern-based severity
		if (pattern === ERROR_PATTERNS.SYSTEM || frequency > 0.7) {
			severity = "high"
		} else if (isRecurring || frequency > 0.4 || pattern === ERROR_PATTERNS.PERMISSION) {
			severity = "medium"
		}

		// Adjust based on timing patterns if available
		if (timing) {
			if (timing.hasBurst) {
				// Error burst indicates a serious issue
				severity = "high"
			} else if (timing.isRegularPattern) {
				// Regular patterns suggest systematic issues
				severity = severity === "low" ? "medium" : "high"
			}
		}

		return severity
	}

	getErrorRecommendation(
		pattern: ErrorPattern,
		severity: ErrorSeverity,
		isRecurring: boolean,
		timing?: TimingAnalysis,
	): string {
		const recommendations = new Map<ErrorPattern, string>([
			["timeout", "Consider breaking operation into smaller steps or increasing timeout threshold"],
			["validation", "Review parameter requirements and input formats"],
			["permission", "Verify access rights and consider using alternative approaches"],
			["resource", "Confirm resource existence and check path accuracy"],
			["system", "Wait for system stability or try alternative method"],
			["unknown", "Review error details and consider simpler approach"],
		])

		let recommendation = recommendations.get(pattern) || recommendations.get("unknown")!

		// Add timing-based recommendations
		if (timing) {
			if (timing.hasBurst) {
				recommendation += " Multiple errors occurring in rapid succession suggest a systemic issue."
			} else if (timing.isRegularPattern) {
				recommendation +=
					" Errors are occurring in a regular pattern, indicating a potential timing or resource issue."
			}
			if (timing.avgTimeBetweenErrors < 1000) {
				recommendation += " Consider adding delays between operations."
			}
		}

		if (severity === "high") {
			recommendation += " Immediate attention required."
		}
		if (isRecurring) {
			recommendation += " Pattern suggests systematic issue."
		}

		return recommendation
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

		// Don't retry if there's a burst of errors
		if (errorPattern.timing?.hasBurst) {
			return false
		}

		// Calculate success probability based on error pattern and timing
		const stats = this.getToolPerformanceStats(toolName)
		const successRate = stats.successCount / (stats.successCount + stats.failureCount)

		// Adjust pattern weight based on timing
		let patternWeight =
			errorPattern.pattern === ERROR_PATTERNS.TIMEOUT
				? 0.8
				: errorPattern.pattern === ERROR_PATTERNS.VALIDATION
					? 0.7
					: 0.5

		// Reduce weight if errors follow a regular pattern
		if (errorPattern.timing?.isRegularPattern) {
			patternWeight *= 0.7
		}

		// Reduce weight if errors are happening too quickly
		if (errorPattern.timing?.avgTimeBetweenErrors < 1000) {
			patternWeight *= 0.5
		}

		return successRate * patternWeight > 0.3
	}
}
