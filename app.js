window.startPhotopedia = function(){
const DB = window.PHOTOPEDIA_CONTENT;
const entries = DB.entries;
const state = { current: 'home', section: 'home' };
const $ = s => document.querySelector(s);
const article = $('#article');
const context = $('#context');
const nav = $('#nav');
const crumbs = $('#crumbs');
const searchInput = $('#searchInput');
const searchResults = $('#searchResults');
const sidebar = $('#sidebar');
const noteDialog = $('#noteDialog');
const noteText = $('#noteText');
const noteTitle = $('#noteTitle');
const backBtn = $('#backBtn');
const starBtn = $('#starBtn');
const imageDialog = $('#imageDialog');
const imageDialogImg = $('#imageDialogImg');
const imageDialogCaption = $('#imageDialogCaption');
let renderingHistory = false;

function closeMobileSidebar(){ if(innerWidth<781) sidebar.classList.remove('open'); }

function esc(s=''){return s.replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function getNotes(){try{return JSON.parse(localStorage.getItem('photopedia-notes')||'{}')}catch{return {}}}
function setNotes(n){localStorage.setItem('photopedia-notes',JSON.stringify(n));window.PhotopediaDropbox?.savePersonal('notes.json',n)}
function noteFor(id){return getNotes()[id]||''}
function getStars(){try{const v=JSON.parse(localStorage.getItem('photopedia-starred')||'[]');return Array.isArray(v)?v:[]}catch{return []}}
function setStars(ids){const clean=[...new Set(ids)];localStorage.setItem('photopedia-starred',JSON.stringify(clean));window.PhotopediaDropbox?.savePersonal('starred.json',clean)}
function isStarred(id){return getStars().includes(id)}
function toggleStar(id){
  if(!entries[id]) return;
  const ids=getStars();
  const next=ids.includes(id)?ids.filter(x=>x!==id):[...ids,id];
  setStars(next);
  buildNav();
  updateStarButton();
}
function updateStarButton(){
  if(!starBtn) return;
  const id=state.current;
  if(!entries[id]){starBtn.classList.add('hidden');return}
  const on=isStarred(id);
  starBtn.classList.remove('hidden');
  starBtn.classList.toggle('active',on);
  starBtn.querySelector('span').textContent=on?'★':'☆';
  starBtn.setAttribute('aria-label',on?'Remove from Starred':'Add to Starred');
  starBtn.title=on?'Remove from Starred':'Add to Starred';
}

function buildNav(){
  const groups = [
    ['Explore',[['home','Home'],['starred','Starred']]],
    ['Library',[['learn','Learn'],['gear','Gear'],['field','Field Guide'],['lab','Lab'],['challenges','Challenges'],['notebook','Notebook']]]
  ];
  nav.innerHTML = groups.map(([title,items])=>`<div class="nav-group"><div class="nav-group-title">${title}</div>${items.map(([id,label])=>{
    const count=id==='notebook'?Object.keys(getNotes()).length:id==='starred'?getStars().length:Object.values(entries).filter(e=>e.section===id).length;
    return `<button class="nav-item" data-section="${id}"><span>${label}</span>${id!=='home'?`<span class="nav-count">${count}</span>`:''}</button>`
  }).join('')}</div>`).join('');
  nav.querySelectorAll('[data-section]').forEach(b=>b.onclick=()=>{showSection(b.dataset.section);closeMobileSidebar();});
  updateActiveNav();
}
function updateActiveNav(){nav.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('active', b.dataset.section===state.section))}
function setHash(id){
  if(renderingHistory) return;
  const hash='#'+id;
  if(location.hash===hash) return;
  const depth=(history.state?.photopediaDepth||0)+1;
  try{history.pushState({photopedia:true,id,photopediaDepth:depth},'',hash)}catch{location.hash=id}
  updateBackButton();
  updateStarButton();
}
function updateBackButton(){
  if(!backBtn) return;
  const e=entries[state.current];
  const hasFallback=!!e || state.section!=='home';
  backBtn.disabled=!((history.state?.photopediaDepth||0)>0 || hasFallback);
}
function setCrumbs(parts){
  crumbs.innerHTML=parts.map((p,i)=>{
    const cls=p.entry||p.section?'crumb-link':'crumb-current';
    const attr=p.entry?` data-entry="${p.entry}"`:p.section?` data-section-jump="${p.section}"`:'';
    return `${i?'<span class="crumb-sep">/</span>':''}<span class="${cls}"${attr}>${esc(p.label)}</span>`;
  }).join('');
}
function fallbackBack(){
  const e=entries[state.current];
  if(e?.parent) return showEntry(e.parent);
  if(e?.section==='gear') return showGear();
  if(e?.section && e.section!=='home') return showSection(e.section);
  if(state.section && state.section!=='home') return showHome();
}
function goBack(){
  if((history.state?.photopediaDepth||0)>0) history.back();
  else fallbackBack();
}
function renderFromLocation(){
  renderingHistory=true;
  const initial=(location.hash||'#home').slice(1);
  if(entries[initial]) showEntry(initial);
  else if(['learn','gear','field','lab','challenges','notebook','starred'].includes(initial)) showSection(initial);
  else showHome();
  renderingHistory=false;
  updateBackButton();
}


function showHome(){
  state.current='home';state.section='home';setHash('home');updateActiveNav();
  setCrumbs([{label:'Photopedia'}]);
  article.innerHTML=`<div class="home-hero"><div class="eyebrow">Personal photography reference</div><h1>Learn the photograph, not just the camera.</h1><p class="deck">A cross-linked reference built around the Fujifilm X100VI, Insta360 Ace Pro 2 + Xplorer Grip Pro, and iPhone 16 Pro Max.</p></div>
  <div class="home-cards">
    <div class="home-card" data-go="learn"><div class="eyebrow">Learn</div><h3>Understand photography</h3><p>Exposure, focus, optics, motion, sensors, colour and computational photography.</p></div>
    <div class="home-card" data-go-entry="x100vi"><div class="eyebrow">Gear</div><h3>Your X100VI</h3><p>Use the camera's physical controls as the centre of your photographic learning.</p></div>
    <div class="home-card" data-go="field"><div class="eyebrow">Field Guide</div><h3>What do I do?</h3><p>Start from a real shooting situation and work backward to the photographic decisions.</p></div>
    <div class="home-card" data-go="lab"><div class="eyebrow">Lab</div><h3>Learn by seeing</h3><p>Controlled experiments that make technical ideas tangible.</p></div>
    <div class="home-card" data-go="challenges"><div class="eyebrow">Challenges</div><h3>Go make photographs</h3><p>Daily prompts and weekly projects designed to turn ideas into practice.</p></div>
  </div><h2>Start a rabbit hole</h2><div class="topic-list">${['exposure','aperture','shutter-speed','iso','depth-of-field','computational-photography'].map(topicCard).join('')}</div>`;
  context.innerHTML=`<div class="context-section"><div class="eyebrow">V1.0.11</div><h3>Private, connected reference</h3><div class="context-note">Your Photopedia library loads privately from Dropbox after sign-in. GitHub Pages hosts only the application shell; notes, stars and reading preferences sync through Dropbox.</div></div>`;
  wireDynamic();
}

function topicCard(id){const e=entries[id];return `<div class="topic-row" data-entry="${id}"><strong>${e.title}</strong><span>${e.category}</span></div>`}

function showSection(section){
  if(section==='home') return showHome();
  if(section==='notebook') return showNotebook();
  if(section==='starred') return showStarred();
  if(section==='gear') return showGear();
  if(section==='challenges') return showChallenges();
  state.section=section;state.current=section;setHash(section);updateActiveNav();
  const list=Object.entries(entries).filter(([,e])=>e.section===section);
  const titles={learn:['Learn','Browse concepts and follow the links between them.'],gear:['Gear','Your cameras and capture systems, connected back to universal photographic ideas.'],field:['Field Guide','Start with the situation, then understand the choices.'],lab:['Lab','Short experiments that turn technical ideas into visible experience.'],challenges:['Challenges','Short prompts and longer projects that turn Photopedia into a reason to go make photographs.']};
  const [title,deck]=titles[section];setCrumbs([{label:title}]);
  if(section==='lab'){
    const groups=(DB.labGroups||[]).map(g=>[g,list.filter(([,x])=>x.category===g)]).filter(([,xs])=>xs.length);
    article.innerHTML=`<div class="eyebrow">Lab</div><h1>Lab</h1><p class="deck">Controlled experiments that turn technical ideas into things you can see, test and remember with your own cameras.</p><div class="lab-index-intro"><strong>Use Lab like a practical course.</strong><span>Each experiment tells you what to keep fixed, what to change, what to look for and what the result means.</span></div>${groups.map(([g,xs])=>`<section class="lab-index-group"><div class="eyebrow">${g}</div><h2>${g}</h2><div class="topic-list">${xs.map(([id])=>topicCard(id)).join('')}</div></section>`).join('')}`;
    context.innerHTML=`<div class="context-section"><div class="eyebrow">Practical course</div><h3>${list.length} experiments</h3><div class="context-note">Do not try to complete them in order. Pick the experiment that answers a question you actually have, then save your observation in the page note.</div></div>`;
  } else if(section==='field'){
    const groups=(DB.fieldGroups||[]).map(g=>[g,list.filter(([,x])=>x.category===g)]).filter(([,xs])=>xs.length);
    article.innerHTML=`<div class="eyebrow">Field Guide</div><h1>What do I do?</h1><p class="deck">Start with the situation you are actually standing in. Each guide gives you a fast starting point, explains the reasoning, flags common failure modes and links back to deeper Learn and Lab material.</p><div class="field-index-intro"><strong>Situational, not prescriptive.</strong><span>The settings are starting points. The useful part is understanding which variable matters most so you can adapt when the light, subject or intention changes.</span></div>${groups.map(([g,xs])=>`<section class="field-index-group"><div class="eyebrow">${g}</div><h2>${g}</h2><div class="field-index-grid">${xs.map(([id,x])=>`<div class="field-index-card" data-entry="${id}"><strong>${x.title}</strong><span>${x.deck}</span><em>Open guide →</em></div>`).join('')}</div></section>`).join('')}`;
    context.innerHTML=`<div class="context-section"><div class="eyebrow">Quick reference</div><h3>${list.length} situations</h3><div class="context-note">Use this section in the field when the question is “What matters here?” rather than “What does this setting mean?”</div></div><div class="context-section"><div class="eyebrow">Reading size</div><h3>Use the Aa selector above</h3><div class="context-note">Your chosen text size now applies to Field Guide prose, checklists, tips and quick-reference material and is remembered in this browser.</div></div>`;
  } else {
    article.innerHTML=`<div class="eyebrow">${title}</div><h1>${title}</h1><p class="deck">${deck}</p><div class="topic-list">${list.map(([id])=>topicCard(id)).join('')}</div>`;
    context.innerHTML=`<div class="context-section"><div class="eyebrow">Browse</div><h3>${list.length} entries</h3><div class="context-note">Search is global. Entries can appear through aliases such as “DOF,” “f-stop,” “noise,” or “camera shake.”</div></div>`;
  }
  wireDynamic();
}


function dayOfYear(d){const start=new Date(d.getFullYear(),0,0);return Math.floor((d-start)/86400000)}
function isoWeek(d){const t=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()));const day=t.getUTCDay()||7;t.setUTCDate(t.getUTCDate()+4-day);const y=new Date(Date.UTC(t.getUTCFullYear(),0,1));return Math.ceil((((t-y)/86400000)+1)/7)}
function challengeCard(id){const e=entries[id];return `<div class="challenge-card" data-entry="${id}"><div class="challenge-card-top"><span>${e.challengeTheme}</span><span>→</span></div><strong>${e.title}</strong><p>${e.deck}</p></div>`}
function showStarred(){
  state.section='starred';state.current='starred';setHash('starred');updateActiveNav();updateStarButton();
  setCrumbs([{label:'Starred'}]);
  const ids=getStars().filter(id=>entries[id]);
  const sectionOrder=['learn','gear','field','lab','challenges'];
  const groups=sectionOrder.map(sec=>[sec,ids.filter(id=>entries[id].section===sec)]).filter(([,xs])=>xs.length);
  article.innerHTML=`<div class="eyebrow">Working set</div><h1>Starred</h1><p class="deck">Keep the entries you are using right now in one easy-to-reach place.</p>${ids.length?groups.map(([sec,xs])=>`<section class="starred-group"><div class="eyebrow">${sectionLabel(sec)}</div><h2>${sectionLabel(sec)}</h2><div class="starred-grid">${xs.map(id=>{const e=entries[id];return `<div class="starred-card" data-entry="${id}"><div><strong>${e.title}</strong><span>${e.type} · ${e.category}</span></div><span class="starred-mark" aria-hidden="true">★</span></div>`}).join('')}</div></section>`).join(''):`<div class="brief"><h3>Nothing starred yet</h3><p>Open any Photopedia entry and click the star in the top bar. It will stay here until you remove it.</p></div>`}`;
  context.innerHTML=`<div class="context-section"><div class="eyebrow">Working set</div><h3>${ids.length} starred ${ids.length===1?'entry':'entries'}</h3><div class="context-note">Stars are cached locally for speed and synchronized to your Photopedia Dropbox folder.</div></div>`;
  wireDynamic();
}

