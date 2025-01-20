import { MessageContext } from "../types"
import { EnhancedMessageProcessor } from "../EnhancedMessageProcessor"
import { EnhancedPipelineStage, PipelineStageConfig } from "../pipeline/types"

/**
 * Example stage that can run in parallel
 */
class ParallelProcessingStage implements EnhancedPipelineStage {
	config: PipelineStageConfig = {
		id: "parallel-processor",
		priority: 1,
		parallel: true,
		dependencies: ["validation"], // Runs after validation
	}

	async process(context: MessageContext): Promise<MessageContext> {
		// Simulate parallel processing
		const [result1, result2] = await Promise.all([this.heavyTask1(context), this.heavyTask2(context)])

		return {
			...context,
			metadata: {
				...context.metadata,
				parallelResults: { result1, result2 },
			},
		}
	}

	private async heavyTask1(context: MessageContext): Promise<string> {
		// Simulate heavy processing
		return `Processed ${context.message.length} characters`
	}

	private async heavyTask2(context: MessageContext): Promise<string> {
		// Simulate heavy processing
		return `Mode: ${context.mode}`
	}
}

/**
 * Example stage with conditional execution
 */
class ConditionalStage implements EnhancedPipelineStage {
	config: PipelineStageConfig = {
		id: "conditional-processor",
		priority: 2,
		parallel: false,
		dependencies: ["parallel-processor"],
		condition: async (context: MessageContext) => context.mode === "code" && context.message.length > 100,
	}

	async process(context: MessageContext): Promise<MessageContext> {
		return {
			...context,
			metadata: {
				...context.metadata,
				conditionalProcessing: "Applied special processing for long code messages",
			},
		}
	}
}

/**
 * Example stage with branching logic
 */
class BranchingStage implements EnhancedPipelineStage {
	config: PipelineStageConfig = {
		id: "branching-processor",
		priority: 3,
		parallel: false,
		dependencies: ["conditional-processor"],
		branches: [
			{
				id: "code-branch",
				condition: async (context: MessageContext) => context.mode === "code",
				stages: [new CodeProcessingStage()],
			},
			{
				id: "chat-branch",
				condition: async (context: MessageContext) => context.mode === "chat",
				stages: [new ChatProcessingStage()],
			},
		],
	}

	async process(context: MessageContext): Promise<MessageContext> {
		return {
			...context,
			metadata: {
				...context.metadata,
				branchingApplied: true,
			},
		}
	}
}

/**
 * Example stage for code branch
 */
class CodeProcessingStage implements EnhancedPipelineStage {
	config: PipelineStageConfig = {
		id: "code-processor",
		priority: 4,
		parallel: false,
		dependencies: ["branching-processor"],
	}

	async process(context: MessageContext): Promise<MessageContext> {
		return {
			...context,
			metadata: {
				...context.metadata,
				codeProcessing: "Applied code-specific processing",
			},
		}
	}
}

/**
 * Example stage for chat branch
 */
class ChatProcessingStage implements EnhancedPipelineStage {
	config: PipelineStageConfig = {
		id: "chat-processor",
		priority: 4,
		parallel: false,
		dependencies: ["branching-processor"],
	}

	async process(context: MessageContext): Promise<MessageContext> {
		return {
			...context,
			metadata: {
				...context.metadata,
				chatProcessing: "Applied chat-specific processing",
			},
		}
	}
}

/**
 * Example usage of the enhanced pipeline
 */
export async function runEnhancedPipelineExample(): Promise<void> {
	// Create processor
	const processor = new EnhancedMessageProcessor()

	// Add enhanced stages
	processor.addPipelineStage(new ParallelProcessingStage())
	processor.addPipelineStage(new ConditionalStage())
	processor.addPipelineStage(new BranchingStage())

	// Example context
	const context: MessageContext = {
		message:
			"Example message with more than 100 characters to trigger conditional processing. This shows how the enhanced pipeline handles parallel processing, conditions, and branching.",
		mode: "code",
		environment: {
			workingDirectory: "/example",
			visibleFiles: [],
			openTabs: [],
			activeTerminals: [],
			currentTime: new Date(),
			mode: "code",
		},
	}

	// Process message
	const result = await processor.process(context)

	// Log results
	console.log("Processing Result:", {
		success: result.success,
		content: result.content,
		metadata: result.metadata,
	})
}

/**
 * Example of how the pipeline executes:
 *
 * 1. ValidationStage (priority: 0)
 *    - Runs first
 *    - Validates input
 *
 * 2. ParallelProcessingStage (priority: 1)
 *    - Runs after validation
 *    - Executes heavy tasks in parallel
 *
 * 3. ConditionalStage (priority: 2)
 *    - Only runs for code mode + long messages
 *    - Applies special processing
 *
 * 4. BranchingStage (priority: 3)
 *    - Determines which branch to take
 *    - Routes to either CodeProcessingStage or ChatProcessingStage
 *
 * 5. Code/ChatProcessingStage (priority: 4)
 *    - Final stage in respective branch
 *    - Applies mode-specific processing
 */
