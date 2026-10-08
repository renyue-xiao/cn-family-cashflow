import { moneyToCents, validatePlan, type Plan, type Repayment } from './domain.ts';
export const MAX_BYTES = 200000;
export function parsePlanJSON(text: string): Plan {
  if (new TextEncoder().encode(text).length > MAX_BYTES)
    throw new Error('JSON超过200KB，请减少明细');
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('JSON语法错误，当前计划未变更');
  }
  return validatePlan(raw);
}
// Deliberately narrow: no silently guessed column meanings, currencies or encodings.
export function parseRepaymentCSV(text: string): Repayment[] {
  if (new TextEncoder().encode(text).length > MAX_BYTES) throw new Error('CSV超过200KB');
  const lines = text
    .replace(/^\uFEFF/, '')
    .trim()
    .split(/\r?\n/);
  if (lines.shift() !== 'date,loan_id,principal_yuan,interest_yuan,source')
    throw new Error(
      'CSV表头须为 date,loan_id,principal_yuan,interest_yuan,source（UTF-8，金额单位元）',
    );
  if (lines.length === 0 || lines.length > 200) throw new Error('CSV需有1至200行还款');
  return lines.map((line, i) => {
    const cols = line.split(',');
    if (line.includes('"') || cols.length !== 5 || cols.some((s) => !s.trim()))
      throw new Error(`CSV第${i + 2}行：需5列非空值；本版不支持值内逗号或引号`);
    const [date, liabilityId, p, interest, source] = cols.map((s) => s.trim());
    try {
      return {
        id: `csv-repayment-${i + 1}`,
        date,
        liabilityId,
        principalCents: moneyToCents(p),
        interestCents: moneyToCents(interest),
        source,
      };
    } catch (e) {
      throw new Error(`CSV第${i + 2}行：${(e as Error).message}`, { cause: e });
    }
  });
}
export function importRepayments(plan: Plan, text: string): Plan {
  return validatePlan({ ...plan, dataMode: 'user', repayments: parseRepaymentCSV(text) });
}
export function repaymentsCSV(plan: Plan): string {
  return (
    '\uFEFFdate,loan_id,principal_yuan,interest_yuan,source\n' +
    plan.repayments
      .map((r) =>
        [
          r.date,
          r.liabilityId,
          (r.principalCents / 100).toFixed(2),
          (r.interestCents / 100).toFixed(2),
          r.source.replace(/[,\r\n"]/g, ' '),
        ].join(','),
      )
      .join('\n')
  );
}
