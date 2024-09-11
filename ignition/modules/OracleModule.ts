import { buildModule } from '@nomicfoundation/hardhat-ignition/modules';



export const OracleModule = buildModule('OracleModule', (builder) => {

  const oracle = builder.contract('MockOracle');


  return { oracle };
});

export default OracleModule;