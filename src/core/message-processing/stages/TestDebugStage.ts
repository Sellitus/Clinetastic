import { MessageContext, PipelineStage } from "../types"
import { EnhancedPipelineStage, PipelineStageConfig } from "../pipeline/types"

interface TestError {
	error: string
	fix: string
	timestamp: number
}

interface TestRevision {
	testPath: string
	originalTest: string
	suggestedTest: string
	reason: string
}

interface TestDebugData {
	fixAttempts: number
	previousErrors: TestError[]
	suggestedTestRevisions?: TestRevision[]
}

interface TestDebugContext extends MessageContext {
	testDebug?: TestDebugData
}

interface ErrorPattern {
	pattern: string
	frequency: number
	fixes: string[]
}

interface ErrorGroup {
	errors: TestError[]
}

export class TestDebugStage implements PipelineStage, EnhancedPipelineStage {
	readonly id = "test-debug"

	config: PipelineStageConfig = {
		id: this.id,
		priority: 50,
		parallel: false,
		dependencies: [], // Add dependencies if needed
		maxRetries: 3,
		retryDelay: 1000,
		errorHandling: {
			ignoreErrors: false,
		},
	}

	private readonly HIGH_LEVEL_ANALYSIS_THRESHOLD = 3
	private readonly TEST_REVISION_THRESHOLD = 5
	private readonly SIMILARITY_THRESHOLD = 0.4 // Lowered from 0.7 to better group similar errors

	async process(context: MessageContext): Promise<MessageContext> {
		const testContext = context as TestDebugContext

		// Initialize test debug context if not present
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

	private async performHighLevelAnalysis(context: TestDebugContext): Promise<void> {
		if (!context.testDebug?.previousErrors) return

		const { previousErrors } = context.testDebug

		// Look for patterns in errors
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

	private analyzeErrorPatterns(previousErrors: TestError[]): ErrorPattern[] {
		// Group similar errors
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

	private calculateSimilarity(str1: string, str2: string): number {
		// Normalize strings for better comparison
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

	private levenshteinDistance(str1: string, str2: string): number {
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

	private extractCommonPattern(errors: string[]): string {
		if (errors.length === 0) return ""
		if (errors.length === 1) return errors[0]

		// Extract key terms that appear in most errors
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

	private determineRecommendedApproach(patterns: ErrorPattern[]): string {
		// Analyze patterns to recommend next steps
		const mostFrequentPattern = patterns.reduce((prev, current) =>
			current.frequency > prev.frequency ? current : prev,
		)

		if (mostFrequentPattern.frequency >= 3) {
			return `Consider addressing the common pattern: "${mostFrequentPattern.pattern}"`
		}

		return "No clear pattern detected. Consider reviewing test assumptions."
	}

	private async suggestTestRevisions(context: TestDebugContext): Promise<void> {
		if (!context.testDebug?.previousErrors) return

		const { previousErrors } = context.testDebug

		// Analyze if test revisions might be needed
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