function showChallenges(){
  state.section='challenges';state.current='challenges';setHash('challenges');updateActiveNav();setCrumbs([{label:'Challenges'}]);
  const daily=Object.entries(entries).filter(([,e])=>e.section==='challenges'&&e.challengeKind==='daily');
  const weekly=Object.entries(entries).filter(([,e])=>e.section==='challenges'&&e.challengeKind==='weekly');
  const now=new Date();
  const today=daily[(dayOfYear(now)-1)%daily.length];
  const week=weekly[(isoWeek(now)-1)%weekly.length];
  const themes=[...new Set(daily.map(([,e])=>e.challengeTheme))];
  article.innerHTML=`<div class="eyebrow">Challenges</div><h1>Go make photographs.</h1><p class="deck">Open-ended prompts for days when you want a reason to pick up a camera, plus longer weekly projects when you want to build a small body of work.</p>
  <div class="challenge-feature-grid"><div class="challenge-feature" data-entry="${today[0]}"><div class="eyebrow">Today's challenge</div><h2>${today[1].title}</h2><p>${today[1].deck}</p><span class="challenge-link">Open daily challenge →</span></div><div class="challenge-feature" data-entry="${week[0]}"><div class="eyebrow">This week's challenge</div><h2>${week[1].title}</h2><p>${week[1].deck}</p><span class="challenge-link">Open weekly challenge →</span></div></div>
  <div class="challenge-philosophy"><strong>Prompts, not assignments.</strong><span>You can interpret a challenge literally, conceptually or visually. The point is to make you notice, decide and photograph—not to produce the same image someone else would.</span></div>
  <section class="challenge-section"><div class="eyebrow">Daily</div><h2>Daily challenges</h2><p>Designed for roughly 10–30 minutes. Pick one whenever you want a compact constraint.</p><div class="challenge-grid">${daily.map(([id])=>challengeCard(id)).join('')}</div></section>
  <section class="challenge-section"><div class="eyebrow">Weekly</div><h2>Weekly challenges</h2><p>Longer projects intended to produce a coherent series, comparison or mini body of work.</p><div class="challenge-grid weekly">${weekly.map(([id])=>challengeCard(id)).join('')}</div></section>`;
  context.innerHTML=`<div class="context-section"><div class="eyebrow">Challenge library</div><h3>${daily.length} daily · ${weekly.length} weekly</h3><div class="context-note">The daily and weekly featured prompts rotate automatically. You do not need to start on January 1 or maintain a streak.</div></div><div class="context-section"><div class="eyebrow">Use any camera</div><h3>Constraint first</h3><div class="context-note">Unless a challenge explicitly names gear, use the X100VI, Ace Pro 2 or iPhone according to what makes the exercise useful.</div></div>`;
  wireDynamic();
}

