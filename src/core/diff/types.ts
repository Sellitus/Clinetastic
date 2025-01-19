/**
 * Interface for implementing different diff strategies
 */

export type DiffResult =
	| { success: true; content: string }
	| {
			success: false
			error: string
			details?: {
				similarity?: number
				threshold?: number
				matchedRange?: { start: number; end: number }
				searchContent?: string
				bestMatch?: string
			}
	  }

export type MatchFailInfo = {
	originalContent: string
	similarity: number
	threshold: number
	searchContent: string
	bestMatch?: string
}

export interface DiffStrategy {
	/**
	 * Optional callback when a similarity match fails
	 * Allows parent system to handle cache updates or other side effects
	 */
	onMatchFail?: (info: MatchFailInfo) => Promise<void>
	/**
	 * Get the tool description for this diff strategy
	 * @param args The tool arguments including cwd and toolOptions
	 * @returns The complete tool description including format requirements and examples
	 */
	getToolDescription(args: { cwd: string; toolOptions?: { [key: string]: string } }): string

	/**
	 * Apply a diff to the original content
	 * @param originalContent The original file content
	 * @param diffContent The diff content in the strategy's format
	 * @param startLine Optional line number where the search block starts. If not provided, searches the entire file.
	 * @param endLine Optional line number where the search block ends. If not provided, searches the entire file.
	 * @returns A DiffResult object containing either the successful result or error details
	 */
	applyDiff(originalContent: string, diffContent: string, startLine?: number, endLine?: number): Promise<DiffResult>
}
