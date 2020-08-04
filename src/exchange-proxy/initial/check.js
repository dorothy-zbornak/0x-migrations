'use strict'
require('colors');
const assert = require('assert');
const { createEcosystemContract, SECRETS } = require('../../util');
const _ = require('lodash');
const { argv } = require('process');

const [, , ZERO_EX, GOVERNOR] = argv;

(async () => {
    const zeroEx = createEcosystemContract('zero-ex/ZeroEx', ZERO_EX);
    const ownable = createEcosystemContract('zero-ex/Ownable', ZERO_EX);
    const spender = createEcosystemContract('zero-ex/TokenSpender', ZERO_EX);
    const transformERC20 = createEcosystemContract('zero-ex/TransformERC20', ZERO_EX);

    const owner = await ownable.owner().call();
    console.log(`owner is ${owner}`);
    assert(owner === GOVERNOR);

    const allowanceTarget = createEcosystemContract(
        'zero-ex/AllowanceTarget',
        await spender.getAllowanceTarget().call(),
    );
    const allowanceTargetOwner = await allowanceTarget.owner().call();
    console.log(`allowance target owner is ${allowanceTargetOwner}`);
    assert(allowanceTargetOwner === GOVERNOR);
    const allowanceTargetAuthorities = await allowanceTarget.getAuthorizedAddresses().call();
    console.log(`allowance target authorities are ${allowanceTargetAuthorities}`);
    assert(isSameAddressSet(allowanceTargetAuthorities, [zeroEx.address]));

    const transformerDeployer = createEcosystemContract(
        'zero-ex/TransformerDeployer',
        await transformERC20.getTransformerDeployer().call(),
    );
    const transformerDeployerOwner = await transformerDeployer.owner().call();
    console.log(`transformer deployer owner is ${transformerDeployerOwner}`);
    assert(transformerDeployerOwner === GOVERNOR);

    const transformerDeployerAuthorities =
        await transformerDeployer.getAuthorizedAddresses().call();
    console.log(`transformer deployer authorities are ${transformerDeployerAuthorities}`);
    assert(isSameAddressSet(
        transformerDeployerAuthorities,
        SECRETS.transformerDeployerAuthorities,
    ));

    const governorSigners = await createEcosystemContract(
        'multisig/ZeroExGovernor',
        GOVERNOR,
    ).getOwners().call();
    console.log(`governor signers are ${governorSigners}`);
    assert(isSameAddressSet(
        governorSigners, SECRETS.governorSigners,
    ));
})();

function isSameAddressSet(a, b) {
    return _.difference(
        a.map(a => a.toLowerCase()),
        b.map(a => a.toLowerCase()),
    ).length == 0;
}
