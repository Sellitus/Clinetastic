const path = require("path")
const dotenv = require("dotenv")

// Load test environment variables
const testEnvPath = path.join(__dirname, ".test_env")
dotenv.config({ path: testEnvPath })

// Set default environment variables for tests if not already set
process.env.OPEN_ROUTER_API_KEY = process.env.OPEN_ROUTER_API_KEY || "sk-or-v1-test-key"
