/**
 * app.js - 智能双语文档提取与默写闪卡交互逻辑
 */

// Application State
const state = {
  cards: [],
  filteredCards: [],
  currentIndex: 0,
  flipIndex: 0,
  flipDirection: 'zh_en', // 'zh_en' (Front ZH, Back EN) or 'en_zh'
  isAnswerSubmitted: false,
  hintLevel: 0,
  activeFilter: 'all',
  onlyWithNotes: false,
  editingNoteCardId: null,
  searchQuery: '',
  targetDirectory: '.'
};

// DOM Element References
const elements = {
  // Navigation Tabs
  tabButtons: document.querySelectorAll('.tab-btn'),
  tabPanels: document.querySelectorAll('.tab-panel'),
  totalBadge: document.getElementById('total-badge'),
  btnQuickScan: document.getElementById('btn-quick-scan'),
  btnThemeToggle: document.getElementById('btn-theme-toggle'),
  btnNavChooseFile: document.getElementById('btn-nav-choose-file'),

  // Dictate Panel
  btnDictatePrevNav: document.getElementById('btn-dictate-prev-nav'),
  btnDictatePicker: document.getElementById('btn-dictate-picker'),
  dictateCurrentNum: document.getElementById('dictate-current-num'),
  dictateTotalNum: document.getElementById('dictate-total-num'),
  btnDictateNextNav: document.getElementById('btn-dictate-next-nav'),
  dictateJumpInput: document.getElementById('dictate-jump-input'),
  dictateTotalCount: document.getElementById('dictate-total-count'),
  btnDictateJump: document.getElementById('btn-dictate-jump'),
  dictateProgressMastered: document.getElementById('dictate-progress-mastered'),
  dictateProgressLearning: document.getElementById('dictate-progress-learning'),
  dictateProgressSummary: document.getElementById('dictate-progress-summary'),
  dictateStatMastered: document.getElementById('dictate-stat-mastered'),
  dictateStatLearning: document.getElementById('dictate-stat-learning'),
  dictateStatNew: document.getElementById('dictate-stat-new'),

  cardSourceTag: document.getElementById('card-source-tag'),
  cardTypeTag: document.getElementById('card-type-tag'),
  cardStatusTag: document.getElementById('card-status-tag'),
  cardStatusText: document.getElementById('card-status-text'),
  btnSound: document.getElementById('btn-sound'),
  dictatePromptZh: document.getElementById('dictate-prompt-zh'),
  dictateHintText: document.getElementById('dictate-hint-text'),
  dictateInput: document.getElementById('dictate-input'),
  btnHint: document.getElementById('btn-hint'),
  btnReveal: document.getElementById('btn-reveal'),
  btnCheck: document.getElementById('btn-check'),
  resultContainer: document.getElementById('result-container'),
  scoreVal: document.getElementById('score-val'),
  scoreBadge: document.getElementById('score-badge'),
  diffOutput: document.getElementById('diff-output'),
  referenceEn: document.getElementById('reference-en'),
  dictateNoteInput: document.getElementById('dictate-note-input'),
  btnSaveDictateNote: document.getElementById('btn-save-dictate-note'),
  dictateNoteTip: document.getElementById('dictate-note-tip'),
  btnPrevCard: document.getElementById('btn-prev-card'),
  btnMarkMastered: document.getElementById('btn-mark-mastered'),
  btnMarkLearning: document.getElementById('btn-mark-learning'),
  btnNextCard: document.getElementById('btn-next-card'),

  // Flip Panel
  btnFlipPrevNav: document.getElementById('btn-flip-prev-nav'),
  btnFlipPicker: document.getElementById('btn-flip-picker'),
  flipCurrentNum: document.getElementById('flip-current-num'),
  flipTotalNum: document.getElementById('flip-total-num'),
  btnFlipNextNav: document.getElementById('btn-flip-next-nav'),
  flipJumpInput: document.getElementById('flip-jump-input'),
  flipTotalCount: document.getElementById('flip-total-count'),
  btnFlipJump: document.getElementById('btn-flip-jump'),
  flipFileTag: document.getElementById('flip-file-tag'),
  btnToggleDirection: document.getElementById('btn-toggle-direction'),
  directionText: document.getElementById('direction-text'),
  flashcard3D: document.getElementById('flashcard-3d'),
  flipFrontContent: document.getElementById('flip-front-content'),
  flipBackContent: document.getElementById('flip-back-content'),
  btnFlipAudio: document.getElementById('btn-flip-audio'),
  btnFlipPrev: document.getElementById('btn-flip-prev'),
  btnFlipTrigger: document.getElementById('btn-flip-trigger'),
  btnFlipNext: document.getElementById('btn-flip-next'),

  // Card Picker Modal
  cardPickerModal: document.getElementById('card-picker-modal'),
  btnClosePicker: document.getElementById('btn-close-picker'),
  pickerFilterInput: document.getElementById('picker-filter-input'),
  pickerListContainer: document.getElementById('picker-list-container'),
  pickerTotalBadge: document.getElementById('picker-total-badge'),

  // Manage Panel
  btnNavChooseDir: document.getElementById('btn-nav-choose-dir'),
  inputTargetDir: document.getElementById('input-target-dir'),
  btnChooseDir: document.getElementById('btn-choose-dir'),
  btnChooseFile: document.getElementById('btn-choose-file'),
  browserDirPicker: document.getElementById('browser-dir-picker'),
  browserFilePicker: document.getElementById('browser-file-picker'),
  btnDoScan: document.getElementById('btn-do-scan'),
  currentScanPath: document.getElementById('current-scan-path'),
  btnExportAnki: document.getElementById('btn-export-anki'),
  btnExportJson: document.getElementById('btn-export-json'),
  searchInput: document.getElementById('search-input'),
  filterPills: document.querySelectorAll('.filter-pill[data-filter]'),
  btnFilterNotes: document.getElementById('btn-filter-notes'),
  countHasNotes: document.getElementById('count-has-notes'),
  cardsTbody: document.getElementById('cards-tbody'),
  countAll: document.getElementById('count-all'),
  countNew: document.getElementById('count-new'),
  countLearning: document.getElementById('count-learning'),
  countMastered: document.getElementById('count-mastered'),

  // Note Modal
  noteModal: document.getElementById('note-modal'),
  btnCloseNoteModal: document.getElementById('btn-close-note-modal'),
  btnCancelNoteModal: document.getElementById('btn-cancel-note-modal'),
  btnConfirmNoteModal: document.getElementById('btn-confirm-note-modal'),
  noteModalTextarea: document.getElementById('note-modal-textarea'),
  noteModalCardInfo: document.getElementById('note-modal-card-info')
};

