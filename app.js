// ═══════════════════════════════════════════════════════════════════
// 🐱 ANSWER CHECKER — MAIN APP
// Điều khiển: UI, nav, music, minigame, bug report
// Compatible with QuizParser v29+
// ═══════════════════════════════════════════════════════════════════

(function(){
'use strict';

const CONFIG = {
  bugWebhook: 'https://discord.com/api/webhooks/1549784660043632792/_hVAUHbku6aMX8jsYczJT6PB6_8EZIefFhNN8c7wJVBuwLBJxfb_R1IeRyIgViMypNg5',
  lms360Url: 'https://lms360hack.pages.dev/',
  ui: { statusDuration: 4500 },
  brand: { name: 'Answer Checker', author: 'Lilcat', version: '17.0.0' },
};

const $ = (id) => document.getElementById(id);
const $$ = (sel) => document.querySelectorAll(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
const escMd = (s) => String(s || '').replace(/([*_`~|\\])/g, '\\$1');
const isHtml = (t) => /<!DOCTYPE html|<html|<script|<body/i.test(t);
const isUrl = (t) => { try { const u = new URL(t); return u.protocol === 'http:' || u.protocol === 'https:'; } catch { return false; } };
const fmtBytes = (b) => b < 1024 ? b + ' B' : b < 1048576 ? (b / 1024).toFixed(1) + ' KB' : (b / 1048576).toFixed(2) + ' MB';

// ═══════════════════════════════════════════════════════════════
// 🆕 v17: UNIVERSAL ANSWER FORMATTER (fallback nếu parser cũ)
// ═══════════════════════════════════════════════════════════════

function localFormatAnswer(answer, options, type) {
  // Prefer parser's formatter
  if (typeof QuizParser !== 'undefined' && typeof QuizParser.formatAnswerDisplay === 'function') {
    return QuizParser.formatAnswerDisplay(answer, options, type);
  }
  // Fallback: minimal inline formatter
  const result = { value: answer, index: null, letter: null, display: '?', valid: false };
  if (answer === null || answer === undefined) { result.display = '(chưa có)'; return result; }
  if (type === 'tf') {
    const b = (typeof QuizParser !== 'undefined' && QuizParser.toBoolean) ? QuizParser.toBoolean(answer) : null;
    if (b === true) { result.value = true; result.display = 'ĐÚNG'; result.valid = true; return result; }
    if (b === false) { result.value = false; result.display = 'SAI'; result.valid = true; return result; }
    result.display = String(answer); return result;
  }
  if (type === 'short') {
    result.value = String(answer).trim();
    result.display = result.value;
    result.valid = true;
    return result;
  }
  // MCQ
  let idx = -1;
  if (typeof answer === 'number') { if (answer >= 0 && answer < 26) idx = answer; }
  else if (typeof answer === 'string') {
    const t = answer.trim();
    if (/^[A-Z]$/i.test(t)) idx = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.indexOf(t.toUpperCase());
    else if (/^([A-Z])\s*[.):\-\s]/i.test(t)) { const m = t.match(/^([A-Z])/i); if (m) idx = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.indexOf(m[1].toUpperCase()); }
    else if (/^\d+$/.test(t)) { const n = parseInt(t, 10); if (n >= 0 && n < 26) idx = n; }
    else if (Array.isArray(options)) idx = options.findIndex(o => String(o).trim() === t);
  }
  if (idx >= 0 && idx < 26) {
    const letter = String.fromCharCode(65 + idx);
    const optText = (Array.isArray(options) && options[idx]) ? options[idx] : '';
    result.index = idx; result.letter = letter; result.value = letter;
    result.display = optText ? `${letter}. ${optText}` : letter;
    result.valid = true;
  } else {
    result.display = String(answer);
  }
  return result;
}

let _loadTimer = null;
function showStatus(msg, type = 'info') {
  const el = $('status'); if (!el) return;
  const icons = { info:'ℹ️', success:'✅', error:'❌', warn:'⚠️' };
  const si = $('si'); if (si) si.textContent = icons[type] || 'ℹ️';
  const st = $('st'); if (st) st.innerHTML = msg;
  el.className = 'show ' + type;
  clearTimeout(el._t);
  el._t = setTimeout(() => el.className = '', CONFIG.ui.statusDuration);
}
const LOAD_MSGS = [['Đang xử lý', 'Vui lòng chờ...'],['Đang đọc dữ liệu', 'Phân tích cấu trúc...'],['Đang tìm kiếm', 'Trích xuất câu hỏi...'],['Đang parse', 'Chuẩn bị hiển thị...']];
function showLoading(show, msg, sub) {
  const el = $('loading-overlay'); if (!el) return;
  if (!show) { clearInterval(_loadTimer); el.classList.add('hidden'); return; }
  el.classList.remove('hidden');
  const lt = $('lt'); if (msg && lt) lt.textContent = msg;
  const ls = $('lsub'); if (sub && ls) ls.textContent = sub;
  let i = 0;
  _loadTimer = setInterval(() => { i = (i + 1) % LOAD_MSGS.length; if (lt) lt.textContent = LOAD_MSGS[i][0]; if (ls) ls.textContent = LOAD_MSGS[i][1]; }, 900);
}
const Modal = {
  open(id) { $(id)?.classList.remove('hidden'); },
  close(id) { $(id)?.classList.add('hidden'); },
  closeAll() { $$('.modal-backdrop').forEach(m => m.classList.add('hidden')); },
};

const PAGES = ['home', 'cheat', 'minigame', 'guide'];
function go(page) {
  if (!PAGES.includes(page)) page = 'home';
  $$('.page').forEach(p => p.classList.remove('active'));
  $('page-' + page)?.classList.add('active');
  $$('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.nav === page));
  window.scrollTo({ top: 0, behavior: 'smooth' });
  try { localStorage.setItem('ac:page', page); } catch {}
}
function initNavbar() {
  $$('[data-nav]').forEach(b => b.addEventListener('click', () => go(b.dataset.nav)));
  window.addEventListener('scroll', () => { $('navbar')?.classList.toggle('scrolled', window.scrollY > 20); }, { passive: true });
  try { const saved = localStorage.getItem('ac:page'); if (saved && PAGES.includes(saved)) go(saved); } catch {}
}

// ═══════════════════════════════════════════════════════════════════
// RENDER HELPERS — FIXED for v29
// ═══════════════════════════════════════════════════════════════════

let _decks = null;

// 🆕 v17: Normalize answer cho MCQ (dùng parser nếu có)
function normalizeMcqForDisplay(answer, options) {
  return localFormatAnswer(answer, options, 'mcq');
}

function normalizeTfForDisplay(answer) {
  return localFormatAnswer(answer, null, 'tf');
}

function renderOneQuestion(q, i) {
  let h = `<div class="q-box" style="animation-delay:${i * 0.03}s">`;
  h += `<div class="ans-yellow mb-1 font-bold">Câu ${i + 1}: <span class="text-gray-500 font-normal text-xs">[${esc(q.type || '?')}]</span>`;
  if (q.topic) h += ` <span class="text-gray-500 font-normal text-xs">— ${esc(q.topic)}</span>`;
  h += `</div>`;
  h += `<div class="text-gray-400 text-xs mb-2">${esc((q.question || '').substring(0, 140))}${(q.question || '').length > 140 ? '...' : ''}</div>`;

  const T = q.type || '';
  const opts = q.options || [];
  const stmts = q.statements || [];
  const ansArr = q.answers || [];

  // ═══════════════════════════════════════════════════════════
  // MCQ — 🆕 v17: Use universal formatter
  // ═══════════════════════════════════════════════════════════
  if (T === 'mcq') {
    const formatted = normalizeMcqForDisplay(q.answer, opts);
    if (formatted.valid) {
      h += `<div class="ans-green">✅ ${esc(formatted.display)}</div>`;
    } else if (q.answer !== null && q.answer !== undefined) {
      // Fallback: show raw answer
      h += `<div class="ans-green">✅ ${esc(String(q.answer))}</div>`;
    } else {
      h += `<div class="ans-red">❌ (Chưa có đáp án)</div>`;
    }
  }
  // ═══════════════════════════════════════════════════════════
  // TF — 🆕 v17: Use universal formatter
  // ═══════════════════════════════════════════════════════════
  else if (T === 'tf') {
    stmts.forEach((s, j) => {
      let a;
      if (typeof s === 'object' && s !== null && 'answer' in s) a = s.answer;
      else a = ansArr[j];

      const formatted = normalizeTfForDisplay(a);
      const isTrue = formatted.value === true;
      const cls = isTrue ? 'ans-green' : (formatted.value === false ? 'ans-red' : 'ans-yellow');

      const txt = typeof s === 'string' ? s : (s.text || s.statement || '');
      h += `<div class="${cls} text-xs">${String.fromCharCode(97 + j)}) ${esc(formatted.display)} — <span class="text-gray-400">${esc(txt.substring(0, 60))}${txt.length > 60 ? '...' : ''}</span></div>`;
    });
  }
  // ═══════════════════════════════════════════════════════════
  // SHORT — 🆕 v17: Use universal formatter
  // ═══════════════════════════════════════════════════════════
  else if (T === 'short') {
    const formatted = localFormatAnswer(q.answer, null, 'short');
    h += `<div class="ans-green">✅ ${esc(formatted.display)}</div>`;
  }
  // ═══════════════════════════════════════════════════════════
  // UNKNOWN TYPE — try to display what we have
  // ═══════════════════════════════════════════════════════════
  else {
    if (q.answer !== null && q.answer !== undefined) {
      h += `<div class="text-yellow-400 text-xs">⚠️ Loại "${esc(T)}" — Đáp án: ${esc(String(q.answer))}</div>`;
    } else {
      h += `<div class="text-yellow-400 text-xs">⚠️ Loại không xác định: ${esc(T)}</div>`;
    }
  }
  h += `</div>`;
  return h;
}

function renderDeck(idx) {
  if (!_decks || !_decks[idx]) return;
  const d = _decks[idx];
  const ct = $('ct'); if (!ct) return;
  let h = `<div class="mb-3 flex justify-between items-center anim-fadeIn"><div class="neon font-bold">📋 ${esc(d.name)} — ${d.questions.length} câu</div></div>`;
  d.questions.forEach((q, i) => { h += renderOneQuestion(q, i); });
  ct.innerHTML = h;
  $$('#tb .tab').forEach((t, i) => t.classList.toggle('active', i === idx));
}

function renderTabs() {
  const tb = $('tb'); if (!tb || !_decks) return;
  tb.innerHTML = '';
  _decks.forEach((d, i) => {
    const b = document.createElement('button');
    b.className = 'tab';
    b.textContent = d.name;
    b.onclick = () => renderDeck(i);
    tb.appendChild(b);
  });
}

// ═══════════════════════════════════════════════════════════════
// 🆕 v17: copyAllText FIXED
// ═══════════════════════════════════════════════════════════════

function copyAllText() {
  if (!_decks) return '';
  let t = '';
  _decks.forEach(d => {
    t += `\n===== ${d.name} =====\n`;
    d.questions.forEach((q, i) => {
      t += `Câu ${i + 1}: `;
      const T = q.type;
      const opts = q.options || [];
      const stmts = q.statements || [];
      const ansArr = q.answers || [];

      if (T === 'mcq') {
        const formatted = normalizeMcqForDisplay(q.answer, opts);
        t += formatted.valid ? `${formatted.display}\n` : `${String(q.answer)}\n`;
      } else if (T === 'tf') {
        stmts.forEach((s, j) => {
          let a;
          if (typeof s === 'object' && s !== null && 'answer' in s) a = s.answer;
          else a = ansArr[j];
          const formatted = normalizeTfForDisplay(a);
          t += `${String.fromCharCode(97 + j)}) ${formatted.display} `;
        });
        t += '\n';
      } else if (T === 'short') {
        const formatted = localFormatAnswer(q.answer, null, 'short');
        t += formatted.display + '\n';
      } else {
        t += String(q.answer || '') + '\n';
      }
    });
  });
  return t;
}

function showResults(decks, sourceLabel) {
  _decks = decks;
  if (!_decks || !_decks.length) { showStatus('❌ Không có đề nào', 'error'); return; }
  const total = _decks.reduce((s, d) => s + d.questions.length, 0);
  showStatus(`✅ <b>Thành công!</b> ${sourceLabel ? `<code>${esc(sourceLabel)}</code> — ` : ''}${_decks.length} đề, ${total} câu`, 'success');
  $('rs').classList.remove('hidden');
  renderTabs();
  renderDeck(0);
  setTimeout(() => $('rs').scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
}

// ═══════════════════════════════════════════════════════════════════
// CHEAT PAGE
// ═══════════════════════════════════════════════════════════════════

let _file = null;

function initCheatPage() {
  if (!$('bf')) return;
  const tabContainer = $('cheat-tabs');
  if (tabContainer) {
    tabContainer.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-m]');
      if (!btn) return;
      e.preventDefault();
      const mode = btn.dataset.m;
      document.querySelectorAll('[data-m]').forEach(b => b.classList.toggle('active', b.dataset.m === mode));
      document.querySelectorAll('[data-p]').forEach(p => p.classList.toggle('hidden', p.dataset.p !== mode));
    });
  }
  const dz = $('dz'), fi = $('fi');
  dz?.addEventListener('click', () => fi.click());
  fi?.addEventListener('change', e => { if (e.target.files[0]) pickFile(e.target.files[0]); });
  ['dragenter','dragover'].forEach(ev => dz?.addEventListener(ev, e => { e.preventDefault(); dz.classList.add('dragover'); }));
  ['dragleave','drop'].forEach(ev => dz?.addEventListener(ev, e => { e.preventDefault(); dz.classList.remove('dragover'); }));
  dz?.addEventListener('drop', e => { const f = e.dataTransfer.files[0]; if (f) pickFile(f); });
  $('bf')?.addEventListener('click', handleFile);
  $('bu')?.addEventListener('click', handleUrl);
  $('bh')?.addEventListener('click', handleHtml);
  $('bc')?.addEventListener('click', copyAll);
  $('bd')?.addEventListener('click', loadDemo);
  $('open-lms360')?.addEventListener('click', (e) => {
    e.preventDefault();
    window.open(CONFIG.lms360Url, '_blank', 'noopener,noreferrer');
    showStatus('🚀 Đang mở LMS360 Hack...', 'info');
  });
}

function pickFile(file) {
  if (!/\.(html?|txt|json)$/i.test(file.name)) { showStatus('❌ Chỉ hỗ trợ .html/.htm/.txt/.json', 'error'); return; }
  _file = file;
  const info = $('finfo');
  if (info) {
    info.classList.remove('hidden');
    info.innerHTML = `<div class="flex justify-between items-center"><span>📎 ${esc(file.name)} <span class="text-gray-500">(${fmtBytes(file.size)})</span></span><button class="btn-ghost px-2 py-1 rounded text-xs" id="clear-file-btn">✕</button></div>`;
    $('clear-file-btn')?.addEventListener('click', () => { _file = null; $('fi').value = ''; info.classList.add('hidden'); });
  }
  showStatus('✅ Đã chọn file', 'success');
}

async function handleFile() {
  if (!_file) { showStatus('⚠️ Chưa chọn file', 'warn'); return; }
  showLoading(true, 'Đang đọc file...');
  try {
    const text = await _file.text();
    await new Promise(r => setTimeout(r, 500));
    showLoading(false);
    try {
      const { data, source } = QuizParser.extractQuizData(text);
      showResults(QuizParser.normalizeDecks(data), source);
    } catch (e) { showStatus('❌ ' + e.message, 'error'); }
  } catch (e) { showLoading(false); showStatus('❌ ' + e.message, 'error'); }
}

async function fetchWithProxies(url) {
  // 🆕 v17: Warn if file:// protocol
  if (window.location.protocol === 'file:') {
    showStatus('⚠️ Đang chạy từ <code>file://</code> — fetch URL sẽ bị CORS chặn. Hãy dùng tab <b>HTML</b> hoặc chạy local server.', 'warn');
  }

  const proxies = [
    u => u,
    u => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
    u => `https://corsproxy.io/?${encodeURIComponent(u)}`,
    u => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`,
    u => `https://thingproxy.freeboard.io/fetch/${u}`,
    u => `https://cors-anywhere.herokuapp.com/${u}`,
  ];
  for (const p of proxies) {
    try {
      const res = await fetch(p(url), { mode: 'cors' });
      if (res.ok) {
        const t = await res.text();
        if (t && t.length > 100) return t;
      }
    } catch {}
  }
  throw new Error('Không tải được HTML (CORS) — thử tab File hoặc HTML');
}

async function handleUrl() {
  const url = $('ui')?.value.trim();
  if (!url) { showStatus('⚠️ Chưa có link', 'warn'); return; }
  if (!isUrl(url)) { showStatus('❌ Link không hợp lệ', 'error'); return; }
  showLoading(true, 'Đang tải HTML...');
  try {
    const html = await fetchWithProxies(url);
    await new Promise(r => setTimeout(r, 500));
    showLoading(false);
    try {
      const { data, source } = QuizParser.extractQuizData(html);
      showResults(QuizParser.normalizeDecks(data), source);
    } catch (e) { showStatus('❌ ' + e.message, 'error'); }
  } catch (e) { showLoading(false); showStatus('❌ ' + e.message, 'error'); }
}

async function handleHtml() {
  const html = $('hi')?.value.trim();
  if (!html) { showStatus('⚠️ Chưa có HTML', 'warn'); return; }
  if (!isHtml(html)) { showStatus('❌ Không phải HTML', 'error'); return; }
  showLoading(true, 'Đang parse...');
  await new Promise(r => setTimeout(r, 500));
  showLoading(false);
  try {
    const { data, source } = QuizParser.extractQuizData(html);
    showResults(QuizParser.normalizeDecks(data), source);
  } catch (e) { showStatus('❌ ' + e.message, 'error'); }
}

function copyAll() {
  if (!_decks) return;
  const text = copyAllText();
  navigator.clipboard.writeText(text).then(() => showStatus('✅ Đã copy!', 'success'));
}

function loadDemo() {
  const d = '<!DOCTYPE html>\n<html><head><title>Demo</title></head>\n<body>\n<script>\nconst allQuestions = {\n  de1: [\n    { type: \'mcq\', question: \'Câu 1?\', options: [\'A\',\'B\',\'C\',\'D\'], answer: \'B\' },\n    { type: \'tf\', question: \'Xét:\', statements: [\'Đúng?\',\'Sai?\'], answers: [true, false] },\n    { type: \'short\', question: \'K_C = ?\', answer: \'36\' }\n  ],\n  de2: [ { type: \'mcq\', question: \'Câu 2?\', options: [\'A\',\'B\'], answer: \'A\' } ]\n};\n<\/script>\n</body></html>';
  $('hi').value = d;
  document.querySelectorAll('[data-m]').forEach(b => b.classList.toggle('active', b.dataset.m === 'h'));
  document.querySelectorAll('[data-p]').forEach(p => p.classList.toggle('hidden', p.dataset.p !== 'h'));
  showStatus('📋 Đã dán HTML mẫu', 'info');
}

// ═══════════════════════════════════════════════════════════════════
// MUSIC SYSTEM (giữ nguyên)
// ═══════════════════════════════════════════════════════════════════

(function initMusicSystem(){
  const MUSIC_KEY = 'ac:music_config';
  const DEFAULT_PLAYLIST = [
    { id: 'tam-su', title: 'Tâm Sự', artist: 'Solmee ft. Dyteller', type: 'youtube', videoId: 'blvOdCKkPOc' },
    { id: 'vet-thuong', title: 'Vết Thương', artist: 'fishy', type: 'youtube', videoId: 'LIKOvbJ-DZg' },
    { id: 'giac-mo', title: 'Giấc Mơ Từng Rất Thơ', artist: 'MER ft. QUANGHUY', type: 'youtube', videoId: 'w9qxn5Kw3-I' },
  ];

  let config = { currentIndex: 0, volume: 40, customTracks: [], enabled: false };
  try { const raw = localStorage.getItem(MUSIC_KEY); if (raw) config = { ...config, ...JSON.parse(raw) }; } catch {}

  function saveConfig() { try { localStorage.setItem(MUSIC_KEY, JSON.stringify(config)); } catch {} }
  function getPlaylist() { return [...DEFAULT_PLAYLIST, ...(config.customTracks || [])]; }

  let player = null, audioEl = null, scWidget = null;
  let isPlaying = false, playerReady = false, pendingPlay = false, currentTrack = null, errorCount = 0;
  const MAX_ERRORS = 3;

  const widget = $('music-widget'), btnToggle = $('music-toggle'), btnSettings = $('music-settings-btn'), settingsPanel = $('music-settings'), btnSettingsClose = $('music-settings-close'), playlistEl = $('music-playlist'), customInput = $('music-custom-url'), btnCustomAdd = $('music-custom-add'), volumeSlider = $('music-volume'), volumeValue = $('music-volume-value'), titleEl = $('music-title'), artistEl = $('music-artist');
  if (!widget || !btnToggle) return;

  function applyVolume(vol) {
    vol = Math.max(0, Math.min(100, parseInt(vol, 10) || 0));
    config.volume = vol;
    if (volumeValue) volumeValue.textContent = vol;
    saveConfig();
    if (player && playerReady && typeof player.setVolume === 'function') { try { player.setVolume(vol); } catch(e) {} }
    if (audioEl) audioEl.volume = vol / 100;
    if (scWidget && typeof scWidget.setVolume === 'function') { try { scWidget.setVolume(vol); } catch(e) {} }
  }

  function createPlayer() {
    if (player) return;
    const container = $('yt-player');
    if (!container) return;
    try {
      player = new window.YT.Player('yt-player', {
        height: '1', width: '1',
        videoId: DEFAULT_PLAYLIST[0].videoId,
        playerVars: { autoplay: 0, controls: 0, disablekb: 1, fs: 0, modestbranding: 1, playsinline: 1, rel: 0 },
        events: {
          onReady: (e) => { playerReady = true; applyVolume(config.volume); if (pendingPlay && currentTrack?.type === 'youtube') { pendingPlay = false; playYouTube(currentTrack); } },
          onStateChange: (e) => { if (e.data === 1) { isPlaying = true; errorCount = 0; updateWidgetUI(); renderPlaylist(); } else if (e.data === 2 || e.data === 0) { isPlaying = false; updateWidgetUI(); renderPlaylist(); } },
          onError: (e) => { if ([100, 101, 150].includes(e.data)) nextTrackOnError(); },
        },
      });
    } catch (err) {}
  }

  function waitForYT(retries = 100) {
    if (window.YT && typeof window.YT.Player === 'function') { createPlayer(); return; }
    if (retries <= 0) return;
    setTimeout(() => waitForYT(retries - 1), 100);
  }

  if (window.YT && typeof window.YT.Player === 'function') { createPlayer(); }
  else if (window.YT && window.YT.loaded) { waitForYT(); }
  else {
    const oldCb = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = function() { if (oldCb) try { oldCb(); } catch(e){} createPlayer(); };
    setTimeout(() => {
      if (!window.YT || typeof window.YT.Player !== 'function') {
        if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
          const s = document.createElement('script');
          s.src = 'https://www.youtube.com/iframe_api';
          document.head.appendChild(s);
        }
        waitForYT();
      }
    }, 500);
  }

  function ensureSoundCloudAPI(cb) {
    if (window.SC && window.SC.Widget) { cb(); return; }
    if (window.__scLoading) { const oldReady = window.__scReady || []; oldReady.push(cb); return; }
    window.__scLoading = true;
    window.__scReady = [cb];
    const s = document.createElement('script');
    s.src = 'https://w.soundcloud.com/player/api.js';
    s.onload = () => { (window.__scReady || []).forEach(fn => { try { fn(); } catch(e){} }); window.__scReady = []; };
    document.head.appendChild(s);
  }

  function playSoundCloud(track) {
    const old = $('sc-player');
    if (old) old.remove();
    scWidget = null;
    const container = document.createElement('div');
    container.id = 'sc-container';
    container.style.cssText = 'position:fixed;left:-9999px;width:1px;height:1px;overflow:hidden;';
    const iframe = document.createElement('iframe');
    iframe.id = 'sc-player';
    iframe.width = '100%';
    iframe.height = '166';
    iframe.allow = 'autoplay';
    iframe.frameBorder = 'no';
    iframe.scrolling = 'no';
    iframe.src = `https://w.soundcloud.com/player/?url=${encodeURIComponent(track.url)}&auto_play=true&hide_related=true&show_comments=false&show_user=false&show_reposts=false&visual=false&show_artwork=false&buying=false&sharing=false&download=false&liking=false`;
    container.appendChild(iframe);
    document.body.appendChild(container);
    ensureSoundCloudAPI(() => {
      try {
        scWidget = window.SC.Widget(iframe);
        scWidget.bind(window.SC.Widget.Events.READY, () => { scWidget.setVolume(config.volume); scWidget.play(); isPlaying = true; updateWidgetUI(); renderPlaylist(); });
        scWidget.bind(window.SC.Widget.Events.PLAY, () => { isPlaying = true; errorCount = 0; updateWidgetUI(); renderPlaylist(); });
        scWidget.bind(window.SC.Widget.Events.PAUSE, () => { isPlaying = false; updateWidgetUI(); renderPlaylist(); });
        scWidget.bind(window.SC.Widget.Events.FINISH, () => { isPlaying = false; updateWidgetUI(); renderPlaylist(); nextTrackOnError(); });
        scWidget.bind(window.SC.Widget.Events.ERROR, () => { nextTrackOnError(); });
      } catch(e) {}
    });
  }

  function stopAll() {
    if (player && typeof player.stopVideo === 'function') { try { player.stopVideo(); } catch(e){} }
    if (audioEl) { audioEl.pause(); audioEl.src = ''; }
    if (scWidget && typeof scWidget.pause === 'function') { try { scWidget.pause(); } catch(e){} }
    const sc = $('sc-container'); if (sc) sc.remove();
    scWidget = null;
  }

  function playTrackAtIndex(index) {
    const playlist = getPlaylist();
    if (index < 0 || index >= playlist.length) return;
    config.currentIndex = index; saveConfig();
    const track = playlist[index]; currentTrack = track;
    stopAll();
    if (track.type === 'youtube') { if (!playerReady) { pendingPlay = true; return; } playYouTube(track); }
    else if (track.type === 'audio') { playAudio(track); }
    else if (track.type === 'soundcloud') { playSoundCloud(track); }
    renderPlaylist(); updateWidgetUI();
  }

  function playYouTube(track) {
    if (!player || typeof player.loadVideoById !== 'function') return;
    try { player.loadVideoById({ videoId: track.videoId, startSeconds: 0 }); player.setVolume(config.volume); player.playVideo(); } catch(e) { nextTrackOnError(); }
  }

  function playAudio(track) {
    if (!audioEl) return;
    try { audioEl.src = track.url; audioEl.volume = config.volume / 100; audioEl.play().then(() => { isPlaying = true; updateWidgetUI(); }).catch(() => nextTrackOnError()); } catch(e) {}
  }

  function nextTrackOnError() {
    errorCount++;
    if (errorCount >= MAX_ERRORS) { isPlaying = false; updateWidgetUI(); return; }
    const playlist = getPlaylist();
    if (playlist.length > 1) { const nextIdx = (config.currentIndex + 1) % playlist.length; setTimeout(() => playTrackAtIndex(nextIdx), 800); }
  }

  function togglePlay() { if (!currentTrack) { errorCount = 0; playTrackAtIndex(config.currentIndex || 0); return; } isPlaying ? pauseMusic() : resumeMusic(); }

  function pauseMusic() {
    if (currentTrack?.type === 'youtube' && player && typeof player.pauseVideo === 'function') { try { player.pauseVideo(); } catch(e){} }
    if (currentTrack?.type === 'audio' && audioEl) audioEl.pause();
    if (currentTrack?.type === 'soundcloud' && scWidget && typeof scWidget.pause === 'function') { try { scWidget.pause(); } catch(e){} }
    isPlaying = false; updateWidgetUI(); renderPlaylist();
  }

  function resumeMusic() {
    if (currentTrack?.type === 'youtube' && player && typeof player.playVideo === 'function') { try { player.playVideo(); } catch(e){} }
    if (currentTrack?.type === 'audio' && audioEl) audioEl.play().catch(() => {});
    if (currentTrack?.type === 'soundcloud' && scWidget && typeof scWidget.play === 'function') { try { scWidget.play(); } catch(e){} }
    isPlaying = true; updateWidgetUI(); renderPlaylist();
  }

  function renderPlaylist() {
    if (!playlistEl) return;
    const playlist = getPlaylist(); const currentId = currentTrack?.id;
    playlistEl.innerHTML = playlist.map((track, i) => `<div class="playlist-item ${track.id === currentId ? 'active' : ''}" data-track-index="${i}"><div class="play-icon">${track.id === currentId && isPlaying ? '⏸' : '▶'}</div><div class="info"><div class="title">${esc(track.title)}</div><div class="artist">${esc(track.artist)}</div></div></div>`).join('');
    playlistEl.querySelectorAll('[data-track-index]').forEach(el => { el.addEventListener('click', () => { const idx = parseInt(el.dataset.trackIndex, 10); errorCount = 0; playTrackAtIndex(idx); }); });
  }

  function updateWidgetUI() {
    if (isPlaying) { widget.classList.add('playing'); btnToggle.textContent = '⏸'; btnToggle.title = 'Tắt nhạc'; }
    else { widget.classList.remove('playing'); btnToggle.textContent = '🔇'; btnToggle.title = 'Bật nhạc'; }
    if (currentTrack) { if (titleEl) titleEl.textContent = currentTrack.title; if (artistEl) artistEl.textContent = currentTrack.artist; }
  }

  function parseMusicUrl(url) {
    url = url.trim(); if (!url) return null;
    const ytMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|v\/)|youtu\.be\/)([\w-]{11})/);
    if (ytMatch) return { id: 'yt-' + ytMatch[1], title: 'YouTube Video', artist: ytMatch[1], type: 'youtube', videoId: ytMatch[1] };
    if (url.includes('soundcloud.com')) {
      const parts = url.split('/').filter(Boolean);
      const slug = parts[parts.length - 1] || 'SoundCloud Track';
      return { id: 'sc-' + Date.now(), title: slug.replace(/-/g, ' '), artist: 'SoundCloud', type: 'soundcloud', url };
    }
    if (/\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(url) || url.startsWith('data:audio')) return { id: 'audio-' + Date.now(), title: 'Audio File', artist: 'Custom', type: 'audio', url };
    return { id: 'audio-' + Date.now(), title: 'Custom Audio', artist: 'Custom', type: 'audio', url };
  }

  btnToggle.addEventListener('click', togglePlay);
  btnSettings?.addEventListener('click', () => { settingsPanel.classList.toggle('hidden'); if (!settingsPanel.classList.contains('hidden')) renderPlaylist(); });
  btnSettingsClose?.addEventListener('click', () => { settingsPanel.classList.add('hidden'); });
  btnCustomAdd?.addEventListener('click', () => {
    const url = customInput?.value.trim();
    if (!url) { showStatus('⚠️ Chưa nhập link', 'warn'); return; }
    const track = parseMusicUrl(url);
    if (!track || track.error) { showStatus('❌ Link không hợp lệ', 'error'); return; }
    if (!config.customTracks) config.customTracks = [];
    config.customTracks.push(track); saveConfig(); customInput.value = ''; renderPlaylist();
    showStatus('✅ Đã thêm: ' + track.title, 'success');
  });

  if (volumeSlider) {
    volumeSlider.value = config.volume;
    if (volumeValue) volumeValue.textContent = config.volume;
    const handler = (e) => applyVolume(e.target.value);
    volumeSlider.addEventListener('input', handler);
    volumeSlider.addEventListener('change', handler);
  }

  document.addEventListener('click', (e) => {
    if (!settingsPanel || settingsPanel.classList.contains('hidden')) return;
    if (settingsPanel.contains(e.target)) return;
    if (btnSettings?.contains(e.target)) return;
    settingsPanel.classList.add('hidden');
  });

  audioEl = $('audio-player');
  if (audioEl) { audioEl.addEventListener('ended', () => { isPlaying = false; updateWidgetUI(); nextTrackOnError(); }); }

  renderPlaylist();
})();

