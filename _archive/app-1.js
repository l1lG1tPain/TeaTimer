/* ============================================
   TeaTimer — Application Logic (Fixed)
   ============================================ */

// ============================================
// Constants & Config
// ============================================
const DB_NAME = 'TeaTimerDB';
const DB_VERSION = 1;
// Fallback only — overwritten by teas.json's own strength_multiplier once it
// loads, so the data file stays the single source of truth.
let STRENGTH_MULTIPLIER = { light: 0.8, medium: 1.0, strong: 1.2 };

let TEAS_DATA = null;
let CATEGORIES = [];
let TEAS = [];

// ============================================
// Loader Messages
// ============================================
const LOADER_MESSAGES = [
  'Завариваем чай...',
  'Греем чаши...',
  'Промываем чайник...',
  'Подготавливаем воду...',
  'Выбираем сорт чая...',
  'Настраиваем таймер...',
  'Вдыхаем аромат...',
  'Заряжаемся энергией...',
  'Медитируем над чаем...',
  'Готовимся к церемонии...'
];

function hideLoader() {
  const loader = document.getElementById('app-loader');
  if (loader) {
    setTimeout(() => {
      loader.classList.add('hidden');
    }, 300);
  }
}

function setRandomLoaderMessage() {
  const subtitle = document.getElementById('loader-subtitle');
  if (subtitle) {
    const randomMessage = LOADER_MESSAGES[Math.floor(Math.random() * LOADER_MESSAGES.length)];
    subtitle.textContent = randomMessage;
  }
}

// ============================================
// Web Audio API Manager for reliable sound playback
// ============================================
class AudioManager {
  constructor() {
    this.audioContext = null;
    this.buffers = {};
    this.isInitialized = false;
  }

  async init() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.audioContext = new AudioContext();

      // Предзагружаем все звуки
      await Promise.all([
        this.loadSound('gong', 'assets/sounds/Гонг.wav'),
        this.loadSound('bell', 'assets/sounds/Колокольчик.wav'),
        this.loadSound('soft', 'assets/sounds/Мягкий звон.wav')
      ]);

      this.isInitialized = true;
      console.log('AudioManager initialized');
    } catch (e) {
      console.warn('AudioManager init failed:', e);
    }
  }

  async loadSound(name, url) {
    try {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      this.buffers[name] = await this.audioContext.decodeAudioData(arrayBuffer);
      console.log(`Sound loaded: ${name}`);
    } catch (e) {
      console.warn(`Failed to load ${name}:`, e);
    }
  }

  play(soundName) {
    if (!this.isInitialized || !this.buffers[soundName]) {
      console.warn(`Sound not ready: ${soundName}`);
      return;
    }

    try {
      const source = this.audioContext.createBufferSource();
      source.buffer = this.buffers[soundName];

      const gainNode = this.audioContext.createGain();
      source.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      gainNode.gain.value = 1.0;

      source.start(0);
    } catch (e) {
      console.warn(`Failed to play ${soundName}:`, e);
    }
  }
}

const audioManager = new AudioManager();

// ============================================
// IndexedDB Wrapper
// ============================================
class TeaDB {
  constructor() {
    this.db = null;
  }

  async init() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => { this.db = req.result; resolve(); };
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('sessions')) {
          db.createObjectStore('sessions', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains('favorites')) {
          db.createObjectStore('favorites', { keyPath: 'teaId' });
        }
        if (!db.objectStoreNames.contains('customTeas')) {
          db.createObjectStore('customTeas', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('presets')) {
          db.createObjectStore('presets', { keyPath: 'id' });
        }
      };
    });
  }

  async getSettings() {
    const defaults = {
      theme: 'system',
      sound_enabled: true,
      vibration_enabled: true,
      keep_screen_on: false,
      default_vessel_ml: 120,
      default_strength: 'medium',
      language: 'ru'
    };
    try {
      const tx = this.db.transaction('settings', 'readonly');
      const store = tx.objectStore('settings');
      const result = await Promise.all([
        this._get(store, 'theme'),
        this._get(store, 'sound_enabled'),
        this._get(store, 'vibration_enabled'),
        this._get(store, 'keep_screen_on'),
        this._get(store, 'default_vessel_ml'),
        this._get(store, 'default_strength'),
        this._get(store, 'language')
      ]);
      const keys = Object.keys(defaults);
      result.forEach((val, i) => { if (val !== undefined) defaults[keys[i]] = val; });
    } catch (e) { console.warn('Settings read error', e); }
    return defaults;
  }

  async setSetting(key, value) {
    const tx = this.db.transaction('settings', 'readwrite');
    const store = tx.objectStore('settings');
    store.put({ key, value });
    return new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = rej; });
  }

  async getSessions() {
    const tx = this.db.transaction('sessions', 'readonly');
    const store = tx.objectStore('sessions');
    return new Promise((res, rej) => {
      const req = store.getAll();
      req.onsuccess = () => res(req.result || []);
      req.onerror = rej;
    });
  }

  async saveSession(session) {
    const tx = this.db.transaction('sessions', 'readwrite');
    const store = tx.objectStore('sessions');
    store.put(session);
    return new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = rej; });
  }

  async deleteSession(id) {
    const tx = this.db.transaction('sessions', 'readwrite');
    const store = tx.objectStore('sessions');
    store.delete(id);
    return new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = rej; });
  }

  async getFavorites() {
    const tx = this.db.transaction('favorites', 'readonly');
    const store = tx.objectStore('favorites');
    return new Promise((res, rej) => {
      const req = store.getAll();
      req.onsuccess = () => res((req.result || []).map(r => r.teaId));
      req.onerror = rej;
    });
  }

  async toggleFavorite(teaId) {
    const tx = this.db.transaction('favorites', 'readwrite');
    const store = tx.objectStore('favorites');
    const existing = await new Promise((res, rej) => {
      const r = store.get(teaId);
      r.onsuccess = () => res(r.result);
      r.onerror = rej;
    });
    if (existing) store.delete(teaId);
    else store.put({ teaId });
    return new Promise((res, rej) => { tx.oncomplete = () => res(!existing); tx.onerror = rej; });
  }

  async getCustomTeas() {
    const tx = this.db.transaction('customTeas', 'readonly');
    const store = tx.objectStore('customTeas');
    return new Promise((res, rej) => {
      const req = store.getAll();
      req.onsuccess = () => res(req.result || []);
      req.onerror = rej;
    });
  }

  async saveCustomTea(tea) {
    const tx = this.db.transaction('customTeas', 'readwrite');
    const store = tx.objectStore('customTeas');
    store.put(tea);
    return new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = rej; });
  }

  async deleteCustomTea(teaId) {
    const tx = this.db.transaction('customTeas', 'readwrite');
    const store = tx.objectStore('customTeas');
    store.delete(teaId);
    return new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = rej; });
  }

  async getPresets() {
    const tx = this.db.transaction('presets', 'readonly');
    const store = tx.objectStore('presets');
    return new Promise((res, rej) => {
      const req = store.getAll();
      req.onsuccess = () => res(req.result || []);
      req.onerror = rej;
    });
  }

  async savePreset(preset) {
    const tx = this.db.transaction('presets', 'readwrite');
    const store = tx.objectStore('presets');
    store.put(preset);
    return new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = rej; });
  }

  _get(store, key) {
    return new Promise((res, rej) => {
      const r = store.get(key);
      r.onsuccess = () => res(r.result?.value);
      r.onerror = rej;
    });
  }
}

const db = new TeaDB();

// ============================================
// Utilities
// ============================================
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

function formatTime(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return m + ':' + String(s).padStart(2, '0');
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  const options = { weekday: 'long', day: 'numeric', month: 'long' };
  return d.toLocaleDateString('ru-RU', options);
}

function formatShortDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
}

function formatDuration(minutes) {
  if (minutes < 60) return minutes + ' мин';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h + ' ч ' + (m > 0 ? m + ' мин' : '');
}

function generateScenario(tea, strength, numInfusions) {
  const mult = STRENGTH_MULTIPLIER[strength] || 1.0;
  const base = Math.round(tea.first_steep_seconds * mult);
  const times = [];
  const max = Math.min(numInfusions, tea.max_infusions);
  for (let i = 0; i < max; i++) {
    times.push(base + tea.steep_increment_seconds * i);
  }
  return times;
}

function shiftScenario(times, delta) {
  return times.map(t => Math.max(5, t + delta));
}

function calcGrams(tea, vesselMl) {
  return Math.round(tea.gaiwan_ratio_g_per_100ml * vesselMl / 100 * 10) / 10;
}

function getCategory(id) {
  return CATEGORIES.find(c => c.id === id) || CATEGORIES[0];
}

function getTea(id) {
  return TEAS.find(t => t.id === id);
}

