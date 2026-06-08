const KRAEPELIN_DURATION = 180;
const REST_DURATION = 60;
const BLOCK_DURATION = 30;
const CONDITION_DURATION = 240;

const CONDITIONS = {
  1: {
    label: "条件1",
    summary: "安静のみ",
    steps: ["安静", "安静", "安静", "安静", "安静", "安静"],
  },
  2: {
    label: "条件2",
    summary: "香りを4ブロック連続",
    steps: ["安静", "香り", "香り", "香り", "香り", "安静"],
  },
  3: {
    label: "条件3",
    summary: "香りのあと安静を3ブロック",
    steps: ["安静", "香り", "安静", "安静", "安静", "安静"],
  },
  4: {
    label: "条件4",
    summary: "安静を挟んで香りを再提示",
    steps: ["安静", "香り", "安静", "香り", "安静", "安静"],
  },
};

const PATTERNS = {
  A: [3, 1, 4, 2],
  B: [2, 4, 1, 3],
  C: [4, 2, 3, 1],
  D: [1, 3, 2, 4],
  E: [3, 4, 2, 1],
  F: [2, 1, 4, 3],
  G: [4, 3, 1, 2],
  H: [1, 4, 3, 2],
};

const STORAGE_KEYS = {
  draft: "nioi-main-timing-draft-v1",
  history: "nioi-main-timing-history-v1",
};

const refs = {
  setupPanel: document.getElementById("setupPanel"),
  sessionLabel: document.getElementById("sessionLabel"),
  patternButtons: document.getElementById("patternButtons"),
  patternSummary: document.getElementById("patternSummary"),
  orderStrip: document.getElementById("orderStrip"),
  progressBadge: document.getElementById("progressBadge"),
  runningLogCount: document.getElementById("runningLogCount"),
  recordsList: document.getElementById("recordsList"),
  currentRoundPanel: document.getElementById("currentRoundPanel"),
  roundTitle: document.getElementById("roundTitle"),
  stepChips: document.getElementById("stepChips"),
  scheduleForm: document.getElementById("scheduleForm"),
  primaryTimeLabel: document.getElementById("primaryTimeLabel"),
  primaryMinutesInput: document.getElementById("primaryMinutesInput"),
  primarySecondsInput: document.getElementById("primarySecondsInput"),
  breathingTimeGroup: document.getElementById("breathingTimeGroup"),
  breathingMinutesInput: document.getElementById("breathingMinutesInput"),
  breathingSecondsInput: document.getElementById("breathingSecondsInput"),
  helperText: document.getElementById("helperText"),
  scheduleCards: document.getElementById("scheduleCards"),
  roundNote: document.getElementById("roundNote"),
  saveRoundButton: document.getElementById("saveRoundButton"),
  undoButton: document.getElementById("undoButton"),
  resetButton: document.getElementById("resetButton"),
  activeRoundControls: document.getElementById("activeRoundControls"),
  finalPanel: document.getElementById("finalPanel"),
  finalBadge: document.getElementById("finalBadge"),
  exportCsvButton: document.getElementById("exportCsvButton"),
  newSessionButton: document.getElementById("newSessionButton"),
  saveStatus: document.getElementById("saveStatus"),
  historyList: document.getElementById("historyList"),
  clearHistoryButton: document.getElementById("clearHistoryButton"),
};

let state = normalizeState(loadDraft());
let historyEntries = loadHistory();

bindEvents();
render();

function bindEvents() {
  refs.sessionLabel.addEventListener("input", (event) => {
    state.sessionLabel = event.target.value;
    state.historySaved = false;
    persistDraft();
    render();
  });

  refs.scheduleForm.addEventListener("submit", (event) => {
    event.preventDefault();
    createSchedule();
  });

  refs.roundNote.addEventListener("input", (event) => {
    state.currentRoundNote = event.target.value;
    persistDraft();
  });

  refs.saveRoundButton.addEventListener("click", saveCurrentRound);
  refs.undoButton.addEventListener("click", undoLastRound);
  refs.resetButton.addEventListener("click", resetSessionWithConfirm);
  refs.exportCsvButton.addEventListener("click", exportCsv);
  refs.newSessionButton.addEventListener("click", resetSessionWithConfirm);
  refs.clearHistoryButton.addEventListener("click", clearHistoryWithConfirm);

  refs.historyList.addEventListener("click", (event) => {
    const target = event.target.closest("button[data-action]");
    const preview = event.target.closest("[data-action='close-preview']");
    if (preview) {
      const details = preview.closest("details");
      if (details) {
        details.open = false;
      }
      return;
    }

    if (!target) {
      return;
    }

    const entryId = target.dataset.entryId;
    if (!entryId) {
      return;
    }

    const entry = historyEntries.find((item) => item.id === entryId);
    if (!entry) {
      return;
    }

    if (target.dataset.action === "copy") {
      copyText(entry.memoText, "保存済みメモをコピーしました。");
      return;
    }

    if (target.dataset.action === "export") {
      exportCsvForSession(entry, "履歴のCSVを書き出しました。");
      return;
    }

    if (target.dataset.action === "delete") {
      deleteHistoryEntry(entryId);
    }
  });
}

