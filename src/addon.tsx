import type { AddonEnableFunction } from '../vendor/wealthfolio-addon-sdk/types';
import { App } from './App';
import { hostAdapter, type Adapter } from './adapters';
import './style.css';
let adapter: Adapter | undefined;
function AddonRoute() {
  if (!adapter) return <p>插件上下文不可用，请重新打开。</p>;
  return <App adapter={adapter} />;
}
const enable: AddonEnableFunction = (ctx) => {
  adapter = hostAdapter(ctx);
  ctx.router.add({
    id: 'cn-family-cashflow',
    path: '/addons/cn-family-cashflow',
    component: AddonRoute,
  });
  ctx.onDisable(() => {
    adapter = undefined;
  });
};
export default enable;
