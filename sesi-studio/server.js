const express = require('express');
const { WebSocketServer } = require('ws');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

// Ensure standard macOS local installation directories are in the environment PATH
const standardPaths = '/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin';
process.env.PATH = process.env.PATH ? `${standardPaths}:${process.env.PATH}` : standardPaths;

// Load .env from project root using dotenvx for decryption
const PROJECT_ROOT = path.resolve(__dirname, '..');
const envPath = path.join(PROJECT_ROOT, '.env');

try {
  const dotenvx = require('@dotenvx/dotenvx');
  dotenvx.config({ path: envPath });
  console.log('Decrypted .env variables loaded successfully via dotenvx.');
} catch (err) {
  console.warn('dotenvx not found or decryption failed, falling back to manual parsing:', err.message);
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx > 0) {
          const key = trimmed.slice(0, eqIdx).trim();
          let val = trimmed.slice(eqIdx + 1).trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          if (!process.env[key]) process.env[key] = val;
        }
      }
    });
  }
}

const app = express();
const server = http.createServer(app);

app.use(express.json({ limit: '10mb' }));
app.use(express.static(__dirname));

// Serve favicon from project root
app.get('/favicon.ico', (req, res) => {
  const faviconPath = path.join(PROJECT_ROOT, 'favicon.ico');
  if (fs.existsSync(faviconPath)) res.sendFile(faviconPath);
  else res.status(404).end();
});

// Security: ensure path is within project root
function safePath(relPath) {
  const resolved = path.resolve(PROJECT_ROOT, relPath || '');
  if (!resolved.startsWith(PROJECT_ROOT)) return null;
  return resolved;
}

// API: List directory
app.get('/api/files', (req, res) => {
  const dirPath = safePath(req.query.path);
  if (!dirPath) return res.status(403).json({ error: 'Forbidden' });

  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    const hidden = new Set(['.git', '.DS_Store', 'node_modules', '.env', 'dist', '.sesi_cache.json']);
    const result = entries
      .filter(e => !hidden.has(e.name) && !e.name.startsWith('.'))
      .map(e => ({
        name: e.name,
        isDir: e.isDirectory(),
        path: path.relative(PROJECT_ROOT, path.join(dirPath, e.name))
      }))
      .sort((a, b) => (b.isDir - a.isDir) || a.name.localeCompare(b.name));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: Read file
app.get('/api/file', (req, res) => {
  const filePath = safePath(req.query.path);
  if (!filePath) return res.status(403).json({ error: 'Forbidden' });

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    res.json({ content, path: req.query.path });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: Save file
app.post('/api/file', (req, res) => {
  const filePath = safePath(req.body.path);
  if (!filePath) return res.status(403).json({ error: 'Forbidden' });

  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, req.body.content, 'utf-8');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: Co-pilot chat
app.post('/api/chat', (req, res) => {
  const query = req.body.query;
  const filePath = req.body.filePath;
  const fileContent = req.body.fileContent;
  if (!query) return res.status(400).json({ error: 'No query' });

  try {
    let queryContext = query;
    if (filePath && fileContent) {
      const fileName = filePath.split('/').pop();
      queryContext = `[Active File: ${fileName}]\n\`\`\`\n${fileContent}\n\`\`\`\n\nUser Question/Command: ${query}`;
    }
    fs.writeFileSync(path.join(PROJECT_ROOT, 'query.txt'), queryContext, 'utf-8');

    // Ensure session database directory exists for chatbot
    const logsDir = path.join(PROJECT_ROOT, 'main', 'logs');
    if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

    const output = execSync(`"${process.execPath}" bin/sesi.js chatbot/sesi_db_chatbot.sesi`, {
      cwd: PROJECT_ROOT,
      encoding: 'utf-8',
      timeout: 120000,
      env: process.env
    });

    // Extract response between last pair of delimiter lines
    const delim = '--------------------------------------------------';
    const lines = output.split('\n');
    const delimIndices = [];
    lines.forEach((line, i) => {
      if (line.trim() === delim) delimIndices.push(i);
    });

    let response = output;
    if (delimIndices.length >= 2) {
      const start = delimIndices[delimIndices.length - 2] + 1;
      const end = delimIndices[delimIndices.length - 1];
      response = lines.slice(start, end).join('\n').trim();
    }

    res.json({ response });
  } catch (err) {
    const errMsg = err.stderr || err.stdout || err.message;
    res.json({ response: '⚠️ Co-pilot error: ' + errMsg });
  }
});

// API: Autocomplete (AI inline suggestions)
app.post('/api/autocomplete', async (req, res) => {
  const { filePath, prefix, suffix } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || !prefix) {
    return res.json({ suggestion: '' });
  }

  const fileName = filePath ? filePath.split('/').pop() : 'unsaved.sesi';
  
  // 1. Instantly read all local Sesi markdown specifications for RAG context
  let docsContext = '';
  try {
    const docsDir = path.join(PROJECT_ROOT, 'docs');
    if (fs.existsSync(docsDir)) {
      const docFiles = fs.readdirSync(docsDir);
      docFiles.forEach(file => {
        if (file.endsWith('.md')) {
          const content = fs.readFileSync(path.join(docsDir, file), 'utf-8');
          docsContext += `\n\n=== DOCUMENT: ${file} ===\n${content}`;
        }
      });
    }
  } catch (e) {
    console.error('Failed to read Sesi docs:', e.message);
  }

  // 2. Build the context prompt
  const prompt = `You are a professional software engineering AI. Your job is to act as an inline code completion engine (like GitHub Copilot) for the Sesi programming language.

Sesi Official Reference Documentation:
${docsContext}

Here is the context of the active file:
File name: ${fileName}

Prefix (code before cursor):
${prefix}

Suffix (code after cursor):
${suffix}

Task: Complete the code exactly from where the cursor left off.
Rules:
- Respond ONLY with the raw code completion that immediately continues the prefix.
- Do NOT wrap your response in markdown code blocks (\`\`\`).
- Do NOT include the prefix or suffix in your response.
- Do NOT provide explanations, commentary, or comments.
- Complete only the immediate logical block, line, or expression.
- If no completion makes sense, return absolutely nothing.`;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 300
        }
      })
    });

    if (!response.ok) throw new Error(`Gemini API returned status ${response.status}`);
    const data = await response.json();
    
    let suggestion = '';
    if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts[0]) {
      suggestion = data.candidates[0].content.parts[0].text;
    }

    // Clean up any accidental code block formatting from the LLM
    if (suggestion.startsWith('```')) {
      const lines = suggestion.split('\n');
      if (lines[0].startsWith('```')) lines.shift();
      if (lines[lines.length - 1] === '```') lines.pop();
      suggestion = lines.join('\n');
    }

    res.json({ suggestion });
  } catch (err) {
    console.error('Autocomplete error:', err.message);
    res.json({ suggestion: '' });
  }
});

