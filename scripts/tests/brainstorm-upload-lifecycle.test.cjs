const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const root = path.resolve(__dirname, '../..')
const candidatePath = (file) => path.join(root, 'src/modules/project-management', file.endsWith('.tsx') ? 'pages' : 'lib', file)
const source = fs.readFileSync(candidatePath('brainstormAttachmentLifecycle.ts'), 'utf8')
const mod = { exports: {} }
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
  { exports: mod.exports, module: mod })
const { BrainstormAttachmentLifecycle } = mod.exports
const page = fs.readFileSync(candidatePath('IdeaBacklogManagementPage.tsx'), 'utf8')
const pageAst = ts.createSourceFile('IdeaBacklogManagementPage.tsx', page, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
function compileHandler(name, exportedName) {
  const matches = []
  function visit(node) {
    if (ts.isVariableStatement(node) && node.declarationList.declarations.some(
      (entry) => ts.isIdentifier(entry.name) && entry.name.text === name,
    )) matches.push(node.getText(pageAst))
    ts.forEachChild(node, visit)
  }
  visit(pageAst)
  assert.equal(matches.length, 1, 'Expected one handler declaration: ' + name)
  return ts.transpileModule(matches[0] + '\n globalThis.' + exportedName + ' = ' + name,
    { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
}
const handlerCode = compileHandler('handlePickBrainstormDiagram', 'pick')
const image = (name) => ({ dataUrl: `data:image/jpeg;base64,${name}`, name })
function deferred() { let resolve, reject; const promise = new Promise((a,b) => { resolve=a; reject=b }); return { promise, resolve, reject } }
function setup(resize = async () => 'data:image/jpeg;base64,YQ==') {
  const lifecycle = new BrainstormAttachmentLifecycle()
  lifecycle.bind('job-A')
  const ctx = { brainstormAttachmentLifecycle: lifecycle, brainstormMessages: [],
    isResumingDraft:false,isDraftContinuing:false,isEvidenceDialogOpen:true,
    isBrainstormThreadIndonesian: () => false, resizeDiagramUpload: resize }
  vm.runInNewContext(handlerCode, ctx)
  return { lifecycle, ctx, pick: ctx.pick }
}
const file = (name, type='image/png') => ({ name, type })
test('actual extracted picker: supported formats and filename; no model/network', async () => {
  for (const type of ['image/png','image/jpeg','image/webp','image/gif']) {
    const s = setup(); await s.pick(file('diagram',type))
    assert.equal(s.lifecycle.state.attachment.name,'diagram'); assert.equal(s.lifecycle.state.error,'')
  }
})
test('actual extracted picker: valid then unsupported invalidates previous image', async () => {
  const s=setup(); await s.pick(file('A')); await s.pick(file('bad.svg','image/svg+xml'))
  assert.equal(s.lifecycle.state.attachment,null); assert.match(s.lifecycle.state.error,/Upload a PNG, JPG, WEBP, or GIF image\. No image attached/)
})
test('actual extracted picker: unreadable and oversized replacements never retain A', async () => {
  for (const reason of ['unreadable','oversize']) {
    let calls=0
    const s=setup(async () => { if (++calls===1) return 'data:image/jpeg;base64,YQ=='
      if(reason==='unreadable') throw new Error('decode')
      return 'data:image/jpeg;base64,'+'A'.repeat(5_333_336) })
    await s.pick(file('A')); await s.pick(file('B'))
    assert.equal(s.lifecycle.state.attachment,null); assert.equal(s.lifecycle.state.preparing,null)
    assert.match(s.lifecycle.state.error,reason==='unreadable'
      ? /That image could not be read\. Try uploading it again\. No image attached/
      : /The image is still too large after resizing\. Crop it to the diagram\. No image attached/)
  }
})
test('actual extracted picker: both A/B completion orders keep B', async () => {
  for(const reverse of [false,true]) {
    const a=deferred(),b=deferred(); const s=setup(f => f.name==='A'?a.promise:b.promise)
    const pa=s.pick(file('A')),pb=s.pick(file('B'))
    const finish=async(d,p,label)=>{ d.resolve(`data:image/jpeg;base64,${label}`); await p }
    if(reverse){await finish(b,pb,'Yg==');await finish(a,pa,'YQ==')}
    else{await finish(a,pa,'YQ==');assert.equal(s.lifecycle.state.attachment,null);await finish(b,pb,'Yg==')}
    assert.equal(s.lifecycle.state.attachment.name,'B')
  }
})
test('actual extracted picker: remove, reset, session switch, close, unmount discard late decode', async () => {
  for(const action of [c=>c.clear(),c=>c.reset(),c=>c.bind('job-B'),c=>c.bind(null),c=>c.dispose()]) {
    const d=deferred(),s=setup(()=>d.promise),pending=s.pick(file('A')); action(s.lifecycle)
    d.resolve('data:image/jpeg;base64,YQ==');await pending
    assert.equal(s.lifecycle.state.attachment,null)
  }
})
test('actual extracted picker: late decode failure cannot replace newer status', async () => {
  const d=deferred(),s=setup(f=>f.name==='A'?d.promise:Promise.resolve('data:image/jpeg;base64,Yg=='))
  const pa=s.pick(file('A'));await s.pick(file('B'));d.reject(new Error('old'));await pa
  assert.equal(s.lifecycle.state.error,'');assert.equal(s.lifecycle.state.attachment.name,'B')
})
test('pure lifecycle: prepare blocks submit; synchronous duplicate lock and exact payload snapshot', async () => {
  const s=setup(),selection=s.lifecycle.select('A');assert.equal(s.lifecycle.begin(true),null)
  s.lifecycle.resolve(selection,image('A'));const request=s.lifecycle.begin(true)
  assert.equal(request.attachment.name,'A');assert.equal(s.lifecycle.state.attachment,null)
  assert.equal(s.lifecycle.begin(true),null);assert.equal(s.lifecycle.select('B'),null)
  assert.equal(s.lifecycle.restore(request),true);assert.equal(s.lifecycle.state.attachment.name,'A')
  assert.equal(s.lifecycle.finish(request),true);assert.equal(s.lifecycle.finish(request),false)
})
test('pure lifecycle: late response/error/finally cannot act on a different session or request', () => {
  const s=setup(),old=s.lifecycle.begin(true);s.lifecycle.bind('job-B');const current=s.lifecycle.begin(true)
  assert.equal(s.lifecycle.isRequestCurrent(old),false);assert.equal(s.lifecycle.restore(old),false)
  assert.equal(s.lifecycle.finish(old),false);assert.equal(s.lifecycle.busy,true)
  assert.equal(s.lifecycle.isRequestCurrent(current),true)
})
test('pure lifecycle: removal cancels restoration; restored job adoption keeps only its request', () => {
  const s=setup(),selection=s.lifecycle.select('A');s.lifecycle.resolve(selection,image('A'))
  const request=s.lifecycle.begin(true);s.lifecycle.clear();assert.equal(s.lifecycle.restore(request),false)
  assert.equal(s.lifecycle.adopt(request,'restored-job'),true);s.lifecycle.bind('restored-job')
  assert.equal(s.lifecycle.isRequestCurrent(request),true)
  s.lifecycle.dispose();s.lifecycle.bind('restored-job');assert.equal(s.lifecycle.isRequestCurrent(request),false)
})
test('page wiring source checks (not mounted React/UI proof)', () => {
  assert.match(page,/const requestToken = brainstormAttachmentLifecycle\.begin\(!messageOverride, ideaDraftJob.job_id\)/)
  assert.match(page,/brainstormAttachmentLifecycle\.reset\(\)\s+setIsResumingDraft\(true\)\s+setDraftVersionCard\(null\)\s+void \(async/)
  assert.match(page,/if \(!requestIsCurrent\(\)\) return/)
  assert.match(page,/if \(brainstormAttachmentLifecycle\.finish\(requestToken\)\) setIsBrainstormSending\(false\)/)
  assert.match(page,/BrainstormErrorNotice message=\{brainstormAttachment\.error\}/)
  assert.match(page,/Boolean\(brainstormAttachment\.preparing\) \|\| isBrainstormSending/)
  assert.equal(page.includes('setBrainstormDiagramImage'),false)
})

const sendCode = compileHandler('handleSendBrainstormMessage', 'send')
function sendSetup(reply) {
  const s=setup(),writes=[],calls=[]
  const selection=s.lifecycle.select('A');s.lifecycle.resolve(selection,image('A'))
  const ctx={brainstormAttachmentLifecycle:s.lifecycle,ideaDraftJob:{job_id:'job-A',status:'awaiting_input',revision:'r1'},
    brainstormInput:'caption A',brainstormMessages:[],isBrainstormSending:false,isResumingDraft:false,
    brainstormLlmMode:'normal',brainstormAbbreviationEntry:null,
    isBrainstormThreadIndonesian:()=>false,diagramUploadCaption:m=>m||'Existing process diagram.',
    brainstormIdeaDraftJob:(...args)=>{calls.push(args);return reply},isIdeaDraftJobLostError:()=>false,
    mergeBrainstormUiMessages:(_history,messages)=>messages,
    resolveBrainstormConfidencePercent:()=>0,readBrainstormSessionConflict:async()=>({latest:null}),
    friendlyBrainstormError:m=>m}
  for(const name of ['setBrainstormError','setIsBrainstormSending','setBrainstormInput','setBrainstormOfferGenerateAnyway',
    'setBrainstormMessages','setBrainstormAnimatingAssistantIndex','setBrainstormReady','setBrainstormRemainingGaps',
    'setBrainstormLatestKind','setBrainstormChecklist','setBrainstormEvidenceProgress','setBrainstormDiscoveryProgress',
    'setBrainstormConfidencePercent','setIdeaDraftJob']) ctx[name]=value=>writes.push({name,value})
  vm.runInNewContext(sendCode,ctx)
  return {...s,writes,calls,send:ctx.send}
}
test('actual extracted send: captured image/job/revision, synchronous double-submit protection', async()=>{
  const d=deferred(),s=sendSetup(d.promise);const first=s.send();await s.send()
  assert.equal(s.calls.length,1);assert.equal(s.calls[0][0],'job-A');assert.equal(s.calls[0][1],'caption A')
  assert.equal(s.calls[0][3],image('A').dataUrl);assert.equal(s.calls[0][5],'r1')
  d.resolve({messages:[],ready_to_continue:false,remaining_gaps:[],revision:'r2'});await first
  assert.equal(s.lifecycle.busy,false);assert.equal(s.lifecycle.state.attachment,null)
})
test('actual extracted send: in-flight decode blocks request',async()=>{
  const s=sendSetup(Promise.resolve({messages:[]}));s.lifecycle.select('B');await s.send();assert.equal(s.calls.length,0)
})
test('actual extracted send: old-session success and failure produce no late writes',async()=>{
  for(const reject of [false,true]){
    const d=deferred(),s=sendSetup(d.promise),pending=s.send();s.lifecycle.bind('job-B')
    const newer=s.lifecycle.begin(false),before=s.writes.length
    if(reject)d.reject(new Error('late error'));else d.resolve({messages:[]})
    await pending;assert.equal(s.writes.length,before);assert.equal(s.lifecycle.isRequestCurrent(newer),true)
    assert.equal(s.lifecycle.state.attachment,null)
  }
})
test('actual extracted send: same-session failure restores the exact attachment and permits retry',async()=>{
  const d=deferred(),s=sendSetup(d.promise),pending=s.send();d.reject(new Error('offline'));await pending
  assert.equal(s.lifecycle.state.attachment.dataUrl,image('A').dataUrl)
  assert.equal(s.lifecycle.state.attachment.name,'A');assert.equal(s.lifecycle.busy,false)
  assert.ok(s.writes.some(w=>w.name==='setBrainstormInput'&&w.value==='caption A'))
})
test('actual extracted send: stale callback cannot bind new-session image to old job',async()=>{
  const s=sendSetup(Promise.resolve({messages:[]}));s.lifecycle.bind('job-B')
  const selection=s.lifecycle.select('B');s.lifecycle.resolve(selection,image('B'))
  await s.send();assert.equal(s.calls.length,0);assert.equal(s.lifecycle.state.attachment.name,'B')
})
test('actual extracted picker: no selection during resume, draft continuation or closed panel',async()=>{
  for(const [key,value] of [['isResumingDraft',true],['isDraftContinuing',true],['isEvidenceDialogOpen',false]]){
    const s=setup();s.ctx[key]=value;await s.pick(file('A'));assert.equal(s.lifecycle.state.attachment,null)
  }
})
test('mounted real React hook: StrictMode, session change during decode, close and unmount',async()=>{
  const {JSDOM}=require('jsdom'),React=require('react')
  const dom=new JSDOM('<!DOCTYPE html><div id="root"></div>',{url:'http://localhost/'})
  const globals = { window: dom.window, document: dom.window.document, navigator: dom.window.navigator, IS_REACT_ACT_ENVIRONMENT: true }
  const previous = Object.keys(globals).map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)])
  for (const [name, value] of Object.entries(globals)) {
    Object.defineProperty(globalThis, name, { value, configurable: true, writable: true })
  }
  try {
  const {createRoot}=require('react-dom/client')
  const hookModule={exports:{}}
  const hookSource=fs.readFileSync(candidatePath('useBrainstormAttachment.ts'),'utf8')
  vm.runInNewContext(ts.transpileModule(hookSource,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,
    {exports:hookModule.exports,module:hookModule,require:(id)=>id==='react'?React:{BrainstormAttachmentLifecycle}})
  let current
  const effectStart=page.indexOf('  const [isBrainstormSending, setIsBrainstormSending] = useState(false)')
  const effectEnd=page.indexOf('  const [brainstormPhase,',effectStart)
  const Probe=new Function('React','useHook','report',`const {useState,useLayoutEffect}=React;
    return function Probe({job,open=true}) {
      const brainstormAttachment=useHook(job,open),brainstormAttachmentLifecycle=brainstormAttachment.lifecycle;
      const ideaDraftJob={job_id:job},isEvidenceDialogOpen=open;
      ${page.slice(effectStart,effectEnd)}
      report({...brainstormAttachment,isBrainstormSending,setIsBrainstormSending});return null;
    }`)(React,hookModule.exports.useBrainstormAttachment,value=>{current=value})
  const mounted=createRoot(document.getElementById('root'))
  const render=async(job,open=true)=>React.act(async()=>mounted.render(React.createElement(React.StrictMode,null,React.createElement(Probe,{job,open}))))
    await render('job-A');let token
    await React.act(async()=>{token=current.lifecycle.select('A')})
    assert.equal(current.preparing,'A')
    await render('job-B')
    await React.act(async()=>assert.equal(current.lifecycle.resolve(token,image('A')),false))
    assert.equal(current.attachment,null);assert.equal(current.preparing,null)
    let request
    await React.act(async()=>{request=current.lifecycle.begin(false,'job-B');current.setIsBrainstormSending(true)})
    assert.equal(current.isBrainstormSending,true)
    await React.act(async()=>current.lifecycle.reset())
    assert.equal(current.isBrainstormSending,false)
    assert.equal(current.lifecycle.finish(request),false)
    await React.act(async()=>{token=current.lifecycle.select('B')})
    await render('job-B',false)
    assert.equal(current.lifecycle.resolve(token,image('B')),false)
    await render('job-B')
    await React.act(async()=>{token=current.lifecycle.select('B')})
    const controller=current.lifecycle
    await React.act(async()=>mounted.unmount())
    assert.equal(controller.resolve(token,image('B')),false)
    assert.equal(controller.begin(true,'job-B'),null)
  } finally {
    dom.window.close()
    for (const [name, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor)
      else Reflect.deleteProperty(globalThis, name)
    }
  }
})
test('attachment status English/Indonesian preserves filenames and localizes empty/preparing/attached',()=>{
  const status=mod.exports.brainstormAttachmentStatus
  assert.equal(status({preparing:'gambar.png'},true),'Menyiapkan gambar: gambar.png')
  assert.equal(status({preparing:'gambar.png'},false),'Preparing image: gambar.png')
  assert.equal(status({attachment:{name:'gambar.png'}},true),'Terlampir: gambar.png')
  assert.equal(status({attachment:{name:'gambar.png'}},false),'Attached: gambar.png')
  assert.equal(status({},true),'Tidak ada gambar terlampir.')
  assert.equal(status({},false),'No image attached.')
  assert.match(page, /\? 'Batalkan gambar' : 'Cancel image'/)
})
test('changed TS/TSX parse and transpile diagnostics only, not semantic typecheck',()=>{
  for(const file of ['IdeaBacklogManagementPage.tsx','brainstormAttachmentLifecycle.ts','useBrainstormAttachment.ts']){
    const content=fs.readFileSync(candidatePath(file),'utf8')
    const parsed=ts.createSourceFile(file,content,ts.ScriptTarget.Latest,true,file.endsWith('tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS)
    assert.equal(parsed.parseDiagnostics.length,0,JSON.stringify(parsed.parseDiagnostics))
    const result=ts.transpileModule(content,{fileName:file,reportDiagnostics:true,compilerOptions:{jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}})
    assert.equal((result.diagnostics||[]).length,0,JSON.stringify(result.diagnostics))
  }
})
