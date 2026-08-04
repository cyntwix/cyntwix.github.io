const ENTRY_KEY = 'cyntwixWritingEntries';
const SUBMISSION_URL = globalThis.CYNTWIX_SUBMISSION_URL || '';

const entryList = document.querySelector('#entry-list');
const entryDetail = document.querySelector('#entry-detail');
const params = new URLSearchParams(window.location.search);
const hashParams = new URLSearchParams(window.location.hash.slice(1));

let activeId = params.get('id');
let transferredEntry = null;
let entriesCache = [];

try {
  const incoming = JSON.parse(hashParams.get('entry') || '');
  if (incoming && typeof incoming.id === 'string' && typeof incoming.text === 'string') {
    transferredEntry = incoming;
    activeId = incoming.id;
  }
} catch {
  transferredEntry = null;
}

if (transferredEntry) {
  try {
    const stored = JSON.parse(localStorage.getItem(ENTRY_KEY) || '[]');
    const entries = Array.isArray(stored) ? stored : [];
    if (!entries.some((entry) => entry.id === transferredEntry.id)) {
      entries.unshift(transferredEntry);
      localStorage.setItem(ENTRY_KEY, JSON.stringify(entries));
    }
  } catch {
    // Keep the transferred entry in memory when browser storage is unavailable.
  }
}

function readEntries() {
  let entries = [];

  try {
    const stored = JSON.parse(localStorage.getItem(ENTRY_KEY) || '[]');
    entries = Array.isArray(stored) ? stored : [];
  } catch {
    entries = [];
  }

  if (transferredEntry && !entries.some((entry) => entry.id === transferredEntry.id)) {
    entries.unshift(transferredEntry);
  }

  return entries;
}

function formatDate(timestamp) {
  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return 'undated';
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function renderDetail(entry) {
  entryDetail.replaceChildren();

  if (!entry) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = 'No entries yet.';
    entryDetail.appendChild(empty);
    return;
  }

  const title = document.createElement('h2');
  title.textContent = entry.name || 'Unnamed';

  const meta = document.createElement('p');
  meta.className = 'entry-meta';
  meta.textContent = `${formatDate(entry.timestamp)} / ${entry.wordCount || 0} words`;

  const words = document.createElement('div');
  words.className = 'entry-words';

  (entry.words || []).forEach((word) => {
    const pill = document.createElement('span');
    pill.textContent = word;
    words.appendChild(pill);
  });

  const text = document.createElement('div');
  text.className = 'entry-text';
  text.textContent = entry.text || '';

  entryDetail.append(title, meta, words, text);
}

function renderEntries() {
  const entries = entriesCache;
  entryList.replaceChildren();

  if (!entries.length) {
    activeId = null;
    renderDetail(null);
    return;
  }

  if (!entries.some((entry) => entry.id === activeId)) {
    activeId = entries[0].id;
  }

  entries.forEach((entry) => {
    const button = document.createElement('button');
    button.className = 'entry-button';
    button.type = 'button';
    button.classList.toggle('is-active', entry.id === activeId);

    const name = document.createElement('strong');
    name.textContent = entry.name || 'Unnamed';

    const meta = document.createElement('span');
    meta.textContent = `${formatDate(entry.timestamp)} / ${entry.wordCount || 0} words`;

    button.append(name, meta);
    button.addEventListener('click', () => {
      activeId = entry.id;
      try {
        history.replaceState(null, '', `entries.html?id=${encodeURIComponent(entry.id)}${window.location.hash}`);
      } catch {
        // Some browsers restrict history changes for local files.
      }
      renderEntries();
    });

    entryList.appendChild(button);
  });

  renderDetail(entries.find((entry) => entry.id === activeId));
}

renderEntries();

async function loadEntries() {
  if (window.location.protocol === 'file:') {
    entriesCache = readEntries();
    renderEntries();
    return;
  }

  try {
    const result = await loadPublicEntries();

    entriesCache = result.entries;
    renderEntries();
  } catch {
    entriesCache = [];
    entryList.replaceChildren();
    const unavailable = document.createElement('p');
    unavailable.className = 'empty-state';
    unavailable.textContent = 'The public archive is temporarily unavailable.';
    entryList.appendChild(unavailable);
    renderDetail(null);
  }
}

function loadPublicEntries() {
  if (!SUBMISSION_URL) {
    return Promise.reject(new Error('Archive not configured'));
  }

  return new Promise((resolve, reject) => {
    const callbackName = `cyntwixEntries_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2)}`;
    const script = document.createElement('script');
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error('Archive request timed out'));
    }, 15000);

    function cleanup() {
      window.clearTimeout(timeout);
      script.remove();
      delete globalThis[callbackName];
    }

    globalThis[callbackName] = (result) => {
      cleanup();

      if (!result || result.ok === false || !Array.isArray(result.entries)) {
        reject(new Error((result && result.error) || 'Archive unavailable'));
        return;
      }

      resolve(result);
    };

    script.onerror = () => {
      cleanup();
      reject(new Error('Archive unavailable'));
    };

    const separator = SUBMISSION_URL.includes('?') ? '&' : '?';
    script.src = `${SUBMISSION_URL}${separator}callback=${encodeURIComponent(callbackName)}`;
    document.head.appendChild(script);
  });
}

loadEntries();
