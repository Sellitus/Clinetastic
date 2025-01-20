/**
 * Estimates the number of tokens in a text string.
 * This is a rough estimate based on characters and word boundaries.
 */
export function estimateTokens(text: string): number {
	if (!text) return 0

	// Base tokenization
	const words = text.split(/\s+/).filter(Boolean)
	let estimate = words.length

	// Handle pure numbers
	if (/^\d+$/.test(text)) {
		return Math.max(1, Math.ceil(text.length / 3))
	}

	// Handle code patterns
	if (/^(const|let|var|function|if|for|while)\b/.test(text)) {
		// Start with base token count
		estimate = 1 // Base overhead for code structure

		// Split into parts preserving operators
		const parts = text
			.replace(/([=+\-*/<>{}()[\];])/g, " $1 ")
			.split(/\s+/)
			.filter(Boolean)

		// Count each part
		for (const part of parts) {
			if (/^[=+\-*/<>{}()[\];]$/.test(part)) {
				// Operators and punctuation count as 0.5 tokens
				estimate += 0.5
			} else if (/^(const|let|var|function|if|for|while)$/.test(part)) {
				// Keywords count as 1.5 tokens
				estimate += 1.5
			} else if (/^\d+$/.test(part)) {
				// Numbers count based on length
				estimate += Math.max(0.5, Math.ceil(part.length / 4))
			} else {
				// Identifiers and other words count as full tokens
				estimate += 1
			}
		}

		// Add minimal overhead for complex structures
		if (text.includes("function") || text.includes("if") || text.includes("for")) {
			estimate += 0.5
		}

		// Round up the final estimate
		return Math.ceil(estimate)
	}

	// Handle regular text
	// Start with base token count for words
	estimate = words.length

	// Add tokens for special characters
	const specialChars = text.match(/[^a-zA-Z0-9\s]/g) || []
	if (specialChars.length > 0) {
		// Group consecutive special chars
		const specialCharGroups = text.match(/[^a-zA-Z0-9\s]+/g) || []
		estimate += Math.ceil(specialCharGroups.length * 0.75) // Increased weight for special chars
	}

	// Handle numbers in text more conservatively
	const numbers = text.match(/\d+/g) || []
	for (const num of numbers) {
		// For numbers in text, count them as part of the word they're in
		estimate += Math.max(0, Math.floor((num.length - 2) / 3))
	}

	// Add overhead for sentence structure
	if (words.length > 2) {
		estimate += 1
	}

	// Add extra overhead for special patterns
	if (text.includes("@") || text.includes(".")) {
		estimate += 1 // Extra token for email-like patterns
	}

	// Ensure minimum token count for non-empty text
	return Math.max(words.length ? 3 : 0, Math.round(estimate))
}

/**
 * Truncates a text string to a maximum number of tokens.
 */
export function truncateTextToTokenLimit(text: string, maxTokens: number): string {
	const words = text.split(/\s+/)
	let tokenCount = 0
	let truncatedText = ""
	for (const word of words) {
		tokenCount += estimateTokens(word + " ")
		if (tokenCount > maxTokens) {
			break
		}
		truncatedText += word + " "
	}
	return truncatedText.trim()
}
