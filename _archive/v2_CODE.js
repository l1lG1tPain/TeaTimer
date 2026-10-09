/**
 * TeaTimer v2.0 — Implementation Code for Improvements
 *
 * This file contains:
 * 1. Enhanced timer animation system
 * 2. New render functions for improved UI
 * 3. Helper functions for analytics & statistics
 * 4. New features: recommendations, advanced history
 */

// ============================================
// 1. TIMER ANIMATION SYSTEM (Enhanced)
// ============================================

/**
 * Синхронизирует анимации таймера с прогрессом
 * Вызывается каждые 100ms из renderTimer()
 */
function updateTimerAnimation(remaining, total) {
  const container = document.querySelector('.timer-container');
  if (!container) return;

  const progressPercent = (total - remaining) / total;
  const progress = progressPercent * 100;

  // === ОПРЕДЕЛИТЬ СТАДИЮ ВАРКИ ===
  if (remaining < 10) {
    // ФИНАЛЬНАЯ СТАДИЯ: дым интенсивный, волны быстрые, свечение яркое
    container.classList.add('finalStage');
    container.classList.remove('midStage', 'earlyStage');
  } else if (remaining < total / 2) {
    // СРЕДНЯЯ СТАДИЯ: всё в нормальном темпе
    container.classList.add('midStage');
    container.classList.remove('finalStage', 'earlyStage');
  } else {
    // НАЧАЛЬНАЯ СТАДИЯ: всё спокойно
    container.classList.add('earlyStage');
    container.classList.remove('finalStage', 'midStage');
  }

  // === ОБНОВИТЬ ИНТЕНСИВНОСТЬ СВЕЧЕНИЯ ===
  const glowEffect = container.querySelector('.glow-effect');
  if (glowEffect) {
    // Свечение растёт по мере приближения к готовности
    const glowIntensity = 0.2 + (progressPercent * 0.4);
    glowEffect.style.setProperty('--glow-intensity', glowIntensity);
  }

  // === ОБНОВИТЬ КРУГОВОЙ ПРОГРЕСС-БАР ===
  const progressFill = container.querySelector('.progress-ring .progress-fill');
  if (progressFill) {
    // SVG circle circumference (r=85, C = 2πr)
    const circumference = 534.07;
    const offset = circumference * (1 - progress / 100);
    progressFill.style.strokeDashoffset = offset;
  }

  // === ОБНОВИТЬ ТЕКСТ ВРЕМЕНИ ===
  const timeDisplay = container.querySelector('.timer-time');
  if (timeDisplay) {
    timeDisplay.textContent = formatTime(remaining);
  }

  // === ОБНОВИТЬ НОМЕР ПРОЛИВА ===
  const infusionDots = container.querySelectorAll('.infusion-dots .dot');
  if (infusionDots && state.currentSession) {
    const currentInfusion = state.currentSession.infusion_log.length;
    infusionDots.forEach((dot, i) => {
      dot.classList.toggle('active', i === currentInfusion);
    });
  }
}

/**
 * Вспомогательная функция: определить фазу заварки для текста
 */
function getBrewPhaseText(remaining, total) {
  const percent = (total - remaining) / total;

  if (percent < 0.2) return '☕ Вода нагревается...';
  if (percent < 0.4) return '🫖 Чай раскрывается...';
  if (percent < 0.6) return '🌊 Настой поднимается...';
  if (percent < 0.8) return '✨ Вкус стабилизируется...';
  if (percent < 0.95) return '⏰ Почти готов...';
  return '🔔 Слил!';
}

// ============================================
// 2. RENDERtimer() — ОБНОВЛЕННАЯ ВЕРСИЯ
// ============================================

/**
 * Полностью переработанная функция рендеринга таймера
 * Интегрирует новые анимации и улучшенный UI
 */