function showGear(){
  state.section='gear';state.current='gear';setHash('gear');updateActiveNav();setCrumbs([{label:'Gear'}]);
  const devices=['x100vi','ace-pro-2','iphone-16-pro-max'];
  article.innerHTML=`<div class="eyebrow">Gear</div><h1>Visual manuals</h1><p class="deck">Browse each camera or app like a well-organized manual: start with the task, see the actual control or UI, learn what the setting does, then follow the link into the underlying photographic concept.</p>
  <div class="manual-groups"><section class="manual-group"><h2>Cameras & systems</h2><div class="device-grid">${devices.map(id=>{const e=entries[id];return `<div class="device-card" data-entry="${id}"><div class="eyebrow">${e.category}</div><h3>${e.title}</h3><p>${e.brief}</p></div>`}).join('')}</div></section>
  <section class="manual-group"><h2>iPhone capture & editing apps</h2><div class="device-grid">${['apple-camera','halide','vsco','snapseed'].map(id=>{const e=entries[id];return `<div class="device-card" data-entry="${id}"><div class="eyebrow">App manual</div><h3>${e.title.replace(' · Manual','').replace(' · Camera & Edit Manual','')}</h3><p>${e.brief}</p></div>`}).join('')}</div></section></div>`;
  context.innerHTML=`<div class="context-section"><div class="eyebrow">Manual philosophy</div><h3>Three questions</h3><div class="context-note"><strong>What is it?</strong><br><strong>How do I set/use it?</strong><br><strong>When would I want it?</strong><br><br>Operational pages link back into Learn when the photographic concept deserves a deeper explanation.</div></div>`;
  wireDynamic();
}

