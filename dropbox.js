(() => {
  const cfg = window.PHOTOPEDIA_CONFIG || {};
  const APP_KEY = (cfg.dropboxAppKey || '').trim();
  const REDIRECT_URI = cfg.redirectUri || `${location.origin}${location.pathname}`;
  const AUTH_KEY = 'photopedia-dropbox-auth-v1';
  const VERIFIER_KEY = 'photopedia-dropbox-pkce-verifier';
  const STATE_KEY = 'photopedia-dropbox-oauth-state';
  const TRANSPARENT_PIXEL = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
  const assetCache = new Map();
  let saveTimers = new Map();
  let currentAuth = null;

  const gate = document.getElementById('authGate');
  const appShell = document.getElementById('appShell');
  const authMessage = document.getElementById('authMessage');
  const authSetup = document.getElementById('authSetup');
  const signInBtn = document.getElementById('dropboxSignIn');

  function safeJSON(raw, fallback) {
    try { return JSON.parse(raw); } catch { return fallback; }
  }
  function setMessage(text, kind='') {
    if (!authMessage) return;
    authMessage.textContent = text;
    authMessage.dataset.kind = kind;
  }
  function setSync(text, state='ok') {
    const t=document.getElementById('syncText');
    const d=document.getElementById('syncDot');
    if(t) t.textContent=text;
    if(d) d.dataset.state=state;
  }
  function savedAuth() { return safeJSON(localStorage.getItem(AUTH_KEY) || 'null', null); }
  function persistAuth(auth) { currentAuth=auth; localStorage.setItem(AUTH_KEY, JSON.stringify(auth)); }
  function clearAuth() { currentAuth=null; localStorage.removeItem(AUTH_KEY); sessionStorage.removeItem(VERIFIER_KEY); sessionStorage.removeItem(STATE_KEY); }

  function randomState() {
    const bytes = new Uint8Array(20);
    crypto.getRandomValues(bytes);
    return [...bytes].map(b=>b.toString(16).padStart(2,'0')).join('');
  }

  async function beginAuth() {
    if (!APP_KEY) return showMissingKey();
    setMessage('Opening Dropbox…');
    const auth = new Dropbox.DropboxAuth({ clientId: APP_KEY });
    const state = randomState();
    const url = await auth.getAuthenticationUrl(
      REDIRECT_URI,
      state,
      'code',
      'offline',
      ['files.content.read','files.content.write'],
      undefined,
      true
    );
    sessionStorage.setItem(VERIFIER_KEY, auth.codeVerifier || auth.getCodeVerifier?.() || '');
    sessionStorage.setItem(STATE_KEY, state);
    location.href = url;
  }

  async function handleCallback() {
    const params = new URLSearchParams(location.search);
    const code = params.get('code');
    if (!code) return false;
    if (!APP_KEY) { showMissingKey(); return true; }
    const returnedState=params.get('state');
    const expectedState=sessionStorage.getItem(STATE_KEY);
    if (expectedState && returnedState !== expectedState) throw new Error('Dropbox sign-in state did not match. Please try again.');
    const verifier=sessionStorage.getItem(VERIFIER_KEY);
    if(!verifier) throw new Error('Dropbox sign-in could not find the PKCE verifier. Please start sign-in again.');
    setMessage('Finishing Dropbox sign-in…');
    const auth = new Dropbox.DropboxAuth({ clientId: APP_KEY });
    auth.setCodeVerifier(verifier);
    const response = await auth.getAccessTokenFromCode(REDIRECT_URI, code);
    const r=response.result || response;
    const authData={
      accessToken:r.access_token,
      refreshToken:r.refresh_token || null,
      expiresAt:Date.now()+((r.expires_in || 14400)*1000)-60000,
      accountId:r.account_id || null
    };
    persistAuth(authData);
    sessionStorage.removeItem(VERIFIER_KEY);
    sessionStorage.removeItem(STATE_KEY);
    history.replaceState({},'',REDIRECT_URI + (location.hash || ''));
    return true;
  }

  async function refreshIfNeeded() {
    currentAuth=currentAuth || savedAuth();
    if(!currentAuth?.accessToken) throw new Error('Not signed in to Dropbox.');
    if(!currentAuth.expiresAt || Date.now() < currentAuth.expiresAt) return currentAuth.accessToken;
    if(!currentAuth.refreshToken) { clearAuth(); throw new Error('Dropbox session expired. Please sign in again.'); }
    const body=new URLSearchParams({grant_type:'refresh_token',refresh_token:currentAuth.refreshToken,client_id:APP_KEY});
    const res=await fetch('https://api.dropboxapi.com/oauth2/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body});
    if(!res.ok) { clearAuth(); throw new Error('Dropbox session could not be refreshed. Please sign in again.'); }
    const r=await res.json();
    currentAuth={...currentAuth,accessToken:r.access_token,expiresAt:Date.now()+((r.expires_in || 14400)*1000)-60000};
    persistAuth(currentAuth);
    return currentAuth.accessToken;
  }

  async function dbxDownload(path) {
    const token=await refreshIfNeeded();
    const res=await fetch('https://content.dropboxapi.com/2/files/download',{
      method:'POST',
      headers:{Authorization:`Bearer ${token}`,'Dropbox-API-Arg':JSON.stringify({path})}
    });
    if(!res.ok) {
      const text=await res.text();
      const err=new Error(`Dropbox download failed (${res.status})`);
      err.status=res.status; err.detail=text; throw err;
    }
    return res.blob();
  }

  async function dbxText(path) { return (await dbxDownload(path)).text(); }

  async function dbxUpload(path, contents) {
    const token=await refreshIfNeeded();
    const body=contents instanceof Blob ? contents : new Blob([contents],{type:'application/octet-stream'});
    const res=await fetch('https://content.dropboxapi.com/2/files/upload',{
      method:'POST',
      headers:{Authorization:`Bearer ${token}`,'Dropbox-API-Arg':JSON.stringify({path,mode:'overwrite',autorename:false,mute:true}),'Content-Type':'application/octet-stream'},
      body
    });
    if(!res.ok) {
      const text=await res.text();
      const err=new Error(`Dropbox upload failed (${res.status})`); err.detail=text; throw err;
    }
    return res.json();
  }

  async function readJSON(path, fallback) {
    try { return safeJSON(await dbxText(path), fallback); }
    catch(e) {
      if(e.status===409) return fallback;
      throw e;
    }
  }

  async function saveJSON(path, value) { return dbxUpload(path, JSON.stringify(value,null,2)+'\n'); }

  function remoteTeachingImages(content) {
    const found = new Map();
    const entries = content?.entries || {};
    const re = /<img[^>]+src=(["'])(https:\/\/(?:upload\.wikimedia\.org|commons\.wikimedia\.org\/wiki\/Special:Redirect\/file\/)[^"']+)\1/gi;
    Object.values(entries).forEach(entry => {
      if (typeof entry.body !== 'string') return;
      let m;
      while ((m = re.exec(entry.body))) found.set(m[2], true);
    });
    return [...found.keys()];
  }

  function commonsFilename(url, index=0) {
    let raw = url.split('/file/').pop();
    if (raw === url) raw = url.split('/').pop();
    raw = (raw || `image-${index+1}.jpg`).split('?')[0];
    try { raw = decodeURIComponent(raw); } catch {}
    const dot = raw.lastIndexOf('.');
    let ext = dot > 0 ? raw.slice(dot).toLowerCase() : '.jpg';
    if (!/^\.(?:jpe?g|png|gif|webp|svg)$/i.test(ext)) ext = '.jpg';
    let stem = dot > 0 ? raw.slice(0,dot) : raw;
    stem = stem.normalize('NFKD').replace(/[\u0300-\u036f]/g,'')
      .replace(/[^a-zA-Z0-9]+/g,'-').replace(/^-+|-+$/g,'').toLowerCase();
    if (!stem) stem = `image-${index+1}`;
    if (stem.length > 92) stem = stem.slice(0,92).replace(/-+$/,'');
    return `commons-${stem}${ext}`;
  }

  async function localizeTeachingImages(content) {
    const urls = remoteTeachingImages(content);
    if (!urls.length) return { changed:false, count:0 };
    setSync(`Localizing ${urls.length} reference image${urls.length===1?'':'s'}…`,'busy');
    const replacements = new Map();
    const failures = [];
    for (let i=0; i<urls.length; i++) {
      const url = urls[i];
      try {
        setSync(`Saving reference image ${i+1} of ${urls.length}…`,'busy');
        const res = await fetch(url, { mode:'cors', credentials:'omit' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        if (!blob.size) throw new Error('empty image');
        const filename = commonsFilename(res.url || url, i);
        const dropboxPath = `/assets/commons/${filename}`;
        await dbxUpload(dropboxPath, blob);
        replacements.set(url, `assets/commons/${filename}`);
      } catch (e) {
        console.warn('Could not localize image', url, e);
        failures.push({url,error:e?.message || String(e)});
      }
    }
    if (!replacements.size) {
      setSync('Dropbox synced; external images unchanged','error');
      return { changed:false, count:0, failures };
    }
    Object.values(content.entries || {}).forEach(entry => {
      if (typeof entry.body !== 'string') return;
      for (const [from,to] of replacements) entry.body = entry.body.split(from).join(to);
    });
    await saveJSON('/content/content.json', content);
    await saveJSON('/personal/image-localization.json', {
      completedAt:new Date().toISOString(),
      localized:[...replacements.entries()].map(([source,asset])=>({source,asset})),
      failures
    });
    setSync(`${replacements.size} reference images saved to Dropbox`,'ok');
    return { changed:true, count:replacements.size, failures };
  }

  function privatizeLocalAssets(content) {
    const entries=content?.entries || {};
    Object.values(entries).forEach(entry=>{
      if(typeof entry.body !== 'string') return;
      entry.body=entry.body.replace(/src=(['"])assets\/([^'\"]+)\1/g,(m,q,file)=>`src=${q}${TRANSPARENT_PIXEL}${q} data-dropbox-src=${q}assets/${file}${q}`);
    });
    return content;
  }

  async function hydrateImages(root=document) {
    const imgs=[...root.querySelectorAll('img[data-dropbox-src]')];
    for(const img of imgs) {
      const rel=img.dataset.dropboxSrc;
      if(!rel || img.dataset.dropboxLoaded==='1') continue;
      img.dataset.dropboxLoaded='loading';
      try {
        let url=assetCache.get(rel);
        if(!url) {
          const blob=await dbxDownload('/'+rel.replace(/^\//,''));
          url=URL.createObjectURL(blob); assetCache.set(rel,url);
        }
        img.src=url; img.dataset.dropboxLoaded='1';
      } catch(e) {
        img.dataset.dropboxLoaded='error';
        img.alt=(img.alt ? img.alt+' — ' : '')+'image unavailable from Dropbox';
      }
    }
  }

  function savePersonal(filename, value) {
    clearTimeout(saveTimers.get(filename));
    setSync('Saving to Dropbox…','busy');
    saveTimers.set(filename,setTimeout(async()=>{
      try { await saveJSON('/personal/'+filename,value); setSync('Dropbox synced','ok'); }
      catch(e) { console.error(e); setSync('Dropbox sync failed','error'); }
    },350));
  }

  async function loadPersonal() {
    const [notes,stars,prefs]=await Promise.all([
      readJSON('/personal/notes.json',{}),
      readJSON('/personal/starred.json',[]),
      readJSON('/personal/preferences.json',{fontSize:'default'})
    ]);
    localStorage.setItem('photopedia-notes',JSON.stringify(notes||{}));
    localStorage.setItem('photopedia-starred',JSON.stringify(Array.isArray(stars)?stars:[]));
    if(prefs?.fontSize) localStorage.setItem('photopedia-font-size',prefs.fontSize);
    // A harmless write verifies that content.write is working.
    await saveJSON('/personal/photopedia.json',{libraryVersion:'1.0',lastConnected:new Date().toISOString()});
  }

  async function loadLibrary() {
    setMessage('Loading your private Photopedia library…');
    setSync('Loading Dropbox…','busy');
    const text=await dbxText('/content/content.json');
    const content=safeJSON(text,null);
    if(!content?.entries) throw new Error('The Dropbox library file is present but is not valid Photopedia content.');
    const externalCount=remoteTeachingImages(content).length;
    window.PHOTOPEDIA_CONTENT=privatizeLocalAssets(content);
    await loadPersonal();
    window.PhotopediaDropbox={ hydrateImages, savePersonal, signOut, localizeTeachingImages };
    gate?.classList.add('hidden');
    appShell?.classList.remove('hidden');
    setSync('Dropbox synced','ok');
    window.startPhotopedia();
    if (externalCount) {
      // One-time background migration: copy remote Wikimedia teaching images into
      // the private Dropbox library, rewrite content.json, then reload once.
      setTimeout(async()=>{
        try {
          const result=await localizeTeachingImages(content);
          if (result.changed) {
            localStorage.setItem('photopedia-localized-images-v1',String(Date.now()));
            setTimeout(()=>location.reload(),800);
          }
        } catch(e) {
          console.error('Image localization failed',e);
          setSync('Dropbox synced; image import incomplete','error');
        }
      },700);
    }
  }

  function showMissingKey() {
    setMessage('Dropbox setup is not finished yet.');
    signInBtn?.classList.add('hidden');
    if(authSetup) {
      authSetup.classList.remove('hidden');
      authSetup.innerHTML='<strong>One setup value is needed.</strong><p>Create the Photopedia Dropbox API app, then paste its <b>App key</b> into <code>config.js</code> in the GitHub repository. The app key is a public client identifier, not a secret.</p>';
    }
  }

  function showLibraryMissing() {
    setMessage('Dropbox is connected, but the Photopedia library has not been copied into the app folder yet.');
    if(authSetup) {
      authSetup.classList.remove('hidden');
      authSetup.innerHTML='<strong>Dropbox connection works.</strong><p>Copy the supplied <code>content</code>, <code>assets</code>, and <code>personal</code> folders into the Dropbox app folder for Photopedia, then reload this page.</p>';
    }
  }

  function signOut() {
    clearAuth();
    location.href=REDIRECT_URI;
  }

  async function boot() {
    if(signInBtn) signInBtn.addEventListener('click',()=>beginAuth().catch(e=>setMessage(e.message,'error')));
    document.getElementById('dropboxSignOut')?.addEventListener('click',signOut);
    if(!APP_KEY) { showMissingKey(); return; }
    try { await handleCallback(); }
    catch(e) { console.error(e); clearAuth(); setMessage(e.message,'error'); return; }
    currentAuth=savedAuth();
    if(!currentAuth?.accessToken) { setMessage('Connect Dropbox to load your private Photopedia library.'); return; }
    try { await loadLibrary(); }
    catch(e) {
      console.error(e);
      if(e.status===409 || /download failed \(409\)/.test(e.message)) showLibraryMissing();
      else setMessage(e.message || 'Could not load the Dropbox library.','error');
    }
  }

  boot();
})();
