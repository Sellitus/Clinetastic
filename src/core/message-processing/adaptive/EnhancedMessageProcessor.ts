import { MessageContext, MessageProcessor, ProcessingResult, Tool, ToolHooks, ResultMetadata } from "../types"
import { AdaptiveEngine } from "./AdaptiveEngine"
import { PatternLearningSystem } from "./PatternLearningSystem"
import { ResourceOptimizer } from "./ResourceOptimizer"
import { AdaptiveConfig, ExecutionPlan, OptimizationStrategy } from "./types"

export class EnhancedAdaptiveProcessor implements MessageProcessor {
	private adaptiveEngine: AdaptiveEngine
	private patternLearning: PatternLearningSystem
	private resourceOptimizer: ResourceOptimizer
	private tools: Map<string, Tool> = new Map()
	private hooks: ToolHooks = {}

	constructor(config: AdaptiveConfig) {
		this.adaptiveEngine = new AdaptiveEngine(config)
		this.patternLearning = new PatternLearningSystem()
		this.resourceOptimizer = new ResourceOptimizer()
	}

	public async process(context: MessageContext): Promise<ProcessingResult> {
		try {
			// Skip tool execution if not required
			if (!context.requiresToolExecution || !context.toolExecution) {
				return {
					success: true,
					content: context.message,
					metadata: this.createDefaultMetadata(),
				}
			}

			const { toolName, params } = context.toolExecution
			const tool = this.tools.get(toolName)

			if (!tool) {
				throw new Error(`Tool ${toolName} not found`)
			}

			// Generate execution plan using adaptive engine
			const executionPlan = this.adaptiveEngine.generateExecutionPlan(tool, context)

			// Check for similar patterns
			const similarPatterns = this.patternLearning.findSimilarPatterns(context)

			// Optimize resource usage based on current metrics and patterns
			const optimizationStrategy = this.resourceOptimizer.optimizeStrategy({
				memoryUsage: process.memoryUsage().heapUsed,
				cpuUsage: process.cpuUsage().user,
				ioOperations: 0, // To be implemented
				networkUsage: 0, // To be implemented
				timestamp: Date.now(),
			})

			// Merge optimization strategies
			const finalStrategy = this.mergeStrategies(executionPlan.strategy, optimizationStrategy)

			// Execute with hooks and monitoring
			const startTime = Date.now()
			const result = await this.executeWithStrategy(tool, params, finalStrategy, context)
			const executionTime = Date.now() - startTime

			// Update learning systems
			if (result.metadata) {
				this.adaptiveEngine.profileTool(tool, result, context)
				this.patternLearning.addPattern({
					inputSignature: JSON.stringify({
						message: context.message,
						toolExecution: context.toolExecution,
					}),
					contextSignature: JSON.stringify(context.environment),
					outcome: {
						success: result.success,
						executionTime,
						resourceUsage: {
							memoryUsage: result.metadata.resources.memory.peakUsage,
							cpuUsage: result.metadata.resources.cpu.peakUsage,
							ioOperations: result.metadata.resources.io?.readOps || 0,
							networkUsage: 0,
							timestamp: Date.now(),
						},
						errorType: result.error?.name,
					},
					timestamp: Date.now(),
				})

				if (result.metadata.resources) {
					this.resourceOptimizer.addMetrics({
						memoryUsage: result.metadata.resources.memory.peakUsage,
						cpuUsage: result.metadata.resources.cpu.peakUsage,
						ioOperations: result.metadata.resources.io?.readOps || 0,
						networkUsage: 0,
						timestamp: Date.now(),
					})
				}

				// Update learning rate based on performance
				this.adaptiveEngine.updateLearningRate(result.metadata)
			}

			// Create enhanced metadata
			const baseMetadata = result.metadata || this.createDefaultMetadata()
			const enhancedMetadata: ResultMetadata = {
				...baseMetadata,
				timing: {
					totalTime: executionTime,
					initTime: baseMetadata.timing.initTime,
					executionTime: baseMetadata.timing.executionTime,
					cleanupTime: baseMetadata.timing.cleanupTime,
					waitTime: baseMetadata.timing.waitTime,
				},
				resources: baseMetadata.resources,
				optimizationHints: {
					suggestions: [
						...this.getOptimizationSuggestions(executionPlan, result),
						...this.resourceOptimizer.getResourceWarnings(),
					],
					bottlenecks: this.identifyBottlenecks(result),
					warnings: [],
					cacheRecommendations: this.getCacheRecommendations(executionPlan),
				},
			}

			return {
				...result,
				metadata: enhancedMetadata,
			}
		} catch (error) {
			const normalizedError = error instanceof Error ? error : new Error(String(error))
			return {
				success: false,
				content: "",
				error: normalizedError,
				metadata: this.createDefaultMetadata(),
			}
		}
	}