function showNotebook(){
  state.section='notebook';state.current='notebook';setHash('notebook');updateActiveNav();setCrumbs([{label:'Notebook'}]);
  const notes=getNotes(); const ids=Object.keys(notes).filter(id=>entries[id]&&notes[id].trim());
  article.innerHTML=`<div class="eyebrow">Personal layer</div><h1>Notebook</h1><p class="deck">Your observations stay attached to the concepts and gear that gave rise to them.</p>${ids.length?`<div class="topic-list">${ids.map(id=>`<div class="topic-row" data-entry="${id}"><strong>${entries[id].title}</strong><span>${esc(notes[id].slice(0,110))}${notes[id].length>110?'…':''}</span></div>`).join('')}</div>`:`<div class="brief"><h3>No notes yet</h3><p>Open any entry and choose <strong>Add my note</strong>. Notes are cached locally for speed and synchronized with your private Dropbox library.</p></div>`}`;
  context.innerHTML=`<div class="context-section"><div class="eyebrow">Dropbox</div><h3>Synced personal layer</h3><div class="context-note">Notes, stars and reading preferences are ordinary data in your private Photopedia Dropbox library and are cached locally for speed.</div></div>`;
  wireDynamic();
}

function showEntry(id){
  const e=entries[id];if(!e)return showHome();
  state.current=id;state.section=e.section;setHash(id);updateActiveNav();
  const crumbParts=[{label:sectionLabel(e.section),section:e.section}];
  if(e.parent && entries[e.parent]) crumbParts.push({label:entries[e.parent].title,entry:e.parent});
  crumbParts.push({label:e.title});
  setCrumbs(crumbParts);
  article.innerHTML=`<div class="eyebrow">${e.type} · ${e.category}</div><h1>${e.title}</h1><p class="deck">${e.deck}</p><div class="brief"><h3>In brief</h3><p>${e.brief}</p></div>${e.body}${e.lab?`<hr><p><strong>Try it:</strong> <a class="article-link" data-entry="${e.lab}">${entries[e.lab].title}</a></p>`:''}`;
  const note=noteFor(id);
  context.innerHTML=`${e.parent?`<div class="context-section"><div class="eyebrow">Manual</div><h3>Back to device</h3><div class="context-link" data-entry="${e.parent}">${entries[e.parent].title}</div></div>`:''}${e.gear?.length?`<div class="context-section"><div class="eyebrow">On your gear</div><h3>Connected systems</h3>${e.gear.map(g=>`<div class="context-link" data-entry="${g}">${entries[g].title}</div>`).join('')}</div>`:''}
  ${e.related?.length?`<div class="context-section"><div class="eyebrow">Continue exploring</div><h3>Related</h3>${e.related.map(r=>`<div class="context-link" data-entry="${r}">${entries[r].title}</div>`).join('')}</div>`:''}
  <div class="context-section"><div class="eyebrow">My note</div><h3>${note?'Saved note':'Add an observation'}</h3>${note?`<div class="context-note">${esc(note)}</div><br>`:'<div class="context-note">Attach a personal discovery or preferred setting to this entry.</div><br>'}<button class="btn small" id="addNote">${note?'Edit my note':'Add my note'}</button></div>`;
  wireDynamic();
  $('#addNote')?.addEventListener('click',()=>openNote(id));
  updateStarButton();
  window.scrollTo({top:0,behavior:'instant'});
}
function sectionLabel(s){return ({learn:'Learn',gear:'Gear',field:'Field Guide',lab:'Lab',challenges:'Challenges',notebook:'Notebook',starred:'Starred'})[s]||s}