function createInitialState() {
  return {
    sessionLabel: "",
    pattern: "",
    currentIndex: 0,
    currentPrimaryMinutes: "",
    currentPrimarySeconds: "",
    currentBreathingMinutes: "",
    currentBreathingSeconds: "",
    currentSchedule: null,
    currentRoundNote: "",
    sessionNote: "",
    records: [],
    historySaved: false,
    historyEntryId: "",
    historySyncSuppressed: false,
  };
}

function loadDraft() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.draft);
    return raw ? { ...createInitialState(), ...JSON.parse(raw) } : createInitialState();
  } catch (_error) {
    return createInitialState();
  }
}

function loadHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.history);
    return raw ? JSON.parse(raw).map(normalizeHistoryEntry) : [];
  } catch (_error) {
    return [];
  }
}

function normalizeState(candidate) {
  const next = { ...createInitialState(), ...candidate };
  if (next.pattern && !PATTERNS[next.pattern]) {
    next.pattern = "";
  }
  next.records = Array.isArray(next.records)
    ? next.records.map((record, index) => normalizeRecord(record, index))
    : [];
  next.currentSchedule = normalizeCurrentSchedule(next.currentSchedule);
  next.currentIndex = next.records.length;
  next.historyEntryId = typeof next.historyEntryId === "string" ? next.historyEntryId : "";
  next.historySyncSuppressed = Boolean(next.historySyncSuppressed);
  return next;
}

function normalizeHistoryEntry(entry) {
  const records = Array.isArray(entry.records)
    ? entry.records.map((record, index) => normalizeRecord(record, index))
    : [];
  return {
    ...entry,
    records,
    memoText: buildMemoText({
      sessionLabel: entry.sessionLabel || "",
      pattern: entry.pattern,
      records,
      sessionNote: entry.sessionNote || "",
      savedAt: entry.savedAt,
    }),
  };
}

function normalizeRecord(record, index) {
  if (record.stageType === "intro" || Number.isFinite(record.kraepelinStartTotalSeconds)) {
    const kraepelinStartTotalSeconds = Number.isFinite(record.kraepelinStartTotalSeconds)
      ? record.kraepelinStartTotalSeconds
      : 0;
    const cards = normalizeCards(record.cards || record.schedule, "intro", null, {
      kraepelinStartTotalSeconds,
    });
    const segments = Array.isArray(record.segments)
      ? record.segments.map(normalizeSegment)
      : buildIntroSegments(kraepelinStartTotalSeconds);
    return {
      stageType: "intro",
      roundNumber: 0,
      label: "導入",
      summary: "香り提示・主観評価・クレペリンテスト",
      kraepelinStartTotalSeconds,
      kraepelinStartDisplay: formatTime(kraepelinStartTotalSeconds),
      cards,
      segments,
      roundNote: record.roundNote || "",
    };
  }

  const conditionId = Number(record.conditionId) || 1;
  const conditionStartTotalSeconds = Number.isFinite(record.conditionStartTotalSeconds)
    ? record.conditionStartTotalSeconds
    : 0;
  const cards = normalizeCards(record.cards || record.schedule, "condition", conditionId, {
    conditionStartTotalSeconds,
  });
  const segments = Array.isArray(record.segments)
    ? record.segments.map(normalizeSegment)
    : buildConditionSegments(conditionId, conditionStartTotalSeconds);
  return {
    stageType: "condition",
    roundNumber: Number(record.roundNumber) || index,
    conditionId,
    summary: CONDITIONS[conditionId]?.summary || record.summary || "",
    conditionStartTotalSeconds,
    conditionStartDisplay: formatTime(conditionStartTotalSeconds),
    conditionEndTotalSeconds: conditionStartTotalSeconds + CONDITION_DURATION,
    cards,
    segments,
    roundNote: record.roundNote || "",
  };
}

function normalizeCards(cards, stageType, conditionId, fallback = {}) {
  if (Array.isArray(cards) && cards.length > 0) {
    return cards.map((card) => ({
      stepLabel: card.stepLabel || "",
      timeSeconds: Number.isFinite(card.timeSeconds) ? card.timeSeconds : 0,
      action: card.action || "",
      meta: card.meta || "",
      isEnd: Boolean(card.isEnd),
    }));
  }
  if (stageType === "intro") {
    return buildIntroCards(fallback.kraepelinStartTotalSeconds || 0);
  }
  return buildConditionCards(conditionId, fallback.conditionStartTotalSeconds || 0);
}

function normalizeSegment(segment) {
  return {
    segmentKind: segment.segmentKind || "",
    segmentLabel: segment.segmentLabel || "",
    action: segment.action || "",
    windowStartSeconds: Number.isFinite(segment.windowStartSeconds) ? segment.windowStartSeconds : 0,
    windowEndSeconds: Number.isFinite(segment.windowEndSeconds) ? segment.windowEndSeconds : 0,
    durationSeconds: Number.isFinite(segment.durationSeconds) ? segment.durationSeconds : 0,
  };
}

