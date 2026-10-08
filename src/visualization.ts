import type { Forecast, Goal, Plan } from './domain.ts';

export type TimelineSelection = { kind: 'month'; month: string } | { kind: 'goal'; id: string };

/** Calendar month difference, independent of local timezone; 0 is the first forecast month. */
export function forecastMonthIndex(start: string, date: string, horizon = 24): number | null {
  const monthPattern = /^\d{4}-(0[1-9]|1[0-2])$/;
  const datePattern = /^\d{4}-(0[1-9]|1[0-2])-\d{2}$/;
  if (!monthPattern.test(start) || !Number.isInteger(horizon) || horizon < 1) return null;
  if (!monthPattern.test(date)) {
    if (
      !datePattern.test(date) ||
      !Number.isFinite(Date.parse(date)) ||
      new Date(date).toISOString().slice(0, 10) !== date
    )
      return null;
  }
  const [year, month] = start.split('-').map(Number);
  const [targetYear, targetMonth] = date.split('-').map(Number);
  const index = (targetYear - year) * 12 + targetMonth - month;
  return index >= 0 && index < horizon ? index : null;
}

export function orderedGoals(goals: Goal[]): Goal[] {
  return [...goals].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
}

/** Follow a selected goal when its date is edited; deleted selections fall back to the first goal. */
export function resolveTimelineSelection(plan: Plan, selection: TimelineSelection | null) {
  const goals = orderedGoals(plan.goals);
  if (selection?.kind === 'month') {
    const index = forecastMonthIndex(plan.startMonth, selection.month);
    if (index !== null) return { monthIndex: index, goalId: null };
  }
  const goal =
    (selection?.kind === 'goal' ? goals.find((g) => g.id === selection.id) : undefined) ?? goals[0];
  return {
    monthIndex: goal ? (forecastMonthIndex(plan.startMonth, goal.date) ?? 0) : 0,
    goalId: goal?.id ?? null,
  };
}

export function goalCashPositions(plan: Plan, result: Forecast) {
  const goals = orderedGoals(plan.goals);
  return result.months.flatMap((month, monthIndex) => {
    // The domain ledger orders goal entries by date then ID, even when names repeat.
    // Match this order rather than joining on names or amounts.
    const monthGoals = goals.filter((g) => g.date.slice(0, 7) === month.month);
    const entries = month.entries.filter((e) => e.kind === 'goal');
    if (entries.length !== monthGoals.length) throw new Error('目标与现金账不一致，请重新计算');
    return monthGoals.map((goal, i) => ({
      goal,
      monthIndex,
      cashBeforeCents: entries[i].cashCents + goal.amountCents,
      cashAfterCents: entries[i].cashCents,
      cumulativeGapCents: Math.max(0, -entries[i].cashCents),
    }));
  });
}

export function assetComposition(plan: Plan) {
  const total = (predicate: (a: Plan['assets'][number]) => boolean) =>
    plan.assets.filter(predicate).reduce((sum, asset) => sum + asset.amountCents, 0);
  return {
    cashCents: total((a) => a.owner === 'household' && a.kind === 'cash'),
    valuationCents: total((a) => a.owner === 'household' && a.kind !== 'cash'),
    enterpriseCents: total((a) => a.owner === 'enterprise'),
    householdDebtCents: plan.liabilities
      .filter((l) => l.owner === 'household')
      .reduce((sum, l) => sum + l.amountCents, 0),
  };
}
