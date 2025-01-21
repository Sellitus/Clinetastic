import { Anthropic } from "@anthropic-ai/sdk"
import { Stream as AnthropicStream } from "@anthropic-ai/sdk/streaming"
import {
	anthropicDefaultModelId,
	AnthropicModelId,
	anthropicModels,
	ApiHandlerOptions,
	ModelInfo,
} from "../../shared/api"
import { ApiHandler, SingleCompletionHandler } from "../index"
import { ApiStream } from "../transform/stream"

export class AnthropicHandler implements ApiHandler, SingleCompletionHandler {
	private options: ApiHandlerOptions
	private client: Anthropic

	constructor(options: ApiHandlerOptions) {
		this.options = options
		this.client = new Anthropic({
			apiKey: this.options.apiKey,
			baseURL: this.options.anthropicBaseUrl || undefined,
		})
	}

	/**
	 * Optimizes a message for caching by removing redundant whitespace and normalizing content
	 */
	private optimizeMessage(message: string): string {
		return message
			.trim()
			.replace(/\s+/g, " ") // Normalize whitespace
			.replace(/\n\s*\n/g, "\n") // Remove empty lines
			.replace(/[\u200B-\u200D\uFEFF]/g, "") // Remove zero-width spaces
			.replace(/\t/g, "    ") // Normalize tabs to spaces
			.replace(/\r\n/g, "\n") // Normalize line endings
	}

	/**
	 * Optimizes content for better cache efficiency by removing unnecessary variations
	 */
	private optimizeContent(
		content:
			| string
			| (
					| Anthropic.Messages.TextBlockParam
					| Anthropic.Messages.ImageBlockParam
					| Anthropic.Messages.ToolUseBlockParam
					| Anthropic.Messages.ToolResultBlockParam
			  )[],
	):
		| string
		| (
				| Anthropic.Messages.TextBlockParam
				| Anthropic.Messages.ImageBlockParam
				| Anthropic.Messages.ToolUseBlockParam
				| Anthropic.Messages.ToolResultBlockParam
		  )[] {
		if (typeof content === "string") {
			return this.optimizeMessage(content)
		}
		return content.map((block) => {
			if ("type" in block && block.type === "text" && "text" in block) {
				return {
					...block,
					text: this.optimizeMessage(block.text),
				}
			}
			return block
		})
	}

	/**
	 * Attempts to get/set content from local cache before making API calls
	 */
	/**
	 * Generates a cache key for a message
	 */
	private generateCacheKey(role: string, content: string): string {
		// Create a deterministic key based on role and content
		return `${role}-${content.slice(0, 100)}`
	}

	/**
	 * Determines appropriate cache control type based on content
	 */
	private getCacheControl(content: string, role: string): { type: "ephemeral" } | undefined {
		// Only use ephemeral caching for system prompts containing tools and user messages
		// This allows for efficient caching while working within API constraints
		if ((role === "system" && (content.includes("TOOL USE") || content.includes("# Tools"))) || role === "user") {
			return { type: "ephemeral" }
		}
		return undefined
	}