function escapeHtml(str) {
  if (str == null) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ============================================
// App State
// ============================================
const state = {
  currentScreen: 'home',
  navStack: [],
  settings: null,
  currentTea: null,
  currentScenario: null,
  currentSession: null,
  timerInterval: null,
  timerRemaining: 0,
  timerTotal: 0,
  timerRunning: false,
  timerTargetEnd: null, // timestamp when timer should finish
  wakeLock: null,
  searchQuery: '',
  activeCategory: 'all',
  customScenarioTimes: [],
  customScenarioName: '',
  favorites: [],
  sessions: [],
  historyFilter: 'all',
  reminderTimeout: null  // for 2-minute reminder after pour
};

// ============================================
// Theme Management
// ============================================
function applyTheme() {
  const theme = state.settings?.theme || 'system';
  const root = document.documentElement;
  if (theme === 'light') root.setAttribute('data-theme', 'light');
  else if (theme === 'dark') root.setAttribute('data-theme', 'dark');
  else root.removeAttribute('data-theme');
}

// ============================================
// Navigation
// ============================================
// Root screens fully reset the stack (they're reached via bottom-nav tabs,
// not drill-down). Everything else pushes on top, and both the in-app "←"
// buttons and the hardware/gesture back button pop it one level at a time
// via the real browser History API — a single "prevScreen" slot can't do
// that correctly past two levels deep (e.g. tea → session → custom would
// bounce back and forth between the last two screens instead of unwinding).
const ROOT_SCREENS = ['home', 'catalog', 'history', 'settings'];

function navigate(screen, params = {}) {
  _leaveScreen(screen);

  if (ROOT_SCREENS.includes(screen)) {
    state.navStack = [{ screen, params }];
  } else {
    const top = state.navStack[state.navStack.length - 1];
    if (top && top.screen === screen) {
      state.navStack[state.navStack.length - 1] = { screen, params };
    } else {
      state.navStack.push({ screen, params });
    }
  }

  history.pushState({ depth: state.navStack.length }, '', location.pathname + location.search);
  _renderTop();
}

function _leaveScreen(nextScreen) {
  // Pause timer when leaving timer screen (keeps timerTargetEnd for resume)
  if (state.currentScreen === 'timer' && nextScreen !== 'timer') {
    if (state.timerInterval) {
      clearInterval(state.timerInterval);
      state.timerInterval = null;
    }
    state.timerRunning = false;
    clearReminder(); // Очищаем напоминание
    releaseWakeLock();
  }
}

function _renderTop() {
  const top = state.navStack[state.navStack.length - 1] || { screen: 'home', params: {} };
  const screen = top.screen;
  const params = top.params || {};
  state.currentScreen = screen;

  // Hide all screens
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.timer-screen').forEach(s => s.classList.remove('active'));

  // Show target screen
  const target = document.getElementById('screen-' + screen);
  if (target) target.classList.add('active');

  // Update nav
  updateBottomNav(screen);

  // Render screen content
  if (screen === 'home') renderHome();
  else if (screen === 'catalog') renderCatalog();
  else if (screen === 'tea-detail') renderTeaDetail(params.teaId);
  else if (screen === 'session-setup') renderSessionSetup(params.teaId);
  else if (screen === 'custom-scenario') renderCustomScenario();
  else if (screen === 'timer') renderTimer();
  else if (screen === 'history') renderHistory();
  else if (screen === 'settings') renderSettings();
  else if (screen === 'add-tea') renderAddTeaForm(params.teaId);
  else if (screen === 'edit-tea') renderAddTeaForm(params.teaId);

  window.scrollTo(0, 0);
}

function updateBottomNav(screen) {
  const navMap = { home: 0, catalog: 1, history: 2, settings: 3 };
  const idx = navMap[screen];
  document.querySelectorAll('.nav-item').forEach((item, i) => {
    item.classList.toggle('active', i === idx);
  });
  const nav = document.querySelector('.bottom-nav');
  if (nav) nav.style.display = (screen === 'timer' || screen === 'session-setup' || screen === 'custom-scenario' || screen === 'tea-detail' || screen === 'add-tea' || screen === 'edit-tea') ? 'none' : 'flex';
}

// UI "←" buttons: consume one real history entry so they stay in lockstep
// with the hardware/gesture back button below.
function goBack() {
  if (state.navStack.length > 1) {
    history.back();
  } else {
    navigate('home');
  }
}

// Hardware/gesture back button (Android, browser back): pop our stack in
// lockstep with the browser's own session history instead of re-deriving
// "where we came from" ourselves.
window.addEventListener('popstate', () => {
  const willPop = state.navStack.length > 1;
  const nextScreen = willPop
    ? state.navStack[state.navStack.length - 2].screen
    : (state.navStack[0] ? state.navStack[0].screen : 'home');
  // Same cleanup as navigate(): a hardware/gesture back press while the
  // brew timer is running is the one way to leave the timer screen without
  // going through pourTea()/skipInfusion()/finishSession(), so it needs the
  // same "stop the interval, release the wake lock" treatment or the timer
  // keeps ticking invisibly against a screen nobody can see anymore.
  _leaveScreen(nextScreen);
  if (willPop) state.navStack.pop();
  _renderTop();
});

// ============================================
// Screen: Home
// ============================================

// ============================================
// ============================================
// Category Modal
// ============================================
// ============================================
// Category Modal
// ============================================
function openCategoryModal(inputId) {
  const modal = document.getElementById('category-modal');
  if (!modal) {
    const newModal = document.createElement('div');
    newModal.id = 'category-modal';
    newModal.className = 'modal';
    document.getElementById('app').appendChild(newModal);
    openCategoryModal(inputId);
    return;
  }

  const html = `
    <div class="modal-content">
      <div class="modal-header">
        <h2 class="font-display">Выберите категорию чая</h2>
        <button onclick="closeCategoryModal()" class="modal-close">✕</button>
      </div>
      <div class="modal-body">
        <div class="categories-grid">
          ${CATEGORIES.map(cat => `
            <button type="button" class="category-card" onclick="selectCategory('${cat.id}', '${inputId}', '${escapeHtml(cat.name_ru)}')">
              <div class="category-color" style="background-color: ${cat.accent};display:flex;align-items:center;justify-content:center;font-size:2rem;font-weight:bold;color:var(--text-primary);text-shadow:0 1px 2px rgba(0,0,0,0.2);">${cat.name_cn ? cat.name_cn.slice(0,2) : cat.name_ru.slice(0,1)}</div>
              <div class="category-text">
                <div class="category-name">${cat.name_ru}</div>
                <div class="category-cn">${cat.name_cn || ''}</div>
              </div>
            </button>
          `).join('')}
        </div>
      </div>
    </div>
  `;

  modal.innerHTML = html;
  modal.classList.add('active');
}

function closeCategoryModal() {
  const modal = document.getElementById('category-modal');
  if (modal) modal.classList.remove('active');
}

function selectCategory(categoryId, inputId, categoryName) {
  document.getElementById(inputId).value = categoryId;
  document.getElementById('category-name').textContent = categoryName;
  closeCategoryModal();
}

// Delegated modal click handler - single listener only
document.addEventListener('click', (e) => {
  const modal = document.getElementById('category-modal');
  if (modal && modal.classList.contains('active') && e.target === modal) {
    closeCategoryModal();
  }
});

// ============================================
// TOAST NOTIFICATIONS
// ============================================
function showToast(message, duration = 2000) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);

  const timeoutId = setTimeout(() => {
    if (toast.parentNode) toast.remove();
  }, duration);

  // Store timeout ID for cleanup if needed
  toast.dataset.timeoutId = timeoutId;
}

// ============================================
// Screen: Add/Edit Tea
// ============================================
function renderAddTeaForm(teaIdToEdit = null) {
  const isEditing = teaIdToEdit !== null;
  const screenId = isEditing ? 'screen-edit-tea' : 'screen-add-tea';
  const screen = document.getElementById(screenId);
  if (!screen) {
    const main = document.getElementById('app');
    const newScreen = document.createElement('div');
    newScreen.id = screenId;
    newScreen.className = 'screen';
    main.appendChild(newScreen);
    renderAddTeaForm(teaIdToEdit);
    return;
  }

  const title = isEditing ? 'Редактировать чай' : 'Добавить свой чай';
  
  let initialData = {
    name_ru: '',
    name_en: '',
    name_cn: '',
    category: '',
    temperature_min: 70,
    temperature_max: 90,
    gaiwan_ratio_g_per_100ml: 4,
    rinse_recommended: false,
    first_steep_seconds: 25,
    steep_increment_seconds: 10,
    max_infusions: 7,
    description_ru: '',
    tags: []
  };
  
  if (isEditing) {
    const tea = getTea(teaIdToEdit);
    if (!tea) {
      navigate('catalog');
      return;
    }
    initialData = { ...tea };
  }
  
  const categoryOptions = CATEGORIES
    .map(c => `<option value="${c.id}" ${initialData.category === c.id ? 'selected' : ''}>
               ${c.name_ru} (${c.name_cn})</option>`)
    .join('');
  
  const tagsStr = initialData.tags ? initialData.tags.join(', ') : '';
  
  screen.innerHTML = `
    <div class="screen-content">
      <div style="position:sticky;top:0;z-index:10;padding:12px 0;margin-bottom:20px;background:var(--bg-primary);margin:0 -20px 0;padding:12px 20px;display:flex;align-items:center;gap:12px;border-bottom:1px solid var(--border-medium);">
        <button onclick="goBack()" class="btn-icon" style="width:40px;height:40px;border-radius:12px;font-size:20px;">←</button>
        <h1 class="font-display" style="font-weight:500;font-size:32px;line-height:1.05;color:var(--text-primary);flex:1;margin:0;">${title}</h1>
      </div>
      
      <form id="add-tea-form" class="form-container">
        <!-- Основная информация -->
        <div class="form-group">
          <label>Название (русский) *</label>
          <input type="text" name="name_ru" value="${escapeHtml(initialData.name_ru)}" required placeholder="Например: Колодец Дракона">
        </div>
        
        <div class="form-group">
          <label>Название (английский) *</label>
          <input type="text" name="name_en" value="${escapeHtml(initialData.name_en)}" required placeholder="Например: Dragon Well">
        </div>
        
        <div class="form-group">
          <label>Название (китайский)</label>
          <input type="text" name="name_cn" value="${escapeHtml(initialData.name_cn || '')}" placeholder="Например: 龙井茶">
        </div>
        
        <!-- Категория -->
        <div class="form-group">
          <label>Категория *</label>
          <input type="hidden" name="category" id="category-hidden" value="${initialData.category}" required>
          <button type="button" onclick="openCategoryModal('category-hidden')" class="btn-category-selector" id="category-selector">
            <span id="category-name">${initialData.category ? CATEGORIES.find(c => c.id === initialData.category)?.name_ru || 'Выберите категорию' : 'Выберите категорию'}</span>
            <span style="margin-left: auto;">→</span>
          </button>
        </div>
        
        <!-- Температура -->
        <div class="form-group">
          <label>Температура воды: <span id="temp-display">${initialData.temperature_min}-${initialData.temperature_max}°C</span></label>
          <input type="range" name="temperature_min" min="50" max="100" value="${initialData.temperature_min}" oninput="updateTempDisplay()">
          <input type="range" name="temperature_max" min="50" max="100" value="${initialData.temperature_max}" oninput="updateTempDisplay()">
        </div>
        
        <!-- Граммовка -->
        <div class="form-group">
          <label>Граммовка на 100ml посуды *</label>
          <input type="number" name="gaiwan_ratio_g_per_100ml" min="0.5" max="10" step="0.5" value="${initialData.gaiwan_ratio_g_per_100ml}" required>
        </div>
        
        <!-- Промывка -->
        <div class="form-group">
          <label style="display:flex;align-items:center;gap:0.5rem;cursor:pointer;">
            <input type="checkbox" name="rinse_recommended" ${initialData.rinse_recommended ? 'checked' : ''} style="width:1.25rem;height:1.25rem;">
            Рекомендуется промывка листьев
          </label>
        </div>
        
        <!-- Времена проливов -->
        <div class="form-group">
          <label>Время первого пролива (сек) *</label>
          <input type="number" name="first_steep_seconds" min="5" max="180" value="${initialData.first_steep_seconds}" required>
        </div>
        
        <div class="form-group">
          <label>Прирост между проливами (сек) *</label>
          <input type="number" name="steep_increment_seconds" min="0" max="60" value="${initialData.steep_increment_seconds}" required>
        </div>
        
        <div class="form-group">
          <label>Макс. количество проливов *</label>
          <input type="number" name="max_infusions" min="1" max="20" value="${initialData.max_infusions}" required>
        </div>
        
        <!-- Описание -->
        <div class="form-group">
          <label>Описание</label>
          <textarea name="description_ru" rows="4" style="padding:0.75rem;border:1px solid var(--border-secondary);border-radius:0.5rem;background:var(--bg-secondary);color:var(--text-primary);font-family:var(--font-sans);resize:vertical;">${escapeHtml(initialData.description_ru || '')}</textarea>
        </div>
        
        <!-- Теги -->
        <div class="form-group">
          <label>Теги (через запятую)</label>
          <input type="text" name="tags" value="${tagsStr}" placeholder="Например: сладкий, ароматный, лёгкий">
        </div>
        
        <!-- Кнопки -->
        <div style="display:flex;flex-direction:column;gap:0.75rem;margin-top:1.5rem;">
          <button type="submit" class="btn-primary" style="width:100%;height:58px;border-radius:18px;display:flex;align-items:center;justify-content:center;gap:8px;">
            ${isEditing ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>` : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`}
            <span>${isEditing ? 'Обновить' : 'Добавить'} чай</span>
          </button>
          <button type="button" onclick="goBack()" class="btn-secondary" style="width:100%;height:58px;border-radius:18px;">
            Отмена
          </button>
          ${isEditing ? `
            <button type="button" onclick="confirmDeleteCustomTea('${teaIdToEdit}')" class="btn-danger" style="width:100%;height:58px;border-radius:18px;">
              🗑️ Удалить
            </button>
          ` : ''}
        </div>
      </form>
    </div>
  `;
  
  document.getElementById('add-tea-form').addEventListener('submit', 
    (e) => handleAddTeaSubmit(e, isEditing, teaIdToEdit));
  
  updateBottomNav('add-tea');
}

