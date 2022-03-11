// test/Odyssey.test.js
const RewardsTracker = artifacts.require('./RewardsTracker.sol');

const { expectEvent, expectRevert } = require('@openzeppelin/test-helpers');
var chai = require('chai');
const assert = chai.assert;

function toWei(count) {
  return `${count}000000000000000000`;
}

contract('RewardsTracker', function (accounts) {
  const [owner, holder1, holder2, holder3] = accounts;
  let contract;
  let transaction;

  beforeEach('setup contract for each test', async function() {
    contract = await RewardsTracker.new();
  });

  it('allows only owner to putBalances', async function () {
    await expectRevert(contract.putBalance(holder1, 1, { from: holder1 }), 'Ownable: caller is not the owner');
  });

  it('tracks balances', async function () {
    await contract.putBalance(holder1, 1, { from: owner });
    assert.equal(await contract.balanceOf(holder1), 1);
  });

  it('tracks total balances', async function () {
    await contract.putBalance(holder1, 1, { from: owner });
    await contract.putBalance(holder2, 2, { from: owner });
    assert.equal(await contract.totalBalance(), 3);
  });

  it('does not accept 0 funds', async function () {
    await expectRevert(contract.send(0, { from: owner }), 'No funds sent');
  });

  it('does not accept funds until balances exist', async function () {
    await expectRevert(contract.send(1, { from: owner }), 'No balances tracked');
  });

  it('accept funds once balances exist', async function () {
    await contract.putBalance(holder1, 1, { from: owner });
    transaction = await contract.send(toWei(1), { from: owner });
    expectEvent(transaction, 'FundsDeposited', { from: owner, amount: toWei(1) });
    assert.equal(await web3.eth.getBalance(contract.address), toWei(1));
  });

  it('changing balances without funds does nothing', async function () {
    await contract.putBalance(holder1, 1, { from: owner });
    assert.equal(await contract.getAccumulated(holder1), 0);
    assert.equal(await contract.getPending(holder1), 0);
    assert.equal(await contract.getWithdrawn(holder1), 0);
  });

  it('distributes funds to holders', async function () {
    await contract.putBalance(holder1, 1, { from: owner });
    await contract.send(toWei(1), { from: owner });
    assert.equal(await contract.getAccumulated(holder1), toWei(1));
    assert.equal(await contract.getPending(holder1), toWei(1));
    assert.equal(await contract.getWithdrawn(holder1), 0);
  });

  it('allows holders to withdraw', async function () {
    await contract.putBalance(holder1, 1, { from: owner });
    await contract.send(toWei(1), { from: owner });
    transaction = await contract.withdrawFunds(holder1);
    expectEvent(transaction, 'FundsWithdrawn', { account: holder1, amount: toWei(1) });
    assert.equal(await contract.getAccumulated(holder1), toWei(1));
    assert.equal(await contract.getPending(holder1), 0);
    assert.equal(await contract.getWithdrawn(holder1), toWei(1));
    assert.equal(await web3.eth.getBalance(contract.address), 0);
  });

  it('splits funds according to holdings', async function () {
    await contract.putBalance(holder1, 1, { from: owner });
    await contract.putBalance(holder2, 2, { from: owner });
    await contract.send(toWei(3), { from: owner });
    assert.equal(await contract.getPending(holder1), toWei(1));
    assert.equal(await contract.getPending(holder2), toWei(2));
  });

  it('splits funds correctly when balances change', async function () {
    await contract.putBalance(holder1, 1, { from: owner });
    await contract.putBalance(holder2, 2, { from: owner });
    await contract.putBalance(holder3, 3, { from: owner });
    await contract.send(toWei(6), { from: owner });
    await contract.putBalance(holder3, 0, { from: owner });
    await contract.send(toWei(3), { from: owner });
    assert.equal(await contract.getPending(holder1), toWei(2));
    assert.equal(await contract.getPending(holder2), toWei(4));
    assert.equal(await contract.getPending(holder3), toWei(3));
  });

  it('stress tests', async function () {
    await contract.putBalance(holder1, 1, { from: owner });
    await contract.putBalance(holder2, 2, { from: owner });
    await contract.putBalance(holder3, 3, { from: owner });
    await contract.send(toWei(6), { from: owner }); // 1,2,3 = 6
    await contract.putBalance(holder3, 0, { from: owner });
    await contract.send(toWei(3), { from: owner }); // 2,4,3 = 9
    await contract.putBalance(holder2, 0, { from: owner });
    await contract.putBalance(holder3, 3, { from: owner });
    await contract.send(toWei(4), { from: owner }); // 3,4,6 = 13
    await contract.putBalance(holder2, 2, { from: owner });
    await contract.send(toWei(6), { from: owner }); // 4,6,9 = 19
    await contract.putBalance(holder1, 0, { from: owner });
    await contract.send(toWei(5), { from: owner }); // 4,8,12 = 24
    await contract.putBalance(holder1, 1, { from: owner });
    await contract.send(toWei(6), { from: owner }); // 5,10,15 = 30
    assert.equal(await contract.getPending(holder1), toWei(5));
    assert.equal(await contract.getPending(holder2), toWei(10));
    assert.equal(await contract.getPending(holder3), toWei(15));
    assert.equal(await contract.totalBalance(), 6);
    assert.equal(await contract.totalDistributed(), toWei(30));
  });
});
