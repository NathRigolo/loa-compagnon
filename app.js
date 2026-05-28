/* ==========================================================================
   LOA COMPAGNON — Logique principale
   ==========================================================================
   Architecture :
     - Schéma de fiche figé dans EMPTY_FICHE (compatible export/import JSON)
     - Stockage : localStorage namespacé 'loa.*'
     - Multi-fiches : objet { ficheId: fiche }, fiche active référencée par ID
     - Rendu : appel unique de render() qui synchronise tout le DOM avec l'état
     - Format JSON : enveloppe identique à Drakonym Compagnon (_format, _version,
       _exported_at, fiche) pour partager les conventions
   ========================================================================== */

const APP_VERSION = '0.1.0';
const SCHEMA_VERSION = 1;
const STORAGE_KEY = 'loa.fiches';
const ACTIVE_KEY  = 'loa.active';
const OPTS_KEY    = 'loa.opts';

/* -------------------- Schéma de fiche --------------------------------- */
function newId(){ return 'imp' + Date.now().toString(36) + Math.random().toString(36).slice(2,6); }

function emptyFiche(nom='Sans nom'){
  return {
    nom, kin: '', primary: 'Body',
    attributs: { Body: 1, Gods: 1, Mind: 1, Shadow: 1, Soul: 1, World: 1 },
    classes: [],   // [{id, nom, type:'major'|'minor', niveau, color}]
    jobs: [],      // [{id, nom, niveau, color}]
    hp_current: 10, hp_max: 10,
    sp_current: 10, sp_max: 10,
    mp_current: 6,  mp_max: 6,
    defense_current: 4, defense_max: 4,
    armure_bonus: 0,
    wounds_current: 0, wounds_max: 6,
    class_die_recovery_used: false,
    short_rests_taken: 0, short_rests_max: 3,
    limit_break_actif: null, limit_break_used: false,
    statuses: [],  // [{id, nom, valeur, color}]
    perks: [],     // [{id, titre, description, color}]
    sorts: [],     // [{id, titre, description, color, aspect, sp_cost, ap_cost}]
    melodies: [],  // [{id, titre, description, color, mp_cost}]
    moments: [], ways: [], tones: [],
    draviks: 0, xp_courant: 0,
    weapons: [],   // [{id, nom, type, hands, range, damage, counter, draviks, properties, description, color, equipped}]
    armors: [],    // [{id, nom, category, def, min_body, draviks, properties, description, color, equipped}]
    tools: [],     // [{id, nom, attribute, quantity, draviks, description, color}]
    waymates: [],
    apparence: '', histoire: '', liens: '', notes: '',
    solo_mode: false,
    _fiche_id: newId()
  };
}

/* -------------------- Tables de référence LOA -------------------------- */
// Statuts officiels du Core Rulebook
const LOA_STATUSES = [
  { nom: 'Blinded',      color: 'gray',   desc: 'Bane sur les Checks ciblant la vue.' },
  { nom: 'Burning',      color: 'red',    desc: '1d6 Fire en début de round.' },
  { nom: 'Charmed',      color: 'purple', desc: 'Considère la source comme allié.' },
  { nom: 'Dazed',        color: 'purple', desc: 'Bane sur tous les Checks.' },
  { nom: 'Exposed',      color: 'red',    desc: 'Les attaques contre toi ont Boon.' },
  { nom: 'Frightened',   color: 'purple', desc: 'Bane sur les Checks près de la source.' },
  { nom: 'Frozen',       color: 'blue',   desc: 'Ne peut ni bouger ni agir.' },
  { nom: 'Knocked Down', color: 'gray',   desc: 'Au sol. Coûte 1 mouvement pour se relever.' },
  { nom: 'Poisoned',     color: 'green',  desc: '1d4 en fin de round, escalade jusqu\'au max.' },
  { nom: 'Pulled',       color: 'gray',   desc: 'Tiré vers la source.' },
  { nom: 'Pushed',       color: 'gray',   desc: 'Repoussé loin de la source.' },
  { nom: 'Rooted',       color: 'green',  desc: 'Ne peut pas bouger, peut agir.' },
  { nom: 'Silenced',     color: 'gray',   desc: 'Ne peut pas lancer de sort.' },
  { nom: 'Slowed',       color: 'gray',   desc: 'Mouvement divisé par 2.' },
  { nom: 'Stunned',      color: 'yellow', desc: 'Perd son prochain tour.' },
  { nom: 'Unseen',       color: 'gray',   desc: 'Ne peut pas être ciblé directement.' },
  { nom: 'Weakened',     color: 'red',    desc: 'Dégâts physiques divisés par 2.' }
];