function renderTimerV2() {
  const screen = document.getElementById('app');

  if (!state.currentSession || !state.currentTea) {
    navigate('home');
    return;
  }

  const session = state.currentSession;
  const tea = state.currentTea;
  const infusion = session.infusion_log[session.current_infusion];

  const html = `
    <div class="screen timer-screen active" id="screen-timer">
      <div class="timer-container">

        <!-- ОСНОВНОЙ ТАЙМЕР С АНИМАЦИЯМИ -->
        <div class="timer-background">
          <div class="timer-dial">
            <!-- Слои дыма -->
            <div class="steam-layer steam-1"></div>
            <div class="steam-layer steam-2"></div>
            <div class="steam-layer steam-3"></div>

            <!-- Волны кипения -->
            <div class="boil-waves">
              <div class="wave wave-1"></div>
              <div class="wave wave-2"></div>
              <div class="wave wave-3"></div>
            </div>

            <!-- Иконка чайника в центре (SVG) -->
            <div class="teapot-center">
              <svg viewBox="0 0 100 100" width="60" height="60">
                <g class="teapot-group">
                  <!-- Тело чайника -->
                  <path d="M 50 30 Q 70 40 70 60 Q 70 80 50 85 Q 30 80 30 60 Q 30 40 50 30 Z"
                        fill="var(--accent-amber)" stroke="var(--text-primary)" stroke-width="1.5"
                        opacity="0.7"/>
                  <!-- Крышка -->
                  <circle cx="50" cy="25" r="8" fill="var(--text-secondary)" stroke="var(--text-primary)"
                          stroke-width="1"/>
                  <!-- Носик -->
                  <path d="M 70 55 Q 85 50 90 60" stroke="var(--text-secondary)" stroke-width="1.5"
                        fill="none" stroke-linecap="round"/>
                  <!-- Ручка -->
                  <path d="M 30 55 Q 15 50 10 60" stroke="var(--text-secondary)" stroke-width="1.5"
                        fill="none" stroke-linecap="round"/>
                </g>
              </svg>
            </div>

            <!-- Круговой прогресс-бар -->
            <svg class="progress-ring" viewBox="0 0 200 200">
              <circle cx="100" cy="100" r="85" class="progress-bg"/>
              <circle cx="100" cy="100" r="85" class="progress-fill"
                      style="stroke-dashoffset: 534.07"/>
            </svg>

            <!-- ГЛАВНОЕ ОТОБРАЖЕНИЕ ВРЕМЕНИ -->
            <div class="timer-display">
              <div class="timer-time" id="timer-time">${formatTime(state.timerRemaining)}</div>
              <div class="timer-phase" id="timer-phase">${getBrewPhaseText(state.timerRemaining, state.timerTotal)}</div>
            </div>

            <!-- ТОЧКИ ПРОЛИВОВ (0, 1, 2, 3(active), 4, ... max) -->
            <div class="infusion-dots">
              ${Array.from({ length: Math.min(state.currentSession.infusion_log.length, 9) })
                .map((_, i) => `
                  <div class="dot ${i === state.currentSession.current_infusion ? 'active' : ''}"
                       data-index="${i}"></div>
                `)
                .join('')}
            </div>

            <!-- СВЕЧЕНИЕ СНИЗУ (пульсирует с прогрессом) -->
            <div class="glow-effect"></div>
          </div>
        </div>

        <!-- ИНФОРМАЦИЯ О ЧАЕ И ПАРАМЕТРАХ -->
        <div class="timer-info">
          <div class="timer-info-top">
            <h2 class="timer-tea-name">${tea.name_ru}</h2>
            ${tea.name_cn ? `<p class="timer-tea-cn">${tea.name_cn}</p>` : ''}
            <p class="timer-tea-meta">
              ${state.currentSession.vessel_ml || 120}ml •
              ${tea.temperature_min}–${tea.temperature_max}°C
            </p>
          </div>

          <!-- МИНИ-СТАТИСТИКА -->
          <div class="timer-stats">
            <div class="stat-item">
              <span class="stat-label">Проливов</span>
              <span class="stat-value">${session.current_infusion + 1}/${session.infusion_log.length}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Заварка</span>
              <span class="stat-value">${session.grams || calcGrams(tea, state.currentSession.vessel_ml)}g</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Категория</span>
              <span class="stat-value">${getCategory(tea.category).name_ru}</span>
            </div>
          </div>
        </div>

        <!-- КНОПКИ УПРАВЛЕНИЯ -->
        <div class="timer-buttons">
          <button class="btn btn-primary" onclick="handleTimerAction('pour')">
            <span>Слил ✓</span>
          </button>
          <div class="button-row">
            <button class="btn btn-secondary" onclick="handleTimerAction('skip')">Пропустить</button>
            <button class="btn btn-danger" onclick="handleTimerAction('finish')">Конец</button>
          </div>
        </div>

      </div>
    </div>
  `;

  screen.innerHTML = html;

  // Запустить обновление таймера
  if (state.timerInterval) clearInterval(state.timerInterval);
  state.timerInterval = setInterval(() => {
    if (!state.timerRunning) return;

    const now = Date.now();
    const remaining = Math.max(0, Math.round((state.timerTargetEnd - now) / 1000));
    state.timerRemaining = remaining;

    updateTimerAnimation(remaining, state.timerTotal);

    // Проверить готовность
    if (remaining <= 0) {
      handleTimerComplete();
    }
  }, 100);

  // Начальное обновление
  updateTimerAnimation(state.timerRemaining, state.timerTotal);

  // Wake Lock (удержать экран включённым)
  if (state.settings.keep_screen_on && !state.wakeLock) {
    acquireWakeLock();
  }
}

