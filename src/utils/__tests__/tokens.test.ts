import { estimateTokens } from "../tokens"

describe("estimateTokens", () => {
	it("should handle empty string", () => {
		expect(estimateTokens("")).toBe(0)
	})

	it("should estimate basic English text", () => {
		expect(estimateTokens("Hello world")).toBe(3)
		expect(estimateTokens("This is a test sentence")).toBe(7)
	})

	it("should handle numbers correctly", () => {
		expect(estimateTokens("123")).toBe(1)
		expect(estimateTokens("12345")).toBe(2)
		expect(estimateTokens("The number is 12345")).toBe(6)
	})

	it("should account for special characters", () => {
		expect(estimateTokens("Hello!")).toBe(3)
		expect(estimateTokens("What?!")).toBe(3)
		expect(estimateTokens("test@example.com")).toBe(4)
	})

	it("should handle code snippets appropriately", () => {
		expect(estimateTokens("const x = 123;")).toBe(6)
		expect(estimateTokens("function test() { return true; }")).toBe(9)
		expect(estimateTokens("if (condition) { doSomething(); }")).toBe(10)
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
