import { truncateConversation } from "../index"
import { ChunkMetadata } from "../../message-processing/stages/semantic-chunking"
import { Anthropic } from "@anthropic-ai/sdk"

describe("truncateConversation", () => {
	const getMessageText = (msg: Anthropic.Messages.MessageParam) =>
		Array.isArray(msg.content) ? (msg.content[0] as Anthropic.Messages.TextBlockParam).text : msg.content

	const createMessage = (
		role: "user" | "assistant",
		content: string,
		metadata?: ChunkMetadata,
	): Anthropic.Messages.MessageParam & { metadata?: ChunkMetadata } => ({
		role,
		content: [{ type: "text", text: content }],
		metadata,
	})

	it("should preserve first message and recent context", () => {
		const messages = [
			createMessage("user", "Initial task"),
			createMessage("assistant", "First response"),
			createMessage("user", "Second message"),
			createMessage("assistant", "Second response"),
			createMessage("user", "Third message"),
			createMessage("assistant", "Third response"),
		]

		const truncated = truncateConversation(messages)
		const getMessageText = (msg: Anthropic.Messages.MessageParam) =>
			Array.isArray(msg.content) ? (msg.content[0] as Anthropic.Messages.TextBlockParam).text : msg.content

		expect(getMessageText(truncated[0])).toBe("Initial task")
		expect(getMessageText(truncated[truncated.length - 2])).toBe("Third message")
		expect(getMessageText(truncated[truncated.length - 1])).toBe("Third response")
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

		// Should include initial task, high relevance messages, and recent context
		expect(truncated.length).toBe(4)
		expect(getMessageText(truncated[0])).toBe("Initial task")
		expect(getMessageText(truncated[1])).toBe("Code implementation")
		expect(getMessageText(truncated[2])).toBe("Code response")
	})

	it("should preserve messages from important semantic groups", () => {
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

		expect(truncated.length).toBe(4)
		expect(getMessageText(truncated[0])).toBe("Initial task")
		expect(getMessageText(truncated[1])).toBe("Test implementation")
		expect(getMessageText(truncated[2])).toBe("Test response")
	})

	it("should respect maxSize parameter", () => {
		const messages = Array.from({ length: 20 }, (_, i) =>
			createMessage(i % 2 === 0 ? "user" : "assistant", `Message ${i}`),
		)

		const truncated = truncateConversation(messages, { maxSize: 10 })
		expect(truncated.length).toBeLessThanOrEqual(10)
		expect(getMessageText(truncated[0])).toBe("Message 0") // First message
		expect(getMessageText(truncated[truncated.length - 1])).toBe("Message 19") // Last message
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
	})
})
