import {
	MessageContext,
	MessageProcessor as IMessageProcessor,
	ProcessingResult,
	Tool,
	ToolHooks,
	PipelineStage,
	ResultMetadata,
} from "./types"
import { EnhancedPipeline } from "./pipeline/EnhancedPipeline"
import { EnhancedPipelineStage } from "./pipeline/types"
import { EnhancedValidationStage } from "./stages/EnhancedValidationStage"
import { ErrorHandlingService } from "./ErrorHandlingService"
import { ErrorContext } from "./error-handling"
import { enhanceStage, isEnhancedStage } from "./pipeline/StageAdapter"

interface ToolErrorEntry {
	error: Error
	timestamp: number
	context: {
		input: Record<string, unknown>
		memory: number
		cpu: number
	}
}

interface ToolPerformanceStats {
	avgExecutionTime: number
	successRate: number
	lastNExecutions: number[]
	peakMemoryUsage: number
}

export class EnhancedMessageProcessor implements IMessageProcessor {
	private pipeline: EnhancedPipeline
	private tools: Map<string, Tool> = new Map()
	private hooks: ToolHooks = {}
	private errorHandlingService: ErrorHandlingService
	// Configurable timeouts based on tool complexity
	private readonly DEFAULT_TOOL_EXECUTION_TIME = 30000 // 30 seconds
	private readonly EXTENDED_TOOL_EXECUTION_TIME = 120000 // 2 minutes for complex operations
	private readonly MAX_RETRIES = 5 // Increased for better resilience
	private readonly WARNING_THRESHOLD = 0.7 // Earlier warnings
	private readonly MAX_SIMILAR_EXECUTIONS = 4 // Slightly more lenient
	private readonly SIMILARITY_THRESHOLD = 0.8 // Reduced to avoid false positives
	private readonly LOOP_TIME_WINDOW = 300000 // 5 minutes for better pattern detection

	// Tool execution time overrides for specific tools
	private readonly toolTimeoutOverrides: Map<string, number> = new Map([
		["browser_action", this.EXTENDED_TOOL_EXECUTION_TIME],
		["execute_command", this.EXTENDED_TOOL_EXECUTION_TIME],
		["apply_diff", this.EXTENDED_TOOL_EXECUTION_TIME],
	])

	private toolTimeouts: Map<string, number> = new Map()
	private toolRetryCount: Map<string, number> = new Map()
	private lastToolExecution: Map<string, number> = new Map()
	private toolErrors: Map<string, ToolErrorEntry[]> = new Map()
	private toolPerformance: Map<string, ToolPerformanceStats> = new Map()
	private recentExecutions: Map<
		string,
		Array<{
			params: any
			timestamp: number
			content: string
		}>
	> = new Map()

	constructor() {
		this.pipeline = new EnhancedPipeline()
		this.errorHandlingService = new ErrorHandlingService()
		this.addPipelineStage(new EnhancedValidationStage())
	}

