'use strict'
const assert = require('assert');
const BigNumber = require('bignumber.js');
const _ = require('lodash');
const {
    createEcosystemContract,
    deployEcosystemContract,
    encodeGovernorCalls,
    SENDER,
    ETH,
    SECRETS,
    SEND_OPTS,
    SIMULATED,
    verifyQueuedSources,
    wait,
} = require('../util');

(async () => {

    // Deploy the feature.
    const c = createEcosystemContract('zero-ex/TransformERC20', SECRETS.exchangeProxy);
    console.log(await c.getTransformWallet().call());
})();
