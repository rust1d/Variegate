// test/Variegate.test.js
const Variegate = artifacts.require('./Variegate.sol');
const VariegateRewards = artifacts.require('./VariegateRewards.sol');
const VariegateProject = artifacts.require('./VariegateProject.sol');

const { expectRevert } = require('@openzeppelin/test-helpers');
var chai = require('chai');
const assert = chai.assert;

const defaults = {
  totalSupply: 1_000_000_000,
  maxWallet: 15_000_000,
  maxSell: 5_000_000,
  swapThreshold: 5_000_000
};

function toWei(count) {
  return `${count}000000000000000000`;
}

contract('Variegate', function (accounts) {
  const [owner, holder1, holder2, holder3] = accounts;
  let project = owner;
  let rewards = owner;
  let contract;
  let transaction;
  let uniswapV2Pair;

  beforeEach('setup contract for each test', async function() {
    contract = await Variegate.new();
    rewards = await VariegateRewards.new();
    await rewards.transferOwnership(contract.address, { from: owner });
    await contract.setRewardsContract(rewards.address, { from: owner });
    uniswapV2Pair = await contract.uniswapV2Pair();
  });

  it('only admin can open contract to public', async function() {
    await expectRevert(contract.openToPublic({ from: holder2 }), 'Caller invalid');
    assert.isFalse(await contract.isOpenToPublic());
  });

  it('contract must have project and rewards contracts to open', async function() {
    await expectRevert(contract.openToPublic({ from: owner }), 'Configuration required');
  });

  it('contract must have bnb and tokens for initial liquidity', async function() {
    project = await VariegateProject.new();
    await contract.setProjectContract(project.address, { from: owner });
    await expectRevert(contract.openToPublic({ from: owner }), 'Must have bnb to pair for launch');
    await contract.send(toWei(10), { from: holder3 });
    await expectRevert(contract.openToPublic({ from: owner }), 'Must have tokens to pair for launch');
  });

  it('allow owner to open contract to public', async function() {
    project = await VariegateProject.new();
    await contract.setProjectContract(project.address, { from: owner });
    await contract.send(toWei(10), { from: holder3 });
    await contract.transfer(contract.address, toWei(defaults.totalSupply/2), { from: owner });
    await contract.openToPublic({ from: owner });
    assert.isTrue(await contract.isOpenToPublic());
  });
});

// test contracts not in rewards