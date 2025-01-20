/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
	preset: "ts-jest",
	testEnvironment: "node",
	moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
	transform: {
		"^.+\\.tsx?$": [
			"ts-jest",
			{
				tsconfig: {
					module: "CommonJS",
					moduleResolution: "node",
					esModuleInterop: true,
					allowJs: true,
				},
			},
		],
	},
	testMatch: ["**/__tests__/**/*.test.ts"],
	moduleNameMapper: {
		"^vscode$": "<rootDir>/src/__mocks__/vscode.js",
		"^../webview/ClineProvider$": "<rootDir>/src/__mocks__/ClineProvider.ts",
		"@modelcontextprotocol/sdk$": "<rootDir>/src/__mocks__/@modelcontextprotocol/sdk/index.js",
		"@modelcontextprotocol/sdk/(.*)": "<rootDir>/src/__mocks__/@modelcontextprotocol/sdk/$1",
		"^delay$": "<rootDir>/src/__mocks__/delay.js",
		"^p-wait-for$": "<rootDir>/src/__mocks__/p-wait-for.js",
		"^globby$": "<rootDir>/src/__mocks__/globby.js",
		"^serialize-error$": "<rootDir>/src/__mocks__/serialize-error.js",
		"^strip-ansi$": "<rootDir>/src/__mocks__/strip-ansi.js",
		"^default-shell$": "<rootDir>/src/__mocks__/default-shell.js",
		"^os-name$": "<rootDir>/src/__mocks__/os-name.js",
	},
	transformIgnorePatterns: [
		"node_modules/(?!(@modelcontextprotocol|delay|p-wait-for|globby|serialize-error|strip-ansi|default-shell|os-name)/)",
	],
	modulePathIgnorePatterns: [".vscode-test", "out/"],
	reporters: ["default"],
	setupFilesAfterEnv: ["<rootDir>/src/test/setup.ts"],
	globalTeardown: "<rootDir>/src/test/teardown.ts",
	testTimeout: 10000,
	maxWorkers: 1,
	forceExit: true,
	// Add garbage collection between tests
	globals: {
		"ts-jest": {
			isolatedModules: true,
		},
		gc: true,
	},
	// Cleanup between test files
	globalSetup: "<rootDir>/src/test/setup-global.ts",
}
