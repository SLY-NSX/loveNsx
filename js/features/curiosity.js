// ============================================================
// 好奇驿站 - 问卷调查功能
// 基于信封投递框架改造
// ============================================================

// ---------- 数据模型 ----------
let curiosityData = { ing: [], archived: [] };
let currentCuriosityTab = 'ing';
let editingCuriosityId = null;

// 默认示例数据（首次打开时自动添加）
const TEST_SAMPLES = [
    {
        id: 'test_A1N_' + Date.now(),
        title: '测试问卷 A-1-N',
        questions: [
            { 
                id: 't1', 
                text: '你最喜欢的季节？', 
                type: 'single', 
                options: ['春天', '夏天', '秋天', '冬天']
            },
            { 
                id: 't2', 
                text: '你平时喜欢什么运动？', 
                type: 'multiple', 
                options: ['跑步', '游泳', '篮球', '瑜伽'],
                status: 'answered'
            },
            { 
                id: 't3', 
                text: '你怕黑吗？', 
                type: 'single', 
                options: ['怕', '不怕', '看情况'],
                status: 'rejected'
            },
            { 
                id: 't4', 
                text: '你相信一见钟情吗？', 
                type: 'single', 
                options: ['相信', '不信', '不确定'],
                status: 'unanswered'
            }
        ],
        sentTime: Date.now() - 3600000 * 3,
        status: 'ing',
        version: 'A-1-N',
        isDraft: false
    },
    {
        id: 'test_B2N_' + Date.now(),
        title: '测试问卷 B-2-N',
        questions: [
            { 
                id: 't5', 
                text: '你最想去的地方是？', 
                type: 'single', 
                options: ['海边', '雪山', '草原', '古城'],
                status: 'answered'
            },
            { 
                id: 't6', 
                text: '你喜欢什么类型的电影？', 
                type: 'multiple', 
                options: ['科幻', '爱情', '悬疑', '喜剧'],
                status: 'answered'
            },
            { 
                id: 't7', 
                text: '你养过宠物吗？', 
                type: 'single', 
                options: ['养过', '没养过', '想养'],
                status: 'unanswered'
            }
        ],
        sentTime: Date.now() - 3600000 * 5,
        status: 'ing',
        version: 'B-2-N',
        isDraft: false
    },
    {
        id: 'test_C4N_' + Date.now(),
        title: '测试问卷 C-4-N',
        questions: [
            { 
                id: 't8', 
                text: '你最喜欢的颜色是？', 
                type: 'single', 
                options: ['红色', '蓝色', '绿色', '紫色'],
                status: 'rejected'
            },
            { 
                id: 't9', 
                text: '你平时周末做什么？', 
                type: 'multiple', 
                options: ['看书', '运动', '追剧', '约朋友'],
                status: 'answered'
            },
            { 
                id: 't10', 
                text: '你喜欢吃辣吗？', 
                type: 'single', 
                options: ['超喜欢', '一般', '不吃辣'],
                status: 'unanswered'
            },
            { 
                id: 't11', 
                text: '你相信星座吗？', 
                type: 'single', 
                options: ['相信', '不信', '半信半疑']
            }
        ],
        sentTime: Date.now() - 3600000 * 8,
        status: 'ing',
        version: 'C-4-N',
        isDraft: false
    },
    {
        id: 'test_C6N_sameq_' + Date.now(),
        title: '测试问卷 C-6-N（含同问）',
        questions: [
            { 
                id: 't12', 
                text: '你最喜欢的音乐类型？', 
                type: 'single', 
                options: ['流行', '古典', '摇滚', '电子'],
                status: 'answered',
                isSameQuestion: true
            },
            { 
                id: 't13', 
                text: '你理想中的旅行目的地？', 
                type: 'multiple', 
                options: ['日本', '欧洲', '南极', '非洲'],
                status: 'answered'
            },
            { 
                id: 't14', 
                text: '你喜欢下雨天吗？', 
                type: 'single', 
                options: ['喜欢', '不喜欢', '看心情'],
                status: 'unanswered'
            }
        ],
        sentTime: Date.now() - 3600000 * 12,
        status: 'ing',
        version: 'C-6-N',
        isDraft: false
    },
    {
        id: 'sample_1_' + Date.now(),
        title: '关于你的一切',
        questions: [
            { id: 'q1', text: '你最喜欢的颜色？', type: 'single', options: ['红色', '蓝色', '绿色', '其他'] },
            { id: 'q2', text: '你平时喜欢做什么？', type: 'multiple', options: ['看书', '运动', '音乐', '旅行'] },
            { id: 'q3', text: '你对我的第一印象？', type: 'single', options: ['温柔', '有趣', '高冷', '可爱'] }
        ],
        sentTime: Date.now() - 3600000 * 2,
        status: 'ing',
        version: 'A-0-N',
        isDraft: false
    },
    {
        id: 'sample_2_' + Date.now(),
        title: '我们的未来',
        questions: [
            { id: 'q4', text: '你希望我们多久见一次面？', type: 'single', options: ['每天', '每周', '每月', '随缘'] },
            { id: 'q5', text: '你最想和我一起做的事？', type: 'multiple', options: ['看电影', '旅行', '做饭', '聊天'] }
        ],
        sentTime: Date.now() - 3600000 * 48,
        status: 'archived',
        version: 'A-2-N',
        isDraft: false
    }
];

