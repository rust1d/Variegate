const VariegateProject = artifacts.require('./VariegateProject.sol');
const Variegate = artifacts.require('./Variegate.sol');

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

contract('VariegateProject', function (accounts) {
  const [owner, holder1, holder2, holder3, holder4, holder5, holder6, holder7, holder8, holder9] = accounts;
  let contract;
  let transaction;
  let shareholders = [owner, holder1, holder2, holder3, holder4, holder5, holder6, holder7, holder8];
  let shares = [2000,2000,2000,1000,1000,500,500,500,500];

  beforeEach('setup contract for each test', async function() {
    contract = await VariegateProject.new();
    await contract.setHolders(shareholders, shares);
  });

  it('sets Admin accounts', async function () {
    await contract.setAdmins([holder1, holder2, holder3]);
    assert.equal(await contract.admins(0), holder1);
    assert.equal(await contract.admins(1), holder2);
    assert.equal(await contract.admins(2), holder3);
  });

  it('requires 3 Admin accounts to set', async function () {
    await expectRevert(contract.setAdmins([holder1, holder2]), '3 Admins required');
  });

  it('allows Admin accounts to initialize once', async function () {
    await contract.setAdmins([holder1, holder2, holder3]);
    await expectRevert(contract.setAdmins([holder1, holder2, holder3]), 'Admins already set');
  });

  it('replace Admin requires 2 admins', async function () {
    await contract.setAdmins([holder1, holder2, holder3]);

    transaction = await contract.replaceAdmin(holder3, holder4, { from: holder1 });
    expectEvent(transaction, 'ConfirmationRequired', { confirmations: '1', required: '2' });
    assert.isTrue(await contract.isAdmin(holder3));
    assert.isFalse(await contract.isAdmin(holder4));

    transaction = await contract.replaceAdmin(holder3, holder4, { from: holder2 });
    expectEvent(transaction, 'ConfirmationComplete', { confirmations: '2' });
    expectEvent(transaction, 'AdminChanged', { from: holder3, to: holder4 });
    assert.isTrue(await contract.isAdmin(holder4));
    assert.isFalse(await contract.isAdmin(holder3));
  });

  it('restarts confirmation when conflicted', async function () {
    await contract.setAdmins([holder1, holder2, holder3]);

    transaction = await contract.replaceAdmin(holder3, holder4, { from: holder1 });
    transaction = await contract.replaceAdmin(holder3, holder5, { from: holder2 });
    expectEvent(transaction, 'ConfirmationRequired', { confirmations: '1', required: '2' });
    assert.isTrue(await contract.isAdmin(holder3));
    assert.isFalse(await contract.isAdmin(holder4));
  });

  it('does not count double confirmation', async function () {
    await contract.setAdmins([holder1, holder2, holder3]);

    transaction = await contract.replaceAdmin(holder3, holder4, { from: holder1 });
    expectEvent(transaction, 'ConfirmationRequired', { confirmations: '1', required: '2' });
    transaction = await contract.replaceAdmin(holder3, holder4, { from: holder1 });
    expectEvent(transaction, 'ConfirmationRequired', { confirmations: '1', required: '2' });
  });

  it('request Funds requires 2 admins', async function () {
    await contract.setAdmins([holder1, holder2, holder3]);
    await contract.send(toWei(10), { from: holder5 });
    let before = await web3.eth.getBalance(holder5);

    transaction = await contract.requestFunds(holder5, toWei(5), { from: holder1 });
    expectEvent(transaction, 'ConfirmationRequired', { confirmations: '1', required: '2' });
    transaction = await contract.requestFunds(holder5, toWei(5), { from: holder2 });
    expectEvent(transaction, 'ConfirmationComplete', { confirmations: '2' });
    expectEvent(transaction, 'FundsApproved', { to: holder5, amount: toWei(5) });
    // FUNDS DELIVERED
    assert.equal(fromWei(await web3.eth.getBalance(contract.address)), 5);
    assert.equal(fromWei(await web3.eth.getBalance(holder5)) - fromWei(before), 1);
  });
});
