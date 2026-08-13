// ============================================================
// 版本号管理系统
// ============================================================

function getVersionNumber(versionStr) {
    if (!versionStr || typeof versionStr !== 'string') return { letter: 'A', number: 0 };
    const match = versionStr.match(/^([A-Z])-(\d+)$/);
    if (!match) return { letter: 'A', number: 0 };
    return { letter: match[1], number: parseInt(match[2], 10) };
}

function makeVersionString(letter, number) {
    return letter + '-' + number;
}

function advanceLetter(letter) {
    if (!letter || letter.length !== 1) return 'A';
    return String.fromCharCode(letter.charCodeAt(0) + 1);
}

function createInitialVersion() {
    return 'A-0';
}

function incrementVersionNumber(versionStr) {
    const parsed = getVersionNumber(versionStr);
    return makeVersionString(parsed.letter, parsed.number + 1);
}

function advanceVersionLetter(versionStr) {
    const parsed = getVersionNumber(versionStr);
    return makeVersionString(advanceLetter(parsed.letter), parsed.number);
}

// ============================================================
// 好奇驿站 - 问卷调查功能
// ============================================================

let curiosityData = { ing: [], archived: [] };
let currentCuriosityTab = 'ing';

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
        sentTime: Date.now() - 3600000 * 2,
        status: 'ing',
        version: 'A-2',
        isNew: false,
        questions: [
            { text: '你最喜欢的颜色？', type: 'single', options: ['红色', '蓝色', '绿色', '其他'], _status: 'answered', _selectedOptions: ['蓝色'], _askedBack: false },
            { text: '你平时喜欢做什么？', type: 'multiple', options: ['看书', '运动', '音乐', '旅行'], _status: 'answered', _selectedOptions: ['音乐', '旅行'], _askedBack: true },
            { text: '你对我的第一印象？', type: 'single', options: ['温柔', '有趣', '高冷', '可爱'], _status: 'skipped', _selectedOptions: [], _askedBack: false }
        ]
    },
    {
        id: 'sample_2_' + Date.now(),
        title: '我们的未来',
        questions: [
            { text: '你希望我们多久见一次面？', type: 'single', options: ['每天', '每周', '每月', '随缘'] },
            { text: '你最想和我一起做的事？', type: 'multiple', options: ['看电影', '旅行', '做饭', '聊天'] }
        ],
        sentTime: Date.now() - 3600000 * 48,
        status: 'archived',
        version: 'B-3',
        isNew: false
    }
];

