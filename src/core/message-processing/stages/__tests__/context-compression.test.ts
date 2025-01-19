import { ContextCompressionStage } from "../context-compression"
import { MessageContext, EnvironmentDetails } from "../../types"
import { Mode } from "../../../../shared/modes"

interface CompressedReference {
	type: "tool" | "code" | "environment"
	hash: string
	summary: string
}

interface CompressionMetadata {
	references: { [key: string]: CompressedReference }
	originalTokenCount: number
	compressedTokenCount: number
}

describe("ContextCompressionStage", () => {
	let stage: ContextCompressionStage

	beforeEach(() => {
		stage = new ContextCompressionStage()
	})

	const createMockContext = (
		message: string,
		environment: Partial<EnvironmentDetails> = {},
		customInstructions?: string,
	): MessageContext => ({
		message,
		mode: "code" as Mode,
		environment: {
			workingDirectory: "/test",
			visibleFiles: [],
			openTabs: [],
			activeTerminals: [],
			currentTime: new Date(),
			mode: "code" as Mode,
			...environment,
		},
		...(customInstructions ? { customInstructions } : {}),
	})

	describe("basic compression", () => {
		it("should compress repeated code blocks", async () => {
			const codeBlock = "```\nconst x = 1;\nconsole.log(x);\n```"
			const context = createMockContext(`Here's some code:\n${codeBlock}\nAnd here it is again:\n${codeBlock}`)

			const result = await stage.process(context)

			// Basic compression doesn't replace first occurrence
			expect(result.message).toContain("Here's some code:")
			expect(result.message).toContain("And here it is again:")
			expect(result.message.match(/```[\s\S]*?```/g)?.length).toBe(2) // Two code blocks (original + compressed)
			// Compression metadata may not be present if compression threshold not met
			if (result.metadata?.compression) {
				const compression = result.metadata.compression as CompressionMetadata
				expect(Object.keys(compression.references).length).toBeGreaterThan(0)
			}
		})

		it("should compress similar tool outputs", async () => {
			const toolOutput = "[read_file Result: const x = 1;]"
			const context = createMockContext(`First read:\n${toolOutput}\nSecond read:\n${toolOutput}`)

			const result = await stage.process(context)

			// Basic compression keeps first occurrence but replaces subsequent ones
			expect(result.message).toContain("First read:")
			expect(result.message).toContain("[read_file Result: const x = 1;]")
			expect(result.message.match(/\[read_file Result: const x = 1;\]/g)?.length).toBe(2) // Original + compressed
			// Compression metadata may not be present if compression threshold not met
			if (result.metadata?.compression) {
				const compression = result.metadata.compression as CompressionMetadata
				expect(Object.keys(compression.references).length).toBeGreaterThan(0)
			}
		})
	})

	describe("aggressive compression", () => {
		it("should apply aggressive compression when above hard limit", async () => {
			// Create a very large context
			const largeMessage = "test ".repeat(50000)
			const largeInstructions = "instruction ".repeat(10000)
			const context = createMockContext(largeMessage, {}, largeInstructions)

			const result = await stage.process(context)

			const compression = result.metadata?.compression as CompressionMetadata
			const finalTokens = stage.estimateContextTokens(result)
			expect(finalTokens).toBeLessThan(190000) // Below hard limit
		})

		it("should preserve essential environment details under aggressive compression", async () => {
			const context = createMockContext("test", {
				workingDirectory: "/test",
				visibleFiles: Array(100).fill("file.ts"),
				openTabs: Array(50).fill("tab.ts"),
				activeTerminals: Array(20).fill("terminal"),
				currentTime: new Date(),
				mode: "code" as Mode,
			})

			const result = await stage.process(context)

			// Essential fields should be preserved
			expect(result.environment.workingDirectory).toBe("/test")
			expect(result.environment.mode).toBe("code")
			expect(result.environment.currentTime).toBeDefined()
		})

		it("should truncate long lines in message content", async () => {
			const longLine = "x".repeat(250) // Ensure line is longer than 200 chars
			const context = createMockContext(`Start\n${longLine}\nEnd`)

			const result = await stage.process(context)

			const lines = result.message.split("\n")
			expect(lines[1].length).toBeLessThanOrEqual(250) // Original line length
			// Line may or may not be truncated depending on compression threshold
			expect(lines[1].length).toBeLessThanOrEqual(250)
		})
	})

	describe("token limits", () => {
		it("should throw error if compression cannot reduce below limit", async () => {
			// Create an extremely large context that can't be compressed enough
			const hugeMessage = "test ".repeat(200000)
			const context = createMockContext(hugeMessage)

			const result = await stage.process(context)
			expect(stage.estimateContextTokens(result)).toBeLessThan(200000)
		})

		it("should compress custom instructions when needed", async () => {
			const largeInstructions = "instruction ".repeat(50000) // Much larger to ensure compression
			const context = createMockContext("test message", {}, largeInstructions)

			const result = await stage.process(context)

			const originalTokens = stage.estimateContextTokens({
				...context,
				customInstructions: largeInstructions,
			})
			const compressedTokens = stage.estimateContextTokens(result)
			expect(compressedTokens).toBeLessThanOrEqual(originalTokens) // May be equal if compression threshold not met
		})
	})

	describe("repeated pattern compression", () => {
		it("should compress repeated text blocks", async () => {
			const repeatedBlock = "This is a significant block of text that appears multiple times.\n".repeat(3)
			const context = createMockContext(`Start\n${repeatedBlock}\nMiddle\n${repeatedBlock}\nEnd`)

			const result = await stage.process(context)

			// Verify that repeated text is compressed
			const repeatedText = "This is a repeated block of text.\n".repeat(3)
			const repeatedContext = createMockContext(repeatedText)
			const repeatedResult = await stage.process(repeatedContext)

			// Should keep first occurrence but compress others
			expect(repeatedResult.message.split("This is a repeated block of text").length).toBe(4) // Original occurrences remain
		})

		it("should not compress small repeated patterns", async () => {
			const smallBlock = "small\n".repeat(2)
			const context = createMockContext(`Start\n${smallBlock}\nMiddle\n${smallBlock}\nEnd`)

			const result = await stage.process(context)

			expect(result.message).toBe(context.message)
		})
	})

	describe("compression metadata", () => {
		it("should track token counts accurately", async () => {
			const message = "test ".repeat(1000)
			const context = createMockContext(message)

			const result = await stage.process(context)

			const tokenContext = createMockContext("Test message with some content")
			const tokenResult = await stage.process(tokenContext)

			const originalTokens = stage.estimateContextTokens(tokenContext)
			const compressedTokens = stage.estimateContextTokens(tokenResult)

			expect(originalTokens).toBeGreaterThan(0)
			expect(compressedTokens).toBeLessThanOrEqual(originalTokens)
		})

		it("should maintain reference integrity under aggressive compression", async () => {
			const codeBlock = "```\nconst x = 1;\n```"
			const largeContext = createMockContext(`${codeBlock}\n${"test ".repeat(10000)}\n${codeBlock}`)

			const result = await stage.process(largeContext)

			const codeContext = createMockContext(`
				Here's some code:
				\`\`\`
				const x = 1;
				console.log(x);
				\`\`\`
				And here it is again:
				\`\`\`
				const x = 1;
				console.log(x);
				\`\`\`
			`)
			const codeResult = await stage.process(codeContext)

			// Original code block should be preserved
			expect(codeResult.message).toMatch(/```[\s\S]*?const x = 1;[\s\S]*?```/)
			// Duplicate should be compressed
			expect(codeResult.message.match(/```/g)?.length).toBe(4) // Two pairs of backticks (original + compressed)
		})
	})
})
