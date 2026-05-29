/* ==========================================================================
   LOA COMPAGNON — Logique principale (v3)
   Layout 3 colonnes desktop, bottom nav mobile
   ========================================================================== */

const APP_VERSION = '0.8.0';
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
    classes: [], jobs: [],
    hp_current: 10, hp_max: 10,
    sp_current: 10, sp_max: 10,
    mp_current: 6,  mp_max: 6,
    defense_current: 4, defense_max: 4,
    armure_bonus: 0,
    wounds_current: 0, wounds_max: 6,
    class_die_recovery_used: false,
    short_rests_taken: 0, short_rests_max: 3,
    limit_break_actif: null, limit_break_used: false,
    statuses: [], perks: [], sorts: [], melodies: [],
    moments: [], ways: [], tones: [],
    draviks: 0, xp_courant: 0,
    weapons: [], armors: [], tools: [], waymates: [],
    apparence: '', histoire: '', liens: '', notes: '',
    solo_mode: false,
    _fiche_id: newId(),
    _rollLog: []
  };
}

const LOA_STATUSES = [
  { nom: 'Blinded',      color: 'gray',   desc: 'Ne voit ni ne cible aucune créature. Les Checks de vue échouent. Fin du prochain tour.' },
  { nom: 'Burning',      color: 'red',    desc: '1d6 Fire au début de chaque round. 1 Action pour éteindre.' },
  { nom: 'Charmed',      color: 'purple', desc: 'Ne peut cibler la source du charme. Fin du prochain tour.' },
  { nom: 'Dazed',        color: 'purple', desc: 'Une seule Action à son tour. Fin du prochain tour.' },
  { nom: 'Exposed',      color: 'red',    desc: 'Le prochain coup ignore totalement la DEF. Retiré après avoir été touché.' },
  { nom: 'Frightened',   color: 'purple', desc: 'Ne peut se déplacer vers la source. Fin du prochain tour.' },
  { nom: 'Frozen',       color: 'blue',   desc: 'Ne peut bouger. Les attaques contre lui montent le Base Die d\'un cran. Fin du prochain tour.' },
  { nom: 'Knocked Down', color: 'gray',   desc: 'Ne peut bouger. Les attaques contre lui lancent un Base Die de plus. 1 Action pour se relever.' },
  { nom: 'Poisoned',     color: 'green',  desc: '1d4 en fin de round ; sur un max le dé monte d\'un cran (jusqu\'à d20). 1 Action + Check Body+Soul, ou antidote.' },
  { nom: 'Pulled',       color: 'gray',   desc: 'Déplacé jusqu\'à 5 cases / 1 zone vers la source. Immédiat.' },
  { nom: 'Pushed',       color: 'gray',   desc: 'Déplacé jusqu\'à 5 cases / 1 zone loin de la source. Immédiat.' },
  { nom: 'Rooted',       color: 'green',  desc: 'Ne peut bouger ni faire d\'action nécessitant un déplacement. Fin du prochain tour.' },
  { nom: 'Silenced',     color: 'gray',   desc: 'Ne peut lancer de sorts ni d\'Actions magiques. Fin du prochain tour.' },
  { nom: 'Slowed',       color: 'gray',   desc: 'Speed tombe à 5 (Slow). Si déjà Slow : 2 Actions pour bouger. Fin du prochain tour.' },
  { nom: 'Stunned',      color: 'gold',   desc: 'Ses Crits n\'explosent pas à son prochain tour. Fin du prochain tour.' },
  { nom: 'Unseen',       color: 'gray',   desc: 'Ne peut être ciblé par une attaque. Ses attaques ne peuvent être contrées. Retiré dès qu\'il agit.' },
  { nom: 'Weakened',     color: 'red',    desc: 'Prochaine attaque : dé de base réduit d\'un cran (min d4). Fin du prochain tour.' }
];

function classDieSize(niveau){
  if(niveau <= 2)  return 4;
  if(niveau <= 4)  return 6;
  if(niveau <= 6)  return 8;
  if(niveau <= 8)  return 10;
  return 12;
}
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
let diceMult = 1;
let currentPage = 'fiche';
let combatModeActive = false;
let currentInvCapa  = 'perks';
let currentInvEquip = 'weapons';
let selectedAttrs = [];
let currentTab = 'check';
let editingItem = null;

