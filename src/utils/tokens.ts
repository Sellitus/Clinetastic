/**
 * Estimates the number of tokens in a text string.
 * This is a rough estimate based on characters and word boundaries, as exact token count depends on the model's tokenizer.
 *
 * The estimation takes into account:
 * - Word boundaries
 * - Numbers (typically 1 token per 2-3 digits)
 * - Special characters
 * - Common programming syntax
 *
 * @param text - The input text to estimate tokens for
 * @returns Estimated number of tokens
 *
 * @example
 * estimateTokens('Hello world') // Returns ~3
 * estimateTokens('const x = 123') // Returns ~5
 * estimateTokens('// TODO: fix bug') // Returns ~4
 */
export function estimateTokens(text: string): number {
	if (!text) return 0

	// Count base words
	const words = text.split(/\s+/).filter(Boolean)
	let estimate = words.length * 1.3

	// Add for numbers (roughly 1 token per 2-3 digits)
	const numbers = text.match(/\d+/g) || []
	estimate += numbers.reduce((acc, num) => acc + Math.ceil(num.length / 2.5), 0)

	// Add for special characters and programming syntax
	const specialChars = (text.match(/[^a-zA-Z0-9\s]/g) || []).length
	estimate += specialChars * 0.5

	// Add for code-specific tokens
	const codeTokens = (text.match(/\b(function|const|let|var|return|if|else|for|while)\b/g) || []).length
	estimate += codeTokens * 0.5

	return Math.ceil(estimate)
}

/**
 * Truncates a text string to a maximum number of tokens.
 *
 * @param text - The input text to truncate.
 * @param maxTokens - The maximum number of tokens to keep.
 * @returns The truncated text.
 */
export function truncateTextToTokenLimit(text: string, maxTokens: number): string {
	const words = text.split(/\s+/)
	let tokenCount = 0
	let truncatedText = ""
	for (const word of words) {
		tokenCount += estimateTokens(word + " ") // Add space to simulate word boundary
		if (tokenCount > maxTokens) {
			break
		}
		truncatedText += word + " "
	}
	return truncatedText.trim()
}
