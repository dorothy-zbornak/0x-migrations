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
} = require('../../util');

(async () => {
    console.log(`Sender address: ${SENDER}`);
    if (SIMULATED) {
        await ETH.transfer(SENDER, new BigNumber('0.1e18').toString(10));
        for (const signer of SECRETS.governorSigners) {
            await ETH.transfer(signer, new BigNumber('0.1e18').toString(10));
        }
    }
    const senderInitialBalance = await ETH.getBalance(SENDER);

    // Deploy the feature.
    const { contract: feature } = await deployEcosystemContract('zero-ex/TransformERC20');
    console.log(`Deployed TransformERC20: ${feature.address.bold}`);

    const deployerFinalBalance = await ETH.getBalance(SENDER);
    const deploymentCost = new BigNumber(senderInitialBalance).minus(deployerFinalBalance);
    console.log(`cost: ${deploymentCost.div('1e18').toString(10).red.bold}`);

    const migrateCallData = await feature.migrate(
        SECRETS.exchangeProxyTransformerDeployer,
    ).encode();
    const governorCallData = encodeGovernorCalls([
        {
            to: SECRETS.exchangeProxy,
            value: 0,
            data: await createEcosystemContract('zero-ex/Ownable')
                .migrate(feature.address, migrateCallData, SECRETS.governor)
                .encode(),
        },
    ]);
    console.log(`Governor calldata: ${governorCallData}`);
    console.log(`Governor target: ${SECRETS.exchangeProxy}`);

    if (SIMULATED) {
        const governor = createEcosystemContract('multisig/ZeroExGovernor', SECRETS.governor)
        const signers = _.sampleSize(SECRETS.governorSigners, 2);
        const txId = await governor.submitTransaction(SECRETS.exchangeProxy, 0, governorCallData).call({ from: signers[0] });
        await governor.submitTransaction(SECRETS.exchangeProxy, 0, governorCallData).send({ from: signers[1] });
        await governor.confirmTransaction(txId).send({ from: signers[0] });
        const r = await governor.executeTransaction(txId).send({ from: signers[0] });
        assert(r.events.map(e => e.name).includes('Migrated'));
        console.log('☑ Successful migration'.bold.green);
        const owner = await createEcosystemContract('zero-ex/Ownable', SECRETS.exchangeProxy)
            .owner().call();
        assert(owner.toLowerCase() === SECRETS.governor.toLowerCase());
        console.log('☑ Owner is still governor'.bold.green);
    }

    await wait(30e3);
    await verifyQueuedSources();
})();
