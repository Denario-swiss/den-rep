import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { config } from 'dotenv';
import { DSC } from '../typechain-types';
config()

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	const { deployments, getNamedAccounts, ethers } = hre;
	const { deploy } = deployments;

	const { deployer, proxy01Owner } = await getNamedAccounts();

	




	const deployResult = await deploy('DSC', {
		contract: 'DSC',
		from: deployer,
		log: true,
		autoMine: true, // speed up deployment on local network (ganache, hardhat), no effect on live networks
		proxy: {
			proxyContract: 'ERC1967Proxy',
			proxyArgs: ['{implementation}', '{data}'],
			execute: {
			  init: {
				methodName: 'initialize',
				args: [],
			  },
			},
		  },
	
	});

	if (deployResult.newlyDeployed) {
		console.log(
			`DSC deployed at ${deployResult.address}`
		);
	}

	if (process.env.DEPLOY_DATA_NEW_OWNER) {
		const erc20 = <DSC>await ethers.getContract('DSC')
		const signer = await ethers.getSigner(deployer);

		let tx = await erc20.connect(signer).transferOwnership(process.env.DEPLOY_DATA_NEW_OWNER)
		console.log(
			`Transferring ownership to ${process.env.DEPLOY_DATA_NEW_OWNER}, tx: ${tx.hash}....`
		);
		await tx.wait()

		console.log("New owner proposed, needs to be accepted.")
	}



};

export default func;
func.tags = ['DSC'];
