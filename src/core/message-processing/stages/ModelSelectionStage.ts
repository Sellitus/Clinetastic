import { ModelSelector, ModelRequirements } from "../../../services/model-selection"
import { MessageContext, PipelineStage } from "../types"

export function createModelSelectionStage(): PipelineStage {
	return new ModelSelectionStageImpl()
}

class ModelSelectionStageImpl implements PipelineStage {
	id = "model-selection"
	private modelSelector: ModelSelector

	constructor() {
		this.modelSelector = new ModelSelector()
	}

	async process(context: MessageContext): Promise<MessageContext> {
		// Skip if no API configuration
		if (!context.apiConfig) {
			return context
		}

		// Determine if we're executing changes based on tool usage
		const requirements: ModelRequirements = {
			isExecutingChanges: this.isExecutingChanges(context),
		}

		// Select optimal model based on requirements
		const { modelId, modelInfo } = this.modelSelector.selectModel(
			context.apiConfig.apiProvider!,
			context.apiConfig.apiModelId || "",
			context.modelInfo!,
			requirements,
		)

		// Update context with selected model
		return {
			...context,
			apiConfig: {
				...context.apiConfig,
				apiModelId: modelId,
			},
			modelInfo: modelInfo,
		}
	}

	private isExecutingChanges(context: MessageContext): boolean {
		// Check if we're using tools that modify files or execute commands
		const modifyingTools = ["write_to_file", "apply_diff", "execute_command", "browser_action"]

		if (context.toolExecution) {
			return modifyingTools.includes(context.toolExecution.toolName)
		}

		// Also check the message content for indicators of code changes
		const changeIndicators = [
			"write_to_file",
			"apply_diff",
			"execute_command",
			"browser_action",
			"<write_to_file>",
			"<apply_diff>",
			"<execute_command>",
			"<browser_action>",
		]

		return changeIndicators.some((indicator) => context.message.toLowerCase().includes(indicator.toLowerCase()))
	}
}
