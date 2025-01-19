export type ApiStream = AsyncGenerator<ApiStreamChunk>
export type ApiStreamChunk = ApiStreamTextChunk | ApiStreamUsageChunk | ApiStreamMetricsChunk | ApiStreamErrorChunk

export interface ApiStreamTextChunk {
	type: "text"
	text: string
	metadata?: {
		timestamp: number
		chunkIndex: number
		isPartial: boolean
		contextWindow?: number
		modelName?: string
	}
}

export interface ApiStreamUsageChunk {
	type: "usage"
	inputTokens: number
	outputTokens: number
	cacheWriteTokens?: number
	cacheReadTokens?: number
	totalCost?: number
	metadata?: {
		timestamp: number
		modelInfo?: {
			name: string
			provider: string
			contextWindow: number
			costPerInputToken?: number
			costPerOutputToken?: number
		}
		performance?: {
			tokensPerSecond: number
			latencyMs: number
			totalTimeMs: number
		}
	}
}

export interface ApiStreamMetricsChunk {
	type: "metrics"
	metrics: {
		timestamp: number
		responseQuality: {
			coherence: number // 0-1 score of response coherence
			relevance: number // 0-1 score of response relevance to prompt
			completeness: number // 0-1 score of response completeness
			toolUseEfficiency: number // 0-1 score of appropriate tool usage
		}
		performance: {
			tokensPerSecond: number
			latencyMs: number
			totalTimeMs: number
			memoryUsageMb: number
		}
		contextUtilization: {
			percentUsed: number
			tokensRemaining: number
			isNearingLimit: boolean
		}
	}
}

export interface ApiStreamErrorChunk {
	type: "error"
	error: {
		code: string
		message: string
		timestamp: number
		severity: "warning" | "error" | "fatal"
		context?: Record<string, any>
		suggestion?: string
		recoverable: boolean
	}
}

// Helper functions for stream processing
export const isNearContextLimit = (chunk: ApiStreamUsageChunk): boolean => {
	if (!chunk.metadata?.modelInfo?.contextWindow) return false
	const totalTokens = chunk.inputTokens + chunk.outputTokens
	return totalTokens > chunk.metadata.modelInfo.contextWindow * 0.8
}

export const calculateResponseQuality = (text: string): number => {
	// Analyze response quality based on:
	// - Presence of complete thoughts/sentences
	// - Proper code formatting if code is present
	// - Appropriate tool usage patterns
	// - Coherent structure and flow
	// Returns a score between 0-1
	const metrics = {
		completeSentences: /[.!?]\s*$/.test(text.trim()),
		properCodeBlocks: /```[\s\S]*?```/.test(text),
		hasToolUse: /<[\w_]+>[\s\S]*?<\/[\w_]+>/.test(text),
		coherentStructure: text.includes("\n\n") && !text.includes("\n\n\n\n"),
	}

	return Object.values(metrics).filter(Boolean).length / Object.keys(metrics).length
}

export const shouldRetryStream = (error: ApiStreamErrorChunk["error"]): boolean => {
	const retryableCodes = ["rate_limit", "timeout", "connection_error"]
	return error.recoverable && retryableCodes.includes(error.code)
}