// Taille du Dé de Classe par niveau total
function classDieSize(niveau){
  if(niveau <= 2)  return 4;
  if(niveau <= 4)  return 6;
  if(niveau <= 6)  return 8;
  if(niveau <= 8)  return 10;
  return 12;
}

/* -------------------- Dérivations --------------------------------------- */
function niveauTotal(fiche){
  let n = (fiche.classes || []).reduce((a,c) => a + (c.niveau || 0), 0);
  n += (fiche.jobs || []).reduce((a,j) => a + (j.niveau || 0), 0);
  return Math.max(1, n);
}
function getClassDie(fiche){
  const n = niveauTotal(fiche);
  const size = classDieSize(n);
  const count = Math.max(1, fiche.attributs[fiche.primary] || 1);
  const bonus = Math.max(0, n - 10) * 2;
  return { size, count, bonus };
}
function classDieLabel(cd){
  return cd.count + 'd' + cd.size + (cd.bonus > 0 ? ' +' + cd.bonus : '');
}

/* -------------------- Stockage ----------------------------------------- */
let state = { fiches: {}, activeId: null };
let opts  = {};

function loadState(){
  try {
    state.fiches = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    state.activeId = localStorage.getItem(ACTIVE_KEY) || null;
    opts = JSON.parse(localStorage.getItem(OPTS_KEY) || '{}');
  } catch(e){
    console.error('Erreur de chargement', e);
    state = { fiches: {}, activeId: null };
    opts = {};
  }
  if(Object.keys(state.fiches).length === 0){
    const f = emptyFiche('Nouveau Héros');
    state.fiches[f._fiche_id] = f;
    state.activeId = f._fiche_id;
    saveState();
  }
  if(!state.activeId || !state.fiches[state.activeId]){
    state.activeId = Object.keys(state.fiches)[0];
  }
}
function saveState(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.fiches));
  localStorage.setItem(ACTIVE_KEY,  state.activeId || '');
}
function saveOpts(){ localStorage.setItem(OPTS_KEY, JSON.stringify(opts)); }
function active(){ return state.fiches[state.activeId]; }

/* -------------------- Gestion des fiches -------------------------------- */
function switchFiche(id){
  if(!state.fiches[id]) return;
  state.activeId = id;
  saveState(); render();
}
function createFicheFromName(nom){
  const f = emptyFiche(nom || 'Sans nom');
  state.fiches[f._fiche_id] = f;
  state.activeId = f._fiche_id;
  saveState(); render(); closeModal('newFicheModal');
  toast('Fiche « ' + f.nom + ' » créée');
}
function createFiche(){
  const nom = $('newFicheName').value.trim() || 'Sans nom';
  createFicheFromName(nom);
}
function deleteFiche(){
  const f = active();
  if(!f) return;
  if(!confirm('Supprimer définitivement la fiche « ' + f.nom + ' » ?')) return;
  delete state.fiches[f._fiche_id];
  const ids = Object.keys(state.fiches);
  if(ids.length === 0){
    const nf = emptyFiche('Nouveau Héros');
    state.fiches[nf._fiche_id] = nf;
    state.activeId = nf._fiche_id;
  } else {
    state.activeId = ids[0];
  }
  saveState(); render(); closeModal('editModal');
  toast('Fiche supprimée');
}

/* -------------------- Rendu (DOM) -------------------------------------- */
const $ = id => document.getElementById(id);

function render(){
  const f = active();
  if(!f) return;

  /* identité */
  $('name').textContent    = f.nom || '—';
  $('initial').textContent = (f.nom || '?').charAt(0).toUpperCase();
  const cls = (f.classes && f.classes[0]) ? (f.classes[0].nom + ' ' + f.classes[0].niveau) : 'Sans classe';
  const others = (f.classes || []).slice(1).map(c => c.nom + ' ' + c.niveau).join(' · ');
  $('meta').innerHTML = 'Niv. <b>' + niveauTotal(f) + '</b> · ' + cls
    + (others ? ' / ' + others : '')
    + (f.kin ? ' · ' + f.kin : '');

  /* jauges */
  setBar('hp', f.hp_current, f.hp_max);
  setBar('sp', f.sp_current, f.sp_max);
  setBar('mp', f.mp_current, f.mp_max);
  setBar('def', f.defense_current, f.defense_max);
  setBar('wound', f.wounds_current, f.wounds_max);

  /* overdrive : moins de la moitié HP + Limit Break dispo */
  const low = f.hp_current > 0 && f.hp_current < f.hp_max / 2;
  $('hpbar').classList.toggle('low', low);
  $('win').classList.toggle('overdrive', low && !f.limit_break_used && f.hp_current > 0);
  $('win').classList.toggle('dying', f.hp_current <= 0);

  /* Dé de Classe */
  const cd = getClassDie(f);
  $('cddie').textContent = 'd' + cd.size;
  $('cdsub').textContent = classDieLabel(cd) + ' · Primary : ' + f.primary
    + (f.class_die_recovery_used ? ' · soin utilisé' : '');

  /* statuts */
  renderStatuses();

  /* fiche selector */
  $('ficheLabel').textContent = f.nom || '—';
  renderDropdown();
}

