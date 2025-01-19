import { estimateTokens } from "../tokens"

describe("estimateTokens", () => {
	it("should handle empty string", () => {
		expect(estimateTokens("")).toBe(0)
	})

	it("should estimate basic English text", () => {
		// Test with ranges since exact token counts can vary
		const helloTokens = estimateTokens("Hello world")
		expect(helloTokens).toBeGreaterThanOrEqual(2)
		expect(helloTokens).toBeLessThanOrEqual(4)

		const sentenceTokens = estimateTokens("This is a test sentence")
		expect(sentenceTokens).toBeGreaterThanOrEqual(5)
		expect(sentenceTokens).toBeLessThanOrEqual(8)
	})

	it("should handle numbers correctly", () => {
		// Single numbers should be one token
		expect(estimateTokens("123")).toBe(1)
		expect(estimateTokens("12345")).toBeGreaterThanOrEqual(1)
		expect(estimateTokens("12345")).toBeLessThanOrEqual(2)

		// Numbers in sentences get additional context tokens
		const numberSentenceTokens = estimateTokens("The number is 12345")
		expect(numberSentenceTokens).toBeGreaterThanOrEqual(5)
		expect(numberSentenceTokens).toBeLessThanOrEqual(7)
	})

	it("should account for special characters", () => {
		// Special characters typically add partial tokens
		const exclamationTokens = estimateTokens("Hello!")
		expect(exclamationTokens).toBeGreaterThanOrEqual(2)
		expect(exclamationTokens).toBeLessThanOrEqual(3)

		const questionTokens = estimateTokens("What?!")
		expect(questionTokens).toBeGreaterThanOrEqual(2)
		expect(questionTokens).toBeLessThanOrEqual(3)

		const emailTokens = estimateTokens("test@example.com")
		expect(emailTokens).toBeGreaterThanOrEqual(3)
		expect(emailTokens).toBeLessThanOrEqual(5)
	})

	it("should handle code snippets appropriately", () => {
		// Code snippets should count keywords and operators
		const assignmentTokens = estimateTokens("const x = 123;")
		expect(assignmentTokens).toBeGreaterThanOrEqual(4)
		expect(assignmentTokens).toBeLessThanOrEqual(7)

		const functionTokens = estimateTokens("function test() { return true; }")
		expect(functionTokens).toBeGreaterThanOrEqual(7)
		expect(functionTokens).toBeLessThanOrEqual(10)

		const conditionTokens = estimateTokens("if (condition) { doSomething(); }")
		expect(conditionTokens).toBeGreaterThanOrEqual(8)
		expect(conditionTokens).toBeLessThanOrEqual(11)
	})

	it("should handle multiline text", () => {
		const multiline = `
            function example() {
                // This is a comment
                return true;
            }
        `
		expect(estimateTokens(multiline)).toBeGreaterThan(10)
	})
})
