// ============================================================
// 好奇驿站 - 问卷调查功能
// 基于信封投递框架改造
// ============================================================

// ---------- 数据模型 ----------
let curiosityData = { ing: [], archived: [] }; // 两个数组分别存放进行中和已归档的问卷
let currentCuriosityTab = 'ing';
let editingCuriosityId = null;

// 默认示例数据（首次打开时自动添加）
const DEFAULT_SAMPLES = [
    {
        id: 'sample_1_' + Date.now(),
        title: '关于你的一切',
        questions: [
            { text: '你最喜欢的颜色？', type: 'single', options: ['红色', '蓝色', '绿色', '其他'] },
            { text: '你平时喜欢做什么？', type: 'multiple', options: ['看书', '运动', '音乐', '旅行'] },
            { text: '你对我的第一印象？', type: 'single', options: ['温柔', '有趣', '高冷', '可爱'] }
        ],
        sentTime: Date.now() - 3600000 * 2, // 2小时前
        status: 'ing' // 'ing' 或 'archived'
    },
    {
        id: 'sample_2_' + Date.now(),
        title: '我们的未来',
        questions: [
            { text: '你希望我们多久见一次面？', type: 'single', options: ['每天', '每周', '每月', '随缘'] },
            { text: '你最想和我一起做的事？', type: 'multiple', options: ['看电影', '旅行', '做饭', '聊天'] }
        ],
        sentTime: Date.now() - 3600000 * 48, // 48小时前
        status: 'archived'
    }
];

// ---------- 存储操作 ----------
async function loadCuriosityData() {
    const saved = await localforage.getItem(getStorageKey('curiosityData'));
    if (saved) {
        curiosityData = saved;
    } else {
        // 首次使用，添加示例数据
        curiosityData = { ing: [], archived: [] };
        DEFAULT_SAMPLES.forEach(sample => {
            if (sample.status === 'ing') curiosityData.ing.push(sample);
            else curiosityData.archived.push(sample);
        });
        await saveCuriosityData();
    }
}

function saveCuriosityData() {
    localforage.setItem(getStorageKey('curiosityData'), curiosityData);
}

// ---------- 打开主模态框 ----------
window.openCuriosityModal = async function() {
    await loadCuriosityData();
    currentCuriosityTab = 'ing';
    document.getElementById('curiosity-tab-ing').classList.add('active');
    document.getElementById('curiosity-tab-archived').classList.remove('active');
    document.getElementById('curiosity-ing-section').style.display = 'block';
    document.getElementById('curiosity-archived-section').style.display = 'none';
    document.getElementById('curiosity-compose-form').style.display = 'none';
    document.getElementById('curiosity-main-close-btn').style.display = 'flex';
    renderCuriosityLists();
    showModal(document.getElementById('curiosity-modal'));
};

// ---------- 标签切换 ----------
window.switchCuriosityTab = function(tab) {
    currentCuriosityTab = tab;
    document.getElementById('curiosity-tab-ing').classList.toggle('active', tab === 'ing');
    document.getElementById('curiosity-tab-archived').classList.toggle('active', tab === 'archived');
    document.getElementById('curiosity-ing-section').style.display = tab === 'ing' ? 'block' : 'none';
    document.getElementById('curiosity-archived-section').style.display = tab === 'archived' ? 'block' : 'none';
    document.getElementById('curiosity-compose-form').style.display = 'none';
    document.getElementById('curiosity-main-close-btn').style.display = 'flex';
    renderCuriosityLists();
};

// ---------- 渲染列表 ----------
function renderCuriosityLists() {
    renderCuriosityList('ing');
    renderCuriosityList('archived');
}

function renderCuriosityList(status) {
    const listId = status === 'ing' ? 'curiosity-ing-list' : 'curiosity-archived-list';
    const list = document.getElementById(listId);
    if (!list) return;

    // 注意：所有卡片现在都在 ing 中，archived 暂时为空
    const data = status === 'ing' ? curiosityData.ing : curiosityData.archived;

    if (data.length === 0) {
        const emptyMsg = status === 'ing'
            ? '你对Ta有哪些好奇的问题呢，快用问卷问问Ta吧~'
            : '还没有收到回复，对方正在认真选择中，请稍候~';
        list.innerHTML = `
            <div class="env-empty">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2">
                    <rect x="2" y="4" width="20" height="16" rx="2"/>
                    <path d="M22 7l-10 7L2 7"/>
                    <polyline points="22 13 12 13"/>
                    <path d="M19 16l-5-3-5 3"/>
                </svg>
                <div style="font-size:14px;font-weight:500;margin-top:4px;">${emptyMsg}</div>
            </div>
        `;
        return;
    }

    list.innerHTML = data.slice().reverse().map(letter => {
        const date = new Date(letter.sentTime).toLocaleDateString('zh-CN', {
            month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });
        
        // 统计题目类型
        let singleCount = 0, multiCount = 0;
        (letter.questions || []).forEach(q => {
            if (q.type === 'single') singleCount++;
            else if (q.type === 'multiple') multiCount++;
        });
        const qCount = (letter.questions || []).length;
        
        // 判断版本和状态
        const isVersion2 = letter.version === 2;
        const isNew = letter.isNew || false;  // 只有2.0才有红点
        const hasResult = isVersion2;  // 2.0 表示已有回复
        
        // 状态文字
        let statusText = '';
        if (isVersion2) {
            // 统计回答情况
            const answered = (letter.questions || []).filter(q => q._status === 'answered').length;
            const total = (letter.questions || []).length;
            statusText = `✅ 已收到回复 · ${answered}/${total} 已答`;
        } else {
            statusText = '⏳ 等待回复中';
        }
        
        // 标题 + 统计（两行）
        const titleHtml = `<div style="font-weight:700;font-size:14px;color:var(--text-primary);">${escapeHtml(letter.title)}</div>`;
        const statsHtml = `<div style="font-size:12px;color:var(--text-secondary);margin-top:2px;">共${qCount}问 · ${singleCount}道单选 · ${multiCount}道多选</div>`;
        
        // 红点（仅2.0且未查看）
        const redDot = (isVersion2 && isNew) 
            ? `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#ff4757;margin-left:6px;flex-shrink:0;box-shadow:0 0 8px rgba(255,71,87,0.5);"></span>` 
            : '';

        return `
            <div class="env-letter-item curiosity-letter-item ${isVersion2 && isNew ? 'env-letter-new' : ''}" onclick="viewCuriosityLetter('${status}','${letter.id}')">
                <div class="env-letter-header curiosity-compact-header">
                    <div class="env-letter-header-from">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px;margin-right:4px;">
                            <rect x="2" y="4" width="20" height="16" rx="2"/>
                            <path d="M22 7l-10 7L2 7"/>
                        </svg>
                        投递 · ${date}
                        ${redDot}
                    </div>
                    <span style="font-size:18px;line-height:1;flex-shrink:0;">${isVersion2 ? '📨' : '📮'}</span>
                </div>
                <div class="env-letter-body" style="padding:8px 12px 8px;">
                    ${titleHtml}
                    ${statsHtml}
                    <div class="env-letter-status" style="font-size:11px;color:var(--accent-color);margin-top:6px;">
                        ${statusText}
                    </div>
                </div>
                <button class="env-letter-delete-btn" onclick="deleteCuriosityLetter(event,'${status}','${letter.id}')">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"/>
                        <line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                </button>
            </div>
        `;
    }).join('');
}


