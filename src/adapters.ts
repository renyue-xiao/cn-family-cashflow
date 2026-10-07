import type { AddonContext } from '../vendor/wealthfolio-addon-sdk/types';
import type { Asset,Liability } from './domain.ts';
import { moneyToCents } from './domain.ts';
export interface Candidate { id:string; type:'asset'|'liability'; value:Asset|Liability }
export interface Snapshot { candidates:Candidate[]; warnings:string[] }
export interface Adapter { mode:'demo'|'wealthfolio'; load():Promise<string|null>; save(text:string):Promise<void>; exportFile(text:string,name:string):Promise<boolean>; readSnapshot():Promise<Snapshot> }
const KEY='cn-family-cashflow.plan.v1';
export function demoAdapter():Adapter { return {mode:'demo',load:async()=>localStorage.getItem(KEY),save:async(text)=>{localStorage.setItem(KEY,text);},exportFile:async(text,name)=>{const url=URL.createObjectURL(new Blob([text],{type:name.endsWith('.json')?'application/json;charset=utf-8':'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);return true;},readSnapshot:async()=>({candidates:[],warnings:['独立演示未连接 Wealthfolio。请在真实宿主插件内读取账户资料。']})}; }
export function hostAdapter(ctx:AddonContext):Adapter { return {mode:'wealthfolio',load:()=>ctx.api.storage.get(KEY),save:async(text)=>{await ctx.api.storage.set(KEY,text);},exportFile:async(text,name)=>{const result=await ctx.api.files.openSaveDialog(text,name);if(result===false)return false;if(result!==true)throw new Error('宿主未返回可确认的保存结果，请检查目标文件');return true;},readSnapshot:async()=>{
 const accounts=await ctx.api.accounts.getAll();
 const [values,alternatives]=await Promise.all([ctx.api.portfolio.getLatestValuations(accounts.filter(a=>a.isActive&&!a.isArchived).map(a=>a.id)),ctx.api.alternativeAssets.getAll()]);
 const candidates:Candidate[]=[],warnings:string[]=[];
 const convert=(v:number|string,label:string):number=>{if((typeof v!=='number'&&typeof v!=='string')||(typeof v==='string'&&!v.trim()))throw new Error(label+'金额缺失，需手动核对');const n=Number(v);if(!Number.isFinite(n)||n<0)throw new Error(label+'金额无效或为负数，需手动核对');if(Math.abs(n*100-Math.round(n*100))>0.000001)warnings.push(label+'按宿主数值四舍五入到分，请核对原始估值');return moneyToCents(n.toFixed(2));};
 for(const value of values){const name=accounts.find(a=>a.id===value.accountId)?.name??value.accountId;
 if(value.accountCurrency!=='CNY'){warnings.push(name+'不是人民币账户，未自动换汇导入');continue;}
 if(value.valueStatus!=='complete'){warnings.push(name+'估值状态为'+value.valueStatus+'，未作为可用资料导入');continue;}
 for(const [kind,amount,label] of [['cash',value.cashBalance,'现金'],['investment',value.investmentMarketValue,'投资市值']] as const){try{const id='host-account-'+value.accountId+'-'+kind;candidates.push({id,type:'asset',value:{id,name:name+' · '+label,kind,owner:'household',amountCents:convert(amount,name+label),source:`Wealthfolio 账户估值 ${value.valuationDate}；须人工确认家庭归属及可用性`}});}catch(e){warnings.push((e as Error).message);}}
 }
 for(const alt of alternatives){if(alt.currency!=='CNY'){warnings.push(alt.name+'非CNY，未导入');continue;}try{const liability=alt.kind==='liability';if(typeof alt.marketValue!=='string'||!alt.marketValue.trim()||!Number.isFinite(Number(alt.marketValue)))throw new Error(alt.name+'金额缺失或无效');const amount=liability?String(Math.abs(Number(alt.marketValue))):alt.marketValue;const id='host-alt-'+alt.id;const value={id,name:alt.name,amountCents:convert(amount,alt.name),owner:'household' as const,source:`Wealthfolio 独立资产 ${alt.valuationDate}${alt.linkedAssetId?'；关联资产 '+alt.linkedAssetId:''}；负债单列`};candidates.push(liability?{id,type:'liability',value}:{id,type:'asset',value:{...value,kind:alt.kind==='property'?'property':'other'}});}catch(e){warnings.push((e as Error).message);}}
 return {candidates,warnings:['请选择属于家庭的资料。选中现金前请核对冻结、公司归属和估值日期；公司资金不应选入家庭。',...warnings]};
 }}; }
