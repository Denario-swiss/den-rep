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

```bash
npx hardhat ignition deploy <module> --network <network>
```

### Verify deployed contract:

The chain id is the folder name from `./ignition/deployment/`

```bash
npx hardhat ignition verify <chain-id>
```
