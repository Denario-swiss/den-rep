See required parameters in the [.env.example](.env.example) file.
Create a `.env` file and set the required parameters.

The available networks are in the [hardhat.config.ts](hardhat.config.ts) file.

| Parameter                                   | Example                                   | Description                                                                               |
| ------------------------------------------- | ----------------------------------------- | ----------------------------------------------------------------------------------------- |
| ETH_NODE_URI_`<network>`                    | https://matic-mumbai.chainstacklabs.co    | HTTPS RPC endpoint of the blockchain                                                      |
| KEYS_`<network>`                            | <private_key_in_plaintext>                | account from which the transactions are exevuted                                          |
| DEPLOY_DATA_NAME                            | Denario                                   | token name                                                                                |
| DEPLOY_DATA_SYMBOL                          | DT                                        | token symbol                                                                              |
| DEPLOY_DATA_DECIMALS                        | 8                                         | token decimals                                                                            |
| DEPLOY_DATA_FEE_RATE                        | 1000000                               | fee percentage owed after 1 year, (100% = 100000000 = 1 with `decimals precision`)                                              |
| DEPLOY_DATA_MAX_FEE_RATE                    | 5000000                                      | fee rate is changeable, but cannot be greater than max fee rate                           |
| DEPLOY_DATA_MAX_DELAY_FEE_CHANGE            | 31536000                                  | minimal time interval between two fee changes in seconds ( 365 * 24 * 60 * 6     )        |
| DEPLOY_DATA_FEE_COLLECTION_TREASURY_ADDRESS | 0x000000000000000000000000000000000000000 | address where collected fees are sent, fee exempt by default                              |
| DEPLOY_DATA_MINTER_ADDRESS                  | 0x000000000000000000000000000000000000000 | address, who has minter role, he can mint and burn existing tokens, fee exempt by default |
| DEPLOY_DATA_NEW_OWNER                       | 0x000000000000000000000000000000000000000 | if set, ownership transfer will be initialised to this address                            |
| POLYGONSCAN_API_KEY                         | testapikey                                | API key for polygonscan to verify source code                                             |





After setting required parameters, run the following command to deploy the contract to the network:

```bash
npx hardhat deploy --tags ERC20WithFees --network <network>
```