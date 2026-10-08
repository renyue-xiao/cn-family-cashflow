import { test } from 'node:test';
import assert from 'node:assert/strict';
import { forecast, validatePlan, moneyToCents, type Plan } from '../src/domain.ts';
import { sample } from '../src/samples.ts';
import { parsePlanJSON, importRepayments, repaymentsCSV } from '../src/import.ts';
test('教育金：六次收支之后基准余1.2万；停薪六个月缺13.8万', () => {
  assert.equal(forecast(sample(0)).months[5].closingCents, 1200000);
  assert.equal(forecast(sample(0), { salaryPauseMonths: 6 }).months[5].closingCents, -13800000);
});
test('借款不是收入，企业资金不是家庭可用现金', () => {
  const f = forecast(sample(1));
  assert.equal(f.initialCashCents, 12000000);
  assert.equal(f.enterpriseAssetsCents, 80000000);
  assert.equal(f.months[0].incomeCents, 3000000);
  assert.equal(f.months[0].borrowingCents, 20000000);
  assert.equal(f.months[0].debtCents, 20000000);
  assert.equal(f.months[0].closingCents, 35000000);
});
test('按表还本消减负债，利息不减负债；CSV可往返', () => {
  const p = sample(2),
    f = forecast(p);
  assert.equal(f.months[0].debtCents, 11500000);
  assert.equal(f.months[0].interestCents, 30000);
  assert.equal(f.months[23].debtCents, 0);
  assert.deepEqual(forecast(importRepayments(p, repaymentsCSV(p))).months, f.months);
});
test('金额严格、精度明确', () => {
  assert.equal(moneyToCents('0.1') + moneyToCents('0.2'), 30);
  assert.equal(moneyToCents('1.25', 'wan'), moneyToCents('12500'));
  for (const v of ['NaN', 'Infinity', '1.001', '-1', '9007199254740992'])
    assert.throws(() => moneyToCents(v));
});
test('目标日之前尚未到账的工资不能提前使用', () => {
  const p = sample(0);
  p.recurring[0].day = 28;
  p.goals[0].date = '2026-10-02';
  const f = forecast(p);
  assert.equal(f.firstGap?.date, '2026-10-02');
  assert.equal(f.firstGap?.cashCents, -3000000);
});
test('目标共享总账，顺序调整不重复花钱', () => {
  const p = sample(0);
  p.goals.push({ ...p.goals[0], id: 'second', amountCents: 100000 });
  const a = forecast(p);
  p.goals.reverse();
  const b = forecast(p);
  assert.deepEqual(a, b);
  assert.equal(a.months[5].closingCents, 1100000);
});
test('房价变化不影响现金，未知日期金额版本及重复ID拒绝', () => {
  const p = sample(0),
    before = forecast(p);
  p.assets[1].amountCents += 10000000;
  assert.equal(forecast(p).initialCashCents, before.initialCashCents);
  assert.equal(forecast(p).netWorthCents, before.netWorthCents + 10000000);
  for (const change of [
    (p: Plan) => Reflect.set(p, 'schemaVersion', 2),
    (p: Plan) => (p.assets[0].amountCents = NaN),
    (p: Plan) => (p.goals[0].date = '2027-02-30'),
    (p: Plan) => (p.goals[0].id = 'cash'),
  ]) {
    const q = sample(0);
    change(q);
    assert.throws(() => validatePlan(q));
  }
});
test('超额还本和重复还款表拒绝；失败导入不改原对象', () => {
  const p = sample(2),
    original = JSON.stringify(p);
  const q = structuredClone(p);
  q.repayments[0].principalCents = 13000000;
  assert.throws(() => validatePlan(q), /超过/);
  const r = structuredClone(p);
  r.recurring.push({
    id: 'duplicate',
    name: '重复本金',
    kind: 'principal',
    owner: 'household',
    amountCents: 100,
    day: 28,
    liabilityId: 'loan',
    source: '测试',
  });
  assert.throws(() => validatePlan(r), /重复/);
  assert.throws(() => importRepayments(p, 'bad'));
  assert.equal(JSON.stringify(p), original);
  assert.deepEqual(parsePlanJSON(JSON.stringify(p)), p);
});