// ============================================
// 3. ОБРАБОТКА ДЕЙСТВИЙ ТАЙМЕРА
// ============================================

async function handleTimerAction(action) {
  if (action === 'pour') {
    await pourTea();
  } else if (action === 'skip') {
    await skipInfusion();
  } else if (action === 'finish') {
    if (confirm('Завершить сессию?')) {
      await finishSession();
    }
  }
}

async function handleTimerComplete() {
  state.timerRunning = false;
  if (state.timerInterval) clearInterval(state.timerInterval);

  // Звук + вибрация
  if (state.settings.sound_enabled) {
    audioManager.play('gong');
  }
  if (state.settings.vibration_enabled && navigator.vibrate) {
    navigator.vibrate([200, 100, 200]);
  }

  // Показать модальное окно "Слили?"
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content">
      <h2>Настой готов! 🫖</h2>
      <p>Вы слили чай?</p>
      <div class="modal-buttons">
        <button class="btn btn-primary" onclick="pourTea()">Да, слил</button>
        <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Ещё минутку</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  // Удалить модаль через 5 сек если не нажали
  setTimeout(() => {
    modal.remove();
    if (state.timerRunning === false && state.currentSession) {
      state.timerRunning = true;
      startTimer();
    }
  }, 5000);
}

// ============================================
// 4. РАСШИРЕННАЯ СТАТИСТИКА И АНАЛИЗ
// ============================================

/**
 * Анализировать качество сессии на основе:
 * - Девиации времени от рекомендованного
 * - Рейтинга пользователя
 * - Истории аналогичных чаёв
 */
async function analyzeSessionQuality(session) {
  const tea = getTea(session.tea_id);
  if (!tea) return null;

  const recommendations = [];
  let qualityScore = 100; // Начать со 100, вычитать за отклонения

  // Анализ каждого пролива
  session.infusion_log.forEach((infusion, index) => {
    if (!infusion.poured_at) return;

    const recommendedTime = session.planned_times[index];
    const actualTime = new Date(infusion.poured_at).getTime() -
                       new Date(session.start_time).getTime();
    const timeDifference = Math.abs(actualTime - recommendedTime * 1000) / 1000;

    // Если отклонение > 10 сек, добавить рекомендацию
    if (timeDifference > 10) {
      const direction = actualTime > recommendedTime * 1000 ? 'дольше' : 'короче';
      recommendations.push({
        infusion: index + 1,
        suggestion: `Пролив ${index + 1} был ${direction} на ${Math.round(timeDifference)}с`,
        impact: `Вкус мог быть ${direction === 'дольше' ? 'крепче' : 'мягче'}`
      });

      qualityScore -= Math.min(20, timeDifference);
    }
  });

  // Фактор рейтинга
  if (session.rating) {
    if (session.rating >= 4) {
      recommendations.push({
        type: 'positive',
        message: 'Отличный результат! Сохраните эти параметры как пресет.'
      });
    }
  }

  return {
    qualityScore: Math.max(0, Math.min(100, qualityScore)),
    recommendations,
    shouldSaveAsPreset: qualityScore > 85 && (session.rating || 3) >= 4
  };
}

