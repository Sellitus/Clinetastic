export function getAttemptCompletionDescription(): string {
	return `## attempt_completion
Description: Request to finalize and present task completion to the user. This is a critical tool that:
1. Marks the end of a task sequence
2. Presents results in a clear, final format
3. Optionally demonstrates the result through a live command

CRITICAL SAFETY REQUIREMENTS:
1. MUST confirm success of ALL previous tool uses from user responses
2. MUST verify in <thinking></thinking> tags that all steps succeeded
3. MUST NOT use if any previous step's success is uncertain
4. MUST NOT use during active browser sessions or incomplete operations

Workflow Integration:
1. Wait for user confirmation after each tool use
2. Track success/failure of each step
3. Only proceed when all steps are confirmed successful
4. Present final result without asking for further input

FAILURE TO FOLLOW THESE REQUIREMENTS WILL CAUSE SYSTEM CORRUPTION.
Parameters:
- result: (required) The result of the task. Formulate this result in a way that is final and does not require further input from the user. Don't end your result with questions or offers for further assistance.
- command: (optional) A CLI command to execute to show a live demo of the result to the user. For example, use \`open index.html\` to display a created html website, or \`open localhost:3000\` to display a locally running development server. But DO NOT use commands like \`echo\` or \`cat\` that merely print text. This command should be valid for the current operating system. Ensure the command is properly formatted and does not contain any harmful instructions.
Usage:
<attempt_completion>
<result>
Your final result description here
</result>
<command>Command to demonstrate result (optional)</command>
</attempt_completion>

Example: Requesting to attempt completion with a result and command
<attempt_completion>
<result>
I've updated the CSS
</result>
<command>open index.html</command>
</attempt_completion>`
}
