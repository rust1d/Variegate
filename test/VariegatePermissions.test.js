const Variegate = artifacts.require('./Variegate.sol');
const VariegateProject = artifacts.require('./VariegateProject.sol');
const VariegateRewards = artifacts.require('./VariegateRewards.sol');

const { expectEvent, expectRevert } = require('@openzeppelin/test-helpers');

let DOGE = '0xbA2aE424d960c26247Dd6c32edC70B295c744C43';

function toWei(count) {
  return `${count}000000000000000000`;
}

contract('Variegate', function (accounts) {
  const [owner, admin1, admin2, admin3] = accounts;
  let admins = [admin1, admin2, admin3];
  let contract;
  let transaction;

  beforeEach('setup contract for each test', async function() {
    contract = await Variegate.new();
    await contract.setAdmins(admins);
  });

  it('tracks calls via confirmCall', async function () {
    transaction = await contract.confirmCall(3, admin1, '0x10101010', '0x0', { from: owner });
    expectEvent(transaction, 'ConfirmationRequired', { confirmations: '1', required: '3' });
    transaction = await contract.confirmCall(3, admin2, '0x10101010', '0x0', { from: owner });
    expectEvent(transaction, 'ConfirmationRequired', { confirmations: '2', required: '3' });
    transaction = await contract.confirmCall(3, admin3, '0x10101010', '0x0', { from: owner });
    expectEvent(transaction, 'ConfirmationComplete', { confirmations: '3' });
  });

  it('restarts confirmation when conflicted', async function () {
    transaction = await contract.confirmCall(3, admin1, '0x10101010', '0x0', { from: owner });
    expectEvent(transaction, 'ConfirmationRequired', { confirmations: '1', required: '3' });
    transaction = await contract.confirmCall(3, admin2, '0x10101010', '0x0', { from: owner });
    expectEvent(transaction, 'ConfirmationRequired', { confirmations: '2', required: '3' });
    transaction = await contract.confirmCall(3, admin3, '0x10101010', '0x10', { from: owner });
    expectEvent(transaction, 'ConfirmationRequired', { confirmations: '1', required: '3' });
  });

  it('ignores double confirmation', async function () {
    transaction = await contract.confirmCall(2, admin1, '0x10101010', '0x0', { from: owner });
    expectEvent(transaction, 'ConfirmationRequired', { confirmations: '1', required: '2' });
    transaction = await contract.confirmCall(2, admin1, '0x10101010', '0x0', { from: owner });
    expectEvent(transaction, 'ConfirmationRequired', { confirmations: '1', required: '2' });
  });
});

contract('Variegate', function (accounts) {
  const [owner, holder1, holder2, holder3, holder4, holder5, holder6, holder7, holder8, holder9] = accounts;
  let admins = [holder1, holder2, holder3];
  let contract;
  let rewards;

  beforeEach('setup contract for each test', async function() {
    contract = await Variegate.new();
    rewards = await VariegateRewards.new();
    await rewards.transferOwnership(contract.address, { from: owner });
    await contract.setRewardsContract(rewards.address, { from: owner });
    project = await VariegateProject.new();
    project.setHolders(admins, [1,1,1], { from: owner });
    await project.send(toWei(2), { from: holder9 });
    await project.transferOwnership(contract.address, { from: owner });
    await contract.setProjectContract(project.address, { from: owner });
  });

  it('requires 3 Admin accounts to set', async function () {
    await expectRevert(contract.setAdmins([holder1, holder2]), '3 Admins required');
  });

  it('allows owner to call admin functions when no admins are set', async function () {
    await rewards.addToken(DOGE, { from: owner }); // NO PROBLEM
    await project.requestFunds(holder1, 1, { from: owner }); // NO PROBLEM
  });

  it('requires admin to call rewards functions once admins set', async function () {
    await contract.setAdmins(admins);

    await expectRevert(rewards.addToken(DOGE, { from: owner }), "Caller invalid"); // PROBLEM
    await rewards.addToken(DOGE, { from: holder1 }); // NO PROBLEM

    await expectRevert(project.requestFunds(holder1, 1, { from: owner }), "Caller invalid"); // PROBLEM
    await project.requestFunds(holder1, 1, { from: holder1 }); // NO PROBLEM
  });
});

