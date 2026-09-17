// ═══════════════════════════════════════════════════════════════════
// 🐱 ANSWER CHECKER — QUIZ PARSER v29
// "Answer Display Fix + Custom Helper"
//
// 🆕 v29 FIXES:
//   ✦ MCQ ANSWER → LETTER STRING ("A"/"B"/"C"/"D") thay vì index
//   ✦ KEEP answerIndex cho app cần
//   ✦ NEW PUBLIC HELPER: formatAnswerDisplay() — display any answer
//   ✦ FULLY compatible v28
// ═══════════════════════════════════════════════════════════════════

(function(global) {
  'use strict';

  const VERSION = '29.0.0';
  const DEBUG = false;

  // ═══════════════════════════════════════════════════════════════
  // HELPER WHITELIST + GENERIC HELPERS (giữ nguyên v28)
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
    mc: (text, opts, correct, topic) => ({ q: text, o: opts, c: correct, t: topic }),
    tn: (text, opts, correct, topic) => ({ q: text, o: opts, c: correct, t: topic }),
    tf: (text, statements, topic) => ({ q: text, s: statements, t: topic }),
    sh: (text, answer, topic) => ({ q: text, a: answer, t: topic }),
    sa: (text, answer, topic) => ({ q: text, a: answer, t: topic }),
    st: (text, correct, level) => ({ x: text, c: correct, l: level }),
    ds: (text, correct, level) => ({ x: text, c: correct, l: level }),
  };

  const FIELD_ALIASES = {
    question: ['question', 'q', 'text', 'prompt', 'title', 'stem', 'content'],
    options: ['options', 'opts', 'choices', 'option', 'opt', 'o'],
    answer: ['answer', 'ans', 'correct', 'c', 'a', 'correctAnswer', 'key', 'correct_answer', 'rightAnswer'],
    type: ['type', 'questionType', 'kind', 'format'],
    statements: ['statements', 'subs', 'items', 's', 'claims', 'assertions'],
    stText: ['text', 'x', 'statement', 'content', 't'],
    stAnswer: ['answer', 'correct', 'c', 'v', 'val', 'a', 'isCorrect'],
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

  const DYNAMIC_VAR_PATTERNS = [
    /^de\d+$/i, /^deck\d+$/i, /^set\d+$/i,
    /^part\d+$/i, /^phan\d+$/i, /^chapter\d+$/i,
    /^\d+$/,
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
  // 🆕 v29: UNIVERSAL ANSWER FORMATTER — DÙNG ĐƯỢC Ở CẢ PARSER VÀ APP
  // ═══════════════════════════════════════════════════════════════

  /**
   * Convert BẤT KỲ dạng answer nào về dạng chuẩn.
   *
   * @param {*} answer - Có thể là: "A", 0, "0", "A. text", option text, ...
   * @param {Array} options - Danh sách options (nếu có)
   * @param {string} type - "mcq" | "tf" | "short"
   * @returns {Object} { value, index, letter, display, valid }
   */
  function formatAnswerDisplay(answer, options = null, type = 'mcq') {
    const result = {
      value: answer,
      index: null,
      letter: null,
      display: '?',
      valid: false,
    };

    if (answer === null || answer === undefined) {
      result.display = '(chưa có đáp án)';
      return result;
    }

    // ─── TF: convert về "Đúng"/"Sai" ───
    if (type === 'tf') {
      const boolVal = toBoolean(answer);
      if (boolVal === true) {
        result.value = true;
        result.display = 'Đúng';
        result.valid = true;
      } else if (boolVal === false) {
        result.value = false;
        result.display = 'Sai';
        result.valid = true;
      } else {
        result.display = String(answer);
      }
      return result;
    }

    // ─── SHORT: giữ string ───
    if (type === 'short') {
      result.value = String(answer).trim();
      result.display = result.value;
      result.valid = true;
      return result;
    }

    // ─── MCQ: convert về "A. text" ───
    let idx = -1;

    // Case 1: Số 0-25 → index
    if (typeof answer === 'number') {
      if (answer >= 0 && answer < 26) idx = answer;
    }
    // Case 2: String
    else if (typeof answer === 'string') {
      const trimmed = answer.trim();

      // Letter đơn: "A", "B", "C", "D"
      if (/^[A-Z]$/i.test(trimmed)) {
        idx = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.indexOf(trimmed.toUpperCase());
      }
      // Letter + prefix: "A.", "A)", "A -"
      else if (/^([A-Z])\s*[.):\-\s]/i.test(trimmed)) {
        const m = trimmed.match(/^([A-Z])/i);
        if (m) idx = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.indexOf(m[1].toUpperCase());
      }
      // Số dạng string: "0", "1", "2", "3"
      else if (/^\d+$/.test(trimmed)) {
        const num = parseInt(trimmed, 10);
        if (num >= 0 && num < 26) idx = num;
      }
      // Match option text
      else if (Array.isArray(options)) {
        idx = options.findIndex(o => String(o).trim() === trimmed);
      }
    }

    // Validate idx
    if (idx >= 0 && idx < 26) {
      const letter = String.fromCharCode(65 + idx);
      const optText = Array.isArray(options) && options[idx] ? options[idx] : '';

      result.index = idx;
      result.letter = letter;
      result.value = letter;
      result.display = optText ? `${letter}. ${optText}` : letter;
      result.valid = true;
    } else {
      // Fallback: hiển thị answer gốc
      result.display = String(answer);
      result.valid = false;
    }

    return result;
  }

  // ═══════════════════════════════════════════════════════════════
  // ANSWER NORMALIZER — convert về letter cho MCQ
  // ═══════════════════════════════════════════════════════════════

  function normalizeMcqAnswer(answer, options) {
    const formatted = formatAnswerDisplay(answer, options, 'mcq');
    return formatted.index; // -1 hoặc 0-25
  }

  // ═══════════════════════════════════════════════════════════════
  // BOOLEAN RESOLVER
  // ═══════════════════════════════════════════════════════════════

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
  // HELPER DETECTION / COMPILE (giữ nguyên v28)
  // ═══════════════════════════════════════════════════════════════

  function isHelperCandidate(name, body) {
    const inWhitelist = HELPER_NAME_WHITELIST.includes(name);
    const isShortName = name.length <= 4;
    if (!inWhitelist && !isShortName) return false;
    if (body.length > 800) return false;
    if (!/return\s*\{/.test(body) && !/=>\s*\(\s*\{/.test(body) && !/^\s*\(\s*\{/.test(body)) return false;
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
        if (body.trim().startsWith('{') && !/return/.test(body)) {
          body = `return ${body};`;
        }
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
        for (let i = 0; i < paramCount; i++) {
          testArgs.push(i === 0 ? 'test' : (i === 1 ? [] : (i === 2 ? 0 : 'topic')));
        }
        let result;
        try { result = fn(...testArgs); } catch {
          try { result = fn('test'); } catch { continue; }
        }
        if (result && typeof result === 'object' && !Array.isArray(result)) {
          compiled[h.name] = fn;
        }
      } catch (e) {
        if (DEBUG) console.warn('[Parser v29] Failed helper:', h.name, e.message);
      }
    }
    return Object.keys(compiled).length > 0 ? compiled : null;
  }

  function safeEvalWithHelpers(code, helpers) {
    if (!code || typeof code !== 'string') return null;
    const plainResult = safeEval(code);
    if (plainResult !== null) return plainResult;

    if (helpers && Object.keys(helpers).length > 0) {
      const helperNames = Object.keys(helpers);
      const helperValues = helperNames.map(n => helpers[n]);

      try {
        const fn = new Function(...helperNames, `"use strict"; return (${code});`);
        const result = fn(...helperValues);
        if (result !== null && result !== undefined) return result;
      } catch (e) {}

      try {
        const helperScript = helperNames.map(n => 
          `var ${n} = arguments[0][${JSON.stringify(n)}];`
        ).join('\n');
        const fn = new Function(`"use strict"; ${helperScript}\nreturn (${code});`);
        const result = fn(helpers);
        if (result !== null && result !== undefined) return result;
      } catch (e) {}

      try {
        const backup = {};
        for (const n of helperNames) {
          backup[n] = global[n];
          global[n] = helpers[n];
        }
        try {
          const result = eval('(' + code + ')');
          if (result !== null && result !== undefined) return result;
        } finally {
          for (const n of helperNames) {
            if (backup[n] === undefined) delete global[n];
            else global[n] = backup[n];
          }
        }
      } catch (e) {}
    }
    return null;
  }

  // ═══════════════════════════════════════════════════════════════
  // CORE HELPERS
  // ═══════════════════════════════════════════════════════════════

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
    return !!(
      hasAnyField(q, ['question']) ||
      hasAnyField(q, ['options']) ||
      hasAnyField(q, ['answer']) ||
      hasAnyField(q, ['statements'])
    );
  }

  function looksLikeQuiz(obj) {
    if (!obj) return false;
    if (Array.isArray(obj)) {
      if (!obj.length) return false;
      const first = obj[0];
      if (Array.isArray(first) && first.length && isQuestionLike(first[0])) return true;
      if (isQuestionLike(first)) return true;
    }
    if (typeof obj === 'object') {
      const keys = Object.keys(obj);
      const deckKeys = keys.filter(k => DYNAMIC_VAR_PATTERNS.some(p => p.test(k)));
      if (deckKeys.length) {
        const firstVal = obj[deckKeys[0]];
        if (firstVal && typeof firstVal === 'object' && !Array.isArray(firstVal)) {
          if (Array.isArray(firstVal.mc) || Array.isArray(firstVal.mcq) ||
              Array.isArray(firstVal.partI) || Array.isArray(firstVal.tf) ||
              Array.isArray(firstVal.short) || Array.isArray(firstVal.sa)) return true;
        }
        if (Array.isArray(firstVal) && firstVal.length) {
          if (isQuestionLike(firstVal[0])) return true;
        }
      }
      if (Array.isArray(obj.questions) && obj.questions.length && isQuestionLike(obj.questions[0])) return true;
    }
    return false;
  }

  function findOpen(s, idx) {
    for (let i = idx; i >= 0; i--) {
      if (s[i] === '[' || s[i] === '{') return i;
      if ((s[i] === ';' || s[i] === '\n') && i < idx - 200) break;
    }
    return -1;
  }

  function matchBracket(s, start) {
    const open = s[start];
    const close = open === '[' ? ']' : open === '{' ? '}' : ')';
    let depth = 0;
    let inStr = null;
    let esc = false;
    let inTemplate = false;
    let inLineComment = false;
    let inBlockComment = false;

    for (let i = start; i < s.length; i++) {
      const c = s[i];
      const next = s[i + 1];

      if (!inStr && !inTemplate && !inLineComment && !inBlockComment && c === '/' && next !== '/' && next !== '*') {
        let j = i - 1;
        while (j >= 0 && /\s/.test(s[j])) j--;
        const prevChar = j >= 0 ? s[j] : '';
        if (/[=(,:!&|?+\-*%^~[\]{};]/.test(prevChar) || j < 0) {
          let k = i + 1;
          let rEsc = false;
          while (k < s.length) {
            if (rEsc) { rEsc = false; k++; continue; }
            if (s[k] === '\\') { rEsc = true; k++; continue; }
            if (s[k] === '/') break;
            if (s[k] === '\n') break;
            k++;
          }
          if (k < s.length && s[k] === '/') {
            i = k;
            while (i + 1 < s.length && /[gimsuy]/.test(s[i + 1])) i++;
            continue;
          }
        }
      }

      if (!inStr && !inTemplate && !inBlockComment && c === '/' && next === '/') {
        inLineComment = true; i++; continue;
      }
      if (inLineComment) { if (c === '\n') inLineComment = false; continue; }

      if (!inStr && !inTemplate && !inLineComment && c === '/' && next === '*') {
        inBlockComment = true; i++; continue;
      }
      if (inBlockComment) { if (c === '*' && next === '/') { inBlockComment = false; i++; } continue; }

      if (inStr) {
        if (esc) { esc = false; continue; }
        if (c === '\\') { esc = true; continue; }
        if (c === inStr) inStr = null;
        continue;
      }
      if (inTemplate) {
        if (esc) { esc = false; continue; }
        if (c === '\\') { esc = true; continue; }
        if (c === '`') { inTemplate = false; continue; }
        if (c === '$' && next === '{') {
          const end = matchBracket(s, i + 1);
          if (end > i) { i = end; continue; }
        }
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
  // TEXT NORMALIZER
  // ═══════════════════════════════════════════════════════════════

  function decodeChemEntities(str) {
    if (typeof str !== 'string') return str;
    return str
      .replace(/&sup2;/g, '²').replace(/&sup3;/g, '³')
      .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
      .replace(/<[^>]*>/g, '')
      .replace(/\u00A0/g, ' ')
      .replace(/\uFEFF/g, '');
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
  // NORMALIZE QUESTION
  // ═══════════════════════════════════════════════════════════════

  function normalizeQuestion(q) {
    if (!q || typeof q !== 'object') return null;

    const out = { _original: q };
    out.question = normalizeText(String(getField(q, 'question', '') || ''));
    out.type = String(getField(q, 'type', '') || '').toLowerCase();

    const rawOpts = getField(q, 'options', null);
    if (Array.isArray(rawOpts)) {
      out.options = rawOpts.map(o => normalizeText(String(o || '')));
    } else if (rawOpts && typeof rawOpts === 'object') {
      out.options = Object.values(rawOpts).map(o => normalizeText(String(o || '')));
    } else {
      out.options = null;
    }

    const rawAnswer = getField(q, 'answer', null);

    const rawStmts = getField(q, 'statements', null);
    if (Array.isArray(rawStmts) && rawStmts.length) {
      out.statements = rawStmts.map(s => {
        if (typeof s === 'string') return { text: normalizeText(s), answer: null, level: '' };
        if (typeof s === 'object' && s !== null) {
          return {
            text: normalizeText(String(getField(s, 'stText', '') || '')),
            answer: toBoolean(getField(s, 'stAnswer', null)),
            level: String(getField(s, 'level', '') || ''),
          };
        }
        return null;
      }).filter(Boolean);
    } else {
      out.statements = null;
    }

    out.explanation = normalizeText(String(getField(q, 'explanation', '') || ''));
    out.topic = String(getField(q, 'topic', '') || '');

    if (!out.type) {
      if (Array.isArray(out.statements) && out.statements.length > 0) out.type = 'tf';
      else if (Array.isArray(out.options) && out.options.length > 0 && rawAnswer !== null && rawAnswer !== undefined) out.type = 'mcq';
      else if (rawAnswer !== null && rawAnswer !== undefined) out.type = 'short';
      else if (Array.isArray(out.options) && out.options.length > 0) out.type = 'mcq';
    }

    const typeNorm = out.type.toLowerCase().replace(/[_\s-]/g, '');
    for (const [canon, aliases] of Object.entries(TYPE_ALIASES)) {
      if (aliases.some(a => a.toLowerCase().replace(/[_\s-]/g, '') === typeNorm)) {
        out.type = canon;
        break;
      }
    }

    // 🆕 v29: MCQ ANSWER → LETTER ("A"/"B"/"C"/"D")
    if (out.type === 'mcq' && Array.isArray(out.options)) {
      const formatted = formatAnswerDisplay(rawAnswer, out.options, 'mcq');
      out.answer = formatted.letter;        // "A" hoặc null
      out.answerIndex = formatted.index;    // 0 hoặc null
      out.answerDisplay = formatted.display; // "A. text"
      out.answerValid = formatted.valid;
    } else if (out.type === 'short') {
      if (typeof rawAnswer === 'string') out.answer = rawAnswer.trim();
      else if (rawAnswer !== null && rawAnswer !== undefined) out.answer = String(rawAnswer).trim();
      else out.answer = null;
    } else {
      out.answer = rawAnswer;
    }

    return out;
  }

  function isDeckObject(obj) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false;
    const keys = Object.keys(obj).map(k => k.toLowerCase());
    return ['mc','mcq','tf','truefalse','sa','short','parti','part1','partii','part2','partiii','part3'].some(k => keys.includes(k));
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

    function extractAllDecks(obj, prefix = '', depth = 0) {
      if (depth > 8) return;
      if (!obj || typeof obj !== 'object') return;

      if (Array.isArray(obj)) {
        if (obj.length && obj[0] && typeof obj[0] === 'object') {
          let allAreDecks = true;
          let allAreQuestions = true;
          for (const item of obj) {
            if (!isDeckObject(item)) allAreDecks = false;
            if (!isQuestionLike(item)) allAreQuestions = false;
            if (!allAreDecks && !allAreQuestions) break;
          }
          if (allAreDecks) {
            obj.forEach((deckObj, i) => {
              const name = getField(deckObj, 'name', null) || (prefix ? `${prefix} ${i + 1}` : 'Đề ' + (i + 1));
              const flat = flattenDeckObject(deckObj, name);
              addDeck(flat.name, flat.questions);
            });
            return;
          }
          if (allAreQuestions) { addDeck(prefix || 'Đề 1', obj); return; }
          obj.forEach((item, i) => extractAllDecks(item, prefix ? `${prefix}.${i + 1}` : `Đề ${i + 1}`, depth + 1));
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
          let allAreDecks = true;
          for (const item of val) if (!isDeckObject(item)) { allAreDecks = false; break; }
          if (allAreDecks) {
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
        if (val && typeof val === 'object' && !Array.isArray(val)) {
          extractAllDecks(val, prefix ? `${prefix}.${key}` : key, depth + 1);
        }
      }
    }

    extractAllDecks(raw);

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
  // MASTER EXTRACTOR
  // ═══════════════════════════════════════════════════════════════

  function extractQuizData(html, options = {}) {
    if (!html || typeof html !== 'string') throw new Error('HTML rỗng');

    const stats = {
      htmlSize: html.length,
      strategiesRun: 0,
      candidatesFound: 0,
      helpersFound: 0,
      helperNames: [],
      verified: 0,
      timeMs: 0,
      errors: [],
    };

    const startTime = performance.now();
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

    let helpers = null;
    try {
      helpers = compileHelperFunctions(js);
      stats.helpersFound = helpers ? Object.keys(helpers).length : 0;
      stats.helperNames = helpers ? Object.keys(helpers) : [];
    } catch (e) {
      stats.errors.push('helper: ' + e.message);
    }

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
              const parsed = safeEvalWithHelpers(code, helpers);
              if (parsed) addCandidate(parsed, name, 'named', 40);
            }
          }
        }
      }
    } catch (e) { stats.errors.push('named: ' + e.message); }
    stats.strategiesRun++;

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
            const parsed = safeEvalWithHelpers(code, helpers);
            if (parsed) addCandidate(parsed, name, 'generic', 15);
          }
        }
      }
    } catch (e) { stats.errors.push('generic: ' + e.message); }
    stats.strategiesRun++;

    if (!candidates.length) {
      throw new Error(
        'Không tìm thấy dữ liệu. Helpers: ' + stats.helperNames.join(', ') + '. Errors: ' + stats.errors.join('; ')
      );
    }

    for (let i = 0; i < candidates.length; i++) {
      for (let j = i + 1; j < candidates.length; j++) {
        try {
          const sigA = JSON.stringify(candidates[i].data).substring(0, 500);
          const sigB = JSON.stringify(candidates[j].data).substring(0, 500);
          if (sigA === sigB) {
            candidates[i].score += 50;
            candidates[j].score += 50;
          }
        } catch {}
      }
    }
    candidates.sort((a, b) => b.score - a.score);

    let best = null;
    let bestVerification = null;
    let bestDeckCount = 0;

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

    if (!best) {
      throw new Error('Không có candidate hợp lệ. Total: ' + candidates.length);
    }

    stats.timeMs = Math.round(performance.now() - startTime);

    return {
      data: best.data,
      source: best.source,
      method: best.method,
      confidence: best.score,
      verification: bestVerification,
      stats,
      allCandidates: candidates.slice(0, 10).map(c => ({
        source: c.source,
        method: c.method,
        score: c.score,
        questionCount: estimateQuestionCount(c.data),
      })),
    };
  }

  function estimateQuestionCount(obj) {
    if (!obj) return 0;
    if (Array.isArray(obj)) return obj.length;
    if (typeof obj === 'object') {
      let total = 0;
      for (const k of Object.keys(obj)) {
        if (Array.isArray(obj[k])) total += obj[k].length;
      }
      return total;
    }
    return 0;
  }

  function scoreQuizObject(obj) {
    if (!obj) return 0;
    let score = 0;
    const scoreQuestion = (q) => {
      if (!q || typeof q !== 'object') return 0;
      let s = 0;
      if (hasAnyField(q, ['question'])) s += 10;
      if (hasAnyField(q, ['options'])) s += 8;
      if (hasAnyField(q, ['answer'])) s += 10;
      if (hasAnyField(q, ['statements'])) s += 6;
      return s;
    };
    const scoreArray = (arr) => {
      if (!Array.isArray(arr) || !arr.length) return 0;
      let s = 0;
      const sample = arr.slice(0, 5);
      for (const item of sample) {
        if (Array.isArray(item)) s += scoreArray(item) * 0.5;
        else if (item && typeof item === 'object') s += scoreQuestion(item);
      }
      if (arr.length >= 5) s += 5;
      return s / sample.length * Math.min(arr.length, 10);
    };
    if (Array.isArray(obj)) {
      score = scoreArray(obj);
    } else if (typeof obj === 'object') {
      for (const key of Object.keys(obj)) {
        const val = obj[key];
        if (Array.isArray(val)) score += scoreArray(val);
        else if (val && typeof val === 'object') {
          if (Array.isArray(val.questions)) score += scoreArray(val.questions);
          else if (isDeckObject(val)) {
            for (const ik of Object.keys(val)) {
              if (Array.isArray(val[ik])) score += scoreArray(val[ik]);
            }
          }
        }
      }
    }
    return Math.round(score);
  }

  function verifyCandidate(candidate) {
    if (!candidate || !candidate.data) return { valid: false, reason: 'empty' };
    try {
      const decks = normalizeDecks(candidate.data);
      if (!decks.length) return { valid: false, reason: 'no-decks' };
      const totalQ = decks.reduce((s, d) => s + d.questions.length, 0);
      if (totalQ === 0) return { valid: false, reason: 'no-questions' };
      let validQ = 0;
      let hasAnswer = false;
      for (const d of decks) {
        for (const q of d.questions) {
          if (q.question || q.answer !== null || q.options) validQ++;
          if (q.answer !== null && q.answer !== undefined) hasAnswer = true;
          if (q.type === 'tf' && Array.isArray(q.statements)) {
            for (const st of q.statements) {
              if (st.answer !== null) hasAnswer = true;
            }
          }
        }
      }
      return {
        valid: validQ > 0 && hasAnswer,
        deckCount: decks.length,
        totalQuestions: totalQ,
        validQuestions: validQ,
      };
    } catch (e) {
      return { valid: false, reason: e.message };
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════════

  global.QuizParser = {
    version: VERSION,
    extractQuizData,
    normalizeDecks,
    normalizeQuestion,
    normalizeText,
    normalizeMcqAnswer,
    formatAnswerDisplay,   // 🆕 v29: PUBLIC HELPER
    toBoolean,
    looksLikeQuiz,
    scoreQuizObject,
    verifyCandidate,
    estimateQuestionCount,
    detectHelperFunctions,
    compileHelperFunctions,
    safeEvalWithHelpers,
    getStats: () => ({
      version: VERSION,
      varNames: VAR_NAMES.length,
      helperWhitelist: HELPER_NAME_WHITELIST.length,
      genericHelpers: Object.keys(GENERIC_HELPERS).length,
    }),
    _internal: {
      safeEval, matchBracket, findOpen,
      FIELD_ALIASES, VAR_NAMES, TYPE_ALIASES, PART_KEY_MAP,
      HELPER_NAME_WHITELIST, GENERIC_HELPERS,
    },
  };

  if (DEBUG) {
    console.log(`%c🐱 QuizParser v${VERSION} loaded`, 'color:#ff6ac1;font-weight:bold');
  }

})(typeof window !== 'undefined' ? window : globalThis);
