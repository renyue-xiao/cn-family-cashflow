import { useRef } from 'react';
import type { Forecast, Month, Plan } from './domain';
import { assetComposition, goalCashPositions } from './visualization';

const money = (n: number) =>
  new Intl.NumberFormat('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
    n / 100,
  );
const short = (n: number) => `${(n / 1000000).toFixed(1)}万`;
interface TimelineProps {
  plan: Plan;
  baseline: Forecast;
  result: Forecast;
  monthIndex: number;
  goalId: string | null;
  onMonth: (index: number) => void;
  onGoal: (id: string) => void;
  onEdit: () => void;
}

function MonthStructure({ month }: { month: Month }) {
  const categories = [
    {
      label: '收入',
      value: month.incomeCents,
      tone: 'income',
      note: '工资、经营净收入、确认分红等',
    },
    {
      label: '新增借款',
      value: month.borrowingCents,
      tone: 'borrowing',
      note: '现金流入，同时新增负债',
    },
    { label: '消费', value: month.consumptionCents, tone: 'outflow', note: '日常消费支出' },
    {
      label: '归还本金',
      value: month.principalCents,
      tone: 'outflow',
      note: '减少现金，也减少负债',
    },
    { label: '利息', value: month.interestCents, tone: 'outflow', note: '资金使用成本' },
    { label: '目标付款', value: month.goalsCents, tone: 'goal-flow', note: '按付款日支出' },
  ];
  const scale = Math.max(1, ...categories.map((c) => c.value));
  return (
    <div className="flow-breakdown" aria-label={`${month.month}现金流分类`}>
      {categories.map((c) => (
        <div className="flow-item" key={c.label}>
          <div>
            <strong>{c.label}</strong>
            <span>¥ {money(c.value)}</span>
          </div>
          <div className="flow-track" aria-hidden="true">
            <span className={c.tone} style={{ width: `${(c.value / scale) * 100}%` }} />
          </div>
          <small>{c.note}</small>
        </div>
      ))}
    </div>
  );
}

