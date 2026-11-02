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

function FrostedDashboardSamples() {
  const panels = [
    { title: 'Workspace Health Distribution', subtitle: 'Health and compliance signals.', colors: ['#fbbf24','#fb7185'], split: .733, rows: [['Healthy',0,'#34d399'],['At Risk',11,'#fbbf24'],['Critical',4,'#fb7185']] as const },
    { title: 'Workspace Lifecycle Distribution', subtitle: 'Maturity across lifecycle stages.', colors: ['#34d399','#94a3b8'], split: .933, rows: [['Draft',1,'#94a3b8'],['Onboarding',0,'#38bdf8'],['Active',14,'#34d399']] as const },
  ]
  return <section data-theme-panel="workspace" className="liquid-glass-enterprise-panel space-y-4 rounded-2xl border p-5">
    <div><h2 className="font-semibold">Workspace Intelligence Control Tower</h2><p className="mt-1 text-xs text-muted-foreground">Nested chart surfaces · frosted glass preview</p></div>
    <div className="grid grid-cols-2 gap-4">
      {panels.map(panel=><Card key={panel.title} data-theme-panel="chart" className="relative space-y-4 overflow-hidden rounded-2xl bg-white/90 p-4">
        <div className="absolute inset-x-0 top-0 h-[2px]" style={{background:`linear-gradient(90deg,${panel.colors[0]},${panel.colors[1]})`}} />
        <h3 className="text-xs font-semibold">{panel.title}</h3><p className="text-[10px] text-muted-foreground">{panel.subtitle}</p>
        <div className="flex items-center gap-3">
          <svg className="h-24 w-24 shrink-0" viewBox="0 0 100 100" role="img" aria-label={panel.title}>
            <circle cx="50" cy="50" r="40" fill="none" stroke={panel.colors[1]} strokeWidth="12" opacity=".85" />
            <circle cx="50" cy="50" r="40" fill="none" stroke={panel.colors[0]} strokeWidth="12" strokeDasharray={`${251.33*panel.split} 251.33`} transform="rotate(-90 50 50)" strokeLinecap="round" />
            <text x="50" y="51" textAnchor="middle" fill="currentColor" fontSize="22" fontWeight="600">15</text><text x="50" y="65" textAnchor="middle" fill="currentColor" fontSize="7">WORKSPACES</text>
          </svg>
          <div className="min-w-0 flex-1 space-y-2">{panel.rows.map(([label,value,color])=><div key={label} data-theme-surface="chart-row" className="rounded-xl border border-slate-200 bg-white/80 px-2 py-2">
            <div className="flex items-center gap-2 text-[10px]"><span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{background:color}}/><span className="flex-1">{label}</span><strong>{value}</strong></div>
            <div className="mt-1 h-1 rounded-full bg-muted"><div className="h-full rounded-full" style={{width:`${value/15*100}%`,background:color}}/></div>
          </div>)}</div>
        </div>
      </Card>)}
    </div>
  </section>
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
    <aside className="glass-sidebar rounded-2xl p-5"><h2 className="mb-8 font-semibold">Workspace</h2><p className="mb-5">Overview</p><p className="mb-5">Projects</p><p className="mb-5">Knowledge</p><p>Settings</p></aside>
    <main className="min-w-0 space-y-5 overflow-y-auto">
      <FrostedDashboardSamples />
      <section className="glass-panel space-y-5 rounded-2xl p-6"><p className="text-xs uppercase tracking-[.2em] text-muted-foreground">AI Project Management</p><h1 className="text-3xl font-light">Theme components</h1><p className="text-sm text-muted-foreground">Shared buttons, forms, menus, dialogs and drawers.</p><ComponentSamples /></section>
      <section className="glass-card rounded-2xl p-5"><h2 className="mb-3 font-semibold">Delivery overview</h2><div className="grid grid-cols-3 gap-3">{['Active projects','Knowledge assets','Workflows'].map((label,i)=><div key={label} className="rounded-xl border border-border p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-2 text-2xl">{[18,81,12][i]}</p></div>)}</div></section>
    </main>
    <aside className="glass-panel overflow-y-auto rounded-2xl p-5"><h2 className="mb-4 font-semibold">Theme Settings</h2><ThemeSettingsPanel/></aside>
  </div>
</>)
