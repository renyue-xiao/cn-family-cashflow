import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hostAdapter } from '../src/adapters.ts';
import type { AddonContext } from '../vendor/wealthfolio-addon-sdk/types';
const mock = (overrides: Record<string, unknown> = {}) => ({
  api: {
    storage: { get: async () => '{"test":1}', set: async () => {} },
    files: { openSaveDialog: async (): Promise<unknown> => true },
    accounts: {
      getAll: async () => [{ id: 'a', name: '账户', isActive: true, isArchived: false }],
    },
    portfolio: {
      getLatestValuations: async () => [
        {
          accountId: 'a',
          accountCurrency: 'CNY',
          valueStatus: 'complete',
          valuationDate: '2026-10-01',
          cashBalance: 100,
          investmentMarketValue: 200,
          ...overrides,
        },
      ],
    },
    alternativeAssets: { getAll: async (): Promise<unknown[]> => [] },
  },
});
// Intentionally malformed host responses exercise the runtime validation boundary.
// The only cast is at that boundary; fixture mutation remains explicitly typed.
function adapterForFixture(ctx: ReturnType<typeof mock>) {
  return hostAdapter(ctx as unknown as AddonContext);
}
test('真实API方法路由：只读候选拆现金市值，未自动应用', async () => {
  const a = adapterForFixture(mock());
  const s = await a.readSnapshot();
  assert.equal(s.candidates.length, 2);
  assert.equal(s.candidates[0].value.amountCents, 10000);
  assert.equal(s.candidates[1].value.amountCents, 20000);
  assert.equal(await a.load(), '{"test":1}');
  assert.equal(await a.exportFile('text', 'x.json'), true);
});
test('宿主缺失、负数、非数值不会成为零现金候选', async () => {
  for (const value of ['', ' ', null, undefined, -1, NaN, Infinity]) {
    const s = await adapterForFixture(mock({ cashBalance: value })).readSnapshot();
    assert.equal(s.candidates.filter((c) => c.id.endsWith('-cash')).length, 0);
    assert.ok(s.warnings.length > 1);
  }
});
test('负债缺失值不被abs(Number)掩盖，非CNY或不完整估值排除', async () => {
  for (const value of ['', ' ', null, undefined]) {
    const ctx = mock();
    ctx.api.alternativeAssets.getAll = async () => [
      { id: 'l', name: '负债', kind: 'liability', currency: 'CNY', marketValue: value },
    ];
    const s = await adapterForFixture(ctx).readSnapshot();
    assert.equal(s.candidates.filter((c) => c.type === 'liability').length, 0);
  }
  assert.equal(
    (await adapterForFixture(mock({ valueStatus: 'unavailable' })).readSnapshot()).candidates
      .length,
    0,
  );
  assert.equal(
    (await adapterForFixture(mock({ accountCurrency: 'USD' })).readSnapshot()).candidates.length,
    0,
  );
});
test('宿主导出取消与错误不报告成功，存储异常透传', async () => {
  const ctx = mock();
  ctx.api.files.openSaveDialog = async () => false;
  assert.equal(await adapterForFixture(ctx).exportFile('x', 'x.json'), false);
  ctx.api.files.openSaveDialog = async () => undefined;
  await assert.rejects(() => adapterForFixture(ctx).exportFile('x', 'x.json'), /未返回/);
  ctx.api.storage.set = async () => {
    throw new Error('storage failed');
  };
  await assert.rejects(() => adapterForFixture(ctx).save('x'), /storage failed/);
});
