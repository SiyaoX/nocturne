const express = require('express');
const { rateLimit } = require('express-rate-limit');
const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

const app = express();
const port = process.env.PORT || 3000;

const dataDir = path.join(__dirname, 'data');
const inboxPath = path.join(dataDir, 'inbox.json');
const historyPath = path.join(dataDir, 'history.json');
const historyMarkdownPath = path.join(dataDir, 'history.md');

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(
  '/api',
  rateLimit({
    windowMs: 60 * 1000,
    limit: 120,
    standardHeaders: true,
    legacyHeaders: false
  })
);

async function ensureDataFiles() {
  await fs.mkdir(dataDir, { recursive: true });

  await Promise.all([
    ensureFile(inboxPath, '[]\n'),
    ensureFile(historyPath, '[]\n'),
    ensureFile(historyMarkdownPath, '# nocturne history\n\n')
  ]);
}

async function ensureFile(filePath, initialContent) {
  try {
    await fs.access(filePath);
  } catch {
    await fs.writeFile(filePath, initialContent, 'utf8');
  }
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw || '[]');
}

async function writeJson(filePath, data) {
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function buildPrompt(instruction, selectedItems) {
  const parts = [];

  if (instruction && instruction.trim()) {
    parts.push(`Instruction:\n${instruction.trim()}`);
  }

  const cleanedItems = selectedItems
    .map((item, index) => {
      if (typeof item === 'string') {
        return { label: `Item ${index + 1}`, content: item };
      }

      return {
        label: item.source || item.id || `Item ${index + 1}`,
        content: item.content || ''
      };
    })
    .filter((item) => item.content.trim());

  if (cleanedItems.length > 0) {
    const context = cleanedItems
      .map((item, index) => `[${index + 1}] ${item.label}\n${item.content.trim()}`)
      .join('\n\n');
    parts.push(`Context:\n${context}`);
  }

  parts.push('Please review the instruction and context, then produce a clear response.');

  return parts.join('\n\n').trim();
}

function normalizeType(type) {
  const allowed = new Set(['task', 'report', 'decision']);
  return allowed.has(type) ? type : 'task';
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/api/inbox', async (_req, res, next) => {
  try {
    const items = await readJson(inboxPath);
    res.json(items);
  } catch (error) {
    next(error);
  }
});

app.post('/api/inbox', async (req, res, next) => {
  try {
    const content = typeof req.body.content === 'string' ? req.body.content.trim() : '';
    const source = typeof req.body.source === 'string' ? req.body.source.trim() : 'manual';

    if (!content) {
      return res.status(400).json({ error: 'content is required' });
    }

    const items = await readJson(inboxPath);
    const item = {
      id: `inbox_${crypto.randomUUID()}`,
      source,
      content,
      createdAt: new Date().toISOString()
    };

    items.unshift(item);
    await writeJson(inboxPath, items);

    return res.status(201).json(item);
  } catch (error) {
    return next(error);
  }
});

app.delete('/api/inbox/:id', async (req, res, next) => {
  try {
    const items = await readJson(inboxPath);
    const nextItems = items.filter((item) => item.id !== req.params.id);

    if (nextItems.length === items.length) {
      return res.status(404).json({ error: 'inbox item not found' });
    }

    await writeJson(inboxPath, nextItems);
    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
});

app.post('/api/compose', (req, res, next) => {
  try {
    const instruction = typeof req.body.instruction === 'string' ? req.body.instruction : '';
    const selectedItems = Array.isArray(req.body.selectedItems) ? req.body.selectedItems : [];

    const prompt = buildPrompt(instruction, selectedItems);
    res.json({ prompt });
  } catch (error) {
    next(error);
  }
});

app.get('/api/history', async (_req, res, next) => {
  try {
    const entries = await readJson(historyPath);
    res.json(entries);
  } catch (error) {
    next(error);
  }
});

app.post('/api/history', async (req, res, next) => {
  try {
    const title = typeof req.body.title === 'string' ? req.body.title.trim() : '';
    const type = normalizeType(req.body.type);
    const prompt = typeof req.body.prompt === 'string' ? req.body.prompt.trim() : '';
    const output = typeof req.body.output === 'string' ? req.body.output.trim() : '';
    const decision = typeof req.body.decision === 'string' ? req.body.decision.trim() : '';

    if (!prompt && !output && !decision) {
      return res.status(400).json({ error: 'at least one of prompt, output, or decision is required' });
    }

    const entries = await readJson(historyPath);
    const entry = {
      id: `history_${crypto.randomUUID()}`,
      type,
      title: title || `${type} entry`,
      prompt,
      output,
      decision,
      createdAt: new Date().toISOString()
    };

    entries.unshift(entry);
    await writeJson(historyPath, entries);

    const markdownBlock = [
      `## ${entry.title}`,
      `- Type: ${entry.type}`,
      `- Created: ${entry.createdAt}`,
      entry.prompt ? `\n### Prompt\n\n${entry.prompt}` : '',
      entry.output ? `\n### Output\n\n${entry.output}` : '',
      entry.decision ? `\n### Decision\n\n${entry.decision}` : '',
      '\n'
    ].filter(Boolean).join('\n');

    await fs.appendFile(historyMarkdownPath, markdownBlock, 'utf8');

    return res.status(201).json(entry);
  } catch (error) {
    return next(error);
  }
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: 'internal server error' });
});

ensureDataFiles()
  .then(() => {
    app.listen(port, () => {
      console.log(`nocturne listening on http://localhost:${port}`);
    });
  })
  .catch((error) => {
    console.error('Failed to start nocturne', error);
    process.exit(1);
  });