function normalizeCurrentSchedule(schedule) {
  if (!schedule || typeof schedule !== "object") {
    return null;
  }
  if (schedule.stageType === "intro" || Number.isFinite(schedule.kraepelinStartTotalSeconds)) {
    return buildIntroPlan(schedule.kraepelinStartTotalSeconds || 0);
  }
  const conditionId = Number(schedule.conditionId);
  if (Number.isFinite(conditionId)) {
    return buildConditionPlan(conditionId, schedule.conditionStartTotalSeconds || 0);
  }
  return null;
}

function persistDraft() {
  localStorage.setItem(STORAGE_KEYS.draft, JSON.stringify(state));
}

function persistHistory() {
  localStorage.setItem(STORAGE_KEYS.history, JSON.stringify(historyEntries));
}

function render() {
  renderPatternButtons();
  renderPatternSummary();
  renderProgress();
  renderCurrentRound();
  renderSchedule();
  renderRecords();
  syncCompletedSessionToHistory();
  renderFinalPanel();
  renderHistory();
  syncInputs();
}

function syncInputs() {
  refs.sessionLabel.value = state.sessionLabel;
  refs.primaryMinutesInput.value = state.currentPrimaryMinutes;
  refs.primarySecondsInput.value = state.currentPrimarySeconds;
  refs.breathingMinutesInput.value = "";
  refs.breathingSecondsInput.value = "";
  refs.roundNote.value = state.currentRoundNote;
}

function renderPatternButtons() {
  refs.patternButtons.innerHTML = Object.entries(PATTERNS)
    .map(([patternKey, order]) => {
      const isSelected = patternKey === state.pattern;
      return `
        <button
          type="button"
          class="pattern-button ${isSelected ? "selected" : ""}"
          data-pattern="${patternKey}"
          aria-pressed="${String(isSelected)}"
        >
          <strong>パターン${patternKey}</strong>
          <span>${order.map((id) => `条件${id}`).join(" → ")}</span>
        </button>
      `;
    })
    .join("");

  refs.patternButtons.querySelectorAll("[data-pattern]").forEach((button) => {
    button.addEventListener("click", () => {
      const patternKey = button.dataset.pattern;
      if (!patternKey || patternKey === state.pattern) {
        return;
      }
      if (shouldConfirmPatternChange()) {
        const shouldReset = window.confirm(
          "パターンを変更すると現在の進行中セッションを最初からやり直します。変更しますか？",
        );
        if (!shouldReset) {
          return;
        }
      }
      state = {
        ...createInitialState(),
        pattern: patternKey,
        sessionLabel: state.sessionLabel,
      };
      persistDraft();
      render();
    });
  });
}

function renderPatternSummary() {
  if (!hasSelectedPattern()) {
    refs.patternSummary.textContent = "未選択: 上でパターンを選んでください。";
    refs.orderStrip.innerHTML = "";
    return;
  }

  const order = PATTERNS[state.pattern].map((id) => `条件${id}`).join(" → ");
  refs.patternSummary.textContent = `選択中: パターン${state.pattern}（導入 → ${order}）`;
  refs.orderStrip.innerHTML = buildStageOrderItems()
    .map((item, index) => {
      const classes = ["order-pill"];
      if (index < state.currentIndex) {
        classes.push("done");
      } else if (index === state.currentIndex && !isComplete()) {
        classes.push("current");
      }
      return `<span class="${classes.join(" ")}">${item}</span>`;
    })
    .join("");
}

function renderProgress() {
  refs.progressBadge.textContent = `${state.records.length} / ${getTotalStageCount()} 完了`;
  refs.runningLogCount.textContent = `${state.records.length} 件`;
}

function renderCurrentRound() {
  if (!hasSelectedPattern()) {
    refs.roundTitle.textContent = "パターンを選んでください";
    refs.stepChips.innerHTML = `<span class="action-chip complete">上でパターンを選択</span>`;
    return;
  }

  if (isComplete()) {
    refs.roundTitle.textContent = `導入 + ${PATTERNS[state.pattern].length}条件が完了しました`;
    refs.stepChips.innerHTML = `
      <span class="action-chip complete">クレペリン 1回 完了</span>
      <span class="action-chip complete">${PATTERNS[state.pattern].length}条件 完了</span>
    `;
    return;
  }

  const stage = getCurrentStageInfo();
  if (!stage) {
    return;
  }

  if (stage.stageType === "intro") {
    refs.roundTitle.textContent = "導入 / 香り提示・評価・クレペリン";
    refs.stepChips.innerHTML = `
      <span class="action-chip fragrance">香り提示</span>
      <span class="action-chip complete">VAS・眠気尺度・RT</span>
      <span class="action-chip complete">クレペリン 3分</span>
    `;
    return;
  }

  const condition = CONDITIONS[stage.conditionId];
  refs.roundTitle.textContent = `${stage.roundNumber}回目 / ${condition.label}`;
  refs.stepChips.innerHTML = condition.steps
    .map((action, index) => {
      const label = index === 0 ? "0-60秒" : index === 5 ? "180-240秒" : `${60 + (index - 1) * 30}-${90 + (index - 1) * 30}秒`;
      return `<span class="action-chip ${getActionClassName(action)}">${label} ${action}</span>`;
    })
    .join("");
}