function updateTempDisplay() {
  const minInput = document.querySelector('[name=temperature_min]');
  const maxInput = document.querySelector('[name=temperature_max]');
  if (minInput && maxInput) {
    document.getElementById('temp-display').textContent = minInput.value + '-' + maxInput.value + '°C';
  }
}

async function handleAddTeaSubmit(event, isEditing = false, teaId = null) {
  event.preventDefault();
  
  const form = event.target;
  const formData = new FormData(form);
  
  const newTea = {
    id: teaId || ('custom_' + generateId()),
    name_ru: formData.get('name_ru'),
    name_en: formData.get('name_en'),
    name_cn: formData.get('name_cn') || null,
    category: formData.get('category'),
    temperature_min: parseInt(formData.get('temperature_min')),
    temperature_max: parseInt(formData.get('temperature_max')),
    gaiwan_ratio_g_per_100ml: parseFloat(formData.get('gaiwan_ratio_g_per_100ml')),
    rinse_recommended: formData.get('rinse_recommended') === 'on',
    first_steep_seconds: parseInt(formData.get('first_steep_seconds')),
    steep_increment_seconds: parseInt(formData.get('steep_increment_seconds')),
    max_infusions: parseInt(formData.get('max_infusions')),
    description_ru: formData.get('description_ru'),
    tags: formData.get('tags')
      .split(',')
      .map(t => t.trim())
      .filter(t => t.length > 0),
    is_custom: true,
    created_at: isEditing ? TEAS.find(t => t.id === teaId)?.created_at : new Date().toISOString(),
    modified_at: new Date().toISOString()
  };
  
  // Валидация
  if (newTea.temperature_min >= newTea.temperature_max) {
    alert('Минимальная температура должна быть меньше максимальной');
    return;
  }
  
  try {
    // Сохранить в БД
    await db.saveCustomTea(newTea);
    
    // Обновить локальный массив
    const existingIndex = TEAS.findIndex(t => t.id === teaId);
    if (existingIndex >= 0) {
      TEAS[existingIndex] = newTea;
    } else {
      TEAS.push(newTea);
    }
    
    // Показать уведомление
    showToast(isEditing ? '✅ Чай обновлен!' : '✅ Чай добавлен!');
    
    // Перейти на чай
    setTimeout(() => navigate('tea-detail', { teaId: newTea.id }), 500);
  } catch (e) {
    console.error('Ошибка сохранения:', e);
    alert('Ошибка при сохранении чая');
  }
}

async function confirmDeleteCustomTea(teaId) {
  const tea = getTea(teaId);
  if (!tea || !tea.is_custom) {
    alert('Можно удалить только пользовательские чаи');
    return;
  }
  
  if (confirm(`Удалить "${tea.name_ru}" из коллекции?`)) {
    try {
      await db.deleteCustomTea(teaId);
      TEAS = TEAS.filter(t => t.id !== teaId);
      showToast('✅ Чай удалён');
      navigate('catalog');
    } catch (e) {
      console.error('Ошибка удаления:', e);
      alert('Ошибка при удалении чая');
    }
  }
}

// ============================================
// Screen: Home
// ============================================
function renderHome() {
  const container = document.getElementById('screen-home');
  if (!container) return;

  const now = new Date();
  const dateStr = now.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });

  // FIX: copy array before sorting to avoid mutating state
  const sortedSessions = state.sessions && state.sessions.length > 0
    ? [...state.sessions].sort((a, b) => new Date(b.start_time) - new Date(a.start_time))
    : [];

  const lastSession = sortedSessions.length > 0 ? sortedSessions[0] : null;
  const lastTea = lastSession ? getTea(lastSession.tea_id) : null;
  const quickBrewSubtitle = lastTea
    ? `последний: ${lastTea.name_ru}, ${lastSession.strength === 'light' ? 'лёгкая' : lastSession.strength === 'strong' ? 'крепкая' : 'средняя'}, ${lastSession.infusion_log?.length || 0} пр.`
    : 'выберите чай из каталога';

  // Get teas for "At Hand" — favorites + recently used
  const favIds = new Set(state.favorites || []);
  const recentIds = sortedSessions.slice(0, 10).map(s => s.tea_id);

  let handIds = [...favIds];
  for (const id of recentIds) {
    if (!handIds.includes(id)) handIds.push(id);
  }
  handIds = handIds.slice(0, 4);

  const handTeas = handIds.map(id => getTea(id)).filter(Boolean);
  for (let i = 0; handTeas.length < 4 && i < TEAS.length; i++) {
    const t = TEAS[i];
    if (t && !handTeas.includes(t)) handTeas.push(t);
  }

  // Weekly stats
  const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
  const weekSessions = state.sessions ? state.sessions.filter(s => new Date(s.start_time) > weekAgo) : [];
  const weekCount = weekSessions.length;
  const weekMinutes = weekSessions.reduce((sum, s) => {
    const start = new Date(s.start_time);
    const end = s.end_time ? new Date(s.end_time) : new Date(start.getTime() + 30*60000);
    return sum + Math.round((end - start) / 60000);
  }, 0);

  const teaCounts = {};
  weekSessions.forEach(s => { teaCounts[s.tea_name_snapshot] = (teaCounts[s.tea_name_snapshot] || 0) + 1; });
  const topTea = Object.entries(teaCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';

  container.innerHTML = `
    <div class="screen-content">
      <div style="margin-bottom: 20px;">
        <span class="overline">${dateStr}</span>
        <h1 class="font-display" style="font-weight:500;font-size:36px;line-height:1.05;letter-spacing:-0.02em;color:var(--text-primary);">Что заварим?</h1>
      </div>

      <button class="hero-btn" onclick="handleQuickBrew()">
        <span class="title">Заварить</span>
        <span class="subtitle">${escapeHtml(quickBrewSubtitle)}</span>
      </button>

      <div style="margin-top: 20px; display:flex;flex-direction:column;gap:12px;">
        <span class="overline">Под рукой</span>
        <div style="display:flex;flex-direction:column;gap:8px;">
          ${handTeas.map(tea => {
            const cat = getCategory(tea.category);
            const infusions = tea.max_infusions;
            return `
            <div class="tea-card-mini" onclick="navigate('tea-detail', {teaId:'${tea.id}'})">
              <span class="color-dot" style="background:${cat.accent};"></span>
              <div class="info">
                <span class="name">${escapeHtml(tea.name_ru)}</span>
                <span class="meta">${escapeHtml(tea.name_cn)} · ${cat.name_ru} · ${tea.temperature_min}–${tea.temperature_max}°C</span>
              </div>
              <span class="count">${infusions} пр.</span>
            </div>
            `;
          }).join('')}
        </div>
      </div>

      ${weekCount > 0 ? `
      <div class="stats-banner mt-20" onclick="navigate('history')">
        <div class="text">
          <span class="title">За неделю — ${weekCount} чаепитий</span>
          <span class="subtitle">${formatDuration(weekMinutes)} · чаще всего ${escapeHtml(topTea)}</span>
        </div>
        <span class="arrow">→</span>
      </div>
      ` : ''}
    </div>
  `;
}

