import { Anthropic } from "@anthropic-ai/sdk"
import { ChunkMetadata } from "../message-processing/stages/semantic-chunking"

interface WindowOptions {
	maxSize?: number
	minRelevanceScore?: number
	preserveGroups?: string[]
}

const DEFAULT_OPTIONS = {
	maxSize: 50,
	minRelevanceScore: 0.3,
	preserveGroups: ["code", "test"],
}

function normalizeMessage(msg: Anthropic.Messages.MessageParam): Anthropic.Messages.MessageParam {
	return {
		role: msg.role,
		content: Array.isArray(msg.content)
			? [...msg.content]
			: [{ type: "text" as const, text: msg.content as string }],
		...((msg as any).metadata ? { metadata: (msg as any).metadata } : {}),
	}
}

export function truncateConversation(
	messages: Array<Anthropic.Messages.MessageParam & { metadata?: ChunkMetadata }>,
	options?: Partial<typeof DEFAULT_OPTIONS>,
): Anthropic.Messages.MessageParam[] {
	const { maxSize, minRelevanceScore, preserveGroups } = { ...DEFAULT_OPTIONS, ...options }

	if (messages.length === 0) return []

	// Always keep first message
	const result = [normalizeMessage(messages[0])]

	// If we only have one message, return early
	if (messages.length === 1) return result

	// Get message pairs
	const pairs: Array<[(typeof messages)[0], (typeof messages)[0]]> = []
	for (let i = 1; i < messages.length - 1; i += 2) {
		const userMsg = messages[i]
		const assistantMsg = messages[i + 1]
		if (userMsg?.role === "user" && assistantMsg?.role === "assistant") {
			pairs.push([userMsg, assistantMsg])
		}
	}

	// Calculate how many pairs we can include (maxSize - 1 for initial message)
	const targetPairs = Math.floor((maxSize - 1) / 2)

	// Always include the last pair
	const lastPair = pairs.length > 0 ? pairs[pairs.length - 1] : null
	const remainingPairs = pairs.slice(0, -1)

	// Score remaining pairs
	const scoredPairs = remainingPairs.map((pair, index) => {
		const [userMsg, assistantMsg] = pair
		const relevance = Math.max(userMsg.metadata?.relevanceScore || 0, assistantMsg.metadata?.relevanceScore || 0)
		const inPreservedGroup = preserveGroups?.some(
			(group) => userMsg.metadata?.semanticGroup === group || assistantMsg.metadata?.semanticGroup === group,
		)

		let score = index // Base score is chronological order
		if (relevance >= minRelevanceScore) score += 1000
		if (inPreservedGroup) score += 500

		return { pair, score, index }
	})

	// Sort pairs by score
	scoredPairs.sort((a, b) => b.score - a.score)

	// Select pairs up to targetPairs - 1 (to leave room for last pair)
	const selectedPairs = scoredPairs
		.slice(0, targetPairs - 1)
		.sort((a, b) => a.index - b.index) // Sort chronologically
		.map(({ pair }) => pair)

	// Add selected pairs
	for (const [userMsg, assistantMsg] of selectedPairs) {
		result.push(normalizeMessage(userMsg))
		result.push(normalizeMessage(assistantMsg))
	}

	// Add last pair
	if (lastPair) {
		result.push(normalizeMessage(lastPair[0]))
		result.push(normalizeMessage(lastPair[1]))
	}

	return result
}