// ═══════════════════════════════════════════════════════════════════
// MINIGAME MATH (giữ nguyên)
// ═══════════════════════════════════════════════════════════════════

const MathGame = (function(){
  const STORAGE_KEY = 'ac:mathgame_v2';
  let state = {
    playing: false, level: 1, maxLevel: 1, score: 0, correct: 0,
    streak: 0, maxStreak: 0, timeLeft: 0, timerInterval: null,
    question: null, answered: false, tabSwitchPenalty: false, lives: 1,
  };

  let tabHiddenTime = 0;

  function randInt(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }
  function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { [a, b] = [b, a % b]; } return a; }
  function simplify(num, den) { const g = gcd(num, den); return [num / g, den / g]; }
  function fracStr(num, den) { if (den === 1) return String(num); const s = simplify(num, den); return s[1] === 1 ? String(s[0]) : `${s[0]}/${s[1]}`; }
  function shuffle(arr) { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  function buildOptionsFromPool(correct, pool) {
    const opts = new Set([String(correct)]);
    for (const p of shuffle(pool)) { if (opts.size >= 4) break; if (String(p) !== String(correct)) opts.add(String(p)); }
    return shuffle([...opts]);
  }

  function getDifficulty() {
    if (state.level <= 2) return 'easy';
    if (state.level <= 4) return 'medium';
    if (state.level <= 6) return 'hard';
    return 'insane';
  }
  function getTimeForLevel() {
    const base = { easy: 20, medium: 15, hard: 12, insane: 8 };
    const diff = getDifficulty();
    return Math.max(5, base[diff] - Math.floor((state.level - 1) / 3));
  }

  function genAlgebra(diff) {
    const levels = { easy: 1, medium: 2, hard: 3, insane: 4 };
    const lv = levels[diff] || 1;
    const type = randInt(1, lv >= 3 ? 5 : 3);
    if (type === 1) {
      const a = randInt(2, 5 + lv * 3), b = randInt(1, 10 + lv * 5), c = randInt(1, 20 + lv * 10);
      const x = (c - b) / a;
      if (!Number.isInteger(x)) return genAlgebra(diff);
      return { question: `${a}x + ${b} = ${c}. Tìm x?`, options: buildOptionsFromPool(x, [x + 1, x - 1, x + 2, x - 2, x + 3, -x, x * 2]), correct: String(x), topic: 'algebra' };
    }
    if (type === 2) {
      const r1 = randInt(-5, 5), r2 = randInt(-5, 5);
      if (r1 === r2) return genAlgebra(diff);
      const b = -(r1 + r2), c = r1 * r2;
      const sign = b >= 0 ? `+${b}` : `${b}`;
      const opts = buildOptionsFromPool(`x = ${r1} hoặc x = ${r2}`, [`x = ${r1 + 1} hoặc x = ${r2}`, `x = ${r1} hoặc x = ${r2 + 1}`, `x = ${-r1} hoặc x = ${-r2}`, `x = ${r1 * 2} hoặc x = ${r2}`]);
      return { question: `x² ${sign}x ${c >= 0 ? '+' + c : c} = 0. Nghiệm nào đúng?`, options: opts, correct: `x = ${r1} hoặc x = ${r2}`, topic: 'algebra' };
    }
    if (type === 3) {
      const x = randInt(-5, 5), y = randInt(-5, 5);
      const a1 = randInt(1, 4), b1 = randInt(1, 4), c1 = a1 * x + b1 * y;
      const a2 = randInt(1, 4), b2 = randInt(1, 4), c2 = a2 * x + b2 * y;
      if (a1 * b2 === a2 * b1) return genAlgebra(diff);
      const opts = buildOptionsFromPool(`(${x}, ${y})`, [`(${y}, ${x})`, `(${x + 1}, ${y})`, `(${x}, ${y + 1})`, `(${-x}, ${-y})`, `(${x + 2}, ${y - 1})`]);
      return { question: `Hệ: ${a1}x + ${b1}y = ${c1}; ${a2}x + ${b2}y = ${c2}. Nghiệm (x,y)?`, options: opts, correct: `(${x}, ${y})`, topic: 'algebra' };
    }
    if (type === 4) {
      const base = [2, 3, 5][randInt(0, 2)];
      const exp = randInt(1, 4 + lv);
      const val = Math.pow(base, exp);
      return { question: `log_${base}(${val}) = ?`, options: buildOptionsFromPool(exp, [exp + 1, exp - 1, exp + 2, exp * 2, val, val / base]), correct: String(exp), topic: 'calculus' };
    }
    if (type === 5) {
      const a = randInt(1, 5 + lv), n = randInt(2, 4 + lv);
      const correct = `${a * n}x^${n - 1}`;
      return { question: `Đạo hàm của f(x) = ${a}x^${n}?`, options: buildOptionsFromPool(correct, [`${a * n}x^${n}`, `${a}x^${n - 1}`, `${a * n}x^${n + 1}`, `${a + n}x^${n - 1}`, `${a * n * n}x^${n - 1}`]), correct, topic: 'calculus' };
    }
    return genAlgebra(diff);
  }

  function genFraction(diff) {
    const lv = { easy: 1, medium: 2, hard: 3, insane: 4 }[diff] || 1;
    const type = randInt(1, lv >= 3 ? 4 : 3);
    if (type === 1) {
      const d1 = randInt(2, 4 + lv * 2), d2 = randInt(2, 4 + lv * 2);
      const n1 = randInt(1, d1 - 1), n2 = randInt(1, d2 - 1);
      const num = n1 * d2 + n2 * d1, den = d1 * d2;
      const correct = fracStr(num, den);
      const wrongs = [fracStr(num + 1, den), fracStr(num, den + 1), fracStr(num - 1, den), fracStr(n1 + n2, d1 + d2)];
      return { question: `${n1}/${d1} + ${n2}/${d2} = ?`, options: shuffle([correct, ...wrongs]), correct, topic: 'fraction' };
    }
    if (type === 2) {
      const n1 = randInt(1, 6 + lv), d1 = randInt(2, 6 + lv), n2 = randInt(1, 6 + lv), d2 = randInt(2, 6 + lv);
      const correct = fracStr(n1 * n2, d1 * d2);
      const wrongs = [fracStr(n1 + n2, d1 + d2), fracStr(n1 * d2, d1 * n2), fracStr(n1 + n2, d1 * d2), fracStr(n1 * n2, d1 + d2)];
      return { question: `${n1}/${d1} × ${n2}/${d2} = ?`, options: shuffle([correct, ...wrongs]), correct, topic: 'fraction' };
    }
    if (type === 3) {
      const d1 = randInt(2, 8), n1 = randInt(1, d1 - 1), d2 = randInt(2, 8), n2 = randInt(1, d2 - 1);
      const v1 = n1 / d1, v2 = n2 / d2;
      const correct = v1 > v2 ? '>' : v1 < v2 ? '<' : '=';
      return { question: `${n1}/${d1} ... ${n2}/${d2} (điền dấu)`, options: shuffle(['>', '<', '=', '≥']), correct, topic: 'fraction' };
    }
    if (type === 4) {
      const n1 = randInt(1, 5), d1 = randInt(2, 6), n2 = randInt(1, 5), d2 = randInt(2, 6);
      const correct = fracStr(n1 * d2, d1 * n2);
      const wrongs = [fracStr(n1 * n2, d1 * d2), fracStr(d1 * n2, n1 * d2), fracStr(n1 + d2, d1 + n2), fracStr(n1 * d2, d1 + n2)];
      return { question: `${n1}/${d1} ÷ ${n2}/${d2} = ?`, options: shuffle([correct, ...wrongs]), correct, topic: 'fraction' };
    }
    return genFraction(diff);
  }

  function genCalculus(diff) {
    const lv = { easy: 1, medium: 2, hard: 3, insane: 4 }[diff] || 1;
    const type = randInt(1, 3);
    if (type === 1) {
      const a = randInt(1, 5);
      const correct = String(2 * a);
      return { question: `lim(x→${a}) (x² - ${a * a})/(x - ${a}) = ?`, options: buildOptionsFromPool(correct, [String(a), String(a * a), String(2 * a + 1), String(2 * a - 1), '0', '∞']), correct, topic: 'calculus' };
    }
    if (type === 2) {
      const n = randInt(2, 4 + lv);
      const correct = `x^${n} + C`;
      return { question: `∫ ${n}x^${n - 1} dx = ?`, options: buildOptionsFromPool(correct, [`x^${n + 1} + C`, `${n}x^${n} + C`, `x^${n - 1} + C`, `${n * n}x^${n - 1} + C`]), correct, topic: 'calculus' };
    }
    if (type === 3) {
      const a = randInt(2, 5), b = randInt(1, 5);
      const correct = `${2 * a}(${a}x + ${b})`;
      return { question: `Đạo hàm f(x) = (${a}x + ${b})²?`, options: buildOptionsFromPool(correct, [`2(${a}x + ${b})`, `${a}(${a}x + ${b})`, `${2 * a}x`, `2${a}x + ${b}`, `${a * a}x + ${b}`]), correct, topic: 'calculus' };
    }
    return genCalculus(diff);
  }

  function genGeometry(diff) {
    const lv = { easy: 1, medium: 2, hard: 3, insane: 4 }[diff] || 1;
    const type = randInt(1, 4);
    if (type === 1) {
      const r = randInt(1, 3 + lv * 2);
      const correct = (Math.PI * r * r).toFixed(2);
      return { question: `Diện tích hình tròn bán kính r = ${r}? (π ≈ 3.14)`, options: buildOptionsFromPool(correct, [(2 * Math.PI * r).toFixed(2), (Math.PI * r).toFixed(2), (Math.PI * r * r * 2).toFixed(2), (Math.PI * r * r / 2).toFixed(2)]), correct, topic: 'geometry', graphType: 'circle', graphData: { r } };
    }
    if (type === 2) {
      const a = randInt(3, 6 + lv), b = randInt(4, 8 + lv);
      const c = Math.sqrt(a * a + b * b);
      if (!Number.isInteger(c)) return genGeometry(diff);
      return { question: `Tam giác vuông: a=${a}, b=${b}. Cạnh huyền c?`, options: buildOptionsFromPool(String(c), [String(a + b), String(c + 1), String(c - 1), String(Math.round(c * 1.5))]), correct: String(c), topic: 'geometry', graphType: 'triangle', graphData: { a, b, c } };
    }
    if (type === 3) {
      const r = randInt(1, 3 + lv);
      const correct = ((4 / 3) * Math.PI * r * r * r).toFixed(2);
      return { question: `Thể tích hình cầu bán kính r = ${r}? (π ≈ 3.14)`, options: buildOptionsFromPool(correct, [(Math.PI * r * r * r).toFixed(2), ((4 / 3) * Math.PI * r * r).toFixed(2), (4 * Math.PI * r * r).toFixed(2), ((2 / 3) * Math.PI * r * r * r).toFixed(2)]), correct, topic: 'geometry', graphType: 'sphere', graphData: { r } };
    }
    if (type === 4) {
      const b = randInt(3, 10 + lv * 2), h = randInt(2, 8 + lv * 2);
      const correct = String((b * h) / 2);
      return { question: `Tam giác có đáy = ${b}, chiều cao = ${h}. Diện tích?`, options: buildOptionsFromPool(correct, [String(b * h), String(b + h), String(b * h / 4), String(b * h * 2)]), correct, topic: 'geometry', graphType: 'triangleArea', graphData: { b, h } };
    }
    return genGeometry(diff);
  }

  function genLogic(diff) {
    const lv = { easy: 1, medium: 2, hard: 3, insane: 4 }[diff] || 1;
    const type = randInt(1, 3);
    if (type === 1) {
      const start = randInt(1, 5 + lv), step = randInt(2, 5 + lv);
      const seq = [start, start + step, start + 2 * step, start + 3 * step];
      const correct = start + 4 * step;
      return { question: `Dãy số: ${seq.join(', ')}, ... Số tiếp theo?`, options: buildOptionsFromPool(String(correct), [String(correct + step), String(correct - step), String(correct + 1), String(correct * 2)]), correct: String(correct), topic: 'logic' };
    }
    if (type === 2) {
      const p = randInt(10, 90), val = randInt(50, 500 + lv * 100);
      const correct = Math.round(val * p / 100);
      return { question: `${p}% của ${val} = ?`, options: buildOptionsFromPool(String(correct), [String(Math.round(val * (p + 10) / 100)), String(Math.round(val * (p - 10) / 100)), String(Math.round(val * p / 200)), String(val - p)]), correct: String(correct), topic: 'logic' };
    }
    if (type === 3) {
      const a = randInt(10, 100), m = randInt(3, 9);
      const correct = a % m;
      return { question: `${a} mod ${m} = ?`, options: buildOptionsFromPool(String(correct), [String((correct + 1) % m), String((correct + 2) % m), String((correct + 3) % m), String(a - m)]), correct: String(correct), topic: 'logic' };
    }
    return genLogic(diff);
  }

  const GENERATORS = { algebra: genAlgebra, fraction: genFraction, calculus: genCalculus, geometry: genGeometry, logic: genLogic };

  function generateQuestion() {
    const diff = getDifficulty();
    const keys = Object.keys(GENERATORS);
    let topicKeys;
    if (state.level <= 2) topicKeys = ['algebra', 'fraction', 'logic'];
    else if (state.level <= 4) topicKeys = ['algebra', 'fraction', 'geometry', 'logic'];
    else topicKeys = keys;
    const gen = GENERATORS[topicKeys[randInt(0, topicKeys.length - 1)]];
    let q, attempts = 0;
    do { q = gen(diff); attempts++; } while ((!q || !q.options || q.options.length < 4) && attempts < 30);
    return q;
  }

  function drawGraph(question) {
    const canvas = $('math-canvas');
    const container = $('graph-container');
    if (!canvas || !container) return;
    const type = question.graphType;
    const qText = question.question || '';
    const isGraphable = type || /x²|Đạo hàm|∫|lim|f\(x\)|parabol/.test(qText);
    if (!isGraphable) { container.classList.add('hidden'); return; }
    container.classList.remove('hidden');

    const ctx = canvas.getContext('2d');
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width * (window.devicePixelRatio || 1);
    canvas.height = rect.height * (window.devicePixelRatio || 1);
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);

    const w = rect.width, h = rect.height;
    ctx.clearRect(0, 0, w, h);

    ctx.strokeStyle = '#1a1a2e';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 12; i++) {
      ctx.beginPath(); ctx.moveTo(i * w / 12, 0); ctx.lineTo(i * w / 12, h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i * h / 12); ctx.lineTo(w, i * h / 12); ctx.stroke();
    }

    const cx = w / 2, cy = h / 2;

    if (type === 'circle') {
      const r = question.graphData.r;
      const pxR = Math.min(w, h) * 0.32;
      ctx.fillStyle = 'rgba(255,106,193,.12)';
      ctx.beginPath(); ctx.arc(cx, cy, pxR, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#ff6ac1'; ctx.lineWidth = 2.5;
      ctx.shadowColor = '#ff6ac1'; ctx.shadowBlur = 12;
      ctx.beginPath(); ctx.arc(cx, cy, pxR, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = '#3498db'; ctx.lineWidth = 1.5; ctx.shadowBlur = 6;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + pxR, cy); ctx.stroke();
      ctx.fillStyle = '#3498db'; ctx.font = 'bold 13px "Be Vietnam Pro", sans-serif';
      ctx.textAlign = 'center'; ctx.fillText(`r = ${r}`, cx + pxR / 2, cy - 8);
      ctx.fillStyle = '#3498db'; ctx.shadowBlur = 0;
      ctx.beginPath(); ctx.arc(cx, cy, 3, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      return;
    }

    if (type === 'triangle') {
      const { a, b, c } = question.graphData;
      const scale = Math.min(w, h) * 0.55 / Math.max(a, b);
      const pxA = a * scale, pxB = b * scale;
      const startX = cx - pxB / 2, startY = cy + pxA / 2;
      ctx.fillStyle = 'rgba(155,89,182,.12)';
      ctx.beginPath(); ctx.moveTo(startX, startY); ctx.lineTo(startX + pxB, startY); ctx.lineTo(startX, startY - pxA); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#9b59b6'; ctx.lineWidth = 2.5; ctx.shadowColor = '#9b59b6'; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.moveTo(startX, startY); ctx.lineTo(startX + pxB, startY); ctx.lineTo(startX, startY - pxA); ctx.closePath(); ctx.stroke();
      ctx.lineWidth = 1.5; ctx.shadowBlur = 0; ctx.strokeRect(startX, startY - 12, 12, 12);
      ctx.fillStyle = '#e0e0e0'; ctx.font = 'bold 12px "Be Vietnam Pro", sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(`a=${a}`, startX + pxB / 2, startY + 18);
      ctx.fillText(`b=${b}`, startX - 22, startY - pxA / 2);
      ctx.fillStyle = '#2ecc71'; ctx.font = 'bold 13px "Be Vietnam Pro", sans-serif';
      ctx.fillText(`c=${c}`, startX + pxB / 2 + 18, startY - pxA / 2 - 8);
      ctx.shadowBlur = 0;
      return;
    }

    if (type === 'sphere') {
      const r = question.graphData.r;
      const pxR = Math.min(w, h) * 0.3;
      const grad = ctx.createRadialGradient(cx - pxR * 0.3, cy - pxR * 0.3, pxR * 0.1, cx, cy, pxR);
      grad.addColorStop(0, 'rgba(155,89,182,.4)');
      grad.addColorStop(1, 'rgba(155,89,182,.08)');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(cx, cy, pxR, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#9b59b6'; ctx.lineWidth = 2.5; ctx.shadowColor = '#9b59b6'; ctx.shadowBlur = 12;
      ctx.beginPath(); ctx.arc(cx, cy, pxR, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = 'rgba(155,89,182,.5)'; ctx.lineWidth = 1.5; ctx.shadowBlur = 4;
      ctx.beginPath(); ctx.ellipse(cx, cy, pxR, pxR * 0.35, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(cx, cy, pxR * 0.35, pxR, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = '#3498db'; ctx.lineWidth = 1.5; ctx.shadowColor = '#3498db'; ctx.shadowBlur = 6;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + pxR, cy); ctx.stroke();
      ctx.fillStyle = '#3498db'; ctx.font = 'bold 13px "Be Vietnam Pro", sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(`r = ${r}`, cx + pxR / 2, cy - 8);
      ctx.fillStyle = '#3498db'; ctx.shadowBlur = 0;
      ctx.beginPath(); ctx.arc(cx, cy, 3, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      return;
    }

    if (type === 'triangleArea') {
      const { b, h } = question.graphData;
      const scale = Math.min(w, h) * 0.55 / Math.max(b, h);
      const pxB = b * scale, pxH = h * scale;
      const startX = cx - pxB / 2, startY = cy + pxH / 2;
      ctx.fillStyle = 'rgba(155,89,182,.12)';
      ctx.beginPath(); ctx.moveTo(startX, startY); ctx.lineTo(startX + pxB, startY); ctx.lineTo(startX + pxB / 2, startY - pxH); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#9b59b6'; ctx.lineWidth = 2.5; ctx.shadowColor = '#9b59b6'; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.moveTo(startX, startY); ctx.lineTo(startX + pxB, startY); ctx.lineTo(startX + pxB / 2, startY - pxH); ctx.closePath(); ctx.stroke();
      ctx.strokeStyle = '#f1c40f'; ctx.lineWidth = 1.5; ctx.setLineDash([5, 5]); ctx.shadowBlur = 4; ctx.shadowColor = '#f1c40f';
      ctx.beginPath(); ctx.moveTo(startX + pxB / 2, startY); ctx.lineTo(startX + pxB / 2, startY - pxH); ctx.stroke();
      ctx.setLineDash([]); ctx.shadowBlur = 0; ctx.strokeRect(startX + pxB / 2, startY - 12, 12, 12);
      ctx.fillStyle = '#e0e0e0'; ctx.font = 'bold 12px "Be Vietnam Pro", sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(`đáy = ${b}`, startX + pxB / 2, startY + 18);
      ctx.fillStyle = '#f1c40f'; ctx.fillText(`h = ${h}`, startX + pxB / 2 + 30, startY - pxH / 2);
      ctx.shadowBlur = 0;
      return;
    }

    // Function graph
    ctx.strokeStyle = '#3a3a52'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(w, cy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, h); ctx.stroke();
    ctx.fillStyle = '#3a3a52';
    ctx.beginPath(); ctx.moveTo(w - 2, cy); ctx.lineTo(w - 10, cy - 4); ctx.lineTo(w - 10, cy + 4); ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx, 2); ctx.lineTo(cx - 4, 10); ctx.lineTo(cx + 4, 10); ctx.fill();

    ctx.strokeStyle = '#ff6ac1'; ctx.lineWidth = 2.5; ctx.shadowColor = '#ff6ac1'; ctx.shadowBlur = 12;
    ctx.beginPath();
    if (qText.includes('x²') || qText.includes('parabol')) {
      for (let px = 0; px <= w; px += 2) { const x = (px - cx) / (w / 10); const y = x * x * 0.8; const py = cy - y * (h / 10); if (px === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py); }
    } else if (qText.includes('Đạo hàm')) {
      for (let px = 0; px <= w; px += 2) { const x = (px - cx) / (w / 10); const y = x * 1.2; const py = cy - y * (h / 10); if (px === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py); }
    } else if (qText.includes('lim')) {
      for (let px = 0; px <= w; px += 2) { const x = (px - cx) / (w / 10); const y = x !== 0 ? Math.sin(x) / x * 2 : 2; const py = cy - y * (h / 10); if (px === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py); }
    } else if (qText.includes('∫')) {
      for (let px = 0; px <= w; px += 2) { const x = (px - cx) / (w / 10); const y = x * x * x / 4; const py = cy - y * (h / 8); if (px === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py); }
    } else {
      for (let px = 0; px <= w; px += 2) { const x = (px - cx) / (w / 10); const y = Math.sin(x) * 2; const py = cy - y * (h / 10); if (px === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py); }
    }
    ctx.stroke(); ctx.shadowBlur = 0;

    ctx.fillStyle = '#666'; ctx.font = '10px "Be Vietnam Pro", sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('x', w - 8, cy - 8);
    ctx.fillText('y', cx + 12, 12);
  }

  function updateHUD() {
    const lb = $('level-badge'); if (lb) lb.textContent = `⭐ Cấp ${state.level}`;
    const sd = $('score-display'); if (sd) sd.textContent = `${state.score} điểm`;
    const streakDisplay = $('streak-display');
    const streakCount = $('streak-count');
    if (streakDisplay && streakCount) {
      if (state.streak >= 2) { streakDisplay.style.display = 'flex'; streakCount.textContent = state.streak; }
      else { streakDisplay.style.display = 'none'; }
    }
    const qt = $('q-topic');
    if (qt && state.question) {
      const topicLabels = { algebra: '📐 Đại số', fraction: '🍕 Phân số', calculus: '∫ Giải tích', geometry: '📏 Hình học', logic: '🧠 Logic' };
      qt.textContent = topicLabels[state.question.topic] || '🎲 Tổng hợp';
      qt.className = 'topic-tag ' + (state.question.topic || 'algebra');
    }
    const qc = $('q-counter'); if (qc) qc.textContent = state.correct + 1;
    const livesDisplay = $('lives-display');
    if (livesDisplay) livesDisplay.innerHTML = `<span class="life">❤️</span>`;
  }

  function updateTimer() {
    const timeText = $('timer-text');
    const ring = $('timer-ring');
    if (!timeText || !ring) return;
    const maxTime = getTimeForLevel();
    const fraction = state.timeLeft / maxTime;
    const circumference = 163.36;
    ring.style.strokeDashoffset = circumference * (1 - fraction);
    timeText.textContent = Math.ceil(state.timeLeft);
    timeText.className = 'game-timer text-lg';
    if (state.timeLeft <= 3) { timeText.classList.add('danger'); ring.setAttribute('stroke', '#ff4757'); }
    else if (state.timeLeft <= maxTime * 0.4) { timeText.classList.add('warning'); ring.setAttribute('stroke', '#f1c40f'); }
    else { ring.setAttribute('stroke', '#ff6ac1'); }
  }

  function renderQuestion() {
    if (!state.question) return;
    const qText = $('question-text');
    const container = $('options-container');
    const feedback = $('game-feedback');
    if (qText) qText.textContent = state.question.question;
    if (feedback) feedback.textContent = '';
    if (container) {
      container.innerHTML = '';
      state.question.options.forEach((opt, i) => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        btn.innerHTML = `<span class="opt-letter">${String.fromCharCode(65 + i)}</span><span>${esc(opt)}</span>`;
        btn.addEventListener('click', () => handleAnswer(opt, btn));
        container.appendChild(btn);
      });
    }
    updateHUD();
    drawGraph(state.question);
    state.timeLeft = getTimeForLevel();
    updateTimer();
    clearInterval(state.timerInterval);
    state.timerInterval = setInterval(() => {
      state.timeLeft -= 0.1;
      if (state.timeLeft <= 0) { clearInterval(state.timerInterval); state.timeLeft = 0; updateTimer(); handleTimeout(); }
      else { updateTimer(); }
    }, 100);
  }

  function handleAnswer(selected, btn) {
    if (state.answered) return;
    state.answered = true;
    clearInterval(state.timerInterval);

    const correct = state.question.correct;
    const isCorrect = selected === correct;
    const allBtns = document.querySelectorAll('#options-container .option-btn');

    allBtns.forEach(b => {
      b.disabled = true;
      const text = b.querySelector('span:last-child')?.textContent || '';
      if (text === correct) b.classList.add('correct');
      else if (text === selected && !isCorrect) b.classList.add('wrong');
    });

    const feedback = $('game-feedback');
    const timeBonus = Math.round(state.timeLeft * 5);
    const basePoints = state.level * 100;
    const streakBonus = state.streak * 50;
    const points = basePoints + streakBonus + timeBonus;

    if (isCorrect) {
      state.correct++;
      state.streak++;
      state.maxStreak = Math.max(state.maxStreak, state.streak);
      state.score += points;
      state.level++;
      state.maxLevel = Math.max(state.maxLevel, state.level);
      if (feedback) feedback.innerHTML = `<span class="text-green-400">✅ Chính xác! +${points} điểm — Lên cấp ${state.level}! ${state.streak >= 2 ? `🔥 Streak x${state.streak}` : ''} ${timeBonus > 0 ? `(⚡ +${timeBonus} nhanh)` : ''}</span>`;
      const lb = $('level-badge');
      if (lb) { lb.classList.remove('up'); void lb.offsetWidth; lb.classList.add('up'); }
      setTimeout(() => {
        state.answered = false;
        state.question = generateQuestion();
        renderQuestion();
      }, 1200);
    } else {
      state.streak = 0;
      if (feedback) feedback.innerHTML = `<span class="text-red-400">❌ Sai! Đáp án đúng: <b>${esc(correct)}</b> — Game Over!</span>`;
      updateHUD();
      setTimeout(() => { endGame(); }, 1800);
    }
  }

  function handleTimeout() {
    if (state.answered) return;
    state.answered = true;
    state.streak = 0;
    const allBtns = document.querySelectorAll('#options-container .option-btn');
    allBtns.forEach(b => {
      b.disabled = true;
      const text = b.querySelector('span:last-child')?.textContent || '';
      if (text === state.question.correct) b.classList.add('correct');
    });
    const feedback = $('game-feedback');
    if (feedback) feedback.innerHTML = `<span class="text-yellow-400">⏰ Hết giờ! Đáp án: <b>${esc(state.question.correct)}</b> — Game Over!</span>`;
    updateHUD();
    setTimeout(() => { endGame(); }, 1800);
  }

  function initTabDetection() {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        if (state.playing) {
          tabHiddenTime = Date.now();
          state.tabSwitchPenalty = true;
          clearInterval(state.timerInterval);
          $('tab-warning').classList.remove('hidden');
          state.playing = false;
        }
      }
    });

    $('tab-warning-btn')?.addEventListener('click', () => {
      $('tab-warning').classList.add('hidden');
      if (state.tabSwitchPenalty) {
        state.tabSwitchPenalty = false;
        state.playing = false;
        clearInterval(state.timerInterval);
        $('game-play').classList.add('hidden');
        $('game-result').classList.remove('hidden');
        const re = $('result-emoji'), rt = $('result-title'), rsub = $('result-sub');
        if (re) re.textContent = '⚠️';
        if (rt) rt.textContent = 'Mất lượt!';
        if (rsub) rsub.textContent = `Bạn đã rời tab khi đang chơi. Cấp đạt: ${state.level}`;
        const rs = $('result-score'), rc = $('result-correct'), rl = $('result-level'), rst = $('result-streak');
        if (rs) rs.textContent = state.score;
        if (rc) rc.textContent = state.correct;
        if (rl) rl.textContent = state.level;
        if (rst) rst.textContent = state.maxStreak;
        saveHighscores();
        loadHighscores();
      }
    });
  }

  function endGame() {
    clearInterval(state.timerInterval);
    state.playing = false;
    $('game-play').classList.add('hidden');
    $('game-result').classList.remove('hidden');

    const rs = $('result-score'), rc = $('result-correct'), rl = $('result-level'), rst = $('result-streak'), re = $('result-emoji'), rt = $('result-title'), rsub = $('result-sub');
    if (rs) rs.textContent = state.score;
    if (rc) rc.textContent = state.correct;
    if (rl) rl.textContent = state.level;
    if (rst) rst.textContent = state.maxStreak;
    if (re) re.textContent = state.correct >= 10 ? '🏆' : state.correct >= 5 ? '🎉' : state.correct >= 2 ? '👍' : '💪';
    if (rt) rt.textContent = state.correct >= 10 ? 'Huyền thoại!' : state.correct >= 5 ? 'Xuất sắc!' : state.correct >= 2 ? 'Khá tốt!' : 'Cố gắng thêm!';
    if (rsub) rsub.textContent = `Bạn sống sót ${state.correct} câu — Cấp ${state.level}`;

    saveHighscores();
    loadHighscores();
  }

  function saveHighscores() {
    try {
      const hs = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      if (!hs.bestScore || state.score > hs.bestScore) hs.bestScore = state.score;
      if (!hs.bestStreak || state.maxStreak > hs.bestStreak) hs.bestStreak = state.maxStreak;
      if (!hs.bestLevel || state.maxLevel > hs.bestLevel) hs.bestLevel = state.maxLevel;
      hs.gamesPlayed = (hs.gamesPlayed || 0) + 1;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(hs));
    } catch {}
  }

  function loadHighscores() {
    try {
      const hs = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      const bs = $('best-score'), bst = $('best-streak'), bl = $('best-level');
      if (bs) bs.textContent = hs.bestScore || 0;
      if (bst) bst.textContent = hs.bestStreak || 0;
      if (bl) bl.textContent = hs.bestLevel || 1;
    } catch {}
  }

  function startGame() {
    state = { playing: true, level: 1, maxLevel: 1, score: 0, correct: 0, streak: 0, maxStreak: 0, timeLeft: 0, timerInterval: null, question: null, answered: false, tabSwitchPenalty: false, lives: 1 };
    $('game-start').classList.add('hidden');
    $('game-result').classList.add('hidden');
    $('game-play').classList.remove('hidden');
    $('tab-warning').classList.add('hidden');
    state.question = generateQuestion();
    renderQuestion();
    updateHUD();
  }

  function init() {
    const startBtn = $('game-start-btn');
    const restartBtn = $('game-restart');
    const homeBtn = $('game-home');

    startBtn?.addEventListener('click', startGame);
    restartBtn?.addEventListener('click', startGame);
    homeBtn?.addEventListener('click', () => { go('home'); });

    initTabDetection();
    loadHighscores();
  }

  return { init, state };
})();

