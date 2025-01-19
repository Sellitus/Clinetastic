export function getAskFollowupQuestionDescription(): string {
	return `## ask_followup_question
Description: Request user input when critical information is missing. Use this tool as a last resort after:
1. Checking environment_details for context
2. Using list_files to explore directories
3. Using search_files to find relevant information
4. Analyzing available configuration files

Best practices:
1. Ask specific, focused questions
2. Only request information that can't be found through tools
3. Combine related questions to minimize back-and-forth
4. Provide context about why the information is needed

IMPORTANT: Prefer using available tools to discover information rather than asking the user. For example:
- Use list_files to find file locations instead of asking for paths
- Use search_files to find configuration instead of asking for settings
- Check environment_details before asking about system information
Parameters:
- question: (required) The question to ask the user. This should be a clear, specific question that addresses the information you need.
Usage:
<ask_followup_question>
<question>Your question here</question>
</ask_followup_question>

Example: Requesting to ask the user for the path to the frontend-config.json file
<ask_followup_question>
<question>What is the path to the frontend-config.json file?</question>
</ask_followup_question>`
}
