import { ResultMetadata } from "../types"
import { ResourceMetrics, OptimizationStrategy } from "./types"

interface ResourceThresholds {
	memory: {
		warning: number // MB
		critical: number // MB
	}
	cpu: {
		warning: number // Percentage
		critical: number // Percentage
	}
	io: {
		warning: number // Operations per second
		critical: number // Operations per second
	}
}

interface ResourceUsageWindow {
	startTime: number
	endTime: number
	metrics: ResourceMetrics[]
}

export class ResourceOptimizer {
	private readonly windows: ResourceUsageWindow[] = []
	private readonly WINDOW_SIZE = 5 * 60 * 1000 // 5 minutes
	private readonly MAX_WINDOWS = 12 // Keep last hour
	private readonly thresholds: ResourceThresholds = {
		memory: {
			warning: 512, // 512 MB
			critical: 1024, // 1 GB
		},
		cpu: {
			warning: 70, // 70%
			critical: 90, // 90%
		},
		io: {
			warning: 1000, // 1000 ops/sec
			critical: 5000, // 5000 ops/sec
		},
	}

	public addMetrics(metrics: ResourceMetrics): void {
		const currentTime = Date.now()
		let currentWindow = this.windows.find((w) => currentTime >= w.startTime && currentTime < w.endTime)

		if (!currentWindow) {
			// Create new window
			currentWindow = {
				startTime: Math.floor(currentTime / this.WINDOW_SIZE) * this.WINDOW_SIZE,
				endTime: Math.floor(currentTime / this.WINDOW_SIZE) * this.WINDOW_SIZE + this.WINDOW_SIZE,
				metrics: [],
			}
			this.windows.push(currentWindow)

			// Remove old windows
			while (this.windows.length > this.MAX_WINDOWS) {
				this.windows.shift()
			}
		}

		currentWindow.metrics.push(metrics)
	}

	public optimizeStrategy(currentMetrics: ResourceMetrics): OptimizationStrategy {
		const trends = this.analyzeTrends()
		const currentLoad = this.calculateCurrentLoad(currentMetrics)

		return {
			shouldCache: this.shouldEnableCache(trends),
			cacheDuration: this.calculateCacheDuration(trends),
			batchSize: this.calculateOptimalBatchSize(currentLoad, trends),
			timeout: this.calculateOptimalTimeout(currentLoad),
			retryStrategy: {
				maxRetries: this.calculateMaxRetries(currentLoad),
				backoffFactor: this.calculateBackoffFactor(trends),
				initialDelay: this.calculateInitialDelay(currentLoad),
			},
		}
	}

	private analyzeTrends(): {
		memoryTrend: number
		cpuTrend: number
		ioTrend: number
		overallLoad: number
	} {
		if (this.windows.length < 2) {
			return { memoryTrend: 0, cpuTrend: 0, ioTrend: 0, overallLoad: 0 }
		}

		const calculateTrend = (metric: keyof ResourceMetrics) => {
			const points = this.windows.map((w) => ({
				time: w.startTime,
				value: w.metrics.reduce((sum, m) => sum + (m[metric] as number), 0) / w.metrics.length,
			}))

			// Simple linear regression
			const n = points.length
			const sumX = points.reduce((sum, p) => sum + p.time, 0)
			const sumY = points.reduce((sum, p) => sum + p.value, 0)
			const sumXY = points.reduce((sum, p) => sum + p.time * p.value, 0)
			const sumXX = points.reduce((sum, p) => sum + p.time * p.time, 0)

			return (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX)
		}

		const memoryTrend = calculateTrend("memoryUsage")
		const cpuTrend = calculateTrend("cpuUsage")
		const ioTrend = calculateTrend("ioOperations")

		// Calculate overall load based on the most recent window
		const lastWindow = this.windows[this.windows.length - 1]
		const avgMemory = lastWindow.metrics.reduce((sum, m) => sum + m.memoryUsage, 0) / lastWindow.metrics.length
		const avgCpu = lastWindow.metrics.reduce((sum, m) => sum + m.cpuUsage, 0) / lastWindow.metrics.length
		const avgIo = lastWindow.metrics.reduce((sum, m) => sum + m.ioOperations, 0) / lastWindow.metrics.length

		const overallLoad =
			(avgMemory / this.thresholds.memory.critical +
				avgCpu / this.thresholds.cpu.critical +
				avgIo / this.thresholds.io.critical) /
			3

		return { memoryTrend, cpuTrend, ioTrend, overallLoad }
	}

