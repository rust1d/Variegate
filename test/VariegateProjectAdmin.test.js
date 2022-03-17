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
  const [owner, admin1, admin2, admin3, holder4] = accounts;
  let contract;
  let transaction;
  let admins = [admin1, admin2, admin3];

  beforeEach('setup contract for each test', async function() {
    contract = await VariegateProject.new();
  });

  it('sets Admin accounts', async function () {
    await contract.setAdmins(admins);
    assert.equal(await contract.admins(0), admin1);
    assert.equal(await contract.admins(1), admin2);
    assert.equal(await contract.admins(2), admin3);
  });

  it('requires 3 Admin accounts to set', async function () {
    await expectRevert(contract.setAdmins([admin1, admin2]), '3 Admins required');
  });

  it('allows Admin accounts to initialize once', async function () {
    await contract.setAdmins(admins);
    await expectRevert(contract.setAdmins(admins), 'Already set');
  });

  it('tracks calls via confirmCall', async function () {
    await contract.setAdmins(admins);

    transaction = await contract.confirmCall(3, admin1, '0x10101010', '0x0', { from: admin1 });
    expectEvent(transaction, 'ConfirmationRequired', { confirmations: '1', required: '3' });
    transaction = await contract.confirmCall(3, admin2, '0x10101010', '0x0', { from: admin2 });
    expectEvent(transaction, 'ConfirmationRequired', { confirmations: '2', required: '3' });
    transaction = await contract.confirmCall(3, admin3, '0x10101010', '0x0', { from: admin3 });
    expectEvent(transaction, 'ConfirmationComplete', { confirmations: '3' });

  });

  it('restarts confirmation when conflicted', async function () {
    await contract.setAdmins(admins);

    transaction = await contract.confirmCall(3, admin1, '0x10101010', '0x0', { from: admin1 });
    expectEvent(transaction, 'ConfirmationRequired', { confirmations: '1', required: '3' });
    transaction = await contract.confirmCall(3, admin2, '0x10101010', '0x0', { from: admin2 });
    expectEvent(transaction, 'ConfirmationRequired', { confirmations: '2', required: '3' });
    transaction = await contract.confirmCall(3, admin3, '0x10101010', '0x10', { from: admin3 });
    expectEvent(transaction, 'ConfirmationRequired', { confirmations: '1', required: '3' });
  });

  it('ignores double confirmation', async function () {
    await contract.setAdmins(admins);

    transaction = await contract.confirmCall(2, admin1, '0x10101010', '0x0', { from: admin1 });
    expectEvent(transaction, 'ConfirmationRequired', { confirmations: '1', required: '2' });
    transaction = await contract.confirmCall(2, admin1, '0x10101010', '0x0', { from: admin1 });
    expectEvent(transaction, 'ConfirmationRequired', { confirmations: '1', required: '2' });
  });

  it('requires 2 admins to replaceAdmin ', async function () {
    await contract.setAdmins(admins);

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
    await contract.setAdmins(admins);
    await contract.setHolders(admins, [1,1,1]);
    await contract.send(toWei(10), { from: holder4 });
    let before = await web3.eth.getBalance(holder4);

    transaction = await contract.requestFunds(holder4, toWei(5), { from: admin1 });
    expectEvent(transaction, 'ConfirmationRequired', { confirmations: '1', required: '2' });
    transaction = await contract.requestFunds(holder4, toWei(5), { from: admin2 });
    expectEvent(transaction, 'ConfirmationComplete', { confirmations: '2' });
    expectEvent(transaction, 'FundsApproved', { to: holder4, amount: toWei(5) });
    // FUNDS DELIVERED
    assert.equal(fromWei(await web3.eth.getBalance(contract.address)), 5);
    assert.equal(fromWei(await web3.eth.getBalance(holder4)) - fromWei(before), 5);
  });

  it('requires 1 admins to setToken the 1st time', async function () {
    await contract.setAdmins(admins);
    let token = await Variegate.new();

    transaction = await contract.setToken(token.address, { from: admin1 });
    expectEvent(transaction, 'TokenSet', { to: token.address });
  });

  it('requires 2 admins to setToken the 2nd time', async function () {
    await contract.setAdmins(admins);
    let token = await Variegate.new();
    transaction = await contract.setToken(token.address, { from: admin1 });

    transaction = await contract.setToken(token.address, { from: admin1 });
    expectEvent(transaction, 'ConfirmationRequired', { confirmations: '1', required: '2' });
  });
});
