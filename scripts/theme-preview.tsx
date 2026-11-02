/** Local visual QA only; excluded from the production app build. */
import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { createPortal } from 'react-dom'
import '../src/index.css'
import '../src/tectona-themes.css'
import { AppBackgroundVideo } from '../src/components/layout/AppBackgroundVideo'
import ThemeSettingsPanel from '../src/components/settings/ThemeSettingsPanel'
import { Button } from '../src/components/ui/button'
import { Input } from '../src/components/ui/input'
import { Textarea } from '../src/components/ui/textarea'
import { Card } from '../src/components/ui/card'
import { Select } from '../src/components/ui/select'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../src/components/ui/tabs'
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '../src/components/ui/dialog'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '../src/components/ui/dropdown-menu'
import { enterpriseCyanGradientActionButtonClass, enterpriseIndigoGradientActionButtonClass, enterpriseSecondaryButtonClass } from '../src/lib/enterpriseButtonClasses'
import { WorkspaceKpiCard, WorkspaceHealthExecutiveDonut, IntelligenceDonut, WORKSPACE_OVERVIEW_PALETTES } from '../src/modules/workspace-management/pages/WorkspaceManagementPage'
import { BarChart3 } from 'lucide-react'

/** Exercise real production chart/KPI markup, including legacy light surfaces. */
function WorkspaceContrastSamples() {
  const health = [
    {name:'Healthy',value:0,color:'#34d399',pct:'0%'},
    {name:'At Risk',value:54,color:'#fbbf24',pct:'93%'},
    {name:'Critical',value:4,color:'#fb7185',pct:'7%'},
  ]
  const lifecycle = [
    {name:'Draft',value:1,color:'#94a3b8',pct:'2%'},
    {name:'Active',value:57,color:'#34d399',pct:'98%'},
  ]
  return <>
    <div className="grid grid-cols-3 gap-3">
      {['Total Workspaces','Active Workspaces','At Risk'].map((label,i) => <WorkspaceKpiCard key={label} label={label} value={String([58,57,54][i])} subtitle="Registered workspace boundaries" trend={i===2?'-0.8%':'+6.2%'} trendSeries={[35,36,40,42,47,52,58]} trendColor={i===2?'#fb7185':'#38bdf8'} icon={BarChart3}/>)}
    </div>
    <section data-theme-panel="workspace" className="liquid-glass-enterprise-panel space-y-4 rounded-2xl border p-5">
      <h2 className="font-semibold">Workspace Intelligence Control Tower</h2>
      <Card className="space-y-3 p-4"><h3 className="font-semibold">Workspace Health Distribution</h3><WorkspaceHealthExecutiveDonut data={health} palette={WORKSPACE_OVERVIEW_PALETTES.pastel}/></Card>
      <Card className="space-y-3 p-4"><h3 className="font-semibold">Workspace Lifecycle Distribution</h3><IntelligenceDonut data={lifecycle} centerLabel="Lifecycle" pieColors={['#94a3b8','#34d399']}/></Card>
      <Card className="space-y-3 p-4"><h3 className="font-semibold">Vivid chart center</h3><IntelligenceDonut data={lifecycle} centerLabel="Purpose" pieColors={['#94a3b8','#34d399']} isVivid/></Card>
      <div data-theme-surface="chart-empty" className="rounded-xl border bg-slate-50/60 p-4 text-sm text-slate-500">No linked projects in the current workspace scope yet.</div>
    </section>
  </>
}

