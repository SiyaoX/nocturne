const state = {
  inbox: [],
  history: []
};

const inboxForm = document.querySelector('#inbox-form');
const sourceInput = document.querySelector('#source');
const inboxContentInput = document.querySelector('#inbox-content');
const inboxList = document.querySelector('#inbox-list');
const instructionInput = document.querySelector('#instruction');
const composeButton = document.querySelector('#compose-button');
const outputInput = document.querySelector('#composed-output');
const copyButton = document.querySelector('#copy-button');
const historyTitleInput = document.querySelector('#history-title');
const historyTypeInput = document.querySelector('#history-type');
const saveHistoryButton = document.querySelector('#save-history-button');
const historyList = document.querySelector('#history-list');

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || 'request failed');
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

function renderInbox() {
  inboxList.innerHTML = '';

  if (state.inbox.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'item';
    empty.textContent = 'Inbox is empty.';
    inboxList.appendChild(empty);
    return;
  }

  for (const item of state.inbox) {
    const row = document.createElement('li');
    row.className = 'item';

    const header = document.createElement('div');
    header.className = 'item-header';

    const meta = document.createElement('span');
    meta.textContent = `${item.source} • ${new Date(item.createdAt).toLocaleString()}`;

    const controls = document.createElement('span');

    const includeCheckbox = document.createElement('input');
    includeCheckbox.type = 'checkbox';
    includeCheckbox.dataset.itemId = item.id;
    includeCheckbox.title = 'Include in prompt composer';

    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.textContent = 'Remove';
    deleteButton.addEventListener('click', async () => {
      await api(`/api/inbox/${encodeURIComponent(item.id)}`, { method: 'DELETE' });
      await loadInbox();
    });

    controls.append(includeCheckbox, deleteButton);
    header.append(meta, controls);

    const content = document.createElement('p');
    content.className = 'item-content';
    content.textContent = item.content;

    row.append(header, content);
    inboxList.appendChild(row);
  }
}

function renderHistory() {
  historyList.innerHTML = '';

  if (state.history.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'item';
    empty.textContent = 'No history entries yet.';
    historyList.appendChild(empty);
    return;
  }

  for (const entry of state.history.slice(0, 10)) {
    const row = document.createElement('li');
    row.className = 'item';

    const header = document.createElement('div');
    header.className = 'item-header';
    header.textContent = `${entry.type} • ${entry.title}`;

    const body = document.createElement('p');
    body.className = 'item-content';
    body.textContent = entry.output || entry.decision || entry.prompt;

    row.append(header, body);
    historyList.appendChild(row);
  }
}

async function loadInbox() {
  state.inbox = await api('/api/inbox');
  renderInbox();
}

async function loadHistory() {
  state.history = await api('/api/history');
  renderHistory();
}

inboxForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  await api('/api/inbox', {
    method: 'POST',
    body: JSON.stringify({
      source: sourceInput.value.trim() || 'manual',
      content: inboxContentInput.value
    })
  });

  inboxForm.reset();
  await loadInbox();
});

composeButton.addEventListener('click', async () => {
  const selectedIds = Array.from(document.querySelectorAll('#inbox-list input[type="checkbox"]:checked')).map(
    (checkbox) => checkbox.dataset.itemId
  );

  const selectedItems = state.inbox.filter((item) => selectedIds.includes(item.id));
  const payload = await api('/api/compose', {
    method: 'POST',
    body: JSON.stringify({
      instruction: instructionInput.value,
      selectedItems
    })
  });

  outputInput.value = payload.prompt;
});

copyButton.addEventListener('click', async () => {
  await navigator.clipboard.writeText(outputInput.value || '');
  copyButton.textContent = 'Copied';
  setTimeout(() => {
    copyButton.textContent = 'Copy prompt';
  }, 1200);
});

saveHistoryButton.addEventListener('click', async () => {
  await api('/api/history', {
    method: 'POST',
    body: JSON.stringify({
      type: historyTypeInput.value,
      title: historyTitleInput.value,
      prompt: outputInput.value,
      output: outputInput.value
    })
  });

  historyTitleInput.value = '';
  await loadHistory();
});

Promise.all([loadInbox(), loadHistory()]).catch((error) => {
  console.error(error);
});
