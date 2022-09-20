const hre = require('hardhat');

// in seconds seconds
const HOUR = 60 * 60
const DAY = 24 * HOUR
gracePeriod = hre.ethers.utils.parseUnits('1000', 18)
maxSupply = hre.ethers.utils.parseUnits('10000', 18)

const main = async () => {
    console.log('compiling contracts');
    await hre.run('compile');
    console.log(`deploying on ${hre.network.name} network`);
    const DenarioERC20 = await hre.ethers.getContractFactory('ERC20TokenWithFees');
    const token = await DenarioERC20.deploy('SILVER', 'SILVER', 18, 1, DAY, "0xdf8E54852df54cFfe820214f2baCE7EC173f23C5");
    console.log(`Denario token deployed @ ${token.address}`);
};

main().then(() => {
    console.log('Deployment done');
    process.exit(0);
}).catch((e) => {
    console.log('Deployment error');
    console.error(e);
    process.exit(1);
});
