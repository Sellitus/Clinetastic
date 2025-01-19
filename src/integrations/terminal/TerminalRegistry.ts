import * as vscode from "vscode"

export interface TerminalInfo {
	terminal: vscode.Terminal
	busy: boolean
	lastCommand: string
	id: number
	output?: string
	exitCode?: number
	startTime?: number
	endTime?: number
	cwd?: string
	env?: Record<string, string>
	processId?: number
}

export interface TerminalMetrics {
	avgExecutionTime: number
	successRate: number
	lastNExecutions: number[]
	totalCommands: number
	failedCommands: number
}

// Although vscode.window.terminals provides a list of all open terminals, there's no way to know whether they're busy or not (exitStatus does not provide useful information for most commands). In order to prevent creating too many terminals, we need to keep track of terminals through the life of the extension, as well as session specific terminals for the life of a task (to get latest unretrieved output).
// Since we have promises keeping track of terminal processes, we get the added benefit of keep track of busy terminals even after a task is closed.
export class TerminalRegistry {
	private static terminals: TerminalInfo[] = []
	private static nextTerminalId = 1
	private static terminalMetrics: Map<number, TerminalMetrics> = new Map()
	private static readonly MAX_HISTORY_SIZE = 10

	private static getTerminalMetrics(id: number): TerminalMetrics {
		if (!this.terminalMetrics.has(id)) {
			this.terminalMetrics.set(id, {
				avgExecutionTime: 0,
				successRate: 1,
				lastNExecutions: [],
				totalCommands: 0,
				failedCommands: 0,
			})
		}
		return this.terminalMetrics.get(id)!
	}

	private static updateTerminalMetrics(id: number, executionTime: number, success: boolean): void {
		const metrics = this.getTerminalMetrics(id)

		metrics.lastNExecutions.push(executionTime)
		if (metrics.lastNExecutions.length > this.MAX_HISTORY_SIZE) {
			metrics.lastNExecutions.shift()
		}

		metrics.avgExecutionTime = metrics.lastNExecutions.reduce((a, b) => a + b, 0) / metrics.lastNExecutions.length
		metrics.totalCommands++
		if (!success) {
			metrics.failedCommands++
		}
		metrics.successRate = (metrics.totalCommands - metrics.failedCommands) / metrics.totalCommands

		this.terminalMetrics.set(id, metrics)
	}

	static async createTerminal(cwd?: string | vscode.Uri | undefined): Promise<TerminalInfo> {
		const terminal = vscode.window.createTerminal({
			cwd,
			name: "Clinetastic",
			iconPath: new vscode.ThemeIcon("rocket"),
			env: {
				PAGER: "cat",
			},
		})

		// Wait for terminal to be ready and get processId
		const processId = await terminal.processId

		const newInfo: TerminalInfo = {
			terminal,
			busy: false,
			lastCommand: "",
			id: this.nextTerminalId++,
			startTime: Date.now(),
			cwd: typeof cwd === "string" ? cwd : cwd?.fsPath,
			env: { PAGER: "cat" },
			processId,
			output: "",
		}

		// Initialize metrics for new terminal
		this.getTerminalMetrics(newInfo.id)

		// Store terminal state
		this.terminals.push(newInfo)
		await this.persistTerminalState()

		return newInfo
	}

	private static async persistTerminalState(): Promise<void> {
		const state = this.terminals.map((terminal) => ({
			id: terminal.id,
			cwd: terminal.cwd,
			env: terminal.env,
			lastCommand: terminal.lastCommand,
			processId: terminal.processId,
			metrics: this.terminalMetrics.get(terminal.id),
		}))

		try {
			await vscode.workspace
				.getConfiguration("clinetastic")
				.update("terminalState", state, vscode.ConfigurationTarget.Global)
		} catch (error) {
			console.error("Failed to persist terminal state:", error)
		}
	}

	private static async restoreTerminalState(): Promise<void> {
		try {
			const state = vscode.workspace.getConfiguration("clinetastic").get("terminalState") as Array<{
				id: number
				cwd: string
				env: Record<string, string>
				lastCommand: string
				processId: number
				metrics: TerminalMetrics
			}>

			if (state) {
				// Restore metrics
				state.forEach((terminalState) => {
					if (terminalState.metrics) {
						this.terminalMetrics.set(terminalState.id, terminalState.metrics)
					}
				})

				// Update next terminal ID
				const maxId = Math.max(...state.map((s) => s.id), 0)
				this.nextTerminalId = maxId + 1
			}
		} catch (error) {
			console.error("Failed to restore terminal state:", error)
		}
	}

	static getTerminal(id: number): TerminalInfo | undefined {
		const terminalInfo = this.terminals.find((t) => t.id === id)
		if (terminalInfo && this.isTerminalClosed(terminalInfo.terminal)) {
			// Schedule async removal but don't wait for it
			void this.removeTerminal(id)
			return undefined
		}
		return terminalInfo
	}

	static async updateTerminal(id: number, updates: Partial<TerminalInfo>) {
		const terminal = this.getTerminal(id)
		if (terminal) {
			// Track command execution metrics if command is changing
			if (updates.lastCommand && updates.lastCommand !== terminal.lastCommand) {
				terminal.startTime = Date.now()
			}

			// Track command completion if busy state is changing from true to false
			if (terminal.busy && updates.busy === false && terminal.startTime) {
				const executionTime = Date.now() - terminal.startTime
				const success = updates.exitCode === 0
				this.updateTerminalMetrics(id, executionTime, success)
				terminal.endTime = Date.now()
			}

			Object.assign(terminal, updates)
			await this.persistTerminalState()
		}
	}

	static async removeTerminal(id: number) {
		const terminal = this.getTerminal(id)
		if (terminal) {
			// Store final metrics before removal
			const metrics = this.terminalMetrics.get(id)
			if (metrics) {
				try {
					await vscode.workspace
						.getConfiguration("clinetastic")
						.update(`terminalMetrics.${id}`, metrics, vscode.ConfigurationTarget.Global)
				} catch (error) {
					console.error(`Failed to save metrics for terminal ${id}:`, error)
				}
			}
		}

		this.terminals = this.terminals.filter((t) => t.id !== id)
		this.terminalMetrics.delete(id)
		await this.persistTerminalState()
	}

	static async getAllTerminals(): Promise<TerminalInfo[]> {
		// Get list of closed terminals before filtering
		const closedTerminals = this.terminals.filter((t) => this.isTerminalClosed(t.terminal))

		// Schedule cleanup of closed terminals in parallel
		await Promise.all(closedTerminals.map((t) => this.removeTerminal(t.id)))

		// Return remaining active terminals
		return this.terminals.filter((t) => !this.isTerminalClosed(t.terminal))
	}

	// The exit status of the terminal will be undefined while the terminal is active. (This value is set when onDidCloseTerminal is fired.)
	private static isTerminalClosed(terminal: vscode.Terminal): boolean {
		return terminal.exitStatus !== undefined
	}
}