function loadState(){
  try {
    state.fiches = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    state.activeId = localStorage.getItem(ACTIVE_KEY) || null;
    opts = JSON.parse(localStorage.getItem(OPTS_KEY) || '{}');
  } catch(e){
    state = { fiches: {}, activeId: null }; opts = {};
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
function createFiche(){
  const nom = $('newFicheName').value.trim() || 'Sans nom';
  const f = emptyFiche(nom);
  state.fiches[f._fiche_id] = f;
  state.activeId = f._fiche_id;
  saveState(); render(); closeModal('newFicheModal');
  toast('Fiche « ' + nom + ' » créée');
}
function deleteFiche(){
  const f = active();
  if(!f) return;
  if(!confirm('Supprimer définitivement la fiche « ' + f.nom + ' » ?')) return;
  delete state.fiches[f._fiche_id];
  ensureActiveFiche();
  saveState(); render(); closeModal('editModal');
  toast('Fiche supprimée');
}
function deleteFicheById(id){
  const f = state.fiches[id];
  if(!f) return;
  if(!confirm('Supprimer « ' + f.nom + ' » ?')) return;
  delete state.fiches[id];
  if(state.activeId === id) ensureActiveFiche();
  saveState(); render(); renderFichesList();
}
function ensureActiveFiche(){
  const ids = Object.keys(state.fiches);
  if(ids.length === 0){
    const nf = emptyFiche('Nouveau Héros');
    state.fiches[nf._fiche_id] = nf;
    state.activeId = nf._fiche_id;
  } else {
    state.activeId = ids[0];
  }
}

/* -------------------- Page switching ----------------------------------- */
function switchPage(page){
  currentPage = page;
  document.querySelectorAll('.page').forEach(p =>
    p.classList.toggle('active', p.id === 'page-' + page)
  );
  document.querySelectorAll('.nav-item').forEach(n =>
    n.classList.toggle('active', n.dataset.page === page)
  );
  document.querySelectorAll('.bn-item').forEach(n =>
    n.classList.toggle('active', n.dataset.page === page)
  );
  /* Si on entre dans Capacités ou Équipement, on rafraîchit l'inventaire */
  if(page === 'capacites' || page === 'equipement') renderInventoryPages();
}

/* -------------------- Rendu (DOM) -------------------------------------- */
const $ = id => document.getElementById(id);

function render(){
  const f = active();
  if(!f) return;

  renderHeader();
  renderStats();
  setBar('hp', f.hp_current, f.hp_max);
  setBar('sp', f.sp_current, f.sp_max);
  setBar('mp', f.mp_current, f.mp_max);
  setBar('def', f.defense_current, f.defense_max);
  setBar('wound', f.wounds_current, f.wounds_max);
  if($('mpCount')) $('mpCount').textContent = f.mp_current + ' / ' + f.mp_max;

  const low = f.hp_current > 0 && f.hp_current < f.hp_max / 2;
  $('hpbar').classList.toggle('low', low);
  const isOverdrive = low && !f.limit_break_used && f.hp_current > 0;
  $('heroHeader').classList.toggle('overdrive', isOverdrive);
  $('heroHeader').classList.toggle('dying', f.hp_current <= 0);
  $('limitBreakBtn').style.display = isOverdrive ? '' : 'none';

  const cd = getClassDie(f);
  $('cddie').textContent = 'd' + cd.size;
  $('cdsub').textContent = classDieLabel(cd) + ' · Primary : ' + f.primary
    + (f.class_die_recovery_used ? ' · soin utilisé' : '');

  renderStatuses();
  renderInventoryPages();
  renderSidebar();
  renderClassStrip();
  renderRP();
  if(combatModeActive) renderCombatMode();

  $('ficheBtnLabel').textContent = f.nom || '—';
}

function renderHeader(){
  const f = active();
  $('initial').textContent = (f.nom || '?').charAt(0).toUpperCase();
  $('heroName').innerHTML = escapeHtml(f.nom || '—') + '<span class="od-tag">OVERDRIVE</span>';
  $('heroLevel').textContent = niveauTotal(f);
  const cls = (f.classes && f.classes[0]) ? (f.classes[0].nom + ' ' + f.classes[0].niveau) : 'Sans classe';
  const others = (f.classes || []).slice(1).map(c => c.nom + ' ' + c.niveau).join(' · ');
  $('heroMeta').innerHTML = (f.kin ? escapeHtml(f.kin) + ' · ' : '') + escapeHtml(cls)
    + (others ? ' / ' + escapeHtml(others) : '')
    + ' · <b>Primary ' + escapeHtml(f.primary) + '</b>';
}

function renderStats(){
  const wrap = $('statsRow');
  const f = active();
  wrap.innerHTML = '';
  ['Body','Gods','Mind','Shadow','Soul','World'].forEach(a => {
    const box = document.createElement('div');
    box.className = 'stat' + (f.primary === a ? ' primary' : '');
    box.innerHTML = '<span class="stat-name">' + a.toUpperCase() + '</span>'
      + '<span class="stat-val">' + (f.attributs[a] || 0) + '</span>';
    box.title = 'Lancer un Check avec ' + a;
    box.onclick = () => openRoller(a);
    wrap.appendChild(box);
  });
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

function escapeHtml(s){
  return (s||'').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

/* -------------------- Sidebar droite ----------------------------------- */
function renderSidebar(){
  const f = active();
  if(!f) return;

  /* Armes équipées */
  const wWrap = $('sbWeapons');
  wWrap.innerHTML = '';
  const weq = (f.weapons || []).filter(w => w.equipped);
  if(weq.length === 0){
    wWrap.innerHTML = '<div class="sb-empty">Aucune équipée</div>';
  } else {
    weq.forEach(w => {
      const wrap = document.createElement('div');
      wrap.style.marginBottom = '8px';
      const row = document.createElement('div');
      row.className = 'sb-equip';
      row.innerHTML = '<span class="eq-star">★</span>'
        + '<div class="eq-info">'
        + '<div class="eq-name">' + escapeHtml(w.nom || 'Sans nom') + '</div>'
        + '<div class="eq-meta">' + escapeHtml(buildItemMeta('weapons', w)) + '</div>'
        + '</div>';
      row.onclick = () => openItemEditor('weapons', w);
      wrap.appendChild(row);
      const atkBtn = document.createElement('button');
      atkBtn.className = 'sb-attack-btn';
      atkBtn.textContent = '⚔ ATTAQUER';
      atkBtn.onclick = (e) => { e.stopPropagation(); openAttackModal(w); };
      const actions = document.createElement('div');
      actions.className = 'sb-equip-actions';
      actions.appendChild(atkBtn);
      wrap.appendChild(actions);
      wWrap.appendChild(wrap);
    });
  }

  /* Armures équipées */
  const aWrap = $('sbArmors');
  aWrap.innerHTML = '';
  const aeq = (f.armors || []).filter(a => a.equipped);
  if(aeq.length === 0){
    aWrap.innerHTML = '<div class="sb-empty">Aucune équipée</div>';
  } else {
    aeq.forEach(a => {
      const row = document.createElement('div');
      row.className = 'sb-equip';
      row.innerHTML = '<span class="eq-star">★</span>'
        + '<div class="eq-info">'
        + '<div class="eq-name">' + escapeHtml(a.nom || 'Sans nom') + '</div>'
        + '<div class="eq-meta">' + escapeHtml(buildItemMeta('armors', a)) + '</div>'
        + '</div>';
      row.onclick = () => openItemEditor('armors', a);
      aWrap.appendChild(row);
    });
  }

  /* Total armure */
  const totalDef = aeq.reduce((a, x) => a + (x.def || 0), 0);
  $('sbTotal').textContent = totalDef > 0 ? 'TOTAL ARMURE · +' + totalDef : '';

  /* Derniers jets */
  const rWrap = $('sbRolls');
  rWrap.innerHTML = '';
  const log = (f._rollLog || []).slice(0, 5);
  if(log.length === 0){
    rWrap.innerHTML = '<div class="sb-empty">Aucun jet</div>';
  } else {
    log.forEach(r => {
      const row = document.createElement('div');
      row.className = 'sb-roll' + (r.crit ? ' crit' : '') + (r.fail ? ' fail' : '');
      row.innerHTML = '<div class="sb-r-label">' + escapeHtml(r.label) + '</div>'
        + '<div class="sb-r-result' + (r.crit ? ' crit' : '') + (r.fail ? ' fail' : '') + '">' + escapeHtml(r.result) + '</div>'
        + '<div class="sb-r-time">' + formatRelTime(r.time) + '</div>';
      rWrap.appendChild(row);
    });
  }
}

function formatRelTime(ts){
  const diff = Date.now() - ts;
  const s = Math.floor(diff / 1000);
  if(s < 60) return 'il y a ' + s + 's';
  const m = Math.floor(s / 60);
  if(m < 60) return 'il y a ' + m + ' min';
  const h = Math.floor(m / 60);
  if(h < 24) return 'il y a ' + h + ' h';
  const d = Math.floor(h / 24);
  return 'il y a ' + d + ' j';
}

function logRoll(label, result, opts){
  opts = opts || {};
  const f = active();
  f._rollLog = f._rollLog || [];
  f._rollLog.unshift({
    label, result,
    crit: !!opts.crit,
    fail: !!opts.fail,
    time: Date.now()
  });
  if(f._rollLog.length > 20) f._rollLog.length = 20;
  saveState();
  renderSidebar();
}

/* -------------------- Modal "FICHES" ----------------------------------- */
function openFichesModal(){
  renderFichesList();
  openModal('fichesModal');
}
function renderFichesList(){
  const wrap = $('fichesList');
  wrap.innerHTML = '';
  Object.values(state.fiches).forEach(f => {
    const card = document.createElement('div');
    card.className = 'fiche-card' + (f._fiche_id === state.activeId ? ' active' : '');
    const cls = (f.classes && f.classes[0])
      ? (f.classes[0].nom + ' ' + f.classes[0].niveau)
      : 'Sans classe';
    const niv = niveauTotal(f);
    card.innerHTML = '<div class="ini">' + escapeHtml((f.nom || '?').charAt(0).toUpperCase()) + '</div>'
      + '<div class="info">'
      + '<div class="nm">' + escapeHtml(f.nom || '—') + '</div>'
      + '<div class="sub">Niv. ' + niv + ' · ' + escapeHtml(cls) + (f.kin ? ' · ' + escapeHtml(f.kin) : '') + '</div>'
      + '</div>'
      + '<button class="del" title="Supprimer">×</button>';
    card.onclick = (e) => {
      if(e.target.classList.contains('del')) return;
      switchFiche(f._fiche_id);
      closeModal('fichesModal');
    };
    card.querySelector('.del').onclick = (e) => {
      e.stopPropagation();
      deleteFicheById(f._fiche_id);
    };
    wrap.appendChild(card);
  });
}

/* -------------------- Ajustement des jauges ----------------------------- */
function adjust(key, delta){
  const f = active(); if(!f) return;
  if(key === 'hp'){
    const before = f.hp_current;
    f.hp_current = Math.max(0, Math.min(f.hp_max, before + delta));
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
    if(f.wounds_current >= f.wounds_max) toast('Mort : 6 Wounds atteint.');
  }
  saveState(); render();
}

/* -------------------- MP : gains & dépenses ---------------------------- */
function gainMP(amount, reason){
  const f = active(); if(!f) return;
  const before = f.mp_current;
  f.mp_current = Math.min(f.mp_max, f.mp_current + amount);
  const real = f.mp_current - before;
  saveState(); render();
  initAudio(); sfxConfirm();
  if(real < amount && real === 0) toast('MP déjà au max (' + f.mp_max + ')');
  else toast('+' + real + ' MP · ' + reason + (real < amount ? ' (plafonné)' : ''));
}
function spendMP(amount, reason){
  const f = active(); if(!f) return;
  if(f.mp_current < amount){
    toast('Pas assez de MP (' + f.mp_current + '/' + amount + ')');
    return;
  }
  f.mp_current -= amount;
  saveState(); render();
  initAudio(); sfxConfirm();
  toast('−' + amount + ' MP · ' + reason);
}

/* -------------------- Counter (riposte défensive) ---------------------- */
function counterAttack(){
  const f = active(); if(!f) return;
  /* Cherche une arme de mêlée équipée (Blade/Breaker/Lance) */
  const melee = (f.weapons || []).filter(w =>
    w.equipped && ['Blade','Breaker','Lance'].includes(w.type)
  );
  if(melee.length === 0){
    toast('Aucune arme de mêlée équipée pour contrer (les armes Bow / sorts ne peuvent pas).');
    return;
  }
  let weapon = melee[0];
  /* Si plusieurs, prend celle au plus haut Counter Value */
  melee.forEach(w => { if((w.counter || 0) > (weapon.counter || 0)) weapon = w; });

  const primary = f.attributs[f.primary] || 0;
  const halfPrimary = Math.ceil(primary / 2); // arrondi en faveur du joueur (p.9)
  const total = (weapon.counter || 0) + halfPrimary;

  initAudio(); sfxConfirm();
  toast('↺ Counter · ' + total + ' dégâts (' + (weapon.counter || 0) + ' + ' + halfPrimary + ' ½' + f.primary + ')');
  logRoll('Counter · ' + (weapon.nom || ''),
    total + ' dégâts plats (pas de jet, pas de crit, pas de DEF break)');

  /* Mise à jour du dernier jet sur la fiche */
  const lt = $('rolltray');
  lt.innerHTML = '<span class="q">Counter · ' + escapeHtml(weapon.nom || '') + '</span>'
    + '<span class="face hit">' + total + '</span>';
  $('rollres').className = 'res';
  $('rollres').innerHTML = total + ' dégâts <span>· riposte plate</span>';
}
function floater(text, cls){
  if(opts.floaters === false) return;
  const header = $('heroHeader'), bar = $('hpbar');
  if(!bar) return;
  const f = document.createElement('span');
  f.className = 'floater ' + cls;
  f.textContent = text;
  const r = bar.getBoundingClientRect(), w = header.getBoundingClientRect();
  f.style.left = (r.left - w.left + r.width/2 - 10) + 'px';
  f.style.top  = (r.top  - w.top  - 6) + 'px';
  header.appendChild(f);
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
  f.className = 'face in' + (max >= 100 ? ' big' : '');
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

function openRollModal(title, q, sub){
  $('rmTitle').textContent = title;
  $('rmQ').textContent = q;
  $('rmSub').textContent = sub;
  $('rmTray').innerHTML = '';
  $('rmRes').className = 'roll-res-big';
  $('rmRes').textContent = '';
  $('rmOk').classList.remove('ready');
  if($('rmReroll')) $('rmReroll').style.display = 'none';
  const box = document.querySelector('#rollModal .roll-box');
  box.classList.remove('crit');
  $('rollModal').classList.add('show');
}
function closeRollModal(){
  $('rollModal').classList.remove('show');
  if(combatModeActive) renderCombatMode();
}

/* -------------------- Roller (modal unifié CHECK / DÉS LIBRES) ---------- */
function openRoller(preselect){
  selectedAttrs = (preselect && active().attributs[preselect] !== undefined) ? [preselect] : [];
  $('rollBoons').value = 0;
  $('rollBanes').value = 0;
  switchTab('check');
  renderRollerAttrs();
  updatePool();
  openModal('rollerModal');
}

function switchTab(name){
  currentTab = name;
  document.querySelectorAll('.roll-tab').forEach(t =>
    t.classList.toggle('active', t.dataset.tab === name)
  );
  document.querySelectorAll('.tab-content').forEach(c =>
    c.classList.toggle('active', c.id === 'tab-' + name)
  );
}

function renderRollerAttrs(){
  const wrap = $('rollerAttrs');
  const f = active();
  wrap.innerHTML = '';
  ['Body','Gods','Mind','Shadow','Soul','World'].forEach(a => {
    const cell = document.createElement('div');
    cell.className = 'attr-cell'
      + (f.primary === a ? ' primary' : '')
      + (selectedAttrs.includes(a) ? ' selected' : '');
    cell.innerHTML = '<span class="ac-name">' + a.slice(0,3).toUpperCase() + '</span>'
      + '<span class="ac-val">' + (f.attributs[a] || 0) + '</span>';
    cell.onclick = () => toggleAttr(a);
    wrap.appendChild(cell);
  });
}

function toggleAttr(attr){
  const i = selectedAttrs.indexOf(attr);
  if(i >= 0) selectedAttrs.splice(i, 1);
  else {
    if(selectedAttrs.length >= 2) selectedAttrs.shift();
    selectedAttrs.push(attr);
  }
  renderRollerAttrs();
  updatePool();
}

function updatePool(){
  const f = active();
  const counter = $('poolCounter');
  const hint = $('poolHint');
  const btn = $('rollerLaunchBtn');
  if(selectedAttrs.length === 0){
    counter.textContent = '0D6';
    hint.textContent = 'Sélectionne 1 ou 2 attributs';
    btn.style.opacity = '.4';
    btn.style.pointerEvents = 'none';
  } else if(selectedAttrs.length === 1){
    const v = f.attributs[selectedAttrs[0]] || 0;
    counter.textContent = Math.max(1, v * 2) + 'D6';
    hint.textContent = selectedAttrs[0] + ' ×2 (attribut seul)';
    btn.style.opacity = '1';
    btn.style.pointerEvents = '';
  } else {
    const v = (f.attributs[selectedAttrs[0]] || 0) + (f.attributs[selectedAttrs[1]] || 0);
    counter.textContent = Math.max(1, v) + 'D6';
    hint.textContent = selectedAttrs[0] + ' + ' + selectedAttrs[1];
    btn.style.opacity = '1';
    btn.style.pointerEvents = '';
  }
}

function addBoonViaMP(){
  const f = active(); if(!f) return;
  if(f.mp_current < 1){ toast('Pas assez de MP (besoin de 1)'); return; }
  f.mp_current -= 1;
  const cur = parseInt($('rollBoons').value) || 0;
  $('rollBoons').value = Math.min(5, cur + 1);
  saveState(); render();
  initAudio(); sfxConfirm();
  toast('−1 MP · +1 Boon ajouté à ce jet');
}

let lastCheck = null;

function runCheck(){
  if(selectedAttrs.length === 0) return;
  const boons = parseInt($('rollBoons').value) || 0;
  const banes = parseInt($('rollBanes').value) || 0;
  closeModal('rollerModal');
  _doCheck(selectedAttrs.slice(), boons, banes);
}

function rerollCheck(){
  const f = active();
  if(!lastCheck) return;
  if(f.mp_current < 2){ toast('Pas assez de MP (besoin de 2)'); return; }
  f.mp_current -= 2;
  saveState(); render();
  initAudio(); sfxConfirm();
  toast('−2 MP · relance du dernier Check');
  closeRollModal();
  setTimeout(() => _doCheck(lastCheck.attrs, lastCheck.boons, lastCheck.banes), 280);
}

function _doCheck(attrs, boons, banes){
  const f = active();
  lastCheck = { attrs: attrs.slice(), boons, banes };

  let n, label;
  if(attrs.length === 1){
    const a = attrs[0];
    const v = f.attributs[a] || 0;
    n = Math.max(1, v * 2);
    label = a + ' (×2)';
  } else {
    const a = attrs[0], b = attrs[1];
    const va = f.attributs[a] || 0;
    const vb = f.attributs[b] || 0;
    n = Math.max(1, va + vb);
    label = a + ' + ' + b;
  }
  const net = boons - banes;
  const netLbl = net > 0 ? ' · Boon ' + net : (net < 0 ? ' · Bane ' + (-net) : '');

  initAudio(); sfxConfirm();
  openRollModal('JET DE CHECK', label.toUpperCase(), n + 'd6' + netLbl);

  const dice = [];
  for(let i = 0; i < n; i++) dice.push(rollD(6));

  const tray = $('rmTray');
  const STAG = 180, ROLL = 600;
  const faces = dice.map((d, i) => spawnDie(tray, d, i*STAG, ROLL, 6));

  dice.forEach((d, i) => {
    setTimeout(() => {
      if(d >= 5){ faces[i].classList.add('hit'); beep(880 + (d-5)*220, .08); }
    }, i*STAG + ROLL + 220);
  });

  const lastSettle = (n-1)*STAG + ROLL + 220;
  let netRemaining = net;
  const applyBoonBane = () => {
    if(netRemaining === 0){ finishCheck(dice, label); return; }
    let changed = false;
    if(netRemaining > 0){
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
      } else { netRemaining = 0; }
    } else {
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
      } else { netRemaining = 0; }
    }
    if(changed) setTimeout(applyBoonBane, 600);
    else finishCheck(dice, label);
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
  const isCrit = succ >= 4;
  const isFail = succ === 0;
  if(isCrit){
    sfxCrit();
    const box = document.querySelector('#rollModal .roll-box');
    box.classList.remove('crit'); void box.offsetWidth; box.classList.add('crit');
  }
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

  logRoll('Check · ' + label, succ + ' succès · ' + tier, { crit: isCrit, fail: isFail });

  /* Option de relance via MP (2 MP) */
  if($('rmReroll')){
    const f = active();
    $('rmReroll').style.display = (f && f.mp_current >= 2) ? '' : 'none';
  }
}

function rollClassDie(){
  const f = active();
  const cd = getClassDie(f);
  initAudio(); sfxConfirm();
  openRollModal('DÉ DE CLASSE', classDieLabel(cd), 'Primary : ' + f.primary);
  const dice = [];
  for(let i = 0; i < cd.count; i++) dice.push(rollD(cd.size));
  showDiceSum(dice, cd.size, cd.bonus, 'Dé de Classe', () => {
    const die = $('cddie');
    die.classList.remove('pop'); void die.offsetWidth; die.classList.add('pop');
  });
}

function showDiceSum(dice, size, bonus, label, onDone){
  const tray = $('rmTray');
  const STAG = 200, ROLL = 660;
  dice.forEach((d, i) => spawnDie(tray, d, i*STAG, ROLL, size));
  dice.forEach((d, i) => setTimeout(() => beep(660 + i*100, .07), i*STAG + ROLL + 120));
  const lastSettle = (dice.length - 1) * STAG + ROLL + 120;
  setTimeout(() => {
    const total = dice.reduce((a,b) => a+b, 0) + (bonus || 0);
    const detail = dice.join(' + ') + (bonus ? ' + ' + bonus : '');
    const res = $('rmRes');
    res.className = 'roll-res-big banner';
    res.innerHTML = 'TOTAL ' + total
      + (dice.length > 1 || bonus ? '<small>' + detail + '</small>' : '');
    $('rmOk').classList.add('ready');
    const lt = $('rolltray');
    lt.innerHTML = '<span class="q">' + escapeHtml(label) + '</span>';
    dice.forEach(d => {
      const f = document.createElement('span');
      f.className = 'face' + (size >= 100 ? ' big' : '');
      f.textContent = d;
      lt.appendChild(f);
    });
    const lr = $('rollres');
    lr.className = 'res';
    lr.innerHTML = 'Total ' + total;
    if(onDone) onDone();
    logRoll(label, 'Total ' + total);
  }, lastSettle + 500);
}

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
    logRoll('Soin CD', '+' + heal + ' HP');
  }, lastSettle + 500);
}

function changeMult(delta){
  diceMult = Math.max(1, Math.min(10, diceMult + delta));
  $('freeMultLabel').textContent = '×' + diceMult;
}
function rollFreeDie(size){
  initAudio(); sfxConfirm();
  closeModal('rollerModal');
  const label = diceMult + 'd' + size;
  openRollModal('DÉS LIBRES', label.toUpperCase(), '');
  const dice = [];
  for(let i = 0; i < diceMult; i++) dice.push(rollD(size));
  showDiceSum(dice, size, 0, label);
}

/* -------------------- Repos court --------------------------------------- */
function shortRest(){
  const f = active();
  if(f.short_rests_taken >= f.short_rests_max){
    if(!confirm('Tu as déjà pris ' + f.short_rests_max + ' Repos courts ce Downtime. Continuer quand même ?')) return;
  } else {
    if(!confirm('Prendre un Repos court ?\n\n• Retire 1 Wound\n• Soin du Dé de Classe réinitialisé\n• Limit Break refresh\n• +SP égal à un jet du Dé de Classe')) return;
  }
  const cd = getClassDie(f);
  const dice = [];
  for(let i = 0; i < cd.count; i++) dice.push(rollD(cd.size));
  const spGain = dice.reduce((a,b) => a+b, 0) + cd.bonus;
  f.sp_current = Math.min(f.sp_max, f.sp_current + spGain);
  const woundsBefore = f.wounds_current;
  f.wounds_current = Math.max(0, f.wounds_current - 1);
  f.class_die_recovery_used = false;
  f.limit_break_used = false;
  f.short_rests_taken++;
  saveState(); render();
  initAudio(); sfxLevel();
  const woundTxt = woundsBefore > 0 ? ' · −1 Wound' : '';
  toast('Repos court · +' + spGain + ' SP' + woundTxt + ' · Limit Break refresh');
  logRoll('Repos court', '+' + spGain + ' SP' + woundTxt);
}

function downtime(){
  const f = active();
  if(!confirm('Prendre un Downtime (24 h) ?\n\n• HP, SP et DEF au maximum\n• Toutes les Wounds effacées\n• Repos courts remis à 3\n• Limit Break et soin du Dé de Classe refresh\n\n(Les MP sont conservés)')) return;
  f.hp_current = f.hp_max;
  f.sp_current = f.sp_max;
  f.defense_current = f.defense_max;
  f.wounds_current = 0;
  f.short_rests_taken = 0;
  f.class_die_recovery_used = false;
  f.limit_break_used = false;
  saveState(); render();
  initAudio(); sfxLevel();
  toast('Downtime · récupération complète');
  logRoll('Downtime', 'Récupération complète');
}

/* -------------------- Niveau supérieur --------------------------------- */
function levelUp(){
  const f = active();
  if(!f.classes || f.classes.length === 0){
    alert('Ajoute d\'abord une classe via les chips en haut de la fiche.');
    return;
  }
  /* Cible la première Major Class, sinon la première classe tout court */
  const c = f.classes.find(x => x.type === 'major') || f.classes[0];
  const newLevel = c.niveau + 1;
  const oldTotal = niveauTotal(f);
  const newTotal = oldTotal + 1;
  const oldCDSize = classDieSize(oldTotal);
  const newCDSize = classDieSize(newTotal);

  const gains = [];
  gains.push({ k: 'CLASSE', v: c.nom + ' ' + c.niveau + ' → ' + newLevel });
  if(f.classes.length + (f.jobs || []).length > 1){
    gains.push({ k: 'NOTE', v: 'pour d\'autres classes : leur chip' });
  }
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
  $('lvlOverlay').dataset.targetClassId = c.id || '';
  openModal('lvlOverlay');
  initAudio(); sfxLevel();
}
function applyLevelUp(){
  const f = active();
  const targetId = $('lvlOverlay').dataset.targetClassId;
  const c = targetId
    ? f.classes.find(x => x.id === targetId)
    : (f.classes.find(x => x.type === 'major') || f.classes[0]);
  if(!c){ closeModal('lvlOverlay'); return; }
  c.niveau++;
  saveState(); render();
  closeModal('lvlOverlay');
  toast('Niveau appliqué. Ouvre Éditer (PLUS) pour assigner ton +1 attribut et tes choix.');
}

/* -------------------- Édition de fiche --------------------------------- */
function openEdit(){
  const f = active();
  $('edNom').value     = f.nom || '';
  $('edKin').value     = f.kin || '';
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
          alert('Cette fiche vient de Drakonym Compagnon. L\'import auto Drakonym→LOA arrive dans une prochaine phase. Crée une fiche LOA neuve pour l\'instant.');
          return;
        }
        if(!confirm('Format inconnu (' + data._format + '). Tenter quand même l\'import ?')) return;
      }
      const f = data.fiche || data;
      f._fiche_id = newId();
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

