const fs=require('fs');const D=JSON.parse(fs.readFileSync(__dirname+'/exec18137.json'));
const scope=process.argv[2]||'nonhot';
D['Plan']=[{scope,hrs:30,skip:+(process.argv[5]||0)}];D['Fetch heartbeat']=D['Fetch heartbeat']||[];
const $=(n)=>({all:()=>(D[n]||[]).map(j=>({json:j})),first:()=>({json:(D[n]||[{}])[0]})});
const code=fs.readFileSync(__dirname+'/'+(process.argv[3]||'build2.js'),'utf8');
const out=new Function('$',code)($)[0].json;
console.log(JSON.stringify(out.counts));console.log('returned',out.returned,'more',out.more_not_returned,'int',out.internal_threads.length);
out.work.slice(0,+(process.argv[4]||15)).forEach(w=>console.log([w.group,w.type,w.wait_hours,w.startup,w.investor,w.from,w.reply_from_mailbox,w.other_threads_same_pair.length,String(w.subject).slice(0,50),'|',w.latest_message.slice(0,70)].join(' | ')));
console.log('noise sample',out.auto_closed_sample);
