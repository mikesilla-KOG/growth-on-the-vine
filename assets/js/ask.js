(function(){
var API='https://gotv-ask.growonthevine.workers.dev/ask';
var as=[].slice.call(document.querySelectorAll('#answers .answer')),bs=[].slice.call(document.querySelectorAll('.qbtn'));
var live=document.getElementById('live'),form=document.getElementById('askform'),inp=document.getElementById('q'),go=document.getElementById('go');
function el(t,c,x){var n=document.createElement(t);if(c)n.className=c;if(x!=null)n.textContent=x;return n}
function link(href,cls,txt){var a=el('a',cls,txt);a.href=href;a.target='_blank';a.rel='noopener noreferrer';return a}
function safeUrl(u){return /^https:\/\/(www\.youtube\.com|growonthevine\.com)\//.test(u)?u:'#'}
function showSample(id,push){live.textContent='';as.forEach(function(a){a.classList.toggle('on',a.id===id)});bs.forEach(function(b){b.setAttribute('aria-pressed',b.dataset.target===id)});
 var e=document.getElementById(id);if(e&&push){e.scrollIntoView({behavior:'smooth',block:'start'});history.replaceState(null,'','#'+id)}}
function clearSamples(){as.forEach(function(a){a.classList.remove('on')});bs.forEach(function(b){b.setAttribute('aria-pressed','false')})}
function msg(kind,paras,verse){var d=el('div','livemsg '+kind);paras.forEach(function(p){d.appendChild(el('p',null,p))});
 if(verse){var bq=el('blockquote','verse');bq.appendChild(el('p',null,verse.text));var c=el('cite');c.appendChild(el('strong',null,verse.ref+' (BSB)'));bq.appendChild(c);d.appendChild(bq)}return d}
function render(d){
 var art=el('article','answer on');art.id='a-live';var h=el('h2',null,d.question);art.appendChild(h);
 var cls=d.coverage==='full'?['ok','Covered in the sermons']:d.coverage==='partial'?['mid','Partly covered in the sermons']:['no','Not covered in the sermons yet'];
 art.appendChild(el('p','badge badge-'+cls[0],cls[1]));
 var vnum={};(d.verses||[]).forEach(function(v,i){vnum[v.id]=i+1});var sm={};(d.sermons||[]).forEach(function(s){sm[s.id]=s});var vref={};(d.verses||[]).forEach(function(v){vref[v.id]=v.ref});
 var card=el('div','summarycard');var sl=el('p','slabel','Answer ');sl.appendChild(el('span',null,'woven from Scripture (BSB) and the sermons'));card.appendChild(sl);
 (d.paragraphs||[]).forEach(function(pg){
  if(pg.label)card.appendChild(el('h3','plabel',pg.label));var p=el('p');
  pg.segs.forEach(function(g){
   if(g.t==='text'){p.appendChild(document.createTextNode(g.v))}
   else if(g.t==='b'){var q=el('q','b','\u201C'+g.v+'\u201D');p.appendChild(q);var c=el('span','cite');c.appendChild(document.createTextNode(' (BSB, '));var a=el('a','rc',vref[g.vid]||'');a.href='#v-live-'+(vnum[g.vid]||1);c.appendChild(a);c.appendChild(document.createTextNode(')'));p.appendChild(c)}
   else if(g.t==='k'){p.appendChild(el('q','k','\u201C'+g.v+'\u201D'))}
   else if(g.t==='s'&&sm[g.sid]){var s=sm[g.sid];p.appendChild(document.createTextNode(' '));var a2=link(safeUrl(s.watch_url),'sc','\u25B6 '+s.title+' '+s.time);a2.title='Watch this part on YouTube';p.appendChild(a2);p.appendChild(document.createTextNode(' '))}
   else if(g.t==='v'){var a3=el('a','rc',vref[g.vid]||'');a3.href='#v-live-'+(vnum[g.vid]||1);p.appendChild(a3)}
  });card.appendChild(p)});
 var lg=el('p','legend');lg.appendChild(el('q','b','Green'));lg.appendChild(document.createTextNode(' = Scripture (BSB) \u00B7 '));lg.appendChild(el('q','k','Gold'));lg.appendChild(document.createTextNode(' = Pastor Kincer\u2019s own words from the sermon transcripts'));card.appendChild(lg);art.appendChild(card);
 if(d.not_covered){var gn=el('div','gapnote');gn.appendChild(el('strong',null,'Not covered in the sermons yet. '));gn.appendChild(document.createTextNode(d.not_covered));art.appendChild(gn)}
 var sc=el('section','blk');var h3=el('h3',null,'Scripture ');sc.appendChild(h3);h3.appendChild(el('span','chip chip-bible','BSB'));
 (d.verses||[]).forEach(function(v,i){var bq=el('blockquote','verse');bq.id='v-live-'+(i+1);bq.appendChild(el('p',null,v.text));var c=el('cite');c.appendChild(el('strong',null,v.ref+' (BSB)'));bq.appendChild(c);sc.appendChild(bq)});art.appendChild(sc);
 var ss=el('section','blk');ss.appendChild(el('h3',null,'Sermons that talk about this'));
 if((d.sermons||[]).length){var ul=el('ul','smlist');d.sermons.forEach(function(s){var li=el('li');li.appendChild(el('span','smt','\u201C'+s.title+'\u201D \u00B7 '+s.section_question));var ac=el('span','actions');
   ac.appendChild(link(safeUrl(s.watch_url),'btn-watch','\u25B6 Watch this part ('+s.time+')'));ac.appendChild(link(safeUrl(s.page_url),'btn-watch alt','Read this part on the message page'));li.appendChild(ac);ul.appendChild(li)});ss.appendChild(ul);
   var seen={},ms=[];d.sermons.forEach(function(s){if(!seen[s.message_url]){seen[s.message_url]=1;ms.push(s)}});
   var fm=el('p','mini','Full messages: ');ms.forEach(function(s,i){if(i)fm.appendChild(document.createTextNode(' \u00B7 '));fm.appendChild(link(safeUrl(s.message_url),null,s.title))});ss.appendChild(fm);
   var cl={},cs=[];d.sermons.forEach(function(s){(s.clips||[]).forEach(function(c){if(!cl[c.url]){cl[c.url]=1;cs.push(c)}})});
   if(cs.length){var rc=el('p','mini','Related Shorts: ');cs.forEach(function(c,i){if(i)rc.appendChild(document.createTextNode(' \u00B7 '));rc.appendChild(link(safeUrl(c.url),null,c.title))});ss.appendChild(rc)}
 }else{ss.appendChild(el('p',null,'None of the six messages on our site speaks to this question yet.'))}
 art.appendChild(ss);art.appendChild(el('p','aiword','Answers are written by AI from the Bible (BSB) and Pastor Kincer\u2019s messages on this site. Please read the verses and listen to the messages yourself. A computer checked each quote against the source text, but mistakes are still possible.'));
 return art}
function busy(on){go.disabled=on;live.setAttribute('aria-busy',on?'true':'false')}
var seq=0;
function ask(q,fallbackId){
 q=(q||'').replace(/\s+/g,' ').trim();if(!q){inp.focus();return}
 if(q.length>300){live.textContent='';live.appendChild(msg('err',['Please keep your question under 300 characters.']));return}
 var my=++seq;clearSamples();live.textContent='';var ld=el('div','loading');ld.appendChild(el('span','spin'));ld.appendChild(el('span',null,'Looking through Scripture and the sermons\u2026 this takes about 10 seconds.'));live.appendChild(ld);busy(true);
 live.scrollIntoView({behavior:'smooth',block:'nearest'});
 var ctl=new AbortController(),to=setTimeout(function(){ctl.abort()},60000);
 function fail(paras){if(my!==seq)return;live.textContent='';if(fallbackId&&document.getElementById(fallbackId)){var m=msg('err',paras.concat(['Showing the prepared sample answer instead.']));live.appendChild(m);as.forEach(function(a){a.classList.toggle('on',a.id===fallbackId)});bs.forEach(function(b){b.setAttribute('aria-pressed',b.dataset.target===fallbackId)})}else{var m2=msg('err',paras);var ap=form.getAttribute('data-askpage');if(ap){var pp=el('p');pp.appendChild(link(ap,null,'Try the Ask page'));m2.appendChild(pp)}live.appendChild(m2)}}
 fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({q:q}),signal:ctl.signal}).then(function(r){return r.json().catch(function(){return {}}).then(function(d){return {s:r.status,d:d}})}).then(function(x){
  clearTimeout(to);if(my!==seq)return;busy(false);var d=x.d||{};
  if(d.kind==='answer'&&d.ok){live.textContent='';var a=render(d);live.appendChild(a);a.scrollIntoView({behavior:'smooth',block:'start'})}
  else if(d.kind==='crisis'){live.textContent='';live.appendChild(msg('care',[d.message],d.verse))}
  else if(d.kind==='declined'||d.kind==='bad'){live.textContent='';live.appendChild(msg('',[d.message]))}
  else if(d.kind==='limit'){fail([d.message])}
  else{fail([d.message||'Something went wrong on our side and we could not put an answer together. Please try again in a moment.'])}
 }).catch(function(){clearTimeout(to);busy(false);fail(['We could not reach the answer service just now. Please check your connection and try again in a moment.'])});
}
form.addEventListener('submit',function(e){e.preventDefault();ask(inp.value,null)});
bs.forEach(function(b){b.addEventListener('click',function(){inp.value=b.dataset.q;ask(b.dataset.q,b.dataset.target)})});
var h=(location.hash||'').slice(1);if(h){var m=h.match(/^(?:a|v)-([a-z]+)/);if(m&&document.getElementById('a-'+m[1]))showSample('a-'+m[1],false)}
})();