/* -------------------- Modals (helpers) --------------------------------- */
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
      + '<span class="sw" style="width:36px;height:20px;border-radius:11px;background:'
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

/* -------------------- Inventaire & Apprentissages ---------------------- */
const INV_CATS = {
  perks:    { label: 'PERKS',    field: 'perks',    defaultColor: 'blue' },
  sorts:    { label: 'SORTS',    field: 'sorts',    defaultColor: 'pink' },
  melodies: { label: 'MELODIES', field: 'melodies', defaultColor: 'gold' },
  moments:  { label: 'MOMENTS',  field: 'moments',  defaultColor: 'gold' },
  ways:     { label: 'WAYS',     field: 'ways',     defaultColor: 'teal' },
  tones:    { label: 'TONES',    field: 'tones',    defaultColor: 'purple' },
  weapons:  { label: 'ARMES',    field: 'weapons',  defaultColor: 'red'  },
  armors:   { label: 'ARMURES',  field: 'armors',   defaultColor: 'blue' },
  tools:    { label: 'OBJETS',   field: 'tools',    defaultColor: 'teal' }
};
const ITEM_COLORS = ['blue','gold','teal','pink','red','green','purple','gray'];

const CAPA_KEYS  = ['perks', 'sorts', 'melodies', 'moments', 'ways', 'tones'];
const EQUIP_KEYS = ['weapons', 'armors', 'tools'];

