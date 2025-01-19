import { Anthropic } from "@anthropic-ai/sdk"

import { ChunkMetadata } from "../message-processing/stages/semantic-chunking"

interface WindowOptions {
	maxSize?: number
	minRelevanceScore?: number
	preserveGroups?: string[]
}

const DEFAULT_OPTIONS: {
	maxSize: number
	minRelevanceScore: number
	preserveGroups: string[]
} = {
	maxSize: 50,
	minRelevanceScore: 0.3,
	preserveGroups: ["code", "test"],
}

/**
 * Implements semantic-aware sliding window that preserves relevant context
 * while staying within size limits. Uses metadata from semantic chunking
 * to make intelligent decisions about what context to keep.
 */
export function truncateConversation(
	messages: Array<Anthropic.Messages.MessageParam & { metadata?: ChunkMetadata }>,
	options?: Partial<typeof DEFAULT_OPTIONS>,
): Anthropic.Messages.MessageParam[] {
	const { maxSize, minRelevanceScore, preserveGroups } = { ...DEFAULT_OPTIONS, ...options }

	// Always keep first message with environment details
	const truncatedMessages = [messages[0]]

	// Keep track of preserved message pairs
	const preservedPairs = new Set<number>()

	// First pass: mark message pairs to preserve based on semantic criteria
	for (let i = 1; i < messages.length - 1; i += 2) {
		const userMsg = messages[i]
		const assistantMsg = messages[i + 1]

		// Skip if we don't have a complete pair
		if (!assistantMsg) continue

		const shouldPreserve =
			// Keep messages with high relevance
			(userMsg.metadata?.relevanceScore || 0) >= minRelevanceScore ||
			(assistantMsg.metadata?.relevanceScore || 0) >= minRelevanceScore ||
			// Keep messages from preserved semantic groups
			preserveGroups?.includes(userMsg.metadata?.semanticGroup || "") ||
			preserveGroups?.includes(assistantMsg.metadata?.semanticGroup || "")

		if (shouldPreserve) {
			preservedPairs.add(i)
		}
	}

	// Second pass: build final message list while respecting max size
	let currentSize = 1 // Start at 1 for initial message

	for (let i = 1; i < messages.length - 1; i += 2) {
		// Always keep last 3 message pairs for immediate context
		const isRecentContext = i >= messages.length - 6

		if (currentSize + 2 <= maxSize && (preservedPairs.has(i) || isRecentContext)) {
			truncatedMessages.push(messages[i], messages[i + 1])
			currentSize += 2
		}
	}

	// Ensure we end with complete message pairs
	if (truncatedMessages.length % 2 === 0) {
		truncatedMessages.pop()
	}

	return truncatedMessages
}
