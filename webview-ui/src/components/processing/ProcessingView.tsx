import React from "react"
import styled from "styled-components"
import { ResultMetadata } from "../../../../src/core/message-processing/types"

interface ProcessingViewProps {
	metadata?: ResultMetadata
}

const ProcessingView: React.FC<ProcessingViewProps> = ({ metadata }) => {
	if (!metadata) return null

	return (
		<Container>
			<Section>
				<Title>Timing</Title>
				<MetricRow>
					<Label>Total Time:</Label>
					<Value>{metadata.timing.totalTime}ms</Value>
				</MetricRow>
				<MetricRow>
					<Label>Execution Time:</Label>
					<Value>{metadata.timing.executionTime}ms</Value>
				</MetricRow>
				<MetricRow>
					<Label>Init Time:</Label>
					<Value>{metadata.timing.initTime}ms</Value>
				</MetricRow>
				<MetricRow>
					<Label>Cleanup Time:</Label>
					<Value>{metadata.timing.cleanupTime}ms</Value>
				</MetricRow>
			</Section>

			<Section>
				<Title>Resources</Title>
				<SubSection>
					<SubTitle>Memory</SubTitle>
					<MetricRow>
						<Label>Peak Usage:</Label>
						<Value>{formatBytes(metadata.resources.memory.peakUsage)}</Value>
					</MetricRow>
					<MetricRow>
						<Label>Average Usage:</Label>
						<Value>{formatBytes(metadata.resources.memory.averageUsage)}</Value>
					</MetricRow>
					<MetricRow>
						<Label>Allocated:</Label>
						<Value>{formatBytes(metadata.resources.memory.allocated)}</Value>
					</MetricRow>
				</SubSection>

				<SubSection>
					<SubTitle>CPU</SubTitle>
					<MetricRow>
						<Label>Peak Usage:</Label>
						<Value>{metadata.resources.cpu.peakUsage}μs</Value>
					</MetricRow>
					<MetricRow>
						<Label>User Time:</Label>
						<Value>{metadata.resources.cpu.userTime}μs</Value>
					</MetricRow>
					<MetricRow>
						<Label>System Time:</Label>
						<Value>{metadata.resources.cpu.systemTime}μs</Value>
					</MetricRow>
				</SubSection>

				<SubSection>
					<SubTitle>I/O</SubTitle>
					<MetricRow>
						<Label>Bytes Read:</Label>
						<Value>{formatBytes(metadata.resources.io?.bytesRead ?? 0)}</Value>
					</MetricRow>
					<MetricRow>
						<Label>Bytes Written:</Label>
						<Value>{formatBytes(metadata.resources.io?.bytesWritten ?? 0)}</Value>
					</MetricRow>
					<MetricRow>
						<Label>Read Operations:</Label>
						<Value>{metadata.resources.io?.readOps ?? 0}</Value>
					</MetricRow>
					<MetricRow>
						<Label>Write Operations:</Label>
						<Value>{metadata.resources.io?.writeOps ?? 0}</Value>
					</MetricRow>
				</SubSection>
			</Section>

			{((metadata.optimizationHints?.suggestions?.length ?? 0) > 0 ||
				(metadata.optimizationHints?.warnings?.length ?? 0) > 0 ||
				(metadata.optimizationHints?.cacheRecommendations?.length ?? 0) > 0) && (
				<Section>
					<Title>Optimization Hints</Title>
					{metadata.optimizationHints?.suggestions?.map((suggestion, index) => (
						<HintRow key={index}>{suggestion}</HintRow>
					))}
					{metadata.optimizationHints?.warnings?.map((warning, index) => (
						<WarningRow key={index}>{warning}</WarningRow>
					))}
					{metadata.optimizationHints?.cacheRecommendations?.map((recommendation, index) => (
						<HintRow key={index}>💾 {recommendation}</HintRow>
					))}
				</Section>
			)}
		</Container>
	)
}

const formatBytes = (bytes: number): string => {
	if (bytes === 0) return "0 B"
	const k = 1024
	const sizes = ["B", "KB", "MB", "GB"]
	const i = Math.floor(Math.log(bytes) / Math.log(k))
	return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

const Container = styled.div`
	padding: 10px;
	background-color: var(--vscode-editor-background);
	border: 1px solid var(--vscode-widget-border);
	border-radius: 4px;
	margin: 10px;
	font-family: var(--vscode-editor-font-family);
	font-size: 12px;
`

const Section = styled.div`
	margin-bottom: 15px;
`

const SubSection = styled.div`
	margin: 10px 0;
	padding-left: 10px;
`

const Title = styled.div`
	font-weight: bold;
	color: var(--vscode-editor-foreground);
	margin-bottom: 5px;
	font-size: 13px;
`

const SubTitle = styled.div`
	font-weight: bold;
	color: var(--vscode-editor-foreground);
	margin-bottom: 3px;
	font-size: 12px;
`

const MetricRow = styled.div`
	display: flex;
	justify-content: space-between;
	margin: 2px 0;
	padding: 2px 0;
`

const Label = styled.span`
	color: var(--vscode-editor-foreground);
	opacity: 0.8;
`

const Value = styled.span`
	color: var(--vscode-editor-foreground);
	font-family: var(--vscode-editor-font-family);
`

const HintRow = styled.div`
	color: var(--vscode-editorInfo-foreground);
	margin: 2px 0;
	padding: 2px 0;
`

const WarningRow = styled.div`
	color: var(--vscode-editorWarning-foreground);
	margin: 2px 0;
	padding: 2px 0;
`

export default ProcessingView
