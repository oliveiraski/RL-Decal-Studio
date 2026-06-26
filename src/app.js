const RC = {
  "Black Market": { c:"#c084fc", bg:"rgba(192,132,252,.12)", pct:"100%" },
  "Import":       { c:"#f87171", bg:"rgba(248,113,113,.10)", pct:"80%"  },
  "Very Rare":    { c:"#67e8f9", bg:"rgba(103,232,249,.10)", pct:"55%"  },
  "Rare":         { c:"#93c5fd", bg:"rgba(147,197,253,.08)", pct:"40%"  },
  "Common":       { c:"#94a3b8", bg:"rgba(148,163,184,.06)", pct:"12%"  },
};

const BOOST_TINT = {
  "alphaboost":        null,
  "alphaboost_black":  "#111111",
  "alphaboost_purple": "#9333ea",
  "alphaboost_red":    "#dc2626",
  "alphaboost_white":  "#e2e8f0",
};

const CAT_ICON = {
  "All":"🎮","Boosts":"⚡","Decals":"🎨","Goal Explosions":"💥","Wheels":"🛞","Antennas":"📡"
};

// ── Slot system ───────────────────────────────────────────────────────────────
// Each item belongs to a "slot" — only one item per slot can be active at a time.
// Items sharing the same target file compete for the same slot.
// slot key = category + ":" + target filename
function slotOf(item){
  // Fennec decals and Octane decals are separate slots even though cat is "Decals"
  if(item.cat === "Decals"){
    if(item.car === "Fennec") return "Decals:Fennec:" + item.target;
    if(item.car === "Octane") return "Decals:Octane:" + item.target;
    return "Decals:" + item.target;
  }
  return item.cat + ":" + item.target;
}

// ── Persistence via localStorage ──────────────────────────────────────────────
const SAVE_KEY = "rl_decal_studio_v1";

function saveState(){
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ inventory, rlPath }));
  } catch(e){}
}

function loadState(){
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if(!raw) return;
    const data = JSON.parse(raw);
    if(Array.isArray(data.inventory)) inventory = data.inventory;
    if(data.rlPath) rlPath = data.rlPath;
  } catch(e){}
}

const isElectron = typeof window.rlAPI !== "undefined";
let rlPath=null, tab="shop", cat="All", selId=1, inventory=[];

// ── Path ──────────────────────────────────────────────────────────────────────
async function initPath(){
  loadState(); // load saved inventory + path first
  updatePill();

  if(!isElectron){ setPathUI(null,"browser"); render(); renderDetail(); renderHL(); return; }

  // If we have a saved path, verify it still exists, otherwise detect
  const savedPath = rlPath;
  const detected = await window.rlAPI.detectRLPath();
  rlPath = detected || savedPath || null;
  setPathUI(rlPath, "done");
  saveState();
  render(); renderDetail(); renderHL();
}

function setPathUI(p,state){
  const dot=document.getElementById("path-dot"), txt=document.getElementById("path-txt");
  dot.className="path-dot";
  if(state==="browser"){ dot.classList.add("found");    txt.textContent="Modo preview"; }
  else if(p){            dot.classList.add("found");    txt.textContent=p; }
  else{                  dot.classList.add("notfound"); txt.textContent="RL não encontrado — clique para localizar"; }
}

async function browseForPath(){
  if(!isElectron) return;
  const p = await window.rlAPI.browseRLPath();
  if(p){ rlPath=p; setPathUI(p,"done"); saveState(); renderDetail(); showNotif("📁 Pasta definida!","#10b981"); }
}

