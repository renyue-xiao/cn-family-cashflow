export type Owner = 'household' | 'enterprise';
export type FlowKind =
  | 'salary'
  | 'business_income'
  | 'other_income'
  | 'dividend'
  | 'borrowing'
  | 'consumption'
  | 'principal'
  | 'interest';
export interface Asset {
  id: string;
  name: string;
  amountCents: number;
  owner: Owner;
  kind: 'cash' | 'investment' | 'property' | 'other';
  source: string;
}
export interface Liability {
  id: string;
  name: string;
  amountCents: number;
  owner: Owner;
  source: string;
}
export interface Flow {
  id: string;
  name: string;
  amountCents: number;
  kind: FlowKind;
  owner: Owner;
  liabilityId?: string;
  source: string;
}
export interface Recurring extends Flow {
  day: number;
}
export interface Event extends Flow {
  date: string;
  confirmed: boolean;
}
export interface Goal {
  id: string;
  name: string;
  date: string;
  amountCents: number;
  source: string;
}
export interface Repayment {
  id: string;
  date: string;
  liabilityId: string;
  principalCents: number;
  interestCents: number;
  source: string;
}
export interface Plan {
  schemaVersion: 1;
  currency: 'CNY';
  name: string;
  startMonth: string;
  dataMode: 'synthetic' | 'user';
  assets: Asset[];
  liabilities: Liability[];
  recurring: Recurring[];
  events: Event[];
  goals: Goal[];
  repayments: Repayment[];
}
export interface Scenario {
  salaryPauseMonths: number;
}
export interface LedgerEntry {
  date: string;
  name: string;
  kind: FlowKind | 'goal';
  amountCents: number;
  cashCents: number;
  liabilityCents: number;
  source: string;
}
export interface Month {
  month: string;
  openingCents: number;
  incomeCents: number;
  borrowingCents: number;
  consumptionCents: number;
  principalCents: number;
  interestCents: number;
  goalsCents: number;
  closingCents: number;
  lowestCents: number;
  debtCents: number;
  entries: LedgerEntry[];
}
export interface Forecast {
  months: Month[];
  initialCashCents: number;
  netWorthCents: number;
  enterpriseAssetsCents: number;
  firstGap?: LedgerEntry;
  minimumCents: number;
  warnings: string[];
}
const MAX = 1_000_000_000_000;
const kinds: FlowKind[] = [
  'salary',
  'business_income',
  'other_income',
  'dividend',
  'borrowing',
  'consumption',
  'principal',
  'interest',
];
export const kindNames: Record<FlowKind, string> = {
  salary: '工资收入',
  business_income: '家庭经营净收入',
  other_income: '其他收入',
  dividend: '已确认分红',
  borrowing: '新增借款',
  consumption: '日常消费',
  principal: '归还本金',
  interest: '贷款利息',
};
function fail(path: string, message: string): never {
  throw new Error(`${path}：${message}`);
}
function object(x: unknown, p: string): Record<string, unknown> {
  if (!x || typeof x !== 'object' || Array.isArray(x)) fail(p, '应为对象');
  return x as Record<string, unknown>;
}
function string(x: unknown, p: string, max = 300): string {
  if (typeof x !== 'string' || !x.trim() || x.length > max)
    fail(p, `需填写非空文本（最多${max}字）`);
  return x;
}
function enumeration<T extends string>(x: unknown, p: string, values: readonly T[]): T {
  if (typeof x !== 'string' || !values.includes(x as T)) fail(p, `应为 ${values.join(' / ')}`);
  return x as T;
}
function cents(x: unknown, p: string): number {
  if (typeof x !== 'number' || !Number.isSafeInteger(x) || x < 0 || x > MAX)
    fail(p, '应为0至100亿元内的整数分');
  return x;
}
function date(x: unknown, p: string): string {
  const s = string(x, p, 10);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(s) ||
    !Number.isFinite(Date.parse(s)) ||
    new Date(s).toISOString().slice(0, 10) !== s
  )
    fail(p, '日期须为有效的 YYYY-MM-DD');
  return s;
}
export function monthAt(start: string, index: number): string {
  const [y, m] = start.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1 + index, 1)).toISOString().slice(0, 7);
}
function add(a: number, b: number): number {
  const n = a + b;
  if (!Number.isSafeInteger(n)) throw new Error('合计超出安全整数范围');
  return n;
}
export function moneyToCents(value: string, unit: 'yuan' | 'wan' = 'yuan'): number {
  if (!/^\d+(\.\d{1,2})?$/.test(value.trim())) throw new Error('金额需为非负数字，最多两位小数');
  const [whole, fraction = ''] = value.trim().split('.');
  const n = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
  const result = n * (unit === 'wan' ? 10000n : 1n);
  if (result > BigInt(MAX)) throw new Error('金额超出允许范围');
  return Number(result);
}
export function validatePlan(raw: unknown): Plan {
  const p = object(raw, '计划');
  if (p.schemaVersion !== 1) fail('schemaVersion', '仅支持版本1');
  if (p.currency !== 'CNY') fail('currency', '本版仅支持CNY人民币');
  const start = string(p.startMonth, 'startMonth', 7);
  if (!/^(20\d{2})-(0[1-9]|1[0-2])$/.test(start)) fail('startMonth', '须为2000至2099年的 YYYY-MM');
  const end = monthAt(start, 24) + '-01';
  const ids = new Set<string>();
  function rows<T>(key: string, parse: (r: Record<string, unknown>, path: string) => T): T[] {
    const arr = p[key];
    if (!Array.isArray(arr) || arr.length > 200) fail(key, '应为数组，最多200行');
    return arr.map((r, i) => parse(object(r, `${key}[${i}]`), `${key}[${i}]`));
  }
  function base(r: Record<string, unknown>, path: string) {
    const id = string(r.id, path + '.id', 100);
    if (ids.has(id)) fail(path + '.id', 'ID重复');
    ids.add(id);
    return { id, source: string(r.source, path + '.source', 500) };
  }
  function owner(r: Record<string, unknown>, path: string) {
    return enumeration(r.owner, path + '.owner', ['household', 'enterprise']);
  }
  function dated(r: Record<string, unknown>, path: string) {
    const d = date(r.date, path + '.date');
    if (d < start + '-01' || d >= end) fail(path + '.date', '须在计划24个月内');
    return d;
  }
  const assets = rows('assets', (r, s) => ({
    ...base(r, s),
    name: string(r.name, s + '.name'),
    amountCents: cents(r.amountCents, s + '.amountCents'),
    owner: owner(r, s),
    kind: enumeration(r.kind, s + '.kind', ['cash', 'investment', 'property', 'other']),
  }));
  const liabilities = rows('liabilities', (r, s) => ({
    ...base(r, s),
    name: string(r.name, s + '.name'),
    amountCents: cents(r.amountCents, s + '.amountCents'),
    owner: owner(r, s),
  }));
  function flow(r: Record<string, unknown>, s: string): Flow {
    const kind = enumeration(r.kind, s + '.kind', kinds),
      o = owner(r, s);
    const result: Flow = {
      ...base(r, s),
      name: string(r.name, s + '.name'),
      amountCents: cents(r.amountCents, s + '.amountCents'),
      kind,
      owner: o,
    };
    if (r.liabilityId !== undefined && r.liabilityId !== '') {
      result.liabilityId = string(r.liabilityId, s + '.liabilityId');
      const liability = liabilities.find((l) => l.id === result.liabilityId);
      if (!liability || liability.owner !== o) fail(s + '.liabilityId', '需引用同一归属的有效负债');
    }
    if (['borrowing', 'principal'].includes(kind) && !result.liabilityId)
      fail(s + '.liabilityId', '借款和还本必须关联负债');
    return result;
  }
  const recurring = rows('recurring', (r, s) => {
    const day = r.day;
    if (typeof day !== 'number' || !Number.isInteger(day) || day < 1 || day > 28)
      fail(s + '.day', '每月日期须为1至28的整数');
    const f = flow(r, s);
    if (f.kind === 'dividend') fail(s + '.kind', '分红应填入一次性事件，逐笔确认');
    return { ...f, day };
  });
  const events = rows('events', (r, s) => {
    if (typeof r.confirmed !== 'boolean') fail(s + '.confirmed', '应为布尔值');
    return { ...flow(r, s), date: dated(r, s), confirmed: r.confirmed };
  });
  const goals = rows('goals', (r, s) => ({
    ...base(r, s),
    name: string(r.name, s + '.name'),
    date: dated(r, s),
    amountCents: cents(r.amountCents, s + '.amountCents'),
  }));
  const repaymentKeys = new Set<string>();
  const repayments = rows('repayments', (r, s) => {
    const liabilityId = string(r.liabilityId, s + '.liabilityId');
    const l = liabilities.find((l) => l.id === liabilityId);
    if (!l || l.owner !== 'household') fail(s + '.liabilityId', '须为家庭负债ID');
    const d = dated(r, s),
      key = liabilityId + ':' + d;
    if (repaymentKeys.has(key)) fail(s + '.date', '同一负债同日还款重复');
    repaymentKeys.add(key);
    if (
      recurring.some(
        (f) => f.liabilityId === liabilityId && ['principal', 'interest'].includes(f.kind),
      ) ||
      events.some(
        (f) =>
          f.liabilityId === liabilityId &&
          f.date.slice(0, 7) === d.slice(0, 7) &&
          ['principal', 'interest'].includes(f.kind),
      )
    )
      fail(s + '.liabilityId', '还款表与月度/一次性还款重复，请只保留一种记录');
    return {
      ...base(r, s),
      date: d,
      liabilityId,
      principalCents: cents(r.principalCents, s + '.principalCents'),
      interestCents: cents(r.interestCents, s + '.interestCents'),
    };
  });
  const result: Plan = {
    schemaVersion: 1,
    currency: 'CNY',
    name: string(p.name, 'name'),
    startMonth: start,
    dataMode: enumeration(p.dataMode, 'dataMode', ['synthetic', 'user']),
    assets,
    liabilities,
    recurring,
    events,
    goals,
    repayments,
  };
  forecastUnchecked(result, { salaryPauseMonths: 0 });
  return result;
}
export function forecast(input: Plan, scenario: Scenario = { salaryPauseMonths: 0 }): Forecast {
  return forecastUnchecked(validatePlan(input), scenario);
}
function forecastUnchecked(p: Plan, scenario: Scenario): Forecast {
  if (
    !Number.isInteger(scenario.salaryPauseMonths) ||
    scenario.salaryPauseMonths < 0 ||
    scenario.salaryPauseMonths > 24
  )
    fail('工资中断月数', '须为0至24的整数');
  const sum = (a: { amountCents: number }[]) => a.reduce((s, x) => add(s, x.amountCents), 0);
  const household = p.assets.filter((a) => a.owner === 'household');
  const debt = new Map(
    p.liabilities.filter((l) => l.owner === 'household').map((l) => [l.id, l.amountCents]),
  );
  const initialCashCents = sum(household.filter((a) => a.kind === 'cash'));
  let cash = initialCashCents;
  let minimum = cash;
  let firstGap: LedgerEntry | undefined;
  const warnings: string[] = [];
  if (p.assets.some((a) => a.owner === 'enterprise'))
    warnings.push('企业资产单列，不计入家庭现金或净资产。');
  if (p.events.some((e) => !e.confirmed)) warnings.push('未确认事件不进入预测。');
  const months: Month[] = [];
  for (let i = 0; i < 24; i++) {
    const m = monthAt(p.startMonth, i);
    const result: Month = {
      month: m,
      openingCents: cash,
      incomeCents: 0,
      borrowingCents: 0,
      consumptionCents: 0,
      principalCents: 0,
      interestCents: 0,
      goalsCents: 0,
      closingCents: cash,
      lowestCents: cash,
      debtCents: 0,
      entries: [],
    };
    const pending: (Omit<Flow, 'kind'> & { date: string; kind: FlowKind | 'goal' })[] = [];
    for (const f of p.recurring)
      if (f.owner === 'household' && !(f.kind === 'salary' && i < scenario.salaryPauseMonths))
        pending.push({ ...f, date: `${m}-${String(f.day).padStart(2, '0')}` });
    for (const f of p.events)
      if (
        f.owner === 'household' &&
        f.confirmed &&
        f.date.startsWith(m) &&
        !(f.kind === 'salary' && i < scenario.salaryPauseMonths)
      )
        pending.push(f);
    for (const g of p.goals)
      if (g.date.startsWith(m)) pending.push({ ...g, owner: 'household', kind: 'goal' });
    for (const r of p.repayments)
      if (r.date.startsWith(m)) {
        const name = p.liabilities.find((l) => l.id === r.liabilityId)!.name;
        pending.push(
          {
            ...r,
            name: name + '本金',
            owner: 'household',
            kind: 'principal',
            amountCents: r.principalCents,
          },
          {
            ...r,
            id: r.id + '-interest',
            name: name + '利息',
            owner: 'household',
            kind: 'interest',
            amountCents: r.interestCents,
          },
        );
      }
    const isIn = (k: string) =>
      ['salary', 'business_income', 'other_income', 'dividend', 'borrowing'].includes(k);
    pending.sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        Number(isIn(b.kind)) - Number(isIn(a.kind)) ||
        a.id.localeCompare(b.id),
    );
    for (const f of pending) {
      const incoming = isIn(f.kind);
      cash = add(cash, incoming ? f.amountCents : -f.amountCents);
      if (f.kind === 'borrowing')
        debt.set(f.liabilityId!, add(debt.get(f.liabilityId!)!, f.amountCents));
      if (f.kind === 'principal') {
        const balance = debt.get(f.liabilityId!)!;
        if (f.amountCents > balance) fail(f.name + ' ' + f.date, '归还本金超过该笔剩余负债');
        debt.set(f.liabilityId!, balance - f.amountCents);
      }
      const key: keyof Pick<
        Month,
        | 'incomeCents'
        | 'borrowingCents'
        | 'principalCents'
        | 'interestCents'
        | 'consumptionCents'
        | 'goalsCents'
      > =
        f.kind === 'borrowing'
          ? 'borrowingCents'
          : f.kind === 'principal'
            ? 'principalCents'
            : f.kind === 'interest'
              ? 'interestCents'
              : f.kind === 'consumption'
                ? 'consumptionCents'
                : f.kind === 'goal'
                  ? 'goalsCents'
                  : 'incomeCents';
      result[key] = add(result[key], f.amountCents);
      const entry: LedgerEntry = {
        date: f.date,
        name: f.name,
        kind: f.kind,
        amountCents: f.amountCents,
        cashCents: cash,
        liabilityCents: [...debt.values()].reduce(add, 0),
        source: f.source,
      };
      result.entries.push(entry);
      result.lowestCents = Math.min(result.lowestCents, cash);
      minimum = Math.min(minimum, cash);
      if (cash < 0 && !firstGap) firstGap = entry;
    }
    result.closingCents = cash;
    result.debtCents = [...debt.values()].reduce(add, 0);
    months.push(result);
  }
  return {
    months,
    initialCashCents,
    netWorthCents: sum(household) - sum(p.liabilities.filter((l) => l.owner === 'household')),
    enterpriseAssetsCents: sum(p.assets.filter((a) => a.owner === 'enterprise')),
    minimumCents: minimum,
    firstGap,
    warnings,
  };
}
