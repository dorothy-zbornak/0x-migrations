'use strict'
require('colors');
const crypto = require('crypto');
const FlexEther = require('flex-ether');
const FlexContract = require('flex-contract');
const process = require('process');
const prompt = require('prompt');
const ethjs = require('ethereumjs-util');
const fetch = require('node-fetch');
const BigNumber = require('bignumber.js');
const { URLSearchParams } = require('url');
const AbiEncoder = require('web3-eth-abi');
const SECRETS = require('../secrets.json');

prompt.get = require('util').promisify(prompt.get);
prompt.message = '';
prompt.start();

const ADDRESSES_BY_CHAIN = require('../addresses.json');
const ETH = new FlexEther({ providerURI: process.env.NODE_RPC, network: process.env.NETWORK });
const GAS_PRICE = new BigNumber('1e9').times(process.env.GAS_PRICE || SECRETS.gasPrice || 1).toString(10);
const GAS_LIMIT = process.env.GAS_LIMIT || SECRETS.gasLimit;
const SEND_OPTS = { key: SECRETS.senderKey, gasPrice: GAS_PRICE, gas: SECRETS.gasLimit };
const { NETWORK, SIMULATED } = process.env;
const VERIFY_QUEUE = [];
const NULL_ADDRESS = ethjs.bufferToHex(Buffer.alloc(20));
const RANDOM_ADDRESS = ethjs.bufferToHex(crypto.randomBytes(20));
const SENDER = ethjs.toChecksumAddress(
    ethjs.bufferToHex(
        ethjs.privateToAddress(
            ethjs.toBuffer(SECRETS.senderKey),
        ),
    ),
);

async function deployEcosystemContract(name, ...cargs) {
    const contract = createEcosystemContract(name);
    const { contractAddress: address } = await contract.new(...cargs).send(SEND_OPTS);
    addToVerifyQueue(name, address, cargs);
    console.log(`Deployed contract ${name.green}: ${address.bold}`);
    return { address, contract, cargs };
}

async function deployTransformer(deployer, transformerName, ...cargs) {
    const deployData = await createEcosystemContract(`zero-ex/${transformerName}`)
        .new(...cargs).encode();
    const receipt = await deployer.deploy(deployData).send(SEND_OPTS);
    const deployedAddress = receipt.findEvent('Deployed').args.deployedAddress;
    console.log(`Deployed transformer ${transformerName.green}: ${deployedAddress.bold}`);
    addToVerifyQueue(`zero-ex/${transformerName}`, deployedAddress, cargs);
    return deployedAddress;
}

function createEcosystemContract(name, address) {
    const artifact = getEcosystemArtifact(name);
    return new FlexContract(
        artifact.compilerOutput.abi,
        {
            address,
            bytecode: artifact.compilerOutput.evm.bytecode.object,
            eth: ETH,
            key: SECRETS.senderKey,
        },
    );
}

function getEcosystemArtifact(name) {
    const [, pkg, artifact] = /^(.+?)\/(.+)$/.exec(name);
    return require(`@0x/contracts-${pkg}/test/generated-artifacts/${artifact}.json`);
}

function getEcosystemInputArtifact(name) {
    const [, pkg, artifact] = /^(.+?)\/(.+)$/.exec(name);
    return require(`@0x/contracts-${pkg}/test/generated-artifacts/${artifact}.input.json`);
}

async function wait(ms) {
    return new Promise((accept, reject) => {
        setTimeout(() => accept(), ms);
    });
}

function encodeGovernorCalls(calls) {
    return AbiEncoder.encodeParameters(
        ['bytes[]', 'address[]', 'uint256[]'],
        [
            calls.map(c => c.data),
            calls.map(c => c.to),
            calls.map(c => c.value),
        ],
    );
}

