import {describe,it,expect} from 'vitest';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../pitch/pitch.js',import.meta.url),'utf8');
function run(withVideo=false){
 const events=[],callbacks={},store=new Map();
 const player={duration:100,currentTime:50,paused:false,addEventListener:(name,fn)=>{callbacks[name]=fn;},play:()=>{}};
 const cover={hidden:false,addEventListener:(_name,fn)=>{callbacks.cover=fn;}};
 const cta={getAttribute:()=> 'cta_demo',addEventListener:(_name,fn)=>{callbacks.cta=fn;}};
 vm.runInNewContext(source,{document:{querySelector:()=>({getAttribute:()=> 'marcdean'}),getElementById:id=>withVideo?(id==='pitchVideo'?player:cover):null,querySelectorAll:()=>[cta],addEventListener:()=>{}},navigator:{sendBeacon:(_url,blob)=>{events.push(JSON.parse(blob.payload));return true;}},Blob:class{constructor([payload]){this.payload=payload;}},localStorage:{getItem:key=>store.get(key)||null,setItem:(key,value)=>store.set(key,value)},setInterval:()=>1,clearInterval:()=>{}});
 return {events,callbacks,cover};
}
describe('pitch landing with optional video',()=>{
 it('tracks a real landing view/CTA without a missing-player exception or invented play event',()=>{
  const state=run();expect(state.events.map(event=>event.event)).toEqual(['view']);state.callbacks.cta();expect(state.events.map(event=>event.event)).toEqual(['view','cta_demo']);
 });
 it('retains existing player start, progress and completion behaviour',()=>{
  const state=run(true);state.callbacks.cover();expect(state.cover.hidden).toBe(true);state.callbacks.timeupdate();state.callbacks.ended();expect(state.events.map(event=>event.event)).toEqual(['view','play','progress','progress','complete']);
 });
 it('publishes a usable Marc landing, not internal draft cards or a missing film',()=>{
  const html=fs.readFileSync(new URL('../pitch/marcdean/index.html',import.meta.url),'utf8');expect(html).toContain('Explore Marc');expect(html).toContain('/marcdean/agency-bookings.html');expect(html).not.toMatch(/LOCAL REVIEW DRAFT|Recording awaits|card-proof|preview\.js|<video/i);
 });
});
