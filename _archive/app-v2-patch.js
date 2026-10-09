// ============================================
// v2.0 — Timer Animation Functions
// ============================================

function updateTimerAnimation(remaining, total) {
  const container = document.querySelector('.timer-dial');
  if (!container) return;

  const progressPercent = Math.max(0, (total - remaining) / total);
  
  // Determine stage
  if (remaining < 10) {
    container.classList.add('finalStage');
    container.classList.remove('midStage', 'earlyStage');
  } else if (remaining < total / 2) {
    container.classList.add('midStage');
    container.classList.remove('finalStage', 'earlyStage');
  } else {
    container.classList.add('earlyStage');
    container.classList.remove('finalStage', 'midStage');
  }

  // Update glow
  const glowEffect = container.querySelector('.glow-effect');
  if (glowEffect) {
    const glowIntensity = 0.2 + (progressPercent * 0.4);
    glowEffect.style.setProperty('--glow-intensity', glowIntensity);
  }

  // Update progress ring
  const progressFill = container.querySelector('.progress-ring .progress-fill');
  if (progressFill) {
    const circumference = 534.07;
    const offset = circumference * (1 - progressPercent);
    progressFill.style.strokeDashoffset = offset;
  }
}

function getBrewPhaseText(remaining, total) {
  const percent = (total - remaining) / total;
  if (percent < 0.2) return '☕ Вода нагревается...';
  if (percent < 0.4) return '🫖 Чай раскрывается...';
  if (percent < 0.6) return '🌊 Настой поднимается...';
  if (percent < 0.8) return '✨ Вкус стабилизируется...';
  if (percent < 0.95) return '⏰ Почти готов...';
  return '🔔 Слил!';
}

function handleTimerComplete() {
  state.timerRunning = false;
  if (state.timerInterval) clearInterval(state.timerInterval);

  if (state.settings.sound_enabled) {
    audioManager.play('gong');
  }
  if (state.settings.vibration_enabled && navigator.vibrate) {
    navigator.vibrate([200, 100, 200]);
  }

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

  setTimeout(() => {
    if (modal.parentNode) modal.remove();
  }, 5000);
}