	async process(context: MessageContext): Promise<ProcessingResult> {
		const startTime = Date.now()
		const initStartTime = Date.now()
		const initialMemory = process.memoryUsage()
		const initialCpu = process.cpuUsage()

		try {
			const initEndTime = Date.now()
			const pipelineResult = await this.pipeline.process(context)
			const enrichedContext = pipelineResult.context
			const executionStartTime = Date.now()

			if (enrichedContext.requiresToolExecution && enrichedContext.toolExecution) {
				const toolResult = await this.executeTool(enrichedContext)
				const executionEndTime = Date.now()
				const cleanupStartTime = Date.now()
				const currentMemory = process.memoryUsage()
				const currentCpu = process.cpuUsage(initialCpu)
				const cleanupEndTime = Date.now()

				const metadata: ResultMetadata = {
					timing: {
						totalTime: Date.now() - startTime,
						initTime: initEndTime - initStartTime,
						executionTime: executionEndTime - executionStartTime,
						cleanupTime: cleanupEndTime - cleanupStartTime,
						waitTime: 0,
					},
					pipelineMetrics: pipelineResult.metrics,
					executionPath: pipelineResult.executionPath,
					resources: {
						memory: {
							peakUsage: currentMemory.heapUsed,
							averageUsage: (initialMemory.heapUsed + currentMemory.heapUsed) / 2,
							allocated: currentMemory.heapTotal,
							freed: currentMemory.heapTotal - currentMemory.heapUsed,
						},
						cpu: {
							peakUsage: currentCpu.user + currentCpu.system,
							averageUsage: (currentCpu.user + currentCpu.system) / 2,
							userTime: currentCpu.user,
							systemTime: currentCpu.system,
						},
						io: {
							bytesRead: 0,
							bytesWritten: 0,
							readOps: 0,
							writeOps: 0,
						},
					},
					optimizationHints: {
						suggestions: [],
						bottlenecks: [],
						warnings: [],
						cacheRecommendations: [],
					},
				}

				return {
					success: toolResult.success,
					content: toolResult.content,
					error: toolResult.error,
					toolResult,
					metadata,
				}
			}

			const executionEndTime = Date.now()
			const cleanupStartTime = Date.now()
			const currentMemory = process.memoryUsage()
			const currentCpu = process.cpuUsage(initialCpu)
			const cleanupEndTime = Date.now()

			const metadata: ResultMetadata = {
				timing: {
					totalTime: Date.now() - startTime,
					initTime: initEndTime - initStartTime,
					executionTime: executionEndTime - executionStartTime,
					cleanupTime: cleanupEndTime - cleanupStartTime,
					waitTime: 0,
				},
				pipelineMetrics: pipelineResult.metrics,
				executionPath: pipelineResult.executionPath,
				resources: {
					memory: {
						peakUsage: currentMemory.heapUsed,
						averageUsage: (initialMemory.heapUsed + currentMemory.heapUsed) / 2,
						allocated: currentMemory.heapTotal,
						freed: currentMemory.heapTotal - currentMemory.heapUsed,
					},
					cpu: {
						peakUsage: currentCpu.user + currentCpu.system,
						averageUsage: (currentCpu.user + currentCpu.system) / 2,
						userTime: currentCpu.user,
						systemTime: currentCpu.system,
					},
					io: {
						bytesRead: 0,
						bytesWritten: 0,
						readOps: 0,
						writeOps: 0,
					},
				},
				optimizationHints: {
					suggestions: [],
					bottlenecks: [],
					warnings: [],
					cacheRecommendations: [],
				},
			}

			return {
				success: true,
				content: enrichedContext.message,
				metadata,
			}
		} catch (error) {
			const executionEndTime = Date.now()
			const currentMemory = process.memoryUsage()
			const currentCpu = process.cpuUsage(initialCpu)

			const metadata: ResultMetadata = {
				timing: {
					totalTime: Date.now() - startTime,
					initTime: 0,
					executionTime: executionEndTime - startTime,
					cleanupTime: 0,
					waitTime: 0,
				},
				resources: {
					memory: {
						peakUsage: currentMemory.heapUsed,
						averageUsage: (initialMemory.heapUsed + currentMemory.heapUsed) / 2,
						allocated: currentMemory.heapTotal,
						freed: currentMemory.heapTotal - currentMemory.heapUsed,
					},
					cpu: {
						peakUsage: currentCpu.user + currentCpu.system,
						averageUsage: (currentCpu.user + currentCpu.system) / 2,
						userTime: currentCpu.user,
						systemTime: currentCpu.system,
					},
					io: {
						bytesRead: 0,
						bytesWritten: 0,
						readOps: 0,
						writeOps: 0,
					},
				},
				optimizationHints: {
					suggestions: ["Consider error handling improvements"],
					bottlenecks: [],
					warnings: ["Unexpected error occurred"],
					cacheRecommendations: [],
				},
			}

			return {
				success: false,
				content: "",
				error: error instanceof Error ? error : new Error(String(error)),
				metadata,
			}
		}
	}

	addPipelineStage(stage: PipelineStage | EnhancedPipelineStage): void {
		if (isEnhancedStage(stage)) {
			this.pipeline.addStage(stage)
		} else {
			const enhancedStage = enhanceStage(stage, {
				maxRetries: this.MAX_RETRIES,
				resourceLimits: {
					timeout: this.DEFAULT_TOOL_EXECUTION_TIME,
				},
			})
			this.pipeline.addStage(enhancedStage)
		}
	}

	registerTool(tool: Tool): void {
		this.tools.set(tool.name, tool)
	}

	setToolHooks(hooks: ToolHooks): void {
		this.hooks = hooks
	}

