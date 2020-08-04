'use strict'
const process = require('process');
const BigNumber = require('bignumber.js');
const {
    createEcosystemContract,
    deployEcosystemContract,
    deployTransformer,
    SENDER,
    ETH,
    SECRETS,
    SEND_OPTS,
    SIMULATED,
    verifySource,
    verifyQueuedSources,
} = require('../../util');

(async () => {
    console.log(`Deployer address: ${SENDER}`);
    if (SIMULATED) {
        await ETH.transfer(SENDER, new BigNumber('1e18').toString(10));
    }
    const senderInitialBalance = await ETH.getBalance(SENDER);

    // Deploy the migrator.
    const { address: migratorAddress, contract: migrator } =
        await deployEcosystemContract(
            'zero-ex/FullMigration',
            SENDER,
        );
    console.log(`Deployed FullMigration: ${migratorAddress.bold}`);

    // Deploy the Exchange Proxy.
    const { address: zeroExAddress } = await deployEcosystemContract(
        'zero-ex/ZeroEx',
        SENDER,
    );
    console.log(`Deployed ZeroEx: ${zeroExAddress.bold.green}`);

    // Deploy the governor.
    const { address: governorAddress } = await deployEcosystemContract(
        'multisig/ZeroExGovernor',
        [], [], [], SECRETS.governorSigners, 2, 0,
    );
    console.log(`Deployed Governor: ${governorAddress.bold}`);

    // Deploy transformer deployer.
    const { contract: transformerDeployer } = await deployEcosystemContract(
        'zero-ex/TransformerDeployer',
        [...SECRETS.transformerDeployerAuthorities, SENDER],
    );
    console.log(`Deployed TransformerDeployer: ${transformerDeployer.address.bold}`);

    // Deploy features.
    const { address: registryFeatureAddress } =
        await deployEcosystemContract('zero-ex/SimpleFunctionRegistry');
    console.log(`Deployed SimpleFunctionRegistry: ${registryFeatureAddress.bold}`);
    const { address: ownableFeatureAddress } =
        await deployEcosystemContract('zero-ex/Ownable');
    console.log(`Deployed Ownable: ${ownableFeatureAddress.bold}`);
    const { address: tokenSpenderFeatureAddress } =
        await deployEcosystemContract('zero-ex/TokenSpender');
    console.log(`Deployed TokenSpender: ${tokenSpenderFeatureAddress.bold}`);
    const { address: transformERC20FeatureAddress } =
        await deployEcosystemContract('zero-ex/TransformERC20');
    console.log(`Deployed TransformERC20: ${transformERC20FeatureAddress.bold}`);
    const { address: signatureValidatorFeatureAddress } =
        await deployEcosystemContract('zero-ex/SignatureValidator');
    console.log(`Deployed SignatureValidator: ${signatureValidatorFeatureAddress.bold}`);
    const { address: metaTransactionsFeatureAddress } =
        await deployEcosystemContract('zero-ex/MetaTransactions', zeroExAddress);
    console.log(`Deployed MetaTransactions: ${metaTransactionsFeatureAddress.bold}`);

    // Bootstrap/migrate.
    await migrator.deploy(
        governorAddress,
        await migrator.getBootstrapper().call(),
        {
            registry: registryFeatureAddress,
            ownable: ownableFeatureAddress,
            tokenSpender: tokenSpenderFeatureAddress,
            transformERC20: transformERC20FeatureAddress,
            signatureValidator: signatureValidatorFeatureAddress,
            metaTransactions: metaTransactionsFeatureAddress,
        },
        { transformerDeployer: transformerDeployer.address },
    ).send(SEND_OPTS);

    const allowanceTargetAddress =
        await createEcosystemContract('zero-ex/ITokenSpender', zeroExAddress)
        .getAllowanceTarget().call();
    console.log(`AllowanceTarget: ${allowanceTargetAddress.bold}`);

    // Deploy transformers.
    await deployTransformer(transformerDeployer, 'WethTransformer', SECRETS.weth);
    await deployTransformer(transformerDeployer, 'PayTakerTransformer');
    await deployTransformer(transformerDeployer, 'FillQuoteTransformer', SECRETS.exchange);

    // Remove sender from TransformerDeployer authorities.
    await transformerDeployer.removeAuthorizedAddress(SENDER).send(SEND_OPTS);
    // Transfer deployer owner.
    await transformerDeployer.transferOwnership(governorAddress).send(SEND_OPTS);

    const deployerFinalBalance = await ETH.getBalance(SENDER);
    const deploymentCost = new BigNumber(senderInitialBalance).minus(deployerFinalBalance);
    console.log(`cost: ${deploymentCost.div('1e18').toString(10).red.bold}`);

    await verifySource('zero-ex/ZeroEx', zeroExAddress);
    await verifySource('zero-ex/AllowanceTarget', allowanceTargetAddress);
    await verifyQueuedSources();
})();