async function loadCuriosityData() {
    const saved = await localforage.getItem(getStorageKey('curiosityData'));
    if (saved) {
        curiosityData = saved;
    } else {
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
        const isDraft = letter.status === 'draft';
        const dateDisplay = isDraft ? '未投递' : new Date(letter.sentTime).toLocaleDateString('zh-CN', {
            month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });

        const parsedVersion = getVersionNumber(letter.version || 'A-0');
        const numPart = parsedVersion.number;
        const hasReply = (numPart % 2 === 0 && numPart > 0);
        const isNew = letter.isNew || false;

        let statusText = '';
        if (isDraft) {
            statusText = '📝 草稿';
        } else if (hasReply) {
            const answered = (letter.questions || []).filter(q => q._status === 'answered').length;
            const total = (letter.questions || []).length;
            statusText = `✅ 已收到回复 · ${answered}/${total} 已答`;
        } else {
            statusText = '⏳ 等待回复中';
        }

        let singleCount = 0, multiCount = 0;
        (letter.questions || []).forEach(q => {
            if (q.type === 'single') singleCount++;
            else if (q.type === 'multiple') multiCount++;
        });
        const qCount = (letter.questions || []).length;

        const titleHtml = `<div style="font-weight:700;font-size:14px;color:var(--text-primary);">${escapeHtml(letter.title)}</div>`;
        const statsHtml = `<div style="font-size:12px;color:var(--text-secondary);margin-top:2px;">共${qCount}问 · ${singleCount}道单选 · ${multiCount}道多选</div>`;

        const redDot = (hasReply && isNew) 
            ? `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#ff4757;margin-left:6px;flex-shrink:0;box-shadow:0 0 8px rgba(255,71,87,0.5);"></span>` 
            : '';

        const isNewClass = (hasReply && isNew) ? 'env-letter-new' : '';

        return `
            <div class="env-letter-item curiosity-letter-item ${isNewClass}" onclick="viewCuriosityLetter('${status}','${letter.id}')">
                <div class="env-letter-header curiosity-compact-header">
                    <div class="env-letter-header-from">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px;margin-right:4px;">
                            <rect x="2" y="4" width="20" height="16" rx="2"/>
                            <path d="M22 7l-10 7L2 7"/>
                        </svg>
                        投递 · ${dateDisplay}
                        ${redDot}
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

window.viewCuriosityLetter = function(status, id) {
    const letter = curiosityData.ing.find(l => l.id === id);
    if (!letter) {
        showNotification('问卷不存在', 'error');
        return;
    }

    const parsed = getVersionNumber(letter.version || 'A-0');
    const isDraft = (parsed.number === 0);

    if (isDraft) {
        openCuriosityDetail(letter, false, 0);
        return;
    }

    const hasReply = (parsed.number % 2 === 0 && parsed.number > 0);

    if (hasReply && letter.isNew) {
        letter.isNew = false;
        saveCuriosityData();
        renderCuriosityLists();
    }

    openCuriosityDetail(letter, false, parsed.number);
};

window.cancelCuriosityCompose = function() {
    document.getElementById('curiosity-compose-form').style.display = 'none';
    document.getElementById('curiosity-main-close-btn').style.display = 'flex';
    if (currentCuriosityTab === 'ing') {
        document.getElementById('curiosity-ing-section').style.display = 'block';
    } else {
        document.getElementById('curiosity-archived-section').style.display = 'block';
    }
};

window.closeCuriosityModal = function() {
    hideModal(document.getElementById('curiosity-modal'));
};

// ============================================================
// 编辑页面
// ============================================================

let editingQuestionnaire = {
    title: '',
    questions: [],
    createdTime: Date.now()
};

window.openCuriosityCompose = function() {
    editingQuestionnaire = {
        title: '未命名问卷',
        questions: [],
        createdTime: Date.now(),
        _isReadOnly: false,
        _canDelete: true,
        _canClickQuestion: true,
        _numPart: 0,
        _version: 'A-0'
    };
    renderComposeEditor();
    showModal(document.getElementById('curiosity-compose-modal'));
};

function renderComposeEditor() {
    if (editingQuestionnaire._isReadOnly !== undefined) {
        renderComposeEditorWithPermissions();
        return;
    }
    editingQuestionnaire._isReadOnly = false;
    editingQuestionnaire._canDelete = true;
    editingQuestionnaire._canClickQuestion = true;
    editingQuestionnaire._numPart = 0;
    renderComposeEditorWithPermissions();
}

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
        handleDelivery();
        return;
    }
    showNotification('功能开发中 ✦', 'info', 2500);
};

window.closeCuriosityCompose = async function() {
    if (!editingQuestionnaire._isReadOnly) {
        const questions = editingQuestionnaire.questions || [];
        if (questions.length > 0) {
            const shouldSave = confirm('当前问卷有内容，是否保存为草稿？\n点击"确定"保存草稿，点击"取消"丢弃。');
            if (shouldSave) {
                const draftQuestionnaire = {
                    id: 'draft_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
                    title: editingQuestionnaire.title || '未命名问卷',
                    questions: editingQuestionnaire.questions.map(q => ({
                        text: q.text,
                        type: q.type,
                        options: [...q.options]
                    })),
                    sentTime: null,
                    status: 'draft',
                    isNew: false,
                    version: 'A-0',
                };
                curiosityData.ing.push(draftQuestionnaire);
                await saveCuriosityData();
                renderCuriosityLists();
                showNotification('草稿已保存 📝', 'success', 2000);
            }
        }
    }
    hideModal(document.getElementById('curiosity-compose-modal'));
};

// ============================================================
// 问题编辑弹窗
// ============================================================

let editingQuestionIndex = -1;
let tempQuestionData = {
    text: '',
    type: 'single',
    options: ['', '']
};

window.openQuestionEditor = function() {
    const numPart = editingQuestionnaire._numPart;
    if (numPart !== undefined && numPart !== 0) {
        showNotification('当前问卷已有回复，无法添加新问题 ✦', 'warning', 2000);
        return;
    }
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

window.openQuestionEditorForEdit = function(index) {
    const q = editingQuestionnaire.questions[index];
    if (!q) return;

    const numPart = editingQuestionnaire._numPart;
    const canEdit = (numPart === 0);
    const canView = (numPart === 0 || (numPart % 2 === 0 && numPart > 0));

    if (!canView) {
        showNotification('当前问卷不可编辑', 'warning', 2000);
        return;
    }

    if (!canEdit) {
        showNotification('该问题已有回复，仅可查看', 'info', 2000);
        return;
    }

    editingQuestionIndex = index;
    tempQuestionData = {
        text: q.text || '',
        type: q.type || 'single',
        options: [...(q.options || ['', ''])]
    };
    while (tempQuestionData.options.length < 2) {
        tempQuestionData.options.push('');
    }
    renderQuestionEditor();
    showModal(document.getElementById('question-editor-modal'));
};

function renderQuestionEditor() {
    const textInput = document.getElementById('qe-text-input');
    const charCount = document.getElementById('qe-char-count');

    if (textInput) {
        textInput.value = tempQuestionData.text || '';
        textInput.dispatchEvent(new Event('input'));
        if (charCount) charCount.textContent = (tempQuestionData.text || '').length + '/100';
    }

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

    renderQuestionOptions();
}

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

    const canAdd = options.length < 8;
    html += `
        <button class="qe-add-option-btn" onclick="addTempOption()" ${!canAdd ? 'disabled style="opacity:0.4;cursor:not-allowed;"' : ''}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            添加选项
        </button>
    `;

    container.innerHTML = html;
}

function escapeHtml(text) {
    if (!text) return '';
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

window.updateTempOption = function(index, value) {
    if (tempQuestionData.options && tempQuestionData.options[index] !== undefined) {
        tempQuestionData.options[index] = value;
    }
};

window.addTempOption = function() {
    if ((tempQuestionData.options || []).length >= 8) {
        showNotification('最多 8 个选项', 'warning', 1500);
        return;
    }
    tempQuestionData.options.push('');
    renderQuestionOptions();
};

window.removeTempOption = function(index) {
    if ((tempQuestionData.options || []).length <= 2) {
        showNotification('至少保留 2 个选项', 'warning', 1500);
        return;
    }
    tempQuestionData.options.splice(index, 1);
    renderQuestionOptions();
};

window.setQuestionType = function(type) {
    tempQuestionData.type = type;

    const singleBtn = document.getElementById('qe-type-single-btn');
    const multipleBtn = document.getElementById('qe-type-multiple-btn');

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

window.saveQuestion = function() {
    const text = (document.getElementById('qe-text-input')?.value || '').trim();
    const type = tempQuestionData.type || 'single';
    const options = tempQuestionData.options.filter(opt => opt.trim() !== '');

    if (!text) {
        showNotification('请填写问题内容 ✦', 'warning', 2000);
        return;
    }
    if (options.length < 2) {
        showNotification('至少需要 2 个选项 ✦', 'warning', 2000);
        return;
    }

    const questionData = {
        id: 'q_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        text: text,
        type: type,
        options: options
    };

    if (editingQuestionIndex === -1) {
        editingQuestionnaire.questions.push(questionData);
        showNotification('问题已添加 ✦', 'success', 1500);
    } else {
        const oldId = editingQuestionnaire.questions[editingQuestionIndex]?.id || questionData.id;
        questionData.id = oldId;
        editingQuestionnaire.questions[editingQuestionIndex] = questionData;
        showNotification('问题已更新 ✦', 'success', 1500);
    }

    hideModal(document.getElementById('question-editor-modal'));
    renderComposeEditor();
};

window.closeQuestionEditor = function() {
    hideModal(document.getElementById('question-editor-modal'));
};

window.deleteQuestion = function(index) {
    const numPart = editingQuestionnaire._numPart;
    const canDelete = (numPart === 0 || (numPart % 2 === 0 && numPart > 0));
    if (!canDelete) {
        showNotification('当前问卷不允许删除问题', 'warning', 2000);
        return;
    }
    if (editingQuestionnaire.questions.length <= 1) {
        showNotification('至少保留一个问题 ✦', 'warning', 2000);
        return;
    }
    if (!confirm('确定要删除这个问题吗？')) return;
    editingQuestionnaire.questions.splice(index, 1);
    renderComposeEditorWithPermissions();
    showNotification('问题已删除', 'success', 1500);
};

// ============================================================
// 问卷详情查看（只读模式）
// ============================================================

window.openCuriosityDetail = function(questionnaire, editable, numPart) {
    const parsedNum = (numPart !== undefined) ? numPart : getVersionNumber(questionnaire.version || 'A-0').number;
    const isEven = (parsedNum % 2 === 0);
    const isZero = (parsedNum === 0);
    const canDelete = (isZero || (isEven && parsedNum > 0));
    const canEdit = isZero;
    const canClickQuestion = (isZero || (isEven && parsedNum > 0));

    editingQuestionnaire = {
        title: questionnaire.title || '未命名问卷',
        questions: JSON.parse(JSON.stringify(questionnaire.questions || [])),
        createdTime: questionnaire.sentTime || Date.now(),
        _isReadOnly: !canEdit,
        _canDelete: canDelete,
        _canClickQuestion: canClickQuestion,
        _version: questionnaire.version || 'A-0',
        _numPart: parsedNum,
        _questionnaireId: questionnaire.id,
        _hasReply: (parsedNum % 2 === 0 && parsedNum > 0)
    };

    renderComposeEditorWithPermissions();
    showModal(document.getElementById('curiosity-compose-modal'));
};

// ============================================================
// 渲染函数（带权限控制）
// ============================================================

function renderComposeEditorWithPermissions() {
    const titleEl = document.getElementById('compose-title-display');
    const dateEl = document.getElementById('compose-date-line');
    const questionsContainer = document.getElementById('compose-questions-container');
    const isReadOnly = editingQuestionnaire._isReadOnly || false;
    const canDelete = editingQuestionnaire._canDelete || false;
    const canClickQuestion = editingQuestionnaire._canClickQuestion || false;
    const numPart = editingQuestionnaire._numPart || 0;
    const hasReply = (numPart % 2 === 0 && numPart > 0);

    if (titleEl) {
        titleEl.textContent = editingQuestionnaire.title || '未命名问卷';
        const parent = titleEl.parentElement;
        if (isReadOnly) {
            parent.style.cursor = 'default';
            parent.onclick = null;
            const hint = parent.querySelector('span:last-child');
            if (hint && hint.textContent && hint.textContent.includes('点击修改')) {
                hint.style.display = 'none';
            }
            titleEl.style.borderBottom = 'none';
        } else {
            parent.style.cursor = 'pointer';
            parent.onclick = editComposeTitle;
            const hint = parent.querySelector('span:last-child');
            if (hint) hint.style.display = '';
            titleEl.style.borderBottom = '1.5px dashed rgba(255,255,255,0.4)';
        }
    }

    if (dateEl) {
        const now = new Date(editingQuestionnaire.createdTime);
        const y = now.getFullYear();
        const mo = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
        dateEl.textContent = `${y}/${mo}/${d} 星期${weekdays[now.getDay()]}`;
    }

    if (questionsContainer) {
        const questions = editingQuestionnaire.questions || [];
        if (questions.length === 0) {
            questionsContainer.innerHTML = `
                <div style="text-align:center;padding:40px 10px;color:var(--text-secondary);font-size:14px;font-style:italic;opacity:0.6;line-height:1.8;">
                    ${isReadOnly ? '这份问卷还没有问题' : 'Deepen mutual understanding<br>and bring each other closer'}
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

            let dotColor = 'rgba(var(--accent-color-rgb),0.15)';
            if (hasReply) {
                if (isAnswered) dotColor = '#4CAF50';
                else if (isSkipped) dotColor = '#FF9800';
                else if (isRefused) dotColor = '#9C27B0';
                else if (isTimeout) dotColor = 'rgba(var(--accent-color-rgb),0.15)';
            }

            const selectedOptions = q._selectedOptions || [];
            const optionsHtml = (q.options || []).map((opt, oi) => {
                const isSelected = selectedOptions.includes(opt);
                const fillColor = (hasReply && isSelected) ? 'var(--accent-color)' : 'transparent';
                return `
                    <div style="display:flex;align-items:center;gap:6px;padding:2px 0 2px 6px;font-size:13px;color:var(--text-secondary);">
                        <span style="display:inline-block;width:12px;height:12px;border-radius:50%;border:1.5px solid rgba(var(--accent-color-rgb),0.25);flex-shrink:0;background:${fillColor};transition:background 0.3s;"></span>
                        <span>${escapeHtml(opt)}</span>
                    </div>
                `;
            }).join('');

            const partnerName = (typeof settings !== 'undefined' && settings.partnerName) || '梦角';
            const askedBackHtml = (hasReply && q._askedBack) 
                ? `<div style="font-size:11px;color:var(--accent-color);margin-top:4px;padding-left:22px;font-style:italic;opacity:0.8;">${partnerName}同问 ✦</div>`
                : '';

            let statusLabel = '';
            if (hasReply) {
                if (isAnswered) statusLabel = `<span style="font-size:9px;color:#4CAF50;background:rgba(76,175,80,0.1);padding:0 6px;border-radius:8px;border:1px solid rgba(76,175,80,0.2);">已答</span>`;
                else if (isSkipped) statusLabel = `<span style="font-size:9px;color:#FF9800;background:rgba(255,152,0,0.1);padding:0 6px;border-radius:8px;border:1px solid rgba(255,152,0,0.2);">暂未答</span>`;
                else if (isRefused) statusLabel = `<span style="font-size:9px;color:#9C27B0;background:rgba(156,39,176,0.1);padding:0 6px;border-radius:8px;border:1px solid rgba(156,39,176,0.2);">拒绝</span>`;
                else if (isTimeout) statusLabel = `<span style="font-size:9px;color:var(--text-secondary);background:var(--primary-bg);padding:0 6px;border-radius:8px;border:1px solid var(--border-color);">超时</span>`;
            }

            const clickable = canClickQuestion && !isReadOnly;
            const cardClickHandler = clickable ? `onclick="openQuestionEditorForEdit(${index})"` : '';
            const cursorStyle = clickable ? 'cursor:pointer;' : 'cursor:default;';

            html += `
                <div class="compose-question-card" ${cardClickHandler} style="margin-bottom:0;padding:14px 32px 12px 0px;position:relative;border-bottom:1.5px dashed rgba(var(--accent-color-rgb),0.15);overflow:visible;${cursorStyle}">
                    <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;flex-wrap:wrap;">
                        <span style="font-size:13px;font-weight:700;color:var(--accent-color);letter-spacing:0.5px;">Q${index + 1}</span>
                        <span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${dotColor};flex-shrink:0;transition:background 0.3s;"></span>
                        <span style="font-size:10px;color:var(--text-secondary);opacity:0.7;background:rgba(var(--accent-color-rgb),0.06);padding:0 8px;border-radius:10px;border:1px solid rgba(var(--accent-color-rgb),0.08);">${typeLabel}</span>
                        ${statusLabel}
                    </div>
                    <div style="font-size:14px;font-weight:500;color:var(--text-primary);line-height:1.5;padding-left:16px;margin-bottom:4px;">
                        ${escapeHtml(q.text)}
                    </div>
                    <div style="padding-left:16px;margin-top:2px;">
                        ${optionsHtml}
                    </div>
                    ${askedBackHtml}
                    ${canDelete && !isReadOnly ? `<button onclick="event.stopPropagation();deleteQuestion(${index})" style="position:absolute;top:12px;right:4px;background:none;border:none;color:var(--text-secondary);cursor:pointer;font-size:11px;opacity:0.25;padding:4px;transition:opacity 0.2s;" onmouseover="this.style.opacity='0.7'" onmouseout="this.style.opacity='0.25'">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>` : ''}
                </div>
            `;
        });
        questionsContainer.innerHTML = html;
    }

    const bottomArea = document.querySelector('#curiosity-compose-modal .env-wrapper > div:last-child');
    if (bottomArea) {
        if (isReadOnly) {
            bottomArea.innerHTML = `
                <div style="display:flex;gap:10px;padding:12px 18px 16px;border-top:1px solid var(--border-color);flex-shrink:0;flex-wrap:wrap;">
                    <button onclick="closeCuriosityCompose()" style="flex:1;min-width:60px;padding:11px 0;font-size:13px;font-weight:600;border:1.5px solid var(--border-color);border-radius:12px;background:transparent;color:var(--text-secondary);cursor:pointer;font-family:var(--font-family);display:flex;align-items:center;justify-content:center;gap:6px;">
                        <i class="fas fa-arrow-left" style="font-size:13px;"></i> 返回
                    </button>
                </div>
            `;
        } else {
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
                    <button onclick="closeCuriosityCompose()" style="flex:1;min-width:60px;padding:11px 0;font-size:13px;font-weight:600;border:1.5px solid var(--border-color);border-radius:12px;background:transparent;color:var(--text-secondary);cursor:pointer;font-family:var(--font-family);display:flex;align-items:center;justify-content:center;gap:6px;">
                        <i class="fas fa-times" style="font-size:13px;"></i> 关闭
                    </button>
                </div>
            `;
        }
    }
}

// ============================================================
// 投递功能 - 完整的后台模拟流程（✅ 已修复所有逻辑）
// ============================================================

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

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function startDeliveryProcess(questionnaire) {
    const startTime = Date.now();
    const MAX_DURATION = 5 * 60 * 1000; // 5 分钟

    let questions = questionnaire.questions.map(q => ({
        ...q,
        _status: 'pending',
        _selectedOptions: [],
        _askedBack: false,
        _processed: false
    }));

    let enteredYes = false;

    // ===== 阶段 A：决定是否进入 YES =====
    let entered = false;

    while (!entered) {
        const elapsed = Date.now() - startTime;
        if (elapsed > MAX_DURATION) {
            // 超时，强制回复（不进入 YES）
            return buildResult(questionnaire, questions, 'timeout', false);
        }
        const delay = randomDelay(1000, 60000); // 1 秒 ~ 1 分钟
        await sleep(delay);
        if (coinFlip()) {
            entered = true;
            enteredYes = true;
        }
    }

    // ===== 阶段 B：第一遍处理所有问题 =====
    for (let i = 0; i < questions.length; i++) {
        const elapsed = Date.now() - startTime;
        if (elapsed > MAX_DURATION) {
            return buildResult(questionnaire, questions, 'timeout', enteredYes);
        }
        await processQuestion(questions[i], startTime, MAX_DURATION, true);
    }

    // ===== 阶段 C：第二轮处理“暂不回答”的问题 =====
    const skippedQuestions = questions.filter(q => q._status === 'skipped');
    for (let i = 0; i < skippedQuestions.length; i++) {
        const elapsed = Date.now() - startTime;
        if (elapsed > MAX_DURATION) {
            return buildResult(questionnaire, questions, 'timeout', enteredYes);
        }
        await processQuestion(skippedQuestions[i], startTime, MAX_DURATION, false);
    }

    // ===== 阶段 D：完成 =====
    return buildResult(questionnaire, questions, 'completed', enteredYes);
}

async function processQuestion(question, startTime, MAX_DURATION, allowAskBack) {
    const delay = randomDelay(0, 30000);
    await sleep(delay);

    if (Date.now() - startTime > MAX_DURATION) {
        question._status = 'timeout';
        return;
    }

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
        await answerQuestion(question);
        question._status = 'answered';
        if (allowAskBack && coinFlip()) {
            question._askedBack = true;
        }
    }
}

async function answerQuestion(question) {
    const options = question.options || [];
    if (options.length === 0) return;

    const delay = randomDelay(0, 40000);
    await sleep(delay);

    if (question.type === 'single') {
        const selected = randomChoice(options);
        question._selectedOptions = [selected];
    } else if (question.type === 'multiple') {
        const count = randomInt(1, options.length);
        const shuffled = [...options].sort(() => Math.random() - 0.5);
        question._selectedOptions = shuffled.slice(0, count);
    }
}

function buildResult(originalQuestionnaire, questions, status, enteredYes) {
    let answered = 0, skipped = 0, refused = 0, timeout = 0;
    questions.forEach(q => {
        if (q._status === 'answered') answered++;
        else if (q._status === 'skipped') skipped++;
        else if (q._status === 'refused') refused++;
        else if (q._status === 'timeout') timeout++;
    });

    let oldVersion = originalQuestionnaire.version || 'A-0';
    let newVersion;

    if (enteredYes) {
        // 进入 YES：字母递进，数字不变（数字已在投递时 +1）
        newVersion = advanceVersionLetter(oldVersion);
    } else {
        // 未进入 YES：仅数字 +1
        newVersion = incrementVersionNumber(oldVersion);
    }

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
        status: 'ing',
        isNew: true,
        version: newVersion,
        _enteredYes: enteredYes,
        _stats: {
            total: questions.length,
            answered: answered,
            skipped: skipped,
            refused: refused,
            timeout: timeout
        }
    };

    return result;
}

// ============================================================
// 投递入口（✅ 已修复：确保弹窗显示、状态更新、版本迭代）
// ============================================================

window.handleDelivery = async function() {
    if (!editingQuestionnaire || editingQuestionnaire.questions.length === 0) {
        showNotification('问卷没有题目，请先添加问题 ✦', 'warning', 2500);
        return;
    }

    let title = editingQuestionnaire.title || '未命名问卷';
    if (title.trim() === '未命名问卷') {
        const confirmResult = confirm('当前标题为"未命名问卷"，确定使用这个标题投递吗？\n点击"确定"继续投递，点击"取消"返回修改。');
        if (!confirmResult) return;
    }

    // 1. 关闭编辑器
    hideModal(document.getElementById('curiosity-compose-modal'));

    // 2. 生成新版本（投递：数字 +1）
    const currentVersion = editingQuestionnaire._version || createInitialVersion();
    const newVersion = incrementVersionNumber(currentVersion);

    // 3. 创建 A-1 版本问卷
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
        isNew: false,
        version: newVersion, // A-1
        _enteredYes: false
    };

    // 4. 存入 ing 并刷新列表（立即显示“等待回复中”）
    curiosityData.ing.push(newQuestionnaire);
    await saveCuriosityData();
    renderCuriosityLists();
    showDeliverySuccessPopup(newQuestionnaire);

    // 5. 启动后台模拟（异步执行，不阻塞 UI）
    // 注意：这里必须使用 IIFE 或者单独的函数，确保错误被捕获
    (async function() {
        try {
            const result = await startDeliveryProcess(newQuestionnaire);
            await handleDeliveryResult(result, newQuestionnaire);
        } catch (e) {
            console.error('[好奇驿站] 投递流程出错:', e);
            showNotification('投递流程出现异常，请重试', 'error');
        }
    })();
};

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

    setTimeout(() => {
        if (popup.parentNode) popup.remove();
    }, 15000);
}

// ============================================================
// 处理投递结果（✅ 已修复：删除旧版本，存入新版本，刷新列表，弹窗）
// ============================================================

async function handleDeliveryResult(result, originalQuestionnaire) {
    // 1. 删除旧版本（A-1 或 B-3 等）
    const ingIndex = curiosityData.ing.findIndex(q => q.id === originalQuestionnaire.id);
    if (ingIndex > -1) {
        curiosityData.ing.splice(ingIndex, 1);
    }

    // 2. 存入新版本（A-2 或 B-4 等）
    curiosityData.ing.push(result);

    // 3. 保存并刷新列表
    await saveCuriosityData();
    renderCuriosityLists();

    // 4. 显示回馈弹窗（延迟一点确保列表刷新完成）
    setTimeout(() => {
        showResultPopup(result);
    }, 500);
}

// ============================================================
// 回馈结果弹窗
// ============================================================

function showResultPopup(result) {
    const existing = document.getElementById('curiosity-result-popup');
    if (existing) existing.remove();

    const partnerName = (typeof settings !== 'undefined' && settings.partnerName) || '梦角';
    const attemptCount = result._stats ? (result._stats.answered + result._stats.skipped + result._stats.refused) : 0;
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

    setTimeout(() => {
        if (popup.parentNode) popup.remove();
    }, 10000);
}

// ============================================================
// 查看回馈结果
// ============================================================

window.openCuriosityResult = function(resultId) {
    const popup = document.getElementById('curiosity-result-popup');
    if (popup) popup.remove();

    const result = curiosityData.ing.find(q => q.id === resultId);
    if (!result) {
        showNotification('问卷记录不存在', 'error');
        return;
    }

    result.isNew = false;
    saveCuriosityData();
    renderCuriosityLists();

    switchCuriosityTab('ing');
    viewArchivedResult(result);
};

window.viewArchivedResult = function(result) {
    const parsed = getVersionNumber(result.version || 'A-0');
    openCuriosityDetail(result, false, parsed.number);
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

// ---------- 创建问卷入口 ----------
window.openNewCuriosityForm = function() {
    openCuriosityCompose();
};