	/**
	 * Calculate similarity between two strings using Levenshtein distance
	 */
	private calculateSimilarity(str1: string, str2: string): number {
		const matrix: number[][] = []
		const len1 = str1.length
		const len2 = str2.length

		// Initialize matrix
		for (let i = 0; i <= len1; i++) {
			matrix[i] = [i]
		}
		for (let j = 0; j <= len2; j++) {
			matrix[0][j] = j
		}

		// Fill matrix
		for (let i = 1; i <= len1; i++) {
			for (let j = 1; j <= len2; j++) {
				if (str1[i - 1] === str2[j - 1]) {
					matrix[i][j] = matrix[i - 1][j - 1]
				} else {
					matrix[i][j] = Math.min(
						matrix[i - 1][j - 1] + 1, // substitution
						matrix[i][j - 1] + 1, // insertion
						matrix[i - 1][j] + 1, // deletion
					)
				}
			}
		}

		// Calculate similarity ratio (0 to 1)
		const distance = matrix[len1][len2]
		const maxLength = Math.max(len1, len2)
		return 1 - distance / maxLength
	}

	/**
	 * Analyze pattern of similar executions to provide meaningful feedback
	 */
	private analyzeExecutionPattern(
		executions: Array<{
			params: any
			timestamp: number
			content: string
		}>,
	): { description: string } {
		const timeGaps: number[] = []
		for (let i = 1; i < executions.length; i++) {
			timeGaps.push(executions[i].timestamp - executions[i - 1].timestamp)
		}

		const avgTimeGap = timeGaps.reduce((a, b) => a + b, 0) / timeGaps.length
		const isRegular = timeGaps.every((gap) => Math.abs(gap - avgTimeGap) < avgTimeGap * 0.2)

		const paramKeys = Object.keys(executions[0].params)
		const changingParams = paramKeys.filter(
			(key) =>
				!executions.every(
					(exec) => JSON.stringify(exec.params[key]) === JSON.stringify(executions[0].params[key]),
				),
		)

		let description = ""
		if (isRegular) {
			description += `Regular interval detected (${Math.round(avgTimeGap)}ms). `
		}

		if (changingParams.length > 0) {
			description += `Parameters varying: ${changingParams.join(", ")}. `
		} else {
			description += "Identical parameters in all executions. "
		}

		return { description }
	}

