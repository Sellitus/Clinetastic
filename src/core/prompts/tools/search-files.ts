import { ToolArgs } from "./types"

export function getSearchFilesDescription(args: ToolArgs): string {
	return `## search_files
Description: Request to perform a regex search across files in a specified directory. This tool is essential for:
1. Finding code patterns and dependencies across the project
2. Identifying all usages of functions, classes, or variables
3. Locating configuration settings or environment variables
4. Discovering similar implementations for refactoring

Each match is displayed with surrounding context lines, making it easier to understand:
- How the matched code is being used
- What dependencies or imports are involved
- The broader scope and impact of potential changes

Use with file_pattern to narrow searches to specific file types (e.g., '*.ts' for TypeScript).
Parameters:
- path: (required) The path of the directory to search in (relative to the current working directory ${args.cwd}). This directory will be recursively searched.
- regex: (required) The regular expression pattern to search for. Uses Rust regex syntax.
- file_pattern: (optional) Glob pattern to filter files (e.g., '*.ts' for TypeScript files). If not provided, it will search all files (*).
Usage:
<search_files>
<path>Directory path here</path>
<regex>Your regex pattern here</regex>
<file_pattern>file pattern here (optional)</file_pattern>
</search_files>

Example: Requesting to search for all .ts files in the current directory
<search_files>
<path>.</path>
<regex>.*</regex>
<file_pattern>*.ts</file_pattern>
</search_files>`
}