function renderSchedule() {
  const stage = getCurrentStageInfo();
  const patternSelected = hasSelectedPattern();
  const hasSchedule = Boolean(state.currentSchedule);

  refs.saveRoundButton.disabled = !hasSchedule || !patternSelected;
  refs.saveRoundButton.textContent =
    stage?.stageType === "intro" ? "導入を記録して条件へ" : "この条件を記録して次へ";
  refs.undoButton.disabled = state.records.length === 0;
  refs.finalBadge.textContent = patternSelected
    ? `導入 + ${PATTERNS[state.pattern].length}条件完了`
    : "導入 + 4条件完了";
  refs.breathingTimeGroup.hidden = true;

  if (refs.activeRoundControls) {
    refs.activeRoundControls.hidden = isComplete() || !patternSelected;
  }

  if (!patternSelected) {
    refs.primaryTimeLabel.textContent = "クレペリン開始時刻";
    refs.scheduleCards.innerHTML = `<div class="empty-state">まず上でパターンを選んでください。</div>`;
    refs.helperText.textContent = "空欄は 0 として扱います。";
    return;
  }

  if (isComplete()) {
    refs.scheduleCards.innerHTML = `<div class="empty-state">導入と${PATTERNS[state.pattern].length}条件が完了しました。CSVを書き出せます。</div>`;
    refs.helperText.textContent = "必要なら完了メモに全体メモを追記できます。";
    return;
  }

  refs.primaryTimeLabel.textContent =
    stage?.stageType === "intro" ? "クレペリン開始時刻" : "条件開始時刻（最初の安静開始）";

  if (!hasSchedule) {
    refs.scheduleCards.innerHTML = `
      <div class="empty-state">
        ${
          stage?.stageType === "intro"
            ? "香り提示、VAS、スタンフォード眠気尺度、視覚・聴覚RT後に、クレペリン開始時刻を入れてください。"
            : "条件開始時刻を入れると、安静60秒・4ブロック・安静60秒の指示時刻を表示します。"
        }
      </div>
    `;
    refs.helperText.textContent =
      stage?.stageType === "intro"
        ? "クレペリン開始時刻を入力してください。"
        : "条件開始時刻を入力してください。";
    return;
  }

  refs.scheduleCards.innerHTML = state.currentSchedule.cards
    .map(
      (item) => `
        <article class="schedule-card">
          <div class="schedule-step">${item.stepLabel}</div>
          <div>
            <div class="schedule-time">${formatTimeShort(item.timeSeconds)}</div>
            <div class="schedule-meta">${item.meta}</div>
          </div>
        </article>
      `,
    )
    .join("");

  refs.helperText.textContent =
    state.currentSchedule.stageType === "intro"
      ? `クレペリンテストを ${formatTimeShort(state.currentSchedule.kraepelinStartTotalSeconds)} から3分間行います。導入の主観評価とRTはメモ欄で補足できます。`
      : `${CONDITIONS[state.currentSchedule.conditionId].label} は ${formatTimeShort(state.currentSchedule.conditionStartTotalSeconds)} から4分間です。`;
}

function renderRecords() {
  if (state.records.length === 0) {
    refs.recordsList.innerHTML = `<div class="empty-state">まだ記録はありません。導入から始めてください。</div>`;
    return;
  }

  refs.recordsList.innerHTML = state.records
    .map((record) => {
      const timeline = record.cards
        .map(
          (item) => `
            <div class="timeline-row">
              <strong>${formatTimeShort(item.timeSeconds)}</strong>
              <span>${item.action}</span>
            </div>
          `,
        )
        .join("");
      const noteHtml = record.roundNote
        ? `<div class="record-note">${escapeHtml(record.roundNote)}</div>`
        : "";
      return `
        <article class="record-card">
          <div class="record-header">
            <div>
              <h3 class="record-title">${getRecordTitle(record)}</h3>
              <p class="record-subtitle">${getRecordSubtitle(record)}</p>
            </div>
            <span class="badge-soft">${getRecordBadge(record)}</span>
          </div>
          <div class="record-timeline">${timeline}</div>
          ${noteHtml}
        </article>
      `;
    })
    .join("");
}

function renderFinalPanel() {
  const complete = isComplete();
  refs.finalPanel.hidden = !complete;
  refs.saveStatus.textContent = state.historySyncSuppressed
    ? "このセッションの履歴は削除されています。"
    : state.historySaved
      ? "このセッションは履歴へ自動保存済みです。"
      : "最後の記録完了時に履歴へ自動保存されます。";
}

