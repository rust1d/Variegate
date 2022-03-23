// test/Odyssey.test.js
const VariegateRewards = artifacts.require('./VariegateRewards.sol');
const ERC20 = artifacts.require('@openzeppelin/contracts/token/ERC20/ERC20.sol');

const { expectEvent, expectRevert } = require('@openzeppelin/test-helpers');

var chai = require('chai');

const assert = chai.assert;
const expect = chai.expect;

let coins = {
  doge:     { address: '0xbA2aE424d960c26247Dd6c32edC70B295c744C43', name: 'Dogecoin' },
  binaryx:  { address: '0x8C851d1a123Ff703BD1f9dabe631b69902Df5f97', name: 'BinaryX' },
  cosmos:   { address: '0x0Eb3a705fc54725037CC9e008bDede697f62F335', name: 'Cosmos Token' },
  crocket:  { address: '0x27Ae27110350B98d564b9A3eeD31bAeBc82d878d', name: 'CumRocket' },
  eos:      { address: '0x56b6fB708fC5732DEC1Afc8D8556423A2EDcCbD6', name: 'EOS Token' },
  iota:     { address: '0xd944f1D1e9d5f9Bb90b62f9D45e447D989580782', name: 'MIOTAC' },
  tezos:    { address: '0x16939ef78684453bfDFb47825F8a5F714f12623a', name: 'Tezos Token' },
  useless:  { address: '0x2cd2664Ce5639e46c6a3125257361e01d0213657', name: 'Useless'},
  wazirx:   { address: '0x8e17ed70334C87eCE574C9d537BC153d8609e2a3', name: 'wazirx token' },
  sdhp:     { address: '0x0f131f75E945cda74a75AA2b260eD5eb8Fd20480', name: '6DayHoneypot' },
  certix:   { address: '0xA8c2B8eec3d368C0253ad3dae65a5F2BBB89c929', name: 'Tezos Token' }
}

const one_hour = 60 * 60;
const six_hours = 6 * one_hour;
const two_hours = 2 * one_hour;
const one_day = 24 * one_hour;
let minBalance;

function toWei(count) {
  return `${count}000000000000000000`;
}

function fromWei(bn) {
  return (bn / toWei(1)).toFixed(2);
}

function timeTravel(addSeconds) {
  const id = Date.now();

  return new Promise((resolve, reject) => {
    web3.currentProvider.send({
      jsonrpc: '2.0',
      method: 'evm_increaseTime',
      params: [ addSeconds ],
      id
    }, (err1) => {
      if (err1) return reject(err1);

      web3.currentProvider.send({
        jsonrpc: '2.0',
        method: 'evm_mine',
        id: id + 1
      }, (err2, res) => (err2 ? reject(err2) : resolve(res)));
    });
  });
}

