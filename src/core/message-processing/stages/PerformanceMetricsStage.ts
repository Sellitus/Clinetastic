import { PipelineStage, MessageContext, ResultMetadata } from "../types"
import { performance } from "perf_hooks"
import process from "process"

export class PerformanceMetricsStage implements PipelineStage {
	id = "performance_metrics"
	private startTime: number = 0
	private startMemory: NodeJS.MemoryUsage = process.memoryUsage()
	private startCpuUsage: NodeJS.CpuUsage = process.cpuUsage()

	constructor() {
		this.startTime = performance.now()
	}

	async process(context: MessageContext): Promise<MessageContext> {
		// Start measuring
		this.startTime = performance.now()
		this.startMemory = process.memoryUsage()
		this.startCpuUsage = process.cpuUsage()

		// Process the message
		const result = { ...context }

		// End measuring
		const endTime = performance.now()
		const endMemory = process.memoryUsage()
		const endCpuUsage = process.cpuUsage(this.startCpuUsage)

		// Calculate metrics
		const metadata: ResultMetadata = {
			timing: {
				totalTime: endTime - this.startTime,
				initTime: 0, // Will be set by actual processing
				executionTime: endTime - this.startTime,
				cleanupTime: 0,
				waitTime: 0,
			},
			resources: {
				memory: {
					peakUsage: endMemory.heapUsed,
					averageUsage: (this.startMemory.heapUsed + endMemory.heapUsed) / 2,
					allocated: endMemory.heapTotal - this.startMemory.heapTotal,
					freed:
						this.startMemory.heapUsed -
						endMemory.heapUsed +
						(endMemory.heapTotal - this.startMemory.heapTotal),
				},
				cpu: {
					peakUsage: endCpuUsage.user + endCpuUsage.system,
					averageUsage: (endCpuUsage.user + endCpuUsage.system) / 2,
					userTime: endCpuUsage.user,
					systemTime: endCpuUsage.system,
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
				warnings: [],
				bottlenecks: [],
				cacheRecommendations: [],
			},
		}

		// Ensure optimizationHints exists
		metadata.optimizationHints = metadata.optimizationHints || {
			suggestions: [],
			warnings: [],
			bottlenecks: [],
			cacheRecommendations: [],
		}

		// Add optimization hints based on metrics
		if (metadata.resources.memory.peakUsage > 500 * 1024 * 1024) {
			// 500MB
			metadata.optimizationHints.warnings.push("High memory usage detected")
		}
		if (metadata.timing.totalTime > 1000) {
			// 1 second
			metadata.optimizationHints.warnings.push("Processing time exceeded 1 second")
		}
		if (metadata.resources.cpu.peakUsage > 500000) {
			// 500ms CPU time
			metadata.optimizationHints.suggestions.push("Consider optimizing CPU-intensive operations")
		}

		// Attach metadata to context
		result.metadata = metadata

		return result
	}
}
