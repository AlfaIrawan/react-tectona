import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { Position, type EdgeProps, type ConnectionLineComponentProps } from 'reactflow'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AnchoredSmoothStepEdge } from './AnchoredSmoothStepEdge'
import { DiagramConnectionLine } from './DiagramConnectionLine'
import { DiagramEdgeEndpointControls } from './DiagramEdgeEndpointControls'
import { diagramTerminalPoint } from '../lib/diagramConnections'
const state = vi.hoisted(() => ({ zoom: 1, handleId: 'target-left' as string | null, nodes: new Map<string, any>() }))
vi.mock('reactflow', async importOriginal => ({ ...await importOriginal<typeof import('reactflow')>(), useReactFlow: () => ({ setNodes: vi.fn(), setEdges: vi.fn() }), useStore: (select: (s: unknown)=>unknown) => select({ transform: [0,0,state.zoom], connectionEndHandle: { handleId: state.handleId }, nodeInternals:state.nodes }) }))
let host: HTMLDivElement, root: Root
beforeEach(() => {
  state.nodes.clear()
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host)
})
afterEach(async () => { await act(async () => root.unmount()); host.remove() })
describe('relation endpoint preview and controls', () => {
  it('bends into the hovered side from every source side independently of viewport zoom', async () => {
    const expected = { left: [1,0], right: [-1,0], top: [0,1], bottom: [0,-1] }
    for (const zoom of [0.1,0.55,1,1.4,4]) for (const from of Object.values(Position)) for (const side of Object.values(Position)) {
      state.zoom = zoom; state.handleId = `target-${side}-31`
      const target = diagramTerminalPoint(400,200,side,5)
      const props = { fromX:100,fromY:50,toX:target.x,toY:target.y,fromPosition:from,toPosition:Position.Top } as ConnectionLineComponentProps
      await act(async () => root.render(createElement('svg', null, createElement(DiagramConnectionLine, props))))
      const path = host.querySelector('path[marker-end]')!
      const numbers = [...path.getAttribute('d')!.matchAll(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi)].map(n=>Number(n[0]))
      const [x0,y0,x,y] = numbers.slice(-4)
      expect([x,y]).toEqual([target.x,target.y])
      expect([Math.sign(x-x0),Math.sign(y-y0)]).toEqual(expected[side])
      expect(host.querySelector('marker')!.getAttribute('orient')).toBe('auto')
    }
  })
  it('points the actual saved-edge arrowhead into every target side for sharp, rounded and curved routes', async () => {
    const expected = { left: [1,0], right: [-1,0], top: [0,1], bottom: [0,-1] }
    for (const zoom of [0.1,0.55,1,1.4,4]) for (const from of Object.values(Position)) for (const side of Object.values(Position)) for (const waypoints of ['sharp','rounded','curved']) {
      state.zoom = zoom
      const props = { id:'flow',source:'a',target:'b',sourceX:100+(from==='left'?-4:from==='right'?4:0),sourceY:50+(from==='top'?-4:from==='bottom'?4:0),targetX:400+(side==='left'?-4:side==='right'?4:0),targetY:200+(side==='top'?-4:side==='bottom'?4:0),sourceHandleId:`source-${from}`,targetHandleId:`target-${side}`,sourcePosition:from,targetPosition:side,selected:true,
        data:{visual:{waypoints,endSpacing:4,endArrow:'classic'},arrange:{terminalSpacing:3}} } as EdgeProps
      await act(async () => root.render(createElement('svg', null, createElement(AnchoredSmoothStepEdge, props))))
      const points = host.querySelector('polygon')!.getAttribute('points')!.split(' ').map(pair=>pair.split(',').map(Number))
      const [tip,base1,base2] = points
      const target = diagramTerminalPoint(400,200,side,7)
      expect(tip).toEqual([target.x,target.y])
      const dx=tip[0]-(base1[0]+base2[0])/2, dy=tip[1]-(base1[1]+base2[1])/2
      const actual = [Math.abs(dx)<0.001?0:Math.sign(dx),Math.abs(dy)<0.001?0:Math.sign(dy)]
      expect(actual).toEqual(expected[side])
    }
  })
  it('matches the magnetic preview to the saved arrow and keeps the route stable through selection changes', async () => {
    state.handleId=null
    state.nodes.set('task',{id:'task',type:'bpmnElement',position:{x:400,y:200},style:{width:200,height:100},data:{notationId:'task'}})
    for(const zoom of [0.1,0.55,1,1.4,4]) {
      state.zoom=zoom
      const preview={fromX:100,fromY:50,toX:462,toY:200-24/zoom,fromPosition:Position.Bottom,toPosition:Position.Top,fromNode:{id:'start'},connectionStatus:null} as ConnectionLineComponentProps
      await act(async()=>root.render(createElement('svg',null,createElement(DiagramConnectionLine,preview))))
      const numbers=[...host.querySelector('path[marker-end]')!.getAttribute('d')!.matchAll(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi)].map(m=>Number(m[0]))
      const previewTip=numbers.slice(-2)
      expect(previewTip).toEqual([462,200])
      let path:string|null=null
      for(const selected of [true,false,true]) {
        const saved={id:'edge',source:'start',target:'task',sourceX:100,sourceY:54,targetX:462,targetY:196,sourceHandleId:'source-bottom',targetHandleId:'target-top-31',sourcePosition:Position.Bottom,targetPosition:Position.Top,selected} as EdgeProps
        await act(async()=>root.render(createElement('svg',null,createElement(AnchoredSmoothStepEdge,saved))))
        expect(host.querySelector('polygon')!.getAttribute('points')!.split(' ')[0].split(',').map(Number)).toEqual(previewTip)
        const next=host.querySelector('.react-flow__edge-path')!.getAttribute('d')
        if(path!==null) expect(next).toBe(path)
        path=next
      }
    }
  })
  it('keeps visible endpoints 6.5 screen pixels across zoom, centered over the larger invisible reconnect targets', async () => {
    for (const zoom of [0.1,0.55,1,1.4,4]) {
      state.zoom=zoom
      await act(async () => root.render(createElement('svg', null, createElement(DiagramEdgeEndpointControls,{edgeId:'flow',sourcePosition:Position.Bottom,targetPosition:Position.Top,sourceX:100,sourceY:40,targetX:400,targetY:200,selected:true}))))
      const circles = [...host.querySelectorAll('circle')]
      expect(circles).toHaveLength(2)
      expect(Number(circles[0].getAttribute('r'))*zoom*2).toBeCloseTo(6.5)
      expect(circles.map(c=>[c.getAttribute('cx'),c.getAttribute('cy')])).toEqual([['100','40'],['400','200']])
      expect(host.querySelector('[data-diagram-endpoint-dot=target]')!.getAttribute('cx')).toBe('400')
    }
    await act(async () => root.render(createElement('svg', null, createElement(DiagramEdgeEndpointControls,{edgeId:'flow',sourcePosition:Position.Bottom,targetPosition:Position.Top,sourceX:100,sourceY:40,targetX:400,targetY:200,selected:false}))))
    expect(host.querySelector('circle')).toBeNull()
  })
})