function setBar(key, cur, max){
  const fillId = (key === 'wound' ? 'woundfill' : key + 'fill');
  const valId  = (key === 'wound' ? 'woundval'  : key + 'val');
  const fill = $(fillId);
  const val  = $(valId);
  const pct  = max > 0 ? Math.max(0, Math.min(100, (cur/max)*100)) : 0;
  if(fill) fill.style.width = pct + '%';
  if(val)  val.textContent = cur + '/' + max;
}

function renderStatuses(){
  const wrap = $('statuses');
  wrap.innerHTML = '';
  const f = active();
  (f.statuses || []).forEach(s => {
    const c = document.createElement('span');
    c.className = 'chip';
    c.setAttribute('data-c', s.color || 'gray');
    c.innerHTML = (s.nom || '').toUpperCase()
      + (s.valeur ? ' ' + s.valeur : '')
      + ' <span class="x">×</span>';
    c.onclick = () => removeStatus(s.id);
    wrap.appendChild(c);
  });
  const add = document.createElement('span');
  add.className = 'chip add';
  add.innerHTML = '+ STATUT';
  add.onclick = openStatusModal;
  wrap.appendChild(add);
}

function renderDropdown(){
  const dd = $('ficheDropdown');
  dd.innerHTML = '';
  Object.values(state.fiches).forEach(f => {
    const it = document.createElement('div');
    it.className = 'item' + (f._fiche_id === state.activeId ? ' active' : '');
    it.innerHTML = '<span>' + escapeHtml(f.nom || '—') + '</span>'
      + '<span class="del" onclick="event.stopPropagation(); deleteFicheById(\'' + f._fiche_id + '\')">×</span>';
    it.onclick = () => { switchFiche(f._fiche_id); closeDropdown(); };
    dd.appendChild(it);
  });
  const sep = document.createElement('div');
  sep.className = 'sep';
  dd.appendChild(sep);
  const add = document.createElement('div');
  add.className = 'item';
  add.innerHTML = '<span>+ NOUVELLE FICHE</span>';
  add.onclick = () => { closeDropdown(); openModal('newFicheModal'); $('newFicheName').value = ''; $('newFicheName').focus(); };
  dd.appendChild(add);
}
function deleteFicheById(id){
  const f = state.fiches[id];
  if(!f) return;
  if(!confirm('Supprimer « ' + f.nom + ' » ?')) return;
  delete state.fiches[id];
  if(state.activeId === id){
    const ids = Object.keys(state.fiches);
    state.activeId = ids[0] || null;
    if(!state.activeId){
      const nf = emptyFiche('Nouveau Héros');
      state.fiches[nf._fiche_id] = nf;
      state.activeId = nf._fiche_id;
    }
  }
  saveState(); render();
}

