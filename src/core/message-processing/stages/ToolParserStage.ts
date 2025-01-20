import { MessageContext, PipelineStage, ToolExecutionContext } from "../types"

/**
 * Detects and parses tool usage in messages
 */
export class ToolParserStage implements PipelineStage {
	id = "tool-parser"

	async process(context: MessageContext): Promise<MessageContext> {
		const { message } = context

		// Check for XML-style tool tags
		const toolMatch = message.match(/<(\w+)>([\s\S]*?)<\/\1>/)
		if (!toolMatch) {
			return context
		}

		const [fullMatch, toolName, toolContent] = toolMatch

		// Parse tool parameters
		const params = this.parseToolParameters(toolContent)

		// Create tool execution context
		const toolExecution: ToolExecutionContext = {
			toolName,
			params,
			validated: false,
		}

		// Return updated context with tool execution info
		return {
			...context,
			requiresToolExecution: true,
			toolExecution,
			// Remove the tool directive from the message
			message: message.replace(fullMatch, "").trim(),
		}
	}

	/**
	 * Parse tool parameters from XML-style content
	 */
	private parseToolParameters(content: string): Record<string, any> {
		const params: Record<string, any> = {}

		// Match parameter tags
		const paramRegex = /<(\w+)>([\s\S]*?)<\/\1>/g
		let match

		while ((match = paramRegex.exec(content)) !== null) {
			const [, paramName, paramValue] = match
			params[paramName] = this.parseParameterValue(paramValue.trim())
		}

		return params
	}

	/**
	 * Parse parameter value and convert to appropriate type
	 */
	private parseParameterValue(value: string): any {
		// Try parsing as JSON
		try {
			return JSON.parse(value)
		} catch {
			// If not valid JSON, return as string
			return value
		}
	}

	/**
	 * Validate tool parameters against schema
	 */
	private validateParameters(params: Record<string, any>, schema: Record<string, any>): boolean {
		for (const [key, spec] of Object.entries(schema)) {
			// Check required parameters
			if (spec.required && !(key in params)) {
				return false
			}

			// Check parameter type
			if (key in params) {
				const value = params[key]
				switch (spec.type) {
					case "string":
						if (typeof value !== "string") return false
						break
					case "number":
						if (typeof value !== "number") return false
						break
					case "boolean":
						if (typeof value !== "boolean") return false
						break
					case "array":
						if (!Array.isArray(value)) return false
						break
					case "object":
						if (typeof value !== "object" || value === null) return false
						break
				}
			}
		}

		return true
	}
}

/**
 * Factory function to create a tool parser stage
 */
export function createToolParserStage(): PipelineStage {
	return new ToolParserStage()
}
