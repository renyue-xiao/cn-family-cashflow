import { forecast, type Plan, type Scenario } from './domain.ts';
export function evidence(plan: Plan, scenario: Scenario): string {
  const output = {
    artifact: '家庭现金流解释材料',
    modelStatus: '尚未调用模型',
    generatedAt: new Date().toISOString(),
    instructions: [
      '仅依据下列确定性结果解释，不重新猜测金额。',
      '分别解释家庭现金、资产估值、企业资金、借款、收入、还本和利息。',
      '指出第一个资金缺口的付款日和原因；提出需用户补充的事实，不推荐金融产品。',
      '金额均为人民币整数分，展示时除以100；区分基准与工资中断情景。',
    ],
    conventions: [
      '24个月；期初资产负债快照不自动重估或变现。',
      '逐日记账，同日先收入/借款再支出，支出按ID排序；尚未建模日内到账时刻。',
      '负现金表示尚未筹措的缺口，不自动新增贷款。',
      '已确认一次性事件计入；企业资金排除；分红只以已确认进入家庭的金额计入。',
    ],
    scenario,
    plan,
    baseline: forecast(plan),
    scenarioResult: forecast(plan, scenario),
  };
  return JSON.stringify(output, null, 2);
}