function escapeHtml(s){ return (s||'').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

/* -------------------- Ajustement des jauges ----------------------------- */
function adjust(key, delta){
  const f = active(); if(!f) return;
  if(key === 'hp'){
    f.hp_current = Math.max(0, Math.min(f.hp_max, f.hp_current + delta));
    // À 0 HP : commence à prendre des Wounds (LOA règle)
    if(f.hp_current === 0 && delta < 0 && f.wounds_current < f.wounds_max){
      f.wounds_current = Math.min(f.wounds_max, f.wounds_current + 1);
      toast('Dying : +1 Wound (' + f.wounds_current + '/' + f.wounds_max + ')');
    }
    initAudio(); delta < 0 ? sfxHit() : sfxHeal();
    floater((delta > 0 ? '+' : '') + delta, delta > 0 ? 'heal' : 'dmg');
  } else if(key === 'sp'){
    f.sp_current = Math.max(0, Math.min(f.sp_max, f.sp_current + delta));
  } else if(key === 'mp'){
    f.mp_current = Math.max(0, Math.min(f.mp_max, f.mp_current + delta));
  } else if(key === 'def'){
    f.defense_current = Math.max(0, Math.min(f.defense_max, f.defense_current + delta));
  } else if(key === 'wounds'){
    f.wounds_current = Math.max(0, Math.min(f.wounds_max, f.wounds_current + delta));
    if(f.wounds_current >= f.wounds_max){
      toast('Mort : 6 Wounds atteint.');
    }
  }
  saveState(); render();
}
function floater(text, cls){
  if(!opts.floaters && opts.floaters !== undefined) return;
  if(opts.floaters === false) return;
  const win = $('win'), bar = $('hpbar');
  const f = document.createElement('span');
  f.className = 'floater ' + cls;
  f.textContent = text;
  const r = bar.getBoundingClientRect(), w = win.getBoundingClientRect();
  f.style.left = (r.left - w.left + r.width/2 - 10) + 'px';
  f.style.top  = (r.top  - w.top  - 6) + 'px';
  win.appendChild(f);
  setTimeout(() => f.remove(), 1000);
}

/* -------------------- Statuts ------------------------------------------- */
function openStatusModal(){
  const sel = $('stSelect');
  sel.innerHTML = '';
  LOA_STATUSES.forEach(s => {
    const o = document.createElement('option');
    o.value = s.nom;
    o.textContent = s.nom + ' — ' + s.desc;
    sel.appendChild(o);
  });
  $('stValue').value = '';
  openModal('statusModal');
}
function addStatus(){
  const f = active();
  const nom = $('stSelect').value;
  const valeur = $('stValue').value.trim();
  const ref = LOA_STATUSES.find(s => s.nom === nom);
  f.statuses = f.statuses || [];
  f.statuses.push({ id: newId(), nom, valeur, color: ref ? ref.color : 'gray' });
  saveState(); render(); closeModal('statusModal');
}
function removeStatus(id){
  const f = active();
  f.statuses = (f.statuses || []).filter(s => s.id !== id);
  saveState(); render();
}

/* -------------------- Audio (bips synthétisés) -------------------------- */
let actx = null;
function initAudio(){
  if(actx) return;
  try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e){}
}
function beep(freq, dur, type='square', vol=.06){
  if(opts.sound === false) return;
  if(!actx) return;
  const o = actx.createOscillator(), g = actx.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(vol, actx.currentTime);
  g.gain.exponentialRampToValueAtTime(.0001, actx.currentTime + dur);
  o.connect(g).connect(actx.destination);
  o.start(); o.stop(actx.currentTime + dur);
}
function sfxHit()    { beep(160, .12, 'square', .08); }
function sfxCrit()   { [523,659,784,1046].forEach((f,i) => setTimeout(() => beep(f, .1), i*55)); }
function sfxHeal()   { [660,880].forEach((f,i) => setTimeout(() => beep(f, .12, 'triangle'), i*70)); }
function sfxConfirm(){ beep(880, .05); setTimeout(() => beep(1320, .07), 50); }
function sfxLevel()  { [523,587,659,784,1046,1318].forEach((f,i) => setTimeout(() => beep(f, .13, 'square', .07), i*90)); }

/* -------------------- Lancer de dés (helpers) --------------------------- */
function rollD(n){ return Math.floor(Math.random()*n) + 1; }

function spawnDie(tray, finalValue, startDelay, rollDur, max=6){
  const f = document.createElement('span');
  f.className = 'face in';
  f.style.animationDelay = startDelay + 'ms';
  f.textContent = rollD(max);
  tray.appendChild(f);
  setTimeout(() => {
    const t0 = performance.now();
    const tick = () => {
      const e = performance.now() - t0;
      if(e >= rollDur - 90){ f.textContent = finalValue; return; }
      f.textContent = rollD(max);
      setTimeout(tick, 75);
    };
    tick();
  }, startDelay + 60);
  return f;
}

/* -------------------- Modal de jets ------------------------------------- */
function openRollModal(title, q, sub){
  $('rmTitle').textContent = title;
  $('rmQ').textContent = q;
  $('rmSub').textContent = sub;
  $('rmTray').innerHTML = '';
  $('rmRes').className = 'roll-res-big';
  $('rmRes').textContent = '';
  $('rmOk').classList.remove('ready');
  const box = document.querySelector('#rollModal .roll-box');
  box.classList.remove('crit');
  $('rollModal').classList.add('show');
}
function closeRollModal(){ $('rollModal').classList.remove('show'); }

