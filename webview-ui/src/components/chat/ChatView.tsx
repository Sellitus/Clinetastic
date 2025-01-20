import { VSCodeButton } from "@vscode/webview-ui-toolkit/react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useEvent, useMount } from "react-use"
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso"
import styled from "styled-components"
import { ClineMessage, ExtensionMessage } from "../../../../src/shared/ExtensionMessage"
import { findLast } from "../../../../src/shared/array"
import { combineApiRequests } from "../../../../src/shared/combineApiRequests"
import { combineCommandSequences } from "../../../../src/shared/combineCommandSequences"
import { useExtensionState } from "../../context/ExtensionStateContext"
import { vscode } from "../../utils/vscode"
import HistoryPreview from "../history/HistoryPreview"
import { normalizeApiConfiguration } from "../settings/ApiOptions"
import Announcement from "./Announcement"
import ChatRow from "./ChatRow"
import ChatTextArea from "./ChatTextArea"
import TaskHeader from "./TaskHeader"
import AutoApproveMenu from "./AutoApproveMenu"
import { WebviewMessage } from "../../../../src/shared/WebviewMessage"

interface ChatViewProps {
	isHidden: boolean
	showAnnouncement: boolean
	hideAnnouncement: () => void
	showHistoryView: () => void
}

interface ApiMetrics {
	totalTokensIn: number
	totalTokensOut: number
	totalCacheWrites: number
	totalCacheReads: number
	totalCost: number
}

interface ProcessedMessages {
	modifiedMessages: ClineMessage[]
	apiMetrics: ApiMetrics
}

export const MAX_IMAGES_PER_MESSAGE = 20

