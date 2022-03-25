const Variegate = artifacts.require('./Variegate.sol');
const VariegateProject = artifacts.require('./VariegateProject.sol');
const VariegateRewards = artifacts.require('./VariegateRewards.sol');

const { expectEvent, expectRevert } = require('@openzeppelin/test-helpers');

var chai = require('chai');

const assert = chai.assert;

const ZERO = '0x0000000000000000000000000000000000000000';

function toWei(count) {
  return `${count}000000000000000000`;
}

function fromWei(bn) {
  return (bn / toWei(1)).toFixed(2);
}

contract('Variegate', function (accounts) {
  const [owner, admin1, admin2, admin3, holder4] = accounts;
  let admins = [admin1, admin2, admin3];
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
    await project.send(toWei(10), { from: holder4 });
    await project.transferOwnership(contract.address, { from: owner });
    await contract.setProjectContract(project.address, { from: owner });

    await contract.setAdmins(admins);
  });

  it('sets Admin accounts', async function () {
    assert.equal(await contract.admins(0), admin1);
    assert.equal(await contract.admins(1), admin2);
    assert.equal(await contract.admins(2), admin3);
  });

  it('allows Admin accounts to initialize once', async function () {
    await expectRevert(contract.setAdmins(admins, { from: admin2 }), 'Already set');
  });

  it('requires 2 admins to replaceAdmin ', async function () {
    transaction = await contract.replaceAdmin(admin3, holder4, { from: admin1 });
    expectEvent(transaction, 'ConfirmationRequired', { confirmations: '1', required: '2' });
    assert.isTrue(await contract.isAdmin(admin3));
    assert.isFalse(await contract.isAdmin(holder4));

    transaction = await contract.replaceAdmin(admin3, holder4, { from: admin2 });
    expectEvent(transaction, 'ConfirmationComplete', { confirmations: '2' });
    expectEvent(transaction, 'AdminChanged', { from: admin3, to: holder4 });
    assert.isTrue(await contract.isAdmin(holder4));
    assert.isFalse(await contract.isAdmin(admin3));
  });

  it('requires 2 admins to requestFunds', async function () {
    let before = await web3.eth.getBalance(holder4);
    transaction = await project.requestFunds(holder4, toWei(5), { from: admin1 });
    expectEvent.inTransaction(transaction.tx, contract, 'ConfirmationRequired', { confirmations: '1', required: '2' });
    transaction = await project.requestFunds(holder4, toWei(5), { from: admin2 });
    expectEvent.inTransaction(transaction.tx, contract, 'ConfirmationComplete', { confirmations: '2' });
    expectEvent(transaction, 'FundsApproved', { to: holder4, amount: toWei(5) });
    // FUNDS DELIVERED
    assert.equal(fromWei(await web3.eth.getBalance(project.address)), 5);
    assert.equal(fromWei(await web3.eth.getBalance(holder4)) - fromWei(before), 5);
  });
});
