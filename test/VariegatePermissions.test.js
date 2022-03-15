const Variegate = artifacts.require('./Variegate.sol');
const VariegateProject = artifacts.require('./VariegateProject.sol');
const VariegateRewards = artifacts.require('./VariegateRewards.sol');

const { expectEvent, expectRevert } = require('@openzeppelin/test-helpers');

var chai = require('chai');

const assert = chai.assert;
const expect = chai.expect;

let DOGE = '0xbA2aE424d960c26247Dd6c32edC70B295c744C43';

// contract('Variegate', function (accounts) {
//   const [owner, holder1, holder2, holder3, holder4, holder5, holder6, holder7, holder8, holder9] = accounts;
//   let contract;
//   let tracker;
//   let transaction;

//   beforeEach('setup contract for each test', async function() {
//     contract = await Variegate.new();
//     rewards = await VariegateRewards.new();
//     await rewards.transferOwnership(contract.address, { from: owner });
//     await contract.setRewardsContract(rewards.address, { from: owner });
//   });

//   it('allows owner to call rewards functions when no project set', async function () {
//     await rewards.addToken(DOGE, { from: owner });
//   });

//   it('allows project owner to call rewards functions when no project officers set', async function () {
//     let project = await VariegateProject.new();
//     await project.transferOwnership(holder1, { from: owner });
//     await contract.setProjectContract(project.address);

//     await expectRevert(rewards.addToken(DOGE, { from: owner }), "Caller invalid");
//     await rewards.addToken(DOGE, { from: holder1 });
//   });

//   it('requires officer for changes when project officers set', async function () {
//     let project = await VariegateProject.new();
//     contract.setProjectContract(project.address);
//     await rewards.addToken(DOGE, { from: owner }); // NO PROBLEM
//     await project.setOfficers([holder1, holder2, holder3, holder4]);

//     await expectRevert(rewards.addToken(DOGE, { from: owner }), "Caller invalid");
//     await expectRevert(rewards.addToken(DOGE, { from: holder1 }), "Token exists");
//     await expectRevert(rewards.addToken(DOGE, { from: holder2 }), "Token exists");
//     await expectRevert(rewards.addToken(DOGE, { from: holder3 }), "Token exists");
//     await expectRevert(rewards.addToken(DOGE, { from: holder4 }), "Token exists");
//   });
// });

contract('Variegate', function (accounts) {
  const [owner, holder1, holder2, holder3, holder4, holder5, holder6, holder7, holder8, holder9] = accounts;
  let contract;
  let tracker;
  let project;
  let transaction;

  beforeEach('setup contract for each test', async function() {
    contract = await Variegate.new();
    rewards = await VariegateRewards.new();
    await rewards.transferOwnership(contract.address, { from: owner });
    await contract.setRewardsContract(rewards.address, { from: owner });
    project = await VariegateProject.new();
    await contract.setProjectContract(project.address);
    await project.setOfficers([holder1, holder2, holder3, holder4]);
  });

  it('tests', async function() {
    await expectRevert(contract.setFeeless(holder7, true, { from: owner }), "Caller invalid");
    assert.isFalse(await contract.isFeeless(holder7));

    transaction = await contract.setFeeless(holder7, true, { from: holder1 });
    expectEvent.inTransaction(transaction.tx, project, 'ConfirmationRequired', { confirmations: '1', required: '3' });
    transaction = await contract.setFeeless(holder7, true, { from: holder2 });
    expectEvent.inTransaction(transaction.tx, project, 'ConfirmationRequired', { confirmations: '2', required: '3' });
    transaction = await contract.setFeeless(holder7, true, { from: holder3 });
    expectEvent.inTransaction(transaction.tx, project, 'ConfirmationComplete', { confirmations: '3' });

    assert.isTrue(await contract.isFeeless(holder7));
  });

  // it('rewards functions requires officers', async function() {
  //   await rewards.addToken(DOGE, { from: holder1 });
  //   await rewards.setSlot(0, DOGE, { from: holder2 });
  //   await rewards.setSlot(0, DOGE, { from: holder3 });
  //   await rewards.setSlot(0, DOGE, { from: holder4 });
  //   await expectRevert(rewards.setSlot(0, DOGE, { from: holder5 }), "Caller invalid");
  // });
});
