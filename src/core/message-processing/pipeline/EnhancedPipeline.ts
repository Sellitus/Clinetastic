import { MessageContext } from "../types"
import { EnhancedPipelineStage, PipelineBranch, PipelineMetrics, PipelineResult } from "./types"

export class EnhancedPipeline {
	private stages: EnhancedPipelineStage[] = []
	private metrics: PipelineMetrics = {
		totalTime: 0,
		stageMetrics: new Map(),
		parallelGroups: [],
	}
	private executionPath: string[] = []

	/**
	 * Add a stage to the pipeline
	 */
	addStage(stage: EnhancedPipelineStage): void {
		this.stages.push(stage)
	}

	/**
	 * Process message through the pipeline
	 */
	async process(context: MessageContext): Promise<PipelineResult> {
		const startTime = Date.now()
		let currentContext = context

		// Sort stages by priority
		const sortedStages = this.stages.sort((a, b) => a.config.priority - b.config.priority)

		// Group stages by dependencies
		const stageGroups = this.groupStagesByDependencies(sortedStages)

		// Process each group
		for (const group of stageGroups) {
			if (group.length === 1) {
				// Single stage - process normally
				currentContext = await this.processSingleStage(group[0], currentContext)
			} else {
				// Multiple stages - check for parallel execution
				const parallelStages = group.filter((stage) => stage.config.parallel)
				const sequentialStages = group.filter((stage) => !stage.config.parallel)

				// Execute parallel stages
				if (parallelStages.length > 0) {
					this.metrics.parallelGroups.push(parallelStages.map((s) => s.config.id))
					currentContext = await this.processParallelStages(parallelStages, currentContext)
				}

				// Execute sequential stages
				for (const stage of sequentialStages) {
					currentContext = await this.processSingleStage(stage, currentContext)
				}
			}
		}

		this.metrics.totalTime = Date.now() - startTime

		return {
			context: currentContext,
			metrics: this.metrics,
			executionPath: this.executionPath,
		}
	}

	/**
	 * Process a single pipeline stage
	 */
	private async processSingleStage(stage: EnhancedPipelineStage, context: MessageContext): Promise<MessageContext> {
		// Check stage condition
		if (stage.config.condition) {
			const shouldExecute = await stage.config.condition(context)
			if (!shouldExecute) {
				return context
			}
		}

		// Start timing
		const startTime = Date.now()
		this.executionPath.push(stage.config.id)

		try {
			// Process stage
			const result = await stage.process(context)

			// Handle branching
			if (stage.config.branches) {
				const branchResult = await this.processBranches(stage.config.branches, result)
				if (branchResult) {
					return branchResult
				}
			}

			// Record metrics
			this.recordStageMetrics(stage.config.id, startTime)

			return result
		} catch (error) {
			// Record failure metrics
			this.recordStageMetrics(stage.config.id, startTime)
			throw error
		}
	}

	/**
	 * Process multiple stages in parallel
	 */
	private async processParallelStages(
		stages: EnhancedPipelineStage[],
		context: MessageContext,
	): Promise<MessageContext> {
		// Execute all stages in parallel
		const results = await Promise.all(stages.map((stage) => this.processSingleStage(stage, context)))

		// Merge results
		return results.reduce(
			(merged, current) => ({
				...merged,
				...current,
			}),
			context,
		)
	}

	/**
	 * Process conditional branches
	 */
	private async processBranches(branches: PipelineBranch[], context: MessageContext): Promise<MessageContext | null> {
		for (const branch of branches) {
			const shouldTakeBranch = await branch.condition(context)
			if (shouldTakeBranch) {
				let branchContext = context

				// Process all stages in the branch
				for (const stage of branch.stages) {
					branchContext = await this.processSingleStage(stage, branchContext)
				}

				return branchContext
			}
		}

		return null
	}

	/**
	 * Group stages by their dependencies
	 */
	private groupStagesByDependencies(stages: EnhancedPipelineStage[]): EnhancedPipelineStage[][] {
		const groups: EnhancedPipelineStage[][] = []
		const unprocessed = new Set(stages)

		while (unprocessed.size > 0) {
			const group: EnhancedPipelineStage[] = []

			for (const stage of unprocessed) {
				// Check if all dependencies are processed
				const dependenciesMet = stage.config.dependencies.every(
					(depId) => !Array.from(unprocessed).some((s) => s.config.id === depId),
				)

				if (dependenciesMet) {
					group.push(stage)
					unprocessed.delete(stage)
				}
			}

			if (group.length === 0) {
				throw new Error("Circular dependency detected in pipeline stages")
			}

			groups.push(group)
		}

		return groups
	}

	/**
	 * Record metrics for a stage
	 */
	private recordStageMetrics(stageId: string, startTime: number): void {
		const endTime = Date.now()
		this.metrics.stageMetrics.set(stageId, {
			startTime,
			endTime,
			duration: endTime - startTime,
		})
	}
}
