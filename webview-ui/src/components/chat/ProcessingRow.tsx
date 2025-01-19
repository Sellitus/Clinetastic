import React from "react"
import styled from "styled-components"
import ProcessingView from "../processing/ProcessingView"
import { ClineMessage } from "../../../../src/shared/ExtensionMessage"

interface ProcessingRowProps {
	message: ClineMessage
	isExpanded: boolean
	onToggleExpand: () => void
}

const ProcessingRow: React.FC<ProcessingRowProps> = ({ message, isExpanded, onToggleExpand }) => {
	if (!message.metadata) return null

	return (
		<Container>
			<Header onClick={onToggleExpand}>
				<Title>Processing Details</Title>
				<span className={`codicon codicon-chevron-${isExpanded ? "up" : "down"}`}></span>
			</Header>
			{isExpanded && <ProcessingView metadata={message.metadata} />}
		</Container>
	)
}

const Container = styled.div`
	margin-top: 10px;
`

const Header = styled.div`
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 6px 10px;
	background-color: var(--vscode-editor-background);
	border: 1px solid var(--vscode-widget-border);
	border-radius: 4px;
	cursor: pointer;
	user-select: none;

	&:hover {
		background-color: var(--vscode-list-hoverBackground);
	}
`

const Title = styled.span`
	font-size: 12px;
	font-weight: bold;
	color: var(--vscode-editor-foreground);
`

export default ProcessingRow
