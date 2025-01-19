/**
 * Estimates the number of tokens in a text string.
 * This is a rough estimate based on word count, as exact token count depends on the model's tokenizer.
 */
export function estimateTokens(text: string): number {
	// Rough estimate: ~1.3 tokens per word for English text
	const words = text.split(/\s+/).length
	return Math.ceil(words * 1.3)
}
