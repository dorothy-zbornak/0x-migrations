'use strict'
const _ = require('lodash');
const assert = require('assert');
const {
    createEcosystemContract,
    deployTransformer,
    deployEcosystemContract,
    encodeGovernorCalls,
    enterSenderContext,
    verifyQueuedSources,
    SIMULATED,
    SEND_OPTS,
} = require('../../../util');

const ADDRESSES_BY_CHAIN = {
    '1': {
        exchangeProxyGovernor: '0x618f9c67ce7bf1a50afa1e7e0238422601b0ff6e',
        exchangeProxy: '0xdef1c0ded9bec7f1a1670819833240f027b25eff',
        weth: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    },
    '3': {
        exchangeProxyGovernor: '0x618f9c67ce7bf1a50afa1e7e0238422601b0ff6e',
        exchangeProxy: '0xdef1c0ded9bec7f1a1670819833240f027b25eff',
        weth: '0xc778417e063141139fce010982780140aa0cd5ab',
    },
    '4': {
        exchangeProxyGovernor: '0x618f9c67ce7bf1a50afa1e7e0238422601b0ff6e',
        exchangeProxy: '0xdef1c0ded9bec7f1a1670819833240f027b25eff',
        weth: '0xc778417E063141139Fce010982780140Aa0cD5Ab'
    },
    '42': {
        exchangeProxyGovernor: '0x618f9c67ce7bf1a50afa1e7e0238422601b0ff6e',
        exchangeProxy: '0xdef1c0ded9bec7f1a1670819833240f027b25eff',
        weth: '0xd0A1E359811322d97991E03f863a0C30C2cF029C'
    },
};

(async () => {
    await enterSenderContext(async ({chainId}) => {
        const chainAddresses = ADDRESSES_BY_CHAIN[chainId];
        const governor = createEcosystemContract(
            'multisig/ZeroExGovernor',
            chainAddresses.exchangeProxyGovernor,
        );
        const zeroEx = createEcosystemContract(
            'zero-ex/IZeroEx',
            chainAddresses.exchangeProxy,
        );

        // Get the allowance target.
        const allowanceTargetAddress = await zeroEx.getAllowanceTarget().call();
        // Get the transformer deployer.
        const transformerDeployerAddress = await zeroEx.getTransformerDeployer().call();
        // Get the flash wallet address.
        const flashWalletAddress = await zeroEx.getTransformWallet().call();

        // Deploy the LiquidityProviderFeature feature.
        const { contract: liquidityProviderFeature } = await deployEcosystemContract(
            'zero-ex/LiquidityProviderFeature',
            zeroEx.address,
        );
        // Deploy the TransformERC20 feature.
        const { contract: transformERC20Feature } = await deployEcosystemContract(
            'zero-ex/TransformERC20Feature',
        );
        // Deploy the UniswapFeature feature.
        const { contract: uniswapFeature } = await deployEcosystemContract(
            'zero-ex/UniswapFeature',
            chainAddresses.weth,
            allowanceTargetAddress,
        );

        // Create the governor call.
        const governorCallData = encodeGovernorCalls([
            // Migrate LiquidityProviderFeature
            {
                to: zeroEx.address,
                value: 0,
                data: await zeroEx
                    .migrate(
                        liquidityProviderFeature.address,
                        await liquidityProviderFeature
                            .migrate()
                            .encode(),
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
                            .migrate(transformerDeployerAddress)
                            .encode(),
                        governor.address,
                    ).encode(),
            },
            // Migrate UniswapFeature
            {
                to: zeroEx.address,
                value: 0,
                data: await zeroEx
                    .migrate(
                        uniswapFeature.address,
                        await uniswapFeature
                            .migrate()
                            .encode(),
                        governor.address,
                    ).encode(),
            },
        ]);
        console.info(`governor migrate calldata: ${governorCallData.bold.green}`);

        if (SIMULATED) {
            // Get the governor authorities.
            const authorities = await governor.getOwners().call();
            // Migrate using unlocked accounts.
            const callOpts = { ...SEND_OPTS, from: authorities[0], key: undefined };
            const submitCall = governor.submitTransaction(governor.address, 0, governorCallData);
            const txId = await submitCall.call(callOpts);
            await submitCall.send(callOpts);
            console.info(`submitted governor txId: ${txId}`);
            await governor.confirmTransaction(txId).send({ ...callOpts, from: authorities[1] });
            // Advance time to bypass timelock.
            const timeLock = await governor.secondsTimeLocked().call();
            await governor.eth.rpc._send('evm_increaseTime', [ timeLock ]);
            const r = await governor.executeTransaction(txId).send(callOpts);
            // Ensure migrations were successful.
            const migratedEvents = r.events.filter(e => e.name === 'Migrated');
            assert(migratedEvents.length == 3);
            console.info(`☑ Successful migration`.bold.green);
            await require('./check')({ governor, zeroEx, flashWalletAddress });
        }
    });
    await verifyQueuedSources();
})();