/* -------------------- Construction d'un Check --------------------------- */
function openCheckBuilder(){
  const f = active();
  $('checkAttrA').value = f.primary;
  $('checkAttrB').value = '';
  $('checkBoons').value = 0;
  $('checkBanes').value = 0;
  openModal('checkModal');
}
function runCheck(){
  const f = active();
  const a = $('checkAttrA').value;
  const b = $('checkAttrB').value;
  const boons = parseInt($('checkBoons').value) || 0;
  const banes = parseInt($('checkBanes').value) || 0;
  closeModal('checkModal');

  const valA = f.attributs[a] || 0;
  const valB = b ? (f.attributs[b] || 0) : valA; // si pas de B, double A
  const n = Math.max(1, valA + valB);
  const label = b ? (a + ' + ' + b) : (a + ' (×2)');
  const net = boons - banes;
  const netLbl = net > 0 ? ' · Boon ' + net : (net < 0 ? ' · Bane ' + (-net) : '');

  initAudio(); sfxConfirm();
  openRollModal('JET DE CHECK', label.toUpperCase(), n + 'd6' + netLbl);

  // jet brut
  const dice = [];
  for(let i = 0; i < n; i++) dice.push(rollD(6));

  const tray = $('rmTray');
  const STAG = 180, ROLL = 600;
  const faces = dice.map((d, i) => spawnDie(tray, d, i*STAG, ROLL, 6));

  // mise en lumière des succès
  dice.forEach((d, i) => {
    setTimeout(() => {
      if(d >= 5){ faces[i].classList.add('hit'); beep(880 + (d-5)*220, .08); }
    }, i*STAG + ROLL + 220);
  });

  const lastSettle = (n-1)*STAG + ROLL + 220;

  // Application des Boons / Banes net après la pose
  let netRemaining = net;
  let extraDelay = 0;
  const applyBoonBane = () => {
    if(netRemaining === 0){ finishCheck(dice, label); return; }
    let changed = false;
    if(netRemaining > 0){
      // Boon : transforme un 4 en 5
      const idx = dice.findIndex(d => d === 4);
      if(idx >= 0){
        dice[idx] = 5;
        faces[idx].classList.add('flip');
        setTimeout(() => {
          faces[idx].textContent = '5';
          faces[idx].classList.add('hit');
          beep(990, .1);
        }, 300);
        netRemaining--;
        changed = true;
      } else {
        netRemaining = 0;
      }
    } else {
      // Bane : transforme un 5 en 4
      const idx = dice.findIndex(d => d === 5);
      if(idx >= 0){
        dice[idx] = 4;
        faces[idx].classList.add('flip');
        setTimeout(() => {
          faces[idx].textContent = '4';
          faces[idx].classList.remove('hit');
          beep(330, .1);
        }, 300);
        netRemaining++;
        changed = true;
      } else {
        netRemaining = 0;
      }
    }
    if(changed){
      setTimeout(applyBoonBane, 600);
    } else {
      finishCheck(dice, label);
    }
  };
  setTimeout(applyBoonBane, lastSettle + 600);
}

function finishCheck(dice, label){
  const succ = dice.filter(d => d >= 5).length;
  const tier = succ === 0 ? 'Échec' : (succ <= 3 ? 'Mitigé' : 'Succès complet');
  const res = $('rmRes');
  res.className = 'roll-res-big banner';
  res.innerHTML = succ + ' SUCCÈS<small>' + tier.toUpperCase() + '</small>';
  $('rmOk').classList.add('ready');
  if(succ >= 4){
    sfxCrit();
    const box = document.querySelector('#rollModal .roll-box');
    box.classList.remove('crit'); void box.offsetWidth; box.classList.add('crit');
  }
  // trace dans le log permanent
  const lt = $('rolltray');
  lt.innerHTML = '<span class="q">' + escapeHtml(label) + '</span>';
  dice.forEach(d => {
    const f = document.createElement('span');
    f.className = 'face' + (d >= 5 ? ' hit' : '');
    f.textContent = d;
    lt.appendChild(f);
  });
  const lr = $('rollres');
  lr.className = 'res';
  lr.innerHTML = succ + ' succès <span>— ' + tier + '</span>';
}

/* -------------------- Dé de Classe ------------------------------------- */
function rollClassDie(){
  const f = active();
  const cd = getClassDie(f);
  initAudio(); sfxConfirm();
  openRollModal('DÉ DE CLASSE', classDieLabel(cd), 'Primary : ' + f.primary);
  const dice = [];
  for(let i = 0; i < cd.count; i++) dice.push(rollD(cd.size));
  const STAG = 200, ROLL = 660;
  spawnAndShowSum(dice, cd.size, STAG, ROLL, cd.bonus);
}

