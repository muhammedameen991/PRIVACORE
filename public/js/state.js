const KEYS = {
  FAVORITES: 'privacore:favorites:v1',
  RECENT: 'privacore:recent:v1',
  SETTINGS: 'privacore:settings:v1',
  CHECKLISTS: 'privacore:checklists:v1',
  NOTES: 'privacore:notes:v1',
  TIMER: 'privacore:timer:v1'
};

const DEFAULT_SETTINGS = {
  theme: 'dark',
  reducedMotion: false
};

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function getSettings() {
  const saved = readJson(KEYS.SETTINGS, {});
  return { ...DEFAULT_SETTINGS, ...saved };
}

export function updateSettings(partial) {
  const next = { ...getSettings(), ...partial };
  writeJson(KEYS.SETTINGS, next);
  applySettings(next);
  return next;
}

export function applySettings(settings = getSettings()) {
  document.documentElement.setAttribute('data-theme', settings.theme === 'light' ? 'light' : 'dark');
  document.documentElement.setAttribute('data-motion', settings.reducedMotion ? 'reduced' : 'default');
}

export function getFavorites() {
  const list = readJson(KEYS.FAVORITES, []);
  return Array.isArray(list) ? list : [];
}

export function isFavorite(toolId) {
  return getFavorites().includes(toolId);
}

export function toggleFavorite(toolId) {
  const current = new Set(getFavorites());
  if (current.has(toolId)) {
    current.delete(toolId);
  } else {
    current.add(toolId);
  }
  const next = Array.from(current);
  writeJson(KEYS.FAVORITES, next);
  return next;
}

export function getRecentTools() {
  const list = readJson(KEYS.RECENT, []);
  return Array.isArray(list) ? list : [];
}

export function recordRecentTool(toolId) {
  const existing = getRecentTools().filter((item) => item.id !== toolId);
  existing.unshift({ id: toolId, visitedAt: new Date().toISOString() });
  const trimmed = existing.slice(0, 12);
  writeJson(KEYS.RECENT, trimmed);
  return trimmed;
}

export function getChecklistState(checklistId) {
  const all = readJson(KEYS.CHECKLISTS, {});
  return Array.isArray(all[checklistId]) ? all[checklistId] : [];
}

export function setChecklistState(checklistId, checkedIds) {
  const all = readJson(KEYS.CHECKLISTS, {});
  all[checklistId] = checkedIds;
  writeJson(KEYS.CHECKLISTS, all);
}

export function getNotesData() {
  return readJson(KEYS.NOTES, { mode: 'plain', content: '', updatedAt: null });
}

export function saveNotesData(payload) {
  writeJson(KEYS.NOTES, payload);
}

export function getTimerSettings() {
  return readJson(KEYS.TIMER, { minutes: 25, soundEnabled: true });
}

export function saveTimerSettings(data) {
  writeJson(KEYS.TIMER, data);
}

export function exportAllLocalData() {
  return {
    exportedAt: new Date().toISOString(),
    favorites: getFavorites(),
    recent: getRecentTools(),
    settings: getSettings(),
    checklists: readJson(KEYS.CHECKLISTS, {}),
    timer: getTimerSettings(),
    notesMetadata: {
      mode: getNotesData().mode,
      hasContent: Boolean(getNotesData().content),
      updatedAt: getNotesData().updatedAt
    }
  };
}

export function clearAllLocalData() {
  Object.values(KEYS).forEach((k) => {
    try {
      localStorage.removeItem(k);
    } catch {
      // ignore
    }
  });
  applySettings(DEFAULT_SETTINGS);
}

export function resetSettingsOnly() {
  writeJson(KEYS.SETTINGS, DEFAULT_SETTINGS);
  applySettings(DEFAULT_SETTINGS);
  return DEFAULT_SETTINGS;
}