// API: Chat History
app.get('/api/history', (req, res) => {
  const historyPath = path.join(PROJECT_ROOT, '.sesi_chat_history.json');
  try {
    if (fs.existsSync(historyPath)) {
      const history = fs.readFileSync(historyPath, 'utf-8');
      res.json(JSON.parse(history));
    } else {
      res.json([]);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/history', (req, res) => {
  const historyPath = path.join(PROJECT_ROOT, '.sesi_chat_history.json');
  try {
    fs.writeFileSync(historyPath, JSON.stringify(req.body.history || []), 'utf-8');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// WebSocket terminal with node-pty
let ptyModule = null;
try {
  ptyModule = require('node-pty');
} catch (e) {
  console.warn('⚠️  node-pty not available — terminal will use basic fallback');
}

const wss = new WebSocketServer({ server, path: '/terminal' });

function setupBasicTerminal(ws) {
  ws.send(JSON.stringify({ type: 'output', data: 'Sesi Studio Terminal (basic mode)\r\n$ ' }));
  let buffer = '';
  ws.on('message', (msg) => {
    try {
      const parsed = JSON.parse(msg.toString());
      if (parsed.type !== 'input') return;
      const char = parsed.data;

      if (char === '\r' || char === '\n') {
        ws.send(JSON.stringify({ type: 'output', data: '\r\n' }));
        const cmd = buffer.trim();
        buffer = '';
        if (cmd) {
          try {
            const result = execSync(cmd, { cwd: PROJECT_ROOT, encoding: 'utf-8', timeout: 60000, env: process.env });
            ws.send(JSON.stringify({ type: 'output', data: result.replace(/\n/g, '\r\n') }));
          } catch (e) {
            const errOut = (e.stderr || e.message || '').replace(/\n/g, '\r\n');
            ws.send(JSON.stringify({ type: 'output', data: errOut }));
          }
        }
        ws.send(JSON.stringify({ type: 'output', data: '$ ' }));
      } else if (char === '\x7f') {
        if (buffer.length > 0) {
          buffer = buffer.slice(0, -1);
          ws.send(JSON.stringify({ type: 'output', data: '\b \b' }));
        }
      } else {
        buffer += char;
        ws.send(JSON.stringify({ type: 'output', data: char }));
      }
    } catch (e) {}
  });
}

wss.on('connection', (ws) => {
  if (false && ptyModule) {
    let shell;
    try {
      shell = ptyModule.spawn('/bin/bash', [], {
        name: 'xterm-256color',
        cols: 120,
        rows: 24,
        cwd: PROJECT_ROOT,
        env: process.env
      });
    } catch (spawnError) {
      console.error('❌ Failed to spawn shell via node-pty:', spawnError);
      ws.send(JSON.stringify({ type: 'output', data: '\r\n\x1b[31m[ERROR] Failed to spawn shell. Falling back to basic terminal mode.\x1b[0m\r\n$ ' }));
      setupBasicTerminal(ws);
      return;
    }

    shell.onData((data) => {
      try { ws.send(JSON.stringify({ type: 'output', data })); } catch (e) {}
    });

    ws.on('message', (msg) => {
      try {
        const parsed = JSON.parse(msg.toString());
        if (parsed.type === 'input') shell.write(parsed.data);
        if (parsed.type === 'resize') shell.resize(parsed.cols || 120, parsed.rows || 24);
      } catch (e) {}
    });

    ws.on('close', () => { try { shell.kill(); } catch (e) {} });
  } else {
    // Fallback: command-by-command execution
    setupBasicTerminal(ws);
  }
});

const PORT = process.env.STUDIO_PORT || 3050;
server.listen(PORT, () => {
  console.log('');
  console.log('  ╔══════════════════════════════════════════╗');
  console.log('  ║                                          ║');
  console.log('  ║   🧠 Sesi Studio v1.1                    ║');
  console.log(`  ║   → http://localhost:${PORT}                ║`);
  console.log('  ║                                          ║');
  console.log('  ╚══════════════════════════════════════════╝');
  console.log('');
  console.log(`  Project: ${PROJECT_ROOT}`);
  console.log(`  PTY:     ${ptyModule ? 'node-pty (full shell)' : 'basic fallback'}`);
  console.log('');
});
