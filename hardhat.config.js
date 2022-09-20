const fs = require('fs');
const path = require('path');
require('@nomiclabs/hardhat-ethers');
require('@nomiclabs/hardhat-etherscan');
require('@nomiclabs/hardhat-waffle');
require("@nomiclabs/hardhat-web3");
require('dotenv').config();


let privateKeys = (process.env.DEPLOYER_PRIVATE_KEY || '').split(',').filter((x) => x.length > 0);
const providerUrl = process.env.PROVIDER_URL || 'http://localhost:8545';
const network = process.env.NETWORK || 'development';


console.log("providerUrl", providerUrl)

console.log("network", network)

if (network === 'development' && privateKeys.length === 0) {
  if (fs.existsSync('./dev/ganache-accounts')) {
    privateKeys = fs.readFileSync('./dev/ganache-accounts', { encoding: 'utf8' }).split(',').map((k) => k.trim());
  }
}
console.log("privateKey", privateKeys)

if (privateKeys.length === 0) {
  console.log('DEPLOYER_PRIVATE_KEY must be provided in ENV');
  process.exit(1);
}

module.exports = {
  defaultNetwork: network,
  networks: {
    [network]: {
      url: providerUrl,
      accounts: privateKeys,
    },
  },
  solidity: {
    version: '0.8.3',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  paths: {
    sources: './contracts',
    tests: './test',
    cache: './cache',
    artifacts: './artifacts',
    migrated: './migrated',
  },

  mocha: {
    timeout: 20000,
  },
  gasPrice: {
    maxGasPrice: 300,
    maxPriorityFeePerGas: 2000,
  },
  etherscan: {
    apiKey: 'TB1E19M8R8ZRXZPU2IP4B9PY1DCHQXQW5H',
  },
};
