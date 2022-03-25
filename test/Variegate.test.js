// test/Variegate.test.js
const Variegate = artifacts.require('./Variegate.sol');
const VariegateRewards = artifacts.require('./VariegateRewards.sol');
const VariegateProject = artifacts.require('./VariegateProject.sol');

const { expectEvent, expectRevert } = require('@openzeppelin/test-helpers');

var chai = require('chai');

const expect = chai.expect;
const assert = chai.assert;

const ZERO = '0x0000000000000000000000000000000000000000';

const defaults = {
  totalSupply: 1_000_000_000,
  maxWallet: 15_000_000,
  maxSell: 5_000_000,
  swapThreshold: 5_000_000,
  minBalance: 500_000
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
  let newContract;

  beforeEach('setup contract for each test', async function() {
    contract = await Variegate.new();
    uniswapV2Pair = await contract.uniswapV2Pair();
  });

  it('initializes the correct values', async function () {
    assert.equal(await contract.name(), 'Variegate');
    assert.equal((await contract.symbol()), '$VARI');
    assert.equal((await contract.decimals()), 18);
  });

  it('sets the correct total supply upon deployment', async function () {
    assert.equal(await contract.totalSupply(), toWei(defaults.totalSupply));
  });

  it('anyone can send funds to contract', async function() {
    transaction = await contract.send(toWei(1), { from: holder3 });
    expectEvent(transaction, 'FundsReceived', { from: holder3, amount: toWei(1) });
  });

  it('has a threshold for swapping tokens to BSD', async function () {
    assert.equal(await contract.swapThreshold(), toWei(defaults.swapThreshold));
  });

  it('allows only owner to turn fees off for an account', async function () {
    await expectRevert(contract.setFeeless(holder1, true, { from: holder1 }), 'Caller invalid');
  });

  it('allows owner to turn fees on/off for an account', async function () {
    transaction = await contract.setFeeless(holder1, true, { from: owner });
    expectEvent(transaction, 'IsFeelessChanged', { account: holder1, excluded: true });
    assert.isTrue(await contract.isFeeless(holder1));
    transaction = await contract.setFeeless(holder1, false, { from: owner });
    expectEvent(transaction, 'IsFeelessChanged', { account: holder1, excluded: false });
    assert.isFalse(await contract.isFeeless(holder1));
  });

  it('requires the value of Feeless to change if updated', async function () {
    await expectRevert(contract.setFeeless(holder1, false, { from: owner }), "Value unchanged");
  });

  it('allows only owner to add presale wallets', async function () {
    await expectRevert(contract.setPresale(holder1, true, { from: holder1 }), 'Caller invalid');
  });

  it('allows owner to add/remove presale wallets', async function () {
    await contract.setPresale(holder1, true, { from: owner });
    assert.isTrue(await contract.isPresale(holder1));
    transaction = await contract.setPresale(holder1, false, { from: owner });
    assert.isFalse(await contract.isPresale(holder1));
  });

  it('allows only owner to change project contract', async function () {
    await expectRevert(contract.setProjectContract(holder1, { from: holder1 }), 'Caller invalid');
  });

  it('requires project contract to be set to a contract', async function () {
    await expectRevert(contract.setProjectContract(holder1, { from: project }), "Not a contract");
  });

  it('requires the token own project contract if updated', async function () {
    newContract = await VariegateProject.new();
    await expectRevert(contract.setProjectContract(newContract.address, { from: owner }), "Token must own project");
  });

  it('requires the value of project contract to change if updated', async function () {
    await expectRevert(contract.setProjectContract(owner, { from: owner }), "Value unchanged");
  });

  it('allows owner to set project contract', async function () {
    newContract = await VariegateProject.new();
    await newContract.transferOwnership(contract.address, { from: owner });
    transaction = await contract.setProjectContract(newContract.address, { from: owner });
    expectEvent(transaction, 'ProjectContractChanged', { from: owner, to: newContract.address });
    assert.equal(await contract.project(), newContract.address);
  });

  it('allows only owner to change rewards contract', async function () {
    await expectRevert(contract.setRewardsContract(holder1, { from: holder1 }), 'Caller invalid');
  });

  it('requires the value of rewards contract to change if updated', async function () {
    await expectRevert(contract.setRewardsContract(owner, { from: owner }), "Value unchanged");
  });

  it('requires rewards contract to be set to a contract', async function () {
    await expectRevert(contract.setRewardsContract(holder1, { from: owner }), "Not a contract");
  });

  it('requires the token own rewards contract if updated', async function () {
    newContract = await VariegateRewards.new();
    await expectRevert(contract.setRewardsContract(newContract.address, { from: owner }), "Token must own tracker");
  });

  it('allows owner to set rewards contract', async function () {
    newContract = await VariegateRewards.new();
    await newContract.transferOwnership(contract.address, { from: owner });
    transaction = await contract.setRewardsContract(newContract.address, { from: owner });
    expectEvent(transaction, 'RewardsContractChanged', { from: owner, to: newContract.address });
    assert.equal(await contract.rewards(), newContract.address);
  });

  it('tracks rewards when rewards contract set', async function() {
    rewards = await VariegateRewards.new();
    await rewards.transferOwnership(contract.address, { from: owner });
    await contract.setRewardsContract(rewards.address, { from: owner });

    await contract.transfer(holder1, toWei(defaults.minBalance), { from: owner });
    await contract.transfer(holder2, toWei(defaults.minBalance * 2), { from: owner });
    await rewards.send(toWei(2), { from: holder3 });

    let data = await rewards.getReport();
    assert.equal(data.holderCount, 2);
    assert.equal(data.totalTokensTracked, toWei(defaults.minBalance * 3));

    data = await rewards.getReportAccount(holder1);
    assert.equal(data.index, '1');
    assert.equal(data.balance, toWei(defaults.minBalance));
  });

  it('allows only owner to set gasLimit', async function () {
    await expectRevert(contract.setGasLimit(400_000, { from: holder1 }), 'Caller invalid');
  });

  it('allows owner to set gasLimit', async function () {
    transaction = await contract.setGasLimit(400_000, { from: owner });
    expectEvent(transaction, 'GasLimitChanged', { from: '300000', to: '400000' });
    assert.equal(await contract.gasLimit(), 400_000);
  });

  it('allows owner to set gasLimit between 250k and 750k', async function () {
    await expectRevert(contract.setGasLimit(249_999, { from: owner }), 'Value invalid');
    await expectRevert(contract.setGasLimit(750_001, { from: owner }), 'Value invalid');
  });

  it('requires the value of GasLimit to change if updated', async function () {
    await expectRevert(contract.setGasLimit(300_000, { from: owner }), "Value unchanged");
  });

  it('rejects transfers to zero address', async function() {
    await expectRevert(contract.transfer(ZERO, 1, { from: owner }), 'Value invalid');
  });

  it('rejects transfers of 0 tokens', async function() {
    await expectRevert(contract.transfer(holder1, 0, { from: owner }), 'Value invalid');
  });

  it('allows pre-sale wallets to transfer before trading is public', async function() {
    assert.isFalse(await contract.isOpenToPublic());
    assert.isTrue(await contract.isPresale(owner));
    await contract.transfer(holder1, 1, { from: owner });
    assert.equal(await contract.balanceOf(holder1), '1');
  });

  it('restricts non pre-sale wallets from transfering before trading is public', async function() {
    assert.isFalse(await contract.isOpenToPublic());
    assert.isFalse(await contract.isPresale(holder1));
    await contract.transfer(holder1, 1, { from: owner });
    await expectRevert(contract.transfer(holder2, 1, { from: holder1 }), 'Trading closed');
  });

  it('enforces max wallet size before trading open', async function() {
    assert.isFalse(await contract.isOpenToPublic());
    await expectRevert(contract.transfer(holder1, toWei(defaults.maxWallet+1), { from: owner }), 'Wallet over limit');
  });

  it('does not enforce max wallet size transfers to AMM before trading open', async function() {
    assert.isFalse(await contract.isOpenToPublic());
    await contract.transfer(uniswapV2Pair, toWei(defaults.maxWallet+1), { from: owner });
  });
});
