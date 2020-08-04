'use strict'
require('colors');
const FlexEther = require('flex-ether');
const FlexContract = require('flex-contract');
const process = require('process');
const ethjs = require('ethereumjs-util');
const fetch = require('node-fetch');
const BigNumber = require('bignumber.js');
const { URLSearchParams } = require('url');
const AbiEncoder = require('web3-eth-abi');

const SECRETS = require('../secrets.json');
const ETH = new FlexEther({ providerURI: process.env.NODE_RPC, network: process.env.NETWORK });
const GAS_PRICE = new BigNumber('1e9').times(process.env.GAS_PRICE || SECRETS.gasPrice || 1).toString(10);
const SEND_OPTS = { key: SECRETS.senderKey, gasPrice: GAS_PRICE, gas: SECRETS.gasLimit };
const { NETWORK, SIMULATED } = process.env;
const VERIFY_QUEUE = [];
const NULL_ADDRESS = ethjs.bufferToHex(Buffer.alloc(32));
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
    return { address, contract, cargs };
}

async function deployTransformer(deployer, transformerName, ...cargs) {
    const deployData = await createEcosystemContract(`zero-ex/${transformerName}`)
        .new(...cargs).encode();
    const receipt = await deployer.deploy(deployData).send(SEND_OPTS);
    const deployedAddress = receipt.findEvent('Deployed').args.deployedAddress;
    console.log(`Deployed transformer ${transformerName}: ${deployedAddress.bold}`);
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
    const apiNetworkPrefix = (!NETWORK || NETWORK === 'main') ? 'api' : `api-${NETWORK}`;
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
    await wait(10000);
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

async function verifyQueuedSources() {
    for (const q of VERIFY_QUEUE) {
        await verifySource(q.name, q.address, q.cargs);
    }
    VERIFY_QUEUE.splice(0, VERIFY_QUEUE.length);
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
};