	async *createMessage(systemPrompt: string, messages: Anthropic.Messages.MessageParam[]): ApiStream {
		let stream: AnthropicStream<Anthropic.Beta.PromptCaching.Messages.RawPromptCachingBetaMessageStreamEvent>
		const modelId = this.getModel().id
		switch (modelId) {
			// 'latest' alias does not support cache_control
			case "claude-3-5-sonnet-20241022":
			case "claude-3-5-haiku-20241022":
			case "claude-3-opus-20240229":
			case "claude-3-haiku-20240307": {
				// Optimize messages for better cache efficiency
				const optimizedSystemPrompt = this.optimizeMessage(systemPrompt)
				const optimizedMessages = messages.map((msg) => ({
					...msg,
					content: this.optimizeContent(msg.content),
				}))

				// Get indices of user messages for context tracking
				const userMsgIndices = optimizedMessages.reduce(
					(acc, msg, index) => (msg.role === "user" ? [...acc, index] : acc),
					[] as number[],
				)
				const lastUserMsgIndex = userMsgIndices[userMsgIndices.length - 1] ?? -1
				const secondLastMsgUserIndex = userMsgIndices[userMsgIndices.length - 2] ?? -1
				// Prepare system message with optimized caching
				const systemMessage = {
					text: optimizedSystemPrompt,
					type: "text" as const,
					cache_control: this.getCacheControl(optimizedSystemPrompt, "system"),
				}

				stream = await this.client.beta.promptCaching.messages.create(
					{
						model: modelId,
						max_tokens: this.getModel().info.maxTokens || 8192,
						temperature: 0,
						system: [systemMessage],
						messages: optimizedMessages.map((message, index) => {
							// Determine if this message needs cache control based on index position
							const needsCacheControl = index === lastUserMsgIndex || index === secondLastMsgUserIndex

							if (needsCacheControl) {
								return {
									...message,
									content:
										typeof message.content === "string"
											? [
													{
														type: "text",
														text: message.content,
														cache_control: { type: "ephemeral" },
													},
												]
											: message.content.map((content, contentIndex) =>
													contentIndex === message.content.length - 1
														? { ...content, cache_control: { type: "ephemeral" } }
														: content,
												),
								}
							}
							return message
						}),
						// tools, // cache breakpoints go from tools > system > messages, and since tools dont change, we can just set the breakpoint at the end of system (this avoids having to set a breakpoint at the end of tools which by itself does not meet min requirements for haiku caching)
						// tool_choice: { type: "auto" },
						// tools: tools,
						stream: true,
					},
					(() => {
						// prompt caching: https://x.com/alexalbert__/status/1823751995901272068
						// https://github.com/anthropics/anthropic-sdk-typescript?tab=readme-ov-file#default-headers
						// https://github.com/anthropics/anthropic-sdk-typescript/commit/c920b77fc67bd839bfeb6716ceab9d7c9bbe7393
						switch (modelId) {
							case "claude-3-5-sonnet-20241022":
							case "claude-3-5-haiku-20241022":
							case "claude-3-opus-20240229":
							case "claude-3-haiku-20240307":
								return {
									headers: { "anthropic-beta": "prompt-caching-2024-07-31" },
								}
							default:
								return undefined
						}
					})(),
				)
				break
			}
			default: {
				stream = (await this.client.messages.create({
					model: modelId,
					max_tokens: this.getModel().info.maxTokens || 8192,
					temperature: 0,
					system: [{ text: systemPrompt, type: "text" }],
					messages,
					// tools,
					// tool_choice: { type: "auto" },
					stream: true,
				})) as any
				break
			}
		}

		for await (const chunk of stream) {
			switch (chunk.type) {
				case "message_start":
					// tells us cache reads/writes/input/output
					const usage = chunk.message.usage
					yield {
						type: "usage",
						inputTokens: usage.input_tokens || 0,
						outputTokens: usage.output_tokens || 0,
						cacheWriteTokens: usage.cache_creation_input_tokens || undefined,
						cacheReadTokens: usage.cache_read_input_tokens || undefined,
					}
					break
				case "message_delta":
					// tells us stop_reason, stop_sequence, and output tokens along the way and at the end of the message

					yield {
						type: "usage",
						inputTokens: 0,
						outputTokens: chunk.usage.output_tokens || 0,
					}
					break
				case "message_stop":
					// no usage data, just an indicator that the message is done
					break
				case "content_block_start":
					switch (chunk.content_block.type) {
						case "text":
							// we may receive multiple text blocks, in which case just insert a line break between them
							if (chunk.index > 0) {
								yield {
									type: "text",
									text: "\n",
								}
							}
							yield {
								type: "text",
								text: chunk.content_block.text,
							}
							break
					}
					break
				case "content_block_delta":
					switch (chunk.delta.type) {
						case "text_delta":
							yield {
								type: "text",
								text: chunk.delta.text,
							}
							break
					}
					break
				case "content_block_stop":
					break
			}
		}
	}

	getModel(): { id: AnthropicModelId; info: ModelInfo } {
		const modelId = this.options.apiModelId
		if (modelId && modelId in anthropicModels) {
			const id = modelId as AnthropicModelId
			return { id, info: anthropicModels[id] }
		}
		return { id: anthropicDefaultModelId, info: anthropicModels[anthropicDefaultModelId] }
	}

	async completePrompt(prompt: string): Promise<string> {
		try {
			const response = await this.client.messages.create({
				model: this.getModel().id,
				max_tokens: this.getModel().info.maxTokens || 8192,
				temperature: 0,
				messages: [{ role: "user", content: prompt }],
				stream: false,
			})

			const content = response.content[0]
			if (content.type === "text") {
				return content.text
			}
			return ""
		} catch (error) {
			if (error instanceof Error) {
				throw new Error(`Anthropic completion error: ${error.message}`)
			}
			throw error
		}
	}
}