function openNote(id){
  noteDialog.dataset.entry=id;noteTitle.textContent=entries[id].title;noteText.value=noteFor(id);noteDialog.showModal();setTimeout(()=>noteText.focus(),20)
}
$('#saveNoteBtn').addEventListener('click',e=>{
  e.preventDefault();const id=noteDialog.dataset.entry;const n=getNotes();const v=noteText.value.trim();if(v)n[id]=v;else delete n[id];setNotes(n);noteDialog.close();buildNav();showEntry(id)
});

function wireDynamic(){
  document.querySelectorAll('[data-entry]').forEach(el=>el.onclick=()=>{showEntry(el.dataset.entry);closeMobileSidebar();});
  document.querySelectorAll('[data-go]').forEach(el=>el.onclick=()=>{showSection(el.dataset.go);closeMobileSidebar();});
  document.querySelectorAll('[data-go-entry]').forEach(el=>el.onclick=()=>{showEntry(el.dataset.goEntry);closeMobileSidebar();});
  document.querySelectorAll('[data-section-jump]').forEach(el=>el.onclick=()=>{showSection(el.dataset.sectionJump);closeMobileSidebar();});
  window.PhotopediaDropbox?.hydrateImages(document);
  document.querySelectorAll('img.zoomable').forEach(img=>{
    img.onclick=()=>{
      if(!imageDialog) return;
      imageDialogImg.src=img.src;
      imageDialogImg.alt=img.alt||'';
      const holder=img.closest('figure,.photo-example');
      const cap=holder?.querySelector('figcaption,.photo-caption');
      imageDialogCaption.innerHTML=cap?cap.innerHTML:'';
      imageDialog.showModal();
    };
  });
  updateBackButton();
}