function renderHistory() {
  if (historyEntries.length === 0) {
    refs.historyList.innerHTML = `<div class="empty-state">まだ保存済み履歴はありません。</div>`;
    return;
  }

  refs.historyList.innerHTML = historyEntries
    .map((entry) => {
      const title = entry.sessionLabel
        ? escapeHtml(entry.sessionLabel)
        : `パターン${entry.pattern} / ${formatDate(entry.savedAt)}`;
      const patternOrder = PATTERNS[entry.pattern]?.map((id) => `条件${id}`).join(" → ") || "";
      return `
        <article class="history-card">
          <div class="history-header">
            <div>
              <h3 class="history-title">${title}</h3>
              <p class="history-subtitle">パターン${entry.pattern}（${patternOrder}）</p>
              <p class="history-subtitle">保存日時: ${formatDate(entry.savedAt)}</p>
            </div>
            <span class="badge-soft">${entry.records.length} 記録</span>
          </div>
          <div class="history-actions">
            <button type="button" data-action="copy" data-entry-id="${entry.id}">メモをコピー</button>
            <button type="button" data-action="export" data-entry-id="${entry.id}">CSVを書き出す</button>
            <button type="button" class="danger" data-action="delete" data-entry-id="${entry.id}">この履歴を削除</button>
          </div>
          <details>
            <summary>内容を見る</summary>
            <div class="history-preview" data-action="close-preview">
              <pre class="memo-output">${escapeHtml(entry.memoText)}</pre>
              <p class="history-preview-hint">このメモをタップすると閉じます</p>
            </div>
          </details>
        </article>
      `;
    })
    .join("");
}

function createSchedule() {
  if (!hasSelectedPattern() || isComplete()) {
    return;
  }

  const stage = getCurrentStageInfo();
  const primaryResult = parseTimeInput(
    refs.primaryMinutesInput.value.trim(),
    refs.primarySecondsInput.value.trim(),
  );

  if (!primaryResult.valid) {
    refs.helperText.textContent = primaryResult.message;
    state.currentSchedule = null;
    persistDraft();
    renderSchedule();
    return;
  }

  state.currentPrimaryMinutes = refs.primaryMinutesInput.value.trim();
  state.currentPrimarySeconds = refs.primarySecondsInput.value.trim();
  state.currentBreathingMinutes = "";
  state.currentBreathingSeconds = "";
  state.currentSchedule =
    stage.stageType === "intro"
      ? buildIntroPlan(primaryResult.totalSeconds)
      : buildConditionPlan(stage.conditionId, primaryResult.totalSeconds);
  state.historySaved = false;
  state.historySyncSuppressed = false;
  persistDraft();
  render();
}

function buildIntroPlan(kraepelinStartTotalSeconds) {
  return {
    stageType: "intro",
    kraepelinStartTotalSeconds,
    cards: buildIntroCards(kraepelinStartTotalSeconds),
    segments: buildIntroSegments(kraepelinStartTotalSeconds),
  };
}

function buildConditionPlan(conditionId, conditionStartTotalSeconds) {
  return {
    stageType: "condition",
    conditionId,
    conditionStartTotalSeconds,
    conditionEndTotalSeconds: conditionStartTotalSeconds + CONDITION_DURATION,
    cards: buildConditionCards(conditionId, conditionStartTotalSeconds),
    segments: buildConditionSegments(conditionId, conditionStartTotalSeconds),
  };
}

function buildIntroCards(kraepelinStartTotalSeconds) {
  return [
    {
      stepLabel: "Start",
      timeSeconds: kraepelinStartTotalSeconds,
      action: "クレペリン開始",
      meta: "開始",
    },
    {
      stepLabel: "+180秒",
      timeSeconds: kraepelinStartTotalSeconds + KRAEPELIN_DURATION,
      action: "クレペリン終了",
      meta: "終了",
      isEnd: true,
    },
  ];
}

function buildIntroSegments(kraepelinStartTotalSeconds) {
  return [
    {
      segmentKind: "kraepelin",
      segmentLabel: "クレペリンテスト 3分",
      action: "クレペリンテスト",
      windowStartSeconds: kraepelinStartTotalSeconds,
      windowEndSeconds: kraepelinStartTotalSeconds + KRAEPELIN_DURATION,
      durationSeconds: KRAEPELIN_DURATION,
    },
  ];
}

function buildConditionCards(conditionId, conditionStartTotalSeconds) {
  const condition = CONDITIONS[conditionId];
  const cards = [
    {
      stepLabel: "0秒",
      timeSeconds: conditionStartTotalSeconds,
      action: "安静開始",
      meta: "安静",
    },
  ];

  condition.steps.slice(1, 5).forEach((action, index) => {
    const offset = REST_DURATION + index * BLOCK_DURATION;
    cards.push({
      stepLabel: `+${offset}秒`,
      timeSeconds: conditionStartTotalSeconds + offset,
      action,
      meta: action,
    });
  });

  cards.push(
    {
      stepLabel: "+180秒",
      timeSeconds: conditionStartTotalSeconds + 180,
      action: "安静開始",
      meta: "安静",
    },
    {
      stepLabel: "+240秒",
      timeSeconds: conditionStartTotalSeconds + CONDITION_DURATION,
      action: "終了",
      meta: "終了",
      isEnd: true,
    },
  );

  return cards;
}