// ---------- 存储操作 ----------
async function loadCuriosityData() {
    const saved = await localforage.getItem(getStorageKey('curiosityData'));
    
    // 生成带时间戳的测试数据（每次刷新都重新生成，确保卡片出现）
    const freshTestSamples = [
        {
            id: 'test_B4Y_' + Date.now(),
            title: '测试问卷 B-4-Y',
            questions: [
                { 
                    id: 't15', 
                    text: '你最喜欢的饮品？', 
                    type: 'single', 
                    options: ['咖啡', '茶', '果汁', '水'],
                    status: 'unanswered'  // 暂不回答标记
                },
                { 
                    id: 't16', 
                    text: '你平时几点睡觉？', 
                    type: 'single', 
                    options: ['22点前', '23点', '0点', '1点后'],
                    status: 'answered'
                }
            ],
            sentTime: Date.now() - 3600000 * 6,
            status: 'ing',
            version: 'B-4-Y',
            isDraft: false
        },
        {
            id: 'test_B8N_' + Date.now(),
            title: '测试问卷 B-8-N（暂不回答+同问）',
            questions: [
                { 
                    id: 't17', 
                    text: '你最喜欢的运动？', 
                    type: 'single', 
                    options: ['篮球', '足球', '游泳', '跑步'],
                    status: 'unanswered'  // 暂不回答标记
                },
                { 
                    id: 't18', 
                    text: '你最喜欢的电影类型？', 
                    type: 'multiple', 
                    options: ['科幻', '爱情', '悬疑', '喜剧'],
                    status: 'answered',
                    isSameQuestion: true  // 同问标记
                },
                { 
                    id: 't19', 
                    text: '你养过宠物吗？', 
                    type: 'single', 
                    options: ['养过', '没养过', '想养'],
                    status: 'answered'
                }
            ],
            sentTime: Date.now() - 3600000 * 9,
            status: 'ing',
            version: 'B-8-N',
            isDraft: false
        }
        {
            id: 'test_A1N_' + Date.now(),
            title: '测试问卷 A-1-N',
            questions: [
                { id: 't1', text: '你最喜欢的季节？', type: 'single', options: ['春天', '夏天', '秋天', '冬天'] },
                { id: 't2', text: '你平时喜欢什么运动？', type: 'multiple', options: ['跑步', '游泳', '篮球', '瑜伽'], status: 'answered' },
                { id: 't3', text: '你怕黑吗？', type: 'single', options: ['怕', '不怕', '看情况'], status: 'rejected' },
                { id: 't4', text: '你相信一见钟情吗？', type: 'single', options: ['相信', '不信', '不确定'], status: 'unanswered' }
            ],
            sentTime: Date.now() - 3600000 * 3,
            status: 'ing',
            version: 'A-1-N',
            isDraft: false
        },
        {
            id: 'test_B2N_' + Date.now(),
            title: '测试问卷 B-2-N',
            questions: [
                { id: 't5', text: '你最想去的地方是？', type: 'single', options: ['海边', '雪山', '草原', '古城'], status: 'answered' },
                { id: 't6', text: '你喜欢什么类型的电影？', type: 'multiple', options: ['科幻', '爱情', '悬疑', '喜剧'], status: 'answered' },
                { id: 't7', text: '你养过宠物吗？', type: 'single', options: ['养过', '没养过', '想养'], status: 'unanswered' }
            ],
            sentTime: Date.now() - 3600000 * 5,
            status: 'ing',
            version: 'B-2-N',
            isDraft: false
        },
        {
            id: 'test_C4N_' + Date.now(),
            title: '测试问卷 C-4-N',
            questions: [
                { id: 't8', text: '你最喜欢的颜色是？', type: 'single', options: ['红色', '蓝色', '绿色', '紫色'], status: 'rejected' },
                { id: 't9', text: '你平时周末做什么？', type: 'multiple', options: ['看书', '运动', '追剧', '约朋友'], status: 'answered' },
                { id: 't10', text: '你喜欢吃辣吗？', type: 'single', options: ['超喜欢', '一般', '不吃辣'], status: 'unanswered' },
                { id: 't11', text: '你相信星座吗？', type: 'single', options: ['相信', '不信', '半信半疑'] }
            ],
            sentTime: Date.now() - 3600000 * 8,
            status: 'ing',
            version: 'C-4-N',
            isDraft: false
        },
        {
            id: 'test_C6N_sameq_' + Date.now(),
            title: '测试问卷 C-6-N（含同问）',
            questions: [
                { id: 't12', text: '你最喜欢的音乐类型？', type: 'single', options: ['流行', '古典', '摇滚', '电子'], status: 'answered', isSameQuestion: true },
                { id: 't13', text: '你理想中的旅行目的地？', type: 'multiple', options: ['日本', '欧洲', '南极', '非洲'], status: 'answered' },
                { id: 't14', text: '你喜欢下雨天吗？', type: 'single', options: ['喜欢', '不喜欢', '看心情'], status: 'unanswered' }
            ],
            sentTime: Date.now() - 3600000 * 12,
            status: 'ing',
            version: 'C-6-N',
            isDraft: false
        },
        {
            id: 'sample_1_' + Date.now(),
            title: '关于你的一切',
            questions: [
                { id: 'q1', text: '你最喜欢的颜色？', type: 'single', options: ['红色', '蓝色', '绿色', '其他'] },
                { id: 'q2', text: '你平时喜欢做什么？', type: 'multiple', options: ['看书', '运动', '音乐', '旅行'] },
                { id: 'q3', text: '你对我的第一印象？', type: 'single', options: ['温柔', '有趣', '高冷', '可爱'] }
            ],
            sentTime: Date.now() - 3600000 * 2,
            status: 'ing',
            version: 'A-0-N',
            isDraft: false
        },
        {
            id: 'sample_2_' + Date.now(),
            title: '我们的未来',
            questions: [
                { id: 'q4', text: '你希望我们多久见一次面？', type: 'single', options: ['每天', '每周', '每月', '随缘'] },
                { id: 'q5', text: '你最想和我一起做的事？', type: 'multiple', options: ['看电影', '旅行', '做饭', '聊天'] }
            ],
            sentTime: Date.now() - 3600000 * 48,
            status: 'archived',
            version: 'A-2-N',
            isDraft: false
        }
    ];

    if (saved) {
        curiosityData = saved;
        // 强制合并测试数据（每次都覆盖或追加）
        curiosityData.ing = curiosityData.ing.filter(item => !item.id.startsWith('test_'));
        curiosityData.ing = [...freshTestSamples.filter(s => s.status === 'ing'), ...curiosityData.ing];
        // archived 也做类似处理
        curiosityData.archived = curiosityData.archived.filter(item => !item.id.startsWith('test_'));
        curiosityData.archived = [...freshTestSamples.filter(s => s.status === 'archived'), ...curiosityData.archived];
    } else {
        curiosityData = { ing: [], archived: [] };
        freshTestSamples.forEach(sample => {
            if (sample.status === 'ing') curiosityData.ing.push(sample);
            else curiosityData.archived.push(sample);
        });
    }
    await saveCuriosityData();
}