function W(a){
  if(!isElectron) return;
  if(a==="minimize") window.rlAPI.minimize();
  if(a==="maximize") window.rlAPI.maximize();
  if(a==="close")    window.rlAPI.close();
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function rc(r){ return RC[r]||RC.Common; }
function tintFor(imgKey){ return BOOST_TINT[imgKey] || null; }

function imgEl(imgKey, size){
  const src = IMGS[imgKey];
  const tint = tintFor(imgKey);
  const tintDiv = tint ? `<div class="tint" style="background:${tint}"></div>` : "";
  if(src){
    return `<img src="${src}" style="max-width:${size}px;max-height:${size}px;object-fit:contain"
      onerror="this.style.opacity='.2'" loading="lazy">${tintDiv}`;
  }
  return `<span style="font-size:${Math.round(size*.45)}px">📦</span>${tintDiv}`;
}

// Returns the currently active item id for the same slot, or null
function activeInSlot(item){
  const slot = slotOf(item);
  const activeId = inventory.find(id => {
    const other = CATALOG.find(i=>i.id===id);
    return other && slotOf(other) === slot;
  });
  return activeId != null ? activeId : null;
}

function getFiltered(){
  const q=document.getElementById("srch-inp").value.toLowerCase();
  return CATALOG.filter(i=>{
    if(cat!=="All" && i.cat!==cat) return false;
    if(q && !i.name.toLowerCase().includes(q)) return false;
    if(tab==="inventory") return inventory.includes(i.id);
    return true;
  });
}

// ── Grid ──────────────────────────────────────────────────────────────────────
function render(){
  const items=getFiltered();
  document.getElementById("t-meta").textContent=`${items.length} item${items.length!==1?"s":""}`;
  const lblMap={All:"Todos os Itens",Boosts:"Boosts",Decals:"Decals",
    "Goal Explosions":"Goal Explosions",Wheels:"Wheels",Antennas:"Antennas"};
  document.getElementById("sec-title").textContent=
    tab==="inventory"?"Mods Ativos":(lblMap[cat]||cat);

  const grid=document.getElementById("grid");
  if(!items.length){
    grid.innerHTML=`<div class="empty">
      <div class="empty-ico">${tab==="inventory"?"📦":"🔍"}</div>
      <div>${tab==="inventory"?"Nenhum mod ativo ainda.":"Nenhum item encontrado."}</div>
    </div>`; return;
  }
  grid.innerHTML=items.map(i=>{
    const r=rc(i.rar), owned=inventory.includes(i.id), sel=i.id===selId;
    return `<div class="card${sel?" on":""}" onclick="select(${i.id})">
      ${owned?`<div class="owned-stamp">✓ ATIVO</div>`:""}
      <div class="card-thumb" style="background:${r.bg};border:1px solid ${r.c}22">
        ${imgEl(i.img,66)}
      </div>
      <div class="card-name">${i.name}</div>
      <div class="card-cat">${CAT_ICON[i.cat]||""} ${i.cat}</div>
    </div>`;
  }).join("");
}

// ── Detail ────────────────────────────────────────────────────────────────────
function renderDetail(){
  const item=CATALOG.find(i=>i.id===selId);
  const panel=document.getElementById("detail");
  if(!item){ panel.innerHTML=""; return; }
  const r=rc(item.rar), owned=inventory.includes(item.id);
  const noPath=isElectron&&!rlPath;
  const tint=tintFor(item.img);
  const tintDiv=tint?`<div class="tint" style="background:${tint}"></div>`:"";

  // Check if another item occupies the same slot
  const conflictId = !owned ? activeInSlot(item) : null;
  const conflictItem = conflictId ? CATALOG.find(i=>i.id===conflictId) : null;

  panel.innerHTML=`
    <div class="det-hero">
      <div class="det-glow" style="background:radial-gradient(ellipse 90% 80% at 50% -10%,${r.c}22,transparent 65%)"></div>
      <div class="det-ring" style="background:${r.bg};border:2px solid ${r.c}40;box-shadow:0 0 28px ${r.c}20">
        ${IMGS[item.img]
          ?`<img src="${IMGS[item.img]}" style="max-width:92px;max-height:92px;object-fit:contain;position:relative;z-index:1">${tintDiv}`
          :`<span style="font-size:38px">📦</span>`}
      </div>
      <div class="det-name">${item.name}</div>
      <div class="det-sub">
        <span class="det-rar" style="color:${r.c};border-color:${r.c}50">${item.rar}</span>
        <span class="det-car">🚗 ${item.car}</span>
      </div>
    </div>
    <div class="det-body">
      <div class="det-desc">${item.desc}</div>
      <div class="rar-row">
        <div class="rar-lbl">Raridade</div>
        <div class="rar-track">
          <div class="rar-fill" style="width:${r.pct};background:linear-gradient(90deg,${r.c}99,${r.c});box-shadow:0 0 8px ${r.c}60"></div>
        </div>
      </div>
      <div class="info-block">
        <div class="info-row"><span class="info-lbl">Pasta</span><span class="info-val">mods/${item.folder}</span></div>
        <div class="info-row"><span class="info-lbl">Arquivo</span><span class="info-val">${item.upk}</span></div>
        <div class="info-row"><span class="info-lbl">Substitui</span><span class="info-val">${item.target}</span></div>
      </div>
      ${owned ? `<div class="owned-box">✓ Mod aplicado no Rocket League</div>` : ""}
      ${conflictItem ? `<div class="no-path-box" style="color:#f87171;border-color:rgba(248,113,113,.3);background:rgba(248,113,113,.06)">
        ⚠️ <strong>${conflictItem.name}</strong> já está ativo neste slot.<br>
        Aplicar este mod vai substituí-lo automaticamente.
      </div>` : ""}
      ${noPath&&!owned?`<div class="no-path-box">⚠️ Pasta do RL não detectada.
        <button onclick="browseForPath()">📁 Localizar manualmente</button></div>`:""}
    </div>
    <div class="det-footer">
      ${owned
        ?`<button class="apply-btn done">✓ Mod Ativo</button>
          <button class="restore-btn" onclick="restoreMod(${item.id})">↩ Restaurar Original</button>`
        :`<button class="apply-btn" onclick="applyMod(${item.id})">
            🚀 ${conflictItem ? "Substituir Mod" : "Aplicar Mod"}
          </button>`}
      <div class="footer-path">📁 ${rlPath||(isElectron?"Pasta não detectada":"Modo preview")}</div>
    </div>`;
}

// ── Highlights ticker ─────────────────────────────────────────────────────────
function renderHL(){
  const bar=document.getElementById("hl-bar");
  if(tab!=="shop"){ bar.style.display="none"; return; }
  bar.style.display="block";
  const priority=["Black Market","Import","Very Rare"];
  const sorted=[...CATALOG].sort((a,b)=>priority.indexOf(a.rar)-priority.indexOf(b.rar));
  const cardHTML=sorted.map(i=>{
    const r=rc(i.rar);
    const tint=tintFor(i.img);
    const tintDiv=tint?`<div class="tint" style="background:${tint}"></div>`:"";
    return `<div class="hl-card" onclick="select(${i.id})" style="border-color:${r.c}22">
      <div class="hl-thumb">
        ${IMGS[i.img]?`<img src="${IMGS[i.img]}" style="max-width:36px;max-height:36px;object-fit:contain;position:relative;z-index:1">${tintDiv}`:`<span style="font-size:20px">📦</span>`}
      </div>
      <div class="hl-name">${i.name}</div>
      <div class="hl-rar" style="color:${r.c}">${i.rar}</div>
    </div>`;
  }).join("");
  document.getElementById("hl-ticker").innerHTML = cardHTML + cardHTML;
}

// ── Actions ───────────────────────────────────────────────────────────────────
function select(id){ selId=id; render(); renderDetail(); }

async function applyMod(id){
  const item=CATALOG.find(i=>i.id===id);
  if(!item) return;

  // Remove any conflicting item in the same slot first
  const conflictId = activeInSlot(item);
  if(conflictId != null){
    inventory = inventory.filter(i=>i!==conflictId);
    // In Electron, the file copy will overwrite anyway — no need to restore backup
  }

  if(!isElectron){
    inventory.push(id); updatePill(); saveState();
    showNotif(`✅ ${item.name} aplicado! (demo)`,"#10b981");
    render(); renderDetail(); return;
  }
  if(!rlPath){ showNotif("⚠️ Pasta do RL não encontrada.","#f59e0b"); return; }

  const btn=document.querySelector(".apply-btn");
  if(btn){ btn.disabled=true; btn.textContent="⏳ Aplicando..."; }

  const result=await window.rlAPI.applyMod({
    modFile:item.upk, targetFile:item.target, rlPath, folder:item.folder
  });
  if(result.ok){
    inventory.push(id); updatePill(); saveState();
    showNotif(`✅ ${item.name} aplicado!`,"#10b981");
  } else {
    showNotif(`❌ Erro: ${result.error}`,"#ef4444");
  }
  render(); renderDetail();
}

async function restoreMod(id){
  const item=CATALOG.find(i=>i.id===id);
  if(!item) return;
  if(!isElectron){
    inventory=inventory.filter(i=>i!==id); updatePill(); saveState();
    showNotif(`↩ ${item.name} restaurado (demo)`,"#f59e0b");
    render(); renderDetail(); return;
  }
  const result=await window.rlAPI.restoreMod({ targetFile:item.target, rlPath });
  if(result.ok){
    inventory=inventory.filter(i=>i!==id); updatePill(); saveState();
    showNotif(`↩ ${item.name} restaurado!`,"#f59e0b");
  } else {
    showNotif(`❌ ${result.error}`,"#ef4444");
  }
  render(); renderDetail();
}

function updatePill(){
  const p=document.getElementById("inv-pill");
  p.textContent=inventory.length; p.style.display=inventory.length?"inline":"none";
}

function showNotif(msg,color){
  const n=document.getElementById("notif");
  n.textContent=msg;
  n.style.cssText=`background:${color}15;border:1px solid ${color}40;display:block;`+
    `position:fixed;top:92px;right:18px;z-index:9999;padding:11px 18px;border-radius:11px;`+
    `font-size:12px;font-weight:600;color:#fff;pointer-events:none;backdrop-filter:blur(14px);`+
    `box-shadow:0 8px 32px rgba(0,0,0,.5);`;
  clearTimeout(window._nt); window._nt=setTimeout(()=>{ n.style.display="none"; },3000);
}

function switchTab(t){
  tab=t;
  document.getElementById("btn-shop").classList.toggle("on",t==="shop");
  document.getElementById("btn-inv").classList.toggle("on",t==="inventory");
  render(); renderDetail(); renderHL();
}

function setCat(c){
  cat=c;
  document.querySelectorAll(".s-item[id^='cat-']").forEach(e=>e.classList.remove("on"));
  const el=document.getElementById("cat-"+c.replace(/ /g,""));
  if(el) el.classList.add("on");
  render();
}

// ── Init ──────────────────────────────────────────────────────────────────────
initPath();

// ── Auto Update UI ────────────────────────────────────────────────────────────
if (typeof window.rlAPI !== 'undefined' && window.rlAPI.onUpdateStatus) {
  window.rlAPI.onUpdateStatus((data) => {
    const banner = document.getElementById('update-banner');
    if (!banner) return;

    if (data.status === 'available') {
      banner.innerHTML = `⬇️ Nova versão <strong>v${data.version}</strong> disponível — baixando...`;
      banner.style.display = 'flex';
      banner.style.background = 'rgba(99,71,220,.15)';
      banner.style.borderColor = 'rgba(99,71,220,.4)';
    } else if (data.status === 'downloading') {
      banner.innerHTML = `⬇️ Baixando atualização... <strong>${data.percent}%</strong>`;
      banner.style.display = 'flex';
    } else if (data.status === 'downloaded') {
      banner.innerHTML = `✅ Atualização <strong>v${data.version}</strong> pronta!
        <button onclick="window.rlAPI.installUpdate()" style="
          margin-left:12px;padding:4px 14px;
          background:linear-gradient(135deg,#7c3aed,#3b82f6);
          border:none;border-radius:6px;color:#fff;
          font-size:11px;font-weight:700;cursor:pointer;">
          Reiniciar agora
        </button>`;
      banner.style.display = 'flex';
      banner.style.background = 'rgba(16,185,129,.12)';
      banner.style.borderColor = 'rgba(16,185,129,.35)';
    } else if (data.status === 'error') {
      console.warn('[update] Erro:', data.message);
      // Não mostra erro pro usuário — falha silenciosa
    }
  });
}
