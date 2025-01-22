const path = require("path")

module.exports = {
	target: "node",
	mode: "development",
	entry: "./src/extension.ts",
	output: {
		path: path.resolve(__dirname, "dist"),
		filename: "extension.js",
		libraryTarget: "commonjs2",
	},
	externals: {
		vscode: "commonjs vscode",
	},
	resolve: {
		extensions: [".ts", ".js"],
		fallback: {
			path: false,
			fs: false,
			child_process: false,
			crypto: false,
			os: false,
			stream: false,
			util: false,
		},
	},
	module: {
		rules: [
			{
				test: /\.ts$/,
				exclude: /node_modules/,
				use: [
					{
						loader: "ts-loader",
					},
				],
			},
		],
	},
	ignoreWarnings: [
		{
			module: /puppeteer-chromium-resolver/,
		},
		{
			module: /yargs/,
		},
		{
			module: /yargs-parser/,
		},
	],
	devtool: "nosources-source-map",
}
