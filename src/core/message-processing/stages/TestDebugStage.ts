/**
 * TestDebugStage
 *
 * A pipeline stage that provides intelligent test debugging capabilities by:
 * 1. Tracking test failures and fix attempts
 * 2. Analyzing error patterns to identify recurring issues
 * 3. Suggesting test revisions when multiple fix attempts fail
 * 4. Providing high-level analysis of test behavior
 *
 * The stage uses sophisticated error pattern matching and similarity analysis
 * to group related errors and identify common failure modes. This helps in:
 * - Detecting flaky tests
 * - Identifying invalid test assumptions
 * - Suggesting test improvements
 * - Providing actionable debugging insights
 */

import { MessageContext, PipelineStage } from "../types"
import { EnhancedPipelineStage, PipelineStageConfig } from "../pipeline/types"

/**
 * Represents a single test error occurrence with its attempted fix
 */
interface TestError {
	error: string
	fix: string
	timestamp: number
}

/**
 * Represents a suggested revision for a failing test.
 * Contains both the original and suggested test implementations
 * along with contextual information about why the change is recommended.
 */
interface TestRevision {
	testPath: string // Path to the test file being revised
	originalTest: string // Current implementation of the test
	suggestedTest: string // Proposed new implementation
	reason: string // Explanation of why this revision might help
}

/**
 * Accumulated debug data for a test over multiple fix attempts
 */
interface TestDebugData {
	fixAttempts: number // Number of attempts to fix the test
	previousErrors: TestError[] // History of errors and their fixes
	suggestedTestRevisions?: TestRevision[] // Suggested improvements if multiple fixes fail
}

/**
 * Extended message context with test debugging capabilities
 */
interface TestDebugContext extends MessageContext {
	testDebug?: TestDebugData
}

/**
 * Represents a recurring pattern in test errors
 */
interface ErrorPattern {
	pattern: string // Common error pattern identified
	frequency: number // How often this pattern occurs
	fixes: string[] // List of attempted fixes for this pattern
}

/**
 * Groups similar errors together for pattern analysis
 */
interface ErrorGroup {
	errors: TestError[]
}

export class TestDebugStage implements PipelineStage, EnhancedPipelineStage {
	/**
	 * Unique identifier for this pipeline stage
	 */
	readonly id = "test-debug"

	/**
	 * Pipeline stage configuration that defines:
	 * - Priority: 50 (medium priority in pipeline)
	 * - Parallel: false (must run sequentially)
	 * - Retries: 3 attempts with 1s delay
	 * - Error handling: strict (no ignored errors)
	 */
	config: PipelineStageConfig = {
		id: this.id,
		priority: 50,
		parallel: false,
		dependencies: [], // No dependencies required
		maxRetries: 3,
		retryDelay: 1000,
		errorHandling: {
			ignoreErrors: false,
		},
	}

	/**
	 * Thresholds that control stage behavior:
	 *
	 * HIGH_LEVEL_ANALYSIS_THRESHOLD (3):
	 * - Triggers pattern analysis after 3 failed attempts
	 * - Helps identify recurring issues early
	 *
	 * TEST_REVISION_THRESHOLD (5):
	 * - Suggests test revisions after 5 failed attempts
	 * - Allows sufficient attempts before questioning test design
	 *
	 * SIMILARITY_THRESHOLD (0.4):
	 * - Controls error grouping sensitivity
	 * - Lower value (0.4) catches more similar errors than default (0.7)
	 */
	private readonly HIGH_LEVEL_ANALYSIS_THRESHOLD = 3
	private readonly TEST_REVISION_THRESHOLD = 5
	private readonly SIMILARITY_THRESHOLD = 0.4

