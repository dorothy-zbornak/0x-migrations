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
    SEND_OPTS,
    SIMULATED,
    verifyQueuedSources,
} = require('../../../util');

const GOVERNOR_AUTHORITIES = [
    '0x5ee2a00f8f01d099451844af7f894f26a57fcbf2',
    '0x257619b7155d247e43c8b6d90c8c17278ae481f0'
];

const ADDRESSES_BY_CHAIN = {
    '1': {
        governor: '0x618f9c67ce7bf1a50afa1e7e0238422601b0ff6e',
        exchangeProxy: '0xdef1c0ded9bec7f1a1670819833240f027b25eff',
        transformerDeployer: '0x39dce47a67ad34344eab877eae3ef1fa2a1d50bb',
        flashWallet: '0x22f9dcf4647084d6c31b2765f6910cd85c178c18',
    },
    '3': {
        governor: '0x618f9c67ce7bf1a50afa1e7e0238422601b0ff6e',
        exchangeProxy: '0xdef1c0ded9bec7f1a1670819833240f027b25eff',
        transformerDeployer: '0x1c9a27658dd303a31205a3b245e8993b92d4d502',
        flashWallet: '0x22f9dcf4647084d6c31b2765f6910cd85c178c18',
    },
    '4': {
        governor: '0x618f9c67ce7bf1a50afa1e7e0238422601b0ff6e',
        exchangeProxy: '0xdef1c0ded9bec7f1a1670819833240f027b25eff',
        transformerDeployer: '0x1c9a27658dd303a31205a3b245e8993b92d4d502',
        flashWallet: '0x22f9dcf4647084d6c31b2765f6910cd85c178c18',
    },
    '42': {
        governor: '0x618f9c67ce7bf1a50afa1e7e0238422601b0ff6e',
        exchangeProxy: '0xdef1c0ded9bec7f1a1670819833240f027b25eff',
        transformerDeployer: '0x1b62de2dbb5e7aa519e9c442721ecef75702807f',
        flashWallet: '0x22f9dcf4647084d6c31b2765f6910cd85c178c18',
    },
};

(async () => {
    await enterSenderContext(async ({chainId}) => {
        const chainAddresses = ADDRESSES_BY_CHAIN[chainId];
        // Deploy the SignatureValidator feature.
        const { contract: signatureValidatorFeature } = await deployEcosystemContract(
            'zero-ex/SignatureValidatorFeature',
        );
        // Deploy the TransformERC20 feature.
        const { contract: transformERC20Feature } = await deployEcosystemContract(
            'zero-ex/TransformERC20Feature',
        );
        const governor = createEcosystemContract(
            'multisig/ZeroExGovernor',
            chainAddresses.governor,
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
            const callOpts = { ...SEND_OPTS, from: GOVERNOR_AUTHORITIES[0], key: undefined };
            const submitCall = governor.submitTransaction(governor.address, 0, governorCallData);
            const txId = await submitCall.call(callOpts);
            await submitCall.send(callOpts);
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