function saveCuriosityData() {
    localforage.setItem(getStorageKey('curiosityData'), curiosityData);
}

// ---------- 工具函数 ----------
function generateCuriosityId() {
    return 'qst_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
}

// ---------- 版本号工具函数 ----------
function parseVersion(version) {
    if (!version) return { prefix: 'A', number: 0, suffix: 'N' };
    const parts = version.split('-');
    return {
        prefix: parts[0] || 'A',
        number: parseInt(parts[1], 10) || 0,
        suffix: parts[2] || 'N'
    };
}

function getVersionNumber(version) {
    return parseVersion(version).number;
}

function getVersionPrefix(version) {
    return parseVersion(version).prefix;
}

function getVersionSuffix(version) {
    return parseVersion(version).suffix;
}

function incrementVersionNumber(version) {
    const parsed = parseVersion(version);
    return `${parsed.prefix}-${parsed.number + 1}-${parsed.suffix}`;
}

function incrementVersionNumberOnly(version) {
    const parsed = parseVersion(version);
    return `${parsed.prefix}-${parsed.number + 1}-${parsed.suffix}`;
}

// ---------- 自定义确认弹窗 ----------
function showCuriosityConfirm(options) {
    const { title, message, confirmText, onConfirm, cancelText, onCancel } = options;
    
    // 创建遮罩
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);';
    
    // 创建弹窗
    const box = document.createElement('div');
    box.style.cssText = 'background:var(--secondary-bg);border-radius:18px;padding:28px 32px 24px;max-width:380px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,0.3);border:1px solid var(--border-color);';
    
    const hasCancel = cancelText && typeof onCancel === 'function';
    
    box.innerHTML = `
        <div style="font-size:17px;font-weight:700;color:var(--text-primary);margin-bottom:10px;text-align:center;">${title}</div>
        <div style="font-size:14px;color:var(--text-secondary);line-height:1.7;margin-bottom:20px;text-align:center;white-space:pre-wrap;">${message}</div>
        <div style="display:flex;gap:10px;${!hasCancel ? 'justify-content:center;' : ''}">
            <button class="curiosity-confirm-btn" style="flex:${hasCancel ? '1' : 'none'};min-width:${hasCancel ? 'auto' : '120px'};padding:11px 24px;border:none;border-radius:12px;background:var(--accent-color);color:#fff;font-size:14px;font-weight:600;cursor:pointer;font-family:var(--font-family);transition:opacity 0.2s;">
                ${confirmText || '确认'}
            </button>
            ${hasCancel ? `<button class="curiosity-cancel-btn" style="flex:1;padding:11px 24px;border:1.5px solid var(--border-color);border-radius:12px;background:transparent;color:var(--text-secondary);font-size:14px;font-weight:500;cursor:pointer;font-family:var(--font-family);transition:background 0.2s;">${cancelText}</button>` : ''}
        </div>
    `;
    
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    
    // 确认按钮
    const confirmBtn = box.querySelector('.curiosity-confirm-btn');
    confirmBtn.addEventListener('click', () => {
        overlay.remove();
        if (onConfirm) onConfirm();
    });
    
    // 取消按钮
    const cancelBtn = box.querySelector('.curiosity-cancel-btn');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            overlay.remove();
            if (onCancel) onCancel();
        });
    }
    
    // 点击背景关闭（仅当有取消按钮时允许）
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay && hasCancel) {
            overlay.remove();
            if (onCancel) onCancel();
        }
    });
}