function buildConditionSegments(conditionId, conditionStartTotalSeconds) {
  const condition = CONDITIONS[conditionId];
  return [
    buildSegment("pre_rest", "0-60秒", "安静", conditionStartTotalSeconds, REST_DURATION),
    ...condition.steps.slice(1, 5).map((action, index) => {
      const offset = REST_DURATION + index * BLOCK_DURATION;
      return buildSegment(
        "odor_block",
        `${offset}-${offset + BLOCK_DURATION}秒`,
        action,
        conditionStartTotalSeconds + offset,
        BLOCK_DURATION,
      );
    }),
    buildSegment("post_rest", "180-240秒", "安静", conditionStartTotalSeconds + 180, REST_DURATION),
    buildSegment("condition_end", "終了", "終了", conditionStartTotalSeconds + CONDITION_DURATION, 0),
  ];
}

function buildSegment(segmentKind, segmentLabel, action, startSeconds, durationSeconds) {
  return {
    segmentKind,
    segmentLabel,
    action,
    windowStartSeconds: startSeconds,
    windowEndSeconds: startSeconds + durationSeconds,
    durationSeconds,
  };
}

function saveCurrentRound() {
  if (!state.currentSchedule || isComplete()) {
    return;
  }

  const stage = getCurrentStageInfo();
  const roundNote = state.currentRoundNote.trim();
  const record =
    state.currentSchedule.stageType === "intro"
      ? {
          stageType: "intro",
          roundNumber: 0,
          label: "導入",
          summary: "香り提示・主観評価・クレペリンテスト",
          kraepelinStartTotalSeconds: state.currentSchedule.kraepelinStartTotalSeconds,
          kraepelinStartDisplay: formatTime(state.currentSchedule.kraepelinStartTotalSeconds),
          cards: clone(state.currentSchedule.cards),
          segments: clone(state.currentSchedule.segments),
          roundNote,
        }
      : {
          stageType: "condition",
          roundNumber: stage.roundNumber,
          conditionId: state.currentSchedule.conditionId,
          summary: CONDITIONS[state.currentSchedule.conditionId].summary,
          conditionStartTotalSeconds: state.currentSchedule.conditionStartTotalSeconds,
          conditionStartDisplay: formatTime(state.currentSchedule.conditionStartTotalSeconds),
          conditionEndTotalSeconds: state.currentSchedule.conditionEndTotalSeconds,
          cards: clone(state.currentSchedule.cards),
          segments: clone(state.currentSchedule.segments),
          roundNote,
        };

  state.records = [...state.records, record];
  state.currentIndex = state.records.length;
  state.currentPrimaryMinutes = "";
  state.currentPrimarySeconds = "";
  state.currentBreathingMinutes = "";
  state.currentBreathingSeconds = "";
  state.currentSchedule = null;
  state.currentRoundNote = "";
  state.historySaved = false;
  state.historySyncSuppressed = false;
  persistDraft();
  render();
  scrollToCurrentRoundFocus();
}

function undoLastRound() {
  if (state.records.length === 0) {
    return;
  }
  if (!window.confirm("直前の記録を取り消しますか？")) {
    return;
  }

  const previous = state.records[state.records.length - 1];
  removeLinkedHistoryEntry();
  state.records = state.records.slice(0, -1);
  state.currentIndex = state.records.length;
  state.currentRoundNote = previous.roundNote || "";
  state.historySaved = false;
  state.historyEntryId = "";
  state.historySyncSuppressed = false;

  if (previous.stageType === "intro") {
    state.currentPrimaryMinutes = Math.floor(previous.kraepelinStartTotalSeconds / 60).toString();
    state.currentPrimarySeconds = String(previous.kraepelinStartTotalSeconds % 60).padStart(2, "0");
    state.currentSchedule = buildIntroPlan(previous.kraepelinStartTotalSeconds);
  } else {
    state.currentPrimaryMinutes = Math.floor(previous.conditionStartTotalSeconds / 60).toString();
    state.currentPrimarySeconds = String(previous.conditionStartTotalSeconds % 60).padStart(2, "0");
    state.currentSchedule = buildConditionPlan(previous.conditionId, previous.conditionStartTotalSeconds);
  }

  persistDraft();
  render();
  scrollToCurrentRoundFocus();
}

function resetSessionWithConfirm() {
  if (hasDraftContent() && !window.confirm("現在の進行中セッションを消して、最初からやり直しますか？")) {
    return;
  }
  state = createInitialState();
  persistDraft();
  render();
  scrollToSetupFocus();
}

function clearHistoryWithConfirm() {
  if (historyEntries.length === 0 || !window.confirm("保存済み履歴をすべて削除しますか？")) {
    return;
  }
  historyEntries = [];
  state.historySaved = false;
  state.historyEntryId = "";
  state.historySyncSuppressed = isComplete();
  persistHistory();
  persistDraft();
  render();
}

function deleteHistoryEntry(entryId) {
  if (!window.confirm("この履歴を削除しますか？")) {
    return;
  }
  historyEntries = historyEntries.filter((entry) => entry.id !== entryId);
  if (state.historyEntryId === entryId) {
    state.historySaved = false;
    state.historyEntryId = "";
    state.historySyncSuppressed = isComplete();
    persistDraft();
  }
  persistHistory();
  render();
}

function hasDraftContent() {
  return Boolean(
    state.records.length > 0 ||
      state.currentSchedule ||
      state.currentPrimaryMinutes ||
      state.currentPrimarySeconds ||
      state.currentRoundNote.trim() ||
      state.sessionLabel.trim(),
  );
}