function handleQuickBrew() {
  const sortedSessions = state.sessions ? [...state.sessions].sort((a, b) => new Date(b.start_time) - new Date(a.start_time)) : [];
  const lastSession = sortedSessions.length > 0 ? sortedSessions[0] : null;
  if (lastSession) {
    navigate('session-setup', { teaId: lastSession.tea_id });
  } else {
    navigate('catalog');
  }
}

// ============================================
// Screen: Catalog
// ============================================
function renderCatalog() {
  const container = document.getElementById('screen-catalog');
  if (!container) return;

  const q = state.searchQuery.toLowerCase().trim();
  const catFilter = state.activeCategory;

  // Only initialize on first render
  if (!container.classList.contains('catalog-initialized')) {
    container.classList.add('catalog-initialized');
    container.innerHTML = `
      <div class="screen-content">
        <div style="margin-bottom: 16px; display: flex; align-items: center; justify-content: space-between;">
          <h1 class="font-display" style="font-weight:500;font-size:32px;line-height:1.05;color:var(--text-primary);">Каталог</h1>
          <button onclick="showAddTeaForm()" class="btn-icon" style="width:40px;height:40px;border-radius:12px;background:var(--accent-green);color:var(--btn-text-color);display:flex;align-items:center;justify-content:center;border:none;cursor:pointer;"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round">
  <path d="M12 5v14M5 12h14"/>
</svg></button>
        </div>

        <div class="search-box mb-16" style="position:relative;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          <input type="text" id="search-input" placeholder="Поиск: рус, англ, 汉字" value="${escapeHtml(state.searchQuery)}" oninput="state.searchQuery=this.value; updateCatalogList();">
          ${state.searchQuery ? `<button type="button" onclick="state.searchQuery=''; document.getElementById('search-input').value=''; updateCatalogList();" style="position:absolute;right:12px;top:50%;transform:translateY(-50%);background:none;border:none;font-size:18px;cursor:pointer;color:var(--text-secondary);padding:4px 8px;display:flex;align-items:center;justify-content:center;">✕</button>` : ''}
        </div>

        <div id="catalog-filters" style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:18px;"></div>

        <div id="catalog-list" style="display:flex;flex-direction:column;gap:2px;"></div>

        <button class="btn-secondary btn-dashed mt-20" style="width:100%;height:58px;border-radius:18px;display:flex;align-items:center;justify-content:center;gap:8px;" onclick="showAddTeaForm()">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          <span>Добавить свой чай</span>
        </button>
      </div>
    `;
  }

  // Update search input value
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.value = state.searchQuery;
  }

  updateCatalogList();
}

// Check if tea is in favorites
function isFavoriteTea(teaId) {
  return state.favorites && state.favorites.includes(teaId);
}

function updateCatalogList() {
  const q = state.searchQuery.toLowerCase().trim();
  const catFilter = state.activeCategory;

  // Update filter chips
  const filtersContainer = document.getElementById('catalog-filters');
  if (filtersContainer) {
    filtersContainer.innerHTML = `
      <span class="chip ${catFilter === 'all' ? 'chip-active' : 'chip-inactive'}" onclick="state.activeCategory='all'; updateCatalogList();">Все ${TEAS.length}</span>
      ${CATEGORIES.map(c => `
        <span class="chip ${catFilter === c.id ? 'chip-active' : 'chip-inactive'}" onclick="state.activeCategory='${c.id}'; updateCatalogList();">${escapeHtml(c.name_ru)}</span>
      `).join('')}
    `;
  }

  let filtered = TEAS;
  if (catFilter !== 'all') {
    filtered = filtered.filter(t => t.category === catFilter);
  }
  if (q) {
    filtered = filtered.filter(t =>
      (t.name_ru && t.name_ru.toLowerCase().includes(q)) ||
      (t.name_en && t.name_en.toLowerCase().includes(q)) ||
      (t.name_cn && t.name_cn.includes(q)) ||
      (t.tags && t.tags.some(tag => tag.toLowerCase().includes(q)))
    );
  }
  
  // Sort: favorites first
  filtered.sort((a, b) => {
    const aFav = isFavoriteTea(a.id);
    const bFav = isFavoriteTea(b.id);
    return bFav - aFav; // bFav ? 1 : 0 - aFav ? 1 : 0
  });

  // Update tea list
  const listContainer = document.getElementById('catalog-list');
  if (listContainer) {
    listContainer.innerHTML = filtered.map(tea => {
      const cat = getCategory(tea.category);
      const customBadge = tea.is_custom ? ' 👤' : '';
      return `
      <div class="list-row" onclick="navigate('tea-detail', {teaId:'${tea.id}'})">
        <span class="accent-bar" style="background:${cat.accent};"></span>
        <div class="row-content">
          <span class="row-title">${isFavoriteTea(tea.id) ? '⭐ ' : ''}${customBadge} ${escapeHtml(tea.name_ru)}</span>
          <span class="row-meta">${escapeHtml(tea.name_cn)} · ${cat.name_ru} · ${tea.temperature_min}–${tea.temperature_max}°C</span>
        </div>
        <span class="row-badge">${tea.max_infusions} пр.</span>
      </div>
      `;
    }).join('') || '<div style="padding:60px 20px;text-align:center;"><div style="font-size:4rem;margin-bottom:12px;">🍵</div><div style="font-size:16px;color:var(--text-secondary);font-weight:500;">Чай не найден...</div><div style="font-size:13px;color:var(--text-muted);margin-top:8px;">Попробуй другой запрос или добавь свой чай</div></div>';
  }
}

function showAddTeaForm() {
  navigate('add-tea');
}

// ============================================
// Screen: Tea Detail
// ============================================
// Get tea hero background based on category or tea type
function getTeaHeroStyle(tea) {
  const cat = getCategory(tea.category);
  const accentColor = cat.accent;
  // Gradient from category color to darker shade
  return `background: linear-gradient(135deg, ${accentColor}33 0%, ${accentColor}11 100%), var(--bg-secondary); position: relative;`;
}

function renderTeaDetail(teaId) {
  const container = document.getElementById('screen-tea-detail');
  if (!container) return;

  const tea = getTea(teaId);
  if (!tea) { navigate('catalog'); return; }

  const cat = getCategory(tea.category);
  const isFav = state.favorites.includes(teaId);
  const tempStr = tea.temperature_min === tea.temperature_max
    ? tea.temperature_min + '°C'
    : tea.temperature_min + '–' + tea.temperature_max + '°C';

  // NEW: render effects if present
  let effectsHtml = '';
  if (tea.effects && Object.keys(tea.effects).length > 0) {
    effectsHtml = `
      <div style="margin-top:16px;">
        <span class="overline" style="margin-bottom:8px;">Эффекты</span>
        <div style="display:flex;flex-wrap:wrap;gap:8px;">
          ${Object.keys(tea.effects).map(k => {
            const val = tea.effects[k];
            return `<span class="tag" style="background:${cat.accent}22;color:${cat.accent};border:1px solid ${cat.accent}44;">${escapeHtml(val || k)}</span>`;
          }).join('')}
        </div>
      </div>
    `;
  }

  container.innerHTML = `
    <div class="screen-content" style="padding-top:0;">
      <div style="position:sticky;top:0;z-index:10;padding:12px 0;background:var(--bg-primary);margin:0 -20px 0;padding:12px 20px;">
        <button class="btn-icon" style="width:40px;height:40px;border-radius:12px;font-size:20px;" onclick="goBack()">←</button>
      </div>

      <div class="tea-hero" style="${getTeaHeroStyle(tea)}">
        <div class="pattern" style="display:flex;align-items:center;justify-content:center;font-size:5rem;opacity:0.6;">${tea.name_cn ? tea.name_cn.slice(0,1) : '🍵'}</div>
        <span class="label">фото сухого листа</span>
        <span class="cn-name">${escapeHtml((tea.name_cn || '').split('·')[0].trim())}</span>
      </div>

      <div style="padding-top:22px;display:flex;flex-direction:column;gap:6px;">
        <h1 class="font-display" style="font-weight:500;font-size:28px;line-height:1.1;color:var(--text-primary);">${escapeHtml(tea.name_ru)}</h1>
        <span style="font-family:'Karla',sans-serif;font-weight:400;font-size:14px;line-height:1.3;color:var(--text-tertiary);">
          ${escapeHtml(tea.name_cn || '')} · ${escapeHtml(tea.name_en || '')} · ${cat.name_ru}
        </span>
      </div>

      <div class="info-grid mt-16">
        <div class="info-cell">
          <span class="label">Вода</span>
          <span class="value">${tempStr}</span>
        </div>
        <div class="info-cell">
          <span class="label">Заварка</span>
          <span class="value">${tea.gaiwan_ratio_g_per_100ml} г / 100 мл</span>
        </div>
        <div class="info-cell">
          <span class="label">Промывка</span>
          <span class="value">${tea.rinse_recommended ? 'нужна' : 'не нужна'}</span>
        </div>
        <div class="info-cell">
          <span class="label">Проливы</span>
          <span class="value">до ${tea.max_infusions} · ${tea.first_steep_seconds}с +${tea.steep_increment_seconds}</span>
        </div>
      </div>

      <p style="margin-top:20px;font-family:'Karla',sans-serif;font-weight:400;font-size:16px;line-height:1.55;color:var(--text-secondary);text-wrap:pretty;">
        ${escapeHtml(tea.description_ru || '')}
      </p>

      <div style="margin-top:16px;display:flex;flex-wrap:wrap;gap:8px;">
        ${(tea.tags || []).map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}
      </div>

      ${effectsHtml}

      <div style="margin-top:24px;display:flex;gap:12px;">
        <button class="btn-primary" style="flex:1;height:64px;border-radius:20px;font-size:24px;" onclick="navigate('session-setup', {teaId:'${tea.id}'})">
          Заварить
        </button>
        <button class="btn-icon" onclick="toggleTeaFavorite('${tea.id}')">
          ${isFav ? '★' : '☆'}
        </button>
      </div>

      ${tea.is_custom ? `
      <div style="margin-top:12px;display:flex;gap:12px;">
        <button class="btn-secondary" style="flex:1;height:48px;border-radius:12px;" onclick="navigate('edit-tea', {teaId:'${tea.id}'})">
          ✏️ Редактировать
        </button>
        <button class="btn-danger" style="flex:1;height:48px;border-radius:12px;" onclick="confirmDeleteCustomTea('${tea.id}')">
          🗑️ Удалить
        </button>
      </div>
      ` : ''}
    </div>
  `;
}