/**
 * Получить рекомендации по улучшению сценария
 */
async function getScenarioRecommendations(teaId) {
  const sessions = await db.getSessions();
  const teaSessions = sessions.filter(s => s.tea_id === teaId && s.rating);

  if (teaSessions.length < 3) {
    return null; // Недостаточно данных
  }

  // Найти высокорейтинговые сессии (4-5 звёзд)
  const topSessions = teaSessions
    .filter(s => s.rating >= 4)
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 5);

  if (topSessions.length === 0) return null;

  // Усреднить времена проливов
  const avgTimes = [];
  const maxInfusions = Math.max(...topSessions.map(s => s.infusion_log.length));

  for (let i = 0; i < maxInfusions; i++) {
    const times = topSessions
      .filter(s => s.infusion_log[i])
      .map(s => s.infusion_log[i].planned_seconds || s.infusion_log[i].actual_seconds)
      .filter(t => t);

    if (times.length > 0) {
      avgTimes[i] = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
    }
  }

  return {
    averageTimes: avgTimes,
    basedOnSessions: topSessions.length,
    confidence: Math.min(100, topSessions.length * 25)
  };
}

/**
 * Получить статистику за период
 */
async function getSessionStatistics(days = 7) {
  const sessions = await db.getSessions();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  const recentSessions = sessions.filter(
    s => new Date(s.start_time) > cutoffDate
  );

  const stats = {
    totalSessions: recentSessions.length,
    totalTime: 0,
    averageRating: 0,
    favoriteTeaId: null,
    favoriteTeaCount: 0,
    teaBreakdown: {},
    hourOfDay: {},
    ratings: [0, 0, 0, 0, 0], // 1-5 звёзд
  };

  recentSessions.forEach(session => {
    // Время сессии
    const start = new Date(session.start_time);
    const end = new Date(session.end_time || session.start_time);
    stats.totalTime += (end - start) / 1000 / 60; // минуты

    // Рейтинги
    if (session.rating) {
      stats.ratings[session.rating - 1]++;
      stats.averageRating += session.rating;
    }

    // Распределение по чаям
    stats.teaBreakdown[session.tea_id] = (stats.teaBreakdown[session.tea_id] || 0) + 1;

    // Час дня
    const hour = start.getHours();
    stats.hourOfDay[hour] = (stats.hourOfDay[hour] || 0) + 1;
  });

  // Средний рейтинг
  const ratedSessions = recentSessions.filter(s => s.rating);
  stats.averageRating = ratedSessions.length > 0
    ? (stats.averageRating / ratedSessions.length).toFixed(1)
    : 'Нет оценок';

  // Любимый чай
  const [favTeaId, favCount] = Object.entries(stats.teaBreakdown)
    .sort(([, a], [, b]) => b - a)[0] || [null, 0];
  stats.favoriteTeaId = favTeaId;
  stats.favoriteTeaCount = favCount;

  return stats;
}

// ============================================
// 5. УЛУЧШЕННАЯ ИСТОРИЯ (renderHistoryV2)
// ============================================

/**
 * Рендер истории с графиками и статистикой
 */
