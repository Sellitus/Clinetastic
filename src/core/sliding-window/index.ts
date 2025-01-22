import { Anthropic } from "@anthropic-ai/sdk"

/*
We can't implement a dynamically updating sliding window as it would break prompt cache
every time. To maintain the benefits of caching, we need to keep conversation history
static. This operation should be performed as infrequently as possible. If a user reaches
a 200k context, we can assume that the first half is likely irrelevant to their current task.
Therefore, this function should only be called when absolutely necessary to fit within
context limits, not as a continuous process.
*/
interface ToolInput {
	path?: string
	command?: string
}

interface ToolUseBlock {
	type: "tool_use"
	name: string
	input: ToolInput
}

interface TextBlock {
	type: "text"
	text: string
}

type ContentBlock = ToolUseBlock | TextBlock

interface MessageRelevance {
	relevanceScore: number
	dependencies: string[]
}

function calculateMessageRelevance(message: Anthropic.Messages.MessageParam, currentTask: string): MessageRelevance {
	const relevance: MessageRelevance = {
		relevanceScore: 0,
		dependencies: [],
	}

	// Check if message contains tool uses that later messages may depend on
	if (Array.isArray(message.content)) {
		message.content.forEach((block) => {
			if (block.type === "tool_use") {
				const toolBlock = block as ToolUseBlock
				// File operations create dependencies
				if (["write_to_file", "read_file"].includes(toolBlock.name)) {
					if (toolBlock.input.path) {
						relevance.dependencies.push(toolBlock.input.path)
						relevance.relevanceScore += 2
					}
				}
				// Commands may affect state
				if (toolBlock.name === "execute_command") {
					relevance.relevanceScore += 1
				}
			}
		})
	}

	// Check semantic similarity with current task
	if (typeof message.content === "string" || Array.isArray(message.content)) {
		const messageText = Array.isArray(message.content)
			? message.content.map((block) => (block.type === "text" ? block.text : "")).join(" ")
			: message.content

		if (messageText.includes(currentTask)) {
			relevance.relevanceScore += 3
		}
	}

	return relevance
}

export function truncateHalfConversation(
	messages: Anthropic.Messages.MessageParam[],
	currentTask?: string,
): Anthropic.Messages.MessageParam[] {
	// Always keep the first Task message
	const truncatedMessages = [messages[0]]

	if (messages.length <= 2) {
		return messages
	}

	// Calculate relevance scores for all messages
	const relevanceMap = new Map<number, MessageRelevance>()
	messages.forEach((message, index) => {
		if (index === 0) return // Skip first message
		relevanceMap.set(index, calculateMessageRelevance(message, currentTask || ""))
	})

	// Build dependency graph
	const dependencyGraph = new Map<string, number[]>()
	relevanceMap.forEach((relevance, index) => {
		relevance.dependencies.forEach((dep) => {
			if (!dependencyGraph.has(dep)) {
				dependencyGraph.set(dep, [])
			}
			dependencyGraph.get(dep)?.push(index)
		})
	})

	// Calculate number of messages to remove while preserving dependencies
	const messagesToRemove = Math.floor(messages.length / 4) * 2
	const messagesToKeep = new Set<number>()

	// Keep messages with highest relevance and their dependencies
	const sortedByRelevance = Array.from(relevanceMap.entries()).sort(
		(a, b) => b[1].relevanceScore - a[1].relevanceScore,
	)

	for (const [index, relevance] of sortedByRelevance) {
		if (messages.length - messagesToKeep.size <= messagesToRemove) {
			break
		}

		messagesToKeep.add(index)
		relevance.dependencies.forEach((dep) => {
			const depIndices = dependencyGraph.get(dep) || []
			depIndices.forEach((depIndex) => messagesToKeep.add(depIndex))
		})
	}

	// Reconstruct conversation preserving order and dependencies
	messages.forEach((message, index) => {
		if (index === 0) return // Already added
		if (messagesToKeep.has(index)) {
			truncatedMessages.push(message)
		}
	})

	return truncatedMessages
}