function renderInventoryPages(){
  renderInvSection('capacites', CAPA_KEYS,  currentInvCapa,  'capaTabs',  'capaList');
  renderInvSection('equipement', EQUIP_KEYS, currentInvEquip, 'equipTabs', 'equipList');
}

function renderInvSection(page, keys, currentKey, tabsId, listId){
  const f = active();
  const tabsWrap = $(tabsId);
  const listWrap = $(listId);

  tabsWrap.innerHTML = '';
  keys.forEach(key => {
    const cfg = INV_CATS[key];
    const tab = document.createElement('button');
    tab.className = 'inv-tab' + (currentKey === key ? ' active' : '');
    const count = (f[cfg.field] || []).length;
    tab.textContent = cfg.label + (count > 0 ? ' (' + count + ')' : '');
    tab.onclick = () => {
      if(page === 'capacites') currentInvCapa = key;
      else currentInvEquip = key;
      renderInventoryPages();
    };
    tabsWrap.appendChild(tab);
  });

  listWrap.innerHTML = '';
  const cfg = INV_CATS[currentKey];
  const items = f[cfg.field] || [];
  if(items.length === 0){
    const empty = document.createElement('div');
    empty.className = 'empty-hint';
    empty.textContent = 'Aucun élément dans ' + cfg.label.toLowerCase() + '.';
    listWrap.appendChild(empty);
  } else {
    items.forEach(item => listWrap.appendChild(renderItemCard(currentKey, item)));
  }

  const addBtn = document.createElement('button');
  addBtn.className = 'add-item-btn';
  let addLabel = '+ AJOUTER';
  if(currentKey === 'melodies')   addLabel = '+ AJOUTER UNE MÉLODIE';
  else if(currentKey === 'weapons') addLabel = '+ AJOUTER UNE ARME';
  else if(currentKey === 'armors')  addLabel = '+ AJOUTER UNE ARMURE';
  else if(currentKey === 'tools')   addLabel = '+ AJOUTER UN OBJET';
  else if(currentKey === 'sorts')   addLabel = '+ AJOUTER UN SORT';
  else if(currentKey === 'perks')   addLabel = '+ AJOUTER UN PERK';
  else if(currentKey === 'moments') addLabel = '+ AJOUTER UN MOMENT';
  else if(currentKey === 'ways')    addLabel = '+ AJOUTER UN WAY';
  else if(currentKey === 'tones')   addLabel = '+ AJOUTER UN TONE';
  addBtn.textContent = addLabel;
  addBtn.onclick = () => openItemEditor(currentKey, null);
  /* Le bouton add doit s'étendre sur 2 colonnes */
  addBtn.style.gridColumn = '1 / -1';
  listWrap.appendChild(addBtn);
}

function renderItemCard(cat, item){
  /* Carte compacte façon Drakonym : couleur + titre + meta + étoile (armes/armures) + chevron */
  const card = document.createElement('div');
  card.className = 'item-card';
  card.onclick = () => openItemEditor(cat, item);

  const colorBar = document.createElement('div');
  colorBar.className = 'ic-color';
  colorBar.setAttribute('data-c', item.color || 'gray');
  card.appendChild(colorBar);

  const body = document.createElement('div');
  body.className = 'ic-body';

  const title = document.createElement('div');
  title.className = 'ic-title';
  const qty = (item.quantity && item.quantity > 1) ? ' ×' + item.quantity : '';
  title.innerHTML = escapeHtml(item.titre || item.nom || 'Sans nom') + qty;
  body.appendChild(title);

  const metaTxt = buildItemMeta(cat, item);
  if(metaTxt){
    const m = document.createElement('div');
    m.className = 'ic-meta';
    m.textContent = metaTxt;
    body.appendChild(m);
  }

  card.appendChild(body);

  /* Étoile équipée (armes et armures uniquement) */
  if(cat === 'weapons' || cat === 'armors'){
    const star = document.createElement('button');
    star.className = 'ic-equip' + (item.equipped ? ' on' : '');
    star.textContent = item.equipped ? '★' : '☆';
    star.title = item.equipped ? 'Déséquiper' : 'Équiper';
    star.onclick = (e) => {
      e.stopPropagation();
      toggleEquipped(cat, item.id);
    };
    card.appendChild(star);
  }

  const chev = document.createElement('span');
  chev.className = 'ic-chev';
  chev.textContent = '▶';
  card.appendChild(chev);

  return card;
}

