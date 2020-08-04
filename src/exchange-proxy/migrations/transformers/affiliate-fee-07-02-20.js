'use strict'
const assert = require('assert');
const BigNumber = require('bignumber.js');
const _ = require('lodash');
const {
    createEcosystemContract,
    encodeGovernorCalls,
    deployTransformer,
    ETH,
    NULL_ADDRESS,
    SECRETS,
    SENDER,
    SEND_OPTS,
} = require('../../../util');

(async () => {
    const startingBalance = await ETH.getBalance(SENDER);
    const deployer = createEcosystemContract(
        'zero-ex/TransformerDeployer',
        SECRETS.exchangeProxyTransformerDeployer,
    );
    const deployedAddress = await deployTransformer(
        deployer,
        'AffiliateFeeTransformer',
    );
    console.log(`deployed at ${deployedAddress.green.bold}`);
    console.log('cost:', new BigNumber(startingBalance).minus(await ETH.getBalance(SENDER)).div('1e18').toString(10).red);
})();