function spawnAndShowSum(dice, size, STAG, ROLL, bonus){
  const tray = $('rmTray');
  dice.forEach((d, i) => spawnDie(tray, d, i*STAG, ROLL, size));
  dice.forEach((d, i) => setTimeout(() => beep(660 + i*100, .07), i*STAG + ROLL + 120));
  const lastSettle = (dice.length - 1) * STAG + ROLL + 120;
  setTimeout(() => {
    const total = dice.reduce((a,b) => a+b, 0) + (bonus || 0);
    const res = $('rmRes');
    const detail = dice.join(' + ') + (bonus ? ' + ' + bonus : '');
    res.className = 'roll-res-big banner';
    res.innerHTML = 'TOTAL ' + total + '<small>' + detail + '</small>';
    $('rmOk').classList.add('ready');
    const die = $('cddie');
    die.classList.remove('pop'); void die.offsetWidth; die.classList.add('pop');
    // log permanent
    const lt = $('rolltray');
    lt.innerHTML = '<span class="q">Dé de Classe</span>';
    dice.forEach(d => {
      const f = document.createElement('span');
      f.className = 'face';
      f.textContent = d;
      lt.appendChild(f);
    });
    const lr = $('rollres');
    lr.className = 'res';
    lr.innerHTML = 'Total ' + total;
  }, lastSettle + 500);
  return dice;
}

/* -------------------- Soin Class Die (hors combat) ---------------------- */
function useCDRecovery(){
  const f = active();
  if(f.class_die_recovery_used){
    toast('Soin du Dé de Classe déjà utilisé. Prends un Repos court pour le récupérer.');
    return;
  }
  const cd = getClassDie(f);
  initAudio(); sfxConfirm();
  openRollModal('SOIN — DÉ DE CLASSE', classDieLabel(cd), 'Restaure HP égal au jet');
  const dice = [];
  for(let i = 0; i < cd.count; i++) dice.push(rollD(cd.size));
  const STAG = 200, ROLL = 660;
  const tray = $('rmTray');
  dice.forEach((d, i) => spawnDie(tray, d, i*STAG, ROLL, cd.size));
  dice.forEach((d, i) => setTimeout(() => beep(660 + i*100, .07), i*STAG + ROLL + 120));
  const lastSettle = (dice.length - 1) * STAG + ROLL + 120;
  setTimeout(() => {
    const heal = dice.reduce((a,b) => a+b, 0) + cd.bonus;
    f.hp_current = Math.min(f.hp_max, f.hp_current + heal);
    f.class_die_recovery_used = true;
    saveState(); render();
    const res = $('rmRes');
    res.className = 'roll-res-big banner';
    res.innerHTML = '+' + heal + ' HP<small>' + dice.join(' + ') + (cd.bonus ? ' + ' + cd.bonus : '') + '</small>';
    $('rmOk').classList.add('ready');
    sfxHeal();
  }, lastSettle + 500);
}

/* -------------------- Repos court --------------------------------------- */
function shortRest(){
  const f = active();
  if(f.short_rests_taken >= f.short_rests_max){
    if(!confirm('Tu as déjà pris ' + f.short_rests_max + ' Repos courts ce Downtime. Continuer quand même ?')) return;
  } else {
    if(!confirm('Prendre un Repos court ?\n\n• Wounds remises à zéro\n• Soin du Dé de Classe réinitialisé\n• Limit Break refresh\n• +SP égal à un jet du Dé de Classe')) return;
  }
  const cd = getClassDie(f);
  const dice = [];
  for(let i = 0; i < cd.count; i++) dice.push(rollD(cd.size));
  const spGain = dice.reduce((a,b) => a+b, 0) + cd.bonus;
  f.sp_current = Math.min(f.sp_max, f.sp_current + spGain);
  f.wounds_current = 0;
  f.class_die_recovery_used = false;
  f.limit_break_used = false;
  f.short_rests_taken++;
  saveState(); render();
  initAudio(); sfxLevel();
  toast('Repos court · +' + spGain + ' SP · Wounds & Limit Break refresh');
}

/* -------------------- Niveau supérieur --------------------------------- */
function levelUp(){
  const f = active();
  if(!f.classes || f.classes.length === 0){
    alert('Ajoute d\'abord une classe via le bouton Éditer (✎).');
    return;
  }
  // Pour Phase 1 : level-up la classe principale, +1 niveau, +1 attribut Primary
  const c = f.classes[0];
  const newLevel = c.niveau + 1;
  const oldTotal = niveauTotal(f);
  const newTotal = oldTotal + 1;
  const oldCDSize = classDieSize(oldTotal);
  const newCDSize = classDieSize(newTotal);

  const gains = [];
  gains.push({ k: 'CLASSE', v: c.nom + ' ' + c.niveau + ' → ' + newLevel });
  if(newCDSize !== oldCDSize){
    gains.push({ k: 'DÉ DE CLASSE', v: 'd' + oldCDSize + ' → d' + newCDSize });
  } else if(newTotal > 10){
    gains.push({ k: 'BONUS DÉ DE CLASSE', v: '+2 au jet' });
  }
  gains.push({ k: '+1 ATTRIBUT', v: 'voir édition' });
  gains.push({ k: 'PERK DE CLASSE', v: '+1 (à choisir)' });
  gains.push({ k: '+ 2 CHOIX', v: 'sort, Moment, Way, Tone ou Perk' });
  gains.push({ k: 'NIVEAU TOTAL', v: oldTotal + ' → ' + newTotal });

  $('lvlGains').innerHTML = gains.map(g =>
    '<div style="display:flex;justify-content:space-between;font-family:var(--pixel);font-size:9px;padding:8px 4px;border-bottom:1px dashed rgba(255,255,255,.2)">'
    + '<span>' + escapeHtml(g.k) + '</span>'
    + '<span style="color:#8ef08a">' + escapeHtml(g.v) + '</span>'
    + '</div>'
  ).join('');
  openModal('lvlOverlay');
  initAudio(); sfxLevel();
}
function applyLevelUp(){
  const f = active();
  const c = f.classes[0];
  if(!c){ closeModal('lvlOverlay'); return; }
  c.niveau++;
  saveState(); render();
  closeModal('lvlOverlay');
  toast('Niveau appliqué. Ouvre Éditer (✎) pour assigner ton +1 attribut et tes choix.');
}

