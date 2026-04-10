// popup.js - Prompt 独立配置加粗关键词版本

// 默认预设（不可删除）
const defaultPrompts = {
	解释: '你是一个专业的术语解释专家。请用通俗易懂的语言解释用户选中的内容，简洁明了，最多100字。',
	翻译: '请将用户选中的内容翻译成中文，保持通顺自然。',
	代码: '你是一个代码审查专家。请简洁解释这段代码的功能和潜在问题，最多80字。',
	逻辑校验: '你是一个条件逻辑专家。请帮我校验条件逻辑表达式的逻辑是否正确。解释需简洁明了，并提醒是否存在逻辑风险。最多100字。'
};

// 默认配置
const defaultConfig = {
  prompts: {},
  currentMode: '解释',
  apiUrl: 'https://api.siliconflow.cn/v1/chat/completions',
  model: 'Qwen/Qwen2.5-7B-Instruct',
  apiKey: ''
};

let promptsData = {};
let isEditing = false;
let editKey = null;

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  loadConfig();
  setupEvents();
});

function loadConfig() {
  chrome.storage.local.get(defaultConfig, (result) => {
    // 合并默认预设 + 用户预设
    promptsData = { ...defaultPrompts, ...result.prompts };
    
    // 兼容旧格式：如果是字符串，转换为对象格式
    Object.keys(promptsData).forEach(key => {
      if (typeof promptsData[key] === 'string') {
        promptsData[key] = {
          content: promptsData[key],
          boldKeywords: ''
        };
      }
    });
    
    // 保存到 storage（如果还没有 prompts 字段）
    if (!result.prompts || Object.keys(result.prompts).length === 0) {
      chrome.storage.local.set({ prompts: {} });
    }
    
    renderPromptList();
    renderModeSelect(result.currentMode);
    document.getElementById('model').value = result.model || '';
    document.getElementById('apiUrl').value = result.apiUrl || '';
    document.getElementById('apiKey').value = result.apiKey || '';
  });
}

function renderPromptList() {
  const list = document.getElementById('promptList');
  list.innerHTML = '';
  
  Object.keys(promptsData).forEach(key => {
    const isDefault = defaultPrompts.hasOwnProperty(key);
    const item = document.createElement('div');
    item.className = 'prompt-item';
    item.innerHTML = `
      <span class="prompt-name">${getIcon(key)} ${key}</span>
      <div class="prompt-actions">
        <button class="prompt-btn btn-edit" data-key="${key}">编辑</button>
        <button class="prompt-btn btn-del" data-key="${key}" ${isDefault ? 'disabled' : ''}>${isDefault ? '默认' : '删除'}</button>
      </div>
    `;
    list.appendChild(item);
  });
}

function renderModeSelect(currentMode) {
  const select = document.getElementById('mode');
  select.innerHTML = '';
  
  Object.keys(promptsData).forEach(key => {
    const option = document.createElement('option');
    option.value = key;
    option.textContent = getIcon(key) + ' ' + key;
    if (key === currentMode) option.selected = true;
    select.appendChild(option);
  });
}

function getIcon(key) {
  if (key === '解释') return '💡';
  if (key === '翻译') return '🌐';
  if (key === '代码') return '💻';
  if (key === '逻辑校验') return '🔍';
  return '✏️';
}

function setupEvents() {
  // 添加新 Prompt
  document.getElementById('addPromptBtn').addEventListener('click', () => {
    openModal('add');
  });
  
  // 编辑/删除 Prompt
  document.getElementById('promptList').addEventListener('click', (e) => {
    const key = e.target.dataset.key;
    if (!key) return;
    
    if (e.target.classList.contains('btn-edit')) {
      openModal('edit', key);
    } else if (e.target.classList.contains('btn-del')) {
      if (defaultPrompts.hasOwnProperty(key)) {
        alert('默认预设不可删除');
      } else if (confirm(`确定删除 "${key}" 吗？`)) {
        delete promptsData[key];
        renderPromptList();
        renderModeSelect(document.getElementById('mode').value);
      }
    }
  });
  
  // 弹窗按钮
  document.getElementById('cancelBtn').addEventListener('click', closeModal);
  document.getElementById('savePromptBtn').addEventListener('click', savePrompt);
  
  // 保存设置
  document.getElementById('saveBtn').addEventListener('click', saveConfig);
  
  // 导出配置
  document.getElementById('exportBtn').addEventListener('click', exportConfig);
  
  // 导入配置
  document.getElementById('importBtn').addEventListener('click', () => {
    document.getElementById('importFile').click();
  });
  document.getElementById('importFile').addEventListener('change', importConfig);
}