function doSearch(q){
  q=q.trim().toLowerCase();if(!q){searchResults.classList.add('hidden');return}
  const scored=Object.entries(entries).map(([id,e])=>{
    const title=e.title.toLowerCase(), aliases=(e.aliases||[]).join(' ').toLowerCase(), body=(e.deck+' '+e.brief).toLowerCase();
    let score=0;if(title===q)score+=100;if(title.includes(q))score+=50;if(aliases.includes(q))score+=35;if(body.includes(q))score+=10;
    return [id,e,score];
  }).filter(x=>x[2]>0).sort((a,b)=>b[2]-a[2]).slice(0,8);
  searchResults.innerHTML=scored.length?scored.map(([id,e])=>`<div class="search-item" data-search-entry="${id}"><strong>${e.title}</strong><span>${e.type} · ${e.category}</span></div>`).join(''):`<div class="search-item"><span>No matching entry yet.</span></div>`;
  searchResults.classList.remove('hidden');
  searchResults.querySelectorAll('[data-search-entry]').forEach(el=>el.onclick=()=>{showEntry(el.dataset.searchEntry);searchResults.classList.add('hidden');searchInput.value='';closeMobileSidebar()});
}
searchInput.addEventListener('input',e=>doSearch(e.target.value));
searchInput.addEventListener('keydown',e=>{if(e.key==='Escape'){searchInput.value='';searchResults.classList.add('hidden')}});
$('#focusSearch').onclick=()=>{if(innerWidth<781)sidebar.classList.add('open');setTimeout(()=>searchInput.focus(),30)};
$('#openSidebar').onclick=()=>sidebar.classList.add('open');
$('#closeSidebar').onclick=closeMobileSidebar;
document.addEventListener('click',e=>{if(innerWidth<781&&sidebar.classList.contains('open')&&!sidebar.contains(e.target)&&e.target.id!=='openSidebar')sidebar.classList.remove('open')});