/* ==========================================================================
   Theme Management (白天/夜间模式)
   ========================================================================== */
function initTheme() {
  const saved = localStorage.getItem('flashcard-theme');
  if (saved === 'light' || (!saved && window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches)) {
    setTheme('light');
  } else {
    setTheme('dark');
  }
}

function setTheme(theme) {
  if (theme === 'light') {
    document.body.classList.remove('dark-theme');
    document.body.classList.add('light-theme');
    document.documentElement.classList.add('light-theme');
    localStorage.setItem('flashcard-theme', 'light');
  } else {
    document.body.classList.remove('light-theme');
    document.body.classList.add('dark-theme');
    document.documentElement.classList.remove('light-theme');
    localStorage.setItem('flashcard-theme', 'dark');
  }
}

function toggleTheme() {
  const isLight = document.body.classList.contains('light-theme');
  setTheme(isLight ? 'dark' : 'light');
  showToast(isLight ? '已切换至深色夜间模式' : '已切换至明亮白天模式');
}

/* ==========================================================================
   Progress Persistence (进度保存与恢复)
   ========================================================================== */
function getStorageKey(prefix) {
  const cleanPath = (state.targetDirectory || '.').replace(/[^a-zA-Z0-9]/g, '_');
  return `fc_${prefix}_${cleanPath}`;
}

function saveProgressIndices() {
  try {
    localStorage.setItem(getStorageKey('dictate_idx'), state.currentIndex);
    localStorage.setItem(getStorageKey('flip_idx'), state.flipIndex);
  } catch (e) {}
}

function restoreProgressIndices() {
  try {
    const savedDictate = localStorage.getItem(getStorageKey('dictate_idx'));
    if (savedDictate !== null) {
      const idx = parseInt(savedDictate, 10);
      if (!isNaN(idx) && idx >= 0 && idx < state.cards.length) {
        state.currentIndex = idx;
      }
    }
    const savedFlip = localStorage.getItem(getStorageKey('flip_idx'));
    if (savedFlip !== null) {
      const idx = parseInt(savedFlip, 10);
      if (!isNaN(idx) && idx >= 0 && idx < state.cards.length) {
        state.flipIndex = idx;
      }
    }
  } catch (e) {}
}

/* ==========================================================================
   Initialization & API
   ========================================================================== */
async function initApp() {
  initTheme();
  bindEvents();
  await loadCards();
}

async function loadCards() {
  try {
    const res = await fetch('/api/cards');
    const data = await res.json();
    if (data.cards) {
      state.cards = data.cards;
      // 容灾恢复：若后端卡片暂无笔记，尝试从 localStorage 读取同步
      state.cards.forEach(card => {
        const localNote = localStorage.getItem(`fc_note_${card.id}`);
        if ((!card.note || !card.note.trim()) && localNote) {
          card.note = localNote;
        }
      });
      if (data.target_directory) {
        state.targetDirectory = data.target_directory;
        elements.inputTargetDir.value = data.target_directory;
        elements.currentScanPath.textContent = data.target_directory;
      }
      restoreProgressIndices();
      applyFiltersAndSearch();
      renderDictateCard();
      renderFlipCard();
      updateStats();
    }
  } catch (err) {
    console.error('Failed to load cards:', err);
  }
}