async function toggleTeaFavorite(teaId) {
  const isFav = await db.toggleFavorite(teaId);
  if (isFav) state.favorites.push(teaId);
  else state.favorites = state.favorites.filter(id => id !== teaId);
  renderTeaDetail(teaId);
}

// ============================================
// Screen: Session Setup
// ============================================
function renderSessionSetup(teaId) {
  const container = document.getElementById('screen-session-setup');
  if (!container) return;

  const tea = getTea(teaId);
  if (!tea) { navigate('catalog'); return; }

  state.currentTea = tea;
  const vesselMl = state.settings.default_vessel_ml;
  const grams = calcGrams(tea, vesselMl);

  const strength = state.settings.default_strength || 'medium';
  const numInfusions = tea.max_infusions;
  const scenario = generateScenario(tea, strength, numInfusions);
  state.currentScenario = { tea, strength, numInfusions, vesselMl, grams, times: scenario };

  container.innerHTML = `
    <div class="screen-content">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
        <button class="btn-icon" style="width:40px;height:40px;border-radius:12px;font-size:20px;" onclick="goBack()">←</button>
        <div>
          <span class="overline" style="margin-bottom:0;">Перед сессией</span>
          <h1 class="font-display" style="font-weight:500;font-size:30px;line-height:1.05;color:var(--text-primary);">${escapeHtml(tea.name_ru)}</h1>
        </div>
      </div>

      <div style="margin-top:24px;display:flex;flex-direction:column;gap:10px;">
        <span class="overline">Крепость</span>
        <div class="segmented">
          <button class="segment ${strength === 'light' ? 'active' : ''}" onclick="setStrength('light')">Лёгкая</button>
          <button class="segment ${strength === 'medium' ? 'active' : ''}" onclick="setStrength('medium')">Средняя</button>
          <button class="segment ${strength === 'strong' ? 'active' : ''}" onclick="setStrength('strong')">Крепкая</button>
        </div>
      </div>

      <div style="margin-top:24px;display:flex;flex-direction:column;gap:12px;">
        <div style="display:flex;justify-content:space-between;align-items:baseline;">
          <span class="overline">Проливов</span>
          <span class="font-display" style="font-weight:500;font-size:26px;color:var(--text-primary);" id="setup-infusion-count">${numInfusions}</span>
        </div>
        <div style="height:38px;display:flex;align-items:center;">
          <div class="slider-track" onclick="handleInfusionTrackClick(event)">
            <div class="slider-fill" id="setup-infusion-fill" style="width:${(numInfusions / tea.max_infusions) * 100}%"></div>
            <div class="slider-thumb" id="setup-infusion-thumb" style="left:calc(${(numInfusions / tea.max_infusions) * 100}% - 15px)"></div>
          </div>
        </div>
      </div>

      <div style="margin-top:16px;display:flex;flex-direction:column;gap:10px;">
        <span class="overline">Сценарий, секунды</span>
        <div class="scenario-chips" id="setup-scenario-chips">
          ${scenario.map((sec, i) => `<span class="scenario-chip">${sec}</span>`).join('')}
        </div>
      </div>

      <div style="margin-top:20px;padding:16px 18px;border-radius:18px;border:1px solid var(--border-medium);display:flex;gap:18px;">
        <span style="flex:1;display:flex;flex-direction:column;gap:3px;">
          <span class="overline" style="margin-bottom:0;">Заварка</span>
          <span class="font-display" style="font-weight:500;font-size:22px;color:var(--text-primary);">${grams} г</span>
        </span>
        <span style="width:1px;background:var(--border-medium);"></span>
        <span style="flex:1;display:flex;flex-direction:column;gap:3px;">
          <span class="overline" style="margin-bottom:0;">Посуда</span>
          <span class="font-display" style="font-weight:500;font-size:22px;color:var(--text-primary);">${vesselMl} мл</span>
        </span>
        <span style="width:1px;background:var(--border-medium);"></span>
        <span style="flex:1;display:flex;flex-direction:column;gap:3px;">
          <span class="overline" style="margin-bottom:0;">Промывка</span>
          <span class="font-display" style="font-weight:500;font-size:22px;color:var(--text-primary);">${tea.rinse_recommended ? 'да' : 'нет'}</span>
        </span>
      </div>

      <div style="margin-top:24px;display:flex;flex-direction:column;gap:12px;">
        <button class="btn-secondary" style="width:100%;height:52px;border-radius:20px;" onclick="navigate('custom-scenario')">
          Настроить каждый пролив вручную
        </button>
        <button class="btn-primary btn-primary-lg" onclick="startSession()">
          Начать
        </button>
      </div>
    </div>
  `;
}

function setStrength(s) {
  if (!state.currentScenario) return;
  state.currentScenario.strength = s;
  state.settings.default_strength = s;
  db.setSetting('default_strength', s);
  updateScenarioPreview();
  const segs = document.querySelectorAll('.segmented .segment');
  segs.forEach((btn, i) => {
    const val = ['light', 'medium', 'strong'][i];
    btn.classList.toggle('active', val === s);
  });
}

function handleInfusionTrackClick(e) {
  if (!state.currentScenario) return;
  const tea = state.currentScenario.tea;
  const rect = e.currentTarget.getBoundingClientRect();
  const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  const max = tea.max_infusions;
  const min = 1;
  const val = Math.round(min + pct * (max - min));
  state.currentScenario.numInfusions = val;
  updateScenarioPreview();
  updateInfusionSlider();
}

function updateInfusionSlider() {
  const val = state.currentScenario.numInfusions;
  const max = state.currentScenario.tea.max_infusions;
  const pct = (val / max) * 100;
  const fill = document.getElementById('setup-infusion-fill');
  const thumb = document.getElementById('setup-infusion-thumb');
  const count = document.getElementById('setup-infusion-count');
  if (fill) fill.style.width = pct + '%';
  if (thumb) thumb.style.left = `calc(${pct}% - 15px)`;
  if (count) count.textContent = val;
}

function updateScenarioPreview() {
  const sc = state.currentScenario;
  if (!sc) return;
  const times = generateScenario(sc.tea, sc.strength, sc.numInfusions);
  sc.times = times;
  const chips = document.getElementById('setup-scenario-chips');
  if (chips) {
    chips.innerHTML = times.map(sec => `<span class="scenario-chip">${sec}</span>`).join('');
  }
}

function startSession() {
  if (!state.currentScenario) return;
  const sc = state.currentScenario;
  state.currentSession = {
    id: generateId(),
    tea_id: sc.tea.id,
    tea_name_snapshot: sc.tea.name_ru,
    strength: sc.strength,
    start_time: new Date().toISOString(),
    end_time: null,
    infusion_log: sc.times.map((planned, idx) => ({
      index: idx,
      planned_seconds: planned,
      poured_at: null
    })),
    rating: null,
    notes: '',
    effects_snapshot: sc.tea.effects && Object.keys(sc.tea.effects).length > 0 ? { ...sc.tea.effects } : {}
  };
  state.customScenarioTimes = [...sc.times];
  state.customScenarioName = '';
  state.timerTargetEnd = null; // reset timer target
  navigate('timer');
}

// ============================================
// Screen: Custom Scenario
// ============================================
function renderCustomScenario() {
  const container = document.getElementById('screen-custom-scenario');
  if (!container) return;

  const times = state.customScenarioTimes;
  const maxSec = Math.max(...times, 90);

  container.innerHTML = `
    <div class="screen-content">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
        <button class="btn-icon" style="width:40px;height:40px;border-radius:12px;font-size:20px;" onclick="goBack()">←</button>
        <div>
          <span class="overline" style="margin-bottom:0;">Кастомный сценарий</span>
          <h1 class="font-display" style="font-weight:500;font-size:30px;line-height:1.05;color:var(--text-primary);">Своя лестница</h1>
        </div>
      </div>

      <div style="margin-top:20px;display:flex;gap:10px;align-items:center;">
        <span style="font-family:'Karla',sans-serif;font-weight:400;font-size:15px;color:var(--text-secondary);flex:1;">Сдвинуть все проливы</span>
        <button class="btn-secondary" style="width:44px;height:44px;border-radius:14px;padding:0;font-size:20px;" onclick="shiftAll(-5)">−5</button>
        <button class="btn-secondary" style="width:44px;height:44px;border-radius:14px;padding:0;font-size:20px;" onclick="shiftAll(5)">+5</button>
      </div>

      <div style="margin-top:18px;display:flex;flex-direction:column;gap:8px;">
        ${times.map((sec, i) => {
          const pct = Math.round((sec / maxSec) * 100);
          return `
          <div class="scenario-row">
            <span class="idx">${i + 1}</span>
            <span class="bar-bg"><span class="bar-fill" style="width:${pct}%"></span></span>
            <input type="number" class="sec" value="${sec}" min="1" max="999" onchange="updateCustomTime(${i}, this.value)">
            <span class="unit">с</span>
          </div>
          `;
        }).join('')}
        <button class="btn-secondary btn-dashed" style="height:52px;border-radius:16px;" onclick="addCustomInfusion()">
          + Ещё пролив
        </button>
      </div>

      <div style="margin-top:20px;display:flex;flex-direction:column;gap:10px;">
        <div class="search-box" style="height:54px;border-radius:16px;">
          <input type="text" placeholder="Имя пресета: «Дань цун, вечер»" value="${escapeHtml(state.customScenarioName)}" oninput="state.customScenarioName=this.value" style="color:var(--text-tertiary);">
        </div>
        <div style="display:flex;gap:12px;">
          <button class="btn-secondary" style="flex:1;height:56px;border-radius:20px;" onclick="savePreset()">Сохранить</button>
          <button class="btn-primary" style="flex:1;height:56px;border-radius:20px;font-size:22px;" onclick="startCustomSession()">Начать</button>
        </div>
      </div>
    </div>
  `;
}

