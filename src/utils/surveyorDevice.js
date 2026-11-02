// Several surveyors may share one account: each phone is told apart by its own id and the name
// typed on it. Kept on the device (not removed at sign-out), so the name is only asked once.

const STORAGE_KEY = 'geocadastre_surveyor_device';
const MAX_NAME_LENGTH = 60;

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (typeof saved?.id === 'string') return saved;
  } catch {
    // Nothing valid stored
  }
  return null;
}

export function getSurveyorDeviceId() {
  const saved = load();
  if (saved) return saved.id;
  const id = crypto.randomUUID();
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ id, name: '' }));
  } catch {
    // Storage unavailable: the id lasts for this visit
  }
  return id;
}

export const getSurveyorName = () => load()?.name || '';

export function saveSurveyorName(name) {
  const clean = String(name).trim().slice(0, MAX_NAME_LENGTH);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ id: getSurveyorDeviceId(), name: clean }));
  } catch {
    // Storage unavailable: asked again next time
  }
  return clean;
}
