export const bookingTypes=['Appearance','Sponsor content','Event','Partnership'];
export const roles=['Management','Faisal'];
export const stages=['Enquiry','Hold','Confirmed','Delivered','Declined'];
const fields=['title','organisation','type','date','start','end','venue','feePence','deliverables','rights','owner','contact'];
const text=(value,max=500)=>String(value||'').trim().slice(0,max);
const stamp=(record,actor,message)=>({...record,history:[...(record.history||[]),{at:new Date().toISOString(),actor,text:message}].slice(-60)});
const role=actor=>{if(!roles.includes(actor))throw new Error('Choose a valid preview role.');};
const validDate=value=>/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T12:00:00Z'))&&new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value;
const validTime=value=>/^([01]\d|2[0-3]):[0-5]\d$/.test(value);
function brief(input){
 const value={title:text(input.title,100),organisation:text(input.organisation,100),type:text(input.type,40),date:text(input.date,10),start:text(input.start,5),end:text(input.end,5),venue:text(input.venue,150),feePence:input.feePence,deliverables:text(input.deliverables,1500),rights:text(input.rights,1000),owner:input.owner,contact:text(input.contact,160)};
 if(!value.title||!value.organisation||!value.venue||!value.deliverables)throw new Error('Add a title, organisation, venue and deliverables.');
 if(!bookingTypes.includes(value.type)||!roles.includes(value.owner))throw new Error('Choose a valid booking type and owner.');
 if(!validDate(value.date)||!validTime(value.start)||!validTime(value.end)||value.end<=value.start)throw new Error('Choose a real date and an end time after the start. Times are UK local time.');
 if(!Number.isSafeInteger(value.feePence)||value.feePence<0||value.feePence>100000000)throw new Error('Use a non-negative fee with at most two decimal places.');
 return value;
}
export function saveBooking(previous,input,actor){
 role(actor);const value=brief(input);
 const changed=!previous||fields.some(key=>previous[key]!==value[key]);
 const result={...(previous||{}),...value,id:previous?.id||globalThis.crypto.randomUUID(),currency:'GBP',timeZone:'Europe/London',stage:previous?.stage||'Enquiry',approvals:previous?.approvals||{Faisal:false,Management:false},delivered:previous?.delivered||false,invoice:previous?.invoice||'Not raised',history:previous?.history||[]};
 if(changed&&previous&&(previous.stage==='Delivered'||previous.invoice==='Paid'))throw new Error('Keep the delivered or paid booking intact. Add a separate enquiry for any variation.');
 if(changed){result.approvals={Faisal:false,Management:false};result.delivered=false;result.invoice='Not raised';if(previous&&['Confirmed','Delivered'].includes(previous.stage))result.stage='Hold';return stamp(result,actor,previous?'Brief changed; both approvals reset.':'Enquiry added; Management owns commercial review.');}
 return result;
}
export function approveBooking(record,actor){
 role(actor);if(['Declined','Delivered'].includes(record.stage))throw new Error('This booking is closed.');
 if(actor==='Management'&&(!record.rights.trim()||record.rights.includes('to be agreed with Management')))throw new Error('Record the agreed usage rights and conditions before approving commercial terms.');
 return stamp({...record,approvals:{...record.approvals,[actor]:true}},actor,actor==='Faisal'?'Availability and athlete brief approved.':'Commercial terms, deliverables and usage rights approved.');
}
export function conflictsFor(record,state){
 return [...state.blocks,...state.bookings.filter(b=>b.id!==record.id&&['Hold','Confirmed','Delivered'].includes(b.stage))].filter(b=>b.date===record.date&&b.start<record.end&&b.end>record.start);
}
export function confirmBooking(record,actor,state){
 if(actor!=='Management')throw new Error('Management confirms the booking after both reviews.');
 brief(record);
 if(!['Enquiry','Hold'].includes(record.stage))throw new Error('Only an enquiry or hold can be confirmed.');
 if(!record.approvals.Faisal||!record.approvals.Management)throw new Error('Complete both Faisal’s availability and Management’s commercial approvals first.');
 if(conflictsFor(record,state).length)throw new Error('Resolve the date conflict before confirming.');
 return stamp({...record,stage:'Confirmed'},actor,'Booking confirmed in this preview; no external notification sent.');
}
export function setBookingStage(record,stage,actor){
 role(actor);if(record.stage==='Delivered'||record.invoice==='Paid')throw new Error('Keep delivered or paid bookings intact; add a separate enquiry for a variation.');if(!['Hold','Declined'].includes(stage))throw new Error('Use the approval workflow to confirm or deliver.');
 return stamp({...record,stage,approvals:{Faisal:false,Management:false},delivered:false,invoice:'Not raised'},actor,stage==='Hold'?'Date put on hold; approvals required.':'Opportunity declined in this preview.');
}
export function updateProgress(record,change,actor){
 role(actor);if(!['Confirmed','Delivered'].includes(record.stage))throw new Error('Confirm the booking before tracking delivery or invoice status.');
 if(!['Not raised','Requested','Paid'].includes(change.invoice))throw new Error('Choose an invoice status.');
 if(actor!=='Management'&&change.invoice!==record.invoice)throw new Error('Management owns invoice tracking.');
 return stamp({...record,delivered:Boolean(change.delivered),stage:change.delivered?'Delivered':'Confirmed',invoice:change.invoice},actor,'Delivery / invoice tracking updated manually. No invoice or payment sent.');
}
const icsText=value=>String(value).replaceAll('\\','\\\\').replace(/\r?\n/g,'\\n').replaceAll(',','\\,').replaceAll(';','\\;');
export function calendarFile(record){
 if(!['Confirmed','Delivered'].includes(record.stage))throw new Error('Only confirmed bookings can be exported.');
 const time=value=>record.date.replaceAll('-','')+'T'+value.replace(':','')+'00';
 return ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Station 9//Faisal booking preview//EN','BEGIN:VEVENT',`UID:${icsText(record.id)}@faisalpma.preview`,`DTSTAMP:${new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'')}`,`DTSTART;TZID=Europe/London:${time(record.start)}`,`DTEND;TZID=Europe/London:${time(record.end)}`,`SUMMARY:${icsText('PREVIEW — '+record.title)}`,`LOCATION:${icsText(record.venue)}`,'DESCRIPTION:Local walkthrough only. Not a live booking.','END:VEVENT','END:VCALENDAR',''].join('\r\n');
}
export function seedAgency(){
 const examples=[
  {id:'example-content',title:'Partner content day',organisation:'Example performance brand',type:'Sponsor content',date:'2026-12-05',start:'09:30',end:'12:00',venue:'Manchester studio · example',feePence:120000,deliverables:'One half-day shoot and two social clips. Creative reviewed before publication.',rights:'Organic social for 30 days; paid usage and exclusivity require a separate agreement.',owner:'Management',stage:'Enquiry'},
  {id:'example-panel',title:'Race-weekend panel',organisation:'Example event organiser',type:'Appearance',date:'2026-12-12',start:'14:00',end:'15:00',venue:'Event stage · example',feePence:75000,deliverables:'One 30-minute panel and a short audience Q&A.',rights:'Event recap only. No product endorsement or paid advertising rights agreed.',owner:'Management',stage:'Hold'},
  {id:'example-community',title:'Community training event',organisation:'Example gym partner',type:'Event',date:'2026-12-19',start:'10:00',end:'12:00',venue:'Partner gym · example',feePence:50000,deliverables:'Hosted session and meet-and-greet; participant safety arrangements to be agreed.',rights:'Event photography subject to participant permissions.',owner:'Faisal',stage:'Enquiry'}
 ];
 return {version:1,bookings:examples.map(example=>({...example,currency:'GBP',timeZone:'Europe/London',approvals:{Faisal:false,Management:false},delivered:false,invoice:'Not raised',history:[{at:'2026-11-11T09:00:00Z',actor:'Management',text:'Example enquiry prepared for this walkthrough, not a real booking.'}]})),blocks:[{id:'protected-training',title:'Protected training · example',date:'2026-12-05',start:'09:00',end:'11:00'}]};
}
export function readAgencyState(raw){
 try{
  const state=JSON.parse(raw);
  if(state?.version!==1||!Array.isArray(state.bookings)||state.bookings.length>100||!Array.isArray(state.blocks)||state.blocks.length>100)return null;
  const bookings=state.bookings.map(b=>{const value=brief(b);if(!/^[a-zA-Z0-9-]{1,100}$/.test(b.id)||!stages.includes(b.stage)||typeof b.approvals?.Faisal!=='boolean'||typeof b.approvals?.Management!=='boolean'||!['Not raised','Requested','Paid'].includes(b.invoice))throw new Error('Invalid stored booking');return {...value,id:b.id,currency:'GBP',timeZone:'Europe/London',stage:b.stage,approvals:{Faisal:b.approvals.Faisal,Management:b.approvals.Management},delivered:b.delivered===true,invoice:b.invoice,history:(Array.isArray(b.history)?b.history:[]).slice(-60).map(h=>({at:text(h.at,40),actor:roles.includes(h.actor)?h.actor:'Management',text:text(h.text,500)}))};});
  const blocks=state.blocks.map(b=>{if(!validDate(b.date)||!validTime(b.start)||!validTime(b.end)||b.start>=b.end)throw new Error('Invalid protected time');return {id:text(b.id,100),title:text(b.title,100),date:b.date,start:b.start,end:b.end};});
  return {version:1,bookings,blocks};
 }catch{return null;}
}