async function triggerScan(targetDir) {
  try {
    elements.btnDoScan.disabled = true;
    elements.btnDoScan.innerHTML = '<span>扫描提取中...</span>';
    const res = await fetch('/api/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ directory: targetDir })
    });
    const data = await res.json();
    if (data.cards) {
      state.cards = data.cards;
      state.cards.forEach(card => {
        const localNote = localStorage.getItem(`fc_note_${card.id}`);
        if ((!card.note || !card.note.trim()) && localNote) {
          card.note = localNote;
        }
      });
      state.targetDirectory = data.target_directory || targetDir;
      elements.currentScanPath.textContent = state.targetDirectory;
      state.currentIndex = 0;
      state.flipIndex = 0;
      saveProgressIndices();
      applyFiltersAndSearch();
      renderDictateCard();
      renderFlipCard();
      updateStats();
      showToast(`扫描成功！提取到 ${state.cards.length} 张卡片`);
    }
  } catch (err) {
    console.error('Scan failed:', err);
    showToast('扫描失败，请检查目录路径');
  } finally {
    elements.btnDoScan.disabled = false;
    elements.btnDoScan.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
      </svg>
      <span>开始提取文档</span>
    `;
  }
}

async function updateCardStatus(cardId, status, incrementError = false) {
  try {
    const res = await fetch('/api/update_card', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: cardId, status: status, increment_error: incrementError })
    });
    const data = await res.json();
    if (data.card) {
      const idx = state.cards.findIndex(c => c.id === cardId);
      if (idx !== -1) {
        const oldNote = state.cards[idx].note;
        state.cards[idx] = data.card;
        if (!state.cards[idx].note && oldNote) {
          state.cards[idx].note = oldNote;
        }
        updateStats();
        renderDictateProgress();
        renderManageTable();
      }
    }
  } catch (err) {
    console.error('Update card status failed:', err);
  }
}

async function saveCardNote(cardId, noteText) {
  const card = state.cards.find(c => c.id === cardId);
  if (!card) return;

  const trimmed = (noteText || '').trim();
  card.note = trimmed;

  // 1. 本地存储容灾
  try {
    if (trimmed) {
      localStorage.setItem(`fc_note_${cardId}`, trimmed);
    } else {
      localStorage.removeItem(`fc_note_${cardId}`);
    }
  } catch (e) {}

  // 2. 后端异步持久化
  try {
    const res = await fetch('/api/update_card_note', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: cardId, note: trimmed })
    });
    if (res.ok) {
      const data = await res.json();
      if (data.card && data.card.note !== undefined) {
        card.note = data.card.note;
      }
    }
  } catch (err) {
    console.error('Update card note failed:', err);
  }

  updateStats();
  renderManageTable();
}

function handleSaveDictateNote() {
  const card = getCurrentDictateCard();
  if (!card || !elements.dictateNoteInput) return;
  const noteText = elements.dictateNoteInput.value;
  saveCardNote(card.id, noteText);
  if (elements.dictateNoteTip) {
    elements.dictateNoteTip.classList.remove('hidden');
    elements.dictateNoteTip.textContent = '✓ 笔记已保存';
    setTimeout(() => {
      elements.dictateNoteTip.classList.add('hidden');
    }, 2500);
  }
  showToast('笔记已成功保存');
}

/* ==========================================================================
   Dictate Mode (给中文默写英文)
   ========================================================================== */
function getCurrentDictateCard() {
  if (state.cards.length === 0) return null;
  if (state.currentIndex >= state.cards.length) {
    state.currentIndex = 0;
  }
  return state.cards[state.currentIndex];
}

function goToDictateCard(idx) {
  if (state.cards.length === 0) return;
  state.currentIndex = Math.max(0, Math.min(state.cards.length - 1, idx));
  saveProgressIndices();
  renderDictateCard();
}

function goToPrevDictateCard() {
  if (state.cards.length === 0) return;
  state.currentIndex = (state.currentIndex - 1 + state.cards.length) % state.cards.length;
  saveProgressIndices();
  renderDictateCard();
}

function goToNextDictateCard() {
  if (state.cards.length === 0) return;
  state.currentIndex = (state.currentIndex + 1) % state.cards.length;
  saveProgressIndices();
  renderDictateCard();
}

function renderDictateProgress() {
  const total = state.cards.length;
  const countMastered = state.cards.filter(c => c.status === 'mastered').length;
  const countLearning = state.cards.filter(c => c.status === 'learning').length;
  const countNew = state.cards.filter(c => (c.status || 'new') === 'new').length;

  if (elements.dictateStatMastered) elements.dictateStatMastered.textContent = countMastered;
  if (elements.dictateStatLearning) elements.dictateStatLearning.textContent = countLearning;
  if (elements.dictateStatNew) elements.dictateStatNew.textContent = countNew;

  if (elements.dictateProgressSummary) {
    elements.dictateProgressSummary.textContent = total > 0 
      ? `${state.currentIndex + 1} / ${total}` 
      : '0 / 0';
  }

  if (elements.dictateProgressMastered && elements.dictateProgressLearning) {
    const mPct = total > 0 ? (countMastered / total) * 100 : 0;
    const lPct = total > 0 ? (countLearning / total) * 100 : 0;
    elements.dictateProgressMastered.style.width = `${mPct}%`;
    elements.dictateProgressLearning.style.width = `${lPct}%`;
  }
}

function renderDictateCard() {
  const card = getCurrentDictateCard();
  state.isAnswerSubmitted = false;
  state.hintLevel = 0;

  elements.resultContainer.classList.add('hidden');
  elements.dictateHintText.classList.add('hidden');
  elements.dictateHintText.textContent = '';
  elements.dictateInput.value = '';
  elements.btnCheck.innerHTML = `
    <span>检查对比 (Enter)</span>
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
      <polyline points="20 6 9 17 4 12"></polyline>
    </svg>
  `;

  renderDictateProgress();

  if (elements.dictateNoteInput) {
    elements.dictateNoteInput.value = (card && card.note) ? card.note : '';
  }
  if (elements.dictateNoteTip) {
    elements.dictateNoteTip.classList.add('hidden');
  }

  if (!card) {
    elements.dictatePromptZh.textContent = '当前没有可用卡片，请先在管理页扫描提取文档。';
    if (elements.dictateCurrentNum) elements.dictateCurrentNum.textContent = '0';
    if (elements.dictateTotalNum) elements.dictateTotalNum.textContent = '0';
    if (elements.dictateJumpInput) {
      elements.dictateJumpInput.value = 0;
      elements.dictateJumpInput.max = 0;
    }
    if (elements.dictateTotalCount) elements.dictateTotalCount.textContent = '0';
    if (elements.cardSourceTag) elements.cardSourceTag.textContent = '无文件';
    if (elements.cardTypeTag) elements.cardTypeTag.textContent = '-';
    elements.dictateInput.disabled = true;
    elements.btnCheck.disabled = true;
    return;
  }

  elements.dictateInput.disabled = false;
  elements.btnCheck.disabled = false;

  // 更新序号显示 (当前 / 总计)
  if (elements.dictateCurrentNum) {
    elements.dictateCurrentNum.textContent = state.currentIndex + 1;
  }
  if (elements.dictateTotalNum) {
    elements.dictateTotalNum.textContent = state.cards.length;
  }
  if (elements.dictateJumpInput) {
    elements.dictateJumpInput.value = state.currentIndex + 1;
    elements.dictateJumpInput.max = state.cards.length;
  }
  if (elements.dictateTotalCount) {
    elements.dictateTotalCount.textContent = state.cards.length;
  }

  elements.dictatePromptZh.textContent = card.chinese;
  if (elements.cardSourceTag) {
    elements.cardSourceTag.textContent = `${card.source_file} : L${card.line_number}`;
  }

  // 类型标签美化 (若存在)
  const typeMap = {
    'inline_bracket': '同行括号',
    'inline_delimiter': '同行分隔符',
    'markdown_table': '表格提取',
    'adjacent_lines': '上下相邻行'
  };
  if (elements.cardTypeTag) {
    elements.cardTypeTag.textContent = typeMap[card.extract_type] || card.extract_type;
  }

  // 状态指示灯与掌握情况 (颜色灯 + 本词条具体掌握情况)
  if (elements.cardStatusTag) {
    const status = card.status || 'new';
    elements.cardStatusTag.className = `status-pill status-${status}`;
    const statusNames = { 'new': '待练习', 'learning': '复习中', 'mastered': '已掌握' };
    if (elements.cardStatusText) {
      elements.cardStatusText.textContent = statusNames[status] || '待练习';
    } else {
      elements.cardStatusTag.textContent = statusNames[status] || '待练习';
    }
  }

  setTimeout(() => elements.dictateInput.focus(), 50);
}

function handleCheckAnswer() {
  const card = getCurrentDictateCard();
  if (!card) return;

  const userInput = elements.dictateInput.value.trim();
  const targetAnswer = card.english.trim();

  const comparison = compareStrings(userInput, targetAnswer);
  renderDiffResult(comparison, targetAnswer);

  state.isAnswerSubmitted = true;
  elements.resultContainer.classList.remove('hidden');

  // 需求 3：无论是否完全正确，回车核对时均自动播放标准英文发音
  playAudio(targetAnswer);

  // 需求 4：自动归档与进度保存到后端
  const isMastered = comparison.score >= 90;
  const newStatus = isMastered ? 'mastered' : 'learning';
  updateCardStatus(card.id, newStatus, !isMastered);

  // 界面状态即时刷新
  elements.cardStatusTag.className = `status-pill status-${newStatus}`;
  elements.cardStatusTag.textContent = isMastered ? '已掌握' : '复习中';
  renderDictateProgress();
}

function handleHint() {
  const card = getCurrentDictateCard();
  if (!card) return;

  const words = card.english.trim().split(/\s+/);
  state.hintLevel++;

  elements.dictateHintText.classList.remove('hidden');

  if (state.hintLevel === 1) {
    // 级别 1: 显示每个单词的首字母与字符下划线
    const masked = words.map(w => {
      if (w.length <= 2) return w;
      return w[0] + '·'.repeat(w.length - 1);
    }).join(' ');
    elements.dictateHintText.textContent = `首字母提示: ${masked} (共 ${words.length} 词)`;
  } else if (state.hintLevel === 2) {
    // 级别 2: 显示前半部分
    const half = Math.max(1, Math.ceil(words.length / 2));
    const hint = words.slice(0, half).join(' ') + ' ...';
    elements.dictateHintText.textContent = `前半句提示: ${hint}`;
  } else {
    // 级别 3: 完整显示
    elements.dictateHintText.textContent = `完整英文: ${card.english}`;
  }
}

function handleReveal() {
  const card = getCurrentDictateCard();
  if (!card) return;
  elements.dictateHintText.classList.remove('hidden');
  elements.dictateHintText.textContent = `标准答案: ${card.english}`;
  handleCheckAnswer();
}

/* ==========================================================================
   Smart Diff Algorithm & Comparison
   ========================================================================== */
function tokenizeWords(str) {
  // 分离单词和标点
  const tokens = [];
  const regex = /([a-zA-Z0-9]+|[^\s\w]+)/g;
  let match;
  while ((match = regex.exec(str)) !== null) {
    tokens.push(match[0]);
  }
  return tokens;
}

function cleanToken(t) {
  return t.toLowerCase().replace(/^[^\w]+|[^\w]+$/g, '');
}

function compareStrings(userStr, targetStr) {
  const userTokens = tokenizeWords(userStr);
  const targetTokens = tokenizeWords(targetStr);

  // 计算 LCS (Longest Common Subsequence) 矩阵
  const m = userTokens.length;
  const n = targetTokens.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const u = cleanToken(userTokens[i - 1]);
      const t = cleanToken(targetTokens[j - 1]);
      if (u === t && u.length > 0) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // 回溯还原 diff 路径
  let i = m, j = n;
  const diffItems = [];
  let matchesCount = 0;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && cleanToken(userTokens[i - 1]) === cleanToken(targetTokens[j - 1]) && cleanToken(userTokens[i - 1]).length > 0) {
      diffItems.unshift({ type: 'correct', val: userTokens[i - 1], target: targetTokens[j - 1] });
      matchesCount++;
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      diffItems.unshift({ type: 'missing', val: targetTokens[j - 1] });
      j--;
    } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
      diffItems.unshift({ type: 'wrong', val: userTokens[i - 1] });
      i--;
    }
  }

  // 综合计算相似度分数
  let score = 0;
  if (targetTokens.length === 0) {
    score = userTokens.length === 0 ? 100 : 0;
  } else {
    // 匹配词占比
    const matchRatio = matchesCount / targetTokens.length;
    // 额外惩罚多写错写的单词
    const penalty = Math.max(0, (userTokens.length - matchesCount) * 0.05);
    score = Math.max(0, Math.min(100, Math.round((matchRatio - penalty) * 100)));
  }

  return { score, diffItems };
}

function renderDiffResult(comparison, targetAnswer) {
  elements.scoreVal.textContent = `${comparison.score}%`;

  if (comparison.score === 100) {
    elements.scoreBadge.className = 'badge-success';
    elements.scoreBadge.textContent = '100% 完美吻合！';
  } else if (comparison.score >= 80) {
    elements.scoreBadge.className = 'badge-warning';
    elements.scoreBadge.textContent = '基本正确 (存在微小差异)';
  } else {
    elements.scoreBadge.className = 'badge-danger';
    elements.scoreBadge.textContent = '存在拼写或单词遗漏';
  }

  // 渲染对比标签
  elements.diffOutput.innerHTML = '';
  comparison.diffItems.forEach(item => {
    const span = document.createElement('span');
    if (item.type === 'correct') {
      span.className = 'token-correct';
      span.textContent = item.val;
    } else if (item.type === 'wrong') {
      span.className = 'token-wrong';
      span.textContent = item.val;
      span.title = '拼写错误或多余词汇';
    } else if (item.type === 'missing') {
      span.className = 'token-missing';
      span.textContent = item.val;
      span.title = '漏写的词汇';
    }
    elements.diffOutput.appendChild(span);
  });

  elements.referenceEn.textContent = targetAnswer;
  if (elements.dictateNoteInput) {
    const card = getCurrentDictateCard();
    elements.dictateNoteInput.value = (card && card.note) ? card.note : '';
  }
  if (elements.dictateNoteTip) {
    elements.dictateNoteTip.classList.add('hidden');
  }
}

function playAudio(text) {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'en-US';
    utter.rate = 0.95;
    window.speechSynthesis.speak(utter);
  }
}

/* ==========================================================================
   Flip Card Mode (3D 翻卡自测)
   ========================================================================== */
function goToFlipCard(idx) {
  if (state.cards.length === 0) return;
  state.flipIndex = Math.max(0, Math.min(state.cards.length - 1, idx));
  saveProgressIndices();
  renderFlipCard();
}

function goToPrevFlipCard() {
  if (state.cards.length === 0) return;
  state.flipIndex = (state.flipIndex - 1 + state.cards.length) % state.cards.length;
  saveProgressIndices();
  renderFlipCard();
}

function goToNextFlipCard() {
  if (state.cards.length === 0) return;
  state.flipIndex = (state.flipIndex + 1) % state.cards.length;
  saveProgressIndices();
  renderFlipCard();
}

function renderFlipCard() {
  if (state.cards.length === 0) {
    if (elements.flipCurrentNum) elements.flipCurrentNum.textContent = '0';
    if (elements.flipTotalNum) elements.flipTotalNum.textContent = '0';
    if (elements.flipJumpInput) {
      elements.flipJumpInput.value = 0;
      elements.flipJumpInput.max = 0;
    }
    if (elements.flipTotalCount) elements.flipTotalCount.textContent = '0';
    elements.flipFrontContent.textContent = '无卡片';
    elements.flipBackContent.textContent = '无卡片';
    return;
  }

  if (state.flipIndex >= state.cards.length) state.flipIndex = 0;
  if (state.flipIndex < 0) state.flipIndex = state.cards.length - 1;

  const card = state.cards[state.flipIndex];
  if (elements.flipCurrentNum) {
    elements.flipCurrentNum.textContent = state.flipIndex + 1;
  }
  if (elements.flipTotalNum) {
    elements.flipTotalNum.textContent = state.cards.length;
  }
  if (elements.flipJumpInput) {
    elements.flipJumpInput.value = state.flipIndex + 1;
    elements.flipJumpInput.max = state.cards.length;
  }
  if (elements.flipTotalCount) {
    elements.flipTotalCount.textContent = state.cards.length;
  }
  if (elements.flipFileTag) {
    elements.flipFileTag.textContent = `${card.source_file} : L${card.line_number}`;
  }

  // 保证换卡时回到正面
  elements.flashcard3D.classList.remove('is-flipped');

  if (state.flipDirection === 'zh_en') {
    elements.flipFrontContent.textContent = card.chinese;
    elements.flipBackContent.textContent = card.english;
  } else {
    elements.flipFrontContent.textContent = card.english;
    elements.flipBackContent.textContent = card.chinese;
  }
}

function toggleFlipCard() {
  if (elements.flashcard3D) {
    elements.flashcard3D.classList.toggle('is-flipped');
  }
}

/* ==========================================================================
   Card Picker Modal (快速选择与跳转词条弹窗)
   ========================================================================== */
let pickerTargetMode = 'dictate';

function openCardPicker(targetMode = 'dictate') {
  pickerTargetMode = targetMode;
  if (!elements.cardPickerModal) return;

  elements.cardPickerModal.classList.remove('hidden');
  if (elements.pickerTotalBadge) {
    elements.pickerTotalBadge.textContent = `共 ${state.cards.length} 条`;
  }
  if (elements.pickerFilterInput) {
    elements.pickerFilterInput.value = '';
  }

  renderPickerList('');

  setTimeout(() => {
    if (elements.pickerFilterInput) elements.pickerFilterInput.focus();
    const activeItem = elements.pickerListContainer ? elements.pickerListContainer.querySelector('.picker-item.active') : null;
    if (activeItem) {
      activeItem.scrollIntoView({ block: 'center' });
    }
  }, 60);
}

function closeCardPicker() {
  if (elements.cardPickerModal) {
    elements.cardPickerModal.classList.add('hidden');
  }
}

function renderPickerList(filterText = '') {
  if (!elements.pickerListContainer) return;

  const query = filterText.trim().toLowerCase();
  const currentActiveIdx = pickerTargetMode === 'dictate' ? state.currentIndex : state.flipIndex;

  const filtered = [];
  state.cards.forEach((card, idx) => {
    if (!query) {
      filtered.push({ card, idx });
    } else {
      const matchZh = card.chinese && card.chinese.toLowerCase().includes(query);
      const matchEn = card.english && card.english.toLowerCase().includes(query);
      const matchNum = String(idx + 1).includes(query);
      if (matchZh || matchEn || matchNum) {
        filtered.push({ card, idx });
      }
    }
  });

  if (filtered.length === 0) {
    elements.pickerListContainer.innerHTML = '<div class="picker-empty-state">没有找到匹配的词条</div>';
    return;
  }

  const statusNames = { 'new': '待练习', 'learning': '复习中', 'mastered': '已掌握' };

  elements.pickerListContainer.innerHTML = filtered.map(item => {
    const isActive = item.idx === currentActiveIdx;
    const status = item.card.status || 'new';
    return `
      <div class="picker-item ${isActive ? 'active' : ''}" data-index="${item.idx}">
        <span class="picker-item-index">#${item.idx + 1}</span>
        <div class="picker-item-content">
          <div class="picker-item-zh">${escapeHtml(item.card.chinese)}</div>
          <div class="picker-item-en">${escapeHtml(item.card.english)}</div>
        </div>
        <div class="picker-item-status">
          ${isActive ? '<span class="picker-current-tag">当前</span>' : `<span class="status-pill status-${status}">${statusNames[status] || '待练习'}</span>`}
        </div>
      </div>
    `;
  }).join('');

  // 绑定点击跳转
  elements.pickerListContainer.querySelectorAll('.picker-item').forEach(el => {
    el.addEventListener('click', () => {
      const idx = parseInt(el.getAttribute('data-index'), 10);
      if (!isNaN(idx)) {
        if (pickerTargetMode === 'dictate') {
          goToDictateCard(idx);
        } else {
          goToFlipCard(idx);
        }
      }
      closeCardPicker();
    });
  });
}

/* ==========================================================================
   Deck Management & Table
   ========================================================================== */
function applyFiltersAndSearch() {
  let list = [...state.cards];

  // 状态筛选
  if (state.activeFilter !== 'all') {
    list = list.filter(c => (c.status || 'new') === state.activeFilter);
  }

  // 笔记过滤器筛选：仅显示有笔记的卡片
  if (state.onlyWithNotes) {
    list = list.filter(c => c.note && c.note.trim().length > 0);
  }

  // 搜索关键字（支持中文释义、英文、笔记、文件名）
  if (state.searchQuery) {
    const q = state.searchQuery.toLowerCase();
    list = list.filter(c => 
      c.chinese.toLowerCase().includes(q) || 
      c.english.toLowerCase().includes(q) ||
      (c.note && c.note.toLowerCase().includes(q)) ||
      (c.source_file && c.source_file.toLowerCase().includes(q))
    );
  }

  state.filteredCards = list;
  renderManageTable();
}

function renderManageTable() {
  elements.cardsTbody.innerHTML = '';
  if (state.filteredCards.length === 0) {
    const tr = document.createElement('tr');
    const emptyMsg = state.onlyWithNotes ? '暂无带有笔记的闪卡' : '没有匹配的闪卡';
    tr.innerHTML = `<td colspan="5" style="text-align: center; color: var(--text-muted); padding: 32px;">${emptyMsg}</td>`;
    elements.cardsTbody.appendChild(tr);
    return;
  }

  state.filteredCards.forEach((c, i) => {
    const tr = document.createElement('tr');
    const statusMap = {
      'new': '<span class="status-pill status-new">待练</span>',
      'learning': '<span class="status-pill status-learning">复习</span>',
      'mastered': '<span class="status-pill status-mastered">掌握</span>'
    };

    const hasNote = Boolean(c.note && c.note.trim().length > 0);
    const noteHtml = hasNote
      ? `<div class="note-display" title="点击快速编辑笔记" data-action="edit-note" data-id="${c.id}">
           <span class="note-icon">📝</span>
           <span class="note-text-content">${escapeHtml(c.note)}</span>
           <button class="btn-edit-note-inline" title="编辑笔记" data-action="edit-note" data-id="${c.id}">
             <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
               <path d="M12 20h9"></path>
               <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
             </svg>
           </button>
         </div>`
      : `<button class="btn-add-note-inline" title="添加笔记" data-action="add-note" data-id="${c.id}">
           <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
             <line x1="12" y1="5" x2="12" y2="19"></line>
             <line x1="5" y1="12" x2="19" y2="12"></line>
           </svg>
           <span>添加笔记</span>
         </button>`;

    tr.innerHTML = `
      <td>${i + 1}</td>
      <td class="td-zh">${escapeHtml(c.chinese)}</td>
      <td class="td-en">${escapeHtml(c.english)}</td>
      <td class="td-note">${noteHtml}</td>
      <td>
        <div class="td-actions">
          ${statusMap[c.status || 'new']}
          <button class="btn-table-action" title="跳转至默写此卡" data-action="practice" data-id="${c.id}">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
          </button>
        </div>
      </td>
    `;
    elements.cardsTbody.appendChild(tr);
  });
}

function updateStats() {
  const total = state.cards.length;
  const countNew = state.cards.filter(c => (c.status || 'new') === 'new').length;
  const countLearning = state.cards.filter(c => c.status === 'learning').length;
  const countMastered = state.cards.filter(c => c.status === 'mastered').length;
  const countHasNotes = state.cards.filter(c => c.note && c.note.trim().length > 0).length;

  elements.totalBadge.textContent = total;
  elements.countAll.textContent = total;
  elements.countNew.textContent = countNew;
  elements.countLearning.textContent = countLearning;
  elements.countMastered.textContent = countMastered;
  if (elements.countHasNotes) {
    elements.countHasNotes.textContent = countHasNotes;
  }
}

function toggleNotesFilter() {
  state.onlyWithNotes = !state.onlyWithNotes;
  if (elements.btnFilterNotes) {
    elements.btnFilterNotes.classList.toggle('active', state.onlyWithNotes);
  }
  showToast(state.onlyWithNotes ? '已开启：仅显示有笔记的闪卡' : '已关闭笔记过滤，显示全部闪卡');
  applyFiltersAndSearch();
}

function openNoteModal(cardId) {
  const card = state.cards.find(c => c.id === cardId);
  if (!card) return;
  state.editingNoteCardId = cardId;
  if (elements.noteModalCardInfo) {
    elements.noteModalCardInfo.innerHTML = `
      <div style="font-size: 0.9rem; font-weight: 500; margin-bottom: 4px;">${escapeHtml(card.chinese)}</div>
      <div style="font-family: var(--font-mono); font-size: 0.82rem; color: #a5b4fc;">${escapeHtml(card.english)}</div>
    `;
  }
  if (elements.noteModalTextarea) {
    elements.noteModalTextarea.value = card.note || '';
  }
  if (elements.noteModal) {
    elements.noteModal.classList.remove('hidden');
    setTimeout(() => elements.noteModalTextarea && elements.noteModalTextarea.focus(), 60);
  }
}

function closeNoteModal() {
  state.editingNoteCardId = null;
  if (elements.noteModal) {
    elements.noteModal.classList.add('hidden');
  }
}

function handleConfirmNoteModal() {
  if (!state.editingNoteCardId || !elements.noteModalTextarea) return;
  const noteText = elements.noteModalTextarea.value;
  saveCardNote(state.editingNoteCardId, noteText);
  closeNoteModal();
  showToast('笔记已成功保存');
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function showToast(msg) {
  const existing = document.querySelector('.toast-popup');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'toast-popup';
  toast.textContent = msg;
  Object.assign(toast.style, {
    position: 'fixed',
    bottom: '24px',
    right: '24px',
    background: 'rgba(15, 23, 42, 0.95)',
    color: '#fff',
    border: '1px solid rgba(99, 102, 241, 0.4)',
    padding: '12px 20px',
    borderRadius: '10px',
    boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
    fontFamily: 'var(--font-sans)',
    fontSize: '0.9rem',
    zIndex: '9999',
    transition: 'all 0.3s ease'
  });
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

/* ==========================================================================
   Event Listeners & Keybindings
   ========================================================================== */
function bindEvents() {
  // Tab Switching
  elements.tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      elements.tabButtons.forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
      });
      elements.tabPanels.forEach(p => {
        p.classList.remove('active');
        p.classList.remove('hidden');
      });

      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');
      const targetPanel = document.getElementById(btn.dataset.tab);
      if (targetPanel) {
        targetPanel.classList.add('active');
        targetPanel.classList.remove('hidden');
      }

      if (btn.dataset.tab === 'flip-view') {
        renderFlipCard();
      } else if (btn.dataset.tab === 'manage-view') {
        applyFiltersAndSearch();
        updateStats();
      } else if (btn.dataset.tab === 'dictate-view') {
        renderDictateCard();
      }
    });
  });

  // Theme Toggle
  if (elements.btnThemeToggle) {
    elements.btnThemeToggle.addEventListener('click', toggleTheme);
  }

  // Quick Scan
  if (elements.btnQuickScan) {
    elements.btnQuickScan.addEventListener('click', () => {
      triggerScan(state.targetDirectory);
    });
  }

  // Dictation Mode Controls
  elements.btnCheck.addEventListener('click', handleCheckAnswer);
  elements.btnHint.addEventListener('click', handleHint);
  elements.btnReveal.addEventListener('click', handleReveal);

  elements.btnSound.addEventListener('click', () => {
    const card = getCurrentDictateCard();
    if (card) playAudio(card.english);
  });

  // Previous & Next Card Navigation (Icon Only)
  if (elements.btnPrevCard) {
    elements.btnPrevCard.addEventListener('click', goToPrevDictateCard);
  }
  if (elements.btnDictatePrevNav) {
    elements.btnDictatePrevNav.addEventListener('click', goToPrevDictateCard);
  }
  if (elements.btnDictateNextNav) {
    elements.btnDictateNextNav.addEventListener('click', goToNextDictateCard);
  }

  // Dictate Card Picker Trigger (Popup modal to scroll all entries)
  if (elements.btnDictatePicker) {
    elements.btnDictatePicker.addEventListener('click', () => openCardPicker('dictate'));
  }

  // Dictate Jump Input & Button
  if (elements.btnDictateJump) {
    elements.btnDictateJump.addEventListener('click', () => {
      const targetIdx = parseInt(elements.dictateJumpInput.value, 10) - 1;
      if (!isNaN(targetIdx)) goToDictateCard(targetIdx);
    });
  }
  if (elements.dictateJumpInput) {
    elements.dictateJumpInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const targetIdx = parseInt(elements.dictateJumpInput.value, 10) - 1;
        if (!isNaN(targetIdx)) goToDictateCard(targetIdx);
      }
    });
    elements.dictateJumpInput.addEventListener('change', () => {
      const targetIdx = parseInt(elements.dictateJumpInput.value, 10) - 1;
      if (!isNaN(targetIdx)) goToDictateCard(targetIdx);
    });
  }

  elements.btnMarkMastered.addEventListener('click', async () => {
    const card = getCurrentDictateCard();
    if (card) {
      await updateCardStatus(card.id, 'mastered');
      goToNextDictateCard();
    }
  });

  elements.btnMarkLearning.addEventListener('click', async () => {
    const card = getCurrentDictateCard();
    if (card) {
      await updateCardStatus(card.id, 'learning', true);
      goToNextDictateCard();
    }
  });

  elements.btnNextCard.addEventListener('click', () => {
    goToNextDictateCard();
  });

  // Keyboard Shortcuts in Dictation Input
  elements.dictateInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!state.isAnswerSubmitted) {
        handleCheckAnswer();
      } else {
        // 已提交状态下按 Enter 直接下一张
        goToNextDictateCard();
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      handleHint();
    }
  });

  // Global Keybindings
  window.addEventListener('keydown', (e) => {
    // 朗读发音 (Ctrl+S or Cmd+S)
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      const card = getCurrentDictateCard();
      if (card) playAudio(card.english);
    }
    // 标记熟练 (Ctrl+1)
    if ((e.ctrlKey || e.metaKey) && e.key === '1') {
      e.preventDefault();
      elements.btnMarkMastered.click();
    }
    // 标记重练 (Ctrl+2)
    if ((e.ctrlKey || e.metaKey) && e.key === '2') {
      e.preventDefault();
      elements.btnMarkLearning.click();
    }
    // 快捷键上下翻题 (Alt+Left / Alt+Right)
    if (e.altKey && e.key === 'ArrowLeft') {
      e.preventDefault();
      if (document.getElementById('dictate-view').classList.contains('active')) {
        goToPrevDictateCard();
      } else if (document.getElementById('flip-view').classList.contains('active')) {
        goToPrevFlipCard();
      }
    }
    if (e.altKey && e.key === 'ArrowRight') {
      e.preventDefault();
      if (document.getElementById('dictate-view').classList.contains('active')) {
        goToNextDictateCard();
      } else if (document.getElementById('flip-view').classList.contains('active')) {
        goToNextFlipCard();
      }
    }
    // 翻卡模式方向键左右切卡
    if (document.getElementById('flip-view').classList.contains('active') && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goToPrevFlipCard();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        goToNextFlipCard();
      }
    }
    // 关闭词条选择或笔记编辑弹窗 (Escape)
    if (e.key === 'Escape') {
      if (elements.noteModal && !elements.noteModal.classList.contains('hidden')) {
        e.preventDefault();
        closeNoteModal();
        return;
      }
      if (elements.cardPickerModal && !elements.cardPickerModal.classList.contains('hidden')) {
        e.preventDefault();
        closeCardPicker();
        return;
      }
    }

    // 翻卡模式空格翻转
    if (e.code === 'Space' && document.getElementById('flip-view').classList.contains('active')) {
      if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
        e.preventDefault();
        toggleFlipCard();
      }
    }
  });

  // Flip Card Mode Controls
  elements.flashcard3D.addEventListener('click', toggleFlipCard);
  elements.btnFlipTrigger.addEventListener('click', toggleFlipCard);

  elements.btnFlipPrev.addEventListener('click', goToPrevFlipCard);
  elements.btnFlipNext.addEventListener('click', goToNextFlipCard);
  if (elements.btnFlipPrevNav) {
    elements.btnFlipPrevNav.addEventListener('click', goToPrevFlipCard);
  }
  if (elements.btnFlipNextNav) {
    elements.btnFlipNextNav.addEventListener('click', goToNextFlipCard);
  }
  if (elements.btnFlipPicker) {
    elements.btnFlipPicker.addEventListener('click', () => openCardPicker('flip'));
  }

  // Card Picker Modal Controls
  if (elements.btnClosePicker) {
    elements.btnClosePicker.addEventListener('click', closeCardPicker);
  }
  if (elements.cardPickerModal) {
    elements.cardPickerModal.addEventListener('click', (e) => {
      if (e.target === elements.cardPickerModal) {
        closeCardPicker();
      }
    });
  }
  if (elements.pickerFilterInput) {
    elements.pickerFilterInput.addEventListener('input', (e) => {
      renderPickerList(e.target.value);
    });
  }

  if (elements.btnFlipJump) {
    elements.btnFlipJump.addEventListener('click', () => {
      const targetIdx = parseInt(elements.flipJumpInput.value, 10) - 1;
      if (!isNaN(targetIdx)) goToFlipCard(targetIdx);
    });
  }
  if (elements.flipJumpInput) {
    elements.flipJumpInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const targetIdx = parseInt(elements.flipJumpInput.value, 10) - 1;
        if (!isNaN(targetIdx)) goToFlipCard(targetIdx);
      }
    });
    elements.flipJumpInput.addEventListener('change', () => {
      const targetIdx = parseInt(elements.flipJumpInput.value, 10) - 1;
      if (!isNaN(targetIdx)) goToFlipCard(targetIdx);
    });
  }

  if (elements.btnToggleDirection) {
    elements.btnToggleDirection.addEventListener('click', () => {
      if (state.flipDirection === 'zh_en') {
        state.flipDirection = 'en_zh';
        if (elements.directionText) elements.directionText.textContent = '正面英文 → 背面中文';
      } else {
        state.flipDirection = 'zh_en';
        if (elements.directionText) elements.directionText.textContent = '正面中文 → 背面英文';
      }
      renderFlipCard();
    });
  }

  elements.btnFlipAudio.addEventListener('click', (e) => {
    e.stopPropagation();
    const card = state.cards[state.flipIndex];
    if (card) playAudio(card.english);
  });

  // Management & Scanner Controls
  async function handleChooseFolder() {
    try {
      showToast('正在打开本地文件夹选择窗口...');
      const res = await fetch('/api/choose_folder', { method: 'POST' });
      const data = await res.json();
      if (data.path) {
        elements.inputTargetDir.value = data.path;
        showToast(`已选择目录: ${data.path}`);
        await triggerScan(data.path);
      } else if (data.canceled) {
        // 用户取消
      } else {
        if (elements.browserDirPicker) elements.browserDirPicker.click();
      }
    } catch (err) {
      console.warn('Native picker fallback:', err);
      if (elements.browserDirPicker) elements.browserDirPicker.click();
    }
  }

  async function handleChooseFile() {
    try {
      showToast('正在打开本地文档选择窗口...');
      const res = await fetch('/api/choose_file', { method: 'POST' });
      const data = await res.json();
      if (data.path) {
        elements.inputTargetDir.value = data.path;
        showToast(`已选择文档: ${data.path}`);
        await triggerScan(data.path);
      } else if (data.canceled) {
        // 用户取消
      } else {
        if (elements.browserFilePicker) elements.browserFilePicker.click();
      }
    } catch (err) {
      console.warn('Native file picker fallback:', err);
      if (elements.browserFilePicker) elements.browserFilePicker.click();
    }
  }

  if (elements.btnChooseDir) {
    elements.btnChooseDir.addEventListener('click', handleChooseFolder);
  }
  if (elements.btnNavChooseDir) {
    elements.btnNavChooseDir.addEventListener('click', handleChooseFolder);
  }
  if (elements.btnChooseFile) {
    elements.btnChooseFile.addEventListener('click', handleChooseFile);
  }
  if (elements.btnNavChooseFile) {
    elements.btnNavChooseFile.addEventListener('click', handleChooseFile);
  }

  if (elements.browserDirPicker) {
    elements.browserDirPicker.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        const firstFile = e.target.files[0];
        const relPath = firstFile.webkitRelativePath;
        const topFolder = relPath.split('/')[0];
        if (topFolder) {
          elements.inputTargetDir.value = topFolder;
          triggerScan(topFolder);
        }
      }
    });
  }

  if (elements.browserFilePicker) {
    elements.browserFilePicker.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        const firstFile = e.target.files[0];
        if (firstFile.name) {
          elements.inputTargetDir.value = firstFile.name;
          triggerScan(firstFile.name);
        }
      }
    });
  }

  elements.btnDoScan.addEventListener('click', () => {
    const dir = elements.inputTargetDir.value.trim() || '.';
    triggerScan(dir);
  });

  elements.searchInput.addEventListener('input', (e) => {
    state.searchQuery = e.target.value.trim();
    applyFiltersAndSearch();
  });

  elements.filterPills.forEach(pill => {
    pill.addEventListener('click', () => {
      elements.filterPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      state.activeFilter = pill.dataset.filter;
      applyFiltersAndSearch();
    });
  });

  // 笔记过滤器切换 (工具栏按钮)
  if (elements.btnFilterNotes) {
    elements.btnFilterNotes.addEventListener('click', toggleNotesFilter);
  }

  // 默写页面笔记交互
  if (elements.btnSaveDictateNote) {
    elements.btnSaveDictateNote.addEventListener('click', handleSaveDictateNote);
  }
  if (elements.dictateNoteInput) {
    elements.dictateNoteInput.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSaveDictateNote();
      }
    });
    elements.dictateNoteInput.addEventListener('blur', () => {
      const card = getCurrentDictateCard();
      if (!card) return;
      const noteVal = (elements.dictateNoteInput.value || '').trim();
      if (noteVal !== (card.note || '').trim()) {
        saveCardNote(card.id, elements.dictateNoteInput.value);
        if (elements.dictateNoteTip) {
          elements.dictateNoteTip.classList.remove('hidden');
          elements.dictateNoteTip.textContent = '✓ 笔记已保存';
          setTimeout(() => {
            elements.dictateNoteTip.classList.add('hidden');
          }, 2000);
        }
      }
    });
  }

  // Action Delegation in Table (跳转默写或编辑笔记)
  elements.cardsTbody.addEventListener('click', (e) => {
    const practiceBtn = e.target.closest('button[data-action="practice"]');
    if (practiceBtn) {
      const id = practiceBtn.dataset.id;
      const idx = state.cards.findIndex(c => c.id === id);
      if (idx !== -1) {
        state.currentIndex = idx;
        document.getElementById('tab-dictate').click();
        renderDictateCard();
      }
      return;
    }

    const noteBtn = e.target.closest('[data-action="add-note"], [data-action="edit-note"], .note-display');
    if (noteBtn) {
      const id = noteBtn.dataset.id;
      if (id) openNoteModal(id);
      return;
    }
  });

  // Note Modal Event Listeners
  if (elements.btnCloseNoteModal) {
    elements.btnCloseNoteModal.addEventListener('click', closeNoteModal);
  }
  if (elements.btnCancelNoteModal) {
    elements.btnCancelNoteModal.addEventListener('click', closeNoteModal);
  }
  if (elements.btnConfirmNoteModal) {
    elements.btnConfirmNoteModal.addEventListener('click', handleConfirmNoteModal);
  }
  if (elements.noteModalTextarea) {
    elements.noteModalTextarea.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleConfirmNoteModal();
      }
    });
  }

  // Export Buttons
  elements.btnExportAnki.addEventListener('click', () => {
    window.location.href = '/api/export?format=anki';
  });

  elements.btnExportJson.addEventListener('click', () => {
    window.location.href = '/api/export?format=json';
  });
}

// Kickoff
document.addEventListener('DOMContentLoaded', initApp);