/* -------------------- Édition de fiche --------------------------------- */
function openEdit(){
  const f = active();
  $('edNom').value     = f.nom || '';
  $('edKin').value     = f.kin || '';
  const c = (f.classes || [])[0] || { nom: '', niveau: 1 };
  $('edClasse').value  = c.nom;
  $('edNiveau').value  = c.niveau;
  $('edPrimary').value = f.primary;
  $('edBody').value    = f.attributs.Body;
  $('edGods').value    = f.attributs.Gods;
  $('edMind').value    = f.attributs.Mind;
  $('edShadow').value  = f.attributs.Shadow;
  $('edSoul').value    = f.attributs.Soul;
  $('edWorld').value   = f.attributs.World;
  $('edHPMax').value   = f.hp_max;
  $('edSPMax').value   = f.sp_max;
  $('edMPMax').value   = f.mp_max;
  $('edDEFMax').value  = f.defense_max;
  openModal('editModal');
}
function saveEdit(){
  const f = active();
  f.nom     = $('edNom').value.trim() || 'Sans nom';
  f.kin     = $('edKin').value.trim();
  const classeNom = $('edClasse').value.trim();
  const classeNiv = parseInt($('edNiveau').value) || 1;
  if(classeNom){
    if(!f.classes || f.classes.length === 0){
      f.classes = [{ id: newId(), nom: classeNom, niveau: classeNiv, type: 'major', color: 'blue' }];
    } else {
      f.classes[0].nom = classeNom;
      f.classes[0].niveau = classeNiv;
    }
  }
  f.primary        = $('edPrimary').value;
  f.attributs.Body = clampInt($('edBody').value, 0, 99);
  f.attributs.Gods = clampInt($('edGods').value, 0, 99);
  f.attributs.Mind = clampInt($('edMind').value, 0, 99);
  f.attributs.Shadow = clampInt($('edShadow').value, 0, 99);
  f.attributs.Soul = clampInt($('edSoul').value, 0, 99);
  f.attributs.World = clampInt($('edWorld').value, 0, 99);
  f.hp_max     = clampInt($('edHPMax').value, 0, 999);
  f.sp_max     = clampInt($('edSPMax').value, 0, 999);
  f.mp_max     = clampInt($('edMPMax').value, 0, 99);
  f.defense_max= clampInt($('edDEFMax').value, 0, 99);
  // Reclamp les valeurs courantes si max a baissé
  f.hp_current      = Math.min(f.hp_current, f.hp_max);
  f.sp_current      = Math.min(f.sp_current, f.sp_max);
  f.mp_current      = Math.min(f.mp_current, f.mp_max);
  f.defense_current = Math.min(f.defense_current, f.defense_max);
  saveState(); render(); closeModal('editModal');
  toast('Fiche enregistrée');
}
function clampInt(v, lo, hi){ v = parseInt(v); if(isNaN(v)) v = 0; return Math.max(lo, Math.min(hi, v)); }

