const Variegate = artifacts.require('./Variegate.sol');
const VariegateProject = artifacts.require('./VariegateProject.sol');
const VariegateRewards = artifacts.require('./VariegateRewards.sol');

const { expectEvent, expectRevert } = require('@openzeppelin/test-helpers');

var chai = require('chai');

const assert = chai.assert;
const expect = chai.expect;

let DOGE = '0xbA2aE424d960c26247Dd6c32edC70B295c744C43';

function toWei(count) {
  return `${count}000000000000000000`;
}

contract('Variegate', function (accounts) {
  const [owner, holder1, holder2, holder3, holder4, holder5, holder6, holder7, holder8, holder9] = accounts;
  let admins = [holder1, holder2, holder3];
  let contract;
  let rewards;
  let transaction;

  beforeEach('setup contract for each test', async function() {
    contract = await Variegate.new();
    rewards = await VariegateRewards.new();
    await rewards.transferOwnership(contract.address, { from: owner });
    await contract.setRewardsContract(rewards.address, { from: owner });
  });

  it('allows owner to call rewards functions when no project set', async function () {
    await rewards.addToken(DOGE, { from: owner });
  });

  it('requires admin to call rewards functions once admins set', async function () {
    let project = await VariegateProject.new();
    contract.setProjectContract(project.address);
    await rewards.addToken(DOGE, { from: owner }); // NO PROBLEM

    await project.setAdmins(admins);

    await expectRevert(rewards.addToken(DOGE, { from: owner }), "Caller invalid"); // PROBLEM
    await expectRevert(rewards.addToken(DOGE, { from: holder1 }), "Token exists"); // DIFF PROBLEM BUT VALID CALLER
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
    await project.setAdmins(admins);
    await contract.setProjectContract(project.address, { from: owner });
  });

  it('requires 3 admins to call setRewardsContract', async function() {
    await project.transferOwnership(contract.address, { from: owner });
    transaction = await contract.setRewardsContract(project.address, { from: holder1 });
    expectEvent.inTransaction(transaction.tx, project, 'ConfirmationRequired', { confirmations: '1', required: '3' });
  });

  it('requires 3 admins to call setProjectContract', async function() {
    transaction = await contract.setProjectContract(rewards.address, { from: holder1 });
    expectEvent.inTransaction(transaction.tx, project, 'ConfirmationRequired', { confirmations: '1', required: '3' });
  });

  it('requires 2 admins to call openToPublic', async function() {
    await contract.send(toWei(10), { from: holder3 });
    await contract.transfer(contract.address, toWei(500_000_000), { from: owner });

    transaction = await contract.openToPublic({ from: holder1 });
    expectEvent.inTransaction(transaction.tx, project, 'ConfirmationRequired', { confirmations: '1', required: '2' });
  });

  it('requires 2 admins to call setAutomatedMarketMakerPair', async function() {
    transaction = await contract.setAutomatedMarketMakerPair(holder9, true, { from: holder1 });
    expectEvent.inTransaction(transaction.tx, project, 'ConfirmationRequired', { confirmations: '1', required: '2' });
  });

  it('requires 2 admins to call setFeeless', async function() {
    transaction = await contract.setFeeless(holder9, true, { from: holder1 });
    expectEvent.inTransaction(transaction.tx, project, 'ConfirmationRequired', { confirmations: '1', required: '2' });
  });

  it('requires 2 admins to call setGasLimit', async function() {
    transaction = await contract.setGasLimit(255_000, { from: holder1 });
    expectEvent.inTransaction(transaction.tx, project, 'ConfirmationRequired', { confirmations: '1', required: '2' });
  });

  it('requires 2 admins to call rewards.setExcluded', async function() {
    transaction = await rewards.setExcluded(holder9, true, { from: holder1 });
    expectEvent.inTransaction(transaction.tx, project, 'ConfirmationRequired', { confirmations: '1', required: '2' });
  });

  it('requires 2 admins to call rewards.setMinimumBalance', async function() {
    transaction = await rewards.setMinimumBalance(450_000, { from: holder1 });
    expectEvent.inTransaction(transaction.tx, project, 'ConfirmationRequired', { confirmations: '1', required: '2' });
  });

  it('requires 2 admins to call rewards.setStaking', async function() {
    transaction = await rewards.setStaking(true, { from: holder1 });
    expectEvent.inTransaction(transaction.tx, project, 'ConfirmationRequired', { confirmations: '1', required: '2' });
  });

  it('requires 2 admins to call rewards.setWaitingPeriod', async function() {
    transaction = await rewards.setWaitingPeriod(6000, { from: holder1 });
    expectEvent.inTransaction(transaction.tx, project, 'ConfirmationRequired', { confirmations: '1', required: '2' });
  });

  it('requires 2 admins to call project.replaceAdmin', async function() {
    transaction = await project.replaceAdmin(holder3, holder4, { from: holder1 });
    expectEvent.inTransaction(transaction.tx, project, 'ConfirmationRequired', { confirmations: '1', required: '2' });
  });

  it('requires 2 admins to call project.requestFunds', async function() {
    await project.setHolders(admins, [1,1,1]);
    await project.send(toWei(1), { from: holder9 });
    transaction = await project.requestFunds(holder9, 100, { from: holder1 });
    expectEvent.inTransaction(transaction.tx, project, 'ConfirmationRequired', { confirmations: '1', required: '2' });
  });

  it('requires 2 admins to call project.setToken', async function() {
    transaction = await project.setToken(contract.address, { from: holder1 });
    expectEvent.inTransaction(transaction.tx, project, 'ConfirmationRequired', { confirmations: '1', required: '2' });
  });

});
