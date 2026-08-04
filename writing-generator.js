const WORD_FILES = [
  'data/words.txt',
  'data/shadow_and_claw_words_filtered.txt',
];
const ENTRY_KEY = 'cyntwixWritingEntries';
const SUBMISSION_URL = globalThis.CYNTWIX_SUBMISSION_URL || '';

const countButtons = Array.from(document.querySelectorAll('.count-option'));
const goButton = document.querySelector('.go-button');
const submitButton = document.querySelector('.submit-button');
const wordList = document.querySelector('#word-list');
const nameBox = document.querySelector('#name-box');
const writingBox = document.querySelector('#writing-box');
const wordCount = document.querySelector('#word-count');
const statusLine = document.querySelector('#status');

let selectedCount = 5;
let allWords = [];
let selectedWords = [];

function setStatus(message) {
  statusLine.textContent = message;
}

function tokenize(text) {
  return text.toLowerCase().match(/[a-z]+(?:'[a-z]+)?/g) || [];
}

function updateWordCounter() {
  wordCount.textContent = tokenize(writingBox.value).length;
}

function getUsedWords() {
  const typedWords = new Set(tokenize(writingBox.value));
  return selectedWords.filter((word) => typedWords.has(word));
}

function updateUsedWords() {
  const usedWords = new Set(getUsedWords());
  Array.from(wordList.querySelectorAll('.word-pill')).forEach((pill) => {
    pill.classList.toggle('is-used', usedWords.has(pill.dataset.word));
  });
}

function updateSubmitState() {
  const usedCount = getUsedWords().length;
  const totalCount = selectedWords.length;
  const hasName = nameBox.value.trim().length > 0;
  const hasAllWords = totalCount > 0 && usedCount === totalCount;

  submitButton.disabled = !(hasName && hasAllWords);

  if (totalCount === 0) {
    submitButton.textContent = 'Waiting for words';
    return;
  }

  if (!hasName) {
    submitButton.textContent = 'Enter a name to submit';
    return;
  }

  if (!hasAllWords) {
    submitButton.textContent = `Only ${usedCount} out of ${totalCount} words used`;
    return;
  }

  submitButton.textContent = 'SUBMIT';
}

function renderSelectedWords() {
  wordList.replaceChildren();

  selectedWords.forEach((word) => {
    const pill = document.createElement('span');
    pill.className = 'word-pill';
    pill.dataset.word = word;
    pill.textContent = word;
    wordList.appendChild(pill);
  });

  updateUsedWords();
  updateSubmitState();
}

function randomWords(count) {
  const picked = new Set();
  const max = Math.min(count, allWords.length);

  while (picked.size < max) {
    picked.add(allWords[Math.floor(Math.random() * allWords.length)]);
  }

  return Array.from(picked);
}

function selectCount(button) {
  selectedCount = Number(button.dataset.count);
  countButtons.forEach((option) => {
    const isSelected = option === button;
    option.classList.toggle('is-selected', isSelected);
    option.setAttribute('aria-pressed', String(isSelected));
  });
}

countButtons.forEach((button) => {
  button.setAttribute('aria-pressed', button.classList.contains('is-selected') ? 'true' : 'false');
  button.addEventListener('click', () => selectCount(button));
});

goButton.addEventListener('click', () => {
  if (!allWords.length) {
    setStatus('Word list unavailable.');
    return;
  }

  selectedWords = randomWords(selectedCount);
  renderSelectedWords();
  setStatus('');
});

writingBox.addEventListener('input', () => {
  updateWordCounter();
  updateUsedWords();
  updateSubmitState();
});

nameBox.addEventListener('input', () => {
  updateSubmitState();
});

submitButton.addEventListener('click', async () => {
  if (submitButton.disabled) {
    return;
  }

  const draft = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: nameBox.value.trim(),
    timestamp: new Date().toISOString(),
    words: selectedWords,
    text: writingBox.value.trim(),
    wordCount: tokenize(writingBox.value).length,
  };

  submitButton.disabled = true;
  submitButton.textContent = 'SENDING...';
  setStatus('Sending your entry to the archive...');

  if (window.location.protocol === 'file:') {
    const entries = readEntries();
    entries.unshift(draft);
    try {
      localStorage.setItem(ENTRY_KEY, JSON.stringify(entries));
    } catch {
      // The entry still travels to entries.html below.
    }

    const transfer = encodeURIComponent(JSON.stringify(draft));
    window.location.href = `entries.html?id=${encodeURIComponent(draft.id)}#entry=${transfer}`;
    return;
  }

  try {
    if (!SUBMISSION_URL) {
      throw new Error('The submission archive is not configured.');
    }

    const body = new URLSearchParams({
      name: draft.name,
      words: JSON.stringify(draft.words),
      text: draft.text,
      website: '',
    });

    // Apps Script accepts a simple form POST. Its response is cross-origin, so
    // the browser intentionally treats it as opaque after confirming delivery.
    await fetch(SUBMISSION_URL, {
      method: 'POST',
      mode: 'no-cors',
      body,
    });

    window.location.href = 'entries.html';
  } catch (error) {
    setStatus(error.message || 'The submission server is unavailable.');
    updateSubmitState();
  }
});

function readEntries() {
  try {
    const stored = JSON.parse(localStorage.getItem(ENTRY_KEY) || '[]');
    return Array.isArray(stored) ? stored : [];
  } catch {
    return [];
  }
}

function fetchWordList(index = 0) {
  if (index >= WORD_FILES.length) {
    return Promise.reject(new Error('No word list found'));
  }

  return fetch(WORD_FILES[index]).then((response) => {
    if (!response.ok) {
      return fetchWordList(index + 1);
    }
    return response.text();
  });
}

function finishWordSetup(words) {
  allWords = words;
  selectedWords = randomWords(selectedCount);
  renderSelectedWords();
  setStatus('');
  goButton.disabled = false;
}

if (Array.isArray(globalThis.CYNTWIX_WORDS) && globalThis.CYNTWIX_WORDS.length) {
  finishWordSetup(globalThis.CYNTWIX_WORDS);
} else {
  fetchWordList()
    .then((text) => finishWordSetup(tokenize(text)))
    .catch(() => {
      setStatus('Word list unavailable. Add data/words.txt (one word per line).');
      goButton.disabled = true;
      updateSubmitState();
    });
}
