import { DiffStrategy } from "../../diff/DiffStrategy"
import { McpHub } from "../../../services/mcp/McpHub"
import { truncateTextToTokenLimit } from "../../../utils/tokens"

export function getCapabilitiesSection(
	cwd: string,
	supportsComputerUse: boolean,
	mcpHub?: McpHub,
	diffStrategy?: DiffStrategy,
	maxTokens: number = 10000,
): string {
	let capabilities = `==== CAPABILITIES - You have access to tools that let you execute CLI commands on the user's computer list files view source code definitions the ability to get an explanation of a block of code regex search${supportsComputerUse ? " use the browser" : ""} read and write files and ask follow-up questions. These tools help you effectively accomplish a wide range of tasks such as writing code making edits or improvements to existing files understanding the current state of a project performing system operations and much more. - You can get an explanation of a block of code using the \`code_explanation\` tool - You can use search_files to perform regex searches across files in a specified directory outputting context-rich results that include surrounding lines. This is particularly useful for understanding code patterns finding specific implementations or identifying areas that need refactoring. - You can use the list_code_definition_names tool to get an overview of source code definitions for all files at the top level of a specified directory. This can be particularly useful when you need to understand the broader context and relationships between certain parts of the code. You may need to call this tool multiple times to understand various parts of the codebase related to the task. - For example when asked to make edits or improvements you might analyze the file structure in the initial environment_details to get an overview of the project then use list_code_definition_names to get further insight using source code definitions for files located in relevant directories then read_file${diffStrategy ? " or apply_diff" : ""} to examine the contents of relevant files analyze the code and suggest improvements or make necessary edits then use the write_to_file tool to apply the changes. If you refactored code that could affect other parts of the codebase you could use search_files to ensure you update other files as needed.${supportsComputerUse ? " - You can use the browser_action tool to interact with websites (including html files and locally running development servers) through a Puppeteer-controlled browser when you feel it is necessary in accomplishing the user's task. This tool is particularly useful for web development tasks as it allows you to launch a browser navigate to pages interact with elements through clicks and keyboard input and capture the results through screenshots and console logs." : ""}${mcpHub ? " - You have access to MCP servers that may provide additional tools and resources. Each server may provide different capabilities that you can use to accomplish tasks more effectively." : ""}`
	return capabilities
}