function shouldConfirmPatternChange() {
  return Boolean(
    hasSelectedPattern() &&
      (state.records.length > 0 ||
        state.currentSchedule ||
        state.currentPrimaryMinutes ||
        state.currentPrimarySeconds ||
        state.currentRoundNote.trim()),
  );
}

function getTotalStageCount() {
  return hasSelectedPattern() ? 1 + PATTERNS[state.pattern].length : 5;
}

function buildStageOrderItems() {
  if (!hasSelectedPattern()) {
    return [];
  }
  return [
    "導入",
    ...PATTERNS[state.pattern].map((conditionId, index) => `${index + 1}回目 条件${conditionId}`),
  ];
}

function getCurrentStageInfo() {
  if (!hasSelectedPattern()) {
    return null;
  }
  if (state.currentIndex === 0) {
    return { stageType: "intro" };
  }
  const conditionIndex = state.currentIndex - 1;
  const conditionId = PATTERNS[state.pattern][conditionIndex];
  return conditionId
    ? { stageType: "condition", roundNumber: state.currentIndex, conditionId }
    : null;
}

function hasSelectedPattern() {
  return Boolean(state.pattern && PATTERNS[state.pattern]);
}

function isComplete() {
  return hasSelectedPattern() && state.records.length >= getTotalStageCount();
}

function syncCompletedSessionToHistory() {
  if (!isComplete() || state.historySyncSuppressed) {
    return;
  }
  const existingIndex = historyEntries.findIndex((entry) => entry.id === state.historyEntryId);
  const existingEntry = existingIndex >= 0 ? historyEntries[existingIndex] : null;
  const savedAt = existingEntry?.savedAt ?? Date.now();
  const entryId = existingEntry?.id || state.historyEntryId || createId();
  const entry = buildHistoryEntry(savedAt, entryId);
  if (existingIndex >= 0) {
    historyEntries[existingIndex] = entry;
  } else {
    historyEntries = [entry, ...historyEntries];
  }
  state.historyEntryId = entry.id;
  state.historySaved = true;
  persistHistory();
  persistDraft();
}

function removeLinkedHistoryEntry() {
  if (!state.historyEntryId) {
    return;
  }
  historyEntries = historyEntries.filter((entry) => entry.id !== state.historyEntryId);
  state.historySaved = false;
  state.historyEntryId = "";
  persistHistory();
}

function buildHistoryEntry(savedAt, entryId) {
  const records = state.records.map((record, index) => normalizeRecord(record, index));
  const memoText = buildMemoText({
    sessionLabel: state.sessionLabel,
    pattern: state.pattern,
    records,
    sessionNote: state.sessionNote,
    savedAt,
  });
  return {
    id: entryId,
    sessionLabel: state.sessionLabel.trim(),
    pattern: state.pattern,
    records: clone(records),
    sessionNote: state.sessionNote.trim(),
    savedAt,
    memoText,
  };
}

function buildMemoText(session) {
  const lines = [];
  if (session.sessionLabel.trim()) {
    lines.push(`セッション名: ${session.sessionLabel.trim()}`);
  }
  const patternOrder = PATTERNS[session.pattern]?.map((id) => `条件${id}`).join(" → ") || "";
  lines.push(patternOrder ? `パターン${session.pattern}: ${patternOrder}` : `パターン${session.pattern}`);
  lines.push(`作成日時: ${formatDate(session.savedAt)}`);
  lines.push("");

  session.records.forEach((record) => {
    lines.push(getRecordTitle(record));
    lines.push(record.stageType === "intro"
      ? `クレペリン開始: ${record.kraepelinStartDisplay}`
      : `条件開始: ${record.conditionStartDisplay}`);
    record.cards.forEach((item) => {
      lines.push(`${formatTime(item.timeSeconds)} ${item.action}`);
    });
    if (record.roundNote) {
      lines.push(`メモ: ${record.roundNote}`);
    }
    lines.push("");
  });

  if (session.sessionNote.trim()) {
    lines.push("全体メモ:");
    lines.push(session.sessionNote.trim());
  }
  return lines.join("\n").trim();
}

function getRecordTitle(record) {
  if (record.stageType === "intro") {
    return "導入 / 香り提示・評価・クレペリン";
  }
  return `${record.roundNumber}回目 / 条件${record.conditionId}`;
}

function getRecordSubtitle(record) {
  if (record.stageType === "intro") {
    return `クレペリン開始: ${formatTimeShort(record.kraepelinStartTotalSeconds)}`;
  }
  return `条件開始: ${formatTimeShort(record.conditionStartTotalSeconds)} / 終了: ${formatTimeShort(record.conditionEndTotalSeconds)}`;
}

function getRecordBadge(record) {
  return record.stageType === "intro" ? "クレペリン 3分" : record.summary || "";
}

function exportCsv() {
  if (!isComplete()) {
    refs.saveStatus.textContent = "完了後にCSVを書き出せます。";
    return;
  }
  exportCsvForSession(
    {
      sessionLabel: state.sessionLabel,
      pattern: state.pattern,
      records: state.records,
    },
    "区間時刻つきのCSVを書き出しました。",
  );
}