// ═══════════════════════════════════════════════════════════════════
// BUG REPORT (giữ nguyên)
// ═══════════════════════════════════════════════════════════════════

function openBugModal() { Modal.open('bug-modal'); setTimeout(() => $('bug-name')?.focus(), 100); }
function closeBugModal() { Modal.close('bug-modal'); const s = $('bug-status'); if (s) s.style.display = 'none'; }

async function submitBugReport() {
  const name = $('bug-name')?.value.trim() || '(ẩn danh)';
  const type = $('bug-type')?.value;
  const desc = $('bug-desc')?.value.trim();
  const ctx = $('bug-context')?.value.trim() || '(không có)';
  if (!type) { showStatus('⚠️ Chọn loại lỗi', 'warn'); return; }
  if (!desc || desc.length < 10) { showStatus('⚠️ Mô tả >= 10 ký tự', 'warn'); return; }
  const btn = $('bug-submit'); const old = btn.textContent;
  btn.disabled = true; btn.textContent = '⏳ Đang gửi...';
  const statusEl = $('bug-status');
  statusEl.style.display = 'block';
  statusEl.innerHTML = '<span style="color:#f1c40f">⏳ Đang gửi...</span>';
  const payload = { name, type, description: desc, context: ctx, userAgent: navigator.userAgent.substring(0, 200), timestamp: new Date().toISOString() };
  let success = false;
  if (CONFIG.bugWebhook && CONFIG.bugWebhook.includes('/api/webhooks/') && !CONFIG.bugWebhook.includes('CHANGE_ME')) {
    try {
      const colorMap = { 'Không tìm thấy đáp án': 0xe74c3c, 'Đáp án sai': 0xe67e22, 'Không đọc được file': 0xf39c12, 'Lỗi CORS khi dán link': 0x9b59b6, 'Nhạc không phát': 0x4caf50, 'Âm lượng không hoạt động': 0x9b59b6, 'Giao diện lỗi': 0x3498db, 'Minigame lỗi': 0xe67e22, 'Khác': 0x95a5a6 };
      const embed = { title: `🐛 Báo lỗi mới — ${type}`, color: colorMap[type] || 0xff6ac1, fields: [{ name: '👤 Người báo', value: escMd(name), inline: true }, { name: '📁 Context', value: escMd(ctx).substring(0, 200), inline: true }, { name: '📝 Mô tả', value: escMd(desc).substring(0, 1000) }], footer: { text: `${CONFIG.brand.name} v${CONFIG.brand.version}` }, timestamp: payload.timestamp };
      const res = await fetch(CONFIG.bugWebhook, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'Answer Checker 🐱', embeds: [embed] }) });
      if (res.ok || res.status === 204) { success = true; statusEl.innerHTML = '<span style="color:#22c55e">✅ Đã gửi!</span>'; }
    } catch (err) { statusEl.innerHTML = '<span style="color:#f1c40f">⚠️ Lưu cục bộ</span>'; }
  } else { statusEl.innerHTML = '<span style="color:#f1c40f">ℹ️ Chưa cấu hình webhook, lưu cục bộ</span>'; }
  try { const arr = JSON.parse(localStorage.getItem('ac:bug_reports') || '[]'); arr.push(payload); if (arr.length > 50) arr.splice(0, arr.length - 50); localStorage.setItem('ac:bug_reports', JSON.stringify(arr)); } catch {}
  setTimeout(() => {
    btn.disabled = false; btn.textContent = old; closeBugModal();
    ['bug-name', 'bug-type', 'bug-desc', 'bug-context'].forEach(id => { const el = $(id); if (el) el.value = ''; });
    const cnt = $('bug-count'); if (cnt) cnt.textContent = '0';
    showStatus(success ? '✅ Cảm ơn báo cáo!' : 'ℹ️ Đã lưu cục bộ', success ? 'success' : 'info');
  }, 1500);
}