function shiftAll(delta) {
  state.customScenarioTimes = state.customScenarioTimes.map(t => Math.max(5, t + delta));
  renderCustomScenario();
}

function updateCustomTime(idx, val) {
  const v = parseInt(val) || 5;
  state.customScenarioTimes[idx] = Math.max(5, v);
  renderCustomScenario();
}

function addCustomInfusion() {
  const last = state.customScenarioTimes[state.customScenarioTimes.length - 1] || 30;
  state.customScenarioTimes.push(last + 5);
  renderCustomScenario();
}

async function savePreset() {
  if (!state.customScenarioName.trim()) {
    alert('Введите имя пресета');
    return;
  }
  await db.savePreset({
    id: generateId(),
    name: state.customScenarioName,
    times: [...state.customScenarioTimes],
    created_at: new Date().toISOString()
  });
  alert('Пресет сохранён!');
}

function startCustomSession() {
  if (!state.currentTea) return;
  const sc = state.currentScenario;
  state.currentSession = {
    id: generateId(),
    tea_id: sc.tea.id,
    tea_name_snapshot: sc.tea.name_ru,
    strength: 'custom',
    start_time: new Date().toISOString(),
    end_time: null,
    infusion_log: state.customScenarioTimes.map((planned, idx) => ({
      index: idx,
      planned_seconds: planned,
      poured_at: null
    })),
    rating: null,
    notes: '',
    effects_snapshot: sc.tea.effects && Object.keys(sc.tea.effects).length > 0 ? { ...sc.tea.effects } : {}
  };
  state.timerTargetEnd = null;
  navigate('timer');
}

// ============================================
// Screen: Timer
// ============================================
function renderTimer() {
  const container = document.getElementById('screen-timer');
  if (!container) return;

  const session = state.currentSession;
  if (!session) { navigate('home'); return; }

  const tea = getTea(session.tea_id);
  const cat = tea ? getCategory(tea.category) : CATEGORIES[0];
  const currentIdx = session.infusion_log.findIndex(i => i.poured_at === null && !i.skipped);
  const currentInfusion = currentIdx >= 0 ? session.infusion_log[currentIdx] : null;

  if (!currentInfusion) {
    finishSession();
    return;
  }

  const planned = currentInfusion.planned_seconds;
  const totalInfusions = session.infusion_log.length;
  const now = new Date();
  const timeStr = now.getHours() + ':' + String(now.getMinutes()).padStart(2, '0');

  // Determine remaining seconds if returning to timer
  let startSeconds = planned;
  if (state.timerTargetEnd) {
    const remaining = Math.ceil((state.timerTargetEnd - Date.now()) / 1000);
    if (remaining > 0) startSeconds = remaining;
    else startSeconds = 0;
  }

  const accent = cat.accent;
  const gradient = `linear-gradient(180deg, ${accent}88 0%, ${accent} 45%, ${adjustColor(accent, -30)} 100%)`;

  container.innerHTML = `
    <div class="timer-screen active" id="timer-overlay">
      <div class="timer-fill" id="timer-fill" style="height:0%;background:${gradient};"></div>
      <div class="timer-fill-line" id="timer-fill-line" style="bottom:0%;background:${accent};"></div>

      <div class="timer-header">
        <span class="status">Настой поднимается</span>
        <span class="time">${timeStr}</span>
      </div>

      <div class="timer-body">
        <div class="timer-dial">
          <div class="ring ring-1" style="border-color:var(--border-strong);"></div>
          <div class="ring ring-2" style="border-color:var(--border-strong);"></div>
          <div class="steam" style="left:80px;"></div>
          <div class="steam steam-2"></div>
          <div class="dial-inner">
            <span style="width:86px;height:56px;margin-bottom:4px;color:${accent};display:flex;align-items:center;justify-content:center;">
              <svg width="86" height="56" viewBox="0 0 130 84" fill="none" stroke="currentColor" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round">
                <path d="M58 24 C52.5 18 63.5 12.5 58 5"/>
                <path d="M76 26 C70.5 20 81.5 14.5 76 7"/>
                <path d="M14 46 H48 L44 57 Q31 60.5 18 57 Z"/>
                <path d="M16.5 42.5 Q31 34.5 45.5 42.5"/>
                <circle cx="31" cy="33" r="3"/>
                <path d="M62 44 H110 L106 57 Q86 61 66 57 Z"/>
                <path d="M110 46.5 L121 41.5"/>
                <path d="M68 43 H104"/>
                <path d="M72 43 Q86 32.5 100 43"/>
                <rect x="6" y="59" width="118" height="10" rx="2.5"/>
                <path d="M26 69 H42 V76.5 H26 Z"/>
                <path d="M92 69 H108 V76.5 H92 Z"/>
              </svg>
            </span>
            <span class="infusion-counter">${currentIdx + 1} / ${totalInfusions}</span>
            <span class="timer-display" id="timer-display">${formatTime(startSeconds)}</span>
          </div>
        </div>
        <div class="timer-info">
          <span class="tea-name">${escapeHtml(session.tea_name_snapshot)}</span>
          <span class="tea-meta">${tea ? escapeHtml(tea.name_cn) + ' · ' : ''}${state.currentScenario?.grams || '5'} г / ${state.currentScenario?.vesselMl || '120'} мл · ${tea ? tea.temperature_max + '°C' : '100°C'}</span>
        </div>
      </div>

      <div class="timer-actions">
        <button class="btn-pour" id="btn-pour" onclick="pourTea()">Слил</button>
        <div class="row">
          <button class="btn-secondary" style="flex:1;height:52px;border-radius:26px;" onclick="skipInfusion()">Пропустить</button>
          <button class="btn-secondary btn-danger" style="flex:1;height:52px;border-radius:26px;" onclick="finishSession()">Завершить</button>
        </div>
      </div>
    </div>
  `;

  if (startSeconds > 0) {
    startTimer(startSeconds);
  } else {
    state.timerRemaining = 0;
    updateTimerDisplay();
    timerFinished();
  }
}

function startTimer(seconds) {
  stopTimer();
  state.timerTotal = seconds;
  state.timerTargetEnd = Date.now() + seconds * 1000;
  state.timerRunning = true;

  if (state.settings.keep_screen_on) {
    requestWakeLock();
  }

  updateTimerDisplay();
  state.timerInterval = setInterval(() => {
    if (!state.timerRunning) return;
    updateTimerDisplay();
    if (state.timerRemaining <= 0) {
      timerFinished();
      clearInterval(state.timerInterval);
      state.timerInterval = null;
    }
  }, 1000);
}

function stopTimer() {
  if (state.timerInterval) {
    clearInterval(state.timerInterval);
    state.timerInterval = null;
  }
  state.timerRunning = false;
  releaseWakeLock();
}

function updateTimerDisplay() {
  if (!state.timerTargetEnd) return;
  const remaining = Math.max(0, Math.ceil((state.timerTargetEnd - Date.now()) / 1000));
  state.timerRemaining = remaining;

  const display = document.getElementById('timer-display');
  const fill = document.getElementById('timer-fill');
  const line = document.getElementById('timer-fill-line');
  const pourBtn = document.getElementById('btn-pour');

  if (display) display.textContent = formatTime(remaining);

  const pct = state.timerTotal > 0
    ? ((state.timerTotal - remaining) / state.timerTotal) * 100
    : 0;
  if (fill) fill.style.height = pct + '%';
  if (line) line.style.bottom = pct + '%';

  if (remaining <= 0 && pourBtn) {
    pourBtn.style.background = 'var(--accent-green)';
    pourBtn.textContent = 'Готово!';
  }
}

function timerFinished() {
  state.timerRunning = false;
  if (state.settings.sound_enabled) playGong();
  if (state.settings.vibration_enabled && navigator.vibrate) {
    navigator.vibrate([200, 100, 400]);
  }
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('TeaTimer', { body: 'Пролив готов! Сливайте чай.' });
  }
}

function playGong() {
  // Если Web Audio инициализирован - используем только его
  if (audioManager.isInitialized) {
    audioManager.play('gong');
    return; // Выходим, не используем HTML элемент
  }
  // Fallback на HTML audio элемент только если Web Audio недоступен
  const audio = document.getElementById('gong-sound');
  if (audio) {
    audio.currentTime = 0;
    audio.play().catch(() => {});
  }
}

function playBell() {
  // Если Web Audio инициализирован - используем только его
  if (audioManager.isInitialized) {
    audioManager.play('bell');
    return; // Выходим, не используем HTML элемент
  }
  // Fallback на HTML audio элемент только если Web Audio недоступен
  const audio = document.getElementById('bell-sound');
  if (audio) {
    audio.currentTime = 0;
    audio.play().catch(() => {});
  }
}

function playSoftRing() {
  // Если Web Audio инициализирован - используем только его
  if (audioManager.isInitialized) {
    audioManager.play('soft');
    return; // Выходим, не используем HTML элемент
  }
  // Fallback на HTML audio элемент только если Web Audio недоступен
  const audio = document.getElementById('soft-ring-sound');
  if (audio) {
    audio.currentTime = 0;
    audio.play().catch(() => {});
  }
}

function startReminder() {
  clearReminder(); // Очищаем старый таймер если есть

  // Напоминание через 2 минуты (120 сек)
  state.reminderTimeout = setTimeout(() => {
    if (state.timerRunning === false && state.currentSession) {
      // Проверяем есть ли еще неслитый пролив
      const hasUnpoured = state.currentSession.infusion_log.findIndex(
        i => i.poured_at === null && !i.skipped
      ) >= 0;

      if (hasUnpoured) {
        // Проигрываем мягкий звон
        if (state.settings.sound_enabled) playSoftRing();

        // Вибрация
        if (state.settings.vibration_enabled && navigator.vibrate) {
          navigator.vibrate([200, 100, 200]);
        }

        // Уведомление
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('Напоминание TeaTimer', {
            body: 'Вы забыли слить чай! Пролив уже готов.',
            badge: 'assets/TeaTimer.png',
            icon: 'assets/TeaTimer.png',
            tag: 'tea-reminder'
          });
        }
      }
    }
  }, 120000); // 2 минуты
}