// ---------- 查看详情（占位） ----------
window.viewCuriosityLetter = function(status, id) {
    // 从 ing 中查找（所有卡片都在 ing 中）
    const letter = curiosityData.ing.find(l => l.id === id);
    if (!letter) {
        showNotification('问卷不存在', 'error');
        return;
    }
    
    // 如果是2.0且未查看，标记为已查看（取消红点）
    if (letter.version === 2 && letter.isNew) {
        letter.isNew = false;
        saveCuriosityData();
        renderCuriosityLists();
    }
    
    // 打开详情页面（复用编辑器，但设为只读模式）
    openCuriosityDetail(letter);
};

window.openNewCuriosityForm = function() {
    // 直接打开编辑器，不关闭主模态框
    openCuriosityCompose();
};

// ---------- 取消创建（回到列表） ----------
window.cancelCuriosityCompose = function() {
    document.getElementById('curiosity-compose-form').style.display = 'none';
    document.getElementById('curiosity-main-close-btn').style.display = 'flex';
    if (currentCuriosityTab === 'ing') {
        document.getElementById('curiosity-ing-section').style.display = 'block';
    } else {
        document.getElementById('curiosity-archived-section').style.display = 'block';
    }
};

// ---------- 关闭模态框 ----------
window.closeCuriosityModal = function() {
    hideModal(document.getElementById('curiosity-modal'));
};

// ============================================================
// 创建问卷 - 编辑页面（类似信封详情弹窗）
// ============================================================

// 当前编辑中的问卷数据
let editingQuestionnaire = {
    title: '',
    questions: [],
    createdTime: Date.now()
};

// 打开创建问卷编辑器
window.openCuriosityCompose = function() {
    editingQuestionnaire = {
        title: '未命名问卷',
        questions: [],
        createdTime: Date.now(),
        _isReadOnly: false,   // 新建时为可编辑
        _version: 1
    };
    renderComposeEditor();
    showModal(document.getElementById('curiosity-compose-modal'));
};


// 渲染编辑器内容
function renderComposeEditor() {
    // 如果是只读模式，调用只读渲染
    if (editingQuestionnaire._isReadOnly) {
        renderComposeEditorReadOnly();
        return;
    }
    const titleEl = document.getElementById('compose-title-display');
    const dateEl = document.getElementById('compose-date-line');
    const questionsContainer = document.getElementById('compose-questions-container');
    
    // 设置标题
    if (titleEl) {
        titleEl.textContent = editingQuestionnaire.title || '未命名问卷';
    }
    
    // 设置日期
    if (dateEl) {
        const now = new Date(editingQuestionnaire.createdTime);
        const y = now.getFullYear();
        const mo = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
        dateEl.textContent = `${y}/${mo}/${d} 星期${weekdays[now.getDay()]}`;
    }
    
    // 渲染题目列表
    if (questionsContainer) {
        const questions = editingQuestionnaire.questions || [];
        
        if (questions.length === 0) {
            questionsContainer.innerHTML = `
                <div style="text-align:center;padding:40px 10px;color:var(--text-secondary);font-size:14px;font-style:italic;opacity:0.6;line-height:1.8;">
                    Deepen mutual understanding<br>and bring each other closer
                </div>
            `;
            return;
        }
        
        let html = '';
        questions.forEach((q, index) => {
            const typeLabel = q.type === 'single' ? '单选' : '多选';
            const optionsHtml = (q.options || []).map((opt, oi) => 
                `<div style="display:flex;align-items:center;gap:6px;padding:2px 0 2px 6px;font-size:13px;color:var(--text-secondary);">
                    <span style="display:inline-block;width:12px;height:12px;border-radius:50%;border:1.5px solid rgba(var(--accent-color-rgb),0.25);flex-shrink:0;"></span>
                    <span>${escapeHtml(opt)}</span>
                </div>`
            ).join('');
            
            html += `
                <div class="compose-question-card" onclick="openQuestionEditorForEdit(${index})" style="margin-bottom:0;padding:14px 32px 12px 0px;cursor:pointer;position:relative;border-bottom:1.5px dashed rgba(var(--accent-color-rgb),0.15);overflow:visible;">
                    <!-- 第一行：Q1 + 小圆点 + 类型标签 -->
                    <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
                        <span style="font-size:13px;font-weight:700;color:var(--accent-color);letter-spacing:0.5px;">Q${index + 1}</span>
                        <span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:rgba(var(--accent-color-rgb),0.5);flex-shrink:0;"></span>
                        <span style="font-size:10px;color:var(--text-secondary);opacity:0.7;background:rgba(var(--accent-color-rgb),0.06);padding:0 8px;border-radius:10px;border:1px solid rgba(var(--accent-color-rgb),0.08);">${typeLabel}</span>
                    </div>
                    <!-- 第二行：题目 -->
                    <div style="font-size:14px;font-weight:500;color:var(--text-primary);line-height:1.5;padding-left:16px;margin-bottom:4px;">
                        ${escapeHtml(q.text)}
                    </div>
                    <!-- 选项列表 -->
                    <div style="padding-left:16px;margin-top:2px;">
                        ${optionsHtml}
                    </div>
                    <!-- 删除按钮 -->
                    <button onclick="event.stopPropagation();deleteQuestion(${index})" style="position:absolute;top:12px;right:4px;background:none;border:none;color:var(--text-secondary);cursor:pointer;font-size:11px;opacity:0.25;padding:4px;transition:opacity 0.2s;" onmouseover="this.style.opacity='0.7'" onmouseout="this.style.opacity='0.25'">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                </div>
            `;
        });
        questionsContainer.innerHTML = html;
    }
}

