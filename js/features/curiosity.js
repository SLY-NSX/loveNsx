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
        // 两行显示：第一行标题加粗，第二行统计信息
        const titleHtml = `<div style="font-weight:700;font-size:14px;color:var(--text-primary);">${letter.title}</div>`;
        const statsHtml = `<div style="font-size:12px;color:var(--text-secondary);margin-top:2px;">共${qCount}问 · ${singleCount}道单选 · ${multiCount}道多选</div>`;
        const statusText = status === 'ing' ? '⏳ 等待回复中' : '✅ 已归档';

        return `
            <div class="env-letter-item curiosity-letter-item" onclick="viewCuriosityLetter('${status}','${letter.id}')">
                <div class="env-letter-header curiosity-compact-header">
                    <div class="env-letter-header-from">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px;margin-right:4px;">
                            <rect x="2" y="4" width="20" height="16" rx="2"/>
                            <path d="M22 7l-10 7L2 7"/>
                        </svg>
                        投递 · ${date}
                    </div>
                    <span style="font-size:18px;line-height:1;flex-shrink:0;">📮</span>
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
    // 暂不实现详情弹窗，直接提示
    showNotification('问卷详情功能待开发 ✦', 'info', 2000);
};

// ---------- 删除问卷 ----------
window.deleteCuriosityLetter = function(event, status, id) {
    event.stopPropagation();
    if (!confirm('确定要删除这份问卷吗？')) return;
    const arr = status === 'ing' ? curiosityData.ing : curiosityData.archived;
    const index = arr.findIndex(l => l.id === id);
    if (index > -1) {
        arr.splice(index, 1);
        saveCuriosityData();
        renderCuriosityLists();
        showNotification('已删除', 'success');
    }
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
        questions: [],  // 改为空数组，不添加示例题目
        createdTime: Date.now()
    };
    renderComposeEditor();
    showModal(document.getElementById('curiosity-compose-modal'));
};

// 渲染编辑器内容
function renderComposeEditor() {
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
                <div class="compose-question-card" onclick="openQuestionEditorForEdit(${index})" style="margin-bottom:0;padding:14px 20px 12px 4px;cursor:pointer;position:relative;border-bottom:1.5px dashed rgba(var(--accent-color-rgb),0.15);overflow:visible;">
                    <!-- 第一行：Q1 + 小圆点 + 类型标签 -->
                    <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
                        <span style="font-size:13px;font-weight:700;color:var(--accent-color);letter-spacing:0.5px;">Q${index + 1}</span>
                        <span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:rgba(var(--accent-color-rgb),0.5);flex-shrink:0;"></span>
                        <span style="font-size:10px;color:var(--text-secondary);opacity:0.7;background:rgba(var(--accent-color-rgb),0.06);padding:0 8px;border-radius:10px;border:1px solid rgba(var(--accent-color-rgb),0.08);">${typeLabel}</span>
                    </div>
                    <!-- 第二行：题目 -->
                    <div style="font-size:14px;font-weight:500;color:var(--text-primary);line-height:1.5;padding-left:22px;margin-bottom:4px;">
                        ${escapeHtml(q.text)}
                    </div>
                    <!-- 选项列表 -->
                    <div style="padding-left:22px;margin-top:2px;">
                        ${optionsHtml}
                    </div>
                    <!-- 删除按钮（移到更边缘） -->
                    <button onclick="event.stopPropagation();deleteQuestion(${index})" style="position:absolute;top:12px;right:-4px;background:none;border:none;color:var(--text-secondary);cursor:pointer;font-size:11px;opacity:0.25;padding:4px;transition:opacity 0.2s;" onmouseover="this.style.opacity='0.7'" onmouseout="this.style.opacity='0.25'">
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
    if (action === 'edit') {
        // 点击“编辑”键 → 新建问题
        openQuestionEditor();
        return;
    }
    
    const messages = {
        'draft': '📝 草稿保存功能开发中，敬请期待 ✦',
        'confirm': '✅ 确认功能开发中，敬请期待 ✦',
        'submit': '📬 投递功能开发中，敬请期待 ✦'
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