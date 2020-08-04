'use strict'
const assert = require('assert');
const BigNumber = require('bignumber.js');
const _ = require('lodash');
const {
    deployEcosystemContract,
    ETH,
    NULL_ADDRESS,
    SENDER,
    SEND_OPTS,
    SIMULATED,
    verifyQueuedSources,
    wait,
} = require('../util');

(async () => {
    const startingBalance = await ETH.getBalance(SENDER);
    const { address } = await deployEcosystemContract(
        'asset-proxy/CurveBridge'
    );
    console.log(`deployed at ${address.green.bold}`);
    console.log(
        'cost:',
        new BigNumber(startingBalance)
            .minus(await ETH.getBalance(SENDER))
            .div('1e18')
            .toString(10)
            .red,
    );
    if (!SIMULATED) {
        await wait(60e3);
        await verifyQueuedSources();
    }
})();