function exportCsvForSession(session, successMessage) {
  const rows = buildExportRows(session);
  const csvText = toCsv(rows);
  const filename = createExportFilename(session);
  downloadTextFile(filename, csvText, "text/csv;charset=utf-8");
  refs.saveStatus.textContent = successMessage;
}

function buildExportRows(session) {
  return session.records.flatMap((record) =>
    record.segments.map((segment) => ({
      session_label: session.sessionLabel.trim(),
      experiment: "main",
      pattern: session.pattern,
      stage_label: getRecordTitle(record),
      round_number: record.stageType === "intro" ? 0 : record.roundNumber,
      condition_id: record.conditionId || "",
      condition_summary: record.stageType === "condition" ? record.summary : "",
      segment_kind: segment.segmentKind,
      segment_label: segment.segmentLabel,
      action: segment.action,
      window_start_real_seconds: segment.windowStartSeconds,
      window_end_real_seconds: segment.windowEndSeconds,
      window_start_display: formatTimeShort(segment.windowStartSeconds),
      window_end_display: formatTimeShort(segment.windowEndSeconds),
      duration_seconds: segment.durationSeconds,
      kraepelin_start_real_seconds:
        record.stageType === "intro" ? record.kraepelinStartTotalSeconds : "",
      condition_start_real_seconds:
        record.stageType === "condition" ? record.conditionStartTotalSeconds : "",
      condition_end_real_seconds:
        record.stageType === "condition" ? record.conditionEndTotalSeconds : "",
      note: record.roundNote || "",
    })),
  );
}

function toCsv(rows) {
  if (rows.length === 0) {
    return "";
  }
  const headers = Object.keys(rows[0]);
  const csvRows = [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => escapeCsvCell(row[header])).join(",")),
  ];
  return `\uFEFF${csvRows.join("\r\n")}`;
}

function escapeCsvCell(value) {
  const text = value == null ? "" : String(value);
  if (text.includes(",") || text.includes('"') || text.includes("\n") || text.includes("\r")) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

function createExportFilename(session) {
  const participantId = session.sessionLabel.trim()
    ? session.sessionLabel.trim().replace(/[\\/:*?"<>|]/g, "_")
    : "participant";
  return `Timer_${participantId}.csv`;
}

function downloadTextFile(filename, text, mimeType) {
  const blob = new Blob([text], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

function scrollToCurrentRoundFocus() {
  const target = refs.currentRoundPanel;
  if (!target) {
    return;
  }
  if (document.activeElement && typeof document.activeElement.blur === "function") {
    document.activeElement.blur();
  }
  target.setAttribute("tabindex", "-1");
  const scrollToTarget = () => {
    target.scrollIntoView({ behavior: "auto", block: "start" });
    target.focus({ preventScroll: false });
  };
  window.requestAnimationFrame(() => {
    scrollToTarget();
    window.setTimeout(scrollToTarget, 120);
    window.setTimeout(scrollToTarget, 360);
  });
}

function scrollToSetupFocus() {
  if (!refs.setupPanel) {
    return;
  }
  window.requestAnimationFrame(() => {
    refs.setupPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

function parseTimeInput(minutes, seconds) {
  const normalizedMinutes = minutes === "" ? "0" : minutes;
  const normalizedSeconds = seconds === "" ? "0" : seconds;
  const minuteValue = Number.parseInt(normalizedMinutes, 10);
  const secondValue = Number.parseInt(normalizedSeconds, 10);
  if (
    Number.isNaN(minuteValue) ||
    Number.isNaN(secondValue) ||
    minuteValue < 0 ||
    secondValue < 0 ||
    secondValue > 59
  ) {
    return { valid: false, message: "秒は 0〜59 の範囲で入力してください。" };
  }
  return { valid: true, totalSeconds: minuteValue * 60 + secondValue };
}

function formatTimeShort(totalSeconds) {
  const safeSeconds = Math.max(0, Number(totalSeconds) || 0);
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${minutes}：${String(seconds).padStart(2, "0")}`;
}

function formatTime(totalSeconds) {
  const safeSeconds = Math.max(0, Number(totalSeconds) || 0);
  return `${formatTimeShort(safeSeconds)}（${safeSeconds}）`;
}

function formatDate(timestamp) {
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(timestamp);
}

function createId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
  return `entry-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getActionClassName(action) {
  if (action === "安静") {
    return "rest";
  }
  if (action === "香り") {
    return "fragrance";
  }
  return "complete";
}

async function copyText(text, successMessage) {
  try {
    await navigator.clipboard.writeText(text);
    refs.saveStatus.textContent = successMessage;
  } catch (_error) {
    const fallback = document.createElement("textarea");
    fallback.value = text;
    fallback.setAttribute("readonly", "");
    fallback.style.position = "absolute";
    fallback.style.left = "-9999px";
    document.body.appendChild(fallback);
    fallback.select();
    document.execCommand("copy");
    document.body.removeChild(fallback);
    refs.saveStatus.textContent = successMessage;
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}
