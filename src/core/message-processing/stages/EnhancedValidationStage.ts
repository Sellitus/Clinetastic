import { MessageContext } from "../types"
import { EnhancedPipelineStage, PipelineStageConfig } from "../pipeline/types"

/**
 * Enhanced validation stage with parallel processing capabilities
 * and conditional branches
 */
export class EnhancedValidationStage implements EnhancedPipelineStage {
	config: PipelineStageConfig = {
		id: "validation",
		priority: 0, // Validation should run first
		parallel: true, // Can run validations in parallel
		dependencies: [], // No dependencies
		branches: [
			{
				id: "strict-validation",
				condition: async (context: MessageContext) => context.mode === "code", // Strict validation for code mode
				stages: [],
			},
		],
	}

	async process(context: MessageContext): Promise<MessageContext> {
		// Run validations in parallel
		const [messageValidation, modeValidation, envValidation] = await Promise.all([
			this.validateMessage(context.message),
			this.validateMode(context.mode),
			this.validateEnvironment(context.environment),
		])

		// Apply all sanitization rules
		const sanitizedMessage = await this.sanitizeMessage(context.message)

		// Return updated context
		return {
			...context,
			message: sanitizedMessage,
			// Add validation metadata
			metadata: {
				...context.metadata,
				validations: {
					message: messageValidation,
					mode: modeValidation,
					environment: envValidation,
				},
			},
		}
	}

	/**
	 * Validate message content
	 */
	private async validateMessage(message: string): Promise<boolean> {
		if (!message.trim()) {
			throw new Error("Message cannot be empty")
		}

		// Additional message validations
		const maxLength = 10000
		if (message.length > maxLength) {
			throw new Error(`Message exceeds maximum length of ${maxLength} characters`)
		}

		return true
	}

	/**
	 * Validate processing mode
	 */
	private async validateMode(mode: string): Promise<boolean> {
		if (!mode) {
			throw new Error("Mode must be specified")
		}

		const validModes = ["code", "chat", "doc"]
		if (!validModes.includes(mode)) {
			throw new Error(`Invalid mode: ${mode}. Must be one of: ${validModes.join(", ")}`)
		}

		return true
	}

	/**
	 * Validate environment details
	 */
	private async validateEnvironment(environment: any): Promise<boolean> {
		if (!environment) {
			throw new Error("Environment details are required")
		}

		const requiredFields = ["workingDirectory", "mode"]
		for (const field of requiredFields) {
			if (!environment[field]) {
				throw new Error(`Missing required environment field: ${field}`)
			}
		}

		return true
	}

	/**
	 * Sanitize message content with enhanced rules
	 */
	private async sanitizeMessage(message: string): Promise<string> {
		return (
			message
				// Normalize line endings
				.replace(/\r\n/g, "\n")
				// Remove multiple consecutive empty lines
				.replace(/\n{3,}/g, "\n\n")
				// Trim whitespace
				.trim()
				// Remove null bytes
				.replace(/\0/g, "")
				// Remove control characters
				.replace(/[\u0000-\u001F\u007F-\u009F]/g, "")
				// Normalize quotes
				.replace(/[\u2018\u2019]/g, "'")
				.replace(/[\u201C\u201D]/g, '"')
				// Remove zero-width characters
				.replace(/[\u200B-\u200D\uFEFF]/g, "")
				// Normalize spaces
				.replace(/\s+/g, " ")
		)
	}
}
