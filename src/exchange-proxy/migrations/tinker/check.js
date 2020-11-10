'use strict'
const assert = require('assert');

module.exports = async ({ governor, zeroEx, flashWalletAddress }) => {
    // Ensure owner of the exchange proxy is still the governor.
    const owner = await zeroEx.owner().call();
    assert.strictEqual(owner.toLowerCase(), governor.address.toLowerCase());
    console.log('☑ Owner is still governor'.bold.green);
    // Ensure the flashwallet has not changed.
    assert.strictEqual((await zeroEx.getTransformWallet().call()).toLowerCase(), flashWalletAddress.toLowerCase());
    console.log('☑ Flashwallet has not changed'.bold.green);
};
