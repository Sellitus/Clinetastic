import { findRelatedCode, findUsages } from "../index"
import { regexSearchFiles } from "../../../services/ripgrep"

jest.mock("../../../services/ripgrep")

describe("Code Search Utilities", () => {
	const mockRegexSearchFiles = regexSearchFiles as jest.Mock

	beforeEach(() => {
		mockRegexSearchFiles.mockClear()
	})

	describe("findRelatedCode", () => {
		it("should search for definitions, imports, and usages", async () => {
			mockRegexSearchFiles
				.mockResolvedValueOnce("function testFunction() {}") // definitions
				.mockResolvedValueOnce('import { testFunction } from "./test"') // imports
				.mockResolvedValueOnce("testFunction()") // usages

			const result = await findRelatedCode("/test/path", "testFunction")

			expect(result).toContain("function testFunction()")
			expect(result).toContain("import { testFunction }")
			expect(result).toContain("testFunction()")
			expect(mockRegexSearchFiles).toHaveBeenCalledTimes(3)
		})

		it("should escape special regex characters in search term", async () => {
			await findRelatedCode("/test/path", "test.function")

			const calls = mockRegexSearchFiles.mock.calls
			expect(calls[0][2]).toContain("test\\.function") // Check if dot is escaped
		})
	})

	describe("findUsages", () => {
		it("should search for imports and usages", async () => {
			mockRegexSearchFiles
				.mockResolvedValueOnce('import { testFunction } from "./test"') // imports
				.mockResolvedValueOnce("testFunction()") // usages

			const result = await findUsages("/test/path", "testFunction")

			expect(result).toContain("import { testFunction }")
			expect(result).toContain("testFunction()")
			expect(mockRegexSearchFiles).toHaveBeenCalledTimes(2)
		})

		it("should escape special regex characters in name", async () => {
			await findUsages("/test/path", "test.function")

			const calls = mockRegexSearchFiles.mock.calls
			expect(calls[0][2]).toContain("test\\.function") // Check if dot is escaped
		})
	})
})
