// ═══════════════════════════════════════════════════════════════════
// 🐱 ANSWER CHECKER — QUIZ PARSER v37.0.1 (FULL + TF-ARRAY-FIX)
// "Context-Aware + Bulletproof + Self-Verify"
// ═══════════════════════════════════════════════════════════════════

(function(global) {
  'use strict';

  const VERSION = '37.0.1';
  const DEBUG = false;
  const _startupTime = Date.now();

  // ═══════════════════════════════════════════════════════════════
  // CONSTANTS
  // ═══════════════════════════════════════════════════════════════

  const HELPER_NAME_WHITELIST = [
    'q', 'tf', 'st', 'sh', 'mc', 'sa', 'dq', 'dt', 'ds', 'tfq', 'sq',
    'mcq', 'makeQ', 'makeMCQ', 'trueFalse', 'makeTF', 'tfQ',
    'short', 'shortQ', 'makeShort', 'statement', 'makeST',
    'question', 'makeQuestion', 'makeD', 'makeDeck',
    'tn', 'tl', 'dung', 'sai', 'cau', 'cauhoi',
    'createQ', 'createMCQ', 'addQ', 'newQ',
  ];

  const GENERIC_HELPERS = {
    q: (text, opts, correct, topic) => ({ q: text, o: opts, c: correct, t: topic }),
    mcq: (text, opts, correct, topic) => ({ q: text, o: opts, c: correct, t: topic }),
    mc: (text, opts, correct, topic) => ({ type: "mcq", q: text, opts: opts, ans: correct, topic: topic }),
    tn: (text, opts, correct, topic) => ({ q: text, o: opts, c: correct, t: topic }),
    tf: (text, statements, topic) => ({ type: "tf", stem: text, items: statements, topic: topic, q: text, s: statements, t: topic }),
    sh: (text, answer, topic) => ({ q: text, a: answer, t: topic }),
    sa: (text, answer, topic) => ({ type: "short", q: text, ans: answer, topic: topic, a: answer, t: topic }),
    st: (text, correct, level) => ({ text: text, answer: correct, level: level, x: text, c: correct, l: level }),
    ds: (text, correct, level) => ({ text: text, answer: correct, level: level, x: text, c: correct, l: level }),
  };

  const FIELD_ALIASES = {
    question: ['question', 'q', 'text', 'prompt', 'title', 'stem', 'content'],
    options: ['options', 'opts', 'choices', 'option', 'opt', 'o'],
    answer: ['answer', 'ans', 'correct', 'c', 'a', 'correctAnswer', 'key'],
    type: ['type', 'questionType', 'kind', 'format'],
    statements: ['statements', 'subs', 'items', 's', 'claims', 'assertions'],
    stText: ['text', 'x', 'statement', 'content', 't'],
    stAnswer: ['answer', 'correct', 'c', 'v', 'val', 'a', 'isCorrect'],
    // 🆕 v37.0.1: Mảng đáp án riêng cho câu hỏi Đúng/Sai
    answersArray: ['answers', 'stAnswers', 'correctAnswers', 'answerArray', 'ansArray', 'answerList'],
    explanation: ['explanation', 'explain', 'solution', 'note', 'hint'],
    topic: ['topic', 't', 'subject', 'category', 'chapter', 'tag'],
    level: ['level', 'lvl', 'difficulty', 'l', 'bloom'],
    name: ['name', 'title', 'label'],
  };

  const VAR_NAMES = [
    'quizData', 'allQuestions', 'questions', 'quizBank', 'QUIZ_DATA',
    'data', 'quiz', 'questionsData', 'questionBank', 'examData',
    'testData', 'QUIZ', 'EXAM', 'QUESTIONS', 'bank', 'problems',
    'items', 'content', 'exercises', 'lesson', 'homework',
    'assignment', 'test', 'exam', 'QUESTION_SETS', 'EXAMS',
    'EXAM_SETS', 'TEST_SETS', 'QUIZ_SETS', 'DATA', 'TESTS', 'SETS',
    'DECK', 'DECKS', 'SET', 'BANK', 'POOL',
    'MCQ_DATA', 'TF_DATA', 'SA_DATA',
    'cauHoi', 'deThi', 'deKiemTra', 'baiThi', 'tracNghiem',
  ];

  const CHAIN_VAR_PATTERNS = [
    /^de\d+_(mcq|mc|tf|short|sa)$/i,
    /^deck\d+_(mcq|mc|tf|short|sa)$/i,
    /^set\d+_(mcq|mc|tf|short|sa)$/i,
    /^exam\d+_(mcq|mc|tf|short|sa)$/i,
    /^test\d+_(mcq|mc|tf|short|sa)$/i,
    /^quiz\d+_(mcq|mc|tf|short|sa)$/i,
    /^đề\d+_(mcq|mc|tf|short|sa)$/i,
    /^bộ\d+_(mcq|mc|tf|short|sa)$/i,
    /^de\d+(mcq|tf|short|sa)$/i,
    /^[_$][a-z]+\d+_[a-z]+$/i,
    /^(questions|items|list|bank|pool)\d+$/i,
  ];

  const TYPE_ALIASES = {
    mcq: ['mcq', 'mc', 'choice', 'tn', 'tracnghiem', 'parti', 'part1', 'i'],
    tf: ['tf', 'truefalse', 'ds', 'dungsai', 'partii', 'part2', 'ii'],
    short: ['short', 'sa', 'tl', 'partiii', 'part3', 'iii'],
  };

  const PART_KEY_MAP = {
    'parti': 'mcq', 'part1': 'mcq', 'mc': 'mcq', 'mcq': 'mcq', 'tn': 'mcq',
    'partii': 'tf', 'part2': 'tf', 'tf': 'tf', 'truefalse': 'tf', 'ds': 'tf',
    'partiii': 'short', 'part3': 'short', 'sa': 'short', 'short': 'short', 'tl': 'short',
  };

  // ═══════════════════════════════════════════════════════════════
  // UNIVERSAL FORMATTER
  // ═══════════════════════════════════════════════════════════════

  function formatAnswerDisplay(answer, options = null, type = 'mcq') {
    const result = { value: answer, index: null, letter: null, display: '?', valid: false };
    if (answer === null || answer === undefined) { result.display = '(chưa có đáp án)'; return result; }
    if (type === 'tf') {
      const b = toBoolean(answer);
      if (b === true) { result.value = true; result.display = 'Đúng'; result.valid = true; }
      else if (b === false) { result.value = false; result.display = 'Sai'; result.valid = true; }
      else result.display = String(answer);
      return result;
    }
    if (type === 'short') {
      result.value = String(answer).trim();
      result.display = result.value;
      result.valid = true;
      return result;
    }
    let idx = -1;
    if (typeof answer === 'number') { if (answer >= 0 && answer < 26) idx = answer; }
    else if (typeof answer === 'string') {
      const trimmed = answer.trim();
      if (/^[A-Z]$/i.test(trimmed)) idx = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.indexOf(trimmed.toUpperCase());
      else if (/^([A-Z])\s*[.):\-\s]/i.test(trimmed)) { const m = trimmed.match(/^([A-Z])/i); if (m) idx = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.indexOf(m[1].toUpperCase()); }
      else if (/^\d+$/.test(trimmed)) { const num = parseInt(trimmed, 10); if (num >= 0 && num < 26) idx = num; }
      else if (Array.isArray(options)) idx = options.findIndex(o => String(o).trim() === trimmed);
    }
    if (idx >= 0 && idx < 26) {
      const letter = String.fromCharCode(65 + idx);
      const optText = Array.isArray(options) && options[idx] ? options[idx] : '';
      result.index = idx; result.letter = letter; result.value = letter;
      result.display = optText ? `${letter}. ${optText}` : letter;
      result.valid = true;
    } else result.display = String(answer);
    return result;
  }

  function toBoolean(val) {
    if (val === null || val === undefined) return null;
    if (typeof val === 'boolean') return val;
    if (typeof val === 'number') return val === 1 ? true : (val === 0 ? false : null);
    if (typeof val === 'string') {
      const t = val.trim().toLowerCase();
      if (['1', 'true', 't', 'y', 'yes', 'đúng', 'dung', 'phải', 'correct', 'right', 'ok'].includes(t)) return true;
      if (['0', 'false', 'f', 'n', 'no', 'sai', 'không', 'khong', 'wrong', 'incorrect', 'fail'].includes(t)) return false;
    }
    return null;
  }

  // ═══════════════════════════════════════════════════════════════
  // VISIBLE DOM EXTRACTOR
  // ═══════════════════════════════════════════════════════════════

  function isElementVisible(el) {
    if (!el || !el.getBoundingClientRect) return false;
    try {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return false;
      const style = el.ownerDocument?.defaultView?.getComputedStyle(el);
      if (!style) return true;
      if (style.display === 'none') return false;
      if (style.visibility === 'hidden') return false;
      if (parseFloat(style.opacity) === 0) return false;
      return true;
    } catch (e) { return false; }
  }

  function extractVisibleQuestionDetail(el) {
    if (!el) return null;
    const doc = el.ownerDocument;
    if (!doc) return null;

    let questionText = '';
    const qTextSelectors = ['.qtext', '.q-title', '.question-text', '.q-text', '.stem', '.question-title', '.question-content', 'h3', 'h4', 'p.q', '.q'];
    for (const sel of qTextSelectors) {
      try {
        const found = el.querySelector(sel);
        if (found && isElementVisible(found)) {
          questionText = found.textContent.trim();
          if (questionText) break;
        }
      } catch (e) {}
    }
    if (!questionText) {
      const firstLine = el.textContent.trim().split('\n')[0];
      if (firstLine && firstLine.length < 500) questionText = firstLine;
    }

    const options = [];
    const radios = el.querySelectorAll('input[type="radio"]');
    if (radios.length > 0) {
      radios.forEach(radio => {
        let label = null;
        if (radio.id) { try { label = el.querySelector(`label[for="${radio.id}"]`); } catch (e) {} }
        if (!label) label = radio.closest('label');
        if (label && isElementVisible(label)) {
          let optText = label.textContent.trim();
          optText = optText.replace(/^\s*[A-Z]\s*[.):]\s*/i, '').trim();
          if (optText) options.push(optText);
        }
      });
    }
    if (options.length === 0) {
      const optSelectors = ['.opt', '.option', '.answer', '.choice', '.answer-option', 'li.option'];
      for (const sel of optSelectors) {
        const found = el.querySelectorAll(sel);
        if (found.length >= 2) {
          found.forEach(opt => {
            if (isElementVisible(opt)) {
              let optText = opt.textContent.trim();
              optText = optText.replace(/^\s*[A-Z]\s*[.):]\s*/i, '').trim();
              if (optText) options.push(optText);
            }
          });
          break;
        }
      }
    }

    let answer = null, answerText = null;
    const correctSelectors = ['.correct', '.correct-answer', '.right', '[class*="correct"]', '[data-correct="true"]'];
    for (const sel of correctSelectors) {
      try {
        const correctEl = el.querySelector(sel);
        if (correctEl && isElementVisible(correctEl)) {
          const correctText = correctEl.textContent.replace(/^\s*[A-Z]\s*[.):]\s*/i, '').trim();
          const idx = options.findIndex(o => o === correctText || correctText.includes(o) || o.includes(correctText));
          if (idx >= 0) { answer = idx; answerText = options[idx]; break; }
        }
      } catch (e) {}
    }

    let type = 'mcq';
    if (options.length === 0) type = 'short';
    else if (options.length === 2 && options.every(o => /^(đúng|sai|true|false|t|f)$/i.test(o.trim()))) type = 'tf';

    return { question: questionText, options: options.length > 0 ? options : null, answer, answerText, type, _fromVisual: true };
  }

  function extractVisibleQuestions(doc, options = {}) {
    if (!doc) return [];
    const {
      containerSelectors = [
        '.question', '.q-card', '.qcard', '.question-card', '.q-box',
        '[data-question]', '[data-qid]', '.quiz-question', '.quiz-item',
        '.question-item', 'fieldset', '.form-group', 'li.question',
        '[class*="question"]', '[class*="q-"]',
      ],
      minTextLength = 10,
    } = options;

    const results = [];
    const seen = new Set();
    const candidates = new Set();
    for (const sel of containerSelectors) {
      try { doc.querySelectorAll(sel).forEach(el => candidates.add(el)); } catch (e) {}
    }
    const filtered = [...candidates].filter(el => ![...candidates].some(other => other !== el && other.contains(el)));

    for (const el of filtered) {
      if (!isElementVisible(el)) continue;
      const text = (el.textContent || '').trim();
      if (text.length < minTextLength) continue;
      const hash = text.substring(0, 80);
      if (seen.has(hash)) continue;
      seen.add(hash);
      const q = extractVisibleQuestionDetail(el);
      if (q) results.push(q);
    }
    return results;
  }

  // ═══════════════════════════════════════════════════════════════
  // 🆕 v37: SCREEN STATE DETECTOR
  // ═══════════════════════════════════════════════════════════════

  function detectScreenState(doc) {
    if (!doc) return { state: 'unknown' };

    const body = doc.body;
    if (!body) return { state: 'unknown' };

    const visibleQuestions = extractVisibleQuestions(doc);
    const hasQuestions = visibleQuestions.length > 0;
    const startBtn = detectStartButton(doc);
    const hasStartBtn = startBtn !== null;
    const deckButtons = detectDeckButtons(doc);
    const hasResultText = /kết\s*quả|điểm\s*số|score|result|hoàn\s*thành|xem\s*lại/i.test(body.textContent.substring(0, 5000));
    const progressMatch = body.textContent.match(/câu\s*(\d+)\s*[\/]\s*(\d+)/i) ||
                          body.textContent.match(/question\s*(\d+)\s*[\/]\s*(\d+)/i);
    const progress = progressMatch ? { current: parseInt(progressMatch[1]), total: parseInt(progressMatch[2]) } : null;

    if (hasQuestions && progress) {
      return { state: 'quiz-in-progress', questions: visibleQuestions, progress, hasStartBtn };
    }
    if (hasQuestions && !progress) {
      return { state: 'quiz-all-visible', questions: visibleQuestions, hasStartBtn };
    }
    if (deckButtons.length > 0 && !hasQuestions) {
      return { state: 'menu', decks: deckButtons, hasStartBtn };
    }
    if (hasStartBtn && !hasQuestions) {
      return { state: 'start-screen', hasStartBtn: true };
    }
    if (hasResultText && !hasQuestions) {
      return { state: 'result' };
    }

    return { state: 'unknown' };
  }

  function detectStartButton(doc) {
    if (!doc) return null;
    const patterns = [
      /^(start|begin|bắt\s*đầu|làm\s*bài|vào\s*thi|bắt\s*đầu\s*làm|start\s*quiz|play|bắt\s*đầu\s*thử|thi\s*thử)$/i,
      /^(bắt\s*đầu|start)/i,
    ];
    const buttons = doc.querySelectorAll('button, a[role="button"], .btn, [class*="btn"], [class*="button"]');
    for (const btn of buttons) {
      const text = (btn.textContent || '').trim().toLowerCase();
      if (text.length > 30) continue;
      if (patterns.some(p => p.test(text))) {
        if (isElementVisible(btn)) return btn;
      }
    }
    return null;
  }

  function detectDeckButtons(doc) {
    if (!doc) return [];
    const decks = [];
    const patterns = [
      /^(đề|de|chương|chapter|bài|bai|phần|phan|test|quiz|set)\s*[\dIVX]+$/i,
      /^(đề|de)\s*\d+/i,
      /^(chương|chapter)\s*\d+/i,
      /^bài\s*\d+/i,
    ];
    const buttons = doc.querySelectorAll('button, a[role="button"], .btn, [class*="btn"], li[class*="item"], [class*="deck"]');
    const seen = new Set();
    for (const btn of buttons) {
      const text = (btn.textContent || '').trim();
      if (!text || text.length > 60) continue;
      if (patterns.some(p => p.test(text))) {
        if (!isElementVisible(btn)) continue;
        const hash = text.substring(0, 40);
        if (seen.has(hash)) continue;
        seen.add(hash);
        decks.push({
          label: text,
          element: btn,
          dataAttrs: {
            'data-id': btn.dataset?.id || null,
            'data-deck': btn.dataset?.deck || null,
            'data-href': btn.href || null,
          },
        });
      }
    }
    return decks;
  }

  function detectActiveQuestion(doc) {
    if (!doc) return null;

    const activeSelectors = [
      '.question.active', '.question.current', '.question.show',
      '.q-card.active', '.q-card.current',
      '[class*="question"][class*="active"]',
      '[class*="question"][class*="current"]',
      '[class*="q-"][class*="active"]',
      '[aria-current="true"]',
      '.active.question', '.slide.active .question',
    ];

    for (const sel of activeSelectors) {
      try {
        const found = doc.querySelectorAll(sel);
        for (const el of found) {
          if (!isElementVisible(el)) continue;
          const q = extractVisibleQuestionDetail(el);
          if (q && q.question) {
            q._isActive = true;
            return q;
          }
        }
      } catch (e) {}
    }

    const visible = extractVisibleQuestions(doc);
    if (visible.length === 1) {
      visible[0]._isActive = true;
      return visible[0];
    }
    return null;
  }

  // ═══════════════════════════════════════════════════════════════
  // 🆕 v37: LIVE CONTEXT WATCHER
  // ═══════════════════════════════════════════════════════════════

  function createLiveContextWatcher(options = {}) {
    const {
      pollIntervalMs = 1500,
      onChange = null,
      onScreenChange = null,
    } = options;

    let lastState = null;
    let lastActiveQuestion = null;
    let timer = null;
    let iframeRef = null;

    function check() {
      if (!iframeRef || !iframeRef.contentDocument) return;
      try {
        const doc = iframeRef.contentDocument;
        const screenState = detectScreenState(doc);
        const activeQ = detectActiveQuestion(doc);

        const screenChanged = !lastState || lastState.state !== screenState.state;
        const questionChanged = !lastActiveQuestion ||
                                (activeQ && lastActiveQuestion.question !== activeQ.question);

        if (screenChanged) {
          lastState = screenState;
          if (typeof onScreenChange === 'function') {
            try { onScreenChange(screenState); } catch (e) {}
          }
        }
        if (questionChanged && activeQ) {
          lastActiveQuestion = activeQ;
          if (typeof onChange === 'function') {
            try { onChange({ screenState, activeQuestion: activeQ }); } catch (e) {}
          }
        }
      } catch (e) {}
    }

    return {
      attach(iframe) {
        iframeRef = iframe;
        lastState = null;
        lastActiveQuestion = null;
        if (timer) clearInterval(timer);
        timer = setInterval(check, pollIntervalMs);
        setTimeout(check, 500);
      },
      detach() {
        if (timer) { clearInterval(timer); timer = null; }
        iframeRef = null;
        lastState = null;
        lastActiveQuestion = null;
      },
      getState: () => lastState,
      getActiveQuestion: () => lastActiveQuestion,
    };
  }

  function watchCurrentPage(options = {}) {
    const {
      pollIntervalMs = 1500,
      onChange = null,
      onScreenChange = null,
    } = options;

    let lastState = null;
    let lastActiveQuestion = null;
    let timer = null;

    function check() {
      try {
        const doc = document;
        const screenState = detectScreenState(doc);
        const activeQ = detectActiveQuestion(doc);

        const screenChanged = !lastState || lastState.state !== screenState.state;
        const questionChanged = !lastActiveQuestion ||
                                (activeQ && lastActiveQuestion.question !== activeQ.question);

        if (screenChanged) {
          lastState = screenState;
          if (typeof onScreenChange === 'function') {
            try { onScreenChange(screenState); } catch (e) {}
          }
        }
        if (questionChanged && activeQ) {
          lastActiveQuestion = activeQ;
          if (typeof onChange === 'function') {
            try { onChange({ screenState, activeQuestion: activeQ }); } catch (e) {}
          }
        }
      } catch (e) {}
    }

    return {
      start() {
        if (timer) clearInterval(timer);
        timer = setInterval(check, pollIntervalMs);
        setTimeout(check, 500);
      },
      stop() {
        if (timer) { clearInterval(timer); timer = null; }
      },
      getState: () => lastState,
      getActiveQuestion: () => lastActiveQuestion,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // AUTO-CLICK START
  // ═══════════════════════════════════════════════════════════════

  async function autoStartQuizInIframe(iframe, options = {}) {
    const { onProgress = null, maxWaitMs = 8000, pollIntervalMs = 500 } = options;
    if (!iframe || !iframe.contentDocument) return { started: false };

    const doc = iframe.contentDocument;
    const startPatterns = [
      /start/i, /begin/i, /bắt\s*đầu/i, /làm\s*bài/i, /vào\s*thi/i,
      /bắt\s*đầu\s*làm/i, /start\s*quiz/i, /play/i, /bắt\s*đầu\s*thử/i,
    ];
    const buttons = doc.querySelectorAll('button, a[role="button"], .btn, [class*="btn"]');
    let startBtn = null;
    for (const btn of buttons) {
      const text = (btn.textContent || '').trim();
      if (startPatterns.some(p => p.test(text))) { startBtn = btn; break; }
    }
    if (startBtn && isElementVisible(startBtn)) {
      if (onProgress) onProgress('🎬 Đang click nút Start...');
      try { startBtn.click(); } catch (e) {}
    }
    if (onProgress) onProgress('⏳ Chờ quiz render...');
    const startTime = Date.now();
    while (Date.now() - startTime < maxWaitMs) {
      await new Promise(r => setTimeout(r, pollIntervalMs));
      try {
        const questions = extractVisibleQuestions(doc);
        if (questions.length > 0) {
          if (onProgress) onProgress(`✅ Đã thấy ${questions.length} câu hỏi visible`);
          return { started: true, questionCount: questions.length };
        }
      } catch (e) {}
    }
    return { started: !!startBtn, questionCount: 0, timeout: true };
  }

  // ═══════════════════════════════════════════════════════════════
  // INSPECT IFRAME FULLY
  // ═══════════════════════════════════════════════════════════════

  async function inspectIframeFully(url, options = {}) {
    if (typeof document === 'undefined') return { success: false, error: 'No DOM' };
    const {
      onProgress = null,
      waitMs = 4000,
      timeoutMs = 25000,
      autoStart = true,
    } = options;

    return new Promise((resolve) => {
      let iframe = null, timeoutTimer = null, resolved = false;
      const captured = [];

      const cleanup = () => {
        if (timeoutTimer) clearTimeout(timeoutTimer);
        if (iframe && iframe.parentNode) { try { iframe.parentNode.removeChild(iframe); } catch (e) {} }
      };
      const finish = (result) => {
        if (resolved) return;
        resolved = true;
        cleanup();
        resolve(result);
      };

      try {
        if (onProgress) onProgress('🔍 Đang load iframe (full inspect)...');
        iframe = document.createElement('iframe');
        iframe.style.cssText = 'position:fixed;left:-99999px;top:-99999px;width:1400px;height:1000px;border:0;visibility:hidden;';
        iframe.src = url;

        iframe.onload = async () => {
          try {
            if (onProgress) onProgress('✅ Iframe loaded');
            const win = iframe.contentWindow;
            const doc = iframe.contentDocument;
            if (!doc) return finish({ success: false, error: 'Không truy cập DOM iframe (CORS)' });

            try {
              const origFetch = win.fetch;
              const origXHROpen = win.XMLHttpRequest.prototype.open;
              const origXHRSend = win.XMLHttpRequest.prototype.send;

              win.fetch = function(...args) {
                const reqUrl = typeof args[0] === 'string' ? args[0] : (args[0]?.url || '');
                return origFetch.apply(this, args).then(async (res) => {
                  try {
                    const clone = res.clone();
                    const text = await clone.text();
                    if (text && text.length > 50 && /"question"|"answer"|"options"|câu\s*hỏi|đáp\s*án/i.test(text)) {
                      captured.push({ type: 'fetch', url: reqUrl, body: text, size: text.length });
                      if (onProgress) onProgress(`🌐 NET: ${reqUrl.substring(0, 40)}... (${text.length}b)`);
                    }
                  } catch (e) {}
                  return res;
                });
              };

              win.XMLHttpRequest.prototype.open = function(method, reqUrl, ...rest) {
                this.__ac_url = reqUrl;
                return origXHROpen.call(this, method, reqUrl, ...rest);
              };
              win.XMLHttpRequest.prototype.send = function(...args) {
                this.addEventListener('load', () => {
                  try {
                    const text = this.responseText || '';
                    if (text && text.length > 50 && /"question"|"answer"|"options"|câu\s*hỏi|đáp\s*án/i.test(text)) {
                      captured.push({ type: 'xhr', url: this.__ac_url || '', body: text, size: text.length });
                    }
                  } catch (e) {}
                });
                return origXHRSend.apply(this, args);
              };
            } catch (e) {
              if (onProgress) onProgress('⚠️ Không hook được network: ' + e.message);
            }

            if (autoStart) {
              await autoStartQuizInIframe(iframe, { onProgress });
            }

            await new Promise(r => setTimeout(r, waitMs));

            if (onProgress) onProgress('👁️ Đang đọc DOM visible...');
            const visibleQs = extractVisibleQuestions(doc);

            let fullHtml = '';
            try { fullHtml = doc.documentElement.outerHTML; } catch (e) {}

            let scriptDecks = [];
            if (fullHtml && fullHtml.length > 100) {
              try {
                const r = extractQuizData(fullHtml);
                if (r && r.data) {
                  scriptDecks = normalizeDecks(r.data);
                  scriptDecks.forEach(d => d.name = `📜 IFRAME: ${d.name}`);
                }
              } catch (e) {}
            }

            const networkDecks = [];
            for (const cap of captured) {
              try {
                let json = null;
                try { json = JSON.parse(cap.body); } catch {}
                const dataToParse = json || cap.body;
                const r = extractQuizData(typeof dataToParse === 'string' ? dataToParse : JSON.stringify(dataToParse));
                if (r && r.data) {
                  const decks = normalizeDecks(r.data);
                  decks.forEach(d => { d.name = `🌐 NET: ${d.name}`; networkDecks.push(d); });
                }
              } catch (e) {}
            }

            const visualDecks = [];
            if (visibleQs.length > 0) {
              visualDecks.push({
                name: '👁️ USER ĐANG THẤY (DOM visible)',
                questions: visibleQs.map(q => ({
                  type: q.type,
                  question: q.question,
                  options: q.options,
                  answer: q.answer,
                  answerText: q.answerText,
                  _fromVisual: true,
                })),
              });
            }

            const screenState = detectScreenState(doc);

            finish({
              success: true,
              visibleDecks: visualDecks,
              scriptDecks,
              networkDecks,
              capturedCount: captured.length,
              visibleCount: visibleQs.length,
              html: fullHtml,
              screenState,
            });
          } catch (e) {
            finish({ success: false, error: 'Inspect error: ' + e.message });
          }
        };

        iframe.onerror = () => finish({ success: false, error: 'Iframe load error' });
        document.body.appendChild(iframe);

        timeoutTimer = setTimeout(() => {
          finish({ success: false, error: `Timeout ${timeoutMs / 1000}s`, partial: { capturedCount: captured.length } });
        }, timeoutMs);
      } catch (e) {
        finish({ success: false, error: e.message });
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // CROSS-CHECK RESULTS
  // ═══════════════════════════════════════════════════════════════

  function crossCheckResults(scriptResult, iframeResult) {
    if (!scriptResult && !iframeResult) return { data: null, method: 'none', confidence: 0 };
    if (!scriptResult) return { data: (iframeResult && iframeResult.decks) || [], method: 'iframe-only', confidence: 80 };
    if (!iframeResult || !iframeResult.success) return { data: (scriptResult && scriptResult.decks) || [], method: 'script-only', confidence: 70 };

    const scriptDecks = (scriptResult && scriptResult.decks) || [];
    const iframeDecks = (iframeResult.decks || iframeResult.scriptDecks) || [];
    const scriptCount = scriptDecks.reduce((s, d) => s + (d.questions ? d.questions.length : 0), 0);
    const iframeCount = iframeDecks.reduce((s, d) => s + (d.questions ? d.questions.length : 0), 0);

    const scriptTexts = new Set();
    scriptDecks.forEach(d => (d.questions || []).forEach(q => scriptTexts.add((q.question || '').substring(0, 60))));
    const iframeTexts = new Set();
    iframeDecks.forEach(d => (d.questions || []).forEach(q => iframeTexts.add((q.question || '').substring(0, 60))));

    let overlap = 0;
    iframeTexts.forEach(t => { if (scriptTexts.has(t)) overlap++; });
    const overlapRatio = iframeTexts.size > 0 ? overlap / iframeTexts.size : 0;

    if (overlapRatio > 0.8) {
      return {
        data: scriptDecks,
        method: 'script-preferred',
        confidence: 95,
        crossCheck: { overlapRatio, scriptCount, iframeCount, decision: 'script' },
      };
    }
    if (iframeCount >= scriptCount * 0.5) {
      return {
        data: iframeDecks,
        method: 'iframe-preferred',
        confidence: 100,
        crossCheck: { overlapRatio, scriptCount, iframeCount, decision: 'iframe' },
      };
    }
    const merged = [...scriptDecks];
    iframeDecks.forEach(d => {
      const exists = merged.some(m => m.name === d.name);
      if (!exists) merged.push(d);
    });
    return {
      data: merged,
      method: 'merged',
      confidence: 85,
      crossCheck: { overlapRatio, scriptCount, iframeCount, decision: 'merge' },
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // GROUND TRUTH RESOLVER
  // ═══════════════════════════════════════════════════════════════

  function resolveGroundTruth(sources = {}) {
    const {
      scriptResult = null,
      iframeResult = null,
      networkDecks = [],
      visibleDecks = [],
      staticDecks = [],
    } = sources;

    if (networkDecks && networkDecks.length > 0) {
      const total = networkDecks.reduce((s, d) => s + (d.questions ? d.questions.length : 0), 0);
      return {
        decks: networkDecks,
        source: 'network',
        confidence: 100,
        reason: `Bắt được ${networkDecks.length} đề từ network (${total} câu)`,
      };
    }

    if (visibleDecks && visibleDecks.length > 0) {
      const total = visibleDecks.reduce((s, d) => s + (d.questions ? d.questions.length : 0), 0);
      return {
        decks: visibleDecks,
        source: 'visible-dom',
        confidence: 95,
        reason: `Đọc ${total} câu trực tiếp từ DOM visible`,
      };
    }

    if (iframeResult && iframeResult.scriptDecks && iframeResult.scriptDecks.length > 0) {
      return {
        decks: iframeResult.scriptDecks,
        source: 'iframe-script',
        confidence: 80,
        reason: `Parse ${iframeResult.scriptDecks.length} đề từ iframe HTML`,
      };
    }

    if (scriptResult && scriptResult.decks && scriptResult.decks.length > 0) {
      return {
        decks: scriptResult.decks,
        source: 'static-script',
        confidence: 60,
        reason: `Parse ${scriptResult.decks.length} đề từ HTML tĩnh`,
      };
    }

    return { decks: [], source: 'none', confidence: 0, reason: 'Không có nguồn nào khả dụng' };
  }

  // ═══════════════════════════════════════════════════════════════
  // SMART INSPECT (Script + Iframe + Network + Visible)
  // ═══════════════════════════════════════════════════════════════

  async function smartInspect(url, options = {}) {
    const { onProgress = null } = options;
    if (onProgress) onProgress('🚀 Bắt đầu phân tích đa tầng...');

    let scriptResult = null;
    let staticDecks = [];
    try {
      if (onProgress) onProgress('📡 Tầng 1/3: Fetch HTML tĩnh...');
      const { html, proxy } = await fetchUrlWithProxies(url, options);
      scriptResult = extractQuizData(html);
      scriptResult.proxyUsed = proxy;
      const decks = normalizeDecks(scriptResult.data);
      const awareness = applyShuffleAwareness(decks, scriptResult.shuffle);
      staticDecks = awareness.decks;
      scriptResult.decks = staticDecks;
      scriptResult.awareness = awareness.stats;
    } catch (e) {
      if (onProgress) onProgress('⚠️ Tầng 1 thất bại: ' + e.message);
    }

    let iframeResult = null;
    try {
      if (onProgress) onProgress('🔍 Tầng 2/3: Load iframe (auto-start + network + DOM)...');
      iframeResult = await inspectIframeFully(url, {
        onProgress,
        waitMs: options.iframeWaitMs || 4000,
        timeoutMs: options.iframeTimeoutMs || 25000,
        autoStart: options.autoStart !== false,
      });
    } catch (e) {
      if (onProgress) onProgress('⚠️ Tầng 2 thất bại: ' + e.message);
    }

    if (onProgress) onProgress('🎯 Tầng 3/3: Xác định ground truth...');
    const networkDecks = (iframeResult && iframeResult.networkDecks) || [];
    const visibleDecks = (iframeResult && iframeResult.visibleDecks) || [];

    const groundTruth = resolveGroundTruth({
      scriptResult,
      iframeResult,
      networkDecks,
      visibleDecks,
      staticDecks,
    });

    if (groundTruth.source === 'visible-dom' && staticDecks.length > 0) {
      const scriptQuestions = new Map();
      staticDecks.forEach(d => (d.questions || []).forEach(q => {
        const key = (q.question || '').substring(0, 60);
        scriptQuestions.set(key, q);
      }));
      groundTruth.decks.forEach(deck => {
        (deck.questions || []).forEach(q => {
          const key = (q.question || '').substring(0, 60);
          const scriptQ = scriptQuestions.get(key);
          if (scriptQ) {
            q.answer = scriptQ.answer;
            q.answerText = scriptQ.answerText;
            q.answerIndex = scriptQ.answerIndex;
            q.answerDisplay = scriptQ.answerDisplay;
            q._mergedFromScript = true;
          }
        });
      });
    }

    return {
      ...groundTruth,
      scriptResult,
      iframeResult,
      networkCount: networkDecks.length,
      visibleCount: visibleDecks.length,
      staticCount: staticDecks.length,
      proxyUsed: scriptResult ? scriptResult.proxyUsed : null,
      shuffle: scriptResult ? scriptResult.shuffle : null,
      awareness: scriptResult ? scriptResult.awareness : null,
      screenState: iframeResult && iframeResult.screenState ? iframeResult.screenState : null,
      crossCheck: iframeResult ? {
        capturedNetwork: (iframeResult.capturedCount || 0),
        visibleQuestions: (iframeResult.visibleCount || 0),
      } : null,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // 🆕 v37: SMART CONTEXT INSPECT
  // Quyết định show gì tùy theo screen state
  // ═══════════════════════════════════════════════════════════════

  async function smartContextInspect(url, options = {}) {
    const { onProgress = null, waitMs = 4000, timeoutMs = 25000, autoStart = true } = options;

    return new Promise((resolve) => {
      let iframe = null, timeoutTimer = null, resolved = false;
      let liveWatcher = null;

      const cleanup = () => {
        if (timeoutTimer) clearTimeout(timeoutTimer);
        if (liveWatcher) try { liveWatcher.detach(); } catch (e) {}
        if (iframe && iframe.parentNode) { try { iframe.parentNode.removeChild(iframe); } catch (e) {}
        }
      };
      const finish = (result) => {
        if (resolved) return;
        resolved = true;
        cleanup();
        resolve(result);
      };

      try {
        if (onProgress) onProgress('🔍 Đang mở quiz...');

        iframe = document.createElement('iframe');
        iframe.style.cssText = 'position:fixed;left:-99999px;top:-99999px;width:1400px;height:1000px;border:0;visibility:hidden;';
        iframe.src = url;

        iframe.onload = async () => {
          try {
            if (onProgress) onProgress('✅ Quiz loaded');
            const doc = iframe.contentDocument;
            if (!doc) return finish({ success: false, error: 'Không truy cập DOM (CORS)' });

            await new Promise(r => setTimeout(r, waitMs));

            // Auto-start nếu cần
            if (autoStart) {
              const startState = detectScreenState(doc);
              if (startState.state === 'start-screen' || startState.state === 'unknown') {
                try { await autoStartQuizInIframe(iframe, { onProgress }); } catch (e) {}
                await new Promise(r => setTimeout(r, 1500));
              }
            }

            // Detect screen state
            const screenState = detectScreenState(doc);
            if (onProgress) onProgress(`📺 Screen state: ${screenState.state}`);

            // Extract tất cả data từ HTML (nếu có)
            let fullDecks = [];
            try {
              const html = doc.documentElement.outerHTML;
              const r = extractQuizData(html);
              if (r && r.data) fullDecks = normalizeDecks(r.data);
            } catch (e) {}

            // Mode MENU — user chưa chọn đề
            if (screenState.state === 'menu' || screenState.state === 'start-screen') {
              // Setup live watcher
              liveWatcher = createLiveContextWatcher({
                pollIntervalMs: 1500,
                onScreenChange: (newState) => {
                  if (onProgress) onProgress(`📺 Chuyển màn hình: ${newState.state}`);
                },
              });
              liveWatcher.attach(iframe);

              finish({
                success: true,
                mode: 'menu',
                screenState,
                decks: fullDecks,
                reason: 'User chưa chọn đề — hiện menu tất cả đề',
              });
              return;
            }

            // Mode QUIZ ACTIVE — user đang làm
            if (screenState.state === 'quiz-in-progress') {
              const activeQ = detectActiveQuestion(doc);
              const allVisible = extractVisibleQuestions(doc);

              finish({
                success: true,
                mode: 'quiz-active',
                screenState,
                activeQuestion: activeQ,
                visibleQuestions: allVisible,
                progress: screenState.progress,
                reason: `User đang làm câu ${screenState.progress?.current || '?'} / ${screenState.progress?.total || '?'}`,
              });
              return;
            }

            // Mode QUIZ ALL VISIBLE
            if (screenState.state === 'quiz-all-visible') {
              const allVisible = extractVisibleQuestions(doc);
              finish({
                success: true,
                mode: 'quiz-all',
                screenState,
                visibleQuestions: allVisible,
                reason: `User đang xem ${allVisible.length} câu`,
              });
              return;
            }

            // Mode RESULT
            if (screenState.state === 'result') {
              finish({
                success: true,
                mode: 'result',
                screenState,
                reason: 'User đang xem kết quả',
              });
              return;
            }

            // Unknown — fallback về menu
            finish({
              success: true,
              mode: 'menu',
              screenState,
              decks: fullDecks,
              reason: 'Không xác định được screen state — fallback menu',
            });
          } catch (e) {
            finish({ success: false, error: 'Inspect error: ' + e.message });
          }
        };

        iframe.onerror = () => finish({ success: false, error: 'Iframe load error' });
        document.body.appendChild(iframe);

        timeoutTimer = setTimeout(() => {
          finish({ success: false, error: `Timeout ${timeoutMs / 1000}s` });
        }, timeoutMs);
      } catch (e) {
        finish({ success: false, error: e.message });
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // CHEMISTRY
  // ═══════════════════════════════════════════════════════════════

  function detectChemistryData(obj) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return { isChem: false };
    const keys = Object.keys(obj);
    if (keys.length < 2) return { isChem: false };
    let potentialCount = 0, elementCount = 0, reactionCount = 0;
    for (const key of keys) {
      const item = obj[key];
      if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
      const itemKeys = Object.keys(item);
      if (itemKeys.some(k => /^E_?0$|^Eo$|^e0$|potential/i.test(k)) &&
          itemKeys.some(k => /ion|symbol|name/i.test(k))) potentialCount++;
      if (itemKeys.some(k => /^Z$|atomicNumber|atomicMass/i.test(k)) &&
          itemKeys.some(k => /symbol|name/i.test(k))) elementCount++;
      if (itemKeys.some(k => /reactants|equation/i.test(k)) &&
          itemKeys.some(k => /products|deltaH/i.test(k))) reactionCount++;
    }
    if (potentialCount >= 2 && potentialCount / keys.length > 0.5) return { isChem: true, type: 'electrode_potential', confidence: potentialCount / keys.length };
    if (elementCount >= 3 && elementCount / keys.length > 0.5) return { isChem: true, type: 'element', confidence: elementCount / keys.length };
    if (reactionCount >= 2 && reactionCount / keys.length > 0.5) return { isChem: true, type: 'reaction', confidence: reactionCount / keys.length };
    return { isChem: false };
  }

  function generateQuizFromElectrodes(data) {
    const symbols = Object.keys(data).filter(k => {
      const item = data[k];
      return item && typeof item === 'object' && Object.keys(item).some(k => /^E_?0$|^Eo$|potential/i.test(k));
    });
    if (symbols.length < 2) return [];
    const questions = [];
    const getE0 = (sym) => {
      const item = data[sym];
      for (const k of Object.keys(item)) if (/^E_?0$|^Eo$|potential/i.test(k)) return Number(item[k]);
      return 0;
    };
    const getName = (sym) => {
      const item = data[sym];
      for (const k of Object.keys(item)) if (/^name$/i.test(k)) return String(item[k]);
      return sym;
    };
    const getIon = (sym) => {
      const item = data[sym];
      for (const k of Object.keys(item)) if (/^ion$/i.test(k)) return String(item[k]);
      return sym + 'ⁿ⁺';
    };
    for (const sym of symbols) {
      const correct = getE0(sym);
      const others = symbols.filter(s => s !== sym).map(s => getE0(s));
      const opts = [correct];
      for (const o of [...others].sort(() => Math.random() - 0.5)) {
        if (opts.length >= 4) break;
        if (!opts.includes(o)) opts.push(o);
      }
      for (let i = opts.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [opts[i], opts[j]] = [opts[j], opts[i]];
      }
      questions.push({
        type: 'mcq',
        question: `Thế điện cực chuẩn E° của cặp ${getIon(sym)}/${sym} ở 25°C là bao nhiêu?`,
        options: opts.map((v, i) => `${String.fromCharCode(65 + i)}. ${v.toFixed(2)} V`),
        answer: String.fromCharCode(65 + opts.indexOf(correct)),
        topic: 'electrode_potential',
      });
    }
    const pairs = [];
    for (let i = 0; i < symbols.length; i++)
      for (let j = i + 1; j < symbols.length; j++) pairs.push([symbols[i], symbols[j]]);
    for (const [s1, s2] of pairs.sort(() => Math.random() - 0.5).slice(0, 5)) {
      const e1 = getE0(s1), e2 = getE0(s2);
      if (Math.abs(e1 - e2) < 0.01) continue;
      const cathode = e1 > e2 ? s1 : s2;
      const Ecell = Math.abs(e1 - e2);
      questions.push({
        type: 'mcq',
        question: `Pin Galvani ${getName(s1)} (${s1}) — ${getName(s2)} (${s2}). Điện cực nào là CATHODE?`,
        options: [
          `A. ${getName(s1)} (${s1})`,
          `B. ${getName(s2)} (${s2})`,
          `C. Cả hai đều là cathode`,
          `D. Không xác định được`,
        ],
        answer: cathode === s1 ? 'A' : 'B',
        topic: 'galvani_cell',
      });
    }
    return questions;
  }

  function extractChemistryQuiz(html) {
    if (!html || typeof html !== 'string') return null;
    const re = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
    const scripts = [];
    let m;
    while ((m = re.exec(html)) !== null) scripts.push(m[1]);
    if (!scripts.length) scripts.push(html);
    const js = scripts.join('\n');
    const results = [];
    const reObj = /(?:const|var|let)\s+([A-Za-z_$][\w$]*)\s*=\s*(\{[\s\S]*?\n\s*\}|\[[\s\S]*?\n\s*\])/g;
    while ((m = reObj.exec(js)) !== null) {
      const name = m[1];
      const code = m[2];
      if (code.length > 500_000) continue;
      const parsed = safeEval(code);
      if (!parsed) continue;
      const chemInfo = detectChemistryData(parsed);
      if (!chemInfo.isChem) continue;
      results.push({ name, data: parsed, chemInfo });
    }
    if (results.length === 0) return null;
    const allQuestions = [];
    for (const { data, chemInfo } of results) {
      if (chemInfo.type === 'electrode_potential') {
        const q = generateQuizFromElectrodes(data);
        if (q.length) allQuestions.push(...q);
      }
    }
    if (allQuestions.length === 0) return null;
    return {
      data: [{ name: '🧪 Data → Quiz tự sinh', questions: allQuestions }],
      source: 'chemistry-data',
      method: 'auto-generated',
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // HELPER DETECTION
  // ═══════════════════════════════════════════════════════════════

  function isHelperCandidate(name, body) {
    const inWhitelist = HELPER_NAME_WHITELIST.includes(name);
    const isShortName = name.length <= 4;
    if (!inWhitelist && !isShortName) return false;
    if (body.length > 800) return false;
    if (!/return\s*[\{\(\[]/.test(body)) return false;
    if (/\b(for|while|switch|try|catch)\b/.test(body)) return false;
    return true;
  }

  function detectHelperFunctions(js) {
    const helpers = [];
    const seen = new Set();
    const patterns = [
      /function\s+([A-Za-z_$][\w$]*)\s*\(([^)]*)\)\s*\{([\s\S]{0,1500}?)\}/g,
      /(?:const|var|let)\s+([A-Za-z_$][\w$]*)\s*=\s*\(([^)]*)\)\s*=>\s*\(?\s*(\{[\s\S]{0,1500}?\})\s*\)?/g,
      /(?:const|var|let)\s+([A-Za-z_$][\w$]*)\s*=\s*([A-Za-z_$][\w$]*)\s*=>\s*\(?\s*(\{[\s\S]{0,1500}?\})\s*\)?/g,
      /(?:const|var|let)\s+([A-Za-z_$][\w$]*)\s*=\s*\(([^)]*)\)\s*=>\s*\{([\s\S]{0,1500}?)\}/g,
      /(?:const|var|let)\s+([A-Za-z_$][\w$]*)\s*=\s*function\s*\(([^)]*)\)\s*\{([\s\S]{0,1500}?)\}/g,
    ];
    for (const re of patterns) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(js)) !== null) {
        const name = m[1];
        const params = m[2] || '';
        let body = m[3];
        if (seen.has(name)) continue;
        if (!isHelperCandidate(name, body)) continue;
        if (body.trim().startsWith('{') && !/return/.test(body)) body = `return ${body};`;
        helpers.push({ name, params, body });
        seen.add(name);
      }
    }
    return helpers;
  }

  function compileHelperFunctions(js) {
    const detected = detectHelperFunctions(js);
    const compiled = {};
    Object.assign(compiled, GENERIC_HELPERS);
    for (const h of detected) {
      try {
        let fn;
        const strategies = [
          () => new Function(`return function ${h.name}(${h.params}) {${h.body}};`)(),
          () => new Function(`return (${h.params}) => {${h.body}};`)(),
          () => new Function(`return (${h.params}) => (${h.body.replace(/return\s*/, '')});`)(),
        ];
        for (const strategy of strategies) {
          try { fn = strategy(); if (typeof fn === 'function') break; } catch {}
        }
        if (typeof fn !== 'function') continue;
        const paramCount = (h.params.match(/,/g) || []).length + (h.params.trim() ? 1 : 0);
        const testArgs = [];
        for (let i = 0; i < paramCount; i++) testArgs.push(i === 0 ? 'test' : (i === 1 ? [] : (i === 2 ? 0 : 'topic')));
        let result;
        try { result = fn(...testArgs); } catch { try { result = fn('test'); } catch { continue; } }
        if (result && typeof result === 'object') compiled[h.name] = fn;
      } catch (e) {}
    }
    return Object.keys(compiled).length > 0 ? compiled : null;
  }

  function collectChainVariables(js, helpers) {
    const collected = new Map();
    const re = /(?:const|var|let)\s+([A-Za-z_$][\w$]*)\s*=\s*/g;
    let m;
    while ((m = re.exec(js)) !== null) {
      const name = m[1];
      const start = m.index + m[0].length;
      let p = start;
      while (p < js.length && /\s/.test(js[p])) p++;
      if (p >= js.length) continue;
      if (js[p] !== '[' && js[p] !== '{') continue;
      const end = matchBracket(js, p);
      if (end <= p) continue;
      const code = js.substring(p, end + 1);
      if (code.length > 5_000_000) continue;
      const isChain = CHAIN_VAR_PATTERNS.some(pat => pat.test(name));
      if (!isChain) continue;
      const parsed = safeEvalWithHelpers(code, helpers);
      if (parsed !== null && parsed !== undefined) collected.set(name, parsed);
    }
    return collected;
  }

  function safeEvalWithChainVars(code, helpers, chainVars) {
    if (!code || typeof code !== 'string') return null;
    const plainResult = safeEval(code);
    if (plainResult !== null) return plainResult;
    const allVars = Object.assign({}, helpers || {}, Object.fromEntries(chainVars || []));
    const varNames = Object.keys(allVars);
    const varValues = varNames.map(n => allVars[n]);
    if (varNames.length === 0) return null;
    try {
      const fn = new Function(...varNames, `"use strict"; return (${code});`);
      const result = fn(...varValues);
      if (result !== null && result !== undefined) return result;
    } catch (e) {}
    try {
      const helperScript = varNames.map(n => `var ${n} = arguments[0][${JSON.stringify(n)}];`).join('\n');
      const fn = new Function(`"use strict"; ${helperScript}\nreturn (${code});`);
      const result = fn(allVars);
      if (result !== null && result !== undefined) return result;
    } catch (e) {}
    return null;
  }

  function safeEvalWithHelpers(code, helpers) {
    return safeEvalWithChainVars(code, helpers, null);
  }

  function safeEval(code) {
    if (!code || typeof code !== 'string') return null;
    if (code.length > 5_000_000) return null;
    const trimmed = code.trim();
    if (trimmed[0] === '{' || trimmed[0] === '[') {
      try { return JSON.parse(trimmed); } catch {}
    }
    try { return eval('(' + code + ')'); } catch {}
    try { return new Function('return (' + code + ')')(); } catch {}
    return null;
  }

  function hasAnyField(obj, aliasKeys) {
    if (!obj || typeof obj !== 'object') return false;
    for (const key of aliasKeys) {
      const aliases = FIELD_ALIASES[key] || [key];
      for (const alias of aliases) {
        if (obj[alias] !== undefined && obj[alias] !== null) return true;
      }
    }
    return false;
  }

  function getField(obj, aliasKey, defaultValue = undefined) {
    if (!obj || typeof obj !== 'object') return defaultValue;
    const aliases = FIELD_ALIASES[aliasKey] || [aliasKey];
    for (const alias of aliases) {
      if (obj[alias] !== undefined && obj[alias] !== null) return obj[alias];
    }
    return defaultValue;
  }

  function isQuestionLike(q) {
    if (!q || typeof q !== 'object' || Array.isArray(q)) return false;
    return !!(hasAnyField(q, ['question']) || hasAnyField(q, ['options']) || hasAnyField(q, ['answer']) || hasAnyField(q, ['statements']));
  }

  function isDeckObject(obj) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false;
    const keys = Object.keys(obj).map(k => k.toLowerCase());
    return ['mc','mcq','tf','truefalse','sa','short','parti','part1','partii','part2','partiii','part3'].some(k => keys.includes(k));
  }

  function matchBracket(s, start) {
    const open = s[start];
    const close = open === '[' ? ']' : open === '{' ? '}' : ')';
    let depth = 0, inStr = null, esc = false, inTemplate = false, inLineComment = false, inBlockComment = false;
    for (let i = start; i < s.length; i++) {
      const c = s[i], next = s[i + 1];
      if (!inStr && !inTemplate && !inLineComment && !inBlockComment && c === '/' && next !== '/' && next !== '*') {
        let j = i - 1;
        while (j >= 0 && /\s/.test(s[j])) j--;
        const prevChar = j >= 0 ? s[j] : '';
        if (/[=(,:!&|?+\-*%^~[\]{};]/.test(prevChar) || j < 0) {
          let k = i + 1, rEsc = false;
          while (k < s.length) {
            if (rEsc) { rEsc = false; k++; continue; }
            if (s[k] === '\\') { rEsc = true; k++; continue; }
            if (s[k] === '/' || s[k] === '\n') break;
            k++;
          }
          if (k < s.length && s[k] === '/') { i = k; while (i + 1 < s.length && /[gimsuy]/.test(s[i + 1])) i++; continue; }
        }
      }
      if (!inStr && !inTemplate && !inBlockComment && c === '/' && next === '/') { inLineComment = true; i++; continue; }
      if (inLineComment) { if (c === '\n') inLineComment = false; continue; }
      if (!inStr && !inTemplate && !inLineComment && c === '/' && next === '*') { inBlockComment = true; i++; continue; }
      if (inBlockComment) { if (c === '*' && next === '/') { inBlockComment = false; i++; } continue; }
      if (inStr) { if (esc) { esc = false; continue; } if (c === '\\') { esc = true; continue; } if (c === inStr) inStr = null; continue; }
      if (inTemplate) {
        if (esc) { esc = false; continue; }
        if (c === '\\') { esc = true; continue; }
        if (c === '`') { inTemplate = false; continue; }
        if (c === '$' && next === '{') { const end = matchBracket(s, i + 1); if (end > i) { i = end; continue; } }
        continue;
      }
      if (c === '"' || c === "'") { inStr = c; continue; }
      if (c === '`') { inTemplate = true; continue; }
      if (c === open) depth++;
      else if (c === close && --depth === 0) return i;
    }
    return -1;
  }

  // ═══════════════════════════════════════════════════════════════
  // NORMALIZE
  // ═══════════════════════════════════════════════════════════════

  function decodeChemEntities(str) {
    if (typeof str !== 'string') return str;
    return str.replace(/&sup2;/g, '²').replace(/&sup3;/g, '³')
      .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
      .replace(/<[^>]*>/g, '').replace(/\u00A0/g, ' ').replace(/\uFEFF/g, '');
  }

  function collapseWhitespace(str) {
    if (typeof str !== 'string') return str;
    return str.replace(/[ \t]+/g, ' ').trim();
  }

  function normalizeText(str) {
    if (typeof str !== 'string') return str;
    return collapseWhitespace(decodeChemEntities(str));
  }

  // ═══════════════════════════════════════════════════════════════
  // 🆕 v37.0.1: NORMALIZE QUESTION (đã sửa hỗ trợ TF array answers)
  // ═══════════════════════════════════════════════════════════════

  function normalizeQuestion(q) {
    if (!q || typeof q !== 'object') return null;
    const out = { _original: q };
    out.question = normalizeText(String(getField(q, 'question', '') || ''));
    out.type = String(getField(q, 'type', '') || '').toLowerCase();

    // --- OPTIONS ---
    const rawOpts = getField(q, 'options', null);
    if (Array.isArray(rawOpts)) out.options = rawOpts.map(o => normalizeText(String(o || '')));
    else if (rawOpts && typeof rawOpts === 'object') out.options = Object.values(rawOpts).map(o => normalizeText(String(o || '')));
    else out.options = null;

    // --- ANSWER (dùng cho mcq + short) ---
    const rawAnswer = getField(q, 'answer', null);

    // --- STATEMENTS (dùng cho tf) ---
    const rawStmts = getField(q, 'statements', null);
    // 🆕 v37.0.1: Lấy mảng answers riêng cho TF (định dạng HTML gốc của bạn)
    const rawAnswersArray = getField(q, 'answersArray', null);

    if (Array.isArray(rawStmts) && rawStmts.length) {
      out.statements = rawStmts.map((s, idx) => {
        let statementText = '';
        let statementAnswer = null;

        if (typeof s === 'string') {
          // Trường hợp HTML gốc: statements: ['...', '...'], answers: [true, false, ...]
          statementText = normalizeText(s);
          if (Array.isArray(rawAnswersArray) && idx < rawAnswersArray.length) {
            statementAnswer = toBoolean(rawAnswersArray[idx]);
          }
        } else if (typeof s === 'object' && s !== null) {
          // Trường hợp statement là object: { text: '...', answer: true }
          statementText = normalizeText(String(getField(s, 'stText', '') || ''));
          const ownAnswer = getField(s, 'stAnswer', null);
          if (ownAnswer !== null && ownAnswer !== undefined) {
            statementAnswer = toBoolean(ownAnswer);
          } else if (Array.isArray(rawAnswersArray) && idx < rawAnswersArray.length) {
            // Fallback: lấy từ mảng answers theo index
            statementAnswer = toBoolean(rawAnswersArray[idx]);
          }
        }

        if (!statementText) return null;
        return {
          text: statementText,
          answer: statementAnswer,
          level: (typeof s === 'object' && s !== null) ? String(getField(s, 'level', '') || '') : '',
        };
      }).filter(Boolean);
    } else out.statements = null;

    out.explanation = normalizeText(String(getField(q, 'explanation', '') || ''));
    out.topic = String(getField(q, 'topic', '') || '');

    // --- AUTO-DETECT TYPE ---
    if (!out.type) {
      if (Array.isArray(out.statements) && out.statements.length > 0) out.type = 'tf';
      else if (Array.isArray(out.options) && out.options.length > 0 && rawAnswer !== null && rawAnswer !== undefined) out.type = 'mcq';
      else if (rawAnswer !== null && rawAnswer !== undefined) out.type = 'short';
      else if (Array.isArray(out.options) && out.options.length > 0) out.type = 'mcq';
    }

    const typeNorm = out.type.toLowerCase().replace(/[_\s-]/g, '');
    for (const [canon, aliases] of Object.entries(TYPE_ALIASES)) {
      if (aliases.some(a => a.toLowerCase().replace(/[_\s-]/g, '') === typeNorm)) { out.type = canon; break; }
    }

    // --- ANSWER RESOLUTION ---
    if (out.type === 'mcq' && Array.isArray(out.options)) {
      const formatted = formatAnswerDisplay(rawAnswer, out.options, 'mcq');
      out.answer = formatted.letter;
      out.answerIndex = formatted.index;
      out.answerDisplay = formatted.display;
      out.answerValid = formatted.valid;
      if (formatted.index >= 0 && out.options[formatted.index]) out.answerText = out.options[formatted.index];
    } else if (out.type === 'short') {
      if (typeof rawAnswer === 'string') out.answer = rawAnswer.trim();
      else if (rawAnswer !== null && rawAnswer !== undefined) out.answer = String(rawAnswer).trim();
      else out.answer = null;
    } else if (out.type === 'tf') {
      // Với TF, đáp án nằm trong từng statement — không dùng out.answer
      out.answer = rawAnswersArray || null;
      // 🆕: Thêm mảng answers phẳng để app.js dễ dùng
      if (Array.isArray(out.statements)) {
        out.answers = out.statements.map(st => st.answer);
      }
    } else out.answer = rawAnswer;

    return out;
  }

  function flattenDeckObject(deckObj, deckName) {
    const questions = [];
    const keys = Object.keys(deckObj);
    const partOrder = ['parti','part1','mc','mcq','partii','part2','tf','partiii','part3','sa','short'];
    const sortedKeys = keys.slice().sort((a, b) => {
      const ai = partOrder.indexOf(a.toLowerCase());
      const bi = partOrder.indexOf(b.toLowerCase());
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    });
    for (const key of sortedKeys) {
      const val = deckObj[key];
      if (!Array.isArray(val) || !val.length) continue;
      const canonicalType = PART_KEY_MAP[key.toLowerCase()] || null;
      for (const item of val) {
        if (!item || typeof item !== 'object') continue;
        const copy = Object.assign({}, item);
        if (!copy.type && canonicalType) copy.type = canonicalType;
        questions.push(copy);
      }
    }
    return { name: deckName, questions };
  }

  function normalizeDecks(raw) {
    const decks = [];
    const addDeck = (name, questions) => {
      if (!Array.isArray(questions)) return;
      const normalized = questions.map(normalizeQuestion).filter(Boolean);
      if (normalized.length) decks.push({ name, questions: normalized });
    };
    function walk(obj, prefix = '', depth = 0) {
      if (depth > 8) return;
      if (!obj || typeof obj !== 'object') return;
      if (Array.isArray(obj)) {
        if (obj.length && obj[0] && typeof obj[0] === 'object') {
          let allDecks = true, allQ = true;
          for (const item of obj) {
            if (!isDeckObject(item)) allDecks = false;
            if (!isQuestionLike(item)) allQ = false;
            if (!allDecks && !allQ) break;
          }
          if (allDecks) {
            obj.forEach((deckObj, i) => {
              const name = getField(deckObj, 'name', null) || (prefix ? `${prefix} ${i + 1}` : 'Đề ' + (i + 1));
              const flat = flattenDeckObject(deckObj, name);
              addDeck(flat.name, flat.questions);
            });
            return;
          }
          if (allQ) { addDeck(prefix || 'Đề 1', obj); return; }
          obj.forEach((item, i) => walk(item, prefix ? `${prefix}.${i + 1}` : `Đề ${i + 1}`, depth + 1));
          return;
        }
        return;
      }
      const keys = Object.keys(obj);
      if (isDeckObject(obj)) {
        const flat = flattenDeckObject(obj, getField(obj, 'name', null) || prefix || 'Đề 1');
        addDeck(flat.name, flat.questions);
        return;
      }
      if (Array.isArray(obj.questions)) { addDeck(getField(obj, 'name', null) || prefix || 'Đề 1', obj.questions); return; }
      if (Array.isArray(obj.items)) { addDeck(getField(obj, 'name', null) || prefix || 'Đề 1', obj.items); return; }
      for (const key of keys) {
        const val = obj[key];
        if (Array.isArray(val) && val.length && typeof val[0] === 'object') {
          let allDecks = true;
          for (const item of val) if (!isDeckObject(item)) { allDecks = false; break; }
          if (allDecks) {
            val.forEach((deckObj, i) => {
              const name = getField(deckObj, 'name', null) || `Đề ${key}-${i + 1}`;
              const flat = flattenDeckObject(deckObj, name);
              addDeck(flat.name, flat.questions);
            });
            continue;
          }
          if (isQuestionLike(val[0])) {
            addDeck(key.replace(/^(de|deck|set)/i, 'Đề ').trim() || key, val);
            continue;
          }
        }
        if (val && typeof val === 'object' && !Array.isArray(val)) walk(val, prefix ? `${prefix}.${key}` : key, depth + 1);
      }
    }
    walk(raw);
    const seen = new Set();
    const unique = [];
    for (const deck of decks) {
      const hash = deck.questions.slice(0, 3).map(q => `${q.question}|${q.answer}|${q.type}`).join('||');
      if (seen.has(hash)) continue;
      seen.add(hash);
      unique.push(deck);
    }
    return unique;
  }

  // ═══════════════════════════════════════════════════════════════
  // SHUFFLE
  // ═══════════════════════════════════════════════════════════════

  function detectShufflePattern(js) {
    const patterns = {
      sortRandom: /\.sort\s*\(\s*\(\s*\)\s*=>\s*Math\.random\s*\(\s*\)\s*-\s*0\.5\s*\)/,
      sortRandomVar: /\.sort\s*\(\s*\(\s*[a-z]\s*,\s*[a-z]\s*\)\s*=>\s*Math\.random\s*\(\s*\)\s*-\s*0\.5\s*\)/i,
      shuffleFn: /function\s+(shuffle|xaoTron|xao_tron|randomize|mix|tron|đảo|dao)\s*\(/i,
      shuffleArrow: /(?:const|let|var)\s+(shuffle|xaoTron|xao_tron|randomize|mix|tron)\s*=\s*\(/i,
      lodashShuffle: /_\.shuffle\s*\(/,
      fisherYates: /for\s*\([^)]*i\s*=\s*[^;]+;\s*i\s*>\s*0[^)]*\)[^}]*Math\.random/i,
      randomIndex: /Math\.floor\s*\(\s*Math\.random\s*\(\s*\)\s*\*\s*[a-z]/i,
      sliceSort: /\.slice\s*\(\s*\)\s*\.sort/i,
    };
    const found = [];
    for (const [key, re] of Object.entries(patterns)) if (re.test(js)) found.push(key);
    let confidence = 0;
    if (found.includes('sortRandom') || found.includes('sortRandomVar')) confidence += 40;
    if (found.includes('shuffleFn') || found.includes('shuffleArrow')) confidence += 30;
    if (found.includes('fisherYates')) confidence += 35;
    if (found.includes('lodashShuffle')) confidence += 30;
    if (found.includes('randomIndex')) confidence += 20;
    if (found.includes('sliceSort')) confidence += 15;
    if (confidence > 100) confidence = 100;
    return { detected: found.length > 0, patterns: found, confidence };
  }

  function resolveAnswerWithShuffleAwareness(q, shuffleInfo) {
    if (!q || !q.options || !Array.isArray(q.options)) return q;
    const answer = q.answer;
    if (answer === null || answer === undefined) return q;
    const answerStr = String(answer).trim();
    const options = q.options.map(o => String(o).trim());

    const textMatchIdx = options.findIndex(o => {
      const cleanOpt = o.replace(/^[A-Z]\s*[.):\-]\s*/i, '').trim();
      return o === answerStr || cleanOpt === answerStr;
    });
    if (textMatchIdx >= 0) {
      q.answerIndex = textMatchIdx;
      q.answerText = options[textMatchIdx];
      q.answerResolved = true;
      q.answerMethod = 'text-match';
      q.answerSafe = true;
      return q;
    }

    const letterPrefix = answerStr.match(/^([A-Z])\s*[.):\-]\s*(.+)$/i);
    if (letterPrefix) {
      const textAfter = letterPrefix[2].trim();
      const idx = options.findIndex(o => {
        const cleanOpt = o.replace(/^[A-Z]\s*[.):\-]\s*/i, '').trim();
        return cleanOpt === textAfter || o === textAfter;
      });
      if (idx >= 0) {
        q.answerIndex = idx;
        q.answerText = options[idx];
        q.answerResolved = true;
        q.answerMethod = 'letter-text-match';
        q.answerSafe = true;
        return q;
      }
    }

    const letterOnly = answerStr.match(/^([A-Z])$/i);
    if (letterOnly) {
      const idx = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.indexOf(letterOnly[1].toUpperCase());
      if (idx >= 0 && idx < options.length) {
        q.answerIndex = idx;
        q.answerText = options[idx];
        q.answerResolved = true;
        q.answerMethod = 'letter-direct';
        if (shuffleInfo && shuffleInfo.detected) {
          q.answerWarning = `HTML có shuffle — letter "${letterOnly[1].toUpperCase()}" có thể đã đổi vị trí. Đối chiếu theo TEXT.`;
          q.answerSafe = false;
        } else q.answerSafe = true;
        return q;
      }
    }

    q.answerDisplay = answerStr;
    q.answerResolved = false;
    q.answerSafe = false;
    return q;
  }

  function applyShuffleAwareness(decks, shuffleInfo) {
    if (!decks || !Array.isArray(decks)) return { decks, stats: { resolved: 0, warned: 0, total: 0 } };
    let resolved = 0, warned = 0, total = 0;
    for (const deck of decks) {
      for (const q of deck.questions) {
        total++;
        if (q.type === 'mcq') {
          resolveAnswerWithShuffleAwareness(q, shuffleInfo);
          if (q.answerResolved) resolved++;
          if (q.answerWarning) warned++;
        }
      }
    }
    return { decks, stats: { resolved, warned, total } };
  }

  function verifyCandidate(candidate) {
    if (!candidate || !candidate.data) return { valid: false, reason: 'empty' };
    try {
      const decks = normalizeDecks(candidate.data);
      if (!decks.length) return { valid: false, reason: 'no-decks' };
      const totalQ = decks.reduce((s, d) => s + d.questions.length, 0);
      if (totalQ === 0) return { valid: false, reason: 'no-questions' };
      let validQ = 0, hasAnswer = false;
      for (const d of decks) {
        for (const q of d.questions) {
          if (q.question || q.answer !== null || q.options) validQ++;
          if (q.answer !== null && q.answer !== undefined) hasAnswer = true;
          if (q.type === 'tf' && Array.isArray(q.statements)) {
            for (const st of q.statements) if (st.answer !== null) hasAnswer = true;
          }
        }
      }
      return { valid: validQ > 0 && hasAnswer, deckCount: decks.length, totalQuestions: totalQ, validQuestions: validQ };
    } catch (e) { return { valid: false, reason: e.message }; }
  }

  // ═══════════════════════════════════════════════════════════════
  // MASTER EXTRACTOR
  // ═══════════════════════════════════════════════════════════════

  function extractQuizData(html, options = {}) {
    if (!html || typeof html !== 'string') throw new Error('HTML rỗng');
    const stats = {
      htmlSize: html.length, strategiesRun: 0, candidatesFound: 0,
      helpersFound: 0, helperNames: [], chainVarsFound: 0, chainVarNames: [],
      chemistryDataFound: 0, generatedQuestions: 0, verified: 0, timeMs: 0, errors: [],
    };
    const startTime = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    const candidates = [];

    const addCandidate = (data, source, method, bonus = 0) => {
      if (!data) return;
      const score = scoreQuizObject(data) + bonus;
      if (score > 0) {
        let cloned;
        try { cloned = JSON.parse(JSON.stringify(data)); } catch { cloned = data; }
        candidates.push({ data: cloned, source, method, score });
        stats.candidatesFound++;
      }
    };

    const re = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
    const scripts = [];
    let m;
    while ((m = re.exec(html)) !== null) scripts.push(m[1]);
    if (!scripts.length) scripts.push(html);
    const js = scripts.join('\n');

    const shuffleInfo = detectShufflePattern(js);
    let helpers = null;
    try {
      helpers = compileHelperFunctions(js);
      stats.helpersFound = helpers ? Object.keys(helpers).length : 0;
      stats.helperNames = helpers ? Object.keys(helpers) : [];
    } catch (e) { stats.errors.push('helper: ' + e.message); }

    let chainVars = new Map();
    try {
      chainVars = collectChainVariables(js, helpers);
      stats.chainVarsFound = chainVars.size;
      stats.chainVarNames = [...chainVars.keys()];
    } catch (e) { stats.errors.push('chain-collect: ' + e.message); }

    // Strategy 1: Named vars
    try {
      for (const name of VAR_NAMES) {
        const re1 = new RegExp('(?:const|var|let)\\s+' + name + '\\s*=\\s*', 'g');
        let match;
        while ((match = re1.exec(js)) !== null) {
          const start = match.index + match[0].length;
          let p = start;
          while (p < js.length && /\s/.test(js[p])) p++;
          if (p < js.length && (js[p] === '[' || js[p] === '{')) {
            const end = matchBracket(js, p);
            if (end > p) {
              const code = js.substring(p, end + 1);
              const parsed = safeEvalWithChainVars(code, helpers, chainVars);
              if (parsed) addCandidate(parsed, name, 'named+chain', 40);
            }
          }
        }
      }
    } catch (e) { stats.errors.push('named: ' + e.message); }
    stats.strategiesRun++;

    // Strategy 2: Chain vars
    try {
      if (chainVars.size > 0) {
        const byPrefix = {};
        for (const [name, data] of chainVars.entries()) {
          const match = name.match(/^([a-z_$]+\d+)_([a-z]+)$/i) ||
                        name.match(/^([a-z_$]+\d+)-([a-z]+)$/i) ||
                        name.match(/^([a-z_$]+\d+)(mcq|tf|short|sa|mc)$/i);
          if (!match) continue;
          const prefix = match[1];
          const type = match[2].toLowerCase();
          if (!byPrefix[prefix]) byPrefix[prefix] = {};
          byPrefix[prefix][type] = data;
        }
        for (const prefix in byPrefix) {
          const parts = byPrefix[prefix];
          const deckObj = {};
          if (parts.mcq) deckObj.mcq = parts.mcq;
          else if (parts.mc) deckObj.mcq = parts.mc;
          if (parts.tf) deckObj.tf = parts.tf;
          if (parts.short) deckObj.short = parts.short;
          else if (parts.sa) deckObj.short = parts.sa;
          if (Object.keys(deckObj).length >= 1) addCandidate([deckObj], `chain:${prefix}`, 'chain-deck', 60);
        }
        if (Object.keys(byPrefix).length >= 2) {
          const combinedDATA = {};
          const prefixes = Object.keys(byPrefix).sort((a, b) => {
            const na = parseInt(a.match(/\d+/)?.[0] || 0);
            const nb = parseInt(b.match(/\d+/)?.[0] || 0);
            return na - nb;
          });
          prefixes.forEach((prefix, i) => {
            const parts = byPrefix[prefix];
            const deckObj = {};
            if (parts.mcq) deckObj.mcq = parts.mcq;
            else if (parts.mc) deckObj.mcq = parts.mc;
            if (parts.tf) deckObj.tf = parts.tf;
            if (parts.short) deckObj.short = parts.short;
            else if (parts.sa) deckObj.short = parts.sa;
            if (Object.keys(deckObj).length >= 1) combinedDATA[i + 1] = deckObj;
          });
          if (Object.keys(combinedDATA).length >= 2) addCandidate(combinedDATA, 'chain:combined', 'chain-combined', 70);
        }
      }
    } catch (e) { stats.errors.push('chain-build: ' + e.message); }
    stats.strategiesRun++;

    // Strategy 3: Generic
    try {
      const reObj = /(?:const|var|let)\s+([A-Za-z_$][\w$]*)\s*=\s*/g;
      let count = 0;
      while ((m = reObj.exec(js)) !== null && count < 200) {
        count++;
        const name = m[1];
        const start = m.index + m[0].length;
        if (start >= js.length) continue;
        let p = start;
        while (p < js.length && /\s/.test(js[p])) p++;
        if (p >= js.length) continue;
        if (js[p] === '[' || js[p] === '{') {
          const end = matchBracket(js, p);
          if (end > p) {
            const code = js.substring(p, end + 1);
            if (code.length < 30 || code.length > 5_000_000) continue;
            const parsed = safeEvalWithChainVars(code, helpers, chainVars);
            if (parsed) addCandidate(parsed, name, 'generic', 15);
          }
        }
      }
    } catch (e) { stats.errors.push('generic: ' + e.message); }
    stats.strategiesRun++;

    // Strategy 4: Chain fallback
    try {
      if (candidates.length === 0 && chainVars.size > 0) {
        const byNum = {};
        for (const [name, data] of chainVars.entries()) {
          const numMatch = name.match(/\d+/);
          if (!numMatch) continue;
          const num = numMatch[0];
          if (!byNum[num]) byNum[num] = {};
          if (/mcq|_mc$/i.test(name)) byNum[num].mcq = data;
          else if (/_tf$|truefalse/i.test(name)) byNum[num].tf = data;
          else if (/_short$|_sa$/i.test(name)) byNum[num].short = data;
        }
        const decks = [];
        Object.keys(byNum).sort((a, b) => parseInt(a) - parseInt(b)).forEach(num => {
          const d = byNum[num];
          if (Object.keys(d).length >= 1) decks.push(d);
        });
        if (decks.length > 0) addCandidate(decks, 'chain-fallback', 'chain-fallback', 50);
      }
    } catch (e) { stats.errors.push('chain-fallback: ' + e.message); }
    stats.strategiesRun++;

    // Strategy 5: Chemistry
    try {
      const chemResult = extractChemistryQuiz(html);
      if (chemResult && chemResult.data && chemResult.data.length > 0) {
        stats.chemistryDataFound = 1;
        stats.generatedQuestions = chemResult.data[0].questions.length;
        addCandidate(chemResult.data, 'chemistry-data', 'auto-generated', 100);
      }
    } catch (e) { stats.errors.push('chemistry: ' + e.message); }
    stats.strategiesRun++;

    if (!candidates.length) throw new Error('Không tìm thấy dữ liệu quiz hoặc data hóa học.');

    for (let i = 0; i < candidates.length; i++) {
      for (let j = i + 1; j < candidates.length; j++) {
        try {
          const sigA = JSON.stringify(candidates[i].data).substring(0, 500);
          const sigB = JSON.stringify(candidates[j].data).substring(0, 500);
          if (sigA === sigB) { candidates[i].score += 50; candidates[j].score += 50; }
        } catch {}
      }
    }
    candidates.sort((a, b) => b.score - a.score);

    let best = null, bestVerification = null, bestDeckCount = 0;
    for (const c of candidates) {
      const v = verifyCandidate(c);
      if (v.valid) {
        stats.verified++;
        if (v.deckCount > bestDeckCount || !best) {
          best = c;
          bestVerification = v;
          bestDeckCount = v.deckCount;
        }
      }
    }
    if (!best) {
      for (const c of candidates) {
        const decks = normalizeDecks(c.data);
        if (decks.length > 0) {
          best = c;
          bestVerification = { valid: true, deckCount: decks.length, totalQuestions: decks.reduce((s, d) => s + d.questions.length, 0) };
          break;
        }
      }
    }
    if (!best) throw new Error('Không có candidate hợp lệ.');

    stats.timeMs = Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - startTime);

    return {
      data: best.data,
      source: best.source,
      method: best.method,
      confidence: best.score,
      verification: bestVerification,
      stats,
      shuffle: shuffleInfo,
    };
  }

  function scoreQuizObject(obj) {
    if (!obj) return 0;
    let score = 0;
    const scoreQ = (q) => {
      if (!q || typeof q !== 'object') return 0;
      let s = 0;
      if (hasAnyField(q, ['question'])) s += 10;
      if (hasAnyField(q, ['options'])) s += 8;
      if (hasAnyField(q, ['answer'])) s += 10;
      if (hasAnyField(q, ['statements'])) s += 6;
      return s;
    };
    const scoreArr = (arr) => {
      if (!Array.isArray(arr) || !arr.length) return 0;
      let s = 0;
      const sample = arr.slice(0, 5);
      for (const item of sample) if (item && typeof item === 'object') s += scoreQ(item);
      if (arr.length >= 5) s += 5;
      return s / sample.length * Math.min(arr.length, 10);
    };
    if (Array.isArray(obj)) score = scoreArr(obj);
    else if (typeof obj === 'object') {
      for (const key of Object.keys(obj)) {
        const val = obj[key];
        if (Array.isArray(val)) score += scoreArr(val);
        else if (val && typeof val === 'object') {
          if (Array.isArray(val.questions)) score += scoreArr(val.questions);
          else if (isDeckObject(val)) {
            for (const ik of Object.keys(val)) if (Array.isArray(val[ik])) score += scoreArr(val[ik]);
          }
        }
      }
    }
    return Math.round(score);
  }

  // ═══════════════════════════════════════════════════════════════
  // URL FETCH
  // ═══════════════════════════════════════════════════════════════

  async function fetchUrlWithProxies(url, options = {}) {
    const { onProgress = null, timeoutMs = 15000 } = options;
    const proxies = [
      { name: 'direct', build: u => u },
      { name: 'allorigins', build: u => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}` },
      { name: 'corsproxy', build: u => `https://corsproxy.io/?${encodeURIComponent(u)}` },
      { name: 'codetabs', build: u => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}` },
      { name: 'thingproxy', build: u => `https://thingproxy.freeboard.io/fetch/${u}` },
    ];
    for (const proxy of proxies) {
      try {
        if (onProgress) onProgress(`Đang thử ${proxy.name}...`);
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        const res = await fetch(proxy.build(url), { mode: 'cors', signal: controller.signal });
        clearTimeout(timer);
        if (res.ok) {
          const text = await res.text();
          if (text && text.length > 100) return { html: text, proxy: proxy.name, url };
        }
      } catch (e) {}
    }
    throw new Error('Không tải được HTML qua proxies');
  }

  async function fetchAndParse(url, options = {}) {
    const { html, proxy } = await fetchUrlWithProxies(url, options);
    const result = extractQuizData(html, options);
    const decks = normalizeDecks(result.data);
    const awareness = applyShuffleAwareness(decks, result.shuffle);
    result.fetchedFrom = url;
    result.proxyUsed = proxy;
    result.decks = awareness.decks;
    result.awareness = awareness.stats;
    return result;
  }

  async function smartFetchAndParse(url, options = {}) {
    const { onProgress = null } = options;
    let scriptResult = null, scriptError = null;
    try {
      if (onProgress) onProgress('📡 Đang fetch HTML tĩnh...');
      const { html, proxy } = await fetchUrlWithProxies(url, options);
      scriptResult = extractQuizData(html);
      scriptResult.proxyUsed = proxy;
      const decks = normalizeDecks(scriptResult.data);
      const awareness = applyShuffleAwareness(decks, scriptResult.shuffle);
      scriptResult.decks = awareness.decks;
      scriptResult.awareness = awareness.stats;
    } catch (e) { scriptError = e.message; }

    const needIframe = !scriptResult ||
      (scriptResult.shuffle && scriptResult.shuffle.detected && scriptResult.shuffle.confidence >= 40);

    if (!needIframe && scriptResult) {
      return { ...scriptResult, mode: 'script', source: 'script-only' };
    }

    if (onProgress) onProgress('🔴 Phát hiện shuffle — thử iframe live...');

    const iframeResult = await inspectIframeFully(url, {
      onProgress,
      waitMs: options.iframeWaitMs || 3000,
      timeoutMs: options.iframeTimeoutMs || 15000,
      autoStart: true,
    });

    const scriptDecks = scriptResult ? scriptResult.decks : [];
    const iframeDecks = (iframeResult && iframeResult.scriptDecks) || [];
    const visibleDecks = (iframeResult && iframeResult.visibleDecks) || [];
    const networkDecks = (iframeResult && iframeResult.networkDecks) || [];

    const truth = resolveGroundTruth({
      scriptResult, iframeResult, networkDecks, visibleDecks, staticDecks: scriptDecks,
    });

    return {
      decks: truth.decks,
      mode: iframeResult && iframeResult.success ? 'iframe' : 'script',
      source: truth.source,
      confidence: truth.confidence,
      reason: truth.reason,
      shuffle: scriptResult ? scriptResult.shuffle : null,
      awareness: scriptResult ? scriptResult.awareness : null,
      scriptError,
      iframeError: iframeResult && !iframeResult.success ? iframeResult.error : null,
      proxyUsed: scriptResult ? scriptResult.proxyUsed : null,
      networkCount: networkDecks.length,
      visibleCount: visibleDecks.length,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // 🆕 v37: SELF-VERIFY — Kiểm tra function nào còn thiếu
  // ═══════════════════════════════════════════════════════════════

  const REQUIRED_FUNCTIONS = [
    'extractQuizData', 'normalizeDecks', 'normalizeQuestion', 'normalizeText',
    'formatAnswerDisplay', 'toBoolean',
    'detectShufflePattern', 'resolveAnswerWithShuffleAwareness', 'applyShuffleAwareness',
    'fetchUrlWithProxies', 'fetchAndParse', 'smartFetchAndParse', 'smartInspect',
    'extractFromIframe', 'inspectIframeFully', 'crossCheckResults', 'resolveGroundTruth',
    'extractVisibleQuestions', 'extractVisibleQuestionDetail', 'isElementVisible',
    'autoStartQuizInIframe', 'verifyCandidate', 'scoreQuizObject',
    'detectScreenState', 'detectStartButton', 'detectDeckButtons', 'detectActiveQuestion',
    'createLiveContextWatcher', 'watchCurrentPage', 'smartContextInspect',
    'detectHelperFunctions', 'compileHelperFunctions', 'collectChainVariables',
    'safeEvalWithHelpers', 'safeEvalWithChainVars', 'safeEval',
    'extractChemistryQuiz', 'detectChemistryData', 'generateQuizFromElectrodes',
  ];

  function selfVerify() {
    const missing = [];
    const defined = {};
    for (const name of REQUIRED_FUNCTIONS) {
      if (typeof eval(name) === 'function') defined[name] = true;
      else missing.push(name);
    }
    if (missing.length > 0) {
      console.error(`%c❌ Parser v${VERSION} MISSING FUNCTIONS: ${missing.join(', ')}`, 'color:#ff0000;font-weight:bold');
      return false;
    }
    if (DEBUG) console.log(`%c✅ Self-verify passed: ${REQUIRED_FUNCTIONS.length} functions`, 'color:#2ecc71');
    return true;
  }

  // ═══════════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════════

  const PUBLIC_API = {
    version: VERSION,

    // Core
    extractQuizData, normalizeDecks, normalizeQuestion, normalizeText,
    formatAnswerDisplay, toBoolean,

    // Shuffle
    detectShufflePattern, resolveAnswerWithShuffleAwareness, applyShuffleAwareness,

    // Fetch
    fetchUrlWithProxies, fetchAndParse, smartFetchAndParse, smartInspect,

    // Iframe
    extractFromIframe: inspectIframeFully,
    inspectIframeFully,
    crossCheckResults,
    resolveGroundTruth,

    // Visible DOM
    extractVisibleQuestions, extractVisibleQuestionDetail, isElementVisible,
    autoStartQuizInIframe,

    // 🆕 v37: Context-aware
    detectScreenState, detectStartButton, detectDeckButtons, detectActiveQuestion,
    createLiveContextWatcher, watchCurrentPage, smartContextInspect,

    // Helpers
    verifyCandidate, scoreQuizObject,
    detectHelperFunctions, compileHelperFunctions, collectChainVariables,
    safeEvalWithHelpers, safeEvalWithChainVars, safeEval,

    // Chemistry
    extractChemistryQuiz, detectChemistryData, generateQuizFromElectrodes,

    // Meta
    selfVerify,
    getStats: () => ({
      version: VERSION,
      varNames: VAR_NAMES.length,
      chainPatterns: CHAIN_VAR_PATTERNS.length,
      helperWhitelist: HELPER_NAME_WHITELIST.length,
      requiredFunctions: REQUIRED_FUNCTIONS.length,
      uptimeMs: Date.now() - _startupTime,
    }),
    _internal: {
      safeEval, matchBracket,
      FIELD_ALIASES, VAR_NAMES, TYPE_ALIASES, PART_KEY_MAP,
      HELPER_NAME_WHITELIST, GENERIC_HELPERS, CHAIN_VAR_PATTERNS,
      REQUIRED_FUNCTIONS,
    },
  };

  global.QuizParser = PUBLIC_API;

  // Self-verify sau khi export
  try { selfVerify(); } catch (e) {}

  if (DEBUG) {
    console.log(`%c🐱 QuizParser v${VERSION} loaded (${REQUIRED_FUNCTIONS.length} functions)`, 'color:#ff6ac1;font-weight:bold');
  }

})(typeof window !== 'undefined' ? window : globalThis);