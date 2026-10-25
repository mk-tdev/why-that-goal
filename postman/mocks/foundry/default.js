// Contract-shaped Responses API stand-in. Never receives real Azure credentials.
const http = require('http');
http.createServer(async (req,res)=> {
  if(req.method!=='POST' || !req.url.endsWith('/openai/v1/responses')) {res.writeHead(501);res.end();return;}
  if(req.url.includes('rate-limit')) {res.writeHead(429);res.end('{}');return;}
  if(req.url.includes('unavailable')) {res.writeHead(503);res.end('upstream unavailable');return;}
  if(req.url.includes('slow')) {await new Promise(r=>setTimeout(r,500));res.end('{}');return;}
  let input=req.body;
  if(!input) {let text='';for await (const chunk of req) text+=chunk;input=JSON.parse(text);}
  if(typeof input==='string') input=JSON.parse(input);
  if(input.model!=='wtg-insights' || input.store!==false || input.text?.format?.type!=='json_schema') {res.writeHead(400);res.end('{}');return;}
  const {evidence,terminalRecap}=JSON.parse(input.input);
  const factIds=evidence.facts.slice(-3).map(f=>f.id);
  const value={factIds, story:{title:'Evidence in the attack',summary:'The available evidence describes the recorded play.'},recap:terminalRecap?{title:'The recorded finish',summary:'Inspect the decisive event to understand the outcome.',cards:[{title:'Decisive evidence',text:'The terminal event records how this attack ended.',factIds:[terminalRecap.terminalFactId]}]}:null};
  if(req.url.includes('invalid')) value.factIds=['fabricated-evidence'];
  res.setHeader('Content-Type','application/json');
  res.end(JSON.stringify({id:'resp_simulated',status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(value)}]}],usage:{input_tokens:100,output_tokens:50}}));
}).listen(process.env.PORT || 4500);
