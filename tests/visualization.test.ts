import { test } from 'node:test';
import assert from 'node:assert/strict';
import { forecast } from '../src/domain.ts';
import { sample } from '../src/samples.ts';
import {
  forecastMonthIndex,
  resolveTimelineSelection,
  goalCashPositions,
  assetComposition,
} from '../src/visualization.ts';

test('目标映射按日历月份跨年，首末月包含，窗口外不映射', () => {
  assert.equal(forecastMonthIndex('2026-10', '2026-10-01'), 0);
  assert.equal(forecastMonthIndex('2026-10', '2027-03-31'), 5);
  assert.equal(forecastMonthIndex('2026-10', '2028-09-30'), 23);
  assert.equal(forecastMonthIndex('2026-10', '2028-10-01'), null);
  assert.equal(forecastMonthIndex('2026-10', '2026-09-30'), null);
  assert.equal(forecastMonthIndex('2026-10', '2027-13'), null);
  assert.equal(forecastMonthIndex('2026-10', '2027-02-30'), null);
  assert.equal(forecastMonthIndex('2099-10', '2100-01-01'), 3);
});
test('目标编辑后跟随新日期；删除后选最近目标；无目标回到首月', () => {
  const plan = sample(0);
  assert.equal(resolveTimelineSelection(plan, null).monthIndex, 5);
  plan.goals[0].date = '2027-05-10';
  assert.equal(resolveTimelineSelection(plan, { kind: 'goal', id: 'education' }).monthIndex, 7);
  assert.equal(resolveTimelineSelection(plan, { kind: 'goal', id: 'deleted' }).monthIndex, 7);
  assert.deepEqual(resolveTimelineSelection(plan, { kind: 'month', month: '2026-12' }), {
    monthIndex: 2,
    goalId: null,
  });
  plan.goals = [];
  assert.deepEqual(resolveTimelineSelection(plan, null), { monthIndex: 0, goalId: null });
});
test('付款后余额沿用逐笔账目，不用月末余额掩盖日内前后缺口', () => {
  const plan = sample(0);
  assert.equal(goalCashPositions(plan, forecast(plan))[0].cashAfterCents, 1200000);
  assert.equal(
    goalCashPositions(plan, forecast(plan, { salaryPauseMonths: 6 }))[0].cumulativeGapCents,
    13800000,
  );
  plan.goals[0].date = '2026-10-02';
  plan.recurring[0].day = 28;
  const positions = goalCashPositions(plan, forecast(plan));
  assert.equal(positions[0].cashAfterCents, -3000000);
  assert.equal(positions[0].monthIndex, 0);
  assert.notEqual(positions[0].cashAfterCents, forecast(plan).months[0].closingCents);
});
test('同日同名目标按ID独立对应，不因显示顺序改变而重复使用现金', () => {
  const plan = sample(0);
  plan.goals = [
    { ...plan.goals[0], id: 'b', amountCents: 10000000 },
    { ...plan.goals[0], id: 'a', amountCents: 10000000 },
  ];
  const positions = goalCashPositions(plan, forecast(plan));
  assert.deepEqual(
    positions.map((p) => [p.goal.id, p.cashAfterCents, p.cumulativeGapCents]),
    [
      ['a', 6200000, 0],
      ['b', -3800000, 3800000],
    ],
  );
});
test('资产构成只在家庭内部汇总，企业现金单列', () => {
  assert.deepEqual(assetComposition(sample(1)), {
    cashCents: 12000000,
    valuationCents: 0,
    enterpriseCents: 80000000,
    householdDebtCents: 0,
  });
  const p = sample(0);
  assert.equal(assetComposition(p).cashCents, 12000000);
  assert.equal(assetComposition(p).valuationCents, 300000000);
  assert.equal(assetComposition(p).householdDebtCents, 120000000);
});
