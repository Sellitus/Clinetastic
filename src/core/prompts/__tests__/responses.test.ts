import { formatResponse } from "../responses"

describe("responses", () => {
	describe("toolError", () => {
		it("should format basic error message", () => {
			const error = "File not found"
			const result = formatResponse.toolError(error)
			expect(result).toContain("File not found")
			expect(result).toContain("<error>")
			expect(result).toContain("</error>")
		})

		it("should provide recovery suggestions for file operations", () => {
			const error = "Permission denied"
			const result = formatResponse.toolError(error)
			expect(result).toContain("system")
			expect(result).toContain("high")
			expect(result).toContain("recoverable: false")
		})

		it("should handle undefined error gracefully", () => {
			const result = formatResponse.toolError(undefined)
			expect(result).toBeDefined()
			expect(result).toContain("error")
		})
	})

	describe("toolDenied", () => {
		it("should format basic denial message", () => {
			const result = formatResponse.toolDenied()
			expect(result).toBe("The user denied this operation.")
		})
	})

	describe("toolDeniedWithFeedback", () => {
		it("should format denial with feedback", () => {
			const feedback = "Need more validation"
			const result = formatResponse.toolDeniedWithFeedback(feedback)
			expect(result).toContain(feedback)
			expect(result).toContain("<feedback>")
			expect(result).toContain("</feedback>")
		})

		it("should handle undefined feedback", () => {
			const result = formatResponse.toolDeniedWithFeedback(undefined)
			expect(result).toContain("<feedback>")
			expect(result).toContain("</feedback>")
		})
	})

	describe("formatFilesList", () => {
		it("should format empty file list", () => {
			const result = formatResponse.formatFilesList("/test", [], false)
			expect(result).toBe("No files found.")
		})

		it("should sort directories before files", () => {
			const files = ["file.txt", "dir/subfile.txt", "dir/"]
			const result = formatResponse.formatFilesList("/test", files, false)
			const lines = result.split("\n")
			expect(lines[0]).toBe("dir/")
			expect(lines[1]).toBe("dir/subfile.txt")
			expect(lines[2]).toBe("file.txt")
		})

		it("should indicate truncation", () => {
			const files = ["file1.txt", "file2.txt"]
			const result = formatResponse.formatFilesList("/test", files, true)
			expect(result).toContain("File list truncated")
		})
	})

	describe("createPrettyPatch", () => {
		it("should create patch between two strings", () => {
			const oldStr = "old content"
			const newStr = "new content"
			const result = formatResponse.createPrettyPatch("test.txt", oldStr, newStr)
			expect(result).toContain("-old")
			expect(result).toContain("+new")
		})

		it("should handle undefined inputs", () => {
			const result = formatResponse.createPrettyPatch(undefined, undefined, undefined)
			expect(result).toBeDefined()
		})
	})
})
