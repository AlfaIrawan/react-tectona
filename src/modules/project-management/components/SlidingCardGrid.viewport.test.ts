import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SlidingCardGrid } from './SlidingCardGrid'
const geometry={width:1200,scale:1,top:100,viewportHeight:600,heights:Array(16).fill(100) as number[]}
const observers:Observer[]=[]
class Observer {
 targets=new Set<Element>()
 callback:ResizeObserverCallback
 constructor(callback:ResizeObserverCallback){this.callback=callback;observers.push(this)}
 observe(element:Element){this.targets.add(element)}
 disconnect(){this.targets.clear()}
 unobserve(element:Element){this.targets.delete(element)}
}
let host:HTMLDivElement,root:Root,originalHeight:PropertyDescriptor|undefined
const render=()=>createElement(SlidingCardGrid<number>,{items:Array.from({length:16},(_,i)=>i),getKey:String,renderItem:i=>createElement('article',{'data-qa-card':i},'Idea '+i)})
beforeEach(()=>{
 (globalThis as {IS_REACT_ACT_ENVIRONMENT?:boolean}).IS_REACT_ACT_ENVIRONMENT=true
 vi.useFakeTimers();observers.length=0;Object.assign(geometry,{width:1200,scale:1,top:100,viewportHeight:600,heights:Array(16).fill(100)})
 originalHeight=Object.getOwnPropertyDescriptor(window,'innerHeight')
 Object.defineProperty(window,'innerHeight',{configurable:true,get:()=>geometry.viewportHeight})
 vi.stubGlobal('ResizeObserver',Observer)
 vi.spyOn(HTMLElement.prototype,'clientWidth','get').mockImplementation(function(this:HTMLElement){return geometry.width+(this.classList.contains('overflow-x-clip')?96:0)})
 vi.spyOn(HTMLElement.prototype,'offsetHeight','get').mockImplementation(function(this:HTMLElement){const card=this.querySelector('[data-qa-card]');return card?geometry.heights[Number(card.getAttribute('data-qa-card'))]:0})
 vi.spyOn(HTMLElement.prototype,'getBoundingClientRect').mockImplementation(function(this:HTMLElement){return {top:geometry.top,left:0,right:this.clientWidth*geometry.scale,bottom:geometry.top+100,width:this.clientWidth*geometry.scale,height:100,x:0,y:geometry.top,toJSON:()=>({})}})
 host=document.createElement('div');document.body.appendChild(host);root=createRoot(host)
})
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.restoreAllMocks();vi.unstubAllGlobals();vi.useRealTimers();if(originalHeight)Object.defineProperty(window,'innerHeight',originalHeight)})
const next=()=>host.querySelector<HTMLButtonElement>('[aria-label="Next page"]')
describe('card grid viewport regressions',()=>{
 it('shows every card without a pager when a scaled grid actually fits the viewport',async()=>{
  Object.assign(geometry,{scale:0.625,top:210,viewportHeight:954,heights:[...Array(4).fill(260),...Array(12).fill(220)]})
  await act(async()=>root.render(render()))
  expect(next()).toBeNull();expect(host.querySelectorAll('[data-sliding-card]')).toHaveLength(16)
 })
 it('pages only below the exact bottom boundary and removes paging when the viewport grows',async()=>{
  geometry.viewportHeight=572 // 100 top + 448 actual rows/gaps + 24 bottom reserve.
  await act(async()=>root.render(render()));expect(next()).toBeNull()
  geometry.viewportHeight=571
  await act(async()=>window.dispatchEvent(new Event('resize')));await act(async()=>vi.advanceTimersByTimeAsync(20))
  expect(next()).not.toBeNull();expect(host.textContent).toContain('1–12 of 16')
  await act(async()=>next()!.click());expect(host.textContent).toContain('13–16 of 16')
  geometry.viewportHeight=700
  await act(async()=>window.dispatchEvent(new Event('resize')));await act(async()=>vi.advanceTimersByTimeAsync(20))
  expect(next()).toBeNull()
 })
 it('responds to a later card growing even if the outer grid width and top do not change',async()=>{
  await act(async()=>root.render(render()));expect(next()).toBeNull()
  geometry.heights[8]=300
  const card=host.querySelectorAll('[data-sliding-card]')[8]
  await act(async()=>{for(const observer of observers)if(observer.targets.has(card))observer.callback([{target:card} as ResizeObserverEntry],observer as unknown as ResizeObserver)})
  await act(async()=>vi.advanceTimersByTimeAsync(20))
  expect(next()).not.toBeNull()
 })
 it('remeasures when surrounding panels move the grid without resizing it',async()=>{
  await act(async()=>root.render(render()));expect(next()).toBeNull()
  geometry.top=300
  await act(async()=>root.render(render()))
  expect(next()).not.toBeNull()
 })
 it('keeps original card width and reserves side bleed without showing a neighboring page',async()=>{
  geometry.viewportHeight=450
  await act(async()=>root.render(render()))
  const viewport=host.querySelector<HTMLElement>('.overflow-x-clip')!,track=viewport.firstElementChild as HTMLElement,page=track.firstElementChild as HTMLElement
  const padding=Number.parseFloat(page.style.paddingInline),viewportWidth=geometry.width+2*padding
  const trackWidth=viewportWidth*Number.parseFloat(track.style.width)/100
  const pageWidth=trackWidth*Number.parseFloat(page.style.width)/100
  expect(pageWidth-2*padding).toBe(geometry.width)
  expect(padding).toBeGreaterThan(2)
  expect(pageWidth+padding).toBeGreaterThan(viewportWidth)
  expect(viewport.classList.contains('overflow-y-visible')).toBe(true)
 })
})
