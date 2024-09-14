# Denario Silver Coin

Denario Silver Coin DSC is a reference token, which means that it is not a currency, but a reference to a physical asset. DSC is 100% backed by silver granule stored in an audited high-security custody in Switzerland.

- [x] All DSC in circulation are backed by 100% silver granules.
- [x] The amount of silver granules in the reserve is verified by an offline audit of the custodian's records by a third party auditor twice a year.
- [ ] The amount of silver granules in the reserve is verified by a proof of reserves oracle service.
- [x] DSC is deployed on Polygon
- [ ] DSC is listed on Uniswap V3

This repository contains the smart contracts that make up the Denario Silver Coin DSC for transparency. An initial audit has been conducted by Certik. Future audits will be conducted by other reputable auditors.

## Installation

Running `npm i` will install all 3rd party dependencies and generate types post install.

## Run Tests

- Run tests `npm run test`
- Show test coverage `npm run coverage`
- Show solhint result `npm run solhint`

## Deploy local

To deploy to a local network, you can use the Hardhat Network:
`npx hardhat node`

Then open another terminal session and deploy to the local Harhat Network:
`npm run deploy`