	private calculateCurrentLoad(metrics: ResourceMetrics): number {
		const memoryLoad = metrics.memoryUsage / this.thresholds.memory.critical
		const cpuLoad = metrics.cpuUsage / this.thresholds.cpu.critical
		const ioLoad = metrics.ioOperations / this.thresholds.io.critical

		return (memoryLoad + cpuLoad + ioLoad) / 3
	}

	private shouldEnableCache(trends: ReturnType<typeof this.analyzeTrends>): boolean {
		// Enable caching if resource usage is trending up or load is high
		return trends.overallLoad > 0.7 || trends.memoryTrend > 0 || trends.cpuTrend > 0 || trends.ioTrend > 0
	}

	private calculateCacheDuration(trends: ReturnType<typeof this.analyzeTrends>): number {
		const baseDuration = 60000 // 1 minute
		const loadFactor = Math.min(1, trends.overallLoad * 2) // Double duration at 50% load
		return Math.min(baseDuration * (1 + loadFactor), 300000) // Max 5 minutes
	}

	private calculateOptimalBatchSize(currentLoad: number, trends: ReturnType<typeof this.analyzeTrends>): number {
		const baseSize = 10
		const loadFactor = 1 - currentLoad // Reduce batch size under high load
		const trendFactor = trends.memoryTrend < 0 && trends.cpuTrend < 0 ? 1.2 : 0.8

		return Math.max(1, Math.floor(baseSize * loadFactor * trendFactor))
	}

	private calculateOptimalTimeout(currentLoad: number): number {
		const baseTimeout = 30000 // 30 seconds
		const loadFactor = 1 + currentLoad // Increase timeout under high load
		return Math.min(baseTimeout * loadFactor, 120000) // Max 2 minutes
	}

	private calculateMaxRetries(currentLoad: number): number {
		// Reduce retries under high load
		return Math.max(1, Math.floor(5 * (1 - currentLoad)))
	}

	private calculateBackoffFactor(trends: ReturnType<typeof this.analyzeTrends>): number {
		// More aggressive backoff if resources are constrained
		return 1.5 + trends.overallLoad * 0.5
	}

	private calculateInitialDelay(currentLoad: number): number {
		const baseDelay = 1000 // 1 second
		return baseDelay * (1 + currentLoad) // Increase delay under load
	}

	public getResourceWarnings(): string[] {
		const warnings: string[] = []
		const lastWindow = this.windows[this.windows.length - 1]

		if (!lastWindow) return warnings

		const avgMetrics = {
			memory: lastWindow.metrics.reduce((sum, m) => sum + m.memoryUsage, 0) / lastWindow.metrics.length,
			cpu: lastWindow.metrics.reduce((sum, m) => sum + m.cpuUsage, 0) / lastWindow.metrics.length,
			io: lastWindow.metrics.reduce((sum, m) => sum + m.ioOperations, 0) / lastWindow.metrics.length,
		}

		if (avgMetrics.memory >= this.thresholds.memory.critical) {
			warnings.push("Critical: Memory usage exceeds threshold")
		} else if (avgMetrics.memory >= this.thresholds.memory.warning) {
			warnings.push("Warning: High memory usage detected")
		}

		if (avgMetrics.cpu >= this.thresholds.cpu.critical) {
			warnings.push("Critical: CPU usage exceeds threshold")
		} else if (avgMetrics.cpu >= this.thresholds.cpu.warning) {
			warnings.push("Warning: High CPU usage detected")
		}

		if (avgMetrics.io >= this.thresholds.io.critical) {
			warnings.push("Critical: I/O operations exceed threshold")
		} else if (avgMetrics.io >= this.thresholds.io.warning) {
			warnings.push("Warning: High I/O operation rate detected")
		}

		return warnings
	}
}