	/**
	 * Main processing method for the TestDebugStage.
	 * Handles test debugging workflow in multiple phases:
	 *
	 * 1. Initialization: Sets up debug context if first run
	 * 2. Analysis Triggering: Checks thresholds for analysis
	 * 3. Pattern Detection: Analyzes error patterns after multiple failures
	 * 4. Test Revision: Suggests test improvements if fixes aren't working
	 *
	 * The stage uses configurable thresholds:
	 * - HIGH_LEVEL_ANALYSIS_THRESHOLD (3 attempts): Triggers pattern analysis
	 * - TEST_REVISION_THRESHOLD (5 attempts): Suggests test revisions
	 *
	 * @param context The message context to process
	 * @returns Updated context with debug information and suggestions
	 */
	async process(context: MessageContext): Promise<MessageContext> {
		const testContext = context as TestDebugContext

		// First run initialization
		if (!testContext.testDebug) {
			testContext.testDebug = {
				fixAttempts: 0,
				previousErrors: [],
			}
			return testContext
		}

		// Increment fix attempts
		testContext.testDebug.fixAttempts++

		// Check if we need higher-level analysis
		if (testContext.testDebug.fixAttempts >= this.HIGH_LEVEL_ANALYSIS_THRESHOLD) {
			await this.performHighLevelAnalysis(testContext)
		}

		// Check if we should suggest test revisions
		if (testContext.testDebug.fixAttempts >= this.TEST_REVISION_THRESHOLD) {
			await this.suggestTestRevisions(testContext)
		}

		return testContext
	}

	/**
	 * Performs high-level analysis of test failures to identify patterns and suggest solutions.
	 * This analysis is triggered after HIGH_LEVEL_ANALYSIS_THRESHOLD (3) failed attempts.
	 *
	 * The analysis process:
	 * 1. Groups similar errors using text similarity analysis
	 * 2. Identifies recurring patterns in each group
	 * 3. Determines the most frequent failure modes
	 * 4. Generates recommendations based on patterns
	 *
	 * Results are stored in context.metadata.testDebugAnalysis for:
	 * - Pattern identification
	 * - Frequency analysis
	 * - Recommended approaches
	 *
	 * @param context The test debug context containing error history
	 */
	private async performHighLevelAnalysis(context: TestDebugContext): Promise<void> {
		if (!context.testDebug?.previousErrors) return

		const { previousErrors } = context.testDebug

		// Analyze error patterns and frequencies
		const errorPatterns = this.analyzeErrorPatterns(previousErrors)

		// Update context with analysis results
		context.metadata = {
			...context.metadata,
			testDebugAnalysis: {
				patterns: errorPatterns,
				recommendedApproach: this.determineRecommendedApproach(errorPatterns),
				timestamp: Date.now(),
			},
		}
	}

	/**
	 * Analyzes error patterns to identify recurring issues and common failure modes.
	 * Uses a sophisticated similarity analysis to group related errors and extract patterns.
	 *
	 * The analysis process:
	 * 1. Groups similar errors using text similarity metrics
	 * 2. Extracts common patterns from each group
	 * 3. Tracks frequency and attempted fixes
	 *
	 * @param previousErrors Array of historical test errors
	 * @returns Array of identified error patterns with their frequencies
	 */
	private analyzeErrorPatterns(previousErrors: TestError[]): ErrorPattern[] {
		// Group similar errors using similarity analysis
		const errorGroups = previousErrors.reduce((groups: ErrorGroup[], error) => {
			// Find the most similar group
			let bestMatch: ErrorGroup | null = null
			let highestSimilarity = 0

			for (const group of groups) {
				// Calculate average similarity with all errors in the group
				const avgSimilarity =
					group.errors.reduce(
						(sum, groupError) => sum + this.calculateSimilarity(groupError.error, error.error),
						0,
					) / group.errors.length

				if (avgSimilarity > highestSimilarity && avgSimilarity >= this.SIMILARITY_THRESHOLD) {
					highestSimilarity = avgSimilarity
					bestMatch = group
				}
			}

			if (bestMatch) {
				bestMatch.errors.push(error)
			} else {
				groups.push({ errors: [error] })
			}

			return groups
		}, [])

		return errorGroups.map((group) => ({
			pattern: this.extractCommonPattern(group.errors.map((e) => e.error)),
			frequency: group.errors.length,
			fixes: group.errors.map((e) => e.fix),
		}))
	}