const fontSizeSelect = $('#fontSizeSelect');
const mobileFontSizeSelect = $('#mobileFontSizeSelect');
const fontSizes = {small:'15px',default:'16.5px',large:'18px',xlarge:'20px'};
function applyFontSize(size, save=true){
  const safe=fontSizes[size]?size:'default';
  document.documentElement.style.setProperty('--article-font-size',fontSizes[safe]);
  if(fontSizeSelect) fontSizeSelect.value=safe;
  if(mobileFontSizeSelect) mobileFontSizeSelect.value=safe;
  localStorage.setItem('photopedia-font-size',safe);
  if(save) window.PhotopediaDropbox?.savePersonal('preferences.json',{fontSize:safe});
}
applyFontSize(localStorage.getItem('photopedia-font-size')||'default', false);
fontSizeSelect?.addEventListener('change',e=>applyFontSize(e.target.value));
mobileFontSizeSelect?.addEventListener('change',e=>applyFontSize(e.target.value));

if(backBtn) backBtn.addEventListener('click',goBack);
window.addEventListener('popstate',renderFromLocation);
window.addEventListener('hashchange',()=>{if(!renderingHistory)renderFromLocation()});
if($('#imageClose')) $('#imageClose').addEventListener('click',()=>imageDialog.close());
if(imageDialog) imageDialog.addEventListener('click',e=>{if(e.target===imageDialog) imageDialog.close()});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&imageDialog?.open) imageDialog.close()});

if(starBtn) starBtn.addEventListener('click',()=>toggleStar(state.current));

buildNav();
const firstId=(location.hash||'#home').slice(1);
try{history.replaceState({photopedia:true,id:firstId,photopediaDepth:0},'',location.href)}catch{}
renderFromLocation();
// During active development Photopedia uses its local library cache but not
// a service-worker shell cache. Retire any older worker so GitHub deployments
// cannot leave the UI on a stale V1.0.x shell.
if('serviceWorker' in navigator){
  navigator.serviceWorker.getRegistrations().then(regs=>regs.forEach(r=>r.unregister())).catch(()=>{});
}
if('caches' in window){
  caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('photopedia-')).map(k=>caches.delete(k)))).catch(()=>{});
}

};
