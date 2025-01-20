import { MessageContext } from "../types"
import { EnhancedPipelineStage, PipelineBranch, PipelineMetrics, PipelineResult } from "./types"

export class EnhancedPipeline {
	private stages: EnhancedPipelineStage[] = []
	private readonly STAGE_TIMEOUT = 30000 // 30 seconds
	private metrics: PipelineMetrics
	private executionPath: string[] = []
	private startTime: number
	private initialMemory: NodeJS.MemoryUsage
	private initialCpu: NodeJS.CpuUsage

	constructor() {
		this.startTime = Date.now()
		this.initialMemory = process.memoryUsage()
		this.initialCpu = process.cpuUsage()

		this.metrics = {
			totalTime: 0,
			stageMetrics: new Map(),
			parallelGroups: [],
			errors: [],
			warnings: [],
			recoveryAttempts: 0,
			performance: {
				averageStageTime: 0,
				maxStageTime: 0,
				minStageTime: Number.MAX_VALUE,
				totalMemoryUsage: 0,
				peakMemoryUsage: 0,
				cpuUtilization: 0,
				heapUtilization: 0,
			},
			resources: {
				memoryUsage: this.initialMemory,
				cpuUsage: this.initialCpu,
				heapStats: {
					totalHeapSize: this.initialMemory.heapTotal,
					usedHeapSize: this.initialMemory.heapUsed,
					heapSizeLimit: this.initialMemory.heapTotal,
				},
			},
		}
	}

	addStage(stage: EnhancedPipelineStage): void {
		// Validate stage configuration
		if (!stage.config.id) {
			throw new Error("Stage must have an ID")
		}

		// Check for duplicate IDs
		if (this.stages.some((s) => s.config.id === stage.config.id)) {
			throw new Error(`Duplicate stage ID: ${stage.config.id}`)
		}

		// Validate dependencies
		for (const depId of stage.config.dependencies) {
			if (!this.stages.some((s) => s.config.id === depId)) {
				throw new Error(`Stage ${stage.config.id} depends on non-existent stage ${depId}`)
			}
		}

		// Add stage with validated configuration
		this.stages.push({
			...stage,
			config: {
				...stage.config,
				maxRetries: stage.config.maxRetries ?? 3,
				retryDelay: stage.config.retryDelay ?? 1000,
				useExponentialBackoff: stage.config.useExponentialBackoff ?? true,
				resourceLimits: {
					maxMemory: stage.config.resourceLimits?.maxMemory ?? 1024 * 1024 * 100, // 100MB
					maxCpu: stage.config.resourceLimits?.maxCpu ?? 30000, // 30 seconds
					timeout: stage.config.resourceLimits?.timeout ?? 30000, // 30 seconds
				},
				errorHandling: {
					ignoreErrors: stage.config.errorHandling?.ignoreErrors ?? false,
					fallbackValue: stage.config.errorHandling?.fallbackValue,
					errorTransform: stage.config.errorHandling?.errorTransform ?? ((error: Error) => error),
				},
			},
		})
	}

	async process(context: MessageContext): Promise<PipelineResult> {
		let currentContext = context

		try {
			// Process stages based on dependencies and parallel execution
			const stageGroups = this.organizeStages()

			for (const group of stageGroups) {
				if (group.length === 1) {
					// Sequential execution
					currentContext = await this.processSingleStage(group[0], currentContext)
				} else {
					// Parallel execution
					const results = await Promise.all(
						group.map((stage) => this.processSingleStage(stage, currentContext)),
					)
					// Merge results from parallel execution
					currentContext = this.mergeContexts(results)
					this.metrics.parallelGroups.push(group.map((stage) => stage.config.id))
				}
			}

			this.updatePerformanceMetrics()
			this.metrics.totalTime = Date.now() - this.startTime

			return {
				context: currentContext,
				metrics: this.metrics,
				executionPath: this.executionPath,
			}
		} catch (error) {
			this.metrics.errors.push({
				stageId: this.executionPath[this.executionPath.length - 1],
				error: error instanceof Error ? error : new Error(String(error)),
				timestamp: Date.now(),
				context: { currentStage: this.executionPath[this.executionPath.length - 1] },
			})
			throw error
		}
	}

