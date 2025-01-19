import { ToolArgs } from "./types"

export function getListFilesDescription(args: ToolArgs): string {
	return `## list_files
Description: Request to explore directory structures and discover files. This tool helps you:
1. Understand project organization and available resources
2. Find relevant files for analysis or modification
3. Identify patterns in file organization
4. Locate configuration files, assets, or documentation

Best practices:
- Start with non-recursive listing to understand top-level structure
- Use recursive listing for deeper exploration of specific subdirectories
- Combine with search_files when you need to find specific content
- Do not use to verify file creation - the user will confirm success/failure

Note: The tool provides a directory tree view that helps understand project hierarchy and relationships between files.
Parameters:
- path: (required) The path of the directory to list contents for (relative to the current working directory ${args.cwd})
- recursive: (optional) Whether to list files recursively. Use true for recursive listing, false or omit for top-level only.
Usage:
<list_files>
<path>Directory path here</path>
<recursive>true or false (optional)</recursive>
</list_files>

Example: Requesting to list all files in the current directory
<list_files>
<path>.</path>
<recursive>false</recursive>
</list_files>`
}