function openModal(type, key) {
  const modal = document.getElementById('editModal');
  const nameInput = document.getElementById('promptName');
  const contentInput = document.getElementById('promptContent');
  const boldInput = document.getElementById('promptBoldKeywords');
  const title = document.getElementById('modalTitle');
  
  if (type === 'add') {
    isEditing = false;
    editKey = null;
    title.textContent = '添加新 Prompt';
    nameInput.value = '';
    contentInput.value = '';
    boldInput.value = '{{query}}';
  } else {
    isEditing = true;
    editKey = key;
    title.textContent = '编辑 Prompt';
    nameInput.value = key;
    contentInput.value = promptsData[key].content;
    boldInput.value = promptsData[key].boldKeywords || '{{query}}';
  }
  
  modal.classList.add('show');
  nameInput.focus();
}

function closeModal() {
  document.getElementById('editModal').classList.remove('show');
}

function savePrompt() {
  const name = document.getElementById('promptName').value.trim();
  const content = document.getElementById('promptContent').value.trim();
  const boldKeywords = document.getElementById('promptBoldKeywords').value.trim();
  
  if (!name || !content) {
    alert('请填写名称和 Prompt 内容');
    return;
  }
  
  // 检查名称冲突（编辑时排除自己）
  if (promptsData[name] && (!isEditing || name !== editKey)) {
    alert('名称已存在，请使用其他名称');
    return;
  }
  
  // 如果是编辑，先删除旧 key
  if (isEditing && editKey !== name) {
    delete promptsData[editKey];
  }
  
  promptsData[name] = { content, boldKeywords };
  renderPromptList();
  renderModeSelect(document.getElementById('mode').value);
  closeModal();
}

function saveConfig() {
  const config = {
    prompts: promptsData,
    currentMode: document.getElementById('mode').value,
    model: document.getElementById('model').value.trim(),
    apiUrl: document.getElementById('apiUrl').value.trim(),
    apiKey: document.getElementById('apiKey').value.trim()
  };
  
  chrome.storage.local.set(config, () => {
    const btn = document.getElementById('saveBtn');
    btn.textContent = '✅ 已保存';
    setTimeout(() => {
      btn.textContent = '保存设置';
    }, 1500);
  });
}

// 导出配置
function exportConfig() {
  const config = {
    prompts: promptsData,
    currentMode: document.getElementById('mode').value,
    model: document.getElementById('model').value.trim(),
    apiUrl: document.getElementById('apiUrl').value.trim(),
    apiKey: document.getElementById('apiKey').value.trim(),
    exportTime: new Date().toISOString()
  };
  
  const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'clawai-config-' + new Date().toISOString().slice(0, 10) + '.json';
  a.click();
  URL.revokeObjectURL(url);
}

// 导入配置
function importConfig(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const config = JSON.parse(e.target.result);
      
      // 验证格式
      if (!config.prompts) {
        alert('无效的配置文件');
        return;
      }
      
      // 恢复配置
      promptsData = config.prompts;
      
      chrome.storage.local.set(config, () => {
        // 刷新页面显示
        document.getElementById('model').value = config.model || '';
        document.getElementById('apiUrl').value = config.apiUrl || '';
        document.getElementById('apiKey').value = config.apiKey || '';
        renderPromptList();
        renderModeSelect(config.currentMode || '解释');
        alert('✅ 配置导入成功！');
      });
    } catch (err) {
      alert('解析配置文件失败: ' + err.message);
    }
  };
  reader.readAsText(file);
  
  // 清空 input，允许重复导入同一文件
  event.target.value = '';
}
 
