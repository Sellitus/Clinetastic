import { MessageContext, Tool, ToolResult, ResultMetadata } from "../types"

export interface ResourceMetrics {
	memoryUsage: number
	cpuUsage: number
	ioOperations: number
	networkUsage: number
	timestamp: number
}

export interface ToolExecutionMetrics {
	executionTime: number
	resourceUsage: ResourceMetrics
	tokenCount: number
	cacheHits: number
	cacheMisses: number
}

export interface ExecutionPattern {
	inputSignature: string
	contextSignature: string
	outcome: {
		success: boolean
		executionTime: number
		resourceUsage: ResourceMetrics
		errorType?: string
	}
	timestamp: number
}

export interface ToolProfile {
	name: string
	successRate: number
	avgExecutionTime: number
	resourceEfficiency: number
	tokenEfficiency: number
	cacheEffectiveness: number
	patterns: ExecutionPattern[]
	lastUpdated: number
}

export interface CacheEntry<T> {
	value: T
	timestamp: number
	hitCount: number
	resourceMetrics: ResourceMetrics
}

export interface AdaptiveConfig {
	learningRate: number
	maxPatternHistory: number
	cacheTimeout: number
	resourceWeights: {
		memory: number
		cpu: number
		io: number
		network: number
	}
}

export interface OptimizationStrategy {
	shouldCache: boolean
	cacheDuration: number
	batchSize: number
	timeout: number
	retryStrategy: {
		maxRetries: number
		backoffFactor: number
		initialDelay: number
	}
}

export interface ExecutionPlan {
	tool: Tool
	strategy: OptimizationStrategy
	estimatedMetrics: {
		executionTime: number
		resourceUsage: ResourceMetrics
		tokenUsage: number
		cacheHitProbability: number
	}
}

export interface AdaptiveEngine {
	profileTool(tool: Tool, result: ToolResult, context: MessageContext): void
	generateExecutionPlan(tool: Tool, context: MessageContext): ExecutionPlan
	updateLearningRate(performance: ResultMetadata): void
	getCacheEffectiveness(): number
	getResourceEfficiency(): number
}