async function verifySource(name, address, cargs=[]) {
    const contract = createEcosystemContract(name);
    const compilerInput = getEcosystemInputArtifact(name);
    const artifact = getEcosystemArtifact(name);
    const apiNetworkPrefix = (!NETWORK || ['main', 'mainnet'].includes(NETWORK)) ? 'api' : `api-${NETWORK}`;
    const params = new URLSearchParams();
    const cargData = (await contract.new(...cargs).encode()).slice(contract.bytecode.length);
    params.set('apikey', SECRETS.etherscanKey);
    params.set('module', 'contract');
    params.set('action', 'verifysourcecode');
    params.set('contractaddress', address);
    params.set('sourceCode', JSON.stringify({
        ...compilerInput,
        settings: {
            ...compilerInput.settings,
            version: undefined,
        },
    }));
    params.set('codeformat', 'solidity-standard-json-input');
    params.set('contractname', findContractPathSpec(compilerInput.sources, artifact.contractName));
    if (cargData.length) {
        params.set('constructorArguements', cargData);
    }
    params.set('compilerversion', `v${compilerInput.settings.version}`);
    params.set('licenseType', 12);
    console.log(`Verifying source code for ${name.bold} on ${NETWORK || 'mainnet'} at ${address.green.bold}...`);
    const r = await fetch(
        `https://${apiNetworkPrefix}.etherscan.io/api`,
        {
            method: 'POST',
            body: params,
        },
    );
    const result = await r.json();
    if (result.status != '1') {
        throw new Error(`Verification failed: ${result.message}: ${result.result}`);
    }
    console.log(`Successfully verified source code for ${name.bold} on ${NETWORK || 'mainnet'} at ${address.green.bold} (ref: ${result.result})!`);
}

function findContractPathSpec(inputSources, name) {
    for (const file of Object.keys(inputSources)) {
        if (file.endsWith(`/${name}.sol`)) {
            return `${file}:${name}`;
        }
    }
}

function addToVerifyQueue(name, address, cargs) {
    VERIFY_QUEUE.push({ name, address, cargs });
}

async function verifyQueuedSources(delay = 60000) {
    if (SIMULATED) {
        return;
    }
    if (delay) {
        await wait(delay);
    }
    for (const q of VERIFY_QUEUE) {
        await verifySource(q.name, q.address, q.cargs);
        if (q !== VERIFY_QUEUE[VERIFY_QUEUE.length - 1]) {
            await wait(10000);
        }
    }
    VERIFY_QUEUE.splice(0, VERIFY_QUEUE.length);
}

async function enterSenderContext(cb) {
    const { answer } = await prompt.get({
        name: 'answer',
        message: `This will execute the migration from the deployer ${SENDER.bold} on network ${(NETWORK || 'mainnet').bold}. Ready? (y/n)`
    });
    if (!['y', 'yes'].includes(answer.toLowerCase())) {
        throw new Error('User did not confirm action');
    }

    if (SIMULATED) {
        await ETH.transfer(SENDER, new BigNumber('10e18').toString(10));
    }
    const startingBalance = await ETH.getBalance(SENDER);
    const ctx = {
        chainId: await ETH.getChainId(),
        sender: SENDER,
    };
    await cb(ctx);
    const cost = new BigNumber(startingBalance).minus(await ETH.getBalance(SENDER));
    console.log(`total sender (${SENDER.gray}) cost:`, cost.div('1e18').toString(10).red);
    return cost;
}

module.exports = {
    SECRETS,
    SENDER,
    ETH,
    SEND_OPTS,
    NETWORK,
    SIMULATED,
    GAS_PRICE,
    NULL_ADDRESS,
    ADDRESSES_BY_CHAIN,
    verifySource,
    verifyQueuedSources,
    addToVerifyQueue,
    createEcosystemContract,
    getEcosystemArtifact,
    getEcosystemInputArtifact,
    wait,
    deployEcosystemContract,
    deployTransformer,
    encodeGovernorCalls,
    enterSenderContext,
};
