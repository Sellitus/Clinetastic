import { ToolArgs } from "./types"

export function getReadFileDescription(args: ToolArgs): string {
	return `## read_file
Description: Request to read the contents of a file at the specified path. This tool is foundational for code analysis and modification workflows. Use it to:
1. Examine existing code before making changes with write_to_file or apply_diff
2. Get exact line numbers and content for precise diff operations
3. Analyze dependencies in package files or configuration
4. Extract text from documentation (PDF/DOCX)
The output includes line numbers (e.g. "1 | const x = 1") to enable precise references in diffs and discussions. While it can extract text from PDF/DOCX, avoid using it with other binary files as they may produce unreadable output.
Parameters:
- path: (required) The path of the file to read (relative to the current working directory ${args.cwd})
Usage:
<read_file>
<path>File path here</path>
</read_file>

Example: Requesting to read frontend-config.json
<read_file>
<path>frontend-config.json</path>
</read_file>`
}