/* -------------------- Export / Import JSON ----------------------------- */
function exportJson(){
  const f = active();
  const blob = new Blob([JSON.stringify({
    _format: 'loa-compagnon',
    _version: SCHEMA_VERSION,
    _exported_at: new Date().toISOString(),
    fiche: f
  }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const safe = (f.nom || 'fiche').toLowerCase().replace(/[^a-z0-9]+/g, '_');
  a.download = 'loa_' + safe + '_' + new Date().toISOString().slice(0,10) + '.json';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 300);
  toast('Fiche exportée');
}
function importJson(file){
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if(data._format !== 'loa-compagnon'){
        if(data._format === 'drakonym-compagnon'){
          alert('Cette fiche vient de Drakonym Compagnon. L\'import automatique Drakonym→LOA n\'est pas encore branché (Phase ultérieure). Ouvre le JSON et adapte-le à la main pour l\'instant, ou crée une fiche LOA neuve.');
          return;
        }
        if(!confirm('Format inconnu (' + data._format + '). Tenter quand même l\'import ?')) return;
      }
      const f = data.fiche || data;
      // garantit un ID unique
      f._fiche_id = newId();
      // merge avec EMPTY_FICHE pour ne pas perdre les nouveaux champs LOA
      const merged = Object.assign({}, emptyFiche(f.nom || 'Importé'), f);
      merged._fiche_id = f._fiche_id;
      state.fiches[merged._fiche_id] = merged;
      state.activeId = merged._fiche_id;
      saveState(); render();
      toast('Fiche « ' + merged.nom + ' » importée');
    } catch(e){
      alert('Erreur de lecture du JSON : ' + e.message);
    }
  };
  reader.readAsText(file);
}

/* -------------------- Modals (helpers génériques) ----------------------- */
function openModal(id){ $(id).classList.add('show'); }
function closeModal(id){ $(id).classList.remove('show'); }

/* -------------------- Toast -------------------------------------------- */
function toast(msg){
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

/* -------------------- Dropdown fiches ---------------------------------- */
function toggleDropdown(){ $('ficheDropdown').classList.toggle('open'); }
function closeDropdown(){ $('ficheDropdown').classList.remove('open'); }

/* -------------------- Réglages (options) ------------------------------- */
const OPTIONS = [
  ['scan',      'Scanlines',           true],
  ['corners',   'Coins ornés',         true],
  ['cursor',    'Curseur ▶ animé',     true],
  ['open',      'Ouverture de fenêtre',true],
  ['floaters',  'Chiffres flottants',  true],
  ['counter',   'Compteur défilant',   true],
  ['lowhp',     'Alerte HP bas',       true],
  ['overdrive', 'Pulse Overdrive',     true],
  ['sound',     'Son (bips SNES)',     false]
];
function applyOpts(){
  OPTIONS.forEach(([k]) => document.body.classList.toggle('opt-' + k, opts[k] !== false));
}
function renderOptsList(){
  const wrap = $('optsList');
  wrap.innerHTML = '';
  OPTIONS.forEach(([k, label, def]) => {
    if(opts[k] === undefined) opts[k] = def;
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:10px 4px;border-bottom:1px dashed rgba(255,255,255,.1)';
    row.innerHTML = '<span style="font-size:13px">' + label + '</span>'
      + '<span class="sw" data-on="' + (opts[k]?'1':'0') + '" style="width:36px;height:20px;border-radius:11px;background:'
      + (opts[k] ? '#3fa34d' : '#3a3f57') + ';position:relative;flex-shrink:0;box-shadow:inset 0 0 0 2px #000;cursor:pointer;transition:background .2s">'
      + '<span style="position:absolute;top:2px;left:' + (opts[k] ? '18px' : '2px') + ';width:14px;height:14px;border-radius:50%;background:#cfd3ec;transition:left .18s"></span>'
      + '</span>';
    row.querySelector('.sw').onclick = () => {
      opts[k] = !opts[k];
      if(k === 'sound' && opts[k]) initAudio();
      saveOpts(); applyOpts(); renderOptsList();
    };
    wrap.appendChild(row);
  });
  applyOpts();
}

/* -------------------- Wiring ------------------------------------------- */
function wire(){
  $('ficheSelect').onclick = e => {
    if(e.target.closest('.fiche-dropdown')) return;
    toggleDropdown();
    e.stopPropagation();
  };
  document.addEventListener('click', () => closeDropdown());

  $('btnEdit').onclick     = openEdit;
  $('btnImport').onclick   = () => $('fileInput').click();
  $('btnExport').onclick   = exportJson;
  $('btnSettings').onclick = () => { renderOptsList(); openModal('settingsModal'); };

  $('fileInput').onchange = e => {
    const f = e.target.files[0];
    if(f) importJson(f);
    e.target.value = '';
  };
}

/* -------------------- Service Worker ----------------------------------- */
function registerSW(){
  if('serviceWorker' in navigator){
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('service-worker.js').catch(() => {});
    });
  }
}

/* -------------------- Init --------------------------------------------- */
function init(){
  loadState();
  applyOpts();
  wire();
  render();
  registerSW();
  $('foot').textContent = 'LOA Compagnon v' + APP_VERSION + ' · ' + Object.keys(state.fiches).length + ' fiche(s)';
}

document.addEventListener('DOMContentLoaded', init);