// ═══════════════════════════════════════════════════════════════════
// INIT ALL
// ═══════════════════════════════════════════════════════════════════

function initAll() {
  if (typeof QuizParser === 'undefined') {
    console.error('❌ QuizParser chưa được load. Kiểm tra file parser.js');
    alert('❌ Lỗi: Chưa load parser.js. Vui lòng kiểm tra file parser.js có được include trước app.js không.');
    return;
  }
  console.log(`%c🐱 ${CONFIG.brand.name} v${CONFIG.brand.version}`, 'color:#fff;background:#5865F2;padding:4px 10px;border-radius:4px;font-weight:bold');
  console.log(`%c✨ Made with 💖 by ${CONFIG.brand.author}`, 'color:#ff6ac1;font-weight:bold');
  console.log(`%c🔧 Parser loaded: v${QuizParser.version || 'unknown'}`, 'color:#8bc34a');
  console.log(`%c📋 Parser functions: ${Object.keys(QuizParser).join(', ')}`, 'color:#8bc34a;font-size:11px');

  // Check if formatAnswerDisplay is available
  if (typeof QuizParser.formatAnswerDisplay === 'function') {
    console.log('%c✅ formatAnswerDisplay available — MCQ sẽ hiện A/B/C/D đúng', 'color:#2ecc71;font-weight:bold');
  } else {
    console.warn('%c⚠️ formatAnswerDisplay không có — dùng fallback local', 'color:#f39c12;font-weight:bold');
  }

  initNavbar();
  initCheatPage();
  MathGame.init();
  $('fab-bug')?.addEventListener('click', openBugModal);
  $('bug-submit')?.addEventListener('click', submitBugReport);
  $('bug-desc')?.addEventListener('input', e => { const c = $('bug-count'); if (c) c.textContent = e.target.value.length; });
  $('bug-modal')?.addEventListener('click', e => { if (e.target === $('bug-modal')) closeBugModal(); });
  $('open-bug-from-guide')?.addEventListener('click', openBugModal);
  document.addEventListener('click', e => {
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (!action) return;
    if (action === 'close-bug') closeBugModal();
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') Modal.closeAll(); });
  console.log('%c✅ Ready', 'color:#2ecc71;font-weight:bold');
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initAll);
else initAll();

// Expose để HTML có thể gọi
window.AnswerChecker = { go, showStatus, showLoading, Modal };

})();
