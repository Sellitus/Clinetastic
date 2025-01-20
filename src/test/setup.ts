// Test setup that runs before each test file
beforeAll(() => {
	// Increase timeout for all tests
	jest.setTimeout(5000)

	// Mock fs module for tests
	jest.mock("fs/promises", () => ({
		mkdir: jest.fn().mockResolvedValue(undefined),
		writeFile: jest.fn().mockResolvedValue(undefined),
		readFile: jest.fn().mockImplementation((path) => {
			if (path.includes("clinetastic_mcp_settings.json")) {
				return Promise.resolve(JSON.stringify({ mcpServers: {} }))
			}
			return Promise.resolve("[]")
		}),
		unlink: jest.fn().mockResolvedValue(undefined),
		rmdir: jest.fn().mockResolvedValue(undefined),
		access: jest.fn().mockResolvedValue(undefined),
	}))

	// Mock fileExistsAtPath
	jest.mock("../utils/fs", () => ({
		fileExistsAtPath: jest.fn().mockImplementation((filePath) => {
			return Promise.resolve(true)
		}),
	}))
})

beforeEach(() => {
	// Clear all mocks before each test
	jest.clearAllMocks()
})

afterEach(() => {
	// Clean up any resources
	jest.clearAllTimers()
})

afterAll(() => {
	// Try garbage collection if available
	try {
		if (global.gc) {
			global.gc()
		}
	} catch (e) {
		// Ignore if gc is not available
	}
})
