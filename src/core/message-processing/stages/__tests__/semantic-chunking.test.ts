import { SemanticChunkingStage } from "../semantic-chunking"
import { MessageContext } from "../../types"
import { Anthropic } from "@anthropic-ai/sdk"

describe("SemanticChunkingStage", () => {
	let stage: SemanticChunkingStage
	let context: MessageContext

	beforeEach(() => {
		stage = new SemanticChunkingStage()
		context = {
			message: "How do I implement a new function?",
			mode: "code",
			environment: {
				workingDirectory: "/test",
				visibleFiles: [],
				openTabs: [],
				activeTerminals: [],
				currentTime: new Date(),
				mode: "code",
			},
			metadata: {
				messageHistory: [
					{
						role: "user",
						content: "Initial task with project setup",
					},
					{
						role: "assistant",
						content: "Let's implement the test cases first",
					},
					{
						role: "user",
						content: "Update the configuration settings",
					},
					{
						role: "assistant",
						content: "I'll help configure the environment",
					},
					{
						role: "user",
						content: "Create a new function called processData",
					},
					{
						role: "assistant",
						content: "Here's the implementation of the function",
					},
				] as Anthropic.Messages.MessageParam[],
			},
		}
	})

	it("should process messages and add semantic metadata", async () => {
		const result = await stage.process(context)

		expect(result.metadata?.messageHistory).toBeDefined()
		expect(result.metadata?.semanticGroups).toBeDefined()

		const messages = result.metadata?.messageHistory as Array<Anthropic.Messages.MessageParam & { metadata?: any }>

		// Check that each message has metadata
		messages.forEach((msg) => {
			expect(msg.metadata).toBeDefined()
			expect(msg.metadata.relevanceScore).toBeDefined()
			expect(msg.metadata.keywords).toBeDefined()
			expect(msg.metadata.semanticGroup).toBeDefined()
		})
	})

	it("should correctly identify semantic groups", async () => {
		const result = await stage.process(context)
		const messages = result.metadata?.messageHistory as Array<Anthropic.Messages.MessageParam & { metadata?: any }>

		// Check specific messages are categorized correctly
		const testMessage = messages[1] // "Let's implement the test cases first"
		expect(testMessage.metadata.semanticGroup).toBe("test")

		const configMessage = messages[3] // "I'll help configure the environment"
		expect(configMessage.metadata.semanticGroup).toBe("config")

		const codeMessage = messages[5] // "Here's the implementation of the function"
		expect(codeMessage.metadata.semanticGroup).toBe("code")
	})

	it("should calculate relevance scores based on current context", async () => {
		context.message = "How do I write a test for the processData function?"
		const result = await stage.process(context)
		const messages = result.metadata?.messageHistory as Array<Anthropic.Messages.MessageParam & { metadata?: any }>

		// Messages about tests and the processData function should have higher relevance
		const testMessage = messages[1]
		const functionMessage = messages[5]

		expect(testMessage.metadata.relevanceScore).toBeGreaterThan(0.3)
		expect(functionMessage.metadata.relevanceScore).toBeGreaterThan(0.3)
	})

	it("should handle empty message history", async () => {
		context.metadata = {}
		const result = await stage.process(context)
		expect(result).toEqual(context)
	})

	it("should maintain conversation coherence", async () => {
		const result = await stage.process(context)
		const messages = result.metadata?.messageHistory as Anthropic.Messages.MessageParam[]

		// First message should always be preserved
		expect(messages[0].content).toContain("Initial task")

		// Check that user/assistant pairs are maintained
		for (let i = 0; i < messages.length - 1; i += 2) {
			expect(messages[i].role).toBe("user")
			expect(messages[i + 1].role).toBe("assistant")
		}
	})
})