contract('Variegate', function (accounts) {
  const [owner, holder1, holder2, holder3, holder4, holder5, holder6, holder7, holder8, holder9] = accounts;
  let admins = [holder1, holder2, holder3];
  let contract;
  let rewards;
  let project;
  let transaction;

  beforeEach('setup contract for each test', async function() {
    contract = await Variegate.new();
    rewards = await VariegateRewards.new();
    await rewards.transferOwnership(contract.address, { from: owner });
    await contract.setRewardsContract(rewards.address, { from: owner });
    project = await VariegateProject.new();
    project.setHolders(admins, [1,1,1], { from: owner });
    await project.send(toWei(2), { from: holder9 });
    await project.transferOwnership(contract.address, { from: owner });
    await contract.setProjectContract(project.address, { from: owner });

    await contract.setAdmins(admins);
  });

  it('requires 3 admins to call setRewardsContract', async function() {
    rewards = await VariegateRewards.new();
    await rewards.transferOwnership(contract.address, { from: owner });
    transaction = await contract.setRewardsContract(rewards.address, { from: holder1 });
    expectEvent(transaction, 'ConfirmationRequired', { confirmations: '1', required: '3' });
  });

  it('requires 3 admins to call setProjectContract', async function() {
    transaction = await contract.setProjectContract(rewards.address, { from: holder1 });
    expectEvent(transaction, 'ConfirmationRequired', { confirmations: '1', required: '3' });
  });

  it('requires 2 admins to call openToPublic', async function() {
    await contract.send(toWei(10), { from: holder3 });
    await contract.transfer(contract.address, toWei(500_000_000), { from: owner });

    transaction = await contract.openToPublic({ from: holder1 });
    expectEvent(transaction, 'ConfirmationRequired', { confirmations: '1', required: '2' });
  });

  it('requires 2 admins to call replaceAdmin', async function() {
    transaction = await contract.replaceAdmin(holder3, holder4, { from: holder1 });
    expectEvent(transaction, 'ConfirmationRequired', { confirmations: '1', required: '2' });
  });

  it('requires 2 admins to call setAutomatedMarketMakerPair', async function() {
    transaction = await contract.setAutomatedMarketMakerPair(holder9, true, { from: holder1 });
    expectEvent(transaction, 'ConfirmationRequired', { confirmations: '1', required: '2' });
  });

  it('requires 2 admins to call setFeeless', async function() {
    transaction = await contract.setFeeless(holder9, true, { from: holder1 });
    expectEvent(transaction, 'ConfirmationRequired', { confirmations: '1', required: '2' });
  });

  it('requires 2 admins to call setGasLimit', async function() {
    transaction = await contract.setGasLimit(255_000, { from: holder1 });
    expectEvent(transaction, 'ConfirmationRequired', { confirmations: '1', required: '2' });
  });

  it('requires 2 admins to call rewards.setExcluded', async function() {
    transaction = await rewards.setExcluded(holder9, true, { from: holder1 });
    expectEvent.inTransaction(transaction.tx, contract, 'ConfirmationRequired', { confirmations: '1', required: '2' });
  });

  it('requires 2 admins to call rewards.setMinimumBalance', async function() {
    transaction = await rewards.setMinimumBalance(450_000, { from: holder1 });
    expectEvent.inTransaction(transaction.tx, contract, 'ConfirmationRequired', { confirmations: '1', required: '2' });
  });

  it('requires 2 admins to call rewards.setStaking', async function() {
    transaction = await rewards.setStaking(true, { from: holder1 });
    expectEvent.inTransaction(transaction.tx, contract, 'ConfirmationRequired', { confirmations: '1', required: '2' });
  });

  it('requires 2 admins to call rewards.setWaitingPeriod', async function() {
    transaction = await rewards.setWaitingPeriod(6000, { from: holder1 });
    expectEvent.inTransaction(transaction.tx, contract, 'ConfirmationRequired', { confirmations: '1', required: '2' });
  });

  it('requires 2 admins to call project.requestFunds', async function() {
    transaction = await project.requestFunds(holder9, 100, { from: holder1 });
    expectEvent.inTransaction(transaction.tx, contract, 'ConfirmationRequired', { confirmations: '1', required: '2' });
  });
});
