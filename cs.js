// cs.js - 支持每个 Prompt 独立配置加粗关键词

const defaultPrompts = {
  解释: {
    content: '你是一个专业的术语解释专家。请用通俗易懂的语言解释用户选中的内容，简洁明了，最多100字。',
    boldKeywords: 'Definition:,解释:,例子:'
  },
  翻译: {
    content: '请将用户选中的内容翻译成中文，保持通顺自然。',
    boldKeywords: ''
  },
  代码: {
    content: '你是一个代码审查专家。请简洁解释这段代码的功能和潜在问题，最多80字。',
    boldKeywords: 'function:,class:,var:'
  },
  逻辑校验: {
    content: '你是一个条件逻辑专家。请帮我校验条件逻辑表达式的逻辑是否正确。解释需简洁明了，并提醒是否存在逻辑风险。最多100字。',
    boldKeywords: ''
  }
};

const defaultConfig = {
  prompts: {},
  currentMode: '解释',
  apiUrl: 'https://api.siliconflow.cn/v1/chat/completions',
  model: 'Qwen/Qwen2.5-7B-Instruct',
  apiKey: ''
};

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.text) {
    showBox(request.text);
  }
});

function showBox(text) {
  // 移除旧框
  const old = document.getElementById('clawai-box');
  if (old) old.remove();

  // 创建新框
  const box = document.createElement('div');
  box.id = 'clawai-box';
  box.style.cssText = `
    position: fixed; top: 10px; right: 10px;
    background: #ffffff; color: #333333;
    padding: 16px; border-radius: 8px;
    max-width: 350px; z-index: 99999;
    box-shadow: 0 4px 20px rgba(0,0,0,0.15);
    font-family: system-ui, sans-serif;
  `;
  box.innerHTML = `
    <div style="font-weight:bold; margin-bottom:8px;">🤖 AI正在思考...</div>
    <div style="font-size:12px; color:#666;">"${text.substring(0,30)}${text.length>30?'...':''}"</div>
    <div id="clawai-loading" style="margin-top:8px;">
      <span style="color:#4CAF50;">●</span> 联网请求中...
    </div>
  `;
  document.body.appendChild(box);

  // 调用 AI
  callAI(text)
    .then(result => {
      const tokenInfo = `
        <div style="margin-top:12px; padding-top:8px; border-top:1px solid #eee; font-size:11px; color:#888;">
          📊 Token消耗: ${result.promptTokens} (输入) + ${result.completionTokens} (输出) = <strong>${result.totalTokens}</strong>
        </div>
      `;
      box.innerHTML = `
        <div style="font-weight:bold; margin-bottom:8px;">💡 ${result.modeName}</div>
        <div style="font-size:13px; line-height:1.6; white-space: pre-wrap; max-height: 80vh; overflow-y: auto;">${result.content}</div>
        ${tokenInfo}
        <div style="margin-top:10px; font-size:11px; color:#666;">点击页面其他区域关闭</div>
      `;
    })
    .catch(err => {
      box.innerHTML = `
        <div style="font-weight:bold; margin-bottom:8px;">❌ 请求失败</div>
        <div style="font-size:12px; color:#ff6b6b;">${err.message}</div>
        <div style="margin-top:10px; font-size:11px; color:#666;">点击页面其他区域关闭</div>
      `;
    });
}

async function callAI(userQuery) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(defaultConfig, async (config) => {
      const apiKey = config.apiKey;
      const apiUrl = config.apiUrl;
      const model = config.model;
      const currentMode = config.currentMode || '解释';
      
      // 合并默认预设 + 用户预设
      const prompts = { ...defaultPrompts, ...config.prompts };
      
      // 兼容旧格式：如果是字符串，转换为对象格式
      Object.keys(prompts).forEach(key => {
        if (typeof prompts[key] === 'string') {
          prompts[key] = {
            content: prompts[key],
            boldKeywords: ''
          };
        }
      });
      
      const mode = currentMode;
      const promptData = prompts[mode];
      const customPrompt = promptData?.content || '';
      const boldKeywords = promptData?.boldKeywords || '';
      
      if (!apiKey) {
        reject(new Error('请先在扩展图标设置中配置 API Key'));
        return;
      }

      if (!apiUrl) {
        reject(new Error('API 地址未配置'));
        return;
      }

      if (!customPrompt) {
        reject(new Error('请先在设置中选择模式或填写自定义 Prompt'));
        return;
      }

      console.log('API 请求信息:', { apiUrl, model, apiKey: apiKey.substring(0, 10) + '...' });

      try {
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: model,
            messages: [
              { role: 'system', content: customPrompt },
              { role: 'user', content: userQuery }
            ],
            max_tokens: 200,
            temperature: 0.7
          })
        });

        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error?.message || 'API请求失败');
        }

        const data = await response.json();
        const usage = data.usage || {};
        
        // 处理换行和加粗
        let content = data.choices[0].message.content;
        content = processContent(content, boldKeywords, userQuery);
        
        resolve({
          content: content,
          promptTokens: usage.prompt_tokens || 0,
          completionTokens: usage.completion_tokens || 0,
          totalTokens: usage.total_tokens || 0,
          modeName: mode
        });
      } catch (err) {
        console.error('API 请求失败:', err);
        // 尝试解析错误信息
        let errorMsg = err.message || '未知错误';
        if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
          errorMsg = '网络请求失败，请检查网络或API配置';
        }
        reject(new Error(errorMsg));
      }
    });
  });
}

// 处理换行和加粗
function processContent(content, boldKeywords, userQuery) {
  // 换行
  content = content.replace(/\n/g, '<br>');
  
  if (!boldKeywords) return content;
  
  // 解析关键词列表
  const keywords = boldKeywords.split(',').map(k => k.trim()).filter(k => k);
  const hasQueryPlaceholder = keywords.includes('{{query}}');
  
  // 3. 加粗关键词（去掉后面的冒号）
  keywords.forEach(keyword => {
    if (keyword && keyword !== '{{query}}') {
      // 匹配 "关键词:" 或 "关键词 : "（后面的冒号和空格）
      const regex = new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*:\\s*', 'gi');
      content = content.replace(regex, `<strong>${keyword}</strong> `);
    }
  });
  
  // 4. 段落间距（标题之间加间距）
  content = content.replace(/<\/strong>(\s*)<br>/g, '</strong><br><br>');
  
  // 加粗用户查询的内容（避免替换已加粗的内容）
  if (hasQueryPlaceholder && userQuery) {
    // 转义用户查询中的特殊字符
    const escapedQuery = userQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // 使用负向先行/后行断言，避免替换 <strong> 标签内的内容
    const queryRegex = new RegExp(`(?<!<[^>]*)${escapedQuery}(?![^<]*)`, 'g');
    content = content.replace(queryRegex, `<strong>${userQuery}</strong>`);
  }
  
  // 段落之间添加间距
  content = content.replace(/<br><strong>/g, '</strong><br><br><strong>');
  
  return content;
}

// 点击其他地方关闭
document.addEventListener('click', (e) => {
  const box = document.getElementById('clawai-box');
  if (box && !box.contains(e.target)) {
    box.remove();
  }
});
