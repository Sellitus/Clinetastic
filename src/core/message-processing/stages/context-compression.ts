import { PipelineStage, MessageContext, EnvironmentDetails } from "../types"
import { estimateTokens } from "../../../utils/tokens"

interface CompressedReference {
	type: "tool" | "code" | "environment"
	hash: string
	summary: string
}

interface CompressionMetadata {
	references: { [key: string]: CompressedReference }
	originalTokenCount: number
	compressedTokenCount: number
}

export class ContextCompressionStage implements PipelineStage {
	id = "context-compression"
	private readonly MODEL_TOKEN_LIMIT = 200000 // Updated to match actual limit
	private readonly COMPRESSION_THRESHOLD = 0.6 // More aggressive: compress at 60% of limit
	private readonly HARD_LIMIT = 190000 // Safety margin below actual limit

	async process(context: MessageContext): Promise<MessageContext> {
		const currentTokens = this.estimateContextTokens(context)
		let compressedContext = { ...context }

		// Always apply basic compression if above threshold
		if (currentTokens > this.MODEL_TOKEN_LIMIT * this.COMPRESSION_THRESHOLD) {
			compressedContext = await this.compressContext(compressedContext, currentTokens)
		}

		// Apply aggressive compression if still too large
		const compressedTokens = this.estimateContextTokens(compressedContext)
		if (compressedTokens > this.HARD_LIMIT) {
			compressedContext = await this.applyAggressiveCompression(compressedContext)
		}

		// Final validation
		const finalTokens = this.estimateContextTokens(compressedContext)
		if (finalTokens > this.MODEL_TOKEN_LIMIT) {
			throw new Error(`Context too large (${finalTokens} tokens) even after compression`)
		}

		return compressedContext
	}

	public estimateContextTokens(context: MessageContext): number {
		const messageTokens = estimateTokens(context.message)
		const envTokens = estimateTokens(JSON.stringify(context.environment))
		const customInstructionsTokens = context.customInstructions ? estimateTokens(context.customInstructions) : 0

		return messageTokens + envTokens + customInstructionsTokens
	}

	private async compressContext(context: MessageContext, currentTokens: number): Promise<MessageContext> {
		const metadata: CompressionMetadata = {
			references: {},
			originalTokenCount: currentTokens,
			compressedTokenCount: 0,
		}
		const compressedContext = {
			...context,
			metadata: {
				...context.metadata,
				compression: metadata,
			},
		}

		// Basic compression
		if (context.message) {
			compressedContext.message = this.compressMessage(context.message, metadata.references)
		}

		if (context.environment) {
			compressedContext.environment = this.compressEnvironment(context.environment, metadata.references)
		}

		// Store compression metadata
		compressedContext.metadata = {
			...compressedContext.metadata,
			compression: metadata,
		}

		metadata.compressedTokenCount = this.estimateContextTokens(compressedContext)
		return compressedContext
	}

	private async applyAggressiveCompression(context: MessageContext): Promise<MessageContext> {
		const compressedContext = { ...context }

		// 1. Truncate old environment details
		if (compressedContext.environment) {
			// Keep only essential environment info
			const { workingDirectory, mode, currentTime } = compressedContext.environment
			compressedContext.environment = {
				workingDirectory,
				mode,
				currentTime,
				visibleFiles: [],
				openTabs: [],
				activeTerminals: [],
			}
		}

		// 2. Compress message more aggressively
		if (compressedContext.message) {
			// Remove duplicate whitespace and normalize line endings
			compressedContext.message = compressedContext.message
				.replace(/\r\n/g, "\n")
				.replace(/\n{3,}/g, "\n\n")
				.replace(/[ \t]+/g, " ")
				.trim()

			// Truncate long lines
			const lines = compressedContext.message.split("\n")
			compressedContext.message = lines
				.map((line) => {
					if (line.length > 200) {
						const truncated = line.slice(0, 197)
						return truncated.endsWith("...") ? truncated : truncated + "..."
					}
					return line
				})
				.join("\n")
		}

		// 3. Truncate custom instructions if present
		if (compressedContext.customInstructions) {
			const maxInstructionsTokens = 2500 // More aggressive compression for custom instructions
			const currentTokens = estimateTokens(compressedContext.customInstructions)

			if (currentTokens > maxInstructionsTokens) {
				compressedContext.customInstructions = this.truncateToTokenLimit(
					compressedContext.customInstructions,
					maxInstructionsTokens,
				)
			}
		}

		return compressedContext
	}

	private compressMessage(message: string, references: { [key: string]: CompressedReference }): string {
		let compressedMessage = message

		// 1. Compress code blocks
		compressedMessage = this.compressCodeBlocks(compressedMessage, references)

		// 2. Compress tool outputs
		compressedMessage = this.compressToolOutputs(compressedMessage, references)

		// 3. Compress repeated text patterns
		compressedMessage = this.compressRepeatedPatterns(compressedMessage, references)

		return compressedMessage
	}

