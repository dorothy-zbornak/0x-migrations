'use strict'
const _ = require('lodash');
const assert = require('assert');
const {
    addToVerifyQueue,
    createEcosystemContract,
    deployTransformer,
    deployEcosystemContract,
    encodeGovernorCalls,
    enterSenderContext,
    ETH,
    NULL_ADDRESS,
    SIMULATED,
    ADDRESSES_BY_CHAIN,
    verifyQueuedSources,
} = require('../../../util');

const GOVERNOR_AUTHORITIES = [
    '0x5ee2a00f8f01d099451844af7f894f26a57fcbf2',
    '0x257619b7155d247e43c8b6d90c8c17278ae481f0'
];

(async () => {
    await enterSenderContext(async ({chainId, sendOpts}) => {
        const chainAddresses = ADDRESSES_BY_CHAIN[chainId];
        // Deploy the SignatureValidator feature.
        const signatureValidatorFeature = await deployEcosystemContract(
            'zero-ex/SignatureValidatorFeature',
        );
        // Deploy the TransformERC20 feature.
        const transformERC20Feature = await deployEcosystemContract(
            'zero-ex/TransformERC20Feature',
        );
        const governor = createEcosystemContract(
            'multisig/ZeroExGovernor',
            chainAddresses.exchangeProxyGovernor,
        );
        const zeroEx = createEcosystemContract(
            'zero-ex/IZeroEx',
            chainAddresses.exchangeProxy,
        );
        // Create the governor call.
        const governorCallData = encodeGovernorCalls([
            // Migrate SignatureValidatorFeature
            {
                to: zeroEx.address,
                value: 0,
                data: await zeroEx
                    .migrate(
                        signatureValidatorFeature.address,
                        await signatureValidatorFeature.migrate().encode(),
                        governor.address,
                    ).encode(),
            },
            // Migrate TransformERC20Feature
            {
                to: zeroEx.address,
                value: 0,
                data: await zeroEx
                    .migrate(
                        transformERC20Feature.address,
                        await transformERC20Feature
                            .migrate(chainAddresses.transformerDeployer)
                            .encode(),
                        governor.address,
                    ).encode(),
            },
        ]);
        console.info(`governor migrate calldata: ${governorCallData.bold.green}`);
        if (SIMULATED) {
            // Migrate using unlocked accounts.
            const callOpts = { ...sendOpts, from: GOVERNOR_AUTHORITIES[0], key: undefined };
            const submitCall = governor.submitTransaction(governor.address, 0, governorCallData);
            const txId = await submitCall.call(callOpts);
            console.info(`submitted governor txId: ${txId}`);
            await governor.confirmTransaction(txId).send({ ...callOpts, from: GOVERNOR_AUTHORITIES[1] });
            const r = await governor.executeTransaction(txId).send(callOpts);
            // Ensure migrations were successful.
            const migratedEvents = r.events.filter(e => e.name === 'Migrated');
            assert(migratedEvents.length == 2);
            console.info(`☑ Successful migration`.bold.green);
            // Ensure owner of the exchange proxy is still the governor.
            const owner = await zeroEx.owner().call();
            assert(owner.toLowerCase() === governor.address.toLowerCase());
            console.log('☑ Owner is still governor'.bold.green);
            // Ensure the flashwallet has not changed.
            assert((await zeroEx.getTransformWallet().call()).toLowerCase() == chainAddresses.flashWallet);
            console.log('☑ Flashwallet has not changed'.bold.green);
        }
    });
    await verifyQueuedSources();

})();
