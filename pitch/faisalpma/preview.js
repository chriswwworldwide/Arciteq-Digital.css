const selected=new URLSearchParams(location.search).get('card');
try{
 const response=await fetch('cards.json',{cache:'no-cache'});
 if(!response.ok)throw new Error('Card source could not load.');
 const data=await response.json();
 const links=document.getElementById('card-proof-links');
 for(const card of data.cards){const link=document.createElement('a');link.href='?card='+encodeURIComponent(card.id);link.textContent=card.id+' · '+card.title+' · '+(card.holdMs/1000)+'s';link.target='_blank';link.rel='noopener';links.append(link);}
 if(selected){
  const card=data.cards.find(card=>card.id===selected);if(!card)throw new Error('Unknown card.');
  document.body.classList.add('card-mode');document.getElementById('pitch-card').hidden=false;document.title='Faisal pitch card · '+card.id;
  for(const [id,text]of [['card-eyebrow',card.eyebrow],['card-title',card.title],['card-footer',card.footer]])document.getElementById(id).textContent=text;
  const lines=document.getElementById('card-lines');for(const text of card.lines){const line=document.createElement('p');line.className='card-line';line.textContent=text;lines.append(line);}
 }
}catch(error){if(selected){document.body.classList.add('card-mode');document.getElementById('pitch-card').hidden=false;document.getElementById('card-title').textContent='Card proof unavailable';document.getElementById('card-footer').textContent=error.message;}else document.getElementById('card-proof-links').textContent='Card proofs could not load. Refresh the local preview.';}
