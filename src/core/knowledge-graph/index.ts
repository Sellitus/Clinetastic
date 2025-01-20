import { regexSearchFiles } from "../../services/ripgrep"
import * as path from "path"

/**
 * Simple utility to find related code using ripgrep.
 * This provides a lightweight way to find code relationships
 * without complex parsing or analysis.
 */
export async function findRelatedCode(projectRoot: string, searchTerm: string): Promise<string> {
	// Escape special regex characters in the search term
	const escapedTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

	// Search for definitions (class, function, const, etc.)
	const definitionPattern = `(class|function|const|let|var|interface|type)\\s+${escapedTerm}`
	const definitions = await regexSearchFiles(projectRoot, projectRoot, definitionPattern)

	// Search for imports/exports
	const importPattern = `import.*${escapedTerm}|export.*${escapedTerm}`
	const imports = await regexSearchFiles(projectRoot, projectRoot, importPattern)

	// Search for direct usage
	const usagePattern = `\\b${escapedTerm}\\b`
	const usages = await regexSearchFiles(projectRoot, projectRoot, usagePattern)

	// Combine and format results
	return [
		"# Definitions",
		definitions || "(No definitions found)",
		"",
		"# Imports/Exports",
		imports || "(No imports/exports found)",
		"",
		"# Usages",
		usages || "(No usages found)",
	].join("\n")
}

/**
 * Find all files that import or use a specific definition.
 */
export async function findUsages(projectRoot: string, name: string): Promise<string> {
	// Escape special regex characters in the name
	const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

	// Search for imports
	const importPattern = `import.*${escapedName}`
	const imports = await regexSearchFiles(projectRoot, projectRoot, importPattern)

	// Search for direct usage
	const usagePattern = `\\b${escapedName}\\b`
	const usages = await regexSearchFiles(projectRoot, projectRoot, usagePattern)

	// Format results
	return ["# Imports", imports || "(No imports found)", "", "# Usages", usages || "(No usages found)"].join("\n")
}
