import { Anthropic } from "@anthropic-ai/sdk"
import * as path from "path"
import * as diff from "diff"

export const formatResponse = {
	toolDenied: () =>
		`Operation denied by user.

# Next Steps
1. Review task requirements carefully
2. Consider alternative approaches
3. Break down complex operations into smaller steps
4. Use safer or more appropriate tools
5. If unclear, use ask_followup_question for clarification

Remember: User safety and comfort is the top priority.`,

	toolDeniedWithFeedback: (feedback?: string) =>
		`Operation denied by user with feedback:
<feedback>
${feedback}
</feedback>

# Analysis & Recovery
1. Key Points from Feedback:
	  ${feedback
			?.split("\n")
			.map((line) => `   - ${line.trim()}`)
			.join("\n   ")}

2. Action Items:
	  - Review feedback thoroughly
	  - Adjust approach based on concerns
	  - Consider suggested alternatives
	  - Break down complex steps
	  - Validate assumptions

3. Next Steps:
	  - If unclear → ask_followup_question
	  - If alternative suggested → try new approach
	  - If simpler approach needed → break down task
	  - If blocked → request clarification

Remember: Feedback is valuable guidance for improving task execution.`,

	toolError: (error?: string) => {
		// Parse error message for better categorization
		const errorType = error?.toLowerCase().includes("permission")
			? "Permission Error"
			: error?.toLowerCase().includes("not found")
				? "Not Found Error"
				: error?.toLowerCase().includes("timeout")
					? "Timeout Error"
					: error?.toLowerCase().includes("validation")
						? "Validation Error"
						: "Execution Error"

		const errorContext = error?.toLowerCase().includes("path")
			? "File System Operation"
			: error?.toLowerCase().includes("command")
				? "Command Execution"
				: error?.toLowerCase().includes("browser")
					? "Browser Operation"
					: error?.toLowerCase().includes("api")
						? "API Operation"
						: "Tool Operation"

		return `Tool execution failed with error:
<error>
${error}
</error>

# Error Analysis
Type: ${errorType}
Context: ${errorContext}
Severity: ${error?.toLowerCase().includes("fatal") ? "Critical" : "Recoverable"}

# Diagnostic Steps
1. Error Category Specific Checks:
	  ${
			errorType === "Permission Error"
				? "- Verify access rights\n   - Check file/resource ownership\n   - Consider safer alternatives"
				: errorType === "Not Found Error"
					? "- Verify path/resource exists\n   - Check for typos\n   - Confirm resource location"
					: errorType === "Timeout Error"
						? "- Check resource availability\n   - Consider breaking into smaller operations\n   - Verify network connectivity"
						: errorType === "Validation Error"
							? "- Review parameter formats\n   - Check input requirements\n   - Validate assumptions"
							: "- Review error details\n   - Check system state\n   - Verify prerequisites"
		}

2. Recovery Strategy:
	  - Analyze error message thoroughly
	  - Verify all parameters and formats
	  - Consider alternative approaches
	  - Break down complex operations
	  - Use safer fallback options

3. Prevention Steps:
	  - Add validation checks
	  - Use more specific tools
	  - Implement error handling
	  - Monitor operation progress
	  - Document recovery steps

# Next Actions
1. ${
			errorType === "Permission Error"
				? "Request necessary permissions or use alternative approach"
				: errorType === "Not Found Error"
					? "Verify resource location and availability"
					: errorType === "Timeout Error"
						? "Break operation into smaller steps"
						: errorType === "Validation Error"
							? "Review and correct input parameters"
							: "Analyze and address root cause"
		}
2. If unclear → use ask_followup_question
3. If blocked → try alternative approach
4. If complex → break down task
5. If persistent → seek user guidance`
	},

	noToolsUsed: () =>
		`[ERROR] Direct responses without tool use are not allowed. Your response must include a tool use.

${toolUseInstructionsReminder}

# Response Analysis & Guidance
1. Current Task State Assessment:
	  - Review completion status
	  - Check information completeness
	  - Validate assumptions
	  - Identify blocking issues
	  - Determine next logical step

2. Decision Framework:
	  Task Complete?
	  ├─ Yes → use attempt_completion
	  │        Parameters:
	  │        - result: Clear summary of achievements
	  │        - command: Optional demo command if applicable
	  │
	  ├─ No, Need Info → use ask_followup_question
	  │        Parameters:
	  │        - question: Specific, focused inquiry
	  │        - Avoid asking for information already provided
	  │        - Break complex questions into smaller parts
	  │
	  └─ No, Have Info → use appropriate tool
	          Tool Selection Guide:
	          - File operations: write_to_file, apply_diff for code changes
	          - System tasks: execute_command for CLI operations
	          - Web tasks: browser_action for UI interactions
	          - Discovery: search_files, list_files for exploration
	          - Code analysis: list_code_definition_names for structure

3. Quality Checklist:
	  - Response addresses task directly
	  - Tool choice matches immediate need
	  - Parameters are complete and validated
	  - Context is preserved and referenced
	  - Progress is clearly measurable
	  - Error handling is considered
	  - Security implications are evaluated

4. Best Practices:
	  - Place tool use at end of message
	  - Include only one tool use per message
	  - Validate all parameters before use
	  - Consider security implications
	  - Break complex operations into steps
	  - Maintain clear progress tracking

Remember: Each response must include exactly one tool use, strategically chosen to make meaningful progress toward task completion.`,

	tooManyMistakes: (feedback?: string) =>
		`Multiple errors detected. User feedback:
<feedback>
${feedback}
</feedback>

# Comprehensive Error Analysis
1. Pattern Recognition:
	  - Identify common themes in errors
	  - Look for recurring issues
	  - Note any specific tools causing problems
	  - Check for environmental factors
	  - Review sequence of failures

2. Root Cause Assessment:
	  - Task complexity too high
	  - Missing prerequisites
	  - Invalid assumptions
	  - Tool misuse patterns
	  - Context gaps
	  - Security constraints

3. Recovery Strategy:
	  A. Immediate Actions
	     - Pause current operation
	     - Save any progress
	     - Review task requirements
	     - Validate environment state
	     - Check resource availability

	  B. Task Restructuring
	     - Break into smaller subtasks
	     - Simplify complex operations
	     - Use more basic tools first
	     - Add verification steps
	     - Implement checkpoints

	  C. Tool Usage Optimization
	     - Verify tool prerequisites
	     - Double-check parameters
	     - Add error handling
	     - Consider alternatives
	     - Test in isolation

4. Prevention Measures:
	  - Implement validation checks
	  - Add progress monitoring
	  - Document assumptions
	  - Create recovery points
	  - Maintain state awareness

5. Next Steps:
	  - If unclear → use ask_followup_question for specific guidance
	  - If blocked → break down task into smaller steps
	  - If tool issues → try alternative approaches
	  - If complex → simplify operations
	  - If uncertain → validate assumptions first

Remember: Focus on making small, verifiable progress rather than attempting large, risky changes.`,

	missingToolParameterError: (paramName: string) =>
		`Required parameter '${paramName}' is missing.

# Parameter Requirements
- All required parameters must be provided
- Parameter names must match exactly
- Values must be properly formatted
- Empty values are not allowed

${toolUseInstructionsReminder}`,

	invalidMcpToolArgumentError: (serverName: string, toolName: string) =>
		`Invalid JSON argument detected for ${toolName} on ${serverName}.

# JSON Formatting Requirements
1. Must be valid JSON syntax
2. All required fields must be present
3. Field types must match schema
4. Arrays and objects must be properly nested

Please review the tool's schema and retry with properly formatted JSON.`,

	// Add new error handlers
	invalidToolUseFormat: () =>
		`Invalid tool use format detected.

# Common Format Issues
1. Missing opening/closing tags
2. Incorrect tag nesting
3. Invalid parameter names
4. Malformed XML structure

${toolUseInstructionsReminder}`,

	contextValidationError: (details: string) =>
		`Context validation failed:
<details>
${details}
</details>

# Validation Requirements
1. All required context must be present
2. Context values must be properly formatted
3. References must be valid
4. Dependencies must be satisfied

Please review the context requirements and try again.`,

	securityViolation: (violation: string) =>
		`Security violation detected:
<violation>
${violation}
</violation>

# Security Requirements
1. No unsafe command patterns
2. No unauthorized path access
3. No injection attempts
4. Proper parameter sanitization

Please modify your request to comply with security policies.`,

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
				// convert absolute path to relative path
				const relativePath = path.relative(absolutePath, file).toPosix()
				return file.endsWith("/") ? relativePath + "/" : relativePath
			})
			// Sort so files are listed under their respective directories to make it clear what files are children of what directories. Since we build file list top down, even if file list is truncated it will show directories that cline can then explore further.
			.sort((a, b) => {
				const aParts = a.split("/") // only works if we use toPosix first
				const bParts = b.split("/")
				for (let i = 0; i < Math.min(aParts.length, bParts.length); i++) {
					if (aParts[i] !== bParts[i]) {
						// If one is a directory and the other isn't at this level, sort the directory first
						if (i + 1 === aParts.length && i + 1 < bParts.length) {
							return -1
						}
						if (i + 1 === bParts.length && i + 1 < aParts.length) {
							return 1
						}
						// Otherwise, sort alphabetically
						return aParts[i].localeCompare(bParts[i], undefined, { numeric: true, sensitivity: "base" })
					}
				}
				// If all parts are the same up to the length of the shorter path,
				// the shorter one comes first
				return aParts.length - bParts.length
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
		const patch = diff.createPatch(filename.toPosix(), oldStr || "", newStr || "")
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
