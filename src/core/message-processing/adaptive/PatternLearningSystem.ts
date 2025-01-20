import { MessageContext, ToolResult } from "../types"
import { ExecutionPattern, ResourceMetrics } from "./types"

interface PatternMatchResult {
	similarity: number
	pattern: ExecutionPattern
	confidence: number
}

export class PatternLearningSystem {
	private patterns: ExecutionPattern[] = []
	private readonly MAX_PATTERNS = 1000
	private readonly SIMILARITY_THRESHOLD = 0.8
	private readonly PATTERN_EXPIRY = 7 * 24 * 60 * 60 * 1000 // 7 days

	private calculatePatternSimilarity(pattern1: ExecutionPattern, pattern2: ExecutionPattern): number {
		const inputSimilarity = this.calculateStringSimilarity(pattern1.inputSignature, pattern2.inputSignature)

		const contextSimilarity = this.calculateStringSimilarity(pattern1.contextSignature, pattern2.contextSignature)

		const resourceSimilarity = this.calculateResourceSimilarity(
			pattern1.outcome.resourceUsage,
			pattern2.outcome.resourceUsage,
		)

		// Weight the similarities
		return inputSimilarity * 0.5 + contextSimilarity * 0.3 + resourceSimilarity * 0.2
	}

	private calculateStringSimilarity(str1: string, str2: string): number {
		const maxLength = Math.max(str1.length, str2.length)
		if (maxLength === 0) return 1

		const distance = this.levenshteinDistance(str1, str2)
		return 1 - distance / maxLength
	}

	private levenshteinDistance(str1: string, str2: string): number {
		const matrix: number[][] = []

		for (let i = 0; i <= str1.length; i++) {
			matrix[i] = [i]
		}
		for (let j = 0; j <= str2.length; j++) {
			matrix[0][j] = j
		}

		for (let i = 1; i <= str1.length; i++) {
			for (let j = 1; j <= str2.length; j++) {
				if (str1[i - 1] === str2[j - 1]) {
					matrix[i][j] = matrix[i - 1][j - 1]
				} else {
					matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1)
				}
			}
		}

		return matrix[str1.length][str2.length]
	}

	private calculateResourceSimilarity(res1: ResourceMetrics, res2: ResourceMetrics): number {
		const memoryDiff = Math.abs(res1.memoryUsage - res2.memoryUsage) / Math.max(res1.memoryUsage, res2.memoryUsage)
		const cpuDiff = Math.abs(res1.cpuUsage - res2.cpuUsage) / Math.max(res1.cpuUsage, res2.cpuUsage)
		const ioDiff = Math.abs(res1.ioOperations - res2.ioOperations) / Math.max(res1.ioOperations, res2.ioOperations)

		return 1 - (memoryDiff * 0.4 + cpuDiff * 0.4 + ioDiff * 0.2)
	}

	public addPattern(pattern: ExecutionPattern): void {
		// Clean up expired patterns
		const now = Date.now()
		this.patterns = this.patterns.filter((p) => now - p.timestamp < this.PATTERN_EXPIRY)

		// Add new pattern
		this.patterns.push(pattern)

		// Maintain maximum pattern limit
		if (this.patterns.length > this.MAX_PATTERNS) {
			// Remove oldest patterns
			this.patterns = this.patterns.sort((a, b) => b.timestamp - a.timestamp).slice(0, this.MAX_PATTERNS)
		}
	}

	public findSimilarPatterns(context: MessageContext): PatternMatchResult[] {
		const currentPattern: ExecutionPattern = {
			inputSignature: JSON.stringify({
				message: context.message,
				mode: context.mode,
				toolExecution: context.toolExecution,
			}),
			contextSignature: JSON.stringify(context.environment),
			outcome: {
				success: true,
				executionTime: 0,
				resourceUsage: {
					memoryUsage: 0,
					cpuUsage: 0,
					ioOperations: 0,
					networkUsage: 0,
					timestamp: Date.now(),
				},
			},
			timestamp: Date.now(),
		}

		return this.patterns
			.map((pattern) => ({
				similarity: this.calculatePatternSimilarity(currentPattern, pattern),
				pattern,
				confidence: this.calculateConfidence(pattern),
			}))
			.filter((result) => result.similarity >= this.SIMILARITY_THRESHOLD)
			.sort((a, b) => b.similarity * b.confidence - a.similarity * a.confidence)
	}

	private calculateConfidence(pattern: ExecutionPattern): number {
		const age = Date.now() - pattern.timestamp
		const ageWeight = Math.max(0, 1 - age / this.PATTERN_EXPIRY)

		// Find similar patterns to calculate consistency
		const similarPatterns = this.patterns.filter(
			(p) => this.calculatePatternSimilarity(pattern, p) >= this.SIMILARITY_THRESHOLD,
		)

		const successRate = similarPatterns.filter((p) => p.outcome.success).length / similarPatterns.length
		const consistencyWeight = similarPatterns.length / 10 // Normalize by 10 occurrences

		return ageWeight * 0.3 + successRate * 0.4 + consistencyWeight * 0.3
	}

	public analyzePatterns(): {
		successRate: number
		avgExecutionTime: number
		resourceTrends: {
			memory: number
			cpu: number
			io: number
		}
		recommendations: string[]
	} {
		const recentPatterns = this.patterns.filter(
			(p) => Date.now() - p.timestamp < 24 * 60 * 60 * 1000, // Last 24 hours
		)

		const successRate = recentPatterns.filter((p) => p.outcome.success).length / recentPatterns.length
		const avgExecutionTime =
			recentPatterns.reduce((sum, p) => sum + p.outcome.executionTime, 0) / recentPatterns.length

		const resourceTrends = {
			memory: this.calculateResourceTrend(recentPatterns, "memoryUsage"),
			cpu: this.calculateResourceTrend(recentPatterns, "cpuUsage"),
			io: this.calculateResourceTrend(recentPatterns, "ioOperations"),
		}

		const recommendations = this.generateRecommendations(successRate, avgExecutionTime, resourceTrends)

		return {
			successRate,
			avgExecutionTime,
			resourceTrends,
			recommendations,
		}
	}

	private calculateResourceTrend(patterns: ExecutionPattern[], metric: keyof ResourceMetrics): number {
		if (patterns.length < 2) return 0

		const values = patterns.map((p) => p.outcome.resourceUsage[metric])
		const timestamps = patterns.map((p) => p.timestamp)

		// Calculate linear regression slope
		const n = values.length
		const sumX = timestamps.reduce((a, b) => a + b, 0)
		const sumY = values.reduce((a, b) => a + b, 0)
		const sumXY = timestamps.reduce((sum, x, i) => sum + x * values[i], 0)
		const sumXX = timestamps.reduce((a, b) => a + b * b, 0)

		return (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX)
	}

	private generateRecommendations(
		successRate: number,
		avgExecutionTime: number,
		resourceTrends: { memory: number; cpu: number; io: number },
	): string[] {
		const recommendations: string[] = []

		if (successRate < 0.9) {
			recommendations.push("Consider implementing additional error handling and validation")
		}

		if (avgExecutionTime > 1000) {
			recommendations.push("Look into performance optimizations or breaking down operations")
		}

		if (resourceTrends.memory > 0.1) {
			recommendations.push(
				"Memory usage is trending upward - consider implementing cleanup or garbage collection",
			)
		}

		if (resourceTrends.cpu > 0.1) {
			recommendations.push("CPU usage is trending upward - evaluate computational efficiency")
		}

		if (resourceTrends.io > 0.1) {
			recommendations.push("I/O operations are increasing - consider implementing caching or batching")
		}

		return recommendations
	}
}
