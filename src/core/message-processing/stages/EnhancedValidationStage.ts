import { MessageContext } from "../types"
import { EnhancedPipelineStage } from "../pipeline/types"

interface ValidationResult {
	isValid: boolean
	errors: ValidationError[]
	warnings: ValidationWarning[]
}

interface ValidationError {
	code: string
	message: string
	field?: string
	details?: Record<string, any>
}

interface ValidationWarning {
	code: string
	message: string
	suggestion?: string
	details?: Record<string, any>
}

export class EnhancedValidationStage implements EnhancedPipelineStage {
	config = {
		id: "validation",
		priority: 0,
		parallel: false,
		dependencies: [],
		maxRetries: 3,
		retryDelay: 1000,
		useExponentialBackoff: true,
		resourceLimits: {
			maxMemory: 1024 * 1024 * 100, // 100MB
			maxCpu: 30000, // 30 seconds
			timeout: 30000, // 30 seconds
		},
	}

	private readonly VALIDATION_RULES = {
		REQUIRED_FIELDS: "required_fields",
		TYPE_CHECK: "type_check",
		FORMAT_CHECK: "format_check",
		RANGE_CHECK: "range_check",
		SECURITY_CHECK: "security_check",
		DEPENDENCY_CHECK: "dependency_check",
	} as const

	async process(context: MessageContext): Promise<MessageContext> {
		const validationResult = await this.validateContext(context)

		if (!validationResult.isValid) {
			const errorMessages = validationResult.errors
				.map((error) => `[${error.code}] ${error.message}${error.field ? ` (Field: ${error.field})` : ""}`)
				.join("\n")

			throw new Error(`Validation failed:\n${errorMessages}`)
		}

		// Add warnings to context metadata
		if (validationResult.warnings.length > 0) {
			context.metadata = {
				...context.metadata,
				validationWarnings: validationResult.warnings,
			}
		}

		return context
	}