function buildItemMeta(cat, item){
  if(cat === 'sorts'){
    const bits = [];
    if(item.sp_cost) bits.push('SP ' + item.sp_cost);
    if(item.ap_cost) bits.push('AP ' + item.ap_cost);
    if(item.aspect) bits.push(item.aspect);
    return bits.join(' · ');
  }
  if(cat === 'melodies'){
    return 'MP ' + (item.mp_cost || 3);
  }
  if(cat === 'weapons'){
    const bits = [];
    if(item.type) bits.push(item.type);
    if(item.damage) bits.push(item.damage);
    if(item.counter) bits.push('CV ' + item.counter);
    return bits.join(' · ');
  }
  if(cat === 'armors'){
    const bits = [];
    if(item.category) bits.push(item.category);
    if(item.def) bits.push('DEF ' + item.def);
    return bits.join(' · ');
  }
  if(cat === 'tools'){
    const bits = [];
    if(item.draviks) bits.push(item.draviks + ' Draviks');
    if(item.attribute) bits.push(item.attribute);
    return bits.join(' · ');
  }
  return '';
}

function toggleEquipped(cat, id){
  const f = active();
  const item = (f[INV_CATS[cat].field] || []).find(i => i.id === id);
  if(!item) return;
  item.equipped = !item.equipped;
  saveState(); render();
}

function openItemEditor(cat, item){
  editingItem = { cat, item: item || {}, isNew: !item };
  const cfg = INV_CATS[cat];
  $('itemModalTitle').textContent = (item ? 'ÉDITER · ' : 'NOUVEAU · ') + cfg.label;

  const src = item || {};
  $('itemTitle').value = src.titre || src.nom || '';
  $('itemDesc').value = src.description || '';

  const cp = $('colorPicker');
  cp.innerHTML = '';
  ITEM_COLORS.forEach(c => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'color-pick' + ((src.color || cfg.defaultColor) === c ? ' active' : '');
    b.setAttribute('data-c', c);
    b.onclick = () => {
      cp.querySelectorAll('.color-pick').forEach(p => p.classList.remove('active'));
      b.classList.add('active');
    };
    cp.appendChild(b);
  });

  ['Sort','Melody','Weapon','Armor','Tool'].forEach(t => $('item' + t + 'Fields').style.display = 'none');

  if(cat === 'sorts'){
    $('itemSortFields').style.display = '';
    $('itemAspect').value = src.aspect || '';
    $('itemSP').value = src.sp_cost || 0;
    $('itemAP').value = src.ap_cost || 0;
  } else if(cat === 'melodies'){
    $('itemMelodyFields').style.display = '';
    $('itemMP').value = src.mp_cost || 3;
  } else if(cat === 'weapons'){
    $('itemWeaponFields').style.display = '';
    $('itemWType').value = src.type || 'Blade';
    $('itemWHands').value = src.hands || 1;
    $('itemWRange').value = src.range || 'Near';
    $('itemWDamage').value = src.damage || '';
    $('itemWCounter').value = src.counter || 0;
    $('itemWProperties').value = src.properties || '';
    $('itemWBaseCount').value = src.base_die_count || 1;
    $('itemWBaseSize').value = src.base_die_size || 8;
    $('itemWFlat').value = src.flat_bonus || 0;
    $('itemWAddPrimary').value = (src.add_primary === false) ? '0' : '1';
    $('itemWDmgType').value = src.damage_type || 'Physical';
  } else if(cat === 'armors'){
    $('itemArmorFields').style.display = '';
    $('itemAcat').value = src.category || 'Light';
    $('itemADef').value = src.def || 0;
    $('itemAMinBody').value = src.min_body || 0;
    $('itemAProperties').value = src.properties || '';
  } else if(cat === 'tools'){
    $('itemToolFields').style.display = '';
    $('itemToolQty').value = src.quantity || 1;
    $('itemToolDraviks').value = src.draviks || 0;
    $('itemToolAttribute').value = src.attribute || '';
  }

  $('itemDeleteBtn').style.display = editingItem.isNew ? 'none' : '';

  /* Barre d'action de combat (ATTAQUER / LANCER / JOUER) */
  const bar = $('itemActionBar');
  bar.innerHTML = '';
  bar.style.display = 'none';
  if(!editingItem.isNew){
    if(cat === 'weapons'){
      const b = document.createElement('button');
      b.textContent = '⚔ ATTAQUER';
      b.onclick = () => { closeModal('itemModal'); openAttackModal(item); };
      bar.appendChild(b);
      bar.style.display = '';
    } else if(cat === 'sorts'){
      const b = document.createElement('button');
      b.className = 'cast';
      const cost = item.sp_cost || 0;
      b.textContent = '✦ LANCER (SP ' + cost + ')';
      b.onclick = () => { closeModal('itemModal'); castSpell(item); };
      bar.appendChild(b);
      bar.style.display = '';
    } else if(cat === 'melodies'){
      const b = document.createElement('button');
      b.className = 'melody';
      const cost = item.mp_cost || 3;
      b.textContent = '♪ JOUER (MP ' + cost + ')';
      b.onclick = () => { closeModal('itemModal'); playMelody(item); };
      bar.appendChild(b);
      bar.style.display = '';
    }
  }

  openModal('itemModal');
}

function saveItem(){
  if(!editingItem) return;
  const { cat, item, isNew } = editingItem;
  const cfg = INV_CATS[cat];
  const f = active();
  if(isNew) item.id = newId();

  const titleField = (cat === 'perks' || cat === 'sorts' || cat === 'melodies'
                    || cat === 'moments' || cat === 'ways' || cat === 'tones') ? 'titre' : 'nom';
  item[titleField] = $('itemTitle').value.trim() || 'Sans nom';
  item.description = $('itemDesc').value.trim();
  const activeColor = $('colorPicker').querySelector('.color-pick.active');
  item.color = activeColor ? activeColor.getAttribute('data-c') : cfg.defaultColor;

  if(cat === 'sorts'){
    item.aspect = $('itemAspect').value.trim();
    item.sp_cost = parseInt($('itemSP').value) || 0;
    item.ap_cost = parseInt($('itemAP').value) || 0;
  } else if(cat === 'melodies'){
    item.mp_cost = parseInt($('itemMP').value) || 3;
  } else if(cat === 'weapons'){
    item.type = $('itemWType').value;
    item.hands = parseInt($('itemWHands').value) || 1;
    item.range = $('itemWRange').value;
    item.damage = $('itemWDamage').value.trim();
    item.counter = parseInt($('itemWCounter').value) || 0;
    item.properties = $('itemWProperties').value.trim();
    item.base_die_count = parseInt($('itemWBaseCount').value) || 1;
    item.base_die_size  = parseInt($('itemWBaseSize').value) || 8;
    item.flat_bonus     = parseInt($('itemWFlat').value) || 0;
    item.add_primary    = $('itemWAddPrimary').value === '1';
    item.damage_type    = $('itemWDmgType').value || 'Physical';
    if(item.equipped === undefined) item.equipped = false;
  } else if(cat === 'armors'){
    item.category = $('itemAcat').value;
    item.def = parseInt($('itemADef').value) || 0;
    item.min_body = parseInt($('itemAMinBody').value) || 0;
    item.properties = $('itemAProperties').value.trim();
    if(item.equipped === undefined) item.equipped = false;
  } else if(cat === 'tools'){
    item.quantity = parseInt($('itemToolQty').value) || 1;
    item.draviks = parseInt($('itemToolDraviks').value) || 0;
    item.attribute = $('itemToolAttribute').value.trim();
  }

  if(isNew){
    f[cfg.field] = f[cfg.field] || [];
    f[cfg.field].push(item);
  }
  saveState();
  closeModal('itemModal');
  render();
  toast((isNew ? 'Ajouté' : 'Enregistré') + ' : ' + (item.titre || item.nom));
}

function deleteItem(){
  if(!editingItem || editingItem.isNew){ closeModal('itemModal'); return; }
  const { cat, item } = editingItem;
  if(!confirm('Supprimer « ' + (item.titre || item.nom) + ' » ?')) return;
  const f = active();
  f[INV_CATS[cat].field] = (f[INV_CATS[cat].field] || []).filter(i => i.id !== item.id);
  saveState();
  closeModal('itemModal');
  render();
  toast('Supprimé');
}

/* -------------------- Combat : Attaque, Triangle, Affinity -------------- */
let attackCtx = null;

/* Triangle d'armes (Blade > Breaker > Lance > Blade, Bow hors triangle) */
function weaponTriangle(my, opp){
  if(!my || !opp) return 'none';
  if(my === 'Bow' || opp === 'Bow') return 'out';
  if(my === opp) return 'equal';
  const wins = { Blade: 'Breaker', Breaker: 'Lance', Lance: 'Blade' };
  if(wins[my] === opp) return 'advantage';
  return 'disadvantage';
}

function openAttackModal(weapon){
  attackCtx = { weapon, oppType: '' };
  const f = active();
  const baseSize  = weapon.base_die_size || 8;
  const baseCount = weapon.base_die_count || 1;
  const flat      = weapon.flat_bonus || 0;
  const addPrim   = weapon.add_primary !== false;
  const primary   = addPrim ? (f.attributs[f.primary] || 0) : 0;
  const dmgType   = weapon.damage_type || 'Physical';

  /* Formule lisible */
  let formula = baseCount + 'd' + baseSize;
  if(flat) formula += ' + ' + flat;
  if(addPrim) formula += ' + <b>' + f.primary + '</b>(' + primary + ')';

  $('atkTitle').textContent = 'ATTAQUER · ' + (weapon.nom || 'ARME');
  $('atkWeaponInfo').innerHTML = formula + ' · <b>' + escapeHtml(dmgType) + '</b>'
    + '<br><span style="opacity:.7">' + escapeHtml(weapon.type || '—') + ' · ' + escapeHtml(weapon.range || 'Near') + '</span>';

  /* Reset */
  document.querySelectorAll('.opp-type-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.type === '');
    b.onclick = () => setOppType(b.dataset.type);
  });
  $('atkDef').value = 0;
  $('atkAffinity').value = 'normal';
  updateTriangleDisplay();

  openModal('attackModal');
}