// ---------- 标题点击编辑 ----------
window.editComposeTitle = function() {
    const currentTitle = editingQuestionnaire.title || '未命名问卷';
    const newTitle = prompt('请输入问卷标题：', currentTitle);
    if (newTitle !== null && newTitle.trim() !== '') {
        editingQuestionnaire.title = newTitle.trim();
        const titleEl = document.getElementById('compose-title-display');
        if (titleEl) titleEl.textContent = editingQuestionnaire.title;
    }
};

window.composeAction = function(action) {
    if (action === 'submit') {
        // 投递
        handleDelivery();
        return;
    }
    
    const messages = {
        'draft': '📝 草稿保存功能开发中，敬请期待 ✦',
        'confirm': '✅ 确认功能开发中，敬请期待 ✦'
    };
    showNotification(messages[action] || '功能开发中 ✦', 'info', 2500);
};

// ---------- 关闭编辑器 ----------
window.closeCuriosityCompose = function() {
    hideModal(document.getElementById('curiosity-compose-modal'));
};

// ============================================================
// 问题编辑弹窗（点击“编辑”键或点击问题卡片触发）
// ============================================================

// 当前正在编辑的问题索引（-1 表示新建）
let editingQuestionIndex = -1;
// 编辑中的临时数据
let tempQuestionData = {
    text: '',
    type: 'single',
    options: ['', '']
};

// 打开问题编辑器（新建）
window.openQuestionEditor = function() {
    // 检查是否已达8个问题上限
    if ((editingQuestionnaire.questions || []).length >= 8) {
        showNotification('最多只能添加 8 个问题 ✦', 'warning', 2500);
        return;
    }
    
    editingQuestionIndex = -1;
    tempQuestionData = {
        text: '',
        type: 'single',
        options: ['', '']
    };
    renderQuestionEditor();
    showModal(document.getElementById('question-editor-modal'));
};

// 打开问题编辑器（编辑已有问题）
window.openQuestionEditorForEdit = function(index) {
    const q = editingQuestionnaire.questions[index];
    if (!q) return;
    
    editingQuestionIndex = index;
    tempQuestionData = {
        text: q.text || '',
        type: q.type || 'single',
        options: [...(q.options || ['', ''])]
    };
    // 确保至少有两个选项
    while (tempQuestionData.options.length < 2) {
        tempQuestionData.options.push('');
    }
    renderQuestionEditor();
    showModal(document.getElementById('question-editor-modal'));
};

// 渲染问题编辑弹窗
function renderQuestionEditor() {
    const textInput = document.getElementById('qe-text-input');
    const charCount = document.getElementById('qe-char-count');
    
    // 填充问题内容
    if (textInput) {
        textInput.value = tempQuestionData.text || '';
        textInput.dispatchEvent(new Event('input'));
        if (charCount) charCount.textContent = (tempQuestionData.text || '').length + '/100';
    }
    
    // 设置类型（带视觉反馈）
    const singleBtn = document.getElementById('qe-type-single-btn');
    const multipleBtn = document.getElementById('qe-type-multiple-btn');
    const isSingle = tempQuestionData.type === 'single';
    
    if (isSingle) {
        singleBtn.classList.add('active');
        singleBtn.classList.remove('inactive');
        multipleBtn.classList.remove('active');
        multipleBtn.classList.add('inactive');
        if (document.getElementById('qe-type-single')) document.getElementById('qe-type-single').checked = true;
        if (document.getElementById('qe-type-multiple')) document.getElementById('qe-type-multiple').checked = false;
    } else {
        multipleBtn.classList.add('active');
        multipleBtn.classList.remove('inactive');
        singleBtn.classList.remove('active');
        singleBtn.classList.add('inactive');
        if (document.getElementById('qe-type-single')) document.getElementById('qe-type-single').checked = false;
        if (document.getElementById('qe-type-multiple')) document.getElementById('qe-type-multiple').checked = true;
    }
    
    // 渲染选项
    renderQuestionOptions();
}