	/**
	 * Calculates the similarity between two error strings using a hybrid approach:
	 * - 70% weight on word-based similarity (Jaccard similarity of word sets)
	 * - 30% weight on character-based similarity (Levenshtein distance)
	 *
	 * This hybrid approach helps catch both semantic similarities (same words in different order)
	 * and syntactic similarities (minor spelling variations or formatting differences).
	 *
	 * @param str1 First error string to compare
	 * @param str2 Second error string to compare
	 * @returns Similarity score between 0 (completely different) and 1 (identical)
	 */
	private calculateSimilarity(str1: string, str2: string): number {
		// Normalize strings by converting to lowercase and removing special characters
		const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, "")
		const n1 = normalize(str1)
		const n2 = normalize(str2)

		// Calculate word-based similarity
		const words1 = new Set(n1.split(/\s+/))
		const words2 = new Set(n2.split(/\s+/))
		const intersection = new Set([...words1].filter((x) => words2.has(x)))
		const wordSimilarity = (2.0 * intersection.size) / (words1.size + words2.size)

		// Calculate Levenshtein-based similarity
		const maxLength = Math.max(n1.length, n2.length)
		const levenshteinSimilarity = maxLength === 0 ? 1.0 : 1 - this.levenshteinDistance(n1, n2) / maxLength