function setOppType(type){
  attackCtx.oppType = type;
  document.querySelectorAll('.opp-type-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.type === type)
  );
  updateTriangleDisplay();
}

function updateTriangleDisplay(){
  const my = attackCtx.weapon.type;
  const opp = attackCtx.oppType;
  const adv = weaponTriangle(my, opp);
  const ind = $('atkTriangle');
  const base = attackCtx.weapon.base_die_size || 8;
  if(opp === ''){
    ind.className = 'atk-triangle equal';
    ind.textContent = '— SÉLECTIONNE L\'ARME ADVERSE —';
  } else if(adv === 'advantage'){
    ind.className = 'atk-triangle advantage';
    ind.textContent = '★ AVANTAGE · CRIT BASE DIE ÉTENDU À ' + (base-1) + '-' + base;
  } else if(adv === 'disadvantage'){
    ind.className = 'atk-triangle disadvantage';
    ind.textContent = '▼ DÉSAVANTAGE · AUCUN EFFET';
  } else if(adv === 'equal'){
    ind.className = 'atk-triangle equal';
    ind.textContent = '= ÉGALITÉ · AUCUN BONUS';
  } else if(adv === 'out'){
    ind.className = 'atk-triangle equal';
    ind.textContent = '○ HORS TRIANGLE (Bow) · AUCUN BONUS';
  }
}

function executeAttack(){
  const w = attackCtx.weapon;
  const f = active();
  const opp = {
    type:      attackCtx.oppType,
    def:       parseInt($('atkDef').value) || 0,
    affinity:  $('atkAffinity').value
  };
  const adv = weaponTriangle(w.type, opp.type);
  closeModal('attackModal');

  const result = doAttackResolve(w, opp, adv, f);
  showAttackResult(w, opp, result, adv);
}

function doAttackResolve(weapon, opp, triangleAdv, fiche){
  const base      = weapon.base_die_size || 8;
  const baseCount = weapon.base_die_count || 1;
  const flat      = weapon.flat_bonus || 0;
  const addPrim   = weapon.add_primary !== false;
  const primary   = addPrim ? (fiche.attributs[fiche.primary] || 0) : 0;

  /* Premier jet du Base Die */
  const baseRolls = [];
  const firstRoll = rollD(base);
  baseRolls.push(firstRoll);

  /* MISS sur 1 */
  if(firstRoll === 1){
    return { miss: true, baseRolls };
  }

  /* CRIT : max ou (avec Triangle avantage) max-1 sur le PREMIER jet uniquement */
  const isFirstCrit = (firstRoll === base) || (triangleAdv === 'advantage' && firstRoll === base - 1);

  /* Si crit, on relance le Base Die. Les jets suivants n'ont PAS le bonus Triangle. */
  if(isFirstCrit){
    let extra = rollD(base);
    baseRolls.push(extra);
    /* Explosion en chaîne tant qu'on fait max (normal range) */
    while(extra === base){
      extra = rollD(base);
      baseRolls.push(extra);
    }
  }

  /* Dés de base additionnels (e.g. 2d8) — pas d'explosion sur ceux-ci */
  const addlRolls = [];
  for(let i = 1; i < baseCount; i++){
    addlRolls.push(rollD(base));
  }

  /* Somme */
  const baseSum = baseRolls.reduce((a,b) => a+b, 0);
  const addlSum = addlRolls.reduce((a,b) => a+b, 0);
  const rawDamage = baseSum + addlSum + flat + primary;

  /* DEF */
  const afterDef = Math.max(0, rawDamage - opp.def);
  const defBroken = opp.def > 0 && rawDamage >= opp.def;

  /* Affinity (après DEF) — table p.134 : Weak double, Resist ÷2 arrondi bas, Immune 0 */
  let finalDamage = afterDef;
  if(opp.affinity === 'weak')        finalDamage = afterDef * 2;
  else if(opp.affinity === 'resist') finalDamage = Math.floor(afterDef / 2);
  else if(opp.affinity === 'immune') finalDamage = 0;

  return {
    miss: false,
    crit: isFirstCrit,
    baseRolls,
    addlRolls,
    flat, primary,
    primaryAttr: fiche.primary,
    rawDamage,
    afterDef,
    defBroken,
    affinity: opp.affinity,
    finalDamage,
    counterValue: weapon.counter || 0
  };
}

function showAttackResult(weapon, opp, result, triangleAdv){
  const base = weapon.base_die_size || 8;
  initAudio(); sfxConfirm();

  const subtitle = (weapon.damage_type || 'Physical')
    + (opp.type ? ' · vs ' + opp.type : '')
    + (triangleAdv === 'advantage' ? ' · ★' : '');
  openRollModal('ATTAQUE · ' + (weapon.nom || ''), 'BASE ' + (weapon.base_die_count || 1) + 'd' + base, subtitle);

  const tray = $('rmTray');
  const STAG = 180, ROLL = 600;
  const allValues = [...result.baseRolls, ...result.addlRolls];
  const faces = allValues.map((v, i) => spawnDie(tray, v, i * STAG, ROLL, base));

  /* Hit/miss markers */
  result.baseRolls.forEach((v, i) => {
    setTimeout(() => {
      if(result.miss && i === 0){
        faces[i].style.background = '#e0533a';
        faces[i].style.color = '#fff';
      } else if(v === base || (i === 0 && result.crit && v === base - 1)){
        faces[i].classList.add('hit');
        beep(990 + i*100, .08);
      }
    }, i * STAG + ROLL + 220);
  });

  const lastSettle = allValues.length * STAG + ROLL + 220;
  setTimeout(() => {
    const res = $('rmRes');
    if(result.miss){
      res.className = 'roll-res-big banner';
      res.innerHTML = 'COUP MANQUÉ<small>1 SUR LE BASE DIE</small>';
      $('rmOk').classList.add('ready');
      logRoll('Attaque · ' + (weapon.nom || ''), 'MISS', { fail: true });
      const lt = $('rolltray');
      lt.innerHTML = '<span class="q">Attaque · ' + escapeHtml(weapon.nom || '') + '</span>'
        + '<span class="face" style="background:#e0533a">1</span>';
      $('rollres').className = 'res';
      $('rollres').innerHTML = '<span>Coup manqué</span>';
      return;
    }

    /* Construction du breakdown */
    let bd = '<b>' + result.baseRolls.join(' + ') + '</b>';
    if(result.crit) bd += ' <span style="color:var(--accent)">✦CRIT</span>';
    if(result.addlRolls.length) bd += ' + ' + result.addlRolls.join(' + ');
    if(result.flat) bd += ' + ' + result.flat;
    if(result.primary) bd += ' + ' + result.primary + ' (' + result.primaryAttr + ')';
    bd += ' = <b>' + result.rawDamage + '</b>';
    if(opp.def) bd += '<br>DEF −' + opp.def + ' → <b>' + result.afterDef + '</b>';
    if(result.defBroken) bd += ' <span style="color:#ff8a6a">✦ DEF BROKEN</span>';
    if(result.affinity === 'weak')        bd += '<br>Weak ×2 → <b>' + result.finalDamage + '</b>';
    else if(result.affinity === 'resist') bd += '<br>Resist ÷2 → <b>' + result.finalDamage + '</b>';
    else if(result.affinity === 'immune') bd += '<br>Immune → <b>0</b>';

    res.className = 'roll-res-big banner';
    res.innerHTML = result.finalDamage + ' DÉGÂTS' + (result.crit ? ' ✦' : '')
      + '<small>' + bd + '</small>';
    $('rmOk').classList.add('ready');

    if(result.crit){
      sfxCrit();
      const box = document.querySelector('#rollModal .roll-box');
      box.classList.remove('crit'); void box.offsetWidth; box.classList.add('crit');
    }

    /* Log + dernier jet sur la fiche */
    const summary = result.finalDamage + ' dégâts'
      + (result.crit ? ' (crit)' : '')
      + (result.defBroken ? ' · DEF Broken' : '');
    logRoll('Attaque · ' + (weapon.nom || ''), summary, { crit: result.crit });

    const lt = $('rolltray');
    lt.innerHTML = '<span class="q">Attaque · ' + escapeHtml(weapon.nom || '') + '</span>';
    result.baseRolls.forEach((v, i) => {
      const f = document.createElement('span');
      f.className = 'face' + (v === base ? ' hit' : '');
      f.textContent = v;
      lt.appendChild(f);
    });
    result.addlRolls.forEach(v => {
      const f = document.createElement('span');
      f.className = 'face';
      f.textContent = v;
      lt.appendChild(f);
    });
    $('rollres').className = 'res';
    $('rollres').innerHTML = result.finalDamage + ' dégâts <span>'
      + (result.crit ? '· CRIT ' : '')
      + (result.defBroken ? '· DEF Break' : '') + '</span>';
  }, lastSettle + 600);
}