function ComponentSamples() {
  const [dialog, setDialog] = useState(false)
  const [drawer, setDrawer] = useState(false)
  const [tab, setTab] = useState('overview')
  useEffect(() => {
    if (!drawer) return
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setDrawer(false) }
    document.addEventListener('keydown', close)
    return () => document.removeEventListener('keydown', close)
  }, [drawer])
  return <>
    <div className="flex flex-wrap gap-2">
      <Button>Create project</Button><Button variant="outline">Outline</Button>
      <Button variant="secondary">Secondary</Button><Button variant="ghost">Ghost</Button>
      <Button variant="destructive">Delete</Button><Button disabled>Disabled</Button>
    </div>
    <div className="flex flex-wrap gap-2">
      <button className={enterpriseCyanGradientActionButtonClass()}>Upload document</button>
      <button className={enterpriseIndigoGradientActionButtonClass()}>New template</button>
      <button className={enterpriseSecondaryButtonClass()}>Cancel</button>
    </div>
    <div className="grid grid-cols-2 gap-4">
      <label className="space-y-2 text-sm">Project name<Input placeholder="Enter project name" /></label>
      <label className="space-y-2 text-sm">Status<Select aria-label="Project status" defaultValue="draft"><option value="draft">Draft</option><option value="active">Active</option><option value="review">In review</option></Select></label>
    </div>
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList><TabsTrigger value="overview">Overview</TabsTrigger><TabsTrigger value="activity">Activity</TabsTrigger></TabsList>
      <TabsContent value="overview"><p className="text-sm text-muted-foreground">Project details and delivery information.</p></TabsContent>
      <TabsContent value="activity"><p className="text-sm text-muted-foreground">Recent workspace activity.</p></TabsContent>
    </Tabs>
    <div className="flex flex-wrap gap-3">
      <DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline">Open popup</Button></DropdownMenuTrigger>
        <DropdownMenuContent align="start"><DropdownMenuItem>Edit project</DropdownMenuItem><DropdownMenuItem>View history</DropdownMenuItem></DropdownMenuContent>
      </DropdownMenu>
      <Button variant="outline" onClick={() => setDialog(true)}>Open dialog</Button>
      <Button variant="outline" onClick={() => setDrawer(true)}>Open drawer</Button>
    </div>
    <Dialog open={dialog} onOpenChange={setDialog}>
      <DialogContent className="w-[420px] max-w-full space-y-4">
        <DialogClose /><DialogTitle>Project settings</DialogTitle>
        <DialogDescription>Review details before saving your changes.</DialogDescription>
        <label className="block space-y-2 text-sm">Project name<Input defaultValue="Tectona Delivery" /></label>
        <Textarea aria-label="Project description" defaultValue="Coordinate delivery across the workspace." />
        <DialogFooter><Button variant="outline" onClick={() => setDialog(false)}>Cancel</Button><Button onClick={() => setDialog(false)}>Save changes</Button></DialogFooter>
      </DialogContent>
    </Dialog>
    {drawer && createPortal(<>
      <div data-theme-overlay className="fixed inset-0 z-[1050] bg-black/20 backdrop-blur-sm" onClick={() => setDrawer(false)} />
      <aside role="dialog" aria-label="Drawer preview" aria-modal="true" data-theme-surface="drawer" className="fixed right-0 top-0 z-[1100] h-full w-[360px] max-w-[95vw] border-l border-border bg-white shadow-2xl">
        <header className="settings-drawer-header flex items-center justify-between border-b p-5"><h2 className="text-lg font-semibold">Document details</h2><Button variant="ghost" aria-label="Close drawer" onClick={() => setDrawer(false)}>×</Button></header>
        <div className="space-y-5 p-5"><p className="text-sm text-muted-foreground">A portal-mounted drawer with shared form controls.</p>
          <label className="block space-y-2 text-sm">Document name<Input defaultValue="Business requirements" /></label>
          <label className="block space-y-2 text-sm">Visibility<Select aria-label="Document visibility" defaultValue="workspace"><option value="workspace">Workspace</option><option value="private">Private</option></Select></label>
          <Textarea aria-label="Document notes" placeholder="Add notes…" />
          <div className="flex gap-2"><Button onClick={() => setDrawer(false)}>Save document</Button><Button variant="outline" onClick={() => setDrawer(false)}>Cancel</Button></div>
        </div>
      </aside>
    </>, document.body)}
  </>
}

createRoot(document.getElementById('root')!).render(<>
  <AppBackgroundVideo />
  <header className="glass-topbar flex h-16 items-center gap-8 px-8"><img src="/images/tectona-wordmark.svg" alt="Tectona" className="h-12"/><span className="topbar-tenant-name">Tectona · Theme Preview</span></header>
  <div className="grid gap-6 p-6" style={{ gridTemplateColumns: '11rem minmax(0,1fr) 22rem', height: 'calc(100vh - 4rem)' }}>
    <aside className="liquid-glass-enterprise-nav space-y-3 rounded-2xl p-3"><h2 className="mb-5 font-semibold">Workspace</h2>{['Overview','Workspace Directory','Governance','Members'].map((label,i)=><button key={label} data-theme-nav-item aria-current={i===0?'page':undefined} className="block w-full rounded-2xl border bg-white/55 p-3 text-left"><span className="text-sm font-semibold text-slate-900">{label}</span><span className="mt-1 block text-[11px] text-slate-500">Executive summary and health posture</span></button>)}<div data-theme-surface="nav-summary" className="rounded-xl bg-blue-50/70 p-3"><div className="text-sm text-blue-800">Workspace health</div><strong className="text-3xl text-slate-900">49%</strong></div></aside>
    <main className="min-w-0 space-y-5 overflow-y-auto">
      <WorkspaceContrastSamples />
      <section className="glass-panel space-y-5 rounded-2xl p-6"><p className="text-xs uppercase tracking-[.2em] text-muted-foreground">AI Project Management</p><h1 className="text-3xl font-light">Theme components</h1><p className="text-sm text-muted-foreground">Shared buttons, forms, menus, dialogs and drawers.</p><ComponentSamples /></section>
      <section className="glass-card rounded-2xl p-5"><h2 className="mb-3 font-semibold">Delivery overview</h2><div className="grid grid-cols-3 gap-3">{['Active projects','Knowledge assets','Workflows'].map((label,i)=><div key={label} className="rounded-xl border border-border p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-2 text-2xl">{[18,81,12][i]}</p></div>)}</div></section>
    </main>
    <aside className="glass-panel overflow-y-auto rounded-2xl p-5"><h2 className="mb-4 font-semibold">Theme Settings</h2><ThemeSettingsPanel/></aside>
  </div>
</>)
