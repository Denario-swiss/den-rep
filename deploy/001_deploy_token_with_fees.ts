import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DeployFunction } from 'hardhat-deploy/types'
import { config } from 'dotenv'
import { DSC } from '../typechain-types'
config()

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	const { deployments, getNamedAccounts, ethers } = hre
	const { deploy } = deployments

	const { deployer, proxy01Owner } = await getNamedAccounts()

	const deployResult = await deploy('DSC', {
		contract: 'DSC',
		from: deployer,
		log: true,
		autoMine: true, // speed up deployment on local network (ganache, hardhat), no effect on live networks
		proxy: {
			proxyContract: 'UUPS',
			execute: {
				init: {
					methodName: 'initialize',
					args: [],
				},
			},
		},
	})

	if (deployResult.newlyDeployed) {
		console.log(`DSC deployed at ${deployResult.address}`)
	}
}

export default func
func.tags = ['DSC']