// 提取版本号中的数字部分
function getVersionNumber(version) {
    if (!version) return 0;
    const match = version.match(/-(\d+)-/);
    return match ? parseInt(match[1], 10) : 0;
}

// 判断编辑权限
function getEditPermissions(version) {
    const num = getVersionNumber(version);
    // 版本号数字为0：全部可编辑
    if (num === 0) {
        return { canEdit: true, canDeleteQuestion: true, canClickQuestion: true, canRename: true };
    }
    // 版本号为奇数：无任何编辑权
    if (num % 2 === 1) {
        return { canEdit: false, canDeleteQuestion: false, canClickQuestion: false, canRename: false };
    }
    // 版本号为偶数（非0）：可删除问题
    return { canEdit: false, canDeleteQuestion: true, canClickQuestion: false, canRename: false };
}

// 判断是否为草稿（未投递）
function isDraftQuestionnaire(questionnaire) {
    return questionnaire.isDraft === true || questionnaire.status === 'draft' || questionnaire.id === null;
}

// 判断问卷是否有内容（有标题或有问题）
function hasQuestionnaireContent(questionnaire) {
    if (!questionnaire) return false;
    const hasTitle = questionnaire.title && questionnaire.title.trim() !== '' && questionnaire.title !== '未命名问卷';
    const hasQuestions = (questionnaire.questions || []).length > 0;
    return hasTitle || hasQuestions;
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
        // 判断是否为草稿
        const isDraft = letter.isDraft === true || letter.status === 'draft' || !letter.id;
        const dateDisplay = isDraft ? '📝 未投递' : '投递 · ' + new Date(letter.sentTime).toLocaleDateString('zh-CN', {
            month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });
        
        let singleCount = 0, multiCount = 0;
        (letter.questions || []).forEach(q => {
            if (q.type === 'single') singleCount++;
            else if (q.type === 'multiple') multiCount++;
        });
        const qCount = (letter.questions || []).length;
        const titleHtml = `<div style="font-weight:700;font-size:14px;color:var(--text-primary);">${letter.title || '未命名问卷'}</div>`;
        const statsHtml = `<div style="font-size:12px;color:var(--text-secondary);margin-top:2px;">共${qCount}问 · ${singleCount}道单选 · ${multiCount}道多选</div>`;
        const statusText = isDraft ? '📝 草稿' : (status === 'ing' ? '⏳ 等待回复中' : '✅ 已归档');

        return `
            <div class="env-letter-item curiosity-letter-item" onclick="viewCuriosityLetter('${status}','${letter.id}')">
                <div class="env-letter-header curiosity-compact-header">
                    <div class="env-letter-header-from">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px;margin-right:4px;">
                            <rect x="2" y="4" width="20" height="16" rx="2"/>
                            <path d="M22 7l-10 7L2 7"/>
                        </svg>
                        ${dateDisplay}
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

// ---------- 查看详情（点击卡片） ----------
window.viewCuriosityLetter = function(status, id) {
    // 从数据中查找问卷
    let questionnaire = null;
    let sourceStatus = null;
    if (status === 'ing') {
        questionnaire = curiosityData.ing.find(item => item.id === id);
        sourceStatus = 'ing';
    } else {
        questionnaire = curiosityData.archived.find(item => item.id === id);
        sourceStatus = 'archived';
    }
    if (!questionnaire) {
        showNotification('问卷不存在', 'error');
        return;
    }
    // 关闭主模态框，打开详情页
    hideModal(document.getElementById('curiosity-modal'));
    setTimeout(() => {
        openCuriosityComposeForView(questionnaire, sourceStatus);
    }, 200);
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

// ---------- 打开新建问卷 ----------
window.openNewCuriosityForm = function() {
    openCuriosityCompose();
};

// ---------- 关闭主模态框 ----------
window.closeCuriosityModal = function() {
    hideModal(document.getElementById('curiosity-modal'));
};

// ============================================================
// 创建问卷 - 编辑/查看页面
// ============================================================

// 当前编辑中的问卷数据
let editingQuestionnaire = {
    id: null,
    title: '',
    questions: [],
    createdTime: Date.now(),
    version: 'A-0-N',
    status: 'draft',
    isDraft: true,
    sentTime: null,
    _sourceStatus: null  // 来源列表，用于保存时更新
};

// 是否正在查看模式（从卡片点击进入）
let isViewMode = false;

// 打开创建问卷编辑器（新建）
window.openCuriosityCompose = function() {
    isViewMode = false;
    editingQuestionnaire = {
        id: null,
        title: '未命名问卷',
        questions: [],
        createdTime: Date.now(),
        version: 'A-0-N',
        status: 'draft',
        isDraft: true,
        sentTime: null,
        _sourceStatus: null
    };
    renderComposeEditor();
    showModal(document.getElementById('curiosity-compose-modal'));
};

// 打开创建问卷编辑器（查看已有问卷）
window.openCuriosityComposeForView = function(questionnaire, sourceStatus) {
    isViewMode = true;
    editingQuestionnaire = {
        ...questionnaire,
        _sourceStatus: sourceStatus || (questionnaire.status === 'ing' ? 'ing' : 'archived')
    };
    renderComposeEditor();
    showModal(document.getElementById('curiosity-compose-modal'));
};

// ---------- 保存问卷到数据存储 ----------
function saveQuestionnaireToData(questionnaire, sourceStatus) {
    if (!questionnaire.id) {
        // 新建：生成ID
        questionnaire.id = generateCuriosityId();
        questionnaire.isDraft = false;
        questionnaire.sentTime = Date.now();
        // 放入 ing 列表
        curiosityData.ing.push({ ...questionnaire });
    } else {
        // 更新已有
        const targetArr = sourceStatus === 'ing' ? curiosityData.ing : curiosityData.archived;
        const index = targetArr.findIndex(item => item.id === questionnaire.id);
        if (index > -1) {
            // 保留原有状态字段，更新内容
            const existing = targetArr[index];
            targetArr[index] = {
                ...existing,
                title: questionnaire.title,
                questions: questionnaire.questions,
                version: questionnaire.version || existing.version || 'A-0-N'
            };
        } else {
            // 可能在另一个列表里，尝试查找
            const otherArr = sourceStatus === 'ing' ? curiosityData.archived : curiosityData.ing;
            const otherIndex = otherArr.findIndex(item => item.id === questionnaire.id);
            if (otherIndex > -1) {
                const existing = otherArr[otherIndex];
                otherArr[otherIndex] = {
                    ...existing,
                    title: questionnaire.title,
                    questions: questionnaire.questions,
                    version: questionnaire.version || existing.version || 'A-0-N'
                };
            } else {
                // 极端情况：找不到，重新添加
                curiosityData.ing.push({ ...questionnaire, isDraft: false, sentTime: Date.now() });
            }
        }
    }
    saveCuriosityData();
    renderCuriosityLists();
}

// ---------- 渲染编辑器内容 ----------
function renderComposeEditor() {
    const titleEl = document.getElementById('compose-title-display');
    const dateEl = document.getElementById('compose-date-line');
    const questionsContainer = document.getElementById('compose-questions-container');
    const editBtn = document.getElementById('compose-edit-btn');
    const deleteBtns = document.querySelectorAll('.compose-question-delete-btn');
    
    // 获取权限
    const permissions = getEditPermissions(editingQuestionnaire.version);
    const isDraft = isDraftQuestionnaire(editingQuestionnaire);
    
    // 设置标题
    if (titleEl) {
        titleEl.textContent = editingQuestionnaire.title || '未命名问卷';
        // 改名权限
        titleEl.style.cursor = permissions.canRename ? 'pointer' : 'default';
        titleEl.style.opacity = permissions.canRename ? '1' : '0.6';
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
            // 判断是否可以点击编辑问题（权限 + 双数特殊情况）
            let canClick = permissions.canClickQuestion;
            // 双数特殊情况：标记【同问】的问题可交互（占位）
            const isSameQuestion = q.isSameQuestion === true;
            if (permissions.canDeleteQuestion && !permissions.canClickQuestion && isSameQuestion) {
                canClick = true; // 【同问】占位，可交互
            }
            // 如果没有编辑权且不是【同问】，则不可点击
            const clickable = canClick ? 'cursor:pointer;' : 'cursor:default;';
            const hoverEffect = canClick ? 'compose-question-card-hover' : '';
            
            const optionsHtml = (q.options || []).map((opt, oi) => 
                `<div style="display:flex;align-items:center;gap:6px;padding:2px 0 2px 6px;font-size:13px;color:var(--text-secondary);">
                    <span style="display:inline-block;width:12px;height:12px;border-radius:50%;border:1.5px solid rgba(var(--accent-color-rgb),0.25);flex-shrink:0;"></span>
                    <span>${escapeHtml(opt)}</span>
                </div>`
            ).join('');
            
            // 是否显示删除按钮
            const showDelete = permissions.canDeleteQuestion && questions.length > 1;
            // 如果只有一个问题，禁止删除
            const deleteDisabled = questions.length <= 1;
            
            html += `
                <div class="compose-question-card ${hoverEffect}" onclick="${canClick ? `openQuestionEditorForEdit(${index})` : ''}" style="margin-bottom:0;padding:14px 32px 12px 0px;cursor:${canClick ? 'pointer' : 'default'};position:relative;border-bottom:1.5px dashed rgba(var(--accent-color-rgb),0.15);overflow:visible;${!canClick ? 'opacity:0.7;' : ''}">
                    <!-- 第一行：Q1 + 小圆点 + 类型标签 -->
                    <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
                        <span style="font-size:13px;font-weight:700;color:var(--accent-color);letter-spacing:0.5px;">Q${index + 1}</span>
                        <span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:rgba(var(--accent-color-rgb),0.5);flex-shrink:0;"></span>
                        <span style="font-size:10px;color:var(--text-secondary);opacity:0.7;background:rgba(var(--accent-color-rgb),0.06);padding:0 8px;border-radius:10px;border:1px solid rgba(var(--accent-color-rgb),0.08);">${typeLabel}</span>
                        ${isSameQuestion ? `<span style="font-size:9px;color:var(--accent-color);background:rgba(var(--accent-color-rgb),0.12);padding:0 6px;border-radius:4px;border:1px solid rgba(var(--accent-color-rgb),0.2);">【同问】</span>` : ''}
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
                    ${showDelete ? `
                        <button class="compose-question-delete-btn" onclick="event.stopPropagation();deleteQuestion(${index})" style="position:absolute;top:12px;right:4px;background:none;border:none;color:var(--text-secondary);cursor:pointer;font-size:11px;opacity:0.25;padding:4px;transition:opacity 0.2s;" onmouseover="this.style.opacity='0.7'" onmouseout="this.style.opacity='0.25'">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                    ` : (deleteDisabled ? `
                        <span style="position:absolute;top:12px;right:4px;font-size:9px;color:var(--text-secondary);opacity:0.3;">至少保留1题</span>
                    ` : '')}
                </div>
            `;
        });
        questionsContainer.innerHTML = html;
    }
    
    // 控制底部按钮显示
    const submitBtn = document.querySelector('#curiosity-compose-modal .env-wrapper > div > div:last-child button:first-child');
    const editBtnEl = document.querySelector('#curiosity-compose-modal .env-wrapper > div > div:last-child button:nth-child(2)');
    const archiveBtn = document.querySelector('#curiosity-compose-modal .env-wrapper > div > div:last-child button:nth-child(3)');
    
    // 根据权限控制"提问"按钮（编辑按钮）
    if (editBtnEl) {
        if (!permissions.canEdit && !isDraft) {
            editBtnEl.style.opacity = '0.4';
            editBtnEl.style.cursor = 'not-allowed';
            editBtnEl.onclick = function(e) {
                e.stopPropagation();
                showNotification('当前版本不支持编辑问题', 'info', 2000);
            };
        } else {
            editBtnEl.style.opacity = '1';
            editBtnEl.style.cursor = 'pointer';
            editBtnEl.onclick = openQuestionEditor;
        }
    }
    
    // 控制"归档"按钮
    if (archiveBtn) {
        if (isDraft || isViewMode) {
            archiveBtn.style.display = 'flex';
        } else {
            archiveBtn.style.display = 'flex';
        }
    }
}

// ---------- 标题点击编辑 ----------
window.editComposeTitle = function() {
    const permissions = getEditPermissions(editingQuestionnaire.version);
    if (!permissions.canRename) {
        showNotification('当前版本不支持修改标题', 'info', 2000);
        return;
    }
    const currentTitle = editingQuestionnaire.title || '未命名问卷';
    const newTitle = prompt('请输入问卷标题：', currentTitle);
    if (newTitle !== null && newTitle.trim() !== '') {
        editingQuestionnaire.title = newTitle.trim();
        const titleEl = document.getElementById('compose-title-display');
        if (titleEl) titleEl.textContent = editingQuestionnaire.title;
    }
};

// ---------- 底部按钮操作 ----------
window.composeAction = function(action) {
    if (action === 'submit') {
        handleSubmitQuestionnaire();
        return;
    }
    if (action === 'confirm') {
        showNotification('📦 归档功能开发中，敬请期待 ✦', 'info', 2500);
        return;
    }
    const messages = {
        'draft': '📝 草稿保存功能开发中，敬请期待 ✦'
    };
    showNotification(messages[action] || '功能开发中 ✦', 'info', 2500);
};


// ---------- 投递处理（阶段1 - 修正版） ----------
// ---------- 投递处理（阶段1 - 修正版） ----------
function handleSubmitQuestionnaire() {
    const questions = editingQuestionnaire.questions || [];
    
    // 基础检查：至少1个问题
    if (questions.length === 0) {
        showNotification('问卷至少需要 1 个问题才能投递 ✦', 'warning', 2500);
        return;
    }
    
    // 解析当前版本号
    const currentVersion = editingQuestionnaire.version || 'A-0-N';
    const versionNum = getVersionNumber(currentVersion);
    const versionPrefix = getVersionPrefix(currentVersion);
    const partnerName = (typeof settings !== 'undefined' && settings.partnerName) || '梦角';
    const title = editingQuestionnaire.title || '未命名问卷';
    
    // ============================================================
    // 关口1：数字是否为0 或 首字母是否为A
    // ============================================================
    if (versionNum === 0 || versionPrefix === 'A') {
        const isDefaultTitle = !editingQuestionnaire.title || editingQuestionnaire.title === '未命名问卷';
        if (isDefaultTitle) {
            showCuriosityConfirm({
                title: '📝 修改标题',
                message: '当前问卷标题为默认名称，是否修改后再投递？\n\n点击「修改」返回编辑\n点击「继续投递」直接发出',
                confirmText: '修改标题',
                cancelText: '继续投递',
                onConfirm: () => {
                    editComposeTitle();
                },
                onCancel: () => {
                    proceedToSend('case1');
                }
            });
            return;
        } else {
            proceedToSend('case1');
            return;
        }
    }
    
    // ============================================================
    // 关口1不满足 → 进入后续检查
    // ============================================================
    
    // 步骤A：检查是否有【同问】标记
    const hasSameQuestion = questions.some(q => q.isSameQuestion === true);
    if (hasSameQuestion) {
        showCuriosityConfirm({
            title: '💭 好奇你的答案',
            message: `${partnerName} 也在好奇你的答案，思考选择吧 ✦`,
            confirmText: '我知道了',
            onConfirm: () => {
                // 传入 true 表示同问已弹过
                proceedWithSameQuestionChecked(true);
            }
        });
        return;
    }
    
    // 没有【同问】，直接进入下一步
    proceedWithSameQuestionChecked();
    
    // ============================================================
    // 步骤B：根据首字母分支判断
    // ============================================================
    function proceedWithSameQuestionChecked(hasShownSameQuestion) {
        const hasUnanswered = questions.some(q => q.status === 'unanswered');
        const hasInteractiveOne = questions.some(q => q.isInteractiveOne === true);
        
        if (versionPrefix === 'B') {
            if (hasUnanswered || hasInteractiveOne) {
                if (hasUnanswered) {
                    proceedToSend('case2');
                } else {
                    proceedToSend('case3');
                }
            } else {
                // 两者都无 → 不可投递
                // 如果已经弹过同问弹窗，就不再弹不可投递提示
                if (!hasShownSameQuestion) {
                    showNotDeliverable();
                }
            }
            return;
        }
        
        // 首字母不是 B（C/D/E...）
        if (hasInteractiveOne) {
            proceedToSend('case4');
        } else {
            // 无同问互动一 → 不可投递
            if (!hasShownSameQuestion) {
                showNotDeliverable();
            }
        }
    }
    
    // ============================================================
    // 发出弹窗
    // ============================================================
    function proceedToSend(caseType) {
        const newVersion = incrementVersionNumber(editingQuestionnaire.version || 'A-0-N');
        const newNum = getVersionNumber(newVersion);
        const x = Math.ceil((newNum + 1) / 2);
        
        let titleText, messageText;
        if (caseType === 'case1' || caseType === 'case2') {
            titleText = '📬 问卷发出';
            messageText = `「${title}.${x}」\n即将送达 ${partnerName} 处 ✦`;
        } else { // case3 或 case4
            titleText = '📬 回复发出';
            messageText = `${partnerName} 即将收到你关于「${title}.${x}」的回复 ✦`;
        }
        
        showCuriosityConfirm({
            title: titleText,
            message: messageText,
            confirmText: '确认',
            onConfirm: () => {
                editingQuestionnaire.version = newVersion;
                
                if (!editingQuestionnaire.id) {
                    editingQuestionnaire.id = generateCuriosityId();
                }
                
                editingQuestionnaire.isDraft = false;
                editingQuestionnaire.sentTime = Date.now();
                editingQuestionnaire.status = 'ing';
                
                const targetArr = curiosityData.ing;
                const existingIndex = targetArr.findIndex(item => item.id === editingQuestionnaire.id);
                if (existingIndex > -1) {
                    targetArr[existingIndex] = {
                        ...targetArr[existingIndex],
                        title: editingQuestionnaire.title,
                        questions: editingQuestionnaire.questions,
                        version: editingQuestionnaire.version,
                        isDraft: false,
                        sentTime: editingQuestionnaire.sentTime,
                        status: 'ing'
                    };
                } else {
                    const archivedIndex = curiosityData.archived.findIndex(item => item.id === editingQuestionnaire.id);
                    if (archivedIndex > -1) {
                        curiosityData.archived.splice(archivedIndex, 1);
                    }
                    targetArr.push({
                        id: editingQuestionnaire.id,
                        title: editingQuestionnaire.title,
                        questions: editingQuestionnaire.questions,
                        version: editingQuestionnaire.version,
                        isDraft: false,
                        sentTime: editingQuestionnaire.sentTime,
                        status: 'ing'
                    });
                }
                
                saveCuriosityData();
                renderCuriosityLists();
                showNotification(`📬 问卷已投递！版本：${editingQuestionnaire.version}`, 'success', 2000);
                
                setTimeout(() => {
                    showNotification('🧠 后台回复逻辑开发中（阶段2），敬请期待 ✦', 'info', 3000);
                }, 500);
                
                closeCuriosityCompose(true);
                setTimeout(() => {
                    showModal(document.getElementById('curiosity-modal'));
                    switchCuriosityTab('ing');
                }, 300);
            }
        });
    }
    
    function showNotDeliverable() {
        showCuriosityConfirm({
            title: '🚫 不可投递',
            message: '当前情况不可投递，可进行归档',
            confirmText: '我知道了',
            onConfirm: () => {}
        });
    }
}
// ---------- 关闭编辑器（核心逻辑） ----------
// ---------- 关闭编辑器 ----------
window.closeCuriosityCompose = function(skipConfirm) {
    // 如果是从投递成功调用的，跳过确认弹窗
    if (skipConfirm) {
        hideModal(document.getElementById('curiosity-compose-modal'));
        return;
    }
    
    const isNew = !editingQuestionnaire.id;
    const hasContent = hasQuestionnaireContent(editingQuestionnaire);
    const questions = editingQuestionnaire.questions || [];
    const hasQuestions = questions.length > 0;
    
    // 判断是否为只读模式（从卡片进入查看）
    const permissions = getEditPermissions(editingQuestionnaire.version);
    const isReadOnly = !permissions.canEdit && !permissions.canDeleteQuestion;
    
    // 只读模式：直接关闭，不询问保存
    if (isReadOnly && isViewMode) {
        hideModal(document.getElementById('curiosity-compose-modal'));
        if (isViewMode) {
            setTimeout(() => {
                showModal(document.getElementById('curiosity-modal'));
            }, 300);
        }
        return;
    }
    
    // 无内容，直接关闭
    if (!hasQuestions && !hasContent) {
        hideModal(document.getElementById('curiosity-compose-modal'));
        if (isViewMode) {
            setTimeout(() => {
                showModal(document.getElementById('curiosity-modal'));
            }, 300);
        }
        return;
    }
    
    if (isNew) {
        // 新建模式：有内容，询问是否保存草稿
        if (confirm('问卷尚未保存，是否保存为草稿？\n\n点击「确定」保存草稿\n点击「取消」放弃修改')) {
            if (!editingQuestionnaire.id) {
                editingQuestionnaire.id = generateCuriosityId();
            }
            editingQuestionnaire.isDraft = true;
            editingQuestionnaire.sentTime = Date.now();
            editingQuestionnaire.status = 'draft';
            if (!editingQuestionnaire.version) {
                editingQuestionnaire.version = 'A-0-N';
            }
            
            const existingIndex = curiosityData.ing.findIndex(item => item.id === editingQuestionnaire.id);
            if (existingIndex > -1) {
                curiosityData.ing[existingIndex] = {
                    ...curiosityData.ing[existingIndex],
                    title: editingQuestionnaire.title,
                    questions: editingQuestionnaire.questions,
                    version: editingQuestionnaire.version,
                    isDraft: true,
                    sentTime: editingQuestionnaire.sentTime,
                    status: 'draft'
                };
            } else {
                const archivedIndex = curiosityData.archived.findIndex(item => item.id === editingQuestionnaire.id);
                if (archivedIndex > -1) {
                    curiosityData.archived.splice(archivedIndex, 1);
                }
                curiosityData.ing.push({
                    id: editingQuestionnaire.id,
                    title: editingQuestionnaire.title,
                    questions: editingQuestionnaire.questions,
                    version: editingQuestionnaire.version,
                    isDraft: true,
                    sentTime: editingQuestionnaire.sentTime,
                    status: 'draft'
                });
            }
            saveCuriosityData();
            renderCuriosityLists();
            showNotification('📝 草稿已保存', 'success', 1500);
        }
    } else {
        // 非新建模式：询问是否保存修改
        if (confirm('是否保存本次修改？\n\n点击「确定」保存内容\n点击「取消」放弃修改')) {
            const targetArr = editingQuestionnaire._sourceStatus === 'ing' ? curiosityData.ing : curiosityData.archived;
            const index = targetArr.findIndex(item => item.id === editingQuestionnaire.id);
            if (index > -1) {
                targetArr[index] = {
                    ...targetArr[index],
                    title: editingQuestionnaire.title,
                    questions: editingQuestionnaire.questions,
                    version: editingQuestionnaire.version || targetArr[index].version || 'A-0-N'
                };
                saveCuriosityData();
                renderCuriosityLists();
                showNotification('已保存修改', 'success', 1500);
            }
        }
    }
    
    hideModal(document.getElementById('curiosity-compose-modal'));
    if (isViewMode) {
        setTimeout(() => {
            showModal(document.getElementById('curiosity-modal'));
        }, 300);
    }
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
    // 检查权限
    const permissions = getEditPermissions(editingQuestionnaire.version);
    if (!permissions.canEdit) {
        showNotification('当前版本不支持编辑问题', 'info', 2000);
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
    // 检查权限
    const permissions = getEditPermissions(editingQuestionnaire.version);
    // 双数特殊情况：【同问】标记的问题可交互（占位）
    const q = editingQuestionnaire.questions[index];
    if (q && q.isSameQuestion && !permissions.canClickQuestion && permissions.canDeleteQuestion) {
        showNotification('【同问】功能开发中，敬请期待 ✦', 'info', 2000);
        return;
    }
    if (!permissions.canClickQuestion) {
        showNotification('当前版本不支持编辑问题', 'info', 2000);
        return;
    }
    
    const question = editingQuestionnaire.questions[index];
    if (!question) return;
    
    editingQuestionIndex = index;
    tempQuestionData = {
        text: question.text || '',
        type: question.type || 'single',
        options: [...(question.options || ['', ''])]
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
        options: options,
        isSameQuestion: false
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
    // 检查权限
    const permissions = getEditPermissions(editingQuestionnaire.version);
    if (!permissions.canDeleteQuestion) {
        showNotification('当前版本不支持删除问题', 'info', 2000);
        return;
    }
    if ((editingQuestionnaire.questions || []).length <= 1) {
        showNotification('至少保留 1 个问题', 'warning', 1500);
        return;
    }
    if (!confirm('确定要删除这个问题吗？')) return;
    editingQuestionnaire.questions.splice(index, 1);
    renderComposeEditor();
    showNotification('问题已删除', 'success', 1500);
};