function clearReminder() {
  if (state.reminderTimeout) {
    clearTimeout(state.reminderTimeout);
    state.reminderTimeout = null;
  }
}

function pourTea() {
  const session = state.currentSession;
  if (!session) return;

  try {
    const idx = session.infusion_log.findIndex(i => i.poured_at === null && !i.skipped);
    if (idx >= 0) {
      session.infusion_log[idx].poured_at = new Date().toISOString();
      db.saveSession(session).catch(e => console.error('Failed to save pour:', e));
    }
  } catch (e) {
    console.error('Error in pourTea:', e);
  }

  stopTimer();
  state.timerTargetEnd = null;
  const nextIdx = session.infusion_log.findIndex(i => i.poured_at === null && !i.skipped);
  if (nextIdx >= 0) {
    if (state.settings.sound_enabled) playBell();
    renderTimer();
    // Начинаем таймер напоминания через 2 минуты если забудет слить
    startReminder();
  } else {
    clearReminder();
    finishSession();
  }
}

function skipInfusion() {
  const session = state.currentSession;
  if (!session) return;

  try {
    const idx = session.infusion_log.findIndex(i => i.poured_at === null && !i.skipped);
    if (idx >= 0) {
      session.infusion_log[idx].skipped = true;
      db.saveSession(session).catch(e => console.error('Failed to save skip:', e));
    }
  } catch (e) {
    console.error('Error in skipInfusion:', e);
  }

  stopTimer();
  state.timerTargetEnd = null;
  const nextIdx = session.infusion_log.findIndex(i => i.poured_at === null && !i.skipped);
  if (nextIdx >= 0) {
    renderTimer();
    // Начинаем таймер напоминания через 2 минуты
    startReminder();
  } else {
    clearReminder();
    finishSession();
  }
}

async function finishSession() {
  stopTimer();
  state.timerTargetEnd = null;
  const session = state.currentSession;

  try {
    if (session && !session.end_time) {
      session.end_time = new Date().toISOString();
      await db.saveSession(session);
      state.sessions = await db.getSessions();
      if (state.settings.sound_enabled) playSoftRing();
    }
  } catch (e) {
    console.error('Error finishing session:', e);
  }

  // Clear all session-related state
  state.currentSession = null;
  state.currentTea = null;
  state.currentScenario = null;
  state.customScenarioTimes = [];
  state.customScenarioName = '';

  navigate('history');
}

// Wake Lock
async function requestWakeLock() {
  try {
    if ('wakeLock' in navigator) {
      state.wakeLock = await navigator.wakeLock.request('screen');
    }
  } catch (e) { console.warn('Wake lock failed', e); }
}

function releaseWakeLock() {
  if (state.wakeLock) {
    state.wakeLock.release().catch(() => {});
    state.wakeLock = null;
  }
}

