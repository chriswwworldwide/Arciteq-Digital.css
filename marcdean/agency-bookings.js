import {seedAgency,saveBooking,approveBooking,confirmBooking,setBookingStage,updateProgress,conflictsFor,calendarFile,readAgencyState} from './agency-bookings-model.js';

const key='marcdean:agency-bookings-preview:v1',inboxKey='marcdean:agency-enquiries-preview:v1';
const $=id=>document.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const read=key=>{try{return localStorage.getItem(key);}catch{return null;}};
const money=value=>new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP',maximumFractionDigits:2}).format(value/100);
const pounds=value=>{if(!/^\d+(\.\d{1,2})?$/.test(String(value)))throw new Error('Use a non-negative GBP amount with at most two decimal places.');return Math.round(Number(value)*100);};
const inbox=()=>{try{const value=JSON.parse(read(inboxKey)||'[]');return Array.isArray(value)?value.slice(-100):[];}catch{return [];}};
const publicForm=$('partnership-form');
if(publicForm){
 publicForm.addEventListener('submit',event=>{
  event.preventDefault();if(!publicForm.reportValidity())return;
  const status=$('partnership-message');status.hidden=false;
  try{
   const data=Object.fromEntries(new FormData(publicForm));
   const contact=String(data.name||'').trim()+' · '+String(data.email||'').trim();
   if(!/^[^@\s]+@example\.test$/.test(data.email))throw new Error('Use an @example.test address in this walkthrough.');
   const record=saveBooking(null,{title:String(data.organisation)+' · '+String(data.type),organisation:data.organisation,type:data.type,date:data.date,start:data.start,end:data.end,venue:data.venue,feePence:pounds(data.budget||'0'),deliverables:data.deliverables,rights:'Proposed usage rights, fees and exclusivity to be agreed with Joe.',owner:'Joe',contact},'Joe');
   record.id='public-'+crypto.randomUUID();
   const pending=inbox();if(pending.length>=100)throw new Error('This walkthrough inbox is full; no new enquiry was saved.');
   localStorage.setItem(inboxKey,JSON.stringify([...pending,record]));
   publicForm.reset();status.textContent='Test enquiry saved for Joe in this browser. It will appear in Events & Partnerships when the Desk is opened or its inbox is refreshed. No email was sent and no booking is confirmed.';
  }catch(error){status.textContent=error.message==='QuotaExceededError'?'Browser storage is full; nothing was saved.':error.message;}
 });
}
if($('agency-list')){
 let state=readAgencyState(read(key))||seedAgency(),actor='Joe',activeId=state.bookings[0]?.id,creating=false,dirty=false;
 const briefForm=$('agency-brief');
 const message=text=>{const node=$('agency-message'),copy=document.createElement('span'),dismiss=document.createElement('button');copy.textContent=text;dismiss.type='button';dismiss.className='btn btn-ghost';dismiss.textContent='Dismiss';dismiss.setAttribute('aria-label','Dismiss status message');dismiss.addEventListener('click',()=>{node.hidden=true;});node.replaceChildren(copy,dismiss);node.hidden=false;};
 const persist=next=>{const safe=readAgencyState(JSON.stringify(next));if(!safe){message('Could not save this preview record. Check its fields; the walkthrough supports up to 100 opportunities and 100 protected times.');return false;}try{localStorage.setItem(key,JSON.stringify(safe));state=safe;return true;}catch{message('Could not save in browser storage. Nothing was updated; check available storage and try again.');return false;}};
 const current=()=>creating?null:state.bookings.find(b=>b.id===activeId)||null;
 function importInbox(){
  const next=structuredClone(state);let added=0;
  for(const entry of inbox()){
   if(!/^public-[a-zA-Z0-9-]{1,80}$/.test(entry?.id)||next.bookings.some(b=>b.id===entry.id))continue;
   try{const record=saveBooking(null,entry,'Joe');record.id=entry.id;record.history=[{at:new Date().toISOString(),actor:'Joe',text:'Test enquiry imported from the public Work with Marc form. No email received or sent.'}];next.bookings.unshift(record);added++;}catch{continue;}
  }
  if(added&&persist(next)){activeId=next.bookings[0].id;creating=false;message(`${added} public test ${added===1?'enquiry':'enquiries'} added to Joe’s pipeline.`);}
  return added;
 }
 const nextStep=b=>!b?'Add the brief. Joe reviews the commercial side; Marc approves availability.':conflictsFor(b,state).length?'Date conflict: agree another time before confirming.':b.stage==='Declined'?'Closed: this opportunity was declined in the walkthrough.':b.stage==='Delivered'?b.invoice==='Paid'?'Delivered and fee marked paid in this preview.':'Delivery recorded. Joe: follow up the outstanding invoice.':b.stage==='Confirmed'?'Booking confirmed. Keep delivery and invoice status up to date.':!b.approvals.Joe?'Joe: review fee, deliverables, usage rights and exclusivity.':!b.approvals.Marc?'Marc: review the brief and approve availability.':'Both approved. Joe can confirm the booking.';
 function render(){
  const b=current(),confirmed=state.bookings.filter(b=>['Confirmed','Delivered'].includes(b.stage));
  $('agency-metrics').innerHTML=[['Open opportunities',state.bookings.filter(b=>['Enquiry','Hold'].includes(b.stage)).length],['Awaiting Marc',state.bookings.filter(b=>['Enquiry','Hold'].includes(b.stage)&&!b.approvals.Marc).length],['Confirmed fees · example',money(confirmed.reduce((sum,b)=>sum+b.feePence,0))],['Unpaid fees · example',money(confirmed.filter(b=>b.invoice!=='Paid').reduce((sum,b)=>sum+b.feePence,0))]].map(([label,value])=>`<div class="agency-metric"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`).join('');
  const owner=$('filter-owner').value,stage=$('filter-stage').value;
  const bookings=state.bookings.filter(b=>(!owner||b.owner===owner)&&(!stage||b.stage===stage)).sort((a,b)=>(a.date+a.start).localeCompare(b.date+b.start));
  $('agency-list').innerHTML=bookings.length?bookings.map(item=>`<button class="agency-card" type="button" data-booking="${esc(item.id)}" aria-pressed="${item.id===activeId&&!creating}"><span class="agency-stage">${esc(item.stage)} · Owner: ${esc(item.owner)}</span><strong>${esc(item.title)}</strong><span>${esc(item.organisation)}</span><small>${esc(item.date)} · ${esc(item.start)}–${esc(item.end)} UK</small><small>${item.stage==='Enquiry'?'Indicative budget':'Fee'}: ${esc(money(item.feePence))}</small>${conflictsFor(item,state).length?'<span class="agency-conflict">Date conflict · review required</span>':''}</button>`).join(''):'<p>No opportunities match these filters.</p>';
  $('booking-title').textContent=b?.title||'New commercial enquiry';$('booking-stage').textContent=b?`${b.type} · ${b.stage}`:'Events & Partnerships';$('booking-next').textContent=nextStep(b);
  for(const field of ['title','organisation','type','owner','date','start','end','venue','deliverables','rights','contact'])briefForm.elements[field].value=b?.[field]??({type:'Appearance',owner:'Joe',start:'10:00',end:'11:00'}[field]||'');
  briefForm.elements.fee.value=b?String(b.feePence/100):'0';dirty=false;
  for(const control of briefForm.elements)control.disabled=Boolean(b&&(b.stage==='Delivered'||b.invoice==='Paid'));
  const conflicts=b?conflictsFor(b,state):[];$('booking-conflicts').hidden=!conflicts.length;$('booking-conflicts').textContent=conflicts.map(c=>`${c.title} · ${c.date}, ${c.start}–${c.end} UK`).join(' | ');
  $('approval-status').innerHTML=['Joe','Marc'].map(person=>`<span class="${b?.approvals[person]?'approved':''}">${person==='Joe'?'Joe · Commercial terms':'Marc · Availability'}: ${b?.approvals[person]?'Approved':'Awaiting review'}</span>`).join('');
  const open=b&&['Enquiry','Hold'].includes(b.stage);
  $('approve-booking').textContent=actor==='Joe'?'Approve commercial terms · Joe':'Approve availability · Marc';$('approve-booking').disabled=!open||b.approvals[actor];
  $('confirm-booking').disabled=!open||actor!=='Joe'||!b.approvals.Joe||!b.approvals.Marc||conflicts.length>0;
  $('hold-booking').disabled=!b||b.stage==='Delivered'||b.invoice==='Paid';$('decline-booking').disabled=!b||['Delivered','Declined'].includes(b.stage)||b.invoice==='Paid';
  const tracked=b&&['Confirmed','Delivered'].includes(b.stage);
  $('booking-delivered').checked=b?.delivered||false;$('booking-delivered').disabled=!tracked;
  $('booking-invoice').value=b?.invoice||'Not raised';$('booking-invoice').disabled=!tracked||actor!=='Joe';
  $('agency-progress').querySelector('[type=submit]').disabled=!tracked;$('export-engagement').disabled=!tracked;
  $('booking-history').innerHTML=(b?.history||[]).slice().reverse().map(h=>`<li><strong>${esc(h.actor)}</strong> · ${esc(h.text)}<time>${esc(h.at.replace('T',' ').slice(0,16))} UTC</time></li>`).join('');
  $('protected-list').innerHTML=state.blocks.map(block=>`<li>${esc(block.title)} · ${esc(block.date)} ${esc(block.start)}–${esc(block.end)} UK <button class="btn btn-ghost" type="button" data-remove-block="${esc(block.id)}" ${actor==='Marc'?'':'disabled'}>Remove protected time</button></li>`).join('');
  $('protected-form').querySelector('button').disabled=actor!=='Marc';
  document.querySelectorAll('[data-actor]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.actor===actor)));
 }
 function change(action){
  if(dirty){message('Save the changed brief first. Both approvals will reset.');return;}
  const b=current();if(!b){message('Save the enquiry before reviewing it.');return;}
  try{const updated=action(b);if(persist({...state,bookings:state.bookings.map(item=>item.id===b.id?updated:item)})){render();message(updated.history.at(-1).text);}}catch(error){message(error.message);}
 }
 briefForm.addEventListener('input',()=>{dirty=true;for(const id of ['approve-booking','confirm-booking','hold-booking','decline-booking','export-engagement'])$(id).disabled=true;$('booking-next').textContent='Unsaved brief changes. Save first; both approvals will reset.';});
 briefForm.addEventListener('submit',event=>{
  event.preventDefault();if(!briefForm.reportValidity())return;
  try{const values=Object.fromEntries(new FormData(briefForm));values.feePence=pounds(values.fee);const b=current(),updated=saveBooking(b,values,actor);const bookings=b?state.bookings.map(item=>item.id===b.id?updated:item):[updated,...state.bookings];if(persist({...state,bookings})){activeId=updated.id;creating=false;render();message('Brief saved. Review the approvals and next step.');}}catch(error){message(error.message);}
 });
 $('agency-list').addEventListener('click',event=>{const button=event.target.closest('[data-booking]');if(!button)return;if(dirty){message('Save the changed brief before changing opportunities.');return;}activeId=button.dataset.booking;creating=false;render();if(matchMedia('(max-width:900px)').matches)document.querySelector('.agency-detail')?.scrollIntoView();});
 $('new-booking').addEventListener('click',()=>{if(dirty){message('Save your current brief first.');return;}creating=true;activeId=null;render();briefForm.elements.title.focus();});
 document.querySelectorAll('[data-actor]').forEach(button=>button.addEventListener('click',()=>{if(dirty){message('Save the current brief before switching responsibility.');return;}actor=button.dataset.actor;render();}));
 $('filter-owner').addEventListener('change',()=>{if(!dirty)render();});$('filter-stage').addEventListener('change',()=>{if(!dirty)render();});
 $('approve-booking').addEventListener('click',()=>change(b=>approveBooking(b,actor)));
 $('confirm-booking').addEventListener('click',()=>change(b=>confirmBooking(b,actor,state)));
 $('hold-booking').addEventListener('click',()=>change(b=>setBookingStage(b,'Hold',actor)));
 $('decline-booking').addEventListener('click',()=>change(b=>setBookingStage(b,'Declined',actor)));
 $('agency-progress').addEventListener('submit',event=>{event.preventDefault();change(b=>updateProgress(b,{delivered:$('booking-delivered').checked,invoice:$('booking-invoice').value},actor));});
 $('export-engagement').addEventListener('click',()=>{if(dirty)return;try{const url=URL.createObjectURL(new Blob([calendarFile(current())],{type:'text/calendar;charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download='marcdean-engagement-preview.ics';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(error){message(error.message);}});
 $('protected-list').addEventListener('click',event=>{const button=event.target.closest('[data-remove-block]');if(!button||actor!=='Marc')return;if(dirty){message('Save the brief first.');return;}const block=state.blocks.find(item=>item.id===button.dataset.removeBlock);if(block&&confirm(`Remove protected time “${block.title}” on ${block.date} from this browser preview?`)){if(persist({...state,blocks:state.blocks.filter(item=>item.id!==block.id)})){render();message('Protected time removed from this browser preview.');}}});
 $('protected-form').addEventListener('submit',event=>{event.preventDefault();if(actor!=='Marc'){message('Switch to Marc to add protected athlete time.');return;}if(dirty){message('Save the brief before adding protected time.');return;}const data=Object.fromEntries(new FormData(event.currentTarget));const next=readAgencyState(JSON.stringify({...state,blocks:[...state.blocks,{...data,id:crypto.randomUUID()}]}));if(!next){message('Check the protected date and time range.');return;}if(persist(next)){event.currentTarget.reset();render();message('Protected time added. Conflicts will block booking confirmation.');}});
 const sync=document.createElement('button');sync.id='refresh-agency-inbox';sync.type='button';sync.className='btn btn-ghost';sync.textContent='Refresh public enquiry inbox';$('agency-list').before(sync);sync.addEventListener('click',()=>{if(dirty){message('Save the current brief before refreshing the inbox.');return;}const added=importInbox();render();if(!added)message('No new test enquiries in this browser.');});
 addEventListener('storage',event=>{if(event.key===inboxKey)message('A new public test enquiry is available. Refresh the enquiry inbox when ready.');});
 importInbox();render();
}
