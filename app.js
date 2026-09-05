const $ = selector => document.querySelector(selector);
const $$ = selector => document.querySelectorAll(selector);
const gateway = 'https://yyds.yy2hd.com/v1';

let project = localStorage.getItem('moyu-project') || '雨夜的第七封信';
let folderHandle = null;
let history = [];

const config = () => JSON.parse(localStorage.getItem('moyu-api') || '{}');

function openModal(html) {
  $('#modalContent').innerHTML = html;
  $('#modal').classList.add('open');
}

function closeModal() {
  $('#modal').classList.remove('open');
}

function addMessage(text, role = 'ai') {
  const message = document.createElement('div');
  message.className = `msg ${role}`;
  message.innerHTML = `
    <div class="badge">${role === 'user' ? '我' : '墨'}</div>
    <div>
      <div class="bubble"></div>
      <div class="tools"><button type="button">复制</button></div>
    </div>`;
  message.querySelector('.bubble').textContent = text;
  message.querySelector('.tools button').onclick = () => navigator.clipboard?.writeText(text);
  $('#messages').appendChild(message);
  $('#messages').scrollTop = $('#messages').scrollHeight;
  return message;
}

function showFile(name, text) {
  const empty = $('.empty');
  if (empty) empty.remove();
  const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const file = document.createElement('div');
  file.className = 'file';
  file.innerHTML = `▤ ${name}.md <small><a href="${url}" download="${name}.md">下载</a></small>`;
  $('#files').appendChild(file);
  if (folderHandle) {
    folderHandle.getFileHandle(`${name}.md`, { create: true })
      .then(handle => handle.createWritable())
      .then(async writer => { await writer.write(text); await writer.close(); })
      .catch(() => {});
  }
}

async function sendMessage(text) {
  if (!text.trim()) return;
  addMessage(text, 'user');
  $('#prompt').value = '';

  const current = config();
  if (!current.key || !current.model) {
    addMessage('请先点击右下角模型配置，填写 API Key 并选择模型。');
    return;
  }

  const loading = addMessage('正在思考…');
  const knowledge = JSON.parse(localStorage.getItem(`moyu-kb-${project}`) || '{}');
  const knowledgeText = Object.entries(knowledge)
    .filter(([, value]) => value)
    .map(([key, value]) => `${key}：${value}`)
    .join('\n');
  const style = localStorage.getItem('moyu-style') || '自然叙事';

  history.push({ role: 'user', content: text });
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        base: current.base || gateway,
        key: current.key,
        payload: {
          model: current.model,
          temperature: 0.8,
          messages: [
            { role: 'system', content: `你是私人小说写作伙伴。当前文风：${style}。\n小说资料：\n${knowledgeText}` },
            ...history.slice(-20)
          ]
        }
      })
    });
    const data = await response.json();
    loading.remove();
    if (!response.ok || data.error) throw new Error(data.error?.message || `HTTP ${response.status}`);
    const answer = data.choices?.[0]?.message?.content || '模型没有返回内容。';
    history.push({ role: 'assistant', content: answer });
    addMessage(answer);
    showFile('ai-output', answer);
  } catch (error) {
    loading.remove();
    addMessage(`连接失败：${error.message}`);
  }
}