async function renderHistoryV2() {
  const screen = document.getElementById('app');
  const stats = await getSessionStatistics(7);
  const allSessions = await db.getSessions();

  // Построить HTML со статистикой
  let html = `
    <div class="screen active" id="screen-history">
      <div class="screen-content">
        <h1>История чаепитий</h1>

        <!-- СТАТИСТИКА ЗА НЕДЕЛЮ -->
        <div class="stats-card">
          <div class="stats-grid">
            <div class="stat-box">
              <div class="stat-number">${stats.totalSessions}</div>
              <div class="stat-label">Сессий на неделе</div>
            </div>
            <div class="stat-box">
              <div class="stat-number">${Math.round(stats.totalTime)}</div>
              <div class="stat-label">Минут за неделю</div>
            </div>
            <div class="stat-box">
              <div class="stat-number">${stats.averageRating}</div>
              <div class="stat-label">Средний рейтинг</div>
            </div>
            <div class="stat-box">
              <div class="stat-number">${stats.favoriteTeaCount}</div>
              <div class="stat-label">Раз любимый чай</div>
            </div>
          </div>
        </div>

        <!-- ГРАФИК РЕЙТИНГОВ -->
        <div class="chart-card">
          <h3>Распределение рейтингов</h3>
          <div class="rating-chart">
            ${[1, 2, 3, 4, 5].map(rating => `
              <div class="rating-bar">
                <div class="rating-label">⭐ ${rating}</div>
                <div class="rating-progress">
                  <div class="rating-fill" style="width: ${(stats.ratings[rating - 1] / Math.max(...stats.ratings, 1)) * 100}%"></div>
                </div>
                <div class="rating-count">${stats.ratings[rating - 1]}</div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- ПОСЛЕДНИЕ СЕССИИ -->
        <div class="sessions-list">
          <h3>Последние сессии</h3>
          ${allSessions
            .sort((a, b) => new Date(b.start_time) - new Date(a.start_time))
            .slice(0, 20)
            .map(session => {
              const tea = getTea(session.tea_id);
              const start = new Date(session.start_time);
              const end = new Date(session.end_time || session.start_time);
              const duration = Math.round((end - start) / 1000 / 60);

              return `
                <div class="session-item" onclick="showSessionDetail('${session.id}')">
                  <div class="session-header">
                    <h4>${tea?.name_ru || 'Неизвестный чай'}</h4>
                    <span class="session-date">${formatShortDate(session.start_time)}</span>
                  </div>
                  <div class="session-meta">
                    <span>⏱️ ${duration} мин</span>
                    <span>🔀 ${session.infusion_log.length} проливов</span>
                    ${session.rating ? `<span>⭐ ${session.rating}/5</span>` : '<span>Без оценки</span>'}
                  </div>
                </div>
              `;
            })
            .join('')}
        </div>
      </div>
    </div>
  `;

  screen.innerHTML = html;
}

// ============================================
// 6. ДОБАВИТЬ НОВЫЕ CSS КЛАССЫ
// ============================================

const NEW_STYLES = `
/* Новые стили для v2.0 */

.timer-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  height: 100%;
  padding: 20px;
}

.timer-background {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
}

.timer-display {
  text-align: center;
  position: absolute;
  z-index: 10;
}

