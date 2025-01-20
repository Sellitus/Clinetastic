import { MessageContext, PipelineStage } from "../types"

/**
 * Validates and sanitizes incoming messages
 */
export class ValidationStage implements PipelineStage {
	id = "validation"

	async process(context: MessageContext): Promise<MessageContext> {
		// Validate message is not empty
		if (!context.message.trim()) {
			throw new Error("Message cannot be empty")
		}

		// Validate mode is valid
		if (!context.mode) {
			throw new Error("Mode must be specified")
		}

		// Validate environment details
		if (!context.environment) {
			throw new Error("Environment details are required")
		}

		const { environment } = context
		if (!environment.workingDirectory) {
			throw new Error("Working directory must be specified")
		}

		// Sanitize message
		const sanitizedMessage = this.sanitizeMessage(context.message)

		// Return updated context
		return {
			...context,
			message: sanitizedMessage,
		}
	}

	/**
	 * Sanitize the message content
	 * - Remove unnecessary whitespace
	 * - Normalize line endings
	 * - Remove any potentially harmful content
	 */
	private sanitizeMessage(message: string): string {
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
				// Remove any potentially harmful characters
				.replace(/[\u0000-\u001F\u007F-\u009F]/g, "")
		)
	}
}

/**
 * Factory function to create a validation stage
 */
export function createValidationStage(): PipelineStage {
	return new ValidationStage()
}