	private createDefaultMetadata(): ResultMetadata {
		return {
			timing: {
				totalTime: 0,
				initTime: 0,
				executionTime: 0,
				cleanupTime: 0,
				waitTime: 0,
			},
			resources: {
				memory: {
					peakUsage: 0,
					averageUsage: 0,
					allocated: 0,
					freed: 0,
				},
				cpu: {
					peakUsage: 0,
					averageUsage: 0,
					userTime: 0,
					systemTime: 0,
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
	}

	private mergeStrategies(
		planStrategy: ExecutionPlan["strategy"],
		resourceStrategy: OptimizationStrategy,
	): OptimizationStrategy {
		return {
			shouldCache: planStrategy.shouldCache || resourceStrategy.shouldCache,
			cacheDuration: Math.min(planStrategy.cacheDuration, resourceStrategy.cacheDuration),
			batchSize: Math.min(planStrategy.batchSize, resourceStrategy.batchSize),
			timeout: Math.max(planStrategy.timeout, resourceStrategy.timeout),
			retryStrategy: {
				maxRetries: Math.min(planStrategy.retryStrategy.maxRetries, resourceStrategy.retryStrategy.maxRetries),
				backoffFactor: Math.max(
					planStrategy.retryStrategy.backoffFactor,
					resourceStrategy.retryStrategy.backoffFactor,
				),
				initialDelay: Math.max(
					planStrategy.retryStrategy.initialDelay,
					resourceStrategy.retryStrategy.initialDelay,
				),
			},
		}
	}

	private async executeWithStrategy(
		tool: Tool,
		params: Record<string, any>,
		strategy: OptimizationStrategy,
		context: MessageContext,
	): Promise<ProcessingResult> {
		let attempt = 0
		let lastError: Error | undefined
		let delay = strategy.retryStrategy.initialDelay

		while (attempt < strategy.retryStrategy.maxRetries) {
			try {
				if (this.hooks.beforeExecution) {
					await this.hooks.beforeExecution(context)
				}

				const result = (await Promise.race([
					tool.execute(params),
					new Promise((_, reject) =>
						setTimeout(() => reject(new Error("Execution timeout")), strategy.timeout),
					),
				])) as ProcessingResult

				if (this.hooks.afterExecution) {
					await this.hooks.afterExecution(result)
				}

				return result
			} catch (error) {
				lastError = error instanceof Error ? error : new Error(String(error))

				if (this.hooks.onError) {
					await this.hooks.onError(lastError, {
						toolName: tool.name,
						executionTime: strategy.timeout,
						errorHistory: [lastError],
						retryCount: attempt,
					})
				}

				attempt++
				if (attempt < strategy.retryStrategy.maxRetries) {
					await new Promise((resolve) => setTimeout(resolve, delay))
					delay *= strategy.retryStrategy.backoffFactor
				}
			}
		}

		throw lastError || new Error("Maximum retry attempts exceeded")
	}

	private getOptimizationSuggestions(plan: ExecutionPlan, result: ProcessingResult): string[] {
		const suggestions: string[] = []

		if (result.metadata) {
			const actualTime = result.metadata.timing.executionTime
			const estimatedTime = plan.estimatedMetrics.executionTime

			if (actualTime > estimatedTime * 1.5) {
				suggestions.push("Execution time significantly higher than estimated")
			}

			if (result.metadata.resources.memory.peakUsage > plan.estimatedMetrics.resourceUsage.memoryUsage * 1.5) {
				suggestions.push("Memory usage significantly higher than estimated")
			}
		}

		return suggestions
	}

	private identifyBottlenecks(result: ProcessingResult): string[] {
		const bottlenecks: string[] = []

		if (result.metadata) {
			if (
				result.metadata.timing.waitTime &&
				result.metadata.timing.waitTime > result.metadata.timing.executionTime * 0.5
			) {
				bottlenecks.push("High wait time relative to execution time")
			}

			if (result.metadata.resources.memory.peakUsage > result.metadata.resources.memory.allocated * 0.9) {
				bottlenecks.push("Memory usage approaching allocation limit")
			}
		}

		return bottlenecks
	}

	private getCacheRecommendations(plan: ExecutionPlan): string[] {
		const recommendations: string[] = []

		if (plan.estimatedMetrics.cacheHitProbability > 0.8 && !plan.strategy.shouldCache) {
			recommendations.push("Consider enabling caching for this operation")
		}

		if (plan.strategy.shouldCache && plan.strategy.cacheDuration > 300000) {
			recommendations.push("Consider reducing cache duration to maintain data freshness")
		}

		return recommendations
	}

	public registerTool(tool: Tool): void {
		this.tools.set(tool.name, tool)
	}

	public setToolHooks(hooks: ToolHooks): void {
		this.hooks = hooks
	}

	public addPipelineStage(): void {
		// Pipeline stages are handled by the adaptive engine
	}
}