// ============================================
// Screen: History
// ============================================
function renderHistory() {
  const container = document.getElementById('screen-history');
  if (!container) return;

  const sessions = state.sessions ? [...state.sessions].sort((a, b) => new Date(b.start_time) - new Date(a.start_time)) : [];

  // Stats
  const totalSessions = sessions.length;
  const totalMinutes = sessions.reduce((sum, s) => {
    const start = new Date(s.start_time);
    const end = s.end_time ? new Date(s.end_time) : new Date(start.getTime() + 30*60000);
    return sum + Math.round((end - start) / 60000);
  }, 0);
  const teaCounts = {};
  sessions.forEach(s => { teaCounts[s.tea_name_snapshot] = (teaCounts[s.tea_name_snapshot] || 0) + 1; });
  const topTea = Object.entries(teaCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';

  // Group by ISO date
  const groups = {};
  sessions.forEach(s => {
    const dateKey = new Date(s.start_time).toISOString().split('T')[0];
    if (!groups[dateKey]) groups[dateKey] = [];
    groups[dateKey].push(s);
  });

  const todayStr = new Date().toISOString().split('T')[0];

  container.innerHTML = `
    <div class="screen-content">
      <div style="margin-bottom: 16px;">
        <h1 class="font-display" style="font-weight:500;font-size:32px;line-height:1.05;color:var(--text-primary);">История</h1>
      </div>

      <div class="stat-grid mb-20">
        <div class="stat-tile">
          <span class="value">${totalSessions}</span>
          <span class="label">чаепитий</span>
        </div>
        <div class="stat-tile">
          <span class="value">${Math.round(totalMinutes / 60)} ч</span>
          <span class="label">всего</span>
        </div>
        <div class="stat-tile">
          <span class="value">${escapeHtml(topTea)}</span>
          <span class="label">чаще всего</span>
        </div>
      </div>

      <div style="display:flex;flex-direction:column;gap:14px;">
        ${Object.entries(groups).map(([dateKey, daySessions]) => {
          const isToday = dateKey === todayStr;
          const label = isToday ? 'Сегодня' : formatShortDate(daySessions[0].start_time);
          return `
          <div>
            <span class="overline" style="margin-bottom:8px;display:block;">${label}</span>
            <div style="display:flex;flex-direction:column;gap:8px;">
              ${daySessions.map((s, sIdx) => {
                if (isToday && sIdx === 0) {
                  const start = new Date(s.start_time);
                  const end = s.end_time ? new Date(s.end_time) : start;
                  const duration = Math.round((end - start) / 60000);
                  const infusions = s.infusion_log.filter(i => i.poured_at).length;
                  const maxTime = Math.max(...s.infusion_log.map(i => i.planned_seconds), 1);
                  const tea = getTea(s.tea_id);
                  const cat = tea ? getCategory(tea.category) : null;
                  let effectsHtml = '';
                  if (s.effects_snapshot && Object.keys(s.effects_snapshot).length > 0 && cat) {
                    effectsHtml = `
                      <div style="margin-top:12px;">
                        <div style="display:flex;flex-wrap:wrap;gap:6px;">
                          ${Object.keys(s.effects_snapshot).map(k => {
                            const val = s.effects_snapshot[k];
                            return `<span class="tag" style="background:${cat.accent}22;color:${cat.accent};border:1px solid ${cat.accent}44;font-size:13px;padding:4px 10px;">${escapeHtml(val || k)}</span>`;
                          }).join('')}
                        </div>
                      </div>
                    `;
                  }
                  return `
                  <div class="session-card">
                    <div class="header">
                      <span class="title">${escapeHtml(s.tea_name_snapshot)}</span>
                      <span class="rating">${'★'.repeat(s.rating || 0)}${'☆'.repeat(5 - (s.rating || 0))}</span>
                    </div>
                    <div class="meta">
                      <span>${String(start.getHours()).padStart(2,'0')}:${String(start.getMinutes()).padStart(2,'0')} → ${String(end.getHours()).padStart(2,'0')}:${String(end.getMinutes()).padStart(2,'0')}</span>
                      <span>${duration} мин</span>
                      <span>${infusions} проливов</span>
                    </div>
                    <div class="chart">
                      ${s.infusion_log.map((inf, i) => {
                        const h = Math.round((inf.planned_seconds / maxTime) * 100);
                        return `<span class="bar ${i === 3 ? 'highlight' : ''}" style="height:${h}%"></span>`;
                      }).join('')}
                    </div>
                    ${s.notes ? `<p class="note">${escapeHtml(s.notes)}</p>` : ''}
                    ${effectsHtml}
                  </div>
                  `;
                } else {
                  const start = new Date(s.start_time);
                  const end = s.end_time ? new Date(s.end_time) : start;
                  const duration = Math.round((end - start) / 60000);
                  const infusions = s.infusion_log.filter(i => i.poured_at).length;
                  return `
                  <div class="history-row">
                    <span class="time">${String(start.getHours()).padStart(2,'0')}:${String(start.getMinutes()).padStart(2,'0')}</span>
                    <span class="name">${escapeHtml(s.tea_name_snapshot)}</span>
                    <span class="info">${infusions} пр · ${duration} мин</span>
                  </div>
                  `;
                }
              }).join('')}
            </div>
          </div>
          `;
        }).join('')}
        ${sessions.length === 0 ? '<div style="padding:60px 20px;text-align:center;color:var(--text-muted);"><p class="font-display" style="font-size:24px;margin-bottom:8px;">Пока пусто</p><p style="font-size:15px;">Заварите первый чай — и история появится здесь</p></div>' : ''}
      </div>
    </div>
  `;
}

// ============================================
// Screen: Settings
// ============================================
function renderSettings() {
  const container = document.getElementById('screen-settings');
  if (!container) return;

  const s = state.settings || {};

  container.innerHTML = `
    <div class="screen-content">
      <div style="margin-bottom: 24px;">
        <h1 class="font-display" style="font-weight:500;font-size:32px;line-height:1.05;color:var(--text-primary);">Настройки</h1>
      </div>

      <div style="display:flex;flex-direction:column;gap:26px;">
        <div style="display:flex;flex-direction:column;gap:10px;">
          <span class="overline">Сигнал</span>
          <div class="settings-row">
            <span class="label">Звук гонга</span>
            <div class="toggle ${s.sound_enabled ? 'on' : ''}" onclick="toggleSetting('sound_enabled')">
              <span class="knob"></span>
            </div>
          </div>
          <div class="settings-row">
            <span class="label">Вибрация</span>
            <div class="toggle ${s.vibration_enabled ? 'on' : ''}" onclick="toggleSetting('vibration_enabled')">
              <span class="knob"></span>
            </div>
          </div>
          <div class="settings-row">
            <div>
              <span class="label">Не гасить экран</span>
              <span class="sublabel">на время сессии</span>
            </div>
            <div class="toggle ${s.keep_screen_on ? 'on' : ''}" onclick="toggleSetting('keep_screen_on')">
              <span class="knob"></span>
            </div>
          </div>
        </div>

        <div style="display:flex;flex-direction:column;gap:10px;">
          <span class="overline">Вид</span>
          <div class="segmented">
            <button class="segment ${s.theme === 'light' ? 'active' : ''}" onclick="setTheme('light')">Светлая</button>
            <button class="segment ${s.theme === 'dark' ? 'active' : ''}" onclick="setTheme('dark')">Тёмная</button>
            <button class="segment ${s.theme === 'system' ? 'active' : ''}" onclick="setTheme('system')">Как в системе</button>
          </div>
        </div>

        <div style="display:flex;flex-direction:column;gap:2px;">
          <span class="overline" style="padding-bottom:8px;">Данные</span>
          <div class="settings-row" style="cursor:pointer;" onclick="exportData()">
            <span class="label">Экспорт в JSON</span>
            <span style="font-family:'Karla',sans-serif;font-weight:500;font-size:14px;color:var(--text-tertiary);">→</span>
          </div>
          <div class="settings-row" style="cursor:pointer;" onclick="importData()">
            <span class="label">Импорт</span>
            <span style="font-family:'Karla',sans-serif;font-weight:500;font-size:14px;color:var(--text-tertiary);">→</span>
          </div>
          <div class="settings-row" style="cursor:pointer;" onclick="clearAllData()">
            <span class="label" style="color:var(--accent-red);">Очистить все данные</span>
          </div>
        </div>
      </div>

      <div style="margin-top:40px;display:flex;flex-direction:column;gap:4px;">
        <span style="font-family:'Karla',sans-serif;font-weight:400;font-size:13px;line-height:1.4;color:var(--text-tertiary);">Всё хранится только на этом устройстве. Сервера нет.</span>
        <span style="font-family:'Karla',sans-serif;font-weight:400;font-size:13px;line-height:1.4;color:var(--text-muted);">TeaTimer 1.0 · база чаёв: ${TEAS.length} позиций</span>
      </div>
    </div>
  `;
}

async function toggleSetting(key) {
  const val = !state.settings[key];
  state.settings[key] = val;
  await db.setSetting(key, val);
  renderSettings();
  if (key === 'sound_enabled' && val) playGong();
}

async function setTheme(theme) {
  state.settings.theme = theme;
  await db.setSetting('theme', theme);
  applyTheme();
  renderSettings();
}

async function exportData() {
  const data = {
    sessions: await db.getSessions(),
    favorites: await db.getFavorites(),
    customTeas: await db.getCustomTeas(),
    presets: await db.getPresets(),
    settings: state.settings,
    exportDate: new Date().toISOString(),
    version: '1.0'
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `teatimer-backup-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importData() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (data.sessions) {
        for (const s of data.sessions) await db.saveSession(s);
      }
      if (data.favorites) {
        const existing = new Set(await db.getFavorites());
        for (const f of data.favorites) {
          if (!existing.has(f)) await db.toggleFavorite(f);
        }
      }
      if (data.customTeas) {
        for (const t of data.customTeas) await db.saveCustomTea(t);
      }
      if (data.presets) {
        for (const p of data.presets) await db.savePreset(p);
      }
      alert('Данные импортированы!');
      await loadAppData();
      navigate('home');
    } catch (err) {
      alert('Ошибка импорта: ' + err.message);
    }
  };
  input.click();
}

async function clearAllData() {
  if (!confirm('Все сессии, избранное и настройки будут удалены. Продолжить?')) return;
  const req = indexedDB.deleteDatabase(DB_NAME);
  req.onsuccess = () => {
    alert('Данные очищены. Перезагрузите страницу.');
    location.reload();
  };
}

// ============================================
// Color utility
// ============================================
function adjustColor(hex, amount) {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, Math.min(255, (num >> 16) + amount));
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0x00FF) + amount));
  const b = Math.max(0, Math.min(255, (num & 0x0000FF) + amount));
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}

// ============================================
// Build App Shell
// ============================================
function buildAppShell() {
  const app = document.getElementById('app');
  if (!app) return;

  app.innerHTML = `
    <!-- Pull to refresh indicator -->
    <div class="pull-refresh-indicator" style="position:fixed;top:10px;left:50%;transform:translateX(-50%);opacity:0;transition:opacity 0.3s;background:var(--accent-green);color:var(--bg-primary);padding:8px 16px;border-radius:20px;font-size:12px;font-weight:600;z-index:999;">⬇ Потяните для обновления</div>

    <!-- Screens -->
    <div class="screen active" id="screen-home"></div>
    <div class="screen" id="screen-catalog"></div>
    <div class="screen" id="screen-tea-detail"></div>
    <div class="screen" id="screen-session-setup"></div>
    <div class="screen" id="screen-custom-scenario"></div>
    <div class="screen" id="screen-add-tea"></div>
    <div class="screen" id="screen-edit-tea"></div>
    <div class="screen" id="screen-history"></div>
    <div class="screen" id="screen-settings"></div>

    <!-- Timer overlay -->
    <div class="timer-screen" id="screen-timer"></div>

    <!-- Category Modal -->
    <div class="modal" id="category-modal"></div>

    <!-- Bottom Navigation -->
    <nav class="bottom-nav">
      <button class="nav-item active" onclick="navigate('home')">
        <span class="icon">
          <svg width="20" height="20" viewBox="0 0 24 24"><path d="M4 10h16v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><path d="M8 10V7a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v3"/></svg>
        </span>
        <span class="label">Чай</span>
      </button>
      <button class="nav-item" onclick="navigate('catalog')">
        <span class="icon">
          <svg width="20" height="20" viewBox="0 0 24 24"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="14" y2="18"/></svg>
        </span>
        <span class="label">Каталог</span>
      </button>
      <button class="nav-item" onclick="navigate('history')">
        <span class="icon">
          <svg width="20" height="20" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        </span>
        <span class="label">История</span>
      </button>
      <button class="nav-item" onclick="navigate('settings')">
        <span class="icon">
          <svg width="20" height="20" viewBox="0 0 24 24"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
        </span>
        <span class="label">Ещё</span>
      </button>
    </nav>
  `;
}

// ============================================
// Data Loading
// ============================================
async function loadTeaData() {
  try {
    const res = await fetch('teas.json');
    TEAS_DATA = await res.json();
    CATEGORIES = TEAS_DATA.categories || [];
    TEAS = TEAS_DATA.teas || [];
    if (TEAS_DATA.strength_multiplier) STRENGTH_MULTIPLIER = TEAS_DATA.strength_multiplier;
  } catch (e) {
    console.error('Failed to load teas.json', e);
    CATEGORIES = [{id:'green',name_ru:'Зелёный',accent:'#B6C158'}];
    TEAS = [{id:'long-jing',name_ru:'Лун Цзин',name_cn:'西湖龙井',category:'green',temperature_min:80,temperature_max:85,gaiwan_ratio_g_per_100ml:4,rinse_recommended:false,first_steep_seconds:20,steep_increment_seconds:5,max_infusions:5,description_ru:'Колодец дракона',tags:['классический']}];
  }
}

async function loadAppData() {
  state.settings = await db.getSettings();
  state.favorites = await db.getFavorites();
  state.sessions = await db.getSessions();
  
  // Загрузить пользовательские чаи из БД и объединить с TEAS
  const customTeas = await db.getCustomTeas();
  TEAS = TEAS.concat(customTeas);
  
  applyTheme();
}

// ============================================
// Notification Permission
// ============================================
function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

// ============================================
// Service Worker
// ============================================
function registerSW() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(err => {
      console.warn('SW registration failed', err);
    });
  }
}

// ============================================
// Initialization
// ============================================
// Pull-to-refresh handler
let pullStartY = 0;
let pullStartTime = 0;
let isPullActive = false;

function setupPullToRefresh() {
  document.addEventListener('touchstart', (e) => {
    const screen = document.querySelector('.screen.active');
    // Only allow pull-to-refresh if at the very top of the active screen
    if (screen && screen.scrollTop === 0) {
      pullStartY = e.touches[0].clientY;
      pullStartTime = Date.now();
      isPullActive = true;
    } else {
      isPullActive = false;
    }
  }, { passive: true });

  document.addEventListener('touchmove', (e) => {
    const screen = document.querySelector('.screen.active');
    if (!isPullActive) return;

    const currentY = e.touches[0].clientY;
    const pullDistance = currentY - pullStartY;

    // Check if user is still at top and pulling down
    if (screen && screen.scrollTop === 0 && pullDistance > 0) {
      // Show indicator if pulled down more than 50px
      const indicator = document.querySelector('.pull-refresh-indicator');
      if (indicator) {
        indicator.style.opacity = pullDistance > 50 ? '1' : '0.5';
      }
    } else {
      // Cancel if scrolled or pulling up
      isPullActive = false;
      const indicator = document.querySelector('.pull-refresh-indicator');
      if (indicator) {
        indicator.style.opacity = '0';
      }
    }
  }, { passive: true });

  document.addEventListener('touchend', (e) => {
    const screen = document.querySelector('.screen.active');
    const pullDuration = Date.now() - pullStartTime;
    const pullDistance = e.changedTouches[0].clientY - pullStartY;

    // Refresh only if:
    // 1. Pull started at top and still at top
    // 2. Pulled down at least 50px
    // 3. Held for at least 1 second (1000ms)
    if (isPullActive && screen && screen.scrollTop === 0 && pullDistance > 50 && pullDuration >= 1000) {
      location.reload();
    }

    const indicator = document.querySelector('.pull-refresh-indicator');
    if (indicator) {
      indicator.style.opacity = '0';
    }
    isPullActive = false;
  }, { passive: true });
}

async function init() {
  buildAppShell();
  await loadTeaData();
  await audioManager.init(); // Инициализируем звуки через Web Audio API
  await db.init();
  await loadAppData();
  setupPullToRefresh();
  registerSW();
  requestNotificationPermission();
  navigate('home');
}

// Set random loader message
setRandomLoaderMessage();

// Start when DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Hide loader when app is ready (add small delay for smooth transition)
setTimeout(() => {
  hideLoader();
}, 800);