	private async processSingleStage(
		stage: EnhancedPipelineStage,
		context: MessageContext,
		retryCount: number = 0,
	): Promise<MessageContext> {
		// Check stage condition
		if (stage.config.condition) {
			const shouldExecute = await stage.config.condition(context)
			if (!shouldExecute) {
				return context
			}
		}

		// Start timing and resource monitoring
		const stageStartTime = Date.now()
		const stageStartMemory = process.memoryUsage()
		const stageStartCpu = process.cpuUsage()

		this.executionPath.push(stage.config.id)

		// Set up timeout
		const timeoutPromise = new Promise<never>((_, reject) => {
			setTimeout(() => {
				reject(new Error(`Stage ${stage.config.id} timed out after ${this.STAGE_TIMEOUT}ms`))
			}, this.STAGE_TIMEOUT)
		})

		try {
			// Process stage with timeout
			const result = await Promise.race([stage.process(context), timeoutPromise])

			// Handle branching
			if (stage.config.branches) {
				const branchResult = await this.processBranches(stage.config.branches, result)
				if (branchResult) {
					return branchResult
				}
			}

			// Record success metrics
			this.recordStageMetrics(stage.config.id, stageStartTime, retryCount, stageStartMemory, stageStartCpu)

			return result
		} catch (error) {
			// Record error metrics
			this.metrics.errors.push({
				stageId: stage.config.id,
				error: error instanceof Error ? error : new Error(String(error)),
				timestamp: Date.now(),
				context: { retryCount },
			})

			// Check resource limits before retrying
			const currentMemory = process.memoryUsage()
			const currentCpu = process.cpuUsage()
			const resourceLimits = stage.config.resourceLimits

			if (resourceLimits) {
				if (resourceLimits.maxMemory && currentMemory.heapUsed > resourceLimits.maxMemory) {
					throw new Error(
						`Stage ${stage.config.id} exceeded memory limit: ${currentMemory.heapUsed} > ${resourceLimits.maxMemory}`,
					)
				}
				if (resourceLimits.maxCpu && currentCpu.user + currentCpu.system > resourceLimits.maxCpu) {
					throw new Error(
						`Stage ${stage.config.id} exceeded CPU limit: ${currentCpu.user + currentCpu.system} > ${resourceLimits.maxCpu}`,
					)
				}
			}

			// Handle error transformation
			if (stage.config.errorHandling?.errorTransform) {
				error = stage.config.errorHandling.errorTransform(
					error instanceof Error ? error : new Error(String(error)),
				)
			}

			// Handle retry logic with exponential backoff
			if (retryCount < (stage.config.maxRetries || 0)) {
				this.metrics.recoveryAttempts++

				// Calculate retry delay
				let retryDelay = stage.config.retryDelay || 1000
				if (stage.config.useExponentialBackoff) {
					retryDelay = retryDelay * Math.pow(2, retryCount)
				}

				this.metrics.warnings.push({
					stageId: stage.config.id,
					message: `Retrying stage after error: ${error.message}. Delay: ${retryDelay}ms`,
					timestamp: Date.now(),
					context: {
						retryCount,
						error: error.message,
						retryDelay,
						memoryUsage: currentMemory,
						cpuUsage: currentCpu,
					},
				})

				// Wait for retry delay
				await new Promise((resolve) => setTimeout(resolve, retryDelay))
				return this.processSingleStage(stage, context, retryCount + 1)
			}

			// Handle error ignore option
			if (stage.config.errorHandling?.ignoreErrors) {
				this.metrics.warnings.push({
					stageId: stage.config.id,
					message: `Ignoring error in stage: ${error.message}`,
					timestamp: Date.now(),
					context: { error: error.message },
				})
				return stage.config.errorHandling.fallbackValue || context
			}

			throw error
		}
	}

