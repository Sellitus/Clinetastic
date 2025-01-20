import * as os from "os"
import * as path from "path"
import * as fs from "fs/promises"

// Global setup that runs once before all test files
export default async (): Promise<void> => {
	// Create temp test directories
	const tempDir = path.join(os.tmpdir(), "clinetastic-test")
	const settingsPath = path.join(tempDir, "settings")
	const mcpServersPath = path.join(tempDir, "mcp/servers")

	await fs.mkdir(settingsPath, { recursive: true })
	await fs.mkdir(mcpServersPath, { recursive: true })

	// Create initial MCP settings file
	await fs.writeFile(path.join(settingsPath, "clinetastic_mcp_settings.json"), JSON.stringify({ mcpServers: {} }))

	// Make temp paths available to tests
	process.env.TEST_TEMP_DIR = tempDir
	process.env.TEST_SETTINGS_PATH = settingsPath
	process.env.TEST_MCP_SERVERS_PATH = mcpServersPath
}
