import {
	ModelInfo,
	ApiProvider,
	anthropicModels,
	anthropicDefaultModelId,
	bedrockModels,
	bedrockDefaultModelId,
	glamaDefaultModelId,
	glamaDefaultModelInfo,
	openRouterDefaultModelId,
	openRouterDefaultModelInfo,
	vertexModels,
	vertexDefaultModelId,
	geminiModels,
	geminiDefaultModelId,
	openAiNativeModels,
	openAiNativeDefaultModelId,
	deepSeekModels,
	deepSeekDefaultModelId,
	mistralModels,
	mistralDefaultModelId,
} from "../../shared/api"
import * as vscode from "vscode"

export interface ModelRequirements {
	isExecutingChanges: boolean // true if making code changes, false if planning/analyzing
}

export class ModelSelector {
	private getDefaultModelId(provider: ApiProvider, currentModelId: string): string {
		switch (provider) {
			case "anthropic":
				return anthropicDefaultModelId
			case "bedrock":
				return bedrockDefaultModelId
			case "glama":
				return glamaDefaultModelId
			case "openrouter":
				return openRouterDefaultModelId
			case "vertex":
				return vertexDefaultModelId
			case "gemini":
				return geminiDefaultModelId
			case "openai-native":
				return openAiNativeDefaultModelId
			case "deepseek":
				return deepSeekDefaultModelId
			case "mistral":
				return mistralDefaultModelId
			default:
				return currentModelId
		}
	}

	private getModelInfo(provider: ApiProvider, modelId: string): ModelInfo | undefined {
		switch (provider) {
			case "anthropic":
				return anthropicModels[modelId as keyof typeof anthropicModels]
			case "bedrock":
				return bedrockModels[modelId as keyof typeof bedrockModels]
			case "glama":
				return glamaDefaultModelInfo
			case "openrouter":
				return openRouterDefaultModelInfo
			case "vertex":
				return vertexModels[modelId as keyof typeof vertexModels]
			case "gemini":
				return geminiModels[modelId as keyof typeof geminiModels]
			case "openai-native":
				return openAiNativeModels[modelId as keyof typeof openAiNativeModels]
			case "deepseek":
				return deepSeekModels[modelId as keyof typeof deepSeekModels]
			case "mistral":
				return mistralModels[modelId as keyof typeof mistralModels]
			default:
				return undefined
		}
	}

	private getConfiguredModel(isExecuting: boolean): string | undefined {
		const config = vscode.workspace.getConfiguration("cline.modelSelection")
		const setting = isExecuting ? "executionModel" : "planningModel"
		return config.get<string>(setting)
	}

	public selectModel(
		provider: ApiProvider,
		currentModelId: string,
		currentModelInfo: ModelInfo,
		requirements: ModelRequirements,
	): { modelId: string; modelInfo: ModelInfo } {
		// Try to get configured model
		const configuredModel = this.getConfiguredModel(requirements.isExecutingChanges)

		// If configured model exists and we can find its info, use it
		if (configuredModel) {
			const modelInfo = this.getModelInfo(provider, configuredModel)
			if (modelInfo) {
				return { modelId: configuredModel, modelInfo }
			}
		}

		// Otherwise use provider's default model
		const defaultModelId = this.getDefaultModelId(provider, currentModelId)
		const defaultModelInfo = this.getModelInfo(provider, defaultModelId)

		// If we found default model info, use it
		if (defaultModelInfo) {
			return { modelId: defaultModelId, modelInfo: defaultModelInfo }
		}

		// Fallback to current model if everything else fails
		return { modelId: currentModelId, modelInfo: currentModelInfo }
	}
}