export function Timeline({
  plan,
  baseline,
  result,
  monthIndex,
  goalId,
  onMonth,
  onGoal,
  onEdit,
}: TimelineProps) {
  const pointRefs = useRef<(SVGGElement | null)[]>([]);
  const current = result.months[monthIndex];
  const goals = goalCashPositions(plan, result);
  const selectedGoal = goals.find((position) => position.goal.id === goalId);
  const baselineGoal = selectedGoal
    ? goalCashPositions(plan, baseline).find((p) => p.goal.id === selectedGoal.goal.id)
    : undefined;
  const min = Math.min(
    0,
    ...baseline.months.map((m) => m.closingCents),
    ...result.months.map((m) => m.closingCents),
  );
  const max = Math.max(
    100,
    baseline.initialCashCents,
    ...baseline.months.map((m) => m.closingCents),
    ...result.months.map((m) => m.closingCents),
  );
  const x = (index: number) => 56 + index * 28.1;
  const y = (value: number) => 174 - ((value - min) / (max - min)) * 146;
  const points = (months: Month[]) =>
    months.map((m, i) => `${x(i)},${y(m.closingCents)}`).join(' ');
  return (
    <>
      <section className="chart-panel" aria-labelledby="timeline-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">现金的时间线</p>
            <h2 id="timeline-title">选一个月份，看钱从哪来、到哪去</h2>
          </div>
          <div className="legend">
            <span className="dot baseline" />
            基准
            <span className="dot stress" />
            当前情景
          </div>
        </div>
        <svg
          viewBox="0 0 740 212"
          role="group"
          aria-label="可选择的24个月现金曲线；方向键切换月份，Enter或空格确认"
        >
          <line x1="56" x2="703" y1={y(0)} y2={y(0)} stroke="#c8cec9" strokeDasharray="4 5" />
          <text x="2" y="20">
            {short(max)}
          </text>
          <text x="2" y="176">
            {short(min)}
          </text>
          <polyline points={points(baseline.months)} fill="none" stroke="#a3b4b8" strokeWidth="3" />
          <polyline points={points(result.months)} fill="none" stroke="#b48343" strokeWidth="3" />
          <line
            x1={x(monthIndex)}
            x2={x(monthIndex)}
            y1="20"
            y2="183"
            stroke="#193d49"
            strokeDasharray="3 4"
          />
          {result.months.map((m, i) => (
            <g
              key={m.month}
              ref={(node) => {
                pointRefs.current[i] = node;
              }}
              role="button"
              tabIndex={i === monthIndex ? 0 : -1}
              aria-pressed={i === monthIndex}
              aria-label={`${m.month}，月末现金${money(m.closingCents)}元`}
              className="chart-point"
              onClick={() => onMonth(i)}
              onKeyDown={(event) => {
                let next: number | undefined;
                if (event.key === 'ArrowLeft') next = Math.max(0, i - 1);
                if (event.key === 'ArrowRight') next = Math.min(result.months.length - 1, i + 1);
                if (event.key === 'Home') next = 0;
                if (event.key === 'End') next = result.months.length - 1;
                if (event.key === 'Enter' || event.key === ' ') next = i;
                if (next !== undefined) {
                  event.preventDefault();
                  onMonth(next);
                  pointRefs.current[next]?.focus();
                }
              }}
            >
              <rect x={x(i) - 14} y="18" width="28" height="170" fill="transparent" />
              <circle
                cx={x(i)}
                cy={y(m.closingCents)}
                r={i === monthIndex ? 6 : 3.5}
                fill={i === monthIndex ? '#193d49' : '#b48343'}
                stroke="white"
                strokeWidth="1.5"
              />
            </g>
          ))}
          {[0, 5, 11, 17, 23].map((i) => (
            <text
              key={i}
              className={i === 5 || i === 17 ? 'intermediate-axis-label' : undefined}
              x={x(i)}
              y="204"
              textAnchor={i === 0 ? 'start' : i === 23 ? 'end' : 'middle'}
            >
              {result.months[i].month}
            </text>
          ))}
        </svg>
        <div className="month-controls">
          <button
            disabled={monthIndex === 0}
            onClick={() => onMonth(monthIndex - 1)}
            aria-label="上一个月"
          >
            ←
          </button>
          <label>
            查看月份
            <select value={monthIndex} onChange={(e) => onMonth(Number(e.target.value))}>
              {result.months.map((m, i) => (
                <option key={m.month} value={i}>
                  {m.month}
                </option>
              ))}
            </select>
          </label>
          <button
            disabled={monthIndex === result.months.length - 1}
            onClick={() => onMonth(monthIndex + 1)}
            aria-label="下一个月"
          >
            →
          </button>
        </div>
        <div className="selected-month" aria-live="polite">
          <div>
            <span>{current.month} 月末可用现金</span>
            <strong className={current.closingCents < 0 ? 'red' : ''}>
              ¥ {money(current.closingCents)}
            </strong>
            <small>基准 ¥ {money(baseline.months[monthIndex].closingCents)}</small>
          </div>
          <div>
            <span>这个月内最低余额</span>
            <strong className={current.lowestCents < 0 ? 'red' : ''}>
              ¥ {money(current.lowestCents)}
            </strong>
            <small>期初现金 ¥ {money(current.openingCents)}</small>
          </div>
        </div>
        <MonthStructure month={current} />
        <p className="caption">
          月末余额 = 期初现金 + 收入 + 借款 − 消费 − 本金 − 利息 −
          目标付款。负数为尚未筹措的缺口。曲线可点击或用方向键操作，下拉框也可选择。
        </p>
      </section>
      <section className="goal-panel" aria-labelledby="goal-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">目标付款时间线</p>
            <h2 id="goal-title">付款日前，现金准备好了吗？</h2>
          </div>
          <button onClick={onEdit}>调整目标与收支 →</button>
        </div>
        {goals.length ? (
          <div className="goal-list">
            {goals.map(({ goal, cumulativeGapCents }) => (
              <button
                key={goal.id}
                className={`goal-card${goalId === goal.id ? ' chosen' : ''}`}
                aria-pressed={goalId === goal.id}
                onClick={() => onGoal(goal.id)}
              >
                <small>{goal.date}</small>
                <strong>{goal.name}</strong>
                <span>付款 ¥ {money(goal.amountCents)}</span>
                <span className={cumulativeGapCents > 0 ? 'red' : ''}>
                  {cumulativeGapCents > 0
                    ? `付款后累计缺口 ¥ ${money(cumulativeGapCents)}`
                    : '付款后现金未为负'}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <p className="caption">
            当前还没有目标。添加付款日和金额，就能与工资、还款一起检验现金是否够用。
          </p>
        )}
        {selectedGoal && baselineGoal && (
          <div className="goal-detail">
            <div>
              <h3>
                {selectedGoal.goal.name} · {selectedGoal.goal.date}
              </h3>
              <p>
                付款前现金 ¥ {money(selectedGoal.cashBeforeCents)} → 付款后{' '}
                <strong className={selectedGoal.cashAfterCents < 0 ? 'red' : ''}>
                  ¥ {money(selectedGoal.cashAfterCents)}
                </strong>
              </p>
              <small>
                付款后基准余额 ¥ {money(baselineGoal.cashAfterCents)} · 来源：
                {selectedGoal.goal.source}
              </small>
            </div>
            <div>
              <span>对应月份 / {result.months[selectedGoal.monthIndex].month}</span>
              <strong
                className={result.months[selectedGoal.monthIndex].closingCents < 0 ? 'red' : ''}
              >
                月末 ¥ {money(result.months[selectedGoal.monthIndex].closingCents)}
              </strong>
              <small>
                基准月末 ¥ {money(baseline.months[selectedGoal.monthIndex].closingCents)}
              </small>
            </div>
          </div>
        )}
        {goals.length > 0 && (
          <p className="caption">
            按日期及同日记录 ID
            排序，共用一份现金总账。每笔显示付款后的累计缺口，不能把卡片缺口相加。日内先流入后流出，付款前仍需核对实际到账。
          </p>
        )}
      </section>
    </>
  );
}

export function AssetComposition({ plan }: { plan: Plan }) {
  const assets = assetComposition(plan);
  const householdTotal = assets.cashCents + assets.valuationCents;
  const percent = householdTotal ? (assets.cashCents / householdTotal) * 100 : 0;
  return (
    <section className="asset-panel" aria-labelledby="asset-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">期初资产构成</p>
          <h2 id="asset-title">资产规模，与可用现金分开看</h2>
        </div>
        <span className="hint">家庭资产 ¥ {money(householdTotal)}</span>
      </div>
      <div className="asset-stack" aria-hidden="true">
        <span style={{ width: `${percent}%` }} />
        <span style={{ width: `${householdTotal ? 100 - percent : 0}%` }} />
      </div>
      <div className="asset-categories">
        <div>
          <span className="asset-key cash-key" />
          家庭可用现金<strong>¥ {money(assets.cashCents)}</strong>
          <small>进入现金流预测</small>
        </div>
        <div>
          <span className="asset-key valuation-key" />
          家庭估值资产<strong>¥ {money(assets.valuationCents)}</strong>
          <small>房产、投资等，不自动变现</small>
        </div>
        <div>
          <span className="asset-key debt-key" />
          家庭负债<strong>¥ {money(assets.householdDebtCents)}</strong>
          <small>单列扣减，不重复计入资产</small>
        </div>
      </div>
      <aside className="enterprise-separate">
        <strong>企业资产单列 ¥ {money(assets.enterpriseCents)}</strong>
        <span>不计入上方家庭资产或可用现金。进入家庭的分红需在一次性收支中确认。</span>
      </aside>
    </section>
  );
}
