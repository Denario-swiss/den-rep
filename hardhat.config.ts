import { HardhatUserConfig } from "hardhat/config"
import "@nomicfoundation/hardhat-toolbox"

import { node_url, accounts } from "./utils/network"

const config: HardhatUserConfig = {
	sourcify: {
		enabled: true,
	},

	solidity: {
		compilers: [
			{
				version: "0.8.27",
				settings: {
					optimizer: {
						enabled: true,
						runs: 2000,
					},
				},
			},
		],
	},

	typechain: {
		outDir: "typechain-types",
		target: "ethers-v6",
	},

	networks: {
		hardhat: {
			initialBaseFeePerGas: 0, // to fix : https://github.com/sc-forks/solidity-coverage/issues/652, see https://github.com/sc-forks/solidity-coverage/issues/652#issuecomment-896330136
		},
		polygonAmoy: {
			url: node_url("amoy"),
			accounts: accounts("amoy"),
			chainId: 80002,
		},
		sepolia: {
			url: node_url("sepolia"),
			accounts: accounts("sepolia"),
		},
		polygon: {
			url: node_url("polygon"),
			accounts: accounts("polygon"),
		},
	},

	etherscan: {
		apiKey: {
			sepolia: process.env.ETHERSCAN_API_KEY || "",
			polygonAmoy: process.env.POLYGONSCAN_API_KEY || "",
		},
		customChains: [
			{
				network: "polygonAmoy",
				chainId: 80002,
				urls: {
					apiURL: "https://api-amoy.polygonscan.com/api",
					browserURL: "https://amoy.polygonscan.com",
				},
			},
		],
	},

	paths: {
		sources: "src",
	},

	gasReporter: {
		currency: "USD",
		gasPrice: 100,
		enabled: process.env.REPORT_GAS ? true : false,
		coinmarketcap: process.env.COINMARKETCAP_API_KEY,
		maxMethodDiff: 10,
	},

	mocha: {
		timeout: 20000,
	},
}

export default config