	private async processBranches(branches: PipelineBranch[], context: MessageContext): Promise<MessageContext | null> {
		for (const branch of branches) {
			if (await branch.condition(context)) {
				let branchContext = context
				for (const stage of branch.stages) {
					branchContext = await this.processSingleStage(stage, branchContext)
				}
				return branchContext
			}
		}
		return null
	}

	private recordStageMetrics(
		stageId: string,
		startTime: number,
		retryCount: number,
		startMemory: NodeJS.MemoryUsage,
		startCpu: NodeJS.CpuUsage,
	): void {
		const endTime = Date.now()
		const duration = endTime - startTime
		const endMemory = process.memoryUsage()
		const endCpu = process.cpuUsage(startCpu)

		this.metrics.stageMetrics.set(stageId, {
			startTime,
			endTime,
			duration,
			retryCount,
			recoveryTime: retryCount > 0 ? duration : undefined,
			memoryUsage: {
				rss: endMemory.rss - startMemory.rss,
				heapTotal: endMemory.heapTotal - startMemory.heapTotal,
				heapUsed: endMemory.heapUsed - startMemory.heapUsed,
				external: endMemory.external - startMemory.external,
				arrayBuffers: endMemory.arrayBuffers - startMemory.arrayBuffers,
			},
			cpuUsage: endCpu,
			heapStats: {
				totalHeapSize: endMemory.heapTotal,
				usedHeapSize: endMemory.heapUsed,
				heapSizeLimit: endMemory.heapTotal,
			},
		})
	}

	private updatePerformanceMetrics(): void {
		const stageTimes = Array.from(this.metrics.stageMetrics.values()).map((m) => m.duration)
		const currentMemory = process.memoryUsage()
		const currentCpu = process.cpuUsage(this.initialCpu)

		this.metrics.performance = {
			averageStageTime: stageTimes.reduce((a, b) => a + b, 0) / stageTimes.length,
			maxStageTime: Math.max(...stageTimes),
			minStageTime: Math.min(...stageTimes),
			totalMemoryUsage: currentMemory.heapUsed + currentMemory.external,
			peakMemoryUsage: Math.max(
				this.metrics.performance.peakMemoryUsage,
				currentMemory.heapUsed + currentMemory.external,
			),
			cpuUtilization: (currentCpu.user + currentCpu.system) / ((Date.now() - this.startTime) * 1000),
			heapUtilization: currentMemory.heapUsed / currentMemory.heapTotal,
		}

		this.metrics.resources = {
			memoryUsage: currentMemory,
			cpuUsage: currentCpu,
			heapStats: {
				totalHeapSize: currentMemory.heapTotal,
				usedHeapSize: currentMemory.heapUsed,
				heapSizeLimit: currentMemory.heapTotal,
			},
		}
	}

	private organizeStages(): EnhancedPipelineStage[][] {
		const groups: EnhancedPipelineStage[][] = []
		const remainingStages = [...this.stages]

		while (remainingStages.length > 0) {
			const availableStages = remainingStages.filter((stage) =>
				this.areDependenciesMet(stage, this.executionPath),
			)

			if (availableStages.length === 0) {
				throw new Error("Circular dependency detected in pipeline stages")
			}

			const parallelStages = availableStages.filter((stage) => stage.config.parallel)
			if (parallelStages.length > 0) {
				groups.push(parallelStages)
				parallelStages.forEach((stage) => {
					const index = remainingStages.indexOf(stage)
					remainingStages.splice(index, 1)
				})
			} else {
				const nextStage = availableStages[0]
				groups.push([nextStage])
				const index = remainingStages.indexOf(nextStage)
				remainingStages.splice(index, 1)
			}
		}

		return groups
	}

	private areDependenciesMet(stage: EnhancedPipelineStage, executedStages: string[]): boolean {
		return stage.config.dependencies.every((dep) => executedStages.includes(dep))
	}

	private mergeContexts(contexts: MessageContext[]): MessageContext {
		return contexts.reduce((merged, current) => ({
			...merged,
			...current,
			metadata: {
				...merged.metadata,
				...current.metadata,
			},
		}))
	}
}