		// Return weighted combination
		return 0.7 * wordSimilarity + 0.3 * levenshteinSimilarity
	}

	/**
	 * Calculates the Levenshtein (edit) distance between two strings.
	 * This measures the minimum number of single-character edits required
	 * to transform one string into another.
	 *
	 * The algorithm uses dynamic programming with a matrix to track:
	 * - Insertions (cost of 1)
	 * - Deletions (cost of 1)
	 * - Substitutions (cost of 1)
	 *
	 * @param str1 First string to compare
	 * @param str2 Second string to compare
	 * @returns The minimum number of edits needed
	 */
	private levenshteinDistance(str1: string, str2: string): number {
		// Initialize matrix for dynamic programming
		const matrix = Array(str2.length + 1)
			.fill(null)
			.map(() => Array(str1.length + 1).fill(null))

		for (let i = 0; i <= str1.length; i++) matrix[0][i] = i
		for (let j = 0; j <= str2.length; j++) matrix[j][0] = j

		for (let j = 1; j <= str2.length; j++) {
			for (let i = 1; i <= str1.length; i++) {
				const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1
				matrix[j][i] = Math.min(matrix[j][i - 1] + 1, matrix[j - 1][i] + 1, matrix[j - 1][i - 1] + indicator)
			}
		}

		return matrix[str2.length][str1.length]
	}

	/**
	 * Extracts a common pattern from a group of similar error messages.
	 * Uses word frequency analysis to identify key terms that appear
	 * consistently across multiple errors.
	 *
	 * The algorithm:
	 * 1. Breaks each error into individual words
	 * 2. Counts frequency of each word
	 * 3. Identifies words that appear in majority (>50%) of errors
	 * 4. Constructs pattern from most frequent common words
	 *
	 * @param errors Array of error messages to analyze
	 * @returns Common pattern string, or first error if no pattern found
	 */
	private extractCommonPattern(errors: string[]): string {
		if (errors.length === 0) return ""
		if (errors.length === 1) return errors[0]

		// Break errors into words and analyze frequencies
		const words = errors.map((error) => error.toLowerCase().match(/\b\w+\b/g) || [])

		const wordFrequency = words.flat().reduce((freq: Record<string, number>, word) => {
			freq[word] = (freq[word] || 0) + 1
			return freq
		}, {})

		// Find words that appear in majority of errors
		const commonWords = Object.entries(wordFrequency)
			.filter(([_, count]) => count >= Math.ceil(errors.length * 0.5))
			.map(([word]) => word)
			.sort((a, b) => wordFrequency[b] - wordFrequency[a])

		if (commonWords.length === 0) return errors[0]

		// Construct a pattern using common words
		return commonWords.join(" ")
	}

	/**
	 * Determines the recommended debugging approach based on identified error patterns.
	 *
	 * The recommendation logic:
	 * 1. If a pattern occurs 3+ times, suggest focusing on that specific pattern
	 * 2. If no clear pattern emerges, suggest reviewing test assumptions
	 *
	 * This helps guide developers towards:
	 * - Addressing systematic issues first
	 * - Reconsidering test design when fixes aren't working
	 * - Focusing effort on most impactful changes
	 *
	 * @param patterns Array of identified error patterns with frequencies
	 * @returns A string describing the recommended next steps
	 */
	private determineRecommendedApproach(patterns: ErrorPattern[]): string {
		// Find most frequent pattern to guide recommendations
		const mostFrequentPattern = patterns.reduce((prev, current) =>
			current.frequency > prev.frequency ? current : prev,
		)

		if (mostFrequentPattern.frequency >= 3) {
			return `Consider addressing the common pattern: "${mostFrequentPattern.pattern}"`
		}

		return "No clear pattern detected. Consider reviewing test assumptions."
	}

	/**
	 * Suggests revisions to test cases when multiple fix attempts have failed.
	 * This is triggered after TEST_REVISION_THRESHOLD (5) attempts and provides
	 * comprehensive suggestions for improving the test.
	 *
	 * The suggestion process:
	 * 1. Analyzes if revision is needed based on fix history
	 * 2. Generates suggested test modifications
	 * 3. Provides reasoning for suggested changes
	 * 4. Includes supporting evidence from error patterns
	 *
	 * The suggestions are stored in:
	 * - context.testDebug.suggestedTestRevisions: Actual test changes
	 * - context.metadata.testRevisionWarning: Supporting evidence
	 *
	 * @param context Test debug context with error history
	 */
	private async suggestTestRevisions(context: TestDebugContext): Promise<void> {
		if (!context.testDebug?.previousErrors) return

		const { previousErrors } = context.testDebug

		// Evaluate need for test revision based on history
		const needsRevision = this.analyzeTestRevisionNeed(previousErrors)

		if (needsRevision && context.testDebug) {
			context.testDebug.suggestedTestRevisions = [
				{
					testPath: context.metadata?.currentTest?.path || "unknown",
					originalTest: context.metadata?.currentTest?.content || "",
					suggestedTest: this.generateRevisedTest(context),
					reason: this.generateRevisionReason(previousErrors),
				},
			]

			// Add warning about potential test revision need
			context.metadata = {
				...context.metadata,
				testRevisionWarning: {
					message: "Multiple fix attempts unsuccessful. Consider reviewing test case validity.",
					timestamp: Date.now(),
					evidence: this.generateRevisionEvidence(previousErrors),
				},
			}
		}
	}

	private analyzeTestRevisionNeed(previousErrors: TestError[]): boolean {
		// Check if we've made multiple distinct fix attempts without success
		const uniqueFixAttempts = new Set(previousErrors.map((e) => e.fix)).size
		return uniqueFixAttempts >= 3
	}

	private generateRevisedTest(context: TestDebugContext): string {
		// This would contain logic to suggest test modifications based on the error history
		// For now, return placeholder
		return context.metadata?.currentTest?.content || ""
	}

	private generateRevisionReason(previousErrors: TestError[]): string {
		const patterns = this.analyzeErrorPatterns(previousErrors)
		const mostFrequent = patterns.reduce((prev, current) => (current.frequency > prev.frequency ? current : prev))

		return `Multiple fix attempts (${previousErrors.length}) have failed to resolve the issue. Common error pattern: "${mostFrequent.pattern}"`
	}

	private generateRevisionEvidence(previousErrors: TestError[]): Record<string, unknown> {
		return {
			fixAttempts: previousErrors.length,
			uniqueErrors: new Set(previousErrors.map((e) => e.error)).size,
			timeSpan: previousErrors[previousErrors.length - 1].timestamp - previousErrors[0].timestamp,
			patterns: this.analyzeErrorPatterns(previousErrors),
		}
	}
}