	private async validateContext(context: MessageContext): Promise<ValidationResult> {
		const errors: ValidationError[] = []
		const warnings: ValidationWarning[] = []

		// Required fields validation
		if (!context.message) {
			errors.push({
				code: this.VALIDATION_RULES.REQUIRED_FIELDS,
				message: "Message content is required",
				field: "message",
			})
		}

		if (!context.mode) {
			errors.push({
				code: this.VALIDATION_RULES.REQUIRED_FIELDS,
				message: "Mode is required",
				field: "mode",
			})
		}

		// Environment validation
		if (!context.environment?.workingDirectory) {
			errors.push({
				code: this.VALIDATION_RULES.REQUIRED_FIELDS,
				message: "Working directory is required",
				field: "environment.workingDirectory",
			})
		}

		// Enhanced tool execution validation
		if (context.requiresToolExecution) {
			if (!context.toolExecution) {
				errors.push({
					code: this.VALIDATION_RULES.DEPENDENCY_CHECK,
					message: "Tool execution details required when requiresToolExecution is true",
					field: "toolExecution",
				})
			} else {
				// Basic tool validation
				if (!context.toolExecution.toolName) {
					errors.push({
						code: this.VALIDATION_RULES.REQUIRED_FIELDS,
						message: "Tool name is required",
						field: "toolExecution.toolName",
					})
				}

				if (!context.toolExecution.params) {
					errors.push({
						code: this.VALIDATION_RULES.REQUIRED_FIELDS,
						message: "Tool parameters are required",
						field: "toolExecution.params",
					})
				}

				// Retry configuration validation
				if (context.toolExecution.maxRetries !== undefined) {
					if (!Number.isInteger(context.toolExecution.maxRetries) || context.toolExecution.maxRetries < 0) {
						errors.push({
							code: this.VALIDATION_RULES.RANGE_CHECK,
							message: "maxRetries must be a non-negative integer",
							field: "toolExecution.maxRetries",
							details: { value: context.toolExecution.maxRetries },
						})
					}

					if (context.toolExecution.retryDelay !== undefined) {
						if (
							!Number.isFinite(context.toolExecution.retryDelay) ||
							context.toolExecution.retryDelay < 0
						) {
							errors.push({
								code: this.VALIDATION_RULES.RANGE_CHECK,
								message: "retryDelay must be a non-negative number",
								field: "toolExecution.retryDelay",
								details: { value: context.toolExecution.retryDelay },
							})
						}
					}
				}

				// Resource limits validation
				if (context.toolExecution.resourceLimits) {
					const { maxMemory, maxCpu, timeout } = context.toolExecution.resourceLimits

					if (maxMemory !== undefined && (!Number.isFinite(maxMemory) || maxMemory <= 0)) {
						errors.push({
							code: this.VALIDATION_RULES.RANGE_CHECK,
							message: "Invalid maxMemory value",
							field: "toolExecution.resourceLimits.maxMemory",
							details: { value: maxMemory },
						})
					}

					if (maxCpu !== undefined && (!Number.isFinite(maxCpu) || maxCpu <= 0)) {
						errors.push({
							code: this.VALIDATION_RULES.RANGE_CHECK,
							message: "Invalid maxCpu value",
							field: "toolExecution.resourceLimits.maxCpu",
							details: { value: maxCpu },
						})
					}

					if (timeout !== undefined && (!Number.isFinite(timeout) || timeout < 100)) {
						errors.push({
							code: this.VALIDATION_RULES.RANGE_CHECK,
							message: "Timeout must be at least 100ms",
							field: "toolExecution.resourceLimits.timeout",
							details: { value: timeout },
						})
					}
				}

				// Error handling validation
				if (context.toolExecution.errorHandling) {
					const { ignoreErrors, fallbackValue, errorTransform } = context.toolExecution.errorHandling

					if (ignoreErrors && fallbackValue === undefined) {
						warnings.push({
							code: "missing_fallback",
							message: "ignoreErrors is true but no fallbackValue provided",
							suggestion: "Consider providing a fallbackValue for error recovery",
							details: { toolName: context.toolExecution.toolName },
						})
					}

					if (errorTransform && typeof errorTransform !== "function") {
						errors.push({
							code: this.VALIDATION_RULES.TYPE_CHECK,
							message: "errorTransform must be a function",
							field: "toolExecution.errorHandling.errorTransform",
						})
					}
				}

				// Security validation for tool execution
				const securityIssues = this.validateToolSecurity(context.toolExecution)
				errors.push(...securityIssues)

				// Performance warnings
				if (context.toolExecution.params && typeof context.toolExecution.params === "object") {
					const paramSize = JSON.stringify(context.toolExecution.params).length
					if (paramSize > 10000) {
						warnings.push({
							code: "large_params",
							message: "Tool parameters are very large",
							suggestion: "Consider breaking down the operation into smaller chunks",
							details: { paramSize },
						})
					}
				}
			}
		}

		return {
			isValid: errors.length === 0,
			errors,
			warnings,
		}
	}

	private validateToolSecurity(toolExecution: MessageContext["toolExecution"]): ValidationError[] {
		const errors: ValidationError[] = []

		if (!toolExecution) return errors

		const { toolName, params } = toolExecution

		// Check for command injection in execute_command
		if (toolName === "execute_command" && typeof params?.command === "string") {
			const dangerousPatterns = [
				";",
				"&&",
				"||",
				"|",
				">",
				"<",
				"$(",
				"rm -rf",
				"wget",
				"curl",
				"chmod",
				"sudo",
				"su",
				"eval",
				"exec",
			]

			for (const pattern of dangerousPatterns) {
				if (params.command.includes(pattern)) {
					errors.push({
						code: this.VALIDATION_RULES.SECURITY_CHECK,
						message: `Command contains potentially dangerous pattern: ${pattern}`,
						field: "toolExecution.params.command",
						details: { pattern },
					})
				}
			}
		}

		// Check for path traversal in file operations
		if (["read_file", "write_to_file", "apply_diff"].includes(toolName)) {
			if (
				typeof params?.path === "string" &&
				(params.path.includes("..") || params.path.startsWith("/") || params.path.startsWith("~"))
			) {
				errors.push({
					code: this.VALIDATION_RULES.SECURITY_CHECK,
					message: "File path contains potentially dangerous patterns",
					field: "toolExecution.params.path",
					details: { path: params.path },
				})
			}
		}

		return errors
	}
}