// 渲染选项列表
function renderQuestionOptions() {
    const container = document.getElementById('qe-options-container');
    if (!container) return;
    
    const options = tempQuestionData.options || [];
    const labels = 'ABCDEFGH';
    
    let html = '';
    options.forEach((opt, index) => {
        html += `
            <div class="qe-option-row" data-index="${index}">
                <span class="qe-option-label">${labels[index] || '?'}</span>
                <input class="qe-option-input" type="text" value="${escapeHtml(opt)}" placeholder="选项 ${labels[index]}" maxlength="50" oninput="updateTempOption(${index}, this.value)">
                <button class="qe-option-delete" onclick="removeTempOption(${index})" ${options.length <= 2 ? 'disabled style="opacity:0.3;cursor:not-allowed;"' : ''}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
            </div>
        `;
    });
    
    // 添加“+添加选项”按钮（最多8个）
    const canAdd = options.length < 8;
    html += `
        <button class="qe-add-option-btn" onclick="addTempOption()" ${!canAdd ? 'disabled style="opacity:0.4;cursor:not-allowed;"' : ''}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            添加选项
        </button>
    `;
    
    container.innerHTML = html;
}

// 工具：HTML 转义
function escapeHtml(text) {
    if (!text) return '';
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// 更新临时选项内容
window.updateTempOption = function(index, value) {
    if (tempQuestionData.options && tempQuestionData.options[index] !== undefined) {
        tempQuestionData.options[index] = value;
    }
};

// 添加临时选项
window.addTempOption = function() {
    if ((tempQuestionData.options || []).length >= 8) {
        showNotification('最多 8 个选项', 'warning', 1500);
        return;
    }
    tempQuestionData.options.push('');
    renderQuestionOptions();
};

// 删除临时选项
window.removeTempOption = function(index) {
    if ((tempQuestionData.options || []).length <= 2) {
        showNotification('至少保留 2 个选项', 'warning', 1500);
        return;
    }
    tempQuestionData.options.splice(index, 1);
    renderQuestionOptions();
};

// 切换问题类型（带视觉反馈）
window.setQuestionType = function(type) {
    tempQuestionData.type = type;
    
    const singleBtn = document.getElementById('qe-type-single-btn');
    const multipleBtn = document.getElementById('qe-type-multiple-btn');
    
    // 更新按钮样式
    if (type === 'single') {
        singleBtn.classList.add('active');
        singleBtn.classList.remove('inactive');
        multipleBtn.classList.remove('active');
        multipleBtn.classList.add('inactive');
        document.getElementById('qe-type-single').checked = true;
        document.getElementById('qe-type-multiple').checked = false;
    } else {
        multipleBtn.classList.add('active');
        multipleBtn.classList.remove('inactive');
        singleBtn.classList.remove('active');
        singleBtn.classList.add('inactive');
        document.getElementById('qe-type-single').checked = false;
        document.getElementById('qe-type-multiple').checked = true;
    }
};

// 保存问题
window.saveQuestion = function() {
    const text = (document.getElementById('qe-text-input')?.value || '').trim();
    const type = tempQuestionData.type || 'single';
    const options = tempQuestionData.options.filter(opt => opt.trim() !== '');
    
    // 校验
    if (!text) {
        showNotification('请填写问题内容 ✦', 'warning', 2000);
        return;
    }
    if (options.length < 2) {
        showNotification('至少需要 2 个选项 ✦', 'warning', 2000);
        return;
    }
    
    // 构建问题对象
    const questionData = {
        id: 'q_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        text: text,
        type: type,
        options: options
    };
    
    if (editingQuestionIndex === -1) {
        // 新建
        editingQuestionnaire.questions.push(questionData);
        showNotification('问题已添加 ✦', 'success', 1500);
    } else {
        // 编辑
        const oldId = editingQuestionnaire.questions[editingQuestionIndex]?.id || questionData.id;
        questionData.id = oldId;
        editingQuestionnaire.questions[editingQuestionIndex] = questionData;
        showNotification('问题已更新 ✦', 'success', 1500);
    }
    
    // 关闭弹窗并刷新编辑器
    hideModal(document.getElementById('question-editor-modal'));
    renderComposeEditor();
};

// 关闭问题编辑器（不保存）
window.closeQuestionEditor = function() {
    hideModal(document.getElementById('question-editor-modal'));
};

// 删除整个问题（从问卷中移除）
window.deleteQuestion = function(index) {
    if (!confirm('确定要删除这个问题吗？')) return;
    editingQuestionnaire.questions.splice(index, 1);
    renderComposeEditor();
    showNotification('问题已删除', 'success', 1500);
};

// ============================================================
// 问卷详情查看（只读模式）
// ============================================================

// 打开问卷详情（只读模式）
window.openCuriosityDetail = function(questionnaire) {
    // 将当前问卷数据设为编辑数据（只读模式）
    editingQuestionnaire = {
        title: questionnaire.title || '未命名问卷',
        questions: JSON.parse(JSON.stringify(questionnaire.questions || [])),
        createdTime: questionnaire.sentTime || Date.now(),
        _isReadOnly: true,           // 标记为只读
        _version: questionnaire.version || 1,
        _result: questionnaire.version === 2 ? questionnaire : null  // 2.0 带结果
    };
    
    // 渲染编辑器（只读模式）
    renderComposeEditorReadOnly();
    showModal(document.getElementById('curiosity-compose-modal'));
};

// 只读模式渲染（显示回复结果）
function renderComposeEditorReadOnly() {
    const titleEl = document.getElementById('compose-title-display');
    const dateEl = document.getElementById('compose-date-line');
    const questionsContainer = document.getElementById('compose-questions-container');
    const isReadOnly = editingQuestionnaire._isReadOnly || false;
    const isVersion2 = editingQuestionnaire._version === 2;
    
    // 设置标题（只读，不可点击编辑）
    if (titleEl) {
        titleEl.textContent = editingQuestionnaire.title || '未命名问卷';
        // 移除点击编辑功能
        const parent = titleEl.parentElement;
        if (parent) {
            parent.style.cursor = 'default';
            parent.onclick = null;
        }
        // 移除"点击修改"提示
        const hint = parent ? parent.querySelector('span:last-child') : null;
        if (hint && hint.textContent && hint.textContent.includes('点击修改')) {
            hint.style.display = 'none';
        }
        // 去掉下划线
        titleEl.style.borderBottom = 'none';
    }
    
    // 设置日期
    if (dateEl) {
        const now = new Date(editingQuestionnaire.createdTime);
        const y = now.getFullYear();
        const mo = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
        dateEl.textContent = `${y}/${mo}/${d} 星期${weekdays[now.getDay()]}`;
    }
    
    // 渲染题目列表（带回复状态）
    if (questionsContainer) {
        const questions = editingQuestionnaire.questions || [];
        
        if (questions.length === 0) {
            questionsContainer.innerHTML = `
                <div style="text-align:center;padding:40px 10px;color:var(--text-secondary);font-size:14px;font-style:italic;opacity:0.6;line-height:1.8;">
                    这份问卷还没有添加问题
                </div>
            `;
            return;
        }
        
        let html = '';
        questions.forEach((q, index) => {
            const typeLabel = q.type === 'single' ? '单选' : '多选';
            const isAnswered = q._status === 'answered';
            const isSkipped = q._status === 'skipped';
            const isRefused = q._status === 'refused';
            const isTimeout = q._status === 'timeout';
            
            // 圆点颜色
            let dotColor = 'rgba(var(--accent-color-rgb),0.15)'; // 默认灰色
            if (isVersion2) {
                if (isAnswered) dotColor = '#4CAF50';      // 绿色
                else if (isSkipped) dotColor = '#FF9800';  // 橙色
                else if (isRefused) dotColor = '#9C27B0';  // 深紫色
                else if (isTimeout) dotColor = 'rgba(var(--accent-color-rgb),0.15)'; // 不变
            }
            
            // 选项渲染（带填充状态）
            const selectedOptions = q._selectedOptions || [];
            const optionsHtml = (q.options || []).map((opt, oi) => {
                const isSelected = selectedOptions.includes(opt);
                const fillColor = isSelected ? 'var(--accent-color)' : 'transparent';
                return `
                    <div style="display:flex;align-items:center;gap:6px;padding:2px 0 2px 6px;font-size:13px;color:var(--text-secondary);">
                        <span style="display:inline-block;width:12px;height:12px;border-radius:50%;border:1.5px solid rgba(var(--accent-color-rgb),0.25);flex-shrink:0;background:${fillColor};transition:background 0.3s;"></span>
                        <span>${escapeHtml(opt)}</span>
                    </div>
                `;
            }).join('');
            
            // 反问标记
            const partnerName = (typeof settings !== 'undefined' && settings.partnerName) || '梦角';
            const askedBackHtml = (isVersion2 && q._askedBack) 
                ? `<div style="font-size:11px;color:var(--accent-color);margin-top:4px;padding-left:22px;font-style:italic;opacity:0.8;">${partnerName}同问 ✦</div>`
                : '';
            
            // 状态标签（仅2.0显示）
            let statusLabel = '';
            if (isVersion2) {
                if (isAnswered) statusLabel = `<span style="font-size:9px;color:#4CAF50;background:rgba(76,175,80,0.1);padding:0 6px;border-radius:8px;border:1px solid rgba(76,175,80,0.2);">已答</span>`;
                else if (isSkipped) statusLabel = `<span style="font-size:9px;color:#FF9800;background:rgba(255,152,0,0.1);padding:0 6px;border-radius:8px;border:1px solid rgba(255,152,0,0.2);">暂未答</span>`;
                else if (isRefused) statusLabel = `<span style="font-size:9px;color:#9C27B0;background:rgba(156,39,176,0.1);padding:0 6px;border-radius:8px;border:1px solid rgba(156,39,176,0.2);">拒绝</span>`;
                else if (isTimeout) statusLabel = `<span style="font-size:9px;color:var(--text-secondary);background:var(--primary-bg);padding:0 6px;border-radius:8px;border:1px solid var(--border-color);">超时</span>`;
            }
            
            html += `
                <div class="compose-question-card" style="margin-bottom:0;padding:14px 32px 12px 0px;position:relative;border-bottom:1.5px dashed rgba(var(--accent-color-rgb),0.15);overflow:visible;${isReadOnly ? 'cursor:default;' : ''}">
                    <!-- 第一行：Q1 + 小圆点 + 类型标签 + 状态标签 -->
                    <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;flex-wrap:wrap;">
                        <span style="font-size:13px;font-weight:700;color:var(--accent-color);letter-spacing:0.5px;">Q${index + 1}</span>
                        <span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${dotColor};flex-shrink:0;transition:background 0.3s;"></span>
                        <span style="font-size:10px;color:var(--text-secondary);opacity:0.7;background:rgba(var(--accent-color-rgb),0.06);padding:0 8px;border-radius:10px;border:1px solid rgba(var(--accent-color-rgb),0.08);">${typeLabel}</span>
                        ${statusLabel}
                    </div>
                    <!-- 第二行：题目 -->
                    <div style="font-size:14px;font-weight:500;color:var(--text-primary);line-height:1.5;padding-left:16px;margin-bottom:4px;">
                        ${escapeHtml(q.text)}
                    </div>
                    <!-- 选项列表 -->
                    <div style="padding-left:16px;margin-top:2px;">
                        ${optionsHtml}
                    </div>
                    ${askedBackHtml}
                    ${isReadOnly ? '' : `<button onclick="event.stopPropagation();deleteQuestion(${index})" style="position:absolute;top:12px;right:4px;background:none;border:none;color:var(--text-secondary);cursor:pointer;font-size:11px;opacity:0.25;padding:4px;transition:opacity 0.2s;" onmouseover="this.style.opacity='0.7'" onmouseout="this.style.opacity='0.25'">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>`}
                </div>
            `;
        });
        questionsContainer.innerHTML = html;
    }
    
    // 修改底部按钮：只保留"返回"
    const bottomArea = document.querySelector('#curiosity-compose-modal .env-wrapper > div:last-child');
    if (bottomArea && isReadOnly) {
        bottomArea.innerHTML = `
            <div style="display:flex;gap:10px;padding:12px 18px 16px;border-top:1px solid var(--border-color);flex-shrink:0;flex-wrap:wrap;">
                <button onclick="closeCuriosityCompose()" style="flex:1;min-width:60px;padding:11px 0;font-size:13px;font-weight:600;border:1.5px solid var(--border-color);border-radius:12px;background:transparent;color:var(--text-secondary);cursor:pointer;font-family:var(--font-family);display:flex;align-items:center;justify-content:center;gap:6px;">
                    <i class="fas fa-arrow-left" style="font-size:13px;"></i> 返回
                </button>
            </div>
        `;
    } else if (bottomArea && !isReadOnly) {
        // 非只读模式，保持原有按钮
        bottomArea.innerHTML = `
            <div style="display:flex;gap:10px;padding:12px 18px 16px;border-top:1px solid var(--border-color);flex-shrink:0;flex-wrap:wrap;">
                <button onclick="composeAction('submit')" style="flex:1;min-width:60px;padding:11px 0;font-size:13px;font-weight:600;border:none;border-radius:12px;background:var(--accent-color);color:#fff;cursor:pointer;font-family:var(--font-family);transition:opacity 0.2s;letter-spacing:0.5px;display:flex;align-items:center;justify-content:center;gap:6px;">
                    <i class="fas fa-paper-plane" style="font-size:13px;"></i> 投递
                </button>
                <button onclick="openQuestionEditor()" style="flex:1;min-width:60px;padding:11px 0;font-size:13px;font-weight:600;border:1.5px solid var(--border-color);border-radius:12px;background:var(--primary-bg);color:var(--text-primary);cursor:pointer;font-family:var(--font-family);transition:background 0.2s;display:flex;align-items:center;justify-content:center;gap:6px;">
                    <i class="fas fa-question" style="font-size:13px;"></i> 提问
                </button>
                <button onclick="composeAction('confirm')" style="flex:1;min-width:60px;padding:11px 0;font-size:13px;font-weight:600;border:1.5px solid rgba(var(--accent-color-rgb),0.3);border-radius:12px;background:rgba(var(--accent-color-rgb),0.08);color:var(--accent-color);cursor:pointer;font-family:var(--font-family);transition:background 0.2s;display:flex;align-items:center;justify-content:center;gap:6px;">
                    <i class="fas fa-archive" style="font-size:13px;"></i> 归档
                </button>
                <button onclick="closeCuriosityCompose()" style="flex:1;min-width:60px;padding:11px 0;font-size:13px;font-weight:600;border:1.5px solid var(--border-color);border-radius:12px;background:transparent;color:var(--text-secondary);cursor:pointer;font-family:var(--font-family);transition:background 0.2s;display:flex;align-items:center;justify-content:center;gap:6px;">
                    <i class="fas fa-times" style="font-size:13px;"></i> 关闭
                </button>
            </div>
        `;
    }
}

// ============================================================
// 投递功能 - 完整的后台模拟流程
// ============================================================

// ---------- 工具函数 ----------
function randomDelay(minMs, maxMs) {
    return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
}

function coinFlip() {
    return Math.random() < 0.5;
}

function randomChoice(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// 随机延迟（Promise 版本）
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ---------- 投递核心流程 ----------
async function startDeliveryProcess(questionnaire) {
    const startTime = Date.now();
    const MAX_DURATION = 5 * 60 * 1000; // 5分钟
    
    // 深拷贝问题列表
    let questions = questionnaire.questions.map(q => ({
        ...q,
        _status: 'pending', // pending | answered | skipped | refused | timeout
        _selectedOptions: [],
        _askedBack: false,  // 是否反问
        _processed: false   // 是否已处理（第一遍）
    }));
    
    // ===== 阶段 A：决定是否进入答题 =====
    let entered = false;
    let attempts = 0;
    
    while (!entered) {
        const elapsed = Date.now() - startTime;
        if (elapsed > MAX_DURATION) {
            // 超时，直接返回部分结果
            return buildResult(questionnaire, questions, 'timeout');
        }
        
        const delay = randomDelay(1000, 60000); // 1秒 ~ 1分钟
        await sleep(delay);
        
        attempts++;
        if (coinFlip()) {
            entered = true;
        }
    }
    
    // ===== 阶段 B：第一遍处理所有问题 =====
    for (let i = 0; i < questions.length; i++) {
        const elapsed = Date.now() - startTime;
        if (elapsed > MAX_DURATION) {
            // 超时，返回当前结果
            return buildResult(questionnaire, questions, 'timeout');
        }
        await processQuestion(questions[i], startTime, MAX_DURATION, true);
    }
    
    // ===== 阶段 C：第二轮处理“暂不回答”的问题 =====
    const skippedQuestions = questions.filter(q => q._status === 'skipped');
    for (let i = 0; i < skippedQuestions.length; i++) {
        const elapsed = Date.now() - startTime;
        if (elapsed > MAX_DURATION) {
            return buildResult(questionnaire, questions, 'timeout');
        }
        // 第二轮：不判断是否反问
        await processQuestion(skippedQuestions[i], startTime, MAX_DURATION, false);
    }
    
    // ===== 阶段 D：结果汇总 =====
    return buildResult(questionnaire, questions, 'completed');
}

// ---------- 处理单个问题 ----------
async function processQuestion(question, startTime, MAX_DURATION, allowAskBack) {
    // 随机延迟 0~30秒
    const delay = randomDelay(0, 30000);
    await sleep(delay);
    
    // 检查是否超时
    if (Date.now() - startTime > MAX_DURATION) {
        question._status = 'timeout';
        return;
    }
    
    // 三选一：拒绝回答 / 暂不回答 / 回答
    const actions = ['refuse', 'skip', 'answer'];
    const action = randomChoice(actions);
    
    if (action === 'refuse') {
        question._status = 'refused';
        if (allowAskBack && coinFlip()) {
            question._askedBack = true;
        }
    } else if (action === 'skip') {
        question._status = 'skipped';
        if (allowAskBack && coinFlip()) {
            question._askedBack = true;
        }
    } else if (action === 'answer') {
        // 回答问题
        await answerQuestion(question);
        question._status = 'answered';
        if (allowAskBack && coinFlip()) {
            question._askedBack = true;
        }
    }
}

// ---------- 回答具体问题 ----------
async function answerQuestion(question) {
    const options = question.options || [];
    if (options.length === 0) return;
    
    // 随机延迟 0~40秒
    const delay = randomDelay(0, 40000);
    await sleep(delay);
    
    if (question.type === 'single') {
        // 单选：随机选一个
        const selected = randomChoice(options);
        question._selectedOptions = [selected];
    } else if (question.type === 'multiple') {
        // 多选：先随机 1~N 个数量
        const count = randomInt(1, options.length);
        // 打乱后取前 count 个
        const shuffled = [...options].sort(() => Math.random() - 0.5);
        question._selectedOptions = shuffled.slice(0, count);
    }
}

// ---------- 构建结果数据 ----------
function buildResult(originalQuestionnaire, questions, status) {
    // 统计各状态数量
    let answered = 0, skipped = 0, refused = 0, timeout = 0;
    questions.forEach(q => {
        if (q._status === 'answered') answered++;
        else if (q._status === 'skipped') skipped++;
        else if (q._status === 'refused') refused++;
        else if (q._status === 'timeout') timeout++;
    });
    
    // 构建结果对象（2.0 版本）
    const result = {
        id: originalQuestionnaire.id || 'q_' + Date.now(),
        title: originalQuestionnaire.title,
        questions: questions.map(q => ({
            text: q.text,
            type: q.type,
            options: q.options,
            _status: q._status,
            _selectedOptions: q._selectedOptions || [],
            _askedBack: q._askedBack || false
        })),
        sentTime: originalQuestionnaire.sentTime || Date.now(),
        status: 'archived', // 投递后归档
        isNew: true,        // 标记为未查看
        version: 2,         // 2.0 版本
        previousVersionId: originalQuestionnaire.id // 指向1.0
    };
    
    // 统计信息
    result._stats = {
        total: questions.length,
        answered: answered,
        skipped: skipped,
        refused: refused,
        timeout: timeout
    };
    
    return result;
}

// ---------- 投递入口 ----------
window.handleDelivery = async function() {
    // 检查是否有问题
    if (!editingQuestionnaire || editingQuestionnaire.questions.length === 0) {
        showNotification('问卷没有题目，请先添加问题 ✦', 'warning', 2500);
        return;
    }
    
    // 检查标题
    if (!editingQuestionnaire.title || editingQuestionnaire.title.trim() === '') {
        showNotification('请先为问卷命名 ✦', 'warning', 2500);
        return;
    }
    
    // 1. 关闭编辑器模态框
    hideModal(document.getElementById('curiosity-compose-modal'));
    
    // 2. 创建1.0版本问卷
    const newQuestionnaire = {
        id: 'q_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
        title: editingQuestionnaire.title,
        questions: editingQuestionnaire.questions.map(q => ({
            text: q.text,
            type: q.type,
            options: [...q.options]
        })),
        sentTime: Date.now(),
        status: 'ing',
        isNew: false,      // 1.0 不显示红点
        version: 1
    };
    
    // 存入 curiosityData.ing
    curiosityData.ing.push(newQuestionnaire);
    await saveCuriosityData();
    
    // 3. 刷新列表（让新卡片立即显示）
    renderCuriosityLists();
    
    // 4. 显示投递成功弹窗
    showDeliverySuccessPopup(newQuestionnaire);
    
    // 5. 开始后台模拟流程
    setTimeout(async () => {
        const result = await startDeliveryProcess(newQuestionnaire);
        await handleDeliveryResult(result, newQuestionnaire);
    }, 500);
};

// ---------- 投递成功弹窗 ----------
function showDeliverySuccessPopup(questionnaire) {
    const existing = document.getElementById('curiosity-delivery-popup');
    if (existing) existing.remove();
    
    const popup = document.createElement('div');
    popup.id = 'curiosity-delivery-popup';
    popup.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:var(--secondary-bg);border:1px solid var(--border-color);border-radius:20px;padding:18px 24px;z-index:8000;max-width:340px;width:88%;box-shadow:0 8px 32px rgba(0,0,0,0.18);display:flex;flex-direction:column;gap:12px;animation:slideUpNotif 0.4s cubic-bezier(0.22,1,0.36,1);';
    popup.innerHTML = `
        <style>@keyframes slideUpNotif{from{opacity:0;transform:translateX(-50%) translateY(24px) scale(0.9)}60%{transform:translateX(-50%) translateY(-4px) scale(1.02)}to{opacity:1;transform:translateX(-50%) translateY(0) scale(1)}}</style>
        <div style="display:flex;align-items:center;gap:12px;">
            <span style="font-size:28px;">📬</span>
            <div>
                <div style="font-size:15px;font-weight:700;color:var(--text-primary);">问卷正在传达</div>
                <div style="font-size:12px;color:var(--text-secondary);margin-top:2px;opacity:0.8;">已投递「${escapeHtml(questionnaire.title)}」</div>
            </div>
        </div>
        <button onclick="document.getElementById('curiosity-delivery-popup').remove();" style="width:100%;padding:10px 0;border-radius:12px;border:none;background:var(--accent-color);color:#fff;font-size:14px;font-weight:600;cursor:pointer;font-family:var(--font-family);">知道了 ✦</button>
    `;
    document.body.appendChild(popup);
    
    // 15秒后自动消失
    setTimeout(() => {
        if (popup.parentNode) popup.remove();
    }, 15000);
}

// ---------- 处理投递结果 ----------
async function handleDeliveryResult(result, originalQuestionnaire) {
    // 从 ing 中删除原问卷（1.0版本）
    const ingIndex = curiosityData.ing.findIndex(q => q.id === originalQuestionnaire.id);
    if (ingIndex > -1) {
        curiosityData.ing.splice(ingIndex, 1);
    }
    
    // 将2.0结果存入 ing（注意：不是 archived）
    result.status = 'ing';
    result.isNew = true;   // 2.0 默认未查看，显示红点
    result.version = 2;
    curiosityData.ing.push(result);
    
    await saveCuriosityData();
    
    // 刷新列表（立即显示2.0卡片，带红点）
    renderCuriosityLists();
    
    // 显示回馈弹窗
    showResultPopup(result);
}

// ---------- 回馈结果弹窗 ----------
function showResultPopup(result) {
    const existing = document.getElementById('curiosity-result-popup');
    if (existing) existing.remove();
    
    const partnerName = (typeof settings !== 'undefined' && settings.partnerName) || '梦角';
    const attemptCount = result._stats ? (result._stats.answered + result._stats.skipped + result._stats.refused) : 0;
    // 如果全部超时，显示特殊提示
    const isTimeout = result._stats && result._stats.timeout === result._stats.total;
    
    const popup = document.createElement('div');
    popup.id = 'curiosity-result-popup';
    popup.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:var(--secondary-bg);border:1px solid var(--border-color);border-radius:20px;padding:18px 24px;z-index:8000;max-width:360px;width:88%;box-shadow:0 8px 32px rgba(0,0,0,0.18);display:flex;flex-direction:column;gap:14px;animation:slideUpNotif 0.4s cubic-bezier(0.22,1,0.36,1);';
    
    const statusText = isTimeout 
        ? '⏳ 部分问题未能及时回答' 
        : `✅ 已返回 ${attemptCount} 个回答`;
    
    popup.innerHTML = `
        <style>@keyframes slideUpNotif{from{opacity:0;transform:translateX(-50%) translateY(24px) scale(0.9)}60%{transform:translateX(-50%) translateY(-4px) scale(1.02)}to{opacity:1;transform:translateX(-50%) translateY(0) scale(1)}}</style>
        <div style="display:flex;align-items:center;gap:12px;">
            <span style="font-size:28px;">📨</span>
            <div>
                <div style="font-size:15px;font-weight:700;color:var(--text-primary);">您发出的问卷：「${escapeHtml(result.title)}」</div>
                <div style="font-size:12px;color:var(--text-secondary);margin-top:2px;">${partnerName} 已返回</div>
                <div style="font-size:11px;color:var(--accent-color);margin-top:2px;">${statusText}</div>
            </div>
        </div>
        <div style="display:flex;gap:8px;">
            <button onclick="document.getElementById('curiosity-result-popup').remove();" style="flex:1;padding:10px 0;border-radius:12px;border:1px solid var(--border-color);background:transparent;color:var(--text-secondary);font-size:13px;cursor:pointer;font-family:var(--font-family);">稍后查看</button>
            <button onclick="openCuriosityResult('${result.id}')" style="flex:2;padding:10px 0;border-radius:12px;border:none;background:var(--accent-color);color:#fff;font-size:13px;font-weight:600;cursor:pointer;font-family:var(--font-family);">立即查看 ✦</button>
        </div>
    `;
    document.body.appendChild(popup);
    
    // 10秒后自动消失
    setTimeout(() => {
        if (popup.parentNode) popup.remove();
    }, 10000);
}

// ---------- 查看回馈结果 ----------
window.openCuriosityResult = function(resultId) {
    // 关闭弹窗
    const popup = document.getElementById('curiosity-result-popup');
    if (popup) popup.remove();
    
    // 查找结果
    const result = curiosityData.archived.find(q => q.id === resultId);
    if (!result) {
        showNotification('问卷记录不存在', 'error');
        return;
    }
    
    // 标记为已查看
    result.isNew = false;
    saveCuriosityData();
    renderCuriosityLists();
    
    // 切换到已归档标签页
    switchCuriosityTab('archived');
    
    // 打开详情（使用新的详情查看函数）
    viewArchivedResult(result);
};

// ---------- 查看归档详情 ----------
window.viewArchivedResult = function(result) {
    // 这里暂时复用之前的详情提示，后续会扩展为完整详情页
    showNotification('问卷详情功能开发中 ✦', 'info', 2000);
};