const ChatView = ({ isHidden, showAnnouncement, hideAnnouncement, showHistoryView }: ChatViewProps) => {
	const { version, clineMessages: messages, taskHistory, apiConfiguration, mode, setMode } = useExtensionState()

	const task = useMemo(() => messages.at(0), [messages])

	const textAreaRef = useRef<HTMLTextAreaElement>(null)
	const virtuosoRef = useRef<VirtuosoHandle>(null)
	const scrollContainerRef = useRef<HTMLDivElement>(null)

	const [inputValue, setInputValue] = useState("")
	const [selectedImages, setSelectedImages] = useState<string[]>([])
	const [textAreaDisabled, setTextAreaDisabled] = useState(false)
	const [enableButtons, setEnableButtons] = useState(false)
	const [primaryButtonText] = useState<string>()
	const [secondaryButtonText] = useState<string>()
	const [claudeAsk, setClaudeAsk] = useState<string>()
	const [isAtBottom, setIsAtBottom] = useState(true)
	const [showScrollToBottom, setShowScrollToBottom] = useState(false)
	const [expandedRows, setExpandedRows] = useState<Record<number, boolean>>({})
	const [didScrollFromApiReqTs, setDidScrollFromApiReqTs] = useState<number>()
	const [isStreaming, setIsStreaming] = useState(false)
	const [didClickCancel, setDidClickCancel] = useState(false)
	const disableAutoScrollRef = useRef(false)

	const processedMessages = useMemo(() => {
		const combinedMessages = combineCommandSequences(messages)
		const result = combineApiRequests(combinedMessages)
		return {
			modifiedMessages: result,
			apiMetrics: {
				totalTokensIn: 0,
				totalTokensOut: 0,
				totalCacheWrites: 0,
				totalCacheReads: 0,
				totalCost: 0,
			},
		} as ProcessedMessages
	}, [messages])

	const { modifiedMessages, apiMetrics } = processedMessages

	const handleSendMessage = useCallback(
		(text: string, images: string[] = []) => {
			if (text.trim() === "" && images.length === 0) {
				return
			}

			const claudeAsk = findLast(messages, (m) => m.type === "ask")?.ask

			if (!task) {
				vscode.postMessage({
					type: "newTask",
					text,
					images,
				} satisfies WebviewMessage)
			} else if (claudeAsk) {
				switch (claudeAsk) {
					case "followup":
					case "tool":
					case "command":
					case "command_output":
					case "completion_result":
					case "resume_task":
					case "resume_completed_task":
					case "mistake_limit_reached":
						vscode.postMessage({
							type: "askResponse",
							askResponse: "messageResponse",
							text,
							images,
						} satisfies WebviewMessage)
						break
				}
				setInputValue("")
				setTextAreaDisabled(true)
				setSelectedImages([])
				setClaudeAsk(undefined)
				setEnableButtons(false)
			}
		},
		[messages, task],
	)

	const startNewTask = useCallback(() => {
		vscode.postMessage({ type: "clearTask" } satisfies WebviewMessage)
	}, [])

	const handlePrimaryButtonClick = useCallback(() => {
		switch (claudeAsk) {
			case "api_req_failed":
			case "command":
			case "command_output":
			case "tool":
			case "resume_task":
			case "mistake_limit_reached":
				vscode.postMessage({
					type: "askResponse",
					askResponse: "yesButtonClicked",
				} satisfies WebviewMessage)
				break
			case "completion_result":
			case "resume_completed_task":
				startNewTask()
				break
		}
		setTextAreaDisabled(true)
		setClaudeAsk(undefined)
		setEnableButtons(false)
	}, [claudeAsk, startNewTask])

	const handleSecondaryButtonClick = useCallback(() => {
		if (isStreaming) {
			vscode.postMessage({ type: "cancelTask" } satisfies WebviewMessage)
			setDidClickCancel(true)
			return
		}

		switch (claudeAsk) {
			case "api_req_failed":
			case "mistake_limit_reached":
				startNewTask()
				break
			case "command":
			case "tool":
				vscode.postMessage({
					type: "askResponse",
					askResponse: "noButtonClicked",
				} satisfies WebviewMessage)
				break
		}
		setTextAreaDisabled(true)
		setClaudeAsk(undefined)
		setEnableButtons(false)
	}, [claudeAsk, startNewTask, isStreaming])

	const handleTaskCloseButtonClick = useCallback(() => {
		startNewTask()
	}, [startNewTask])

	const { selectedModelInfo } = useMemo(() => {
		return normalizeApiConfiguration(apiConfiguration)
	}, [apiConfiguration])

	const selectImages = useCallback(() => {
		vscode.postMessage({ type: "selectImages" } satisfies WebviewMessage)
	}, [])

	const shouldDisableImages =
		!selectedModelInfo.supportsImages || textAreaDisabled || selectedImages.length >= MAX_IMAGES_PER_MESSAGE

	const handleMessage = useCallback(
		(e: MessageEvent<ExtensionMessage>) => {
			const message = e.data
			switch (message.type) {
				case "action":
					switch (message.action!) {
						case "didBecomeVisible":
							if (!isHidden && !textAreaDisabled && !enableButtons) {
								textAreaRef.current?.focus()
							}
							break
					}
					break
				case "selectedImages":
					const newImages = message.images ?? []
					if (newImages.length > 0) {
						setSelectedImages((prevImages) =>
							[...prevImages, ...newImages].slice(0, MAX_IMAGES_PER_MESSAGE),
						)
					}
					break
				case "invoke":
					switch (message.invoke!) {
						case "sendMessage":
							handleSendMessage(message.text ?? "", message.images ?? [])
							break
						case "primaryButtonClick":
							handlePrimaryButtonClick()
							break
						case "secondaryButtonClick":
							handleSecondaryButtonClick()
							break
					}
					break
				case "partialMessage":
					setIsStreaming(true)
					setDidClickCancel(false)
					break
				case "state":
					if (!message.partialMessage) {
						setIsStreaming(false)
					}
					break
			}
		},
		[
			isHidden,
			textAreaDisabled,
			enableButtons,
			handleSendMessage,
			handlePrimaryButtonClick,
			handleSecondaryButtonClick,
		],
	)

	useEvent("message", handleMessage)

	useMount(() => {
		textAreaRef.current?.focus()
	})

	useEffect(() => {
		const timer = setTimeout(() => {
			if (!isHidden && !textAreaDisabled && !enableButtons) {
				textAreaRef.current?.focus()
			}
		}, 50)
		return () => {
			clearTimeout(timer)
		}
	}, [isHidden, textAreaDisabled, enableButtons])

	const visibleMessages = useMemo(() => {
		return modifiedMessages.filter((message) => {
			switch (message.ask) {
				case "completion_result":
					if (message.text === "") {
						return false
					}
					break
				case "api_req_failed":
				case "resume_task":
				case "resume_completed_task":
					return false
			}
			switch (message.say) {
				case "api_req_finished":
				case "api_req_retried":
					return false
				case "text":
					if ((message.text ?? "") === "" && (message.images?.length ?? 0) === 0) {
						return false
					}
					break
				case "browser_action_result":
					return !!message.images
			}
			return true
		})
	}, [modifiedMessages])

	const toggleRowExpansion = useCallback(
		(ts: number) => {
			const isCollapsing = expandedRows[ts] ?? false
			const isLast = visibleMessages.at(-1)?.ts === ts
			const isSecondToLast = visibleMessages.at(-2)?.ts === ts
			const isLastCollapsed = !expandedRows[visibleMessages.at(-1)?.ts ?? 0]
			setExpandedRows((prev) => ({
				...prev,
				[ts]: !prev[ts],
			}))

			if (isCollapsing && isAtBottom) {
				const timer = setTimeout(() => {
					virtuosoRef.current?.scrollToIndex({
						index: visibleMessages.length - 1,
						align: "end",
					})
				}, 0)
				return () => clearTimeout(timer)
			} else if (isLast || isSecondToLast) {
				if (isCollapsing) {
					if (isSecondToLast && !isLastCollapsed) {
						return
					}
					const timer = setTimeout(() => {
						virtuosoRef.current?.scrollToIndex({
							index: visibleMessages.length - 1,
							align: "end",
						})
					}, 0)
					return () => clearTimeout(timer)
				} else {
					const timer = setTimeout(() => {
						virtuosoRef.current?.scrollToIndex({
							index: visibleMessages.length - (isLast ? 1 : 2),
							align: "start",
						})
					}, 0)
					return () => clearTimeout(timer)
				}
			}
		},
		[isAtBottom, visibleMessages, expandedRows],
	)

	useEffect(() => {
		const lastMessage = visibleMessages.at(-1)
		const isLastApiReqStarted = lastMessage?.say === "api_req_started"
		if (didScrollFromApiReqTs && isLastApiReqStarted && lastMessage?.ts === didScrollFromApiReqTs) {
			return
		}

		const timer = setTimeout(() => {
			if (!disableAutoScrollRef.current) {
				virtuosoRef.current?.scrollTo({ top: Number.MAX_SAFE_INTEGER, behavior: "smooth" })
			}
			setDidScrollFromApiReqTs(isLastApiReqStarted ? lastMessage?.ts : undefined)
		}, 50)

		return () => clearTimeout(timer)
	}, [visibleMessages, didScrollFromApiReqTs])

	const placeholderText = useMemo(() => {
		const text = task ? "Type a message (@ to add context)..." : "Type your task here (@ to add context)..."
		return text
	}, [task])

	const scrollToBottomSmooth = useCallback(() => {
		virtuosoRef.current?.scrollTo({ top: Number.MAX_SAFE_INTEGER, behavior: "smooth" })
	}, [])

	const scrollToBottomAuto = useCallback(() => {
		virtuosoRef.current?.scrollTo({ top: Number.MAX_SAFE_INTEGER, behavior: "auto" })
	}, [])

	return (
		<div
			style={{
				position: "fixed",
				top: 0,
				left: 0,
				right: 0,
				bottom: 0,
				display: isHidden ? "none" : "flex",
				flexDirection: "column",
				overflow: "hidden",
			}}>
			<AutoApproveMenu
				style={{
					marginBottom: -2,
					flex: "0 1 auto",
					minHeight: 0,
				}}
			/>
			<div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
				{task ? (
					<>
						<TaskHeader
							task={task}
							tokensIn={apiMetrics.totalTokensIn}
							tokensOut={apiMetrics.totalTokensOut}
							doesModelSupportPromptCache={selectedModelInfo.supportsPromptCache}
							cacheWrites={apiMetrics.totalCacheWrites}
							cacheReads={apiMetrics.totalCacheReads}
							totalCost={apiMetrics.totalCost}
							onClose={handleTaskCloseButtonClick}
						/>
						<div style={{ flexGrow: 1, display: "flex" }} ref={scrollContainerRef}>
							<Virtuoso
								ref={virtuosoRef}
								key={task.ts}
								className="scrollable"
								style={{
									flexGrow: 1,
									overflowY: "scroll",
								}}
								components={{
									Footer: () => <div style={{ height: 5 }} />,
								}}
								increaseViewportBy={{ top: 3_000, bottom: Number.MAX_SAFE_INTEGER }}
								data={visibleMessages}
								itemContent={(index: number, message: ClineMessage) => (
									<ChatRow
										key={message.ts}
										message={message}
										isExpanded={expandedRows[message.ts] || false}
										onToggleExpand={() => toggleRowExpansion(message.ts)}
										lastModifiedMessage={modifiedMessages.at(-1)}
										isLast={index === visibleMessages.length - 1}
										onHeightChange={(isTaller) => {
											if (isAtBottom && isTaller) {
												scrollToBottomAuto()
											}
										}}
										isStreaming={isStreaming}
									/>
								)}
								atBottomStateChange={(isAtBottom) => {
									setIsAtBottom(isAtBottom)
									if (isAtBottom) {
										disableAutoScrollRef.current = false
									}
									setShowScrollToBottom(disableAutoScrollRef.current && !isAtBottom)
								}}
								atBottomThreshold={10}
								initialTopMostItemIndex={visibleMessages.length - 1}
							/>
						</div>
						{showScrollToBottom ? (
							<div
								style={{
									display: "flex",
									padding: "10px 15px 0px 15px",
								}}>
								<ScrollToBottomButton
									onClick={() => {
										scrollToBottomSmooth()
										disableAutoScrollRef.current = false
									}}>
									<span className="codicon codicon-chevron-down" style={{ fontSize: "18px" }}></span>
								</ScrollToBottomButton>
							</div>
						) : (
							<div
								style={{
									opacity:
										primaryButtonText || secondaryButtonText || isStreaming
											? enableButtons || (isStreaming && !didClickCancel)
												? 1
												: 0.5
											: 0,
									display: "flex",
									padding: `${primaryButtonText || secondaryButtonText || isStreaming ? "10" : "0"}px 15px 0px 15px`,
								}}>
								{primaryButtonText && !isStreaming && (
									<VSCodeButton
										appearance="primary"
										disabled={!enableButtons}
										style={{
											flex: secondaryButtonText ? 1 : 2,
											marginRight: secondaryButtonText ? "6px" : "0",
										}}
										onClick={handlePrimaryButtonClick}>
										{primaryButtonText}
									</VSCodeButton>
								)}
								{(secondaryButtonText || isStreaming) && (
									<VSCodeButton
										appearance="secondary"
										disabled={!enableButtons && !(isStreaming && !didClickCancel)}
										style={{
											flex: isStreaming ? 2 : 1,
											marginLeft: isStreaming ? 0 : "6px",
										}}
										onClick={handleSecondaryButtonClick}>
										{isStreaming ? "Cancel" : secondaryButtonText}
									</VSCodeButton>
								)}
							</div>
						)}
					</>
				) : (
					<div
						style={{
							flex: "1 1 0",
							minHeight: 0,
							overflowY: "auto",
							display: "flex",
							flexDirection: "column",
							paddingBottom: "10px",
						}}>
						{showAnnouncement && <Announcement version={version} hideAnnouncement={hideAnnouncement} />}
						<div style={{ padding: "0 20px", flexShrink: 0 }}>
							<h2>What can I do for you?</h2>
							<p>
								Thanks to the latest breakthroughs in agentic coding capabilities, I can handle complex
								software development tasks step-by-step. With tools that let me create & edit files,
								explore complex projects, use the browser, and execute terminal commands (after you
								grant permission), I can assist you in ways that go beyond code completion or tech
								support. I can even use MCP to create new tools and extend my own capabilities.
							</p>
						</div>
						{taskHistory.length > 0 && <HistoryPreview showHistoryView={showHistoryView} />}
					</div>
				)}
			</div>
			<ChatTextArea
				ref={textAreaRef}
				inputValue={inputValue}
				setInputValue={setInputValue}
				textAreaDisabled={textAreaDisabled}
				placeholderText={placeholderText}
				selectedImages={selectedImages}
				setSelectedImages={setSelectedImages}
				onSend={() => handleSendMessage(inputValue, selectedImages)}
				onSelectImages={selectImages}
				shouldDisableImages={shouldDisableImages}
				onHeightChange={() => {
					if (isAtBottom) {
						scrollToBottomAuto()
					}
				}}
				mode={mode}
				setMode={setMode}
			/>
		</div>
	)
}

const ScrollToBottomButton = styled.div`
	background-color: color-mix(in srgb, var(--vscode-toolbar-hoverBackground) 55%, transparent);
	border-radius: 3px;
	overflow: hidden;
	cursor: pointer;
	display: flex;
	justify-content: center;
	align-items: center;
	flex: 1;
	height: 25px;

	&:hover {
		background-color: color-mix(in srgb, var(--vscode-toolbar-hoverBackground) 90%, transparent);
	}

	&:active {
		background-color: color-mix(in srgb, var(--vscode-toolbar-hoverBackground) 70%, transparent);
	}
`

export default ChatView
