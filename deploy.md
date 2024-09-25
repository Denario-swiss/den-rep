# Denario Silver Coin

## Deployment Instructions

See required parameters in the [.env.example](.env.example) file.
Create a `.env` file and set the required parameters.

The available networks are in the [hardhat.config.ts](hardhat.config.ts) file.

| Parameter                | Example                                | Description                                                              |
| ------------------------ | -------------------------------------- | ------------------------------------------------------------------------ |
| ETH*NODE_URI*`<network>` | https://matic-mumbai.chainstacklabs.co | HTTPS RPC endpoint of the network                                        |
| KEYS\_`<network>`        | <private_key_in_plaintext>             | account from which the transactions are exevuted                         |
| ETHERSCAN_API_KEY        | testapikey                             | API key for etherscan/polygonscan API key to verify deployed source code |

After setting required parameters, run the following command to deploy the contract to the network:

### Deploy:

If ./ignition/parameters/<network>/parameters.json is not present, create it by, using the example params file.

```bash
npx hardhat ignition deploy <module>  --parameters ignition/parameters/<network>/parameters.json --network <network>

```

### Verify deployed contract:

The chain id is the folder name from `./ignition/deployment/`

```bash
npx hardhat ignition verify <chain-id>
```

## AMOY Deployment Instructions

Make sure the .env file is populated with the required parameters:

```
ETH_NODE_URI_AMOY=
KEYS_AMOY=

TOKEN_NAME=
TOKEN_SYMBOL=

OWNER_ADDRESS=
MINTER_ADDRESS=
TREASURY_ADDRESS=
```

### Deploy the contract, proxy and verify

1. Deploy `make deploy-amoy`
2. Verify `make verify-amoy`

### Test upgrading the contract

3. Upgrade `make upgrade-amoy`
4. Verify `make verify-amoy`

<hr/>

If all of this works, you should be able to see the contract on Polygonscan and the url as well as the contract and proxy addresses will be shown in the console.