	private compressCodeBlocks(message: string, references: { [key: string]: CompressedReference }): string {
		const codeBlockRegex = /```(?:[\s\S]*?)```/g
		const codeBlocks = message.match(codeBlockRegex) || []
		const processedBlocks: { [key: string]: string } = {}

		let compressedMessage = message
		codeBlocks.forEach((block) => {
			const hash = this.hashContent(block)
			if (processedBlocks[hash]) {
				const ref = this.createCompressedReference(
					"code",
					hash,
					`Similar to code block at ${processedBlocks[hash]}`,
					references,
				)
				compressedMessage = compressedMessage.replace(block, `[REF:${ref.hash}]`)
			} else {
				processedBlocks[hash] = block.slice(0, 30) + "..."
			}
		})

		return compressedMessage
	}

	private compressToolOutputs(message: string, references: { [key: string]: CompressedReference }): string {
		const toolOutputRegex = /\[[\w_-]+ Result:[^\]]+\]/g
		const toolOutputs = message.match(toolOutputRegex) || []
		const processedOutputs: { [key: string]: string } = {}

		let compressedMessage = message
		toolOutputs.forEach((output) => {
			const hash = this.hashContent(output)
			if (processedOutputs[hash]) {
				const ref = this.createCompressedReference(
					"tool",
					hash,
					`Similar to tool output at ${processedOutputs[hash]}`,
					references,
				)
				compressedMessage = compressedMessage.replace(output, `[REF:${ref.hash}]`)
			} else {
				processedOutputs[hash] = output.slice(0, 30) + "..."
			}
		})

		return compressedMessage
	}

	private compressRepeatedPatterns(message: string, references: { [key: string]: CompressedReference }): string {
		// Find repeated text blocks (3+ lines that appear multiple times)
		const lines = message.split("\n")
		const patterns: { [key: string]: number } = {}

		for (let i = 0; i < lines.length - 2; i++) {
			const block = lines
				.slice(i, i + 3)
				.join("\n")
				.trim()
			if (block.length > 0) {
				patterns[block] = (patterns[block] || 0) + 1
			}
		}

		let compressedMessage = message
		Object.entries(patterns).forEach(([block, count]) => {
			if (count > 1 && block.length > 50) {
				// Only compress significant blocks
				const hash = this.hashContent(block)
				const ref = this.createCompressedReference(
					"tool",
					hash,
					`Repeated text block (${count} occurrences)`,
					references,
				)
				// Replace all but first occurrence
				const escapedBlock = block.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
				const regex = new RegExp(`(${escapedBlock})`, "g")
				let firstMatch = true
				compressedMessage = compressedMessage.replace(regex, (match, p1) => {
					if (firstMatch) {
						firstMatch = false
						return p1
					}
					return `[REF:${ref.hash}]`
				})
			}
		})

		return compressedMessage
	}

	private compressEnvironment(
		env: EnvironmentDetails,
		references: { [key: string]: CompressedReference },
	): EnvironmentDetails {
		const compressed = { ...env }

		// Compress visible files list
		if (compressed.visibleFiles && compressed.visibleFiles.length > 0) {
			compressed.visibleFiles = this.compressFileList(compressed.visibleFiles, references, "visible-files")
		}

		// Compress open tabs list
		if (compressed.openTabs && compressed.openTabs.length > 0) {
			compressed.openTabs = this.compressFileList(compressed.openTabs, references, "open-tabs")
		}

		return compressed
	}

	private compressFileList(
		files: string[],
		references: { [key: string]: CompressedReference },
		groupId: string,
	): string[] {
		const filePatterns: { [key: string]: string[] } = {}

		// Group files by pattern
		files.forEach((file) => {
			const pattern = this.getFilePattern(file)
			if (!filePatterns[pattern]) {
				filePatterns[pattern] = []
			}
			filePatterns[pattern].push(file)
		})

		const compressed: string[] = []
		Object.entries(filePatterns).forEach(([pattern, groupFiles]) => {
			if (groupFiles.length > 2) {
				// More aggressive: compress groups of 3+ files
				const ref = this.createCompressedReference(
					"environment",
					this.hashContent(`${groupId}-${pattern}`),
					`${groupFiles.length} files matching ${pattern}`,
					references,
				)
				compressed.push(`[REF:${ref.hash}]`)
			} else {
				compressed.push(...groupFiles)
			}
		})

		return compressed
	}

	private getFilePattern(file: string): string {
		const parts = file.split("/")
		return parts
			.map((part) => {
				if (/^\d+$/.test(part)) return "[n]"
				if (/^[a-f0-9]{7,}$/.test(part)) return "[hash]"
				return part
			})
			.join("/")
	}

	private hashContent(content: string): string {
		let hash = 0
		for (let i = 0; i < content.length; i++) {
			const char = content.charCodeAt(i)
			hash = (hash << 5) - hash + char
			hash = hash & hash
		}
		return hash.toString(36)
	}

	private createCompressedReference(
		type: CompressedReference["type"],
		hash: string,
		summary: string,
		references: { [key: string]: CompressedReference },
	): CompressedReference {
		const reference = { type, hash, summary }
		references[hash] = reference
		return reference
	}

	private truncateToTokenLimit(text: string, maxTokens: number): string {
		const words = text.split(/\s+/)
		let result = ""
		let currentTokens = 0

		for (const word of words) {
			const wordTokens = estimateTokens(word + " ")
			if (currentTokens + wordTokens > maxTokens) {
				break
			}
			result += word + " "
			currentTokens += wordTokens
		}

		return result.trim()
	}
}
