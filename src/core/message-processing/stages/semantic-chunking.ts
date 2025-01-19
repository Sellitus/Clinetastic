import { MessageContext, PipelineStage } from "../types"
import { Anthropic } from "@anthropic-ai/sdk"

export interface ChunkMetadata {
	relevanceScore: number
	timestamp: number
	keywords: string[]
	semanticGroup: string
}

export class SemanticChunkingStage implements PipelineStage {
	id = "semantic-chunking"

	private calculateRelevanceScore(chunk: string, currentContext: string): number {
		// Enhanced relevance scoring with semantic matching
		const chunkWords = chunk.toLowerCase().split(/\s+/)
		const contextWords = currentContext.toLowerCase().split(/\s+/)

		// Create sets for exact and partial matching
		const chunkSet = new Set(chunkWords)
		const contextSet = new Set(contextWords)

		// Count exact matches
		const exactMatches = new Set([...chunkSet].filter((x) => contextSet.has(x))).size

		// Count partial matches (substrings)
		let partialMatches = 0
		for (const chunkWord of chunkWords) {
			for (const contextWord of contextWords) {
				if (chunkWord.length >= 4 && contextWord.length >= 4) {
					if (chunkWord.includes(contextWord) || contextWord.includes(chunkWord)) {
						partialMatches++
						break
					}
				}
			}
		}

		// Calculate weighted score with boost for important keywords
		const exactWeight = 1.0
		const partialWeight = 0.5
		const baseScore =
			(exactMatches * exactWeight + partialMatches * partialWeight) /
			Math.min(chunkWords.length, contextWords.length)

		// Boost score for important keywords
		const importantKeywords = ["test", "function", "code", "implement", "fix", "bug"]
		const keywordBoost = importantKeywords.some(
			(keyword) => chunk.toLowerCase().includes(keyword) && currentContext.toLowerCase().includes(keyword),
		)
			? 0.2
			: 0

		// Ensure minimum score for test-related content
		const minScore = chunk.toLowerCase().includes("test") ? 0.3 : 0

		// Return final score with minimum threshold and boost
		return Math.max(minScore, Math.min(1.0, baseScore + keywordBoost))
	}

	private extractKeywords(text: string): string[] {
		// Extract meaningful keywords using basic NLP techniques
		const words = text.toLowerCase().split(/\s+/)
		const stopWords = new Set(["the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for"])
		return words.filter((word) => !stopWords.has(word) && word.length > 3).slice(0, 10) // Keep top 10 keywords
	}

	private determineSemanticGroup(keywords: string[]): string {
		// Group messages by semantic similarity
		const codeKeywords = new Set(["function", "class", "method", "variable", "import", "export"])
		const configKeywords = new Set(["config", "setting", "environment", "parameter"])
		const testKeywords = new Set(["test", "spec", "assert", "expect", "mock"])

		const matches = {
			code: keywords.filter((k) => codeKeywords.has(k)).length,
			config: keywords.filter((k) => configKeywords.has(k)).length,
			test: keywords.filter((k) => testKeywords.has(k)).length,
		}

		const maxCategory = Object.entries(matches).reduce((a, b) => (a[1] > b[1] ? a : b))[0]

		return maxCategory
	}

	async process(context: MessageContext): Promise<MessageContext> {
		if (!context.metadata) {
			context.metadata = {}
		}

		// Only process if we have message history
		if (!context.metadata.messageHistory) {
			return context
		}

		const messages = context.metadata.messageHistory as Anthropic.Messages.MessageParam[]
		const currentMessage = context.message

		// Process each message and add semantic metadata
		const processedMessages = messages.map((msg) => {
			const content =
				typeof msg.content === "string"
					? msg.content
					: Array.isArray(msg.content)
						? msg.content
								.map((block) => {
									if ("text" in block) return block.text
									if ("content" in block) return block.content
									return ""
								})
								.join(" ")
						: ""
			const keywords = this.extractKeywords(content)
			const metadata: ChunkMetadata = {
				relevanceScore: this.calculateRelevanceScore(content, currentMessage),
				timestamp: Date.now(),
				keywords,
				semanticGroup: this.determineSemanticGroup(keywords),
			}

			return {
				...msg,
				metadata,
			}
		})

		// Sort messages by relevance while maintaining conversation coherence
		const sortedMessages = this.prioritizeMessages(processedMessages)

		// Update context with processed messages
		context.metadata.messageHistory = sortedMessages
		context.metadata.semanticGroups = this.getSemanticGroupSummary(sortedMessages)

		return context
	}

	private prioritizeMessages(messages: Array<Anthropic.Messages.MessageParam & { metadata: ChunkMetadata }>) {
		// Keep first message (initial task) and last few messages
		const initial = messages.slice(0, 1)
		const recent = messages.slice(-3)
		const middle = messages.slice(1, -3)

		// Sort middle messages by relevance score
		const sortedMiddle = middle.sort((a, b) => {
			const scoreA = a.metadata?.relevanceScore || 0
			const scoreB = b.metadata?.relevanceScore || 0
			return scoreB - scoreA
		})

		return [...initial, ...sortedMiddle, ...recent]
	}

	private getSemanticGroupSummary(messages: Array<Anthropic.Messages.MessageParam & { metadata: ChunkMetadata }>) {
		const groups = new Map<string, number>()
		messages.forEach((msg) => {
			const group = msg.metadata?.semanticGroup
			if (group) {
				groups.set(group, (groups.get(group) || 0) + 1)
			}
		})
		return Object.fromEntries(groups)
	}
}