/* -------------------- Limit Break -------------------------------------- */
function openLimitBreak(){
  const f = active();
  if(f.limit_break_used){
    toast('Limit Break déjà utilisé. Prends un Repos court pour le récupérer.');
    return;
  }
  const isOverdrive = f.hp_current > 0 && f.hp_current < f.hp_max / 2;
  $('lbInfo').innerHTML = isOverdrive
    ? '<b style="color:var(--accent)">★ OVERDRIVE actif</b><br>Les dégâts et effets de ton Limit Break sont <b>doublés</b>. Il sera consommé même si la rencontre se termine.'
    : 'HP au-dessus de 50%. Effet normal. Restauré au prochain Repos court.';
  $('lbDesc').value = '';
  openModal('limitBreakModal');
}
function confirmLimitBreak(){
  const f = active();
  const desc = $('lbDesc').value.trim();
  f.limit_break_used = true;
  const isOverdrive = f.hp_current > 0 && f.hp_current < f.hp_max / 2;
  saveState();
  closeModal('limitBreakModal');
  render();
  initAudio(); sfxLevel();
  toast('★ LIMIT BREAK ' + (isOverdrive ? '(Overdrive ×2)' : '') + ' — décris ton coup');
  logRoll('★ Limit Break' + (isOverdrive ? ' (Overdrive)' : ''),
    desc || 'Coup spécial', { crit: true });
}

/* -------------------- Sorts (auto-déduction SP) ------------------------ */
function castSpell(sort){
  const f = active();
  const cost = sort.sp_cost || 0;
  if(f.sp_current < cost){
    toast('Pas assez de SP (' + f.sp_current + '/' + cost + ')');
    return;
  }
  if(!confirm('Lancer ' + (sort.titre || 'le sort') + ' ? (-' + cost + ' SP)')) return;
  f.sp_current = Math.max(0, f.sp_current - cost);
  saveState(); render();
  toast('✦ ' + (sort.titre || 'Sort') + ' lancé · −' + cost + ' SP');
  logRoll('Sort · ' + (sort.titre || ''), '−' + cost + ' SP');
  /* Si le sort a un Aspect, on ouvre le Check builder pré-rempli (Battlecast) */
  if(sort.aspect){
    const aspectAttr = aspectAttribute(sort.aspect);
    if(aspectAttr){
      setTimeout(() => openRoller(aspectAttr), 300);
    }
  }
}
function aspectAttribute(aspect){
  const map = {
    'Arcanum': 'Mind', 'Divine': 'Gods', 'Inheric': 'Body',
    'Radiant': 'Soul', 'Untamed': 'World', 'Voidcraft': 'Shadow'
  };
  return map[aspect] || null;
}

/* -------------------- Mélodies (auto-déduction MP) --------------------- */
function playMelody(melody){
  const f = active();
  const cost = melody.mp_cost || 3;
  if(f.mp_current < cost){
    toast('Pas assez de MP (' + f.mp_current + '/' + cost + ')');
    return;
  }
  if(!confirm('Jouer ' + (melody.titre || 'la mélodie') + ' ? (-' + cost + ' MP)')) return;
  f.mp_current = Math.max(0, f.mp_current - cost);
  saveState(); render();
  toast('♪ ' + (melody.titre || 'Mélodie') + ' jouée · −' + cost + ' MP');
  logRoll('Mélodie · ' + (melody.titre || ''), '−' + cost + ' MP');
}

/* -------------------- Classes & Jobs (multiclasse) --------------------- */
let editingClass = null; // { item, isJob, isNew }
let pendingClassType = 'major';

function renderClassStrip(){
  const wrap = $('classStrip');
  const f = active();
  wrap.innerHTML = '';

  /* Chip Kin (lecture seule, juste pour le visuel) */
  if(f.kin){
    const kin = document.createElement('span');
    kin.className = 'class-chip';
    kin.setAttribute('data-c', 'gray');
    kin.textContent = f.kin;
    kin.title = 'Kin (modifiable via Éditer)';
    kin.onclick = openEdit;
    wrap.appendChild(kin);
  }

  /* Chips classes (Major / Minor) */
  (f.classes || []).forEach(c => {
    const chip = document.createElement('span');
    chip.className = 'class-chip ' + (c.type === 'minor' ? 'minor' : 'major');
    chip.setAttribute('data-c', c.color || 'blue');
    chip.textContent = (c.nom || 'Sans nom') + ' ' + (c.niveau || 1);
    chip.onclick = () => openClassEditor(c, false);
    wrap.appendChild(chip);
  });

  /* Chips jobs */
  (f.jobs || []).forEach(j => {
    const chip = document.createElement('span');
    chip.className = 'class-chip job';
    chip.setAttribute('data-c', j.color || 'teal');
    chip.textContent = (j.nom || 'Sans nom') + ' ' + (j.niveau || 1);
    chip.onclick = () => openClassEditor(j, true);
    wrap.appendChild(chip);
  });

  /* Chip + AJOUTER */
  const add = document.createElement('span');
  add.className = 'class-chip add';
  add.textContent = '+ AJOUTER';
  add.onclick = () => openClassEditor(null, false);
  wrap.appendChild(add);
}

function openClassEditor(item, isJob){
  editingClass = {
    item: item || {},
    source: isJob ? 'jobs' : 'classes',
    isNew: !item
  };

  /* Type initial */
  let initialType = 'major';
  if(isJob) initialType = 'job';
  else if(item && item.type === 'minor') initialType = 'minor';
  else if(item && item.type === 'major') initialType = 'major';
  setClassType(initialType);

  const src = item || {};
  $('classModalTitle').textContent = (item ? 'MODIFIER · ' : 'NOUVEAU · ')
    + (initialType === 'job' ? 'JOB' : 'CLASSE');
  $('classNom').value = src.nom || '';
  $('classNiveau').value = src.niveau || 1;

  /* Color picker */
  const defaultColor = (initialType === 'job') ? 'teal' : 'blue';
  const cp = $('classColorPicker');
  cp.innerHTML = '';
  ITEM_COLORS.forEach(c => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'color-pick' + ((src.color || defaultColor) === c ? ' active' : '');
    b.setAttribute('data-c', c);
    b.onclick = () => {
      cp.querySelectorAll('.color-pick').forEach(p => p.classList.remove('active'));
      b.classList.add('active');
    };
    cp.appendChild(b);
  });

  $('classDeleteBtn').style.display = editingClass.isNew ? 'none' : '';
  openModal('classModal');
}

function setClassType(type){
  pendingClassType = type;
  document.querySelectorAll('.class-type-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.type === type)
  );
  const title = $('classModalTitle');
  if(title && editingClass){
    title.textContent = (editingClass.isNew ? 'NOUVEAU · ' : 'MODIFIER · ')
      + (type === 'job' ? 'JOB' : 'CLASSE');
  }
}

function saveClassOrJob(){
  if(!editingClass) return;
  const nom = $('classNom').value.trim();
  if(!nom){ alert('Donne un nom à cette classe/job.'); return; }
  const niveau = clampInt($('classNiveau').value, 1, 50);
  const activeBtn = $('classColorPicker').querySelector('.color-pick.active');
  const color = activeBtn ? activeBtn.getAttribute('data-c') : 'blue';

  const f = active();
  const oldSource = editingClass.source;          // 'classes' ou 'jobs'
  const newSource = (pendingClassType === 'job') ? 'jobs' : 'classes';

  /* Bascule Classe ↔ Job : retirer de l'ancien tableau */
  if(!editingClass.isNew && oldSource !== newSource){
    f[oldSource] = (f[oldSource] || []).filter(x => x.id !== editingClass.item.id);
    editingClass.isNew = true;
  }

  f[newSource] = f[newSource] || [];

  if(editingClass.isNew){
    const entry = { id: newId(), nom, niveau, color };
    if(newSource === 'classes') entry.type = pendingClassType;
    f[newSource].push(entry);
  } else {
    const entry = editingClass.item;
    entry.nom = nom;
    entry.niveau = niveau;
    entry.color = color;
    if(newSource === 'classes') entry.type = pendingClassType;
    else delete entry.type;
  }

  /* Avertir si > 2 Major Classes */
  if(newSource === 'classes' && pendingClassType === 'major'){
    const majors = (f.classes || []).filter(c => c.type === 'major').length;
    if(majors > 2) toast('Attention : tu as plus de 2 Major Classes (limite officielle).');
  }

  saveState();
  closeModal('classModal');
  render();
  toast((editingClass.isNew ? 'Ajouté' : 'Enregistré') + ' : ' + nom + ' ' + niveau);
}

function deleteClassOrJob(){
  if(!editingClass || editingClass.isNew){ closeModal('classModal'); return; }
  const item = editingClass.item;
  const source = editingClass.source;
  if(!confirm('Supprimer « ' + (item.nom || 'cette entrée') + ' » ?')) return;
  const f = active();
  f[source] = (f[source] || []).filter(x => x.id !== item.id);
  saveState();
  closeModal('classModal');
  render();
  toast('Supprimé');
}

/* -------------------- Roleplay (apparence / histoire / liens / notes) --- */
function renderRP(){
  const f = active();
  if(!f) return;
  if($('rpApparence')) $('rpApparence').value = f.apparence || '';
  if($('rpHistoire'))  $('rpHistoire').value  = f.histoire || '';
  if($('rpLiens'))     $('rpLiens').value     = f.liens || '';
  if($('rpNotes'))     $('rpNotes').value     = f.notes || '';
}
let rpSaveTimer = null;
function wireRP(){
  ['rpApparence','rpHistoire','rpLiens','rpNotes'].forEach(id => {
    const el = $(id);
    if(!el) return;
    el.addEventListener('input', () => {
      clearTimeout(rpSaveTimer);
      rpSaveTimer = setTimeout(() => {
        const f = active(); if(!f) return;
        f.apparence = $('rpApparence').value;
        f.histoire  = $('rpHistoire').value;
        f.liens     = $('rpLiens').value;
        f.notes     = $('rpNotes').value;
        saveState();
      }, 400);
    });
  });
}