$('#settings').onclick = () => {
  const saved = config();
  openModal(`
    <h3>模型连接设置</h3>
    <p>Key 仅保存在本机浏览器。</p>
    <label>API Base URL</label><input id="base" value="${saved.base || gateway}">
    <label>API Key</label><input id="key" type="password" value="${saved.key || ''}">
    <label>模型名称</label><select id="modelName"><option>${saved.model || '请先读取模型'}</option></select>
    <button class="small" id="read" type="button">读取可用模型</button>
    <div class="actions"><button class="small" id="cancel">取消</button><button class="primary" id="save">保存配置</button></div>`);

  $('#cancel').onclick = closeModal;
  $('#read').onclick = async () => {
    try {
      const response = await fetch('/api/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base: $('#base').value.trim() || gateway, key: $('#key').value.trim() })
      });
      const data = await response.json();
      const models = (data.data || data.models || []).map(item => item.id || item).filter(Boolean);
      if (!models.length) throw new Error('未返回模型');
      $('#modelName').innerHTML = models.map(model => `<option value="${model}">${model}</option>`).join('');
    } catch (error) {
      alert(`读取失败：${error.message}`);
    }
  };
  $('#save').onclick = () => {
    const value = { base: $('#base').value.trim() || gateway, key: $('#key').value.trim(), model: $('#modelName').value };
    localStorage.setItem('moyu-api', JSON.stringify(value));
    $('#modelLabel').textContent = `模型：${value.model}`;
    closeModal();
  };
};

$('#send').onclick = () => sendMessage($('#prompt').value);
$('#prompt').onkeydown = event => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    sendMessage(event.target.value);
  }
};

$$('.quick [data-action]').forEach(button => {
  button.onclick = () => sendMessage(`请帮我${button.dataset.action}当前内容。`);
});

$('#attach').onclick = () => $('#file').click();
$('#file').onchange = async event => {
  for (const file of [...event.target.files]) {
    const row = document.createElement('div');
    row.className = 'file';
    row.textContent = `▣ ${file.name}`;
    $('#files').appendChild(row);
    if (/\.(txt|md)$/i.test(file.name)) $('#prompt').value = await file.text();
    else addMessage(`已添加 ${file.name}，后续可交给支持该格式的模型解析。`);
  }
};

$('#rightToggle').onclick = () => {
  $('#filePanel').style.display = $('#filePanel').style.display === 'none' ? 'block' : 'none';
};
$('#closeFiles').onclick = () => { $('#filePanel').style.display = 'none'; };

$('#theme').onclick = () => {
  document.body.classList.toggle('dark');
  $('#theme').textContent = document.body.classList.contains('dark') ? '☼ 明亮' : '☾ 黑色';
};

$('#newProject').onclick = async () => {
  const name = prompt('项目名称', '未命名小说');
  if (!name) return;
  project = name;
  localStorage.setItem('moyu-project', name);
  $('#projectTitle').textContent = name;
  if (!window.showDirectoryPicker) return;
  try {
    folderHandle = await showDirectoryPicker({ mode: 'readwrite' });
    const file = await folderHandle.getFileHandle('chapter-01.md', { create: true });
    const writer = await file.createWritable();
    await writer.write(`# ${name}\n\n`);
    await writer.close();
  } catch { addMessage('项目已创建，但没有选择文件夹。'); }
};

$('#styleBtn').onclick = () => {
  const style = prompt('输入作家或文风特征', localStorage.getItem('moyu-style') || '自然叙事');
  if (style) {
    localStorage.setItem('moyu-style', style);
    $('#styleBtn').textContent = `文风：${style}`;
  }
};

$('#kbBtn').onclick = () => {
  const names = ['人物卡', '世界观', '时间线', '章节大纲', '伏笔记录'];
  const old = JSON.parse(localStorage.getItem(`moyu-kb-${project}`) || '{}');
  openModal(`<h3>小说资料库</h3><p>这些资料会自动用于后续创作。</p>${names.map(name => `<label>${name}</label><textarea data-k="${name}">${old[name] || ''}</textarea>`).join('')}<div class="actions"><button class="primary" id="saveKb">保存资料</button></div>`);
  $('#saveKb').onclick = () => {
    const value = {};
    $('#modalContent').querySelectorAll('[data-k]').forEach(input => { value[input.dataset.k] = input.value; });
    localStorage.setItem(`moyu-kb-${project}`, JSON.stringify(value));
    closeModal();
  };
};

if (config().model) $('#modelLabel').textContent = `模型：${config().model}`;
if (localStorage.getItem('moyu-style')) $('#styleBtn').textContent = `文风：${localStorage.getItem('moyu-style')}`;
