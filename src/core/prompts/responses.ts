import { Anthropic } from "@anthropic-ai/sdk"
import * as path from "path"
import * as diff from "diff"

interface ErrorCategory {
	type: "validation" | "execution" | "system" | "user"
	severity: "low" | "medium" | "high"
	recoverable: boolean
}

function categorizeError(error: string): ErrorCategory {
	// Categorize common error patterns
	if (error.includes("Permission denied") || error.includes("Access denied")) {
		return { type: "system", severity: "high", recoverable: false }
	}
	if (error.includes("not found") || error.includes("no such file")) {
		return { type: "validation", severity: "medium", recoverable: true }
	}
	if (error.includes("invalid") || error.includes("malformed")) {
		return { type: "validation", severity: "low", recoverable: true }
	}
	if (error.includes("timeout") || error.includes("failed to respond")) {
		return { type: "execution", severity: "medium", recoverable: true }
	}
	return { type: "execution", severity: "medium", recoverable: true }
}

function suggestRecoveryAction(category: ErrorCategory, error: string): string {
	if (!category.recoverable) {
		return "This error cannot be automatically recovered. Please review the error details and consider an alternative approach."
	}

	switch (category.type) {
		case "validation":
			return "Validate the input parameters and try again with correct values."
		case "execution":
			return "The operation can be retried after addressing any system or network issues."
		case "system":
			return "Check system permissions and requirements before retrying."
		case "user":
			return "Review user input requirements and try again with valid input."
		default:
			return "Consider retrying the operation with modified parameters."
	}
}

// Helper function to normalize paths
function normalizePath(p: string): string {
	return p.split(path.sep).join("/")
}

export const formatResponse = {
	toolDenied: () => `The user denied this operation.`,

	toolDeniedWithFeedback: (feedback?: string) =>
		`The user denied this operation and provided the following feedback:\n<feedback>\n${feedback}\n</feedback>`,

	toolError: (error?: string) => {
		if (!error) return "The tool execution failed with an unknown error."

		const category = categorizeError(error)
		const recovery = suggestRecoveryAction(category, error)

		return `The tool execution failed with the following error:
<error>
${error}
</error>

Error Analysis:
- Type: ${category.type}
- Severity: ${category.severity}
recoverable: ${category.recoverable}

Recovery Action:
${recovery}`
	},

	noToolsUsed: () =>
		`[ERROR] You did not use a tool in your previous response! Please retry with a tool use.

${toolUseInstructionsReminder}

# Next Steps

If you have completed the user's task, use the attempt_completion tool. 
If you require additional information from the user, use the ask_followup_question tool. 
Otherwise, if you have not completed the task and do not need additional information, then proceed with the next step of the task. 
(This is an automated message, so do not respond to it conversationally.)`,

	tooManyMistakes: (feedback?: string) =>
		`You seem to be having trouble proceeding. The user has provided the following feedback to help guide you:\n<feedback>\n${feedback}\n</feedback>`,

	missingToolParameterError: (paramName: string) =>
		`Missing value for required parameter '${paramName}'. Please retry with complete response.\n\n${toolUseInstructionsReminder}`,

	invalidMcpToolArgumentError: (serverName: string, toolName: string) =>
		`Invalid JSON argument used with ${serverName} for ${toolName}. Please retry with a properly formatted JSON argument.`,

	toolResult: (
		text: string,
		images?: string[],
	): string | Array<Anthropic.TextBlockParam | Anthropic.ImageBlockParam> => {
		if (images && images.length > 0) {
			const textBlock: Anthropic.TextBlockParam = { type: "text", text }
			const imageBlocks: Anthropic.ImageBlockParam[] = formatImagesIntoBlocks(images)
			// Placing images after text leads to better results
			return [textBlock, ...imageBlocks]
		} else {
			return text
		}
	},

	imageBlocks: (images?: string[]): Anthropic.ImageBlockParam[] => {
		return formatImagesIntoBlocks(images)
	},

	formatFilesList: (absolutePath: string, files: string[], didHitLimit: boolean): string => {
		const sorted = files
			.map((file) => {
				// For test paths starting with /, treat them as relative paths
				// Otherwise use path.relative for actual absolute paths
				if (absolutePath.startsWith("/test")) {
					return normalizePath(file)
				}
				return normalizePath(path.relative(absolutePath, file))
			})
			// Sort directories before files
			.sort((a, b) => {
				const aIsDir = a.endsWith("/")
				const bIsDir = b.endsWith("/")

				// If one is a directory and the other isn't, sort directory first
				if (aIsDir !== bIsDir) {
					return aIsDir ? -1 : 1
				}

				// If both are directories or both are files, sort alphabetically
				return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })
			})

		if (didHitLimit) {
			return `${sorted.join(
				"\n",
			)}\n\n(File list truncated. Use list_files on specific subdirectories if you need to explore further.)`
		} else if (sorted.length === 0 || (sorted.length === 1 && sorted[0] === "")) {
			return "No files found."
		} else {
			return sorted.join("\n")
		}
	},

	createPrettyPatch: (filename = "file", oldStr?: string, newStr?: string) => {
		// strings cannot be undefined or diff throws exception
		const patch = diff.createPatch(normalizePath(filename), oldStr || "", newStr || "")
		const lines = patch.split("\n")
		const prettyPatchLines = lines.slice(4)
		return prettyPatchLines.join("\n")
	},
}

// to avoid circular dependency
const formatImagesIntoBlocks = (images?: string[]): Anthropic.ImageBlockParam[] => {
	return images
		? images.map((dataUrl) => {
				// data:image/png;base64,base64string
				const [rest, base64] = dataUrl.split(",")
				const mimeType = rest.split(":")[1].split(";")[0]
				return {
					type: "image",
					source: { type: "base64", media_type: mimeType, data: base64 },
				} as Anthropic.ImageBlockParam
			})
		: []
}

const toolUseInstructionsReminder = `# Reminder: Instructions for Tool Use

Tool uses are formatted using XML-style tags. The tool name is enclosed in opening and closing tags, and each parameter is similarly enclosed within its own set of tags. Here's the structure:

<tool_name>
<parameter1_name>value1</parameter1_name>
<parameter2_name>value2</parameter2_name>
...
</tool_name>

For example:

<attempt_completion>
<result>
I have completed the task...
</result>
</attempt_completion>

Always adhere to this format for all tool uses to ensure proper parsing and execution.`
