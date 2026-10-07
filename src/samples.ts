import { monthAt, type Plan } from './domain.ts';
const source='合成家庭案例，非真实客户资料';
export const samples:Plan[]=[{
 schemaVersion:1,currency:'CNY',name:'林家 · 六个月后的教育金',startMonth:'2026-10',dataMode:'synthetic',
 assets:[{id:'cash',name:'活期与可用存款',amountCents:12000000,owner:'household',kind:'cash',source},{id:'home',name:'自住房估值',amountCents:300000000,owner:'household',kind:'property',source}],
 liabilities:[{id:'mortgage',name:'住房贷款',amountCents:120000000,owner:'household',source}],
 recurring:[{id:'salary',name:'税后工资',kind:'salary',amountCents:2500000,day:1,owner:'household',source},{id:'spend',name:'家庭生活消费',kind:'consumption',amountCents:1200000,day:25,owner:'household',source},{id:'principal',name:'房贷本金',kind:'principal',amountCents:400000,day:28,liabilityId:'mortgage',owner:'household',source},{id:'interest',name:'房贷利息',kind:'interest',amountCents:200000,day:28,liabilityId:'mortgage',owner:'household',source}],
 events:[],goals:[{id:'education',name:'新学年教育费',date:'2027-03-31',amountCents:15000000,source}],repayments:[]
},{
 schemaVersion:1,currency:'CNY',name:'周家 · 企业与家庭分账',startMonth:'2026-10',dataMode:'synthetic',
 assets:[{id:'cash',name:'家庭活期',amountCents:12000000,owner:'household',kind:'cash',source},{id:'business',name:'公司运营资金',amountCents:80000000,owner:'enterprise',kind:'cash',source}],
 liabilities:[{id:'loan',name:'新增家庭借款',amountCents:0,owner:'household',source}],recurring:[],
 events:[{id:'dividend',name:'已确认到家庭的税后分红',date:'2026-10-05',kind:'dividend',amountCents:3000000,owner:'household',confirmed:true,source},{id:'borrowing',name:'家庭借款到账',date:'2026-10-06',kind:'borrowing',amountCents:20000000,owner:'household',liabilityId:'loan',confirmed:true,source}],goals:[],repayments:[]
},{
 schemaVersion:1,currency:'CNY',name:'陈家 · 按银行还款表规划',startMonth:'2026-10',dataMode:'synthetic',
 assets:[{id:'cash',name:'可用存款',amountCents:6000000,owner:'household',kind:'cash',source}],liabilities:[{id:'loan',name:'家庭贷款',amountCents:12000000,owner:'household',source}],
 recurring:[{id:'salary',name:'税后工资',kind:'salary',amountCents:1500000,day:1,owner:'household',source},{id:'spend',name:'生活消费',kind:'consumption',amountCents:800000,day:25,owner:'household',source}],events:[],goals:[],
 repayments:Array.from({length:24},(_,i)=>({id:`repay-${i+1}`,date:monthAt('2026-10',i)+'-28',liabilityId:'loan',principalCents:500000,interestCents:30000-i*1250,source:'合成还款表：本金12万元，24期等额本金，年利率3%，无手续费'}))
}];
export function sample(index:number):Plan { return structuredClone(samples[index]); }
