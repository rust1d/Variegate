const ConfirmCall = artifacts.require('./ConfirmCall.sol');

const { expectEvent } = require('@openzeppelin/test-helpers');

var chai = require('chai');
const assert = chai.assert;

function toWei(count) {
  return `${count}000000000000000000`;
}

contract('ConfirmCall', function (accounts) {
  const [owner, holder1, holder2, holder3, holder4] = accounts;
  let contract;
  let transaction;

  beforeEach('setup contract for each test', async function() {
    contract = await ConfirmCall.new();
  });

  it('sets Admin accounts', async function () {
    await contract.setAdmins([holder1, holder2, holder3]);
    assert.equal(await contract.admins(0), holder1);
    assert.equal(await contract.admins(1), holder2);
    assert.equal(await contract.admins(2), holder3);
  });

  it('tracks calls via confirmCall', async function () {
    await contract.setAdmins([holder1, holder2, holder3]);

    transaction = await contract.confirmCall(3, holder1, '0x10101010', '0x0');
    expectEvent(transaction, 'ConfirmationRequired', { confirmations: '1', required: '3' });
    transaction = await contract.confirmCall(3, holder2, '0x10101010', '0x0');
    expectEvent(transaction, 'ConfirmationRequired', { confirmations: '2', required: '3' });
    transaction = await contract.confirmCall(3, holder3, '0x10101010', '0x0');
    expectEvent(transaction, 'ConfirmationComplete', { confirmations: '3' });

  });

  it('restarts confirmation when conflicted', async function () {
    await contract.setAdmins([holder1, holder2, holder3]);

    transaction = await contract.confirmCall(3, holder1, '0x10101010', '0x0');
    expectEvent(transaction, 'ConfirmationRequired', { confirmations: '1', required: '3' });
    transaction = await contract.confirmCall(3, holder2, '0x10101010', '0x0');
    expectEvent(transaction, 'ConfirmationRequired', { confirmations: '2', required: '3' });
    transaction = await contract.confirmCall(3, holder3, '0x10101010', '0x10');
    expectEvent(transaction, 'ConfirmationRequired', { confirmations: '1', required: '3' });
  });

  it('ignores double confirmation', async function () {
    await contract.setAdmins([holder1, holder2, holder3]);

    transaction = await contract.confirmCall(3, holder1, '0x10101010', '0x0');
    expectEvent(transaction, 'ConfirmationRequired', { confirmations: '1', required: '3' });
    transaction = await contract.confirmCall(3, holder1, '0x10101010', '0x0');
    expectEvent(transaction, 'ConfirmationRequired', { confirmations: '1', required: '3' });
  });

  it('replace Admin requires 2 of 3 admins', async function () {
    await contract.setAdmins([holder1, holder2, holder3]);

    transaction = await contract.replaceAdmin(holder3, holder4, { from: holder1 });
    assert.isFalse(await contract.isAdmin(holder4));

    transaction = await contract.replaceAdmin(holder3, holder4, { from: holder2 });
    expectEvent(transaction, 'AdminChanged', { from: holder3, to: holder4 });
    assert.isTrue(await contract.isAdmin(holder4));
    assert.isFalse(await contract.isAdmin(holder3));
  });

  it('request Funds requires 3 of 3 admins', async function () {
    await contract.setAdmins([holder1, holder2, holder3]);
    await contract.send(toWei(2), { from: holder4 });

    transaction = await contract.requestFunds(holder4, toWei(1), { from: holder1 });
    expectEvent(transaction, 'ConfirmationRequired', { confirmations: '1', required: '3' });
    transaction = await contract.requestFunds(holder4, toWei(1), { from: holder2 });
    expectEvent(transaction, 'ConfirmationRequired', { confirmations: '2', required: '3' });
    transaction = await contract.requestFunds(holder4, toWei(1), { from: holder3 });
    expectEvent(transaction, 'ConfirmationComplete', { confirmations: '3' });
    expectEvent(transaction, 'FundsApproved', { to: holder4, amount: toWei(1) });
  });
});
