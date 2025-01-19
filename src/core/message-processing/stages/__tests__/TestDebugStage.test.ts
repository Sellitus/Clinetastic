import { TestDebugStage } from "../TestDebugStage"
import { MessageContext } from "../../types"

// Create a type-safe way to extend MessageContext
interface ExtendedMessageContext extends MessageContext {
	testDebug?: {
		fixAttempts: number
		previousErrors: Array<{
			error: string
			fix: string
			timestamp: number
		}>
		suggestedTestRevisions?: Array<{
			testPath: string
			originalTest: string
			suggestedTest: string
			reason: string
		}>
	}
}

describe("TestDebugStage", () => {
	let stage: TestDebugStage
	let mockContext: ExtendedMessageContext

	beforeEach(() => {
		stage = new TestDebugStage()
		mockContext = {
			message: "test message",
			mode: "code",
			environment: {
				workingDirectory: "/test",
				visibleFiles: [],
				openTabs: [],
				activeTerminals: [],
				currentTime: new Date(),
				mode: "code",
			},
			metadata: {
				currentTest: {
					path: "src/test/example.test.ts",
					content: "test('should work', () => { expect(true).toBe(true) })",
				},
			},
		}
	})

	it("should initialize test debug context if not present", async () => {
		const result = (await stage.process(mockContext)) as ExtendedMessageContext
		expect(result).toHaveProperty("testDebug")
		expect(result.testDebug).toEqual({
			fixAttempts: 0,
			previousErrors: [],
		})
	})

	it("should increment fix attempts on each process", async () => {
		const initialResult = (await stage.process(mockContext)) as ExtendedMessageContext
		const secondResult = (await stage.process(initialResult)) as ExtendedMessageContext
		expect(secondResult.testDebug?.fixAttempts).toBe(1)
	})

	it("should perform high-level analysis after threshold attempts", async () => {
		let context = mockContext
		context = (await stage.process(context)) as ExtendedMessageContext // Initialize

		// Add some test errors
		context.testDebug = {
			...context.testDebug!,
			previousErrors: [
				{
					error: "Expected true to be false",
					fix: "Changed assertion to expect(false)",
					timestamp: Date.now(),
				},
				{
					error: "Expected true to be false",
					fix: "Modified test condition",
					timestamp: Date.now(),
				},
				{
					error: "Expected true to be false",
					fix: "Updated test case",
					timestamp: Date.now(),
				},
			],
		}

		// Process enough times to trigger analysis
		for (let i = 0; i < 3; i++) {
			context = (await stage.process(context)) as ExtendedMessageContext
		}

		expect(context.metadata).toHaveProperty("testDebugAnalysis")
		expect(context.metadata?.testDebugAnalysis).toHaveProperty("patterns")
		expect(context.metadata?.testDebugAnalysis).toHaveProperty("recommendedApproach")
	})

	it("should suggest test revisions after threshold attempts", async () => {
		let context = mockContext
		context = (await stage.process(context)) as ExtendedMessageContext // Initialize

		// Add some test errors
		context.testDebug = {
			...context.testDebug!,
			previousErrors: [
				{
					error: "Expected true to be false",
					fix: "Changed assertion",
					timestamp: Date.now(),
				},
				{
					error: "Expected true to be false",
					fix: "Modified condition",
					timestamp: Date.now(),
				},
				{
					error: "Expected true to be false",
					fix: "Updated test",
					timestamp: Date.now(),
				},
				{
					error: "Expected true to be false",
					fix: "Refactored test",
					timestamp: Date.now(),
				},
				{
					error: "Expected true to be false",
					fix: "Changed implementation",
					timestamp: Date.now(),
				},
			],
		}

		// Process enough times to trigger test revision suggestion
		for (let i = 0; i < 5; i++) {
			context = (await stage.process(context)) as ExtendedMessageContext
		}

		expect(context.testDebug).toHaveProperty("suggestedTestRevisions")
		expect(context.metadata).toHaveProperty("testRevisionWarning")
	})

	it("should calculate error pattern similarity correctly", async () => {
		let context = mockContext
		context = (await stage.process(context)) as ExtendedMessageContext // Initialize

		// Add similar but not identical errors
		context.testDebug = {
			...context.testDebug!,
			previousErrors: [
				{
					error: "Expected value to be true but got false",
					fix: "Fix 1",
					timestamp: Date.now(),
				},
				{
					error: "Expected value to be false but got true",
					fix: "Fix 2",
					timestamp: Date.now(),
				},
				{
					error: "Expected true but received false",
					fix: "Fix 3",
					timestamp: Date.now(),
				},
			],
		}

		// Process enough times to trigger analysis
		for (let i = 0; i < 3; i++) {
			context = (await stage.process(context)) as ExtendedMessageContext
		}

		const analysis = context.metadata?.testDebugAnalysis
		expect(analysis).toBeDefined()
		expect(analysis?.patterns).toHaveLength(1) // Should group similar errors together
	})
})