.timer-time {
  font-family: 'Cormorant Garamond', serif;
  font-size: 72px;
  font-weight: 600;
  color: var(--accent-amber);
  line-height: 1;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.timer-phase {
  font-size: 14px;
  color: var(--text-secondary);
  margin-top: 8px;
  letter-spacing: 0.5px;
}

.timer-info {
  text-align: center;
  padding: 20px;
  width: 100%;
}

.timer-tea-name {
  font-family: 'Cormorant Garamond', serif;
  font-size: 28px;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.timer-tea-cn {
  font-size: 16px;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.timer-tea-meta {
  font-size: 13px;
  color: var(--text-muted);
}

.timer-stats {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 12px;
  margin-top: 16px;
}

.stat-item {
  background: var(--bg-secondary);
  padding: 12px;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stat-label {
  font-size: 11px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 4px;
}

.stat-value {
  font-size: 16px;
  font-weight: 600;
  color: var(--accent-amber);
}

.timer-buttons {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  padding: 0 20px 20px;
}

.button-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.btn-danger {
  background: var(--accent-red);
  color: white;
}

.btn-danger:hover,
.btn-danger:active {
  background: var(--accent-red-hover);
}

/* Статистика */
.stats-card {
  background: var(--bg-secondary);
  border-radius: 16px;
  padding: 16px;
  margin-bottom: 20px;
}

.stats-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.stat-box {
  text-align: center;
  padding: 16px;
  background: var(--bg-primary);
  border-radius: 12px;
  border: 1px solid var(--border-light);
}

.stat-number {
  font-family: 'Cormorant Garamond', serif;
  font-size: 32px;
  font-weight: 600;
  color: var(--accent-amber);
}

.stat-label {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 4px;
}

.chart-card {
  background: var(--bg-secondary);
  border-radius: 16px;
  padding: 16px;
  margin-bottom: 20px;
}

.chart-card h3 {
  margin-bottom: 16px;
  font-size: 16px;
  color: var(--text-primary);
}

.rating-chart {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.rating-bar {
  display: flex;
  align-items: center;
  gap: 8px;
}

.rating-label {
  font-size: 13px;
  min-width: 30px;
  color: var(--text-secondary);
}

.rating-progress {
  flex: 1;
  height: 8px;
  background: var(--border-light);
  border-radius: 4px;
  overflow: hidden;
}

.rating-fill {
  height: 100%;
  background: var(--accent-amber);
  border-radius: 4px;
}

.rating-count {
  font-size: 12px;
  color: var(--text-muted);
  min-width: 20px;
  text-align: right;
}

.sessions-list h3 {
  margin-bottom: 12px;
  font-size: 16px;
  color: var(--text-primary);
}

.session-item {
  background: var(--bg-secondary);
  padding: 16px;
  border-radius: 12px;
  margin-bottom: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  border: 1px solid var(--border-light);
}

.session-item:active {
  transform: scale(0.98);
  border-color: var(--accent-green);
}

.session-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 8px;
}

.session-header h4 {
  font-size: 16px;
  color: var(--text-primary);
}

.session-date {
  font-size: 12px;
  color: var(--text-muted);
}

.session-meta {
  display: flex;
  gap: 12px;
  font-size: 13px;
  color: var(--text-secondary);
}

/* Модальное окно */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: var(--bg-primary);
  border-radius: 16px;
  padding: 24px;
  max-width: 300px;
  text-align: center;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.modal-content h2 {
  font-size: 24px;
  margin-bottom: 8px;
  color: var(--text-primary);
}

.modal-content p {
  color: var(--text-secondary);
  margin-bottom: 20px;
  font-size: 16px;
}

.modal-buttons {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.modal-buttons .btn {
  width: 100%;
}
`;

// ============================================
// 7. ЭКСПОРТ И ИМПОРТ ФУНКЦИЙ
// ============================================

/**
 * Экспортировать сессии как JSON
 */
async function exportSessions() {
  const sessions = await db.getSessions();
  const favorites = await db.getFavorites();
  const customTeas = await db.getCustomTeas();
  const presets = await db.getPresets();

  const backup = {
    version: 2,
    exportedAt: new Date().toISOString(),
    sessions,
    favorites,
    customTeas,
    presets
  };

  const json = JSON.stringify(backup, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `teatimer-backup-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Импортировать сессии из JSON
 */
async function importSessions(file) {
  const text = await file.text();
  const backup = JSON.parse(text);

  // Валидация версии
  if (backup.version !== 2) {
    alert('Несовместимая версия резервной копии');
    return;
  }

  // Импортировать каждое хранилище
  for (const session of backup.sessions || []) {
    await db.saveSession(session);
  }

  for (const teaId of backup.favorites || []) {
    await db.toggleFavorite(teaId);
  }

  for (const tea of backup.customTeas || []) {
    await db.saveCustomTea(tea);
  }

  for (const preset of backup.presets || []) {
    await db.savePreset(preset);
  }

  alert(`✅ Импортирован: ${backup.sessions.length} сессий, ${backup.favorites.length} избранных`);
}

// ============================================
// ГОТОВО К ИНТЕГРАЦИИ
// ============================================

console.log('🍵 TeaTimer v2.0 — Implementation Code Loaded');
console.log('Функции для использования:');
console.log('  - renderTimerV2()');
console.log('  - updateTimerAnimation(remaining, total)');
console.log('  - getSessionStatistics(days)');
console.log('  - analyzeSessionQuality(session)');
console.log('  - getScenarioRecommendations(teaId)');
console.log('  - exportSessions()');
console.log('  - importSessions(file)');