	private async executeTool(context: MessageContext): Promise<ProcessingResult> {
		if (!context.toolExecution) {
			throw new Error("Tool execution context missing")
		}

		const { toolName, params } = context.toolExecution
		const tool = this.tools.get(toolName)

		if (!tool) {
			throw new Error(`Tool ${toolName} not found`)
		}

		const lastExecution = this.lastToolExecution.get(toolName)
		if (lastExecution) {
			const timeSinceLastExecution = Date.now() - lastExecution
			const timeout = this.toolTimeouts.get(toolName) || 0
			if (timeSinceLastExecution < timeout) {
				const waitTime = Math.ceil((timeout - timeSinceLastExecution) / 1000)
				throw new Error(`Tool ${toolName} is in timeout. Please wait ${waitTime} seconds before retrying.`)
			}
		}

		const startTime = Date.now()
		const initStartTime = Date.now()
		const initialMemory = process.memoryUsage()
		const initialCpu = process.cpuUsage()
		let timeoutId: NodeJS.Timeout | undefined

		try {
			const initEndTime = Date.now()
			if (this.hooks.beforeExecution) {
				await this.hooks.beforeExecution(context)
			}

			if (!tool.validate(params)) {
				const retryCount = this.toolRetryCount.get(toolName) || 0
				this.toolRetryCount.set(toolName, retryCount + 1)

				if (retryCount >= this.MAX_RETRIES) {
					const timeout = this.toolTimeoutOverrides.get(toolName) || this.DEFAULT_TOOL_EXECUTION_TIME
					this.toolTimeouts.set(toolName, timeout)
					this.lastToolExecution.set(toolName, Date.now())
					throw new Error(
						`Maximum retry attempts (${this.MAX_RETRIES}) exceeded for tool ${toolName}. Tool has been temporarily disabled.`,
					)
				}

				throw new Error(
					`Invalid parameters for tool ${toolName}. Attempt ${retryCount + 1}/${
						this.MAX_RETRIES
					}. Please check parameter types and requirements.`,
				)
			}

			this.toolRetryCount.delete(toolName)

			// Check for potential loops
			const recentToolExecutions = this.recentExecutions.get(toolName) || []
			const currentTime = Date.now()

			// Clean up old executions outside the time window
			const filteredExecutions = recentToolExecutions.filter(
				(exec) => currentTime - exec.timestamp < this.LOOP_TIME_WINDOW,
			)

			// Check for similar executions
			const similarExecutions = filteredExecutions.filter((exec) => {
				// Compare parameters
				const paramsMatch = JSON.stringify(exec.params) === JSON.stringify(params)

				// If params match exactly, likely a loop
				if (paramsMatch) return true

				// Check content similarity if available
				if (exec.content && typeof exec.content === "string") {
					const similarity = this.calculateSimilarity(exec.content, JSON.stringify(params))
					if (similarity > this.SIMILARITY_THRESHOLD) return true
				}

				return false
			})

			if (similarExecutions.length >= this.MAX_SIMILAR_EXECUTIONS) {
				const pattern = this.analyzeExecutionPattern(similarExecutions)
				throw new Error(
					`Potential loop detected: ${pattern.description}\n` +
						`${similarExecutions.length} similar executions of ${toolName} in ${this.LOOP_TIME_WINDOW / 1000}s\n` +
						"Consider using a different approach or adding more variation to the parameters.",
				)
			}

			// Record this execution
			filteredExecutions.push({
				params,
				timestamp: currentTime,
				content: "", // Will be updated after successful execution
			})
			this.recentExecutions.set(toolName, filteredExecutions)

			const timeoutPromise = new Promise<never>((_, reject) => {
				const timeout = this.toolTimeoutOverrides.get(toolName) || this.DEFAULT_TOOL_EXECUTION_TIME
				timeoutId = setTimeout(() => {
					reject(new Error(`Tool execution timed out after ${timeout}ms`))
				}, timeout)
			})

			const executionStartTime = Date.now()
			const result = await Promise.race([tool.execute(params), timeoutPromise])
			const executionEndTime = Date.now()
			const cleanupStartTime = Date.now()
			const currentMemory = process.memoryUsage()
			const currentCpu = process.cpuUsage(initialCpu)

			// Update the recent execution with the actual result content
			const currentExecutions = this.recentExecutions.get(toolName) || []
			const lastExecution = currentExecutions[currentExecutions.length - 1]
			if (lastExecution) {
				lastExecution.content = result.content || ""
				this.recentExecutions.set(toolName, currentExecutions)
			}

			this.lastToolExecution.set(toolName, Date.now())
			this.errorHandlingService.updateToolPerformance(toolName, executionEndTime - executionStartTime, true)

			if (this.hooks.afterExecution) {
				await this.hooks.afterExecution(result)
			}
			const cleanupEndTime = Date.now()

			const metadata: ResultMetadata = {
				timing: {
					totalTime: Date.now() - startTime,
					initTime: initEndTime - initStartTime,
					executionTime: executionEndTime - executionStartTime,
					cleanupTime: cleanupEndTime - cleanupStartTime,
					waitTime: 0,
				},
				resources: {
					memory: {
						peakUsage: currentMemory.heapUsed,
						averageUsage: (initialMemory.heapUsed + currentMemory.heapUsed) / 2,
						allocated: currentMemory.heapTotal,
						freed: currentMemory.heapTotal - currentMemory.heapUsed,
					},
					cpu: {
						peakUsage: currentCpu.user + currentCpu.system,
						averageUsage: (currentCpu.user + currentCpu.system) / 2,
						userTime: currentCpu.user,
						systemTime: currentCpu.system,
					},
					io: {
						bytesRead: 0,
						bytesWritten: 0,
						readOps: 0,
						writeOps: 0,
					},
				},
				optimizationHints: {
					suggestions: [],
					bottlenecks: [],
					warnings: [],
					cacheRecommendations: [],
				},
			}

			return {
				success: result.success,
				content: result.content,
				error: result.error,
				metadata,
			}
		} catch (error) {
			const executionEndTime = Date.now()
			const normalizedError = error instanceof Error ? error : new Error(String(error))
			const currentMemory = process.memoryUsage()
			const currentCpu = process.cpuUsage(initialCpu)

			// Update error tracking with enhanced context
			const errors = this.toolErrors.get(toolName) || []
			const errorEntry = {
				error: normalizedError,
				timestamp: Date.now(),
				context: {
					input: params,
					memory: currentMemory.heapUsed,
					cpu: currentCpu.user + currentCpu.system,
				},
			}
			errors.push(errorEntry)
			this.toolErrors.set(toolName, errors)

			// Update performance tracking
			const perfStats = this.toolPerformance.get(toolName) || {
				avgExecutionTime: 0,
				successRate: 1,
				lastNExecutions: [],
				peakMemoryUsage: 0,
			}

			perfStats.lastNExecutions.push(executionEndTime - startTime)
			if (perfStats.lastNExecutions.length > 10) {
				perfStats.lastNExecutions.shift()
			}
			perfStats.avgExecutionTime =
				perfStats.lastNExecutions.reduce((a, b) => a + b, 0) / perfStats.lastNExecutions.length
			perfStats.successRate = (perfStats.successRate * (errors.length - 1) + 0) / errors.length
			perfStats.peakMemoryUsage = Math.max(perfStats.peakMemoryUsage, currentMemory.heapUsed)

			this.toolPerformance.set(toolName, perfStats)
			this.errorHandlingService.updateToolPerformance(toolName, executionEndTime - startTime, false)

			// Analyze error patterns using enhanced error entries
			const errorPattern = this.errorHandlingService.analyzeErrorPatterns(errors)
			const retryCount = this.toolRetryCount.get(toolName) || 0
			const shouldRetry = this.errorHandlingService.determineRetryStrategy(toolName, errorPattern, retryCount)

			const errorContext: ErrorContext = {
				toolName,
				executionTime: executionEndTime - startTime,
				errorHistory: errors,
				retryCount,
				errorPattern,
				performance: {
					...this.errorHandlingService.getToolPerformanceStats(toolName),
					avgExecutionTime: perfStats.avgExecutionTime,
					successRate: perfStats.successRate,
					lastNExecutions: perfStats.lastNExecutions,
					peakMemoryUsage: perfStats.peakMemoryUsage,
				},
				systemState: {
					memoryUsage: currentMemory,
					uptime: process.uptime(),
					lastExecutionStats: {
						avgTime: perfStats.avgExecutionTime,
						successRate: perfStats.successRate,
						peakMemory: perfStats.peakMemoryUsage,
					},
				},
			}

			if (this.hooks.onError) {
				// Convert enhanced error entries to basic errors for backward compatibility
				const basicErrorContext = {
					...errorContext,
					errorHistory: errors.map((entry) => entry.error),
				}
				await this.hooks.onError(normalizedError, basicErrorContext)
			}

			if (shouldRetry) {
				const backoffDelay = this.errorHandlingService.calculateBackoffDelay(toolName, retryCount)
				this.toolTimeouts.set(toolName, backoffDelay)
				this.lastToolExecution.set(toolName, Date.now())
			} else {
				const timeout = this.toolTimeoutOverrides.get(toolName) || this.DEFAULT_TOOL_EXECUTION_TIME
				this.toolTimeouts.set(toolName, timeout * 2)
				this.lastToolExecution.set(toolName, Date.now())
			}

			const metadata: ResultMetadata = {
				timing: {
					totalTime: Date.now() - startTime,
					initTime: 0,
					executionTime: executionEndTime - startTime,
					cleanupTime: 0,
					waitTime: 0,
				},
				resources: {
					memory: {
						peakUsage: currentMemory.heapUsed,
						averageUsage: (initialMemory.heapUsed + currentMemory.heapUsed) / 2,
						allocated: currentMemory.heapTotal,
						freed: currentMemory.heapTotal - currentMemory.heapUsed,
					},
					cpu: {
						peakUsage: currentCpu.user + currentCpu.system,
						averageUsage: (currentCpu.user + currentCpu.system) / 2,
						userTime: currentCpu.user,
						systemTime: currentCpu.system,
					},
					io: {
						bytesRead: 0,
						bytesWritten: 0,
						readOps: 0,
						writeOps: 0,
					},
				},
				optimizationHints: {
					suggestions: [errorPattern.recommendation],
					bottlenecks: [`${toolName} execution failed`],
					warnings: [`Error severity: ${errorPattern.severity}`],
					cacheRecommendations: [],
				},
			}

			return {
				success: false,
				content: "",
				error: normalizedError,
				metadata,
			}
		} finally {
			if (timeoutId) {
				clearTimeout(timeoutId)
			}
		}
	}
}
