(() => {
  'use strict';

  const LIMITS = Object.freeze({ daily: 10, perMinute: 3, maxInput: 4000, maxOutputTokens: 500 });
  const STORAGE = Object.freeze({ tasks: 'studypilot.tasks.v1', day: 'studypilot.usage.day', count: 'studypilot.usage.count', times: 'studypilot.usage.times', model: 'studypilot.model' });
  // DEMO ONLY: choose 'gemini' or 'openai', then paste your provider's key below.
  // WARNING: frontend keys are visible to anyone who can load the deployed site.
  const AI_PROVIDER = 'gemini'; // 'gemini' or 'openai'
  const DEMO_API_KEY = 'AQ.Ab8RN6KcTCC3qSM1TNTR8N3mztEugQeXbuc59HEE4HLsvhT0Bg';
  let apiKey = DEMO_API_KEY === 'PASTE_YOUR_API_KEY_HERE' ? '' : DEMO_API_KEY;
  const MODEL_PREFIX = AI_PROVIDER.toLowerCase() === 'gemini' ? 'gemini' : 'gpt';
  const DEFAULT_MODEL = AI_PROVIDER.toLowerCase() === 'gemini' ? 'gemini-3.8-flash' : 'gpt-4.1-mini';
  const ALLOWED_MODELS = ['gemini-3.8-flash','gemini-3.5-flash-lite','gpt-4.1-mini','gpt-4.1-nano'];
  const pickModel = (m) => (m && ALLOWED_MODELS.includes(m) && m.startsWith(MODEL_PREFIX)) ? m : DEFAULT_MODEL;
  let busy = false;
  let activeFilter = 'all';
  let currentStudyMode = 'guide';
  let toastTimer;
  const $ = (id) => document.getElementById(id);
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const todayKey = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  };
  const dateLabel = (value) => {
    if (!value) return 'No due date';
    const d = new Date(`${value}T12:00:00`);
    if (Number.isNaN(d.getTime())) return 'No due date';
    if (value === todayKey()) return 'Due today';
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate()+1);
    if (value === `${tomorrow.getFullYear()}-${String(tomorrow.getMonth()+1).padStart(2,'0')}-${String(tomorrow.getDate()).padStart(2,'0')}`) return 'Tomorrow';
    return d.toLocaleDateString(undefined,{month:'short',day:'numeric'});
  };
  const defaultTasks = [];
  function loadTasks() {
    try { const parsed = JSON.parse(localStorage.getItem(STORAGE.tasks) || '[]'); return Array.isArray(parsed) ? parsed.filter(t => t && typeof t.id === 'string' && typeof t.title === 'string') : defaultTasks; }
    catch { return defaultTasks; }
  }
  let tasks = loadTasks();
  function saveTasks() { try { localStorage.setItem(STORAGE.tasks, JSON.stringify(tasks)); } catch { showToast('Could not save tasks in this browser.'); } }
  function getUsage() {
    const today = todayKey();
    try {
      if (localStorage.getItem(STORAGE.day) !== today) {
        localStorage.setItem(STORAGE.day, today);
        localStorage.setItem(STORAGE.count, '0');
        localStorage.setItem(STORAGE.times, '[]');
      }
      let count = Number(localStorage.getItem(STORAGE.count) || 0);
      let times = JSON.parse(localStorage.getItem(STORAGE.times) || '[]');
      if (!Number.isFinite(count) || count < 0) count = 0;
      if (!Array.isArray(times)) times = [];
      times = times.filter(t => Number.isFinite(t) && Date.now() - t < 60000 && Date.now() >= t);
      return { count, times };
    } catch { return { count: 0, times: [] }; }
  }
  function saveUsage(count, times) {
    localStorage.setItem(STORAGE.day, todayKey());
    localStorage.setItem(STORAGE.count, String(count));
    localStorage.setItem(STORAGE.times, JSON.stringify(times));
  }
  function renderUsage() {
    const u = getUsage();
    const left = Math.max(0, LIMITS.daily - u.count);
    ['quotaUsed','assistantQuotaUsed'].forEach(id => { if ($(id)) $(id).textContent = u.count; });
    ['quotaFill','assistantQuotaFill'].forEach(id => { if ($(id)) $(id).style.width = `${Math.min(100, u.count / LIMITS.daily * 100)}%`; });
    if ($('statRequestsLeft')) $('statRequestsLeft').textContent = left;
    if ($('usageRemaining')) $('usageRemaining').textContent = `${left} left`;
    if ($('navTaskCount')) $('navTaskCount').textContent = tasks.filter(t => !t.done).length;
  }
  function renderTaskRow(task) {
    const priority = ['high','medium','low'].includes(task.priority) ? task.priority : 'medium';
    const overdue = task.due && task.due < todayKey() && !task.done;
    return `<div class="task-row ${task.done ? 'is-done' : ''}" data-task-id="${esc(task.id)}">
      <input class="task-check" type="checkbox" aria-label="Mark ${esc(task.title)} complete" data-toggle-task="${esc(task.id)}" ${task.done ? 'checked' : ''}>
      <div class="task-main"><div class="task-title">${esc(task.title)}</div><div class="task-meta"><span class="task-date ${overdue ? 'overdue' : ''}">${overdue ? 'Overdue · ' : ''}${esc(dateLabel(task.due))}</span><span>·</span><span><i class="priority-dot priority-${priority}"></i>${priority[0].toUpperCase()+priority.slice(1)} priority</span>${task.category ? `<span class="task-category">${esc(task.category)}</span>` : ''}</div></div>
      <button class="task-delete" data-delete-task="${esc(task.id)}" aria-label="Delete ${esc(task.title)}" title="Delete task">×</button></div>`;
  }
  function renderTasks() {
    const open = tasks.filter(t => !t.done);
    const done = tasks.filter(t => t.done);
    const dueToday = open.filter(t => t.due === todayKey());
    $('statOpen').textContent = open.length;
    $('statToday').textContent = dueToday.length;
    $('statDone').textContent = done.length;
    $('navTaskCount').textContent = open.length;
    const next = [...open].sort((a,b) => (a.due || '9999').localeCompare(b.due || '9999')).slice(0,4);
    $('upNextList').innerHTML = next.length ? next.map(renderTaskRow).join('') : `<div class="empty-state visible"><div class="empty-illustration">✧</div><h3>You're all caught up</h3><p>Add a task whenever something comes up.</p></div>`;
    let filtered = tasks.filter(t => activeFilter === 'all' || (activeFilter === 'open' ? !t.done : t.done));
    const sort = $('taskSort')?.value || 'date';
    filtered.sort((a,b) => sort === 'priority' ? ({high:0,medium:1,low:2}[a.priority] ?? 1)-({high:0,medium:1,low:2}[b.priority] ?? 1) : sort === 'created' ? (b.created || 0)-(a.created || 0) : (a.due || '9999').localeCompare(b.due || '9999'));
    $('allTaskList').innerHTML = filtered.map(renderTaskRow).join('');
    $('emptyTasks').classList.toggle('visible', filtered.length === 0);
    renderUsage();
  }
  function showToast(message) {
    const node = $('toast'); node.textContent = message; node.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => node.classList.remove('show'), 3200);
  }
  function navigate(view) {
    const valid = ['home','tasks','assistant','study'].includes(view) ? view : 'home';
    document.querySelectorAll('.view').forEach(el => el.classList.toggle('active-view', el.id === `view-${valid}`));
    document.querySelectorAll('.nav-item').forEach(el => el.classList.toggle('active', el.dataset.view === valid));
    $('pageCrumb').textContent = ({home:'Overview',tasks:'My tasks',assistant:'AI assistant',study:'Study tools'})[valid];
    $('sidebar').classList.remove('open');
    window.scrollTo({top:0,behavior:'smooth'});
  }
  function addTask() {
    $('taskTitleInput').value = '';
    $('taskDueInput').value = '';
    $('taskPriorityInput').value = 'medium';
    $('taskCategoryInput').value = 'Assignment';
    $('taskDialog').showModal();
    $('taskTitleInput').focus();
  }
  function saveNewTask(event) {
    event.preventDefault();
    const title = $('taskTitleInput').value.trim();
    if (!title) { showToast('Enter a task title first.'); return; }
    const due = $('taskDueInput').value;
    const priority = $('taskPriorityInput').value;
    const category = $('taskCategoryInput').value;
    tasks.unshift({id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,title,due,priority,category,done:false,created:Date.now()});
    saveTasks(); renderTasks(); $('taskDialog').close(); showToast('Task added to this browser.');
  }
  function toggleTask(id, done) { tasks = tasks.map(t => t.id === id ? {...t,done} : t); saveTasks(); renderTasks(); }
  function deleteTask(id) { tasks = tasks.filter(t => t.id !== id); saveTasks(); renderTasks(); showToast('Task deleted.'); }
  function appendMessage(role, text) {
    const box = $('chatMessages');
    const item = document.createElement('div'); item.className = `message ${role === 'user' ? 'user-message' : 'assistant-message'}`;
    const avatar = document.createElement('div'); avatar.className = 'message-avatar'; avatar.textContent = role === 'user' ? 'S' : '✦';
    const content = document.createElement('div'); content.className = 'message-content';
    if (role !== 'user') { const author = document.createElement('div'); author.className = 'message-author'; author.textContent = 'StudyPilot'; const time = document.createElement('span'); time.textContent = ' JUST NOW'; author.appendChild(time); content.appendChild(author); }
    String(text).split('\n').forEach(line => { const p = document.createElement('p'); p.textContent = line || ' '; content.appendChild(p); });
    item.append(avatar,content); box.appendChild(item); box.scrollTop = box.scrollHeight;
    return item;
  }
  async function callOpenAI(prompt, context = '') {
    if (!apiKey) { $('settingsDialog').showModal(); $('settingsStatus').textContent = `Enter your ${AI_PROVIDER} API key to start.`; throw new Error(`Add your ${AI_PROVIDER} API key in API & settings to use AI.`); }
    if (typeof prompt !== 'string' || !prompt.trim()) throw new Error('Enter a question first.');
    if (prompt.length > LIMITS.maxInput) throw new Error(`Please keep your prompt under ${LIMITS.maxInput} characters.`);
    const usage = getUsage();
    if (usage.count >= LIMITS.daily) throw new Error('Daily demo limit reached (10 requests). Try again after the daily reset.');
    if (usage.times.length >= LIMITS.perMinute) throw new Error('Rate limit reached: maximum 3 requests per minute. Please wait a little.');
    const reservedTimes = [...usage.times, Date.now()];
    saveUsage(usage.count + 1, reservedTimes); renderUsage();
    const model = pickModel($('modelSelect').value);
    const systemInstruction = `You are StudyPilot, a practical and friendly student executive assistant. Help with study planning, assignments, project breakdowns, email drafts, and explanations. Be concise, structured, encouraging, and honest. Never claim to have accessed Gmail, a college portal, a calendar, or files unless the user pasted that information. Do not invent deadlines or school policies. Encourage verification of important facts. Keep the response useful on mobile. ${context}`;
    let response, data = {};
    try {
      if (AI_PROVIDER.toLowerCase() === 'gemini') {
        response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
          method: 'POST', headers: {'Content-Type':'application/json','x-goog-api-key':apiKey},
          body: JSON.stringify({systemInstruction:{parts:[{text:systemInstruction}]},contents:[{role:'user',parts:[{text:prompt}]}],generationConfig:{maxOutputTokens:LIMITS.maxOutputTokens,temperature:0.6,thinkingConfig:{thinkingLevel:'low'}}})
        });
      } else if (AI_PROVIDER.toLowerCase() === 'openai') {
        response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST', headers: {'Content-Type':'application/json','Authorization':`Bearer ${apiKey}`},
          body: JSON.stringify({model, messages:[{role:'system',content:systemInstruction},{role:'user',content:prompt}], max_completion_tokens:LIMITS.maxOutputTokens, temperature:0.6})
        });
      } else throw new Error("Unsupported AI_PROVIDER. Set it to 'gemini' or 'openai'.");
    } catch (error) {
      if (error instanceof TypeError) throw new Error(`Could not reach ${AI_PROVIDER}. Check your connection and provider settings. This attempt counted toward the local limit.`);
      throw error;
    }
    try { data = await response.json(); } catch { /* handled below */ }
    if (!response.ok) {
      const message = data?.error?.message || `${AI_PROVIDER} request failed (${response.status}).`;
      if (response.status === 401 || response.status === 403) throw new Error(`${message} Check that the key belongs to ${AI_PROVIDER} and has API access.`);
      if (response.status === 429) throw new Error(`${AI_PROVIDER} quota or rate limit reached. Check provider usage and limits.`);
      throw new Error(message);
    }
    const text = AI_PROVIDER.toLowerCase() === 'gemini'
      ? (data?.candidates?.[0]?.content?.parts || []).map(part => part.text || '').join('').trim()
      : (data?.choices?.[0]?.message?.content || '').trim();
    if (!text) throw new Error(`${AI_PROVIDER} returned no text. The request counted toward your local limit.`);
    return text;
  }
  async function sendChat(prompt) {
    if (busy) return;
    const clean = prompt.trim(); if (!clean) return;
    if (clean.length > LIMITS.maxInput) { showToast(`Maximum ${LIMITS.maxInput} characters per prompt.`); return; }
    busy = true; $('sendButton').disabled = true; $('chatInput').disabled = true;
    appendMessage('user', clean); $('chatInput').value = ''; $('charCount').textContent = '0';
    const waiting = appendMessage('assistant','Thinking…');
    try {
      const reply = await callOpenAI(clean);
      waiting.querySelector('.message-content').replaceChildren();
      reply.split('\n').forEach(line => { const p = document.createElement('p'); p.textContent = line || ' '; waiting.querySelector('.message-content').appendChild(p); });
      const author = document.createElement('div'); author.className = 'message-author'; author.textContent = 'StudyPilot'; waiting.querySelector('.message-content').prepend(author);
    } catch (err) {
      waiting.querySelector('.message-content').replaceChildren();
      const p = document.createElement('p'); p.textContent = err.message || 'Something went wrong.'; waiting.querySelector('.message-content').appendChild(p);
      showToast(err.message || 'AI request failed.');
    } finally { busy = false; $('sendButton').disabled = false; $('chatInput').disabled = false; $('chatInput').focus(); $('chatMessages').scrollTop = $('chatMessages').scrollHeight; renderUsage(); }
  }
  const studyModes = {
    guide: {title:'Create your study resource',description:'Choose a tool above or enter a topic below.',prompt:(topic,material)=>`Create a clear study guide for: ${topic}. Include a simple overview, key concepts and definitions, a worked example, common mistakes, a concise revision summary, and 5 practice questions with answers. ${material ? `Use these notes as source material and do not invent missing details:\n${material}` : ''}`},
    quiz: {title:'Build a practice quiz',description:'Generate questions and answers to test your understanding.',prompt:(topic,material)=>`Create a practice quiz on: ${topic}. Include 8 questions of mixed difficulty, answers, and short explanations. Cover understanding and application, not only memorization. ${material ? `Base it on these notes where possible:\n${material}` : ''}`},
    notes: {title:'Summarize your notes',description:'Paste source notes and get a structured summary.',prompt:(topic,material)=>`Summarize these study notes for ${topic || 'my subject'}. Use clear headings, definitions, key facts, formulas where present, and a short revision checklist. Do not add unsupported claims.\nNOTES:\n${material || topic}`},
    exam: {title:'Plan your exam preparation',description:'Add your exam date and topics to get a realistic revision schedule.',prompt:(topic,material)=>`Create a realistic exam preparation plan for ${topic}. Include a day-by-day schedule, active recall, practice questions, breaks, and a final recap. Ask me to clarify if the exam date or available study time is missing. ${material ? `Additional context:\n${material}` : ''}`}
  };
  async function generateStudy() {
    if (busy) return;
    const topic = $('studyTopic').value.trim(); const material = $('studyMaterial').value.trim();
    if (!topic && !material) { showToast('Enter a topic or paste your notes first.'); return; }
    const config = studyModes[currentStudyMode];
    let prompt = config.prompt(topic, material);
    if (prompt.length > LIMITS.maxInput) { prompt = prompt.slice(0, LIMITS.maxInput); showToast('The generated prompt was shortened to fit the 4,000-character limit.'); }
    busy = true; $('generateStudy').disabled = true; $('generateStudy').textContent = 'Generating…'; $('studyResult').hidden = false; $('studyResult').textContent = 'Preparing your resource…';
    try { $('studyResult').textContent = await callOpenAI(prompt, 'When useful, format answers with numbered sections and short bullets.'); }
    catch (err) { $('studyResult').textContent = err.message || 'Unable to generate the resource.'; showToast(err.message || 'AI request failed.'); }
    finally { busy = false; $('generateStudy').disabled = false; $('generateStudy').textContent = '✧ Generate resource'; renderUsage(); }
  }
  function selectStudyMode(mode) {
    if (!studyModes[mode]) return; currentStudyMode = mode;
    $('studyFormTitle').textContent = studyModes[mode].title; $('studyFormDescription').textContent = studyModes[mode].description;
    document.querySelectorAll('.study-tool-card').forEach(el => el.classList.toggle('selected-tool', el.dataset.study === mode));
    $('studyResult').hidden = true; $('studyTopic').focus();
  }
  function openSettings() {
    $('settingsApiKey').value = apiKey;
    $('modelSelect').value = pickModel(localStorage.getItem(STORAGE.model));
    $('settingsStatus').textContent = apiKey ? `A key is configured in app.js for this demo (${AI_PROVIDER}).` : `No key configured. Add one in app.js or enter one below.`;
    $('settingsDialog').showModal();
  }
  function init() {
    document.querySelectorAll('#modelSelect option').forEach(o => { if (!o.value.startsWith(MODEL_PREFIX)) o.remove(); });
    $('modelSelect').value = pickModel(localStorage.getItem(STORAGE.model));
    $('todayLabel').textContent = new Date().toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'}).toUpperCase();
    document.querySelectorAll('[data-view]').forEach(el => el.addEventListener('click', () => navigate(el.dataset.view)));
    document.querySelectorAll('[data-goto]').forEach(el => el.addEventListener('click', () => navigate(el.dataset.goto)));
    document.querySelectorAll('[data-prompt]').forEach(el => el.addEventListener('click', () => { navigate('assistant'); $('chatInput').value = el.dataset.prompt; $('charCount').textContent = String(el.dataset.prompt.length); $('chatInput').focus(); }));
    document.querySelectorAll('[data-suggest]').forEach(el => el.addEventListener('click', () => { $('chatInput').value = el.dataset.suggest; $('charCount').textContent = String(el.dataset.suggest.length); $('chatInput').focus(); }));
    document.querySelectorAll('[data-study]').forEach(el => el.addEventListener('click', () => selectStudyMode(el.dataset.study)));
    $('planDayBtn').addEventListener('click', () => { navigate('assistant'); $('chatInput').value = `Help me plan today. Here are my open tasks:\n${tasks.filter(t=>!t.done).map(t=>`- ${t.title}${t.due?` (due ${t.due})`:''}, ${t.priority} priority`).join('\n') || 'I have not added any tasks yet.'}\nCreate a realistic schedule with priorities and breaks. Ask about my available hours if needed.`; $('charCount').textContent = String($('chatInput').value.length); $('chatInput').focus(); });
    $('quickAddTask').addEventListener('click', addTask); $('addTaskBtn').addEventListener('click', addTask); $('emptyAddBtn').addEventListener('click', addTask);
    $('taskForm').addEventListener('submit', saveNewTask); $('cancelTask').addEventListener('click', () => $('taskDialog').close());
    $('taskDialog').addEventListener('click', e => { if (e.target === $('taskDialog')) $('taskDialog').close(); });
    document.querySelectorAll('[data-filter]').forEach(el => el.addEventListener('click', () => { activeFilter = el.dataset.filter; document.querySelectorAll('[data-filter]').forEach(tab => tab.classList.toggle('selected', tab === el)); renderTasks(); }));
    $('taskSort').addEventListener('change', renderTasks);
    document.addEventListener('change', e => { if (e.target.matches('[data-toggle-task]')) toggleTask(e.target.dataset.toggleTask, e.target.checked); });
    document.addEventListener('click', e => { const btn = e.target.closest('[data-delete-task]'); if (btn && confirm('Delete this task?')) deleteTask(btn.dataset.deleteTask); });
    $('chatForm').addEventListener('submit', e => { e.preventDefault(); sendChat($('chatInput').value); });
    $('chatInput').addEventListener('input', () => $('charCount').textContent = String($('chatInput').value.length));
    $('clearChat').addEventListener('click', () => { if (busy) return; $('chatMessages').innerHTML = '<div class="message assistant-message"><div class="message-avatar">✦</div><div class="message-content"><div class="message-author">StudyPilot <span>JUST NOW</span></div><p>Conversation cleared. What would you like to work on next?</p></div></div>'; });
    $('generateStudy').addEventListener('click', generateStudy);
    $('openSettings').addEventListener('click', openSettings); $('topSettings').addEventListener('click', openSettings);
    $('saveSettings').addEventListener('click', () => {
      const candidate = $('settingsApiKey').value.trim();
      if (!candidate) { apiKey = ''; $('settingsStatus').textContent = 'No key entered. AI features remain disabled.'; showToast('No API key entered.'); return; }
      if (candidate.length < 20 || /\s/.test(candidate)) { $('settingsStatus').textContent = 'That key format looks unusual. Check that you copied the complete API key.'; return; }
      apiKey = candidate; // in-memory only
      try { localStorage.setItem(STORAGE.model, $('modelSelect').value); } catch {}
      $('settingsStatus').textContent = 'Key active in this tab. A key hardcoded in app.js remains in the source code.';
      showToast(`${AI_PROVIDER} key is active for this tab.`);
    });
    $('forgetKey').addEventListener('click', () => { apiKey = ''; $('settingsApiKey').value = ''; $('settingsStatus').textContent = 'Key forgotten from this page memory.'; showToast('API key cleared from page memory.'); });
    $('toggleKey').addEventListener('click', () => { const input = $('settingsApiKey'); input.type = input.type === 'password' ? 'text' : 'password'; $('toggleKey').textContent = input.type === 'password' ? 'Show' : 'Hide'; });
    $('mobileMenu').addEventListener('click', () => $('sidebar').classList.toggle('open'));
    $('settingsDialog').addEventListener('click', e => { if (e.target === $('settingsDialog')) $('settingsDialog').close(); });
    window.addEventListener('storage', e => { if ([STORAGE.count,STORAGE.times,STORAGE.day,STORAGE.tasks].includes(e.key)) { tasks = loadTasks(); renderTasks(); } });
    renderTasks(); renderUsage();
  }
  document.addEventListener('DOMContentLoaded', init);
})();
