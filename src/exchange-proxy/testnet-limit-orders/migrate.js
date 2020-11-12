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
    NULL_ADDRESS,
} = require('../../util');

const PROTOCOL_FEE_MULTIPLIER = 70e3;
const ADDRESSES = {
    owner: '0x2621ea417659Ad69bAE66af05ebE5788E533E5e7',
    weth: '0xc778417e063141139fce010982780140aa0cd5ab',
    staking: NULL_ADDRESS, // We won't ever finalize.
};

(async () => {
    await enterSenderContext(async ({chainId, sender, sendOpts}) => {
        assert.strictEqual(chainId, 3);

        const initialMigrator = await deployEcosystemContract(
            'zero-ex/InitialMigration',
            sender,
        );

        const zeroEx = await deployEcosystemContract(
            'zero-ex/ZeroEx',
            initialMigrator.address,
        );

        const features = {
            registry: await deployEcosystemContract(
                'zero-ex/SimpleFunctionRegistryFeature',
            ),
            ownable: await deployEcosystemContract(
                'zero-ex/OwnableFeature',
            ),
            tokenSpender: await deployEcosystemContract(
                'zero-ex/TokenSpenderFeature'
            ),
            limitOrders: await deployEcosystemContract(
                'zero-ex/LimitOrdersFeature',
                zeroEx.address,
                ADDRESSES.weth,
                ADDRESSES.staking, // No staking contract. We won't ever finalize.
                PROTOCOL_FEE_MULTIPLIER,
            ),
        };

        // Bootstrap the exchange proxy.
        console.info(`bootstrapping...`);
        await initialMigrator.initializeZeroEx(
            sender,
            zeroEx.address,
            {
                registry: features.registry.address,
                ownable: features.ownable.address,
            },
        ).send(sendOpts);

        // Deploy and configure the allowance target.
        console.info(`creating allowance target...`);
        const allowanceTarget = await deployEcosystemContract(
            'zero-ex/AllowanceTarget'
        );
        await allowanceTarget.addAuthorizedAddress(zeroEx.address).send(sendOpts);
        await allowanceTarget.transferOwnership(ADDRESSES.owner).send(sendOpts);

        // Deploy and configure the extra features.
        console.info(`migrating TokenSpender...`)
        await features.ownable.migrate(
            features.tokenSpender.address,
            await features.tokenSpender.migrate(allowanceTarget.address).encode(),
            sender,
        ).send({ ...sendOpts, to: zeroEx.address });

        console.info(`migrating LimitOrders...`)
        await features.ownable.migrate(
            features.limitOrders.address,
            await features.limitOrders.migrate().encode(),
            sender,
        ).send({ ...sendOpts, to: zeroEx.address });

        console.info(`tarnsferring ownership to ${ADDRESSES.owner}...`)
        await features.ownable.transferOwnership(ADDRESSES.owner).send({ ...sendOpts, to: zeroEx.address });
    });
    await verifyQueuedSources();
})();
