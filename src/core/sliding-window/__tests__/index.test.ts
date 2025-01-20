import { truncateConversation } from "../index"
import { ChunkMetadata } from "../../message-processing/stages/semantic-chunking"
import { Anthropic } from "@anthropic-ai/sdk"

describe("truncateConversation", () => {
	const getMessageText = (msg: Anthropic.Messages.MessageParam) => {
		if (!msg?.content) return ""
		return Array.isArray(msg.content)
			? (msg.content[0] as Anthropic.Messages.TextBlockParam).text
			: (msg.content as string)
	}

	const createMessage = (
		role: "user" | "assistant",
		content: string,
		metadata?: ChunkMetadata,
	): Anthropic.Messages.MessageParam & { metadata?: ChunkMetadata } => ({
		role,
		content: [{ type: "text", text: content }],
		metadata,
	})

	it("should preserve first message", () => {
		const messages = [
			createMessage("user", "Initial task"),
			createMessage("assistant", "First response"),
			createMessage("user", "Second message"),
			createMessage("assistant", "Second response"),
			createMessage("user", "Third message"),
			createMessage("assistant", "Third response"),
		]

		const truncated = truncateConversation(messages)

		// Should always keep first message
		expect(getMessageText(truncated[0])).toBe("Initial task")
		// Should maintain conversation structure
		expect(truncated.length % 2).toBe(1) // Initial message + complete pairs
	})

	it("should prioritize messages with high relevance scores", () => {
		const messages = [
			createMessage("user", "Initial task"),
			createMessage("assistant", "First response"),
			createMessage("user", "Code implementation", {
				relevanceScore: 0.8,
				timestamp: Date.now(),
				keywords: ["code", "implement"],
				semanticGroup: "code",
			}),
			createMessage("assistant", "Code response"),
			createMessage("user", "Unrelated message", {
				relevanceScore: 0.2,
				timestamp: Date.now(),
				keywords: ["other"],
				semanticGroup: "other",
			}),
			createMessage("assistant", "Unrelated response"),
		]

		const truncated = truncateConversation(messages, {
			minRelevanceScore: 0.5,
		})

		// Should include initial task
		expect(getMessageText(truncated[0])).toBe("Initial task")
		// Should not include low relevance messages
		expect(truncated.some((msg) => getMessageText(msg) === "Unrelated message")).toBe(false)
	})

	it("should handle semantic groups", () => {
		const messages = [
			createMessage("user", "Initial task"),
			createMessage("assistant", "First response"),
			createMessage("user", "Test implementation", {
				relevanceScore: 0.3,
				timestamp: Date.now(),
				keywords: ["test"],
				semanticGroup: "test",
			}),
			createMessage("assistant", "Test response"),
			createMessage("user", "Other message", {
				relevanceScore: 0.2,
				timestamp: Date.now(),
				keywords: ["other"],
				semanticGroup: "other",
			}),
			createMessage("assistant", "Other response"),
		]

		const truncated = truncateConversation(messages, {
			preserveGroups: ["test"],
		})

		// Should include initial task
		expect(getMessageText(truncated[0])).toBe("Initial task")
		// Should maintain conversation structure
		expect(truncated.length % 2).toBe(1) // Initial message + complete pairs
		// Should not include unrelated messages
		expect(truncated.some((msg) => getMessageText(msg) === "Other message")).toBe(false)
	})

	it("should respect maxSize parameter", () => {
		const messages = Array.from({ length: 20 }, (_, i) =>
			createMessage(i % 2 === 0 ? "user" : "assistant", `Message ${i}`),
		)

		const maxSize = 10
		const truncated = truncateConversation(messages, { maxSize })

		// Should not exceed maxSize
		expect(truncated.length).toBeLessThanOrEqual(maxSize)

		// Should keep first message
		expect(getMessageText(truncated[0])).toBe("Message 0")
		// Should maintain conversation structure
		expect(truncated.length % 2).toBe(1) // Initial message + complete pairs
	})

	it("should maintain conversation coherence", () => {
		const messages = [
			createMessage("user", "Initial task"),
			createMessage("assistant", "First response"),
			createMessage("user", "Second message", {
				relevanceScore: 0.9,
				timestamp: Date.now(),
				keywords: ["important"],
				semanticGroup: "code",
			}),
			createMessage("assistant", "Second response"),
			createMessage("user", "Third message"),
			createMessage("assistant", "Third response"),
		]

		const truncated = truncateConversation(messages)

		// Check that user messages are always followed by assistant messages
		for (let i = 0; i < truncated.length - 1; i += 2) {
			expect(truncated[i].role).toBe("user")
			expect(truncated[i + 1].role).toBe("assistant")
		}

		// Check that we have complete pairs
		expect(truncated.length % 2).toBe(1) // Initial message + complete pairs
	})
})
