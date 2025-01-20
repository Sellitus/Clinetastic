// Global teardown
export default async (): Promise<void> => {
	// Try garbage collection if available
	try {
		if (global.gc) {
			global.gc()
		}
	} catch (e) {
		// Ignore if gc is not available
	}

	// Allow event loop to clear
	await new Promise((resolve) => setTimeout(resolve, 100))

	// Force process exit after cleanup
	process.exit(0)
}
