import type { AddonContext,AddonEnableFunction } from '../vendor/wealthfolio-addon-sdk/types';
import { App } from './App';import { hostAdapter } from './adapters';import './style.css';
let context:AddonContext|undefined;
function AddonRoute(){if(!context)return <p>插件上下文不可用，请重新打开。</p>;return <App adapter={hostAdapter(context)}/>;}
const enable:AddonEnableFunction=(ctx)=>{context=ctx;ctx.router.add({id:'cn-family-cashflow',path:'/addons/cn-family-cashflow',component:AddonRoute});ctx.onDisable(()=>{context=undefined;});};
export default enable;