contract('VariegateRewards', function (accounts) {
  const [owner, holder1, holder2, holder3, holder4, holder5, holder6, holder7, holder8, holder9] = accounts;
  let contract;
  let transaction;
  let data;

  beforeEach('setup contract for each test', async function() {
    contract = await VariegateRewards.new();
    minBalance = (await contract.minimumBalance()).toString();
  });

  it('adds tokens', async function () {
    transaction = await contract.addToken(coins.useless.address, { from: owner });
    expectEvent(transaction, 'TokenAdded', { token: coins.useless.address, name: coins.useless.name });
    assert.equal(await contract.tokens(), 1);
    assert.equal(await contract.tokenAt(1), coins.useless.address);
    data = await contract.token(coins.useless.address);
    assert.equal(data.index, 1);
    assert.notEqual(data.added, 0);
  });

  it('adds only valid tokens', async function () {
    await expectRevert(contract.addToken(owner, { from: owner }), "Not a contract");
  });

  it('deletes tokens', async function () {
    await contract.addToken(coins.sdhp.address, { from: owner });
    await contract.addToken(coins.useless.address, { from: owner });
    transaction = await contract.deleteToken(coins.sdhp.address, { from: owner });
    expectEvent(transaction, 'TokenDeleted', { token: coins.sdhp.address, name: coins.sdhp.name });
    assert.equal(await contract.tokens(), 1);
    assert.equal(await contract.tokenAt(1), coins.useless.address);
    data = await contract.token(coins.useless.address);
    assert.equal(data.index, 1);
    data = await contract.token(coins.sdhp.address);
    assert.equal(data.index, 0);
    assert.equal(data.added, 0);
  });

  it('fills token slots one by one up to 10', async function () {
    await contract.addToken(coins.sdhp.address, { from: owner });
    for (let idx=1;idx<=10;idx++) {
      transaction = await contract.setSlot(0, coins.sdhp.address);
      expectEvent(transaction, 'SlotSet', { slot: idx.toString(), token: coins.sdhp.address, name: coins.sdhp.name });
      assert.equal(await contract.slots(), idx);
      assert.equal(await contract.tokenInSlot(idx), coins.sdhp.address);
    }
    assert.equal(await contract.slots(), 10);
    await expectRevert(contract.setSlot(0, coins.sdhp.address), 'All slots filled');
    assert.equal(await contract.slots(), 10);
  });

  it('replaces a token slot', async function () {
    await contract.addToken(coins.sdhp.address, { from: owner });
    await contract.addToken(coins.useless.address, { from: owner });

    await contract.setSlot(0, coins.sdhp.address);
    await contract.setSlot(0, coins.sdhp.address);
    await contract.setSlot(0, coins.sdhp.address);
    await contract.setSlot(2, coins.useless.address);

    assert.equal(await contract.slots(), 3);
    assert.equal(await contract.tokenInSlot(1), coins.sdhp.address);
    assert.equal(await contract.tokenInSlot(2), coins.useless.address);
    assert.equal(await contract.tokenInSlot(3), coins.sdhp.address);
  });

  it('deletes a token slot', async function () {
    await contract.addToken(coins.sdhp.address, { from: owner });
    await contract.addToken(coins.useless.address, { from: owner });
    await contract.addToken(coins.doge.address, { from: owner });

    await contract.setSlot(0, coins.sdhp.address);
    await contract.setSlot(0, coins.useless.address);
    await contract.setSlot(0, coins.doge.address);
    await contract.deleteSlot(2);

    assert.equal(await contract.slots(), 2);
    assert.equal(await contract.tokenInSlot(1), coins.sdhp.address);
    assert.equal(await contract.tokenInSlot(2), coins.doge.address);
  });

  it('gives rewards in active token', async function () {
    // await contract.setMinimumBalance(1, { from: owner });
    await contract.trackBuy(holder1, toWei(500_000), { from: owner });

    await contract.addToken(coins.doge.address, { from: owner });
    await contract.setSlot(0, coins.doge.address);

    assert.equal(await contract.slots(), 1);
    assert.equal(await contract.currentSlot(), 1);

    let doge = await ERC20.at(coins.doge.address);

    console.log('doge balance', (await doge.balanceOf(holder1)).toString());

    await contract.send(toWei(1), { from: owner });
    transaction = await contract.withdrawFunds(holder1);

    timeTravel(one_day);

    await contract.send(toWei(1), { from: owner });
    transaction = await contract.withdrawFunds(holder1);

    console.log('doge balance', (await doge.balanceOf(holder1)).toString());
    data = await contract.getReportTokenInSlot(1);
    console.log(data.symbol, data.name, 'claims', data.claims.toNumber(), 'balance', fromWei(data.balance), 'amount', fromWei(data.amount));
  });

  it('test 7 slots', async function () {
    // await contract.setMinimumBalance(1, { from: owner });
    await contract.trackBuy(holder1, toWei(1 * 500_000), { from: owner });
    await contract.trackBuy(holder2, toWei(2 * 500_000), { from: owner });
    await contract.trackBuy(holder3, toWei(3 * 500_000), { from: owner });

    let slot = 0;
    for (const key in coins) {
      slot++; if (slot==8) break;
      await contract.addToken(coins[key].address, { from: owner });
      data = await contract.token(coins[key].address);
      await contract.setSlot(0, data.token);
    }
    await contract.setCurrentSlot(1);

    for (let idx=1;idx<=30;idx++) {
      timeTravel(one_day);
      let slot = await contract.currentSlot();
      data = await contract.getReportTokenInSlot(0);
      console.log('slot', slot.toNumber(), 'Day', idx, 'the current token is', data.symbol, data.name, 'claims', data.claims.toNumber(), 'balance', fromWei(data.balance), 'amount', fromWei(data.amount));
      await contract.send(toWei(1), { from: owner });
      await contract.processClaims(750_000);
    }
    console.log('\n30 day run complete.');
    for (let idx=1;idx<=7;idx++) {
      data = await contract.getReportTokenInSlot(idx);
      console.log('Summary of slot', idx, data.symbol, data.name, 'claims', data.claims.toNumber(), 'balance', fromWei(data.balance), 'amount', fromWei(data.amount));
    }
  });
});
