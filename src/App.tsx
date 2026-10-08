import { useEffect, useMemo, useRef, useState } from 'react';
import {
  forecast,
  kindNames,
  moneyToCents,
  validatePlan,
  type Plan,
  type FlowKind,
} from './domain';
import { sample, samples } from './samples';
import type { Adapter, Snapshot } from './adapters';
import { parsePlanJSON, importRepayments, repaymentsCSV, MAX_BYTES } from './import';
import { evidence } from './evidence';
const money = (n: number) =>
  new Intl.NumberFormat('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
    n / 100,
  );
const short = (n: number) => `${(n / 1000000).toFixed(1)}万`;
type Collection = 'assets' | 'liabilities' | 'recurring' | 'events' | 'goals' | 'repayments';
type RowField<T> = T extends unknown ? keyof T : never;
type EditableField = RowField<Plan[Collection][number]>;
function isFlowKind(value: string): value is FlowKind {
  return Object.hasOwn(kindNames, value);
}
const groups: { key: Collection; name: string }[] = [
  { key: 'assets', name: '资产' },
  { key: 'liabilities', name: '负债' },
  { key: 'recurring', name: '每月收支' },
  { key: 'events', name: '一次性收支' },
  { key: 'goals', name: '目标付款' },
  { key: 'repayments', name: '贷款还款表' },
];
function EditableTextField({
  value,
  label,
  onCommit,
  type = 'text',
}: {
  value: string;
  label: string;
  onCommit: (s: string) => boolean;
  type?: string;
}) {
  const [draft, setDraft] = useState(value);
  return (
    <input
      aria-label={label}
      type={type}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (!onCommit(draft)) setDraft(value);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
      }}
    />
  );
}
function TextField(props: Parameters<typeof EditableTextField>[0]) {
  return <EditableTextField key={props.value} {...props} />;
}
function MoneyField({
  value,
  label,
  onCommit,
  onError,
}: {
  value: number;
  label: string;
  onCommit: (n: number) => boolean;
  onError: (s: string) => void;
}) {
  return (
    <TextField
      value={(value / 100).toFixed(2)}
      label={label}
      onCommit={(s) => {
        try {
          return onCommit(moneyToCents(s));
        } catch (e) {
          onError(label + '：' + (e as Error).message);
          return false;
        }
      }}
    />
  );
}
export function App({ adapter }: { adapter: Adapter }) {
  const [plan, setPlan] = useState<Plan>(() => sample(0)),
    [pause, setPause] = useState(0),
    [tab, setTab] = useState('overview'),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [dirty, setDirty] = useState(false),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [snapshot, setSnapshot] = useState<Snapshot | null>(null),
    [selected, setSelected] = useState<string[]>([]),
    [json, setJson] = useState(''),
    [month, setMonth] = useState(5);
  const fileRef = useRef<HTMLInputElement>(null),
    csvRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    let active = true;
    adapter
      .load()
      .then((text) => {
        if (active && text) {
          setPlan(parsePlanJSON(text));
          setNotice('已恢复上次保存的计划。');
        }
      })
      .catch((e) => {
        if (active)
          setError('读取已保存计划失败：' + e.message + '。当前显示合成案例，原存储未覆盖。');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [adapter]);
  const base = useMemo(() => forecast(plan), [plan]),
    result = useMemo(() => forecast(plan, { salaryPauseMonths: pause }), [plan, pause]);
  function commit(next: unknown): boolean {
    try {
      const valid = validatePlan(next);
      setPlan(valid);
      setDirty(true);
      setError('');
      setNotice('');
      return true;
    } catch (e) {
      setError((e as Error).message + '；本次修改未应用。');
      return false;
    }
  }
  function modify(fn: (p: Plan) => void): boolean {
    const next = structuredClone(plan);
    fn(next);
    next.dataMode = 'user';
    return commit(next);
  }
  function rowUpdate(key: Collection, index: number, field: EditableField, value: unknown) {
    return modify((p) => {
      Object.assign(p[key][index], { [field]: value });
    });
  }
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function exportText(text: string, name: string) {
    await run(async () => {
      setNotice(
        (await adapter.exportFile(text, name))
          ? '已交给保存/下载入口，请查看目标文件。'
          : '已取消导出。',
      );
    });
  }
  async function readFile(file: File | undefined, csv = false) {
    if (!file) return;
    await run(async () => {
      if (file.size > MAX_BYTES) throw new Error('文件超过200KB，当前计划未变更');
      const text = await file.text();
      const next = csv ? importRepayments(plan, text) : parsePlanJSON(text);
      if (commit(next))
        setNotice(
          csv ? '还款表已替换；本金与利息分列。' : 'JSON校验通过，已载入；点击保存后持久化。',
        );
    });
  }
  function addRow(key: Collection) {
    const id = 'manual-' + crypto.randomUUID(),
      source = '手工录入，待核对';
    const common = { id, name: '新增记录', amountCents: 0, owner: 'household' as const, source };
    modify((p) => {
      switch (key) {
        case 'assets':
          p.assets.push({ ...common, kind: 'cash' });
          break;
        case 'liabilities':
          p.liabilities.push(common);
          break;
        case 'recurring':
          p.recurring.push({ ...common, day: 1, kind: 'salary' });
          break;
        case 'events':
          p.events.push({
            ...common,
            date: p.startMonth + '-01',
            kind: 'other_income',
            confirmed: false,
          });
          break;
        case 'goals':
          p.goals.push({ id, name: '新目标', amountCents: 0, date: p.startMonth + '-01', source });
          break;
        case 'repayments':
          p.repayments.push({
            id,
            date: p.startMonth + '-28',
            liabilityId: p.liabilities.find((l) => l.owner === 'household')?.id ?? '',
            principalCents: 0,
            interestCents: 0,
            source,
          });
          break;
      }
    });
  }

  const min = Math.min(
    0,
    ...base.months.map((m) => m.closingCents),
    ...result.months.map((m) => m.closingCents),
  );
  const max = Math.max(
    base.initialCashCents,
    ...base.months.map((m) => m.closingCents),
    ...result.months.map((m) => m.closingCents),
    100,
  );
  const y = (v: number) => 174 - ((v - min) / (max - min)) * 146;
  const points = (ms: typeof result.months) =>
    ms.map((m, i) => `${45 + i * 28.7},${y(m.closingCents)}`).join(' ');
  if (loading)
    return (
      <div className="family-app">
        <main>
          <h1>家有余量</h1>
          <p role="status">正在读取已保存计划，请稍候…</p>
        </main>
      </div>
    );
  return (
    <div className="family-app">
      <fieldset className="workspace" disabled={busy}>
        <header className="topbar">
          <a className="brand" href="#main">
            <span className="brand-mark">余</span>
            <span>
              家有余量<small>家庭现金流与目标规划</small>
            </span>
          </a>
          <span className="mode">
            {adapter.mode === 'demo' ? '独立演示 · 本地保存' : 'Wealthfolio 插件 · 真实宿主接口'}
          </span>
        </header>
        <main id="main">
          <div className="heading">
            <div>
              <p className="eyebrow">FAMILY CASHFLOW / 24 MONTHS</p>
              <h1>
                把未来的付款日，
                <br className="mobile-br" />
                放进今天的安排。
              </h1>
              <p className="intro">先看手边能用的钱，再看每一笔目标何时到期。</p>
            </div>
            <div className="sample-picker">
              <label htmlFor="sample">切换合成家庭样例</label>
              <select
                id="sample"
                value=""
                disabled={loading || busy}
                onChange={(e) => {
                  if (e.target.value !== '') {
                    setPlan(sample(Number(e.target.value)));
                    setDirty(true);
                    setError('');
                    setNotice('已载入合成样例；仅在点击保存时覆盖存储。');
                    setSnapshot(null);
                    setPause(0);
                  }
                }}
              >
                <option value="">选择案例…</option>
                {samples.map((p, i) => (
                  <option key={i} value={i}>
                    {p.name}
                  </option>
                ))}
              </select>
              <small>切换替换当前未保存编辑，可先导出备份。</small>
            </div>
          </div>
          <div className="planbar">
            <div>
              <strong>{plan.name}</strong>
              <span className="pill">
                {plan.dataMode === 'synthetic' ? '合成案例' : '手工编辑 / 导入'}
              </span>
              <small>
                {plan.startMonth} 起 · 人民币 · {dirty ? '有未保存修改' : '已载入'}
              </small>
            </div>
            <div className="actions">
              <button
                className="primary"
                disabled={busy || loading}
                onClick={() =>
                  run(async () => {
                    const text = JSON.stringify(validatePlan(plan));
                    if (new TextEncoder().encode(text).length > MAX_BYTES)
                      throw new Error('计划超过200KB，请减少明细');
                    await adapter.save(text);
                    setDirty(false);
                    setNotice(
                      adapter.mode === 'demo'
                        ? '已保存到本浏览器本地存储。'
                        : '已写入插件存储；同步由宿主设置决定。',
                    );
                  })
                }
              >
                保存计划
              </button>
              <button disabled={busy || loading} onClick={() => fileRef.current?.click()}>
                导入 JSON
              </button>
              <button
                disabled={busy}
                onClick={() => exportText(JSON.stringify(plan, null, 2), '家庭规划.json')}
              >
                导出 JSON
              </button>
            </div>
          </div>
          <input
            hidden
            type="file"
            accept=".json,application/json"
            ref={fileRef}
            onChange={(e) => {
              void readFile(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
          <input
            hidden
            type="file"
            accept=".csv,text/csv"
            ref={csvRef}
            onChange={(e) => {
              void readFile(e.target.files?.[0], true);
              e.target.value = '';
            }}
          />
          {error && (
            <div className="message error" role="alert">
              {error}
              <button aria-label="关闭错误提示" onClick={() => setError('')}>
                ×
              </button>
            </div>
          )}
          {notice && (
            <div className="message" role="status">
              {notice}
            </div>
          )}
          {loading && <p role="status">读取已保存计划…</p>}
          <nav className="tabs" aria-label="规划工作区">
            {[
              ['overview', '规划总览'],
              ['edit', '三张表与明细'],
              ['connect', '来源与宿主'],
              ['ai', '解释材料'],
            ].map(([id, name]) => (
              <button
                key={id}
                aria-current={tab === id ? 'page' : undefined}
                onClick={() => setTab(id)}
              >
                {name}
              </button>
            ))}
          </nav>
          {tab === 'overview' && (
            <>
              <div className="scenario">
                <div>
                  <strong>先做一次压力测试</strong>
                  <p>暂停前 {pause} 个月工资，其余已确认收支继续。</p>
                </div>
                <div className="scenario-buttons">
                  <button className={pause === 0 ? 'selected' : ''} onClick={() => setPause(0)}>
                    基准安排
                  </button>
                  <button className={pause === 6 ? 'selected' : ''} onClick={() => setPause(6)}>
                    工资中断 6 个月
                  </button>
                  <label>
                    月数{' '}
                    <input
                      aria-label="工资中断月数"
                      type="number"
                      min="0"
                      max="24"
                      value={pause}
                      onChange={(e) => {
                        const n = Number(e.target.value);
                        if (Number.isInteger(n) && n >= 0 && n <= 24) setPause(n);
                      }}
                    />
                  </label>
                </div>
              </div>
              <div className="metrics">
                <article>
                  <span>期初可用现金</span>
                  <strong>¥ {money(result.initialCashCents)}</strong>
                  <small>仅家庭现金；估值资产不自动变现</small>
                </article>
                <article>
                  <span>期初家庭净资产</span>
                  <strong>¥ {money(result.netWorthCents)}</strong>
                  <small>家庭资产估值减家庭负债</small>
                </article>
                <article className={result.minimumCents < 0 ? 'negative' : 'positive'}>
                  <span>24 个月内最低可用余额</span>
                  <strong>¥ {money(result.minimumCents)}</strong>
                  <small>
                    {result.firstGap
                      ? '首次缺口：' + result.firstGap.date + ' · ' + result.firstGap.name
                      : '按当前付款日安排，未出现资金缺口'}
                  </small>
                </article>
              </div>
              <section className="chart-panel">
                <div className="section-heading">
                  <div>
                    <p className="eyebrow">现金的时间线</p>
                    <h2>让目标与每月结余对上时间</h2>
                  </div>
                  <div className="legend">
                    <span className="dot baseline" />
                    基准
                    <span className="dot stress" />
                    当前情景
                  </div>
                </div>
                <svg
                  viewBox="0 0 740 205"
                  role="img"
                  aria-label="24个月月末可用现金，具体金额见下方明细表"
                >
                  <line
                    x1="45"
                    x2="720"
                    y1={y(0)}
                    y2={y(0)}
                    stroke="#c8cec9"
                    strokeDasharray="4 5"
                  />
                  <text x="3" y="24">
                    {short(max)}
                  </text>
                  <text x="3" y="175">
                    {short(min)}
                  </text>
                  <polyline
                    points={points(base.months)}
                    fill="none"
                    stroke="#a3b4b8"
                    strokeWidth="3"
                  />
                  <polyline
                    points={points(result.months)}
                    fill="none"
                    stroke="#b48343"
                    strokeWidth="3"
                  />
                  {[0, 5, 11, 17, 23].map((i) => (
                    <g key={i}>
                      <circle
                        cx={45 + i * 28.7}
                        cy={y(result.months[i].closingCents)}
                        r="4"
                        fill="#b48343"
                      />
                      <text x={45 + i * 28.7} y="199" textAnchor="middle">
                        {result.months[i].month}
                      </text>
                    </g>
                  ))}
                </svg>
                <p className="caption">
                  曲线显示月末余额；付款日缺口见月内最低余额。负数是尚未筹措的缺口，不自动视为借款。
                </p>
              </section>
              <div className="goal-strip">
                <div>
                  <span className="eyebrow">最近目标</span>
                  <h3>
                    {[...plan.goals].sort((a, b) => a.date.localeCompare(b.date))[0]?.name ??
                      '当前尚未设置目标'}
                  </h3>
                  <p>
                    {[...plan.goals].sort((a, b) => a.date.localeCompare(b.date))[0]?.date ??
                      '到明细页添加付款日与金额'}
                  </p>
                </div>
                <div>
                  <span>第 6 个月月末 / {result.months[5].month}</span>
                  <strong className={result.months[5].closingCents < 0 ? 'red' : ''}>
                    ¥ {money(result.months[5].closingCents)}
                  </strong>
                  <small>基准为 ¥ {money(base.months[5].closingCents)}</small>
                </div>
                <button onClick={() => setTab('edit')}>调整目标与收支 →</button>
              </div>
              <section>
                <div className="section-heading">
                  <div>
                    <p className="eyebrow">可核对的明细</p>
                    <h2>24 个月家庭现金账</h2>
                  </div>
                  <span className="hint">单位：人民币元</span>
                </div>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        {[
                          '月份',
                          '收入',
                          '新增借款',
                          '消费',
                          '本金',
                          '利息',
                          '目标付款',
                          '月末余额',
                          '月内最低',
                          '期末负债',
                        ].map((h) => (
                          <th key={h}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {result.months.map((m, i) => (
                        <tr key={m.month} className={month === i ? 'active-row' : ''}>
                          <th>
                            <button className="text-button" onClick={() => setMonth(i)}>
                              {m.month}
                            </button>
                          </th>
                          {[
                            m.incomeCents,
                            m.borrowingCents,
                            m.consumptionCents,
                            m.principalCents,
                            m.interestCents,
                            m.goalsCents,
                            m.closingCents,
                            m.lowestCents,
                            m.debtCents,
                          ].map((v, j) => (
                            <td className={v < 0 ? 'red' : ''} key={j}>
                              {money(v)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <details className="ledger" open>
                  <summary>{result.months[month].month} 逐笔账目（点击月份切换）</summary>
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>日期</th>
                          <th>事项</th>
                          <th>金额</th>
                          <th>变动后现金</th>
                          <th>来源</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.months[month].entries.map((e, i) => (
                          <tr key={i}>
                            <td>{e.date}</td>
                            <td>{e.name}</td>
                            <td>{money(e.amountCents)}</td>
                            <td className={e.cashCents < 0 ? 'red' : ''}>{money(e.cashCents)}</td>
                            <td className="source-cell">{e.source}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              </section>
            </>
          )}
          {tab === 'edit' && (
            <section className="editor">
              <h2>三张表，接到同一份现金账</h2>
              <p>
                资产负债看存量，收入支出看每月结余，目标看付款日。金额单位为元，离开输入框或按 Enter
                后校验并应用。
              </p>
              <div className="inline-fields">
                <label>
                  计划名称
                  <TextField
                    value={plan.name}
                    label="计划名称"
                    onCommit={(v) =>
                      modify((p) => {
                        p.name = v;
                      })
                    }
                  />
                </label>
                <label>
                  起始月份
                  <TextField
                    type="month"
                    value={plan.startMonth}
                    label="起始月份"
                    onCommit={(v) =>
                      modify((p) => {
                        p.startMonth = v;
                      })
                    }
                  />
                </label>
              </div>
              {groups.map(({ key, name }) => (
                <details
                  key={key}
                  open={key === 'assets' || key === 'recurring' || key === 'goals'}
                >
                  <summary>
                    {name}
                    <span>{plan[key].length} 条</span>
                  </summary>
                  <div className="table-scroll">
                    <table className="edit-table">
                      <thead>
                        <tr>
                          <th>名称 / ID</th>
                          <th>金额（元）</th>
                          <th>归属 / 类型</th>
                          <th>日期 / 关联负债</th>
                          <th>来源依据</th>
                          <th>操作</th>
                        </tr>
                      </thead>
                      <tbody>
                        {plan[key].map((item, index) => {
                          const row = item;
                          return (
                            <tr key={row.id}>
                              <td>
                                {'name' in row && (
                                  <TextField
                                    value={row.name}
                                    label={`${name}${index + 1}名称`}
                                    onCommit={(v) => rowUpdate(key, index, 'name', v)}
                                  />
                                )}
                                <small className="row-id">{row.id}</small>
                              </td>
                              <td>
                                {'amountCents' in row ? (
                                  <MoneyField
                                    value={row.amountCents}
                                    label={`${name}${index + 1}金额`}
                                    onCommit={(v) => rowUpdate(key, index, 'amountCents', v)}
                                    onError={setError}
                                  />
                                ) : (
                                  <>
                                    <label>
                                      本金
                                      <MoneyField
                                        value={row.principalCents}
                                        label={`还款${index + 1}本金`}
                                        onCommit={(v) => rowUpdate(key, index, 'principalCents', v)}
                                        onError={setError}
                                      />
                                    </label>
                                    <label>
                                      利息
                                      <MoneyField
                                        value={row.interestCents}
                                        label={`还款${index + 1}利息`}
                                        onCommit={(v) => rowUpdate(key, index, 'interestCents', v)}
                                        onError={setError}
                                      />
                                    </label>
                                  </>
                                )}
                              </td>
                              <td>
                                {'owner' in row && (
                                  <select
                                    aria-label={`${name}${index + 1}归属`}
                                    value={row.owner}
                                    onChange={(e) => rowUpdate(key, index, 'owner', e.target.value)}
                                  >
                                    <option value="household">家庭</option>
                                    <option value="enterprise">企业（排除）</option>
                                  </select>
                                )}
                                {key === 'assets' && 'kind' in row && (
                                  <select
                                    aria-label={`资产${index + 1}类型`}
                                    value={row.kind}
                                    onChange={(e) => rowUpdate(key, index, 'kind', e.target.value)}
                                  >
                                    {Object.entries({
                                      cash: '可用现金',
                                      investment: '投资市值',
                                      property: '房产估值',
                                      other: '其他估值',
                                    }).map(([v, l]) => (
                                      <option key={v} value={v}>
                                        {l}
                                      </option>
                                    ))}
                                  </select>
                                )}
                                {(key === 'recurring' || key === 'events') && 'kind' in row && (
                                  <select
                                    aria-label={`${name}${index + 1}收支类型`}
                                    value={row.kind}
                                    onChange={(e) =>
                                      modify((p) => {
                                        const r = p[key][index];
                                        const kind = e.target.value;
                                        if (!isFlowKind(kind)) return;
                                        r.kind = kind;
                                        if (
                                          (kind === 'borrowing' || kind === 'principal') &&
                                          !r.liabilityId
                                        )
                                          r.liabilityId = p.liabilities.find(
                                            (l) => l.owner === r.owner,
                                          )?.id;
                                      })
                                    }
                                  >
                                    {Object.entries(kindNames)
                                      .filter(([v]) => key === 'events' || v !== 'dividend')
                                      .map(([v, l]) => (
                                        <option key={v} value={v}>
                                          {l}
                                        </option>
                                      ))}
                                  </select>
                                )}
                                {key === 'events' && 'confirmed' in row && (
                                  <label className="checkbox">
                                    <input
                                      type="checkbox"
                                      checked={row.confirmed}
                                      onChange={(e) =>
                                        rowUpdate(key, index, 'confirmed', e.target.checked)
                                      }
                                    />
                                    已确认进入家庭
                                  </label>
                                )}
                              </td>
                              <td>
                                {'date' in row && (
                                  <TextField
                                    type="date"
                                    value={row.date}
                                    label={`${name}${index + 1}日期`}
                                    onCommit={(v) => rowUpdate(key, index, 'date', v)}
                                  />
                                )}{' '}
                                {'day' in row && (
                                  <label>
                                    每月几日
                                    <TextField
                                      type="number"
                                      value={String(row.day)}
                                      label={`${name}${index + 1}每月日期`}
                                      onCommit={(v) => rowUpdate(key, index, 'day', Number(v))}
                                    />
                                  </label>
                                )}
                                {['recurring', 'events', 'repayments'].includes(key) && (
                                  <select
                                    aria-label={`${name}${index + 1}关联负债`}
                                    value={'liabilityId' in row ? (row.liabilityId ?? '') : ''}
                                    onChange={(e) =>
                                      rowUpdate(key, index, 'liabilityId', e.target.value)
                                    }
                                  >
                                    <option value="">不关联负债</option>
                                    {plan.liabilities.map((l) => (
                                      <option key={l.id} value={l.id}>
                                        {l.name} ({l.id})
                                      </option>
                                    ))}
                                  </select>
                                )}
                              </td>
                              <td>
                                <TextField
                                  value={row.source}
                                  label={`${name}${index + 1}来源`}
                                  onCommit={(v) => rowUpdate(key, index, 'source', v)}
                                />
                              </td>
                              <td>
                                <button
                                  aria-label={`删除${name}${index + 1}`}
                                  onClick={() =>
                                    modify((p) => {
                                      p[key].splice(index, 1);
                                    })
                                  }
                                >
                                  删除
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="row-actions">
                    <button onClick={() => addRow(key)}>＋ 添加{name}</button>
                    {key === 'repayments' && (
                      <>
                        <button onClick={() => csvRef.current?.click()}>导入还款 CSV</button>
                        <button onClick={() => exportText(repaymentsCSV(plan), '还款表.csv')}>
                          导出还款 CSV
                        </button>
                      </>
                    )}
                  </div>
                  {key === 'repayments' && (
                    <p className="caption">
                      导入替换整张还款表；需先建家庭负债，loan_id 使用上方负债 ID。UTF-8
                      表头：date,loan_id,principal_yuan,interest_yuan,source。来源列不含逗号。与月度/一次性还款重叠会被拒绝。
                    </p>
                  )}
                </details>
              ))}
              <details>
                <summary>高级：整体 JSON 编辑</summary>
                <p>适合一次调整起始月与目标日期。先载入当前数据，再校验应用；失败保留原计划。</p>
                <button onClick={() => setJson(JSON.stringify(plan, null, 2))}>
                  载入当前 JSON
                </button>
                <textarea
                  aria-label="整体计划JSON"
                  value={json}
                  onChange={(e) => setJson(e.target.value)}
                  rows={14}
                />
                <button
                  onClick={() => {
                    try {
                      commit(parsePlanJSON(json));
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }}
                >
                  校验并应用 JSON
                </button>
              </details>
            </section>
          )}
          {tab === 'connect' && (
            <section className="prose">
              <p className="eyebrow">来源与口径</p>
              <h2>先确认属于谁，再确认能不能用</h2>
              <p>
                企业资金单列 ¥ {money(result.enterpriseAssetsCents)}
                。只有家庭名下、确实可用的现金进入期初可用余额；房产和投资市值仅计入期初净资产。
              </p>
              <ul>
                <li>工资、家庭经营净收入、确认分红计收入。新增借款同时增加现金与负债。</li>
                <li>本金减少现金与负债，利息减少现金。目标付款消耗现金，暂按支出处理。</li>
                <li>
                  预测按付款日排序。同日先收入/借款，再按记录 ID
                  排支出；未建模日内到账时刻，请预留缓冲。
                </li>
                <li>工资中断只停前 N 个月的工资，经营收入和已确认分红按原记录处理。</li>
                <li>所有金额存储为整数分；本版不计算税费、投资收益、通胀、汇率或自动变现。</li>
              </ul>
              <h3>读取 Wealthfolio 资料</h3>
              <p>
                {adapter.mode === 'demo'
                  ? '当前为独立本地演示，未连接宿主。安装插件后可通过 SDK 只读账户、估值和独立资产。'
                  : '当前使用宿主 API。点击读取后逐项选择家庭资料，应用时替换当前资产/负债，并清空原收支和目标以避免案例混入。'}
              </p>
              <button
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    setSnapshot(await adapter.readSnapshot());
                    setSelected([]);
                  })
                }
              >
                读取宿主候选资料
              </button>
              {snapshot && (
                <div className="snapshot">
                  {snapshot.warnings.map((w, i) => (
                    <p key={i}>{w}</p>
                  ))}
                  {snapshot.candidates.map((c) => (
                    <label className="checkbox" key={c.id}>
                      <input
                        type="checkbox"
                        checked={selected.includes(c.id)}
                        onChange={(e) =>
                          setSelected(
                            e.target.checked
                              ? [...selected, c.id]
                              : selected.filter((id) => id !== c.id),
                          )
                        }
                      />
                      {c.type === 'liability' ? '负债' : '资产'} · {c.value.name} · ¥{' '}
                      {money(c.value.amountCents)}
                      <small>{c.value.source}</small>
                    </label>
                  ))}
                  {snapshot.candidates.length > 0 && (
                    <button
                      className="primary"
                      disabled={!selected.length}
                      onClick={() => {
                        const chosen = snapshot.candidates.filter((c) => selected.includes(c.id));
                        if (
                          commit({
                            ...plan,
                            name: '我的家庭规划',
                            dataMode: 'user',
                            assets: chosen.filter((c) => c.type === 'asset').map((c) => c.value),
                            liabilities: chosen
                              .filter((c) => c.type === 'liability')
                              .map((c) => c.value),
                            recurring: [],
                            events: [],
                            goals: [],
                            repayments: [],
                          })
                        ) {
                          setNotice('已建立宿主资料快照，请填写家庭收支和目标。');
                          setSnapshot(null);
                        }
                      }}
                    >
                      以选中资料建立新计划
                    </button>
                  )}
                </div>
              )}
              <p className="caption">
                独立演示保存到浏览器
                localStorage；插件使用宿主独立存储，是否同步取决于宿主设置。文件只在本地解析，插件不主动联网。真实宿主安装与运行仍待验证。
              </p>
            </section>
          )}
          {tab === 'ai' && (
            <section className="prose">
              <p className="eyebrow">把依据带走</p>
              <h2>可交给 AI 的解释材料</h2>
              <p>
                导出当前计划、基准与压力情景的逐笔计算结果、来源口径和解释提示词。金额已由本地代码计算，便于模型解释原因和列出需要补充的信息。
              </p>
              <div className="ai-note">
                <strong>尚未调用模型</strong>
                <p>
                  本版不配置密钥或发送数据。文件包含完整家庭明细；可先检查内容，再自行选择是否交给外部工具。
                </p>
              </div>
              <button
                className="primary"
                onClick={() =>
                  exportText(
                    evidence(plan, { salaryPauseMonths: pause }),
                    '家庭现金流-解释材料.json',
                  )
                }
              >
                导出解释材料 JSON
              </button>
              <h3>建议核对的问题</h3>
              <ol>
                <li>现金里是否包含公司资金、冻结款或目标已占用金额？</li>
                <li>目标付款日前，工资或分红是否已经实际到账？</li>
                <li>贷款本金和利息是否对应银行还款表，而非重复记录？</li>
              </ol>
            </section>
          )}
          <footer>
            <span>家有余量 · 第一版 0.1.0</span>
            <span>24 个月 · 人民币整数分 · 来源可核对</span>
          </footer>
        </main>
      </fieldset>
    </div>
  );
}