/* -------------------- Mode Combat -------------------------------------- */
function toggleCombatMode(){
  combatModeActive = !combatModeActive;
  const ov = $('combatOverlay');
  if(combatModeActive){
    renderCombatMode();
    ov.classList.add('show');
    document.body.classList.add('combat-on');
    initAudio(); sfxConfirm();
  } else {
    ov.classList.remove('show');
    document.body.classList.remove('combat-on');
  }
}

function renderCombatMode(){
  const f = active();
  if(!f) return;
  $('cmName').textContent = f.nom || '—';

  /* --- Vitals --- */
  const vitals = [
    { key: 'hp',     lbl: 'HP',  cur: f.hp_current,      max: f.hp_max,      cls: 'hp'  },
    { key: 'def',    lbl: 'DEF', cur: f.defense_current, max: f.defense_max, cls: 'def' },
    { key: 'sp',     lbl: 'SP',  cur: f.sp_current,      max: f.sp_max,      cls: 'sp'  },
    { key: 'mp',     lbl: 'MP',  cur: f.mp_current,      max: f.mp_max,      cls: 'mp'  },
    { key: 'wounds', lbl: 'WND', cur: f.wounds_current,  max: f.wounds_max,  cls: 'wound' }
  ];
  const vWrap = $('cmVitals');
  vWrap.innerHTML = '';
  vitals.forEach(v => {
    const pct = v.max > 0 ? Math.round(100 * v.cur / v.max) : 0;
    const row = document.createElement('div');
    row.className = 'cm-vital';
    const big = v.key === 'hp' || v.key === 'def';
    row.innerHTML =
      '<div class="cmv-top">'
      + '<span class="cmv-lbl">' + v.lbl + '</span>'
      + '<span class="cmv-val">' + v.cur + '<i>/' + v.max + '</i></span>'
      + '</div>'
      + '<div class="cmv-bar ' + v.cls + '"><div class="cmv-fill" style="width:' + pct + '%"></div></div>'
      + '<div class="cmv-btns">'
      + (big ? '<button onclick="adjust(\'' + v.key + '\',-5)">−5</button>' : '')
      + '<button onclick="adjust(\'' + v.key + '\',-1)">−1</button>'
      + '<button onclick="adjust(\'' + v.key + '\',1)">+1</button>'
      + (big ? '<button onclick="adjust(\'' + v.key + '\',5)">+5</button>' : '')
      + '</div>';
    vWrap.appendChild(row);
  });

  /* --- Attaques (armes équipées) --- */
  const aWrap = $('cmAttacks');
  aWrap.innerHTML = '';
  const weq = (f.weapons || []).filter(w => w.equipped);
  if(weq.length === 0){
    aWrap.innerHTML = '<div class="cm-empty">Aucune arme équipée (étoile sur la carte d\'arme)</div>';
  } else {
    weq.forEach(w => {
      const b = document.createElement('button');
      b.className = 'cm-attack-btn';
      const base = (w.base_die_count || 1) + 'd' + (w.base_die_size || 8);
      b.innerHTML = '<span class="cmab-name">⚔ ' + escapeHtml(w.nom || 'Arme') + '</span>'
        + '<span class="cmab-meta">' + base + ' · ' + escapeHtml(w.type || '—') + '</span>';
      b.onclick = () => openAttackModal(w);
      aWrap.appendChild(b);
    });
  }

  /* --- Actions --- */
  const actWrap = $('cmActions');
  actWrap.innerHTML = '';
  const actions = [];
  actions.push({ lbl: '⚀ Dé de Classe', fn: 'rollClassDie()', cls: '' });
  actions.push({ lbl: '✚ Soin CD', fn: 'useCDRecovery()', cls: 'heal' });
  actions.push({ lbl: '↺ Counter', fn: 'counterAttack()', cls: '' });
  actions.push({ lbl: '⚀ Jet / Check', fn: 'openRoller()', cls: '' });
  const isOverdrive = f.hp_current > 0 && f.hp_current < f.hp_max / 2 && !f.limit_break_used;
  if(isOverdrive){
    actions.push({ lbl: '★ LIMIT BREAK', fn: 'openLimitBreak()', cls: 'lb' });
  }
  actions.forEach(a => {
    const b = document.createElement('button');
    b.className = 'cm-action-btn ' + a.cls;
    b.innerHTML = a.lbl;
    b.setAttribute('onclick', a.fn);
    actWrap.appendChild(b);
  });

  /* --- Sorts & Mélodies (accès rapide) --- */
  const sorts = f.sorts || [];
  const melodies = f.melodies || [];
  if(sorts.length || melodies.length){
    const castWrap = document.createElement('div');
    castWrap.className = 'cm-cast-row';
    sorts.forEach(s => {
      const b = document.createElement('button');
      b.className = 'cm-cast cast';
      b.innerHTML = '✦ ' + escapeHtml(s.titre || 'Sort') + '<i>SP ' + (s.sp_cost || 0) + '</i>';
      b.onclick = () => castSpell(s);
      castWrap.appendChild(b);
    });
    melodies.forEach(m => {
      const b = document.createElement('button');
      b.className = 'cm-cast melody';
      b.innerHTML = '♪ ' + escapeHtml(m.titre || 'Mélodie') + '<i>MP ' + (m.mp_cost || 3) + '</i>';
      b.onclick = () => playMelody(m);
      castWrap.appendChild(b);
    });
    actWrap.appendChild(castWrap);
  }

  /* --- Statuts actifs --- */
  const stWrap = $('cmStatuses');
  stWrap.innerHTML = '';
  const sts = f.statuses || [];
  if(sts.length === 0){
    stWrap.innerHTML = '<div class="cm-empty">Aucun statut actif</div>';
  } else {
    sts.forEach(s => {
      const chip = document.createElement('span');
      chip.className = 'cm-status-chip';
      chip.setAttribute('data-c', s.color || 'gray');
      chip.innerHTML = escapeHtml(s.nom) + (s.valeur ? ' ' + escapeHtml(s.valeur) : '') + ' <b>×</b>';
      chip.title = (LOA_STATUSES.find(x => x.nom === s.nom) || {}).desc || '';
      chip.onclick = () => removeStatus(s.id);
      stWrap.appendChild(chip);
    });
  }

  /* --- Dernier jet (recopie du log fiche) --- */
  const lr = $('cmLastRoll');
  const last = (f._rollLog || [])[0];
  if(last){
    lr.innerHTML = '<span class="cmlr-label">' + escapeHtml(last.label) + '</span>'
      + '<span class="cmlr-res">' + escapeHtml(last.result) + '</span>';
  } else {
    lr.textContent = '—';
  }
}

/* Dégâts reçus : entament la DEF puis les HP (auto-Wound si HP→0) */
function cmApplyDamage(){
  const f = active(); if(!f) return;
  let amt = parseInt($('cmDmgAmount').value) || 0;
  if(amt <= 0){ toast('Saisis un montant de dégâts'); return; }
  const fromDef = Math.min(f.defense_current, amt);
  f.defense_current -= fromDef;
  const toHp = amt - fromDef;
  let msg = '−' + amt + ' dégâts';
  if(fromDef > 0) msg += ' (' + fromDef + ' DEF';
  if(toHp > 0){
    const before = f.hp_current;
    f.hp_current = Math.max(0, before - toHp);
    msg += (fromDef > 0 ? ' + ' : ' (') + toHp + ' HP)';
    if(f.hp_current === 0 && before > 0 && f.wounds_current < f.wounds_max){
      f.wounds_current = Math.min(f.wounds_max, f.wounds_current + 1);
      msg += ' · Dying +1 Wound';
    }
  } else if(fromDef > 0){
    msg += ' absorbés)';
  }
  $('cmDmgAmount').value = '';
  saveState(); render();
  initAudio(); sfxHit();
  toast(msg);
}
function cmApplyHeal(){
  const f = active(); if(!f) return;
  let amt = parseInt($('cmDmgAmount').value) || 0;
  if(amt <= 0){ toast('Saisis un montant de soin'); return; }
  const before = f.hp_current;
  /* Soin en état Dying : ramène à 1 HP (règle p.132) */
  if(before === 0){
    f.hp_current = 1;
    toast('Soigné en Dying → 1 HP (Wounds conservées)');
  } else {
    f.hp_current = Math.min(f.hp_max, before + amt);
    toast('+' + (f.hp_current - before) + ' HP');
  }
  $('cmDmgAmount').value = '';
  saveState(); render();
  initAudio(); sfxHeal();
}

/* -------------------- Wiring ------------------------------------------- */
function wire(){
  /* Navigation */
  document.querySelectorAll('[data-page]').forEach(b => {
    b.onclick = () => switchPage(b.dataset.page);
  });

  /* Fiche selector */
  $('ficheBtn').onclick = openFichesModal;

  /* Import file */
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
  wireRP();
  switchPage('fiche');
  render();
  registerSW();
  /* Footer update */
  $('foot').textContent = 'LOA Compagnon v' + APP_VERSION + ' · ' + Object.keys(state.fiches).length + ' fiche(s)';

  /* Tick périodique pour mettre à jour les "il y a Xs" dans la sidebar */
  setInterval(() => {
    if(currentPage === 'fiche' || document.querySelector('.right-sidebar')) renderSidebar();
  }, 30000);
}

document.addEventListener('DOMContentLoaded', init);
