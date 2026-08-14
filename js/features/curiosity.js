// ============================================================
// 好奇驿站 - 问卷调查功能
// 基于信封投递框架改造
// ============================================================

// ---------- 数据模型 ----------
let curiosityData = { ing: [], archived: [] };
let currentCuriosityTab = 'ing';
let editingCuriosityId = null;

// ---------- 存储操作 ----------
async function loadCuriosityData() {
    const saved = await localforage.getItem(getStorageKey('curiosityData'));
    
    // 生成带时间戳的测试数据（每次刷新都重新生成，确保卡片出现）
    const freshTestSamples = [
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
            id: 'test_B4Y_' + Date.now(),
            title: '测试问卷 B-4-Y',
            questions: [
                { id: 't15', text: '你最喜欢的饮品？', type: 'single', options: ['咖啡', '茶', '果汁', '水'], status: 'unanswered' },
                { id: 't16', text: '你平时几点睡觉？', type: 'single', options: ['22点前', '23点', '0点', '1点后'], status: 'answered' }
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
                { id: 't17', text: '你最喜欢的运动？', type: 'single', options: ['篮球', '足球', '游泳', '跑步'], status: 'unanswered' },
                { id: 't18', text: '你最喜欢的电影类型？', type: 'multiple', options: ['科幻', '爱情', '悬疑', '喜剧'], status: 'answered', isSameQuestion: true },
                { id: 't19', text: '你养过宠物吗？', type: 'single', options: ['养过', '没养过', '想养'], status: 'answered' }
            ],
            sentTime: Date.now() - 3600000 * 9,
            status: 'ing',
            version: 'B-8-N',
            isDraft: false
        },
        // ===== 新增：C-6-Y（含【同问.互动一】标记） =====
        {
            id: 'test_C6Y_interactive_' + Date.now(),
            title: '测试问卷 C-6-Y（含同问互动一）',
            questions: [
                { 
                    id: 't20', 
                    text: '你最喜欢的书籍类型？', 
                    type: 'single', 
                    options: ['文学', '科幻', '历史', '哲学'], 
                    status: 'answered',
                    isSameQuestion: false,
                    isInteractiveOne: true,      // 【同问.互动一】标记
                    isInteractiveOneDone: false
                },
                { 
                    id: 't21', 
                    text: '你平时喜欢什么休闲活动？', 
                    type: 'multiple', 
                    options: ['阅读', '运动', '音乐', '旅行'], 
                    status: 'answered',
                    isSameQuestion: false,
                    isInteractiveOne: false,
                    isInteractiveOneDone: false
                },
                { 
                    id: 't22', 
                    text: '你相信命运吗？', 
                    type: 'single', 
                    options: ['相信', '不信', '半信半疑'], 
                    status: 'unanswered',
                    isSameQuestion: false,
                    isInteractiveOne: false,
                    isInteractiveOneDone: false
                }
            ],
            sentTime: Date.now() - 3600000 * 14,
            status: 'ing',
            version: 'C-6-Y',
            isDraft: false
        },
        // ===== 新增结束 =====
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
    return 'qst_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
}

/**
 * 统一存储问卷最新版本（版本号变化时调用）
 * 存储完整当前数据 + 上一版本号名称（仅保留名称用于对比）
 * 如果问卷不存在，则自动创建新条目
 */
function saveQuestionnaireVersion(questionnaireId, newVersion, prevVersion, updatedQuestions, status, sentTime) {
    // 先在 ing 中查找
    let targetArr = curiosityData.ing;
    let index = targetArr.findIndex(item => item.id === questionnaireId);
    let found = index > -1;
    let targetStatus = 'ing';

    if (!found) {
        // 在 archived 中查找
        targetArr = curiosityData.archived;
        index = targetArr.findIndex(item => item.id === questionnaireId);
        found = index > -1;
        if (found) targetStatus = 'archived';
    }

    if (found) {
        // 更新已有问卷
        const existing = targetArr[index];
        targetArr[index] = {
            ...existing,
            version: newVersion,
            prevVersion: prevVersion || existing.version,
            questions: updatedQuestions,
            status: status || existing.status,
            sentTime: sentTime || existing.sentTime,
            isDraft: false
        };
        console.log(`[存储] 问卷 ${questionnaireId} 已更新到版本 ${newVersion}，上一版本: ${prevVersion || existing.version}`);
    } else {
        // ⭐ 新增：问卷不存在 → 创建新条目
        console.log(`[存储] 问卷 ${questionnaireId} 不存在，创建新条目`);
        const newEntry = {
            id: questionnaireId,
            title: '未命名问卷',
            questions: updatedQuestions,
            version: newVersion,
            prevVersion: prevVersion || 'A-0-N',
            status: status || 'ing',
            sentTime: sentTime || Date.now(),
            isDraft: false,
            createdTime: Date.now()
        };
        // 根据 status 决定放入 ing 还是 archived
        const targetList = (status === 'archived') ? curiosityData.archived : curiosityData.ing;
        targetList.push(newEntry);
        console.log(`[存储] 新问卷 ${questionnaireId} 已创建，版本: ${newVersion}`);
    }

    saveCuriosityData();
    renderCuriosityLists();
}

// ---------- 随机工具函数 ----------
/**
 * 在 min~max 秒之间随机一个整数
 */
function randomSeconds(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * 随机选择数组中的一个元素
 */
function randomPick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * 随机选择一个选项（从选项列表中选择一个索引）
 */
function randomSelectOption(options) {
    return Math.floor(Math.random() * options.length);
}

/**
 * 随机选择多个选项（从选项列表中随机选择 count 个）
 */
function randomSelectMultiple(options, count) {
    const shuffled = [...options];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled.slice(0, Math.min(count, shuffled.length)).map((_, idx) => idx);
}

/**
 * 三选一判断（概率均等）
 * @returns {'rejected' | 'unanswered' | 'answered'}
 */
function randomDecision() {
    const choices = ['rejected', 'unanswered', 'answered'];
    return randomPick(choices);
}

// ---------- 版本号工具函数 ----------
function parseVersion(version) {
    if (!version) return { prefix: 'A', number: 0, suffix: 'N' };
    const parts = version.split('-');
    return {
        prefix: parts[0] || 'A',
        number: parseInt(parts[1] || '0', 10) || 0,
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

// ---------- 版本号迭代规则（阶段2） ----------
/**
 * 更新版本号（完整迭代规则）
 * @param {string} currentVersion - 当前版本号，如 "A-0-N"
 * @param {object} flags - 迭代标志
 * @param {boolean} flags.enteredBigLoop - 本次是否进入了大循环
 * @param {boolean} flags.enteredYes - 本次是否进入了YES
 * @returns {string} 新的版本号
 * 
 * 规则：
 * - 数字：每次调用都 +1
 * - 首字母：如果 enteredBigLoop && enteredYes，则递增（A→B→C...）
 * - 尾字母：如果 enteredBigLoop，则为 Y，否则为 N
 */
function updateVersion(currentVersion, flags) {
    const parsed = parseVersion(currentVersion || 'A-0-N');
    const { prefix, number, suffix } = parsed;
    const { enteredBigLoop, enteredYes } = flags || {};
    
    // 数字：始终 +1
    const newNumber = number + 1;
    
    // 尾字母：进入过大循环则为 Y，否则为 N
    let newSuffix = enteredBigLoop ? 'Y' : 'N';
    // 如果没有传 enteredBigLoop，保持原后缀
    if (enteredBigLoop === undefined) {
        newSuffix = suffix;
    }
    
    // 首字母：如果进入大循环且进入YES，则递增
    let newPrefix = prefix;
    if (enteredBigLoop && enteredYes) {
        // A→B→C→...→Z→AA→AB...
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        let currentIndex = chars.indexOf(prefix);
        if (currentIndex === -1) {
            // 如果是AA之类的，简单处理：先保留
            newPrefix = prefix;
        } else if (currentIndex < chars.length - 1) {
            newPrefix = chars[currentIndex + 1];
        } else {
            // Z → AA
            newPrefix = 'AA';
        }
    } else if (enteredBigLoop === undefined || enteredBigLoop === false) {
        // 未进入大循环或未进入YES，首字母不变
        newPrefix = prefix;
    }
    
    return `${newPrefix}-${newNumber}-${newSuffix}`;
}

/**
 * 获取下一个版本号（用于【发出】时只做数字+1）
 * @param {string} currentVersion - 当前版本号
 * @returns {string} 新的版本号（仅数字+1，首字母和尾字母不变）
 */
function getNextVersionForSend(currentVersion) {
    const parsed = parseVersion(currentVersion || 'A-0-N');
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
        const versionDisplay = letter.version || 'A-0-N';
        const dateDisplay = isDraft ? '📝 未投递' : '投递 · ' + new Date(letter.sentTime).toLocaleDateString('zh-CN', {
            month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });
        // 组合显示：日期 + 版本号（小字）
        const headerText = dateDisplay + ' <span style="font-size:10px;opacity:0.6;margin-left:4px;">| ' + versionDisplay + '</span>';
        
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
                        ${headerText}
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
    // 设置日期
    if (dateEl) {
        // 优先使用 createdTime，如果无效则使用 sentTime，再无效则用当前时间
        let timeSource = editingQuestionnaire.createdTime || editingQuestionnaire.sentTime || Date.now();
        // 如果是字符串，尝试转换为数字
        if (typeof timeSource === 'string') {
            timeSource = parseInt(timeSource, 10);
        }
        // 如果还是无效，使用当前时间
        if (isNaN(timeSource) || timeSource < 0) {
            timeSource = Date.now();
        }
        const now = new Date(timeSource);
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
// 发出弹窗（统一存储逻辑）
// ============================================================
function proceedToSend(caseType) {
    const newVersion = getNextVersionForSend(editingQuestionnaire.version || 'A-0-N');
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
            // 生成ID（如果还没有）
            if (!editingQuestionnaire.id) {
                editingQuestionnaire.id = generateCuriosityId();
            }
            
            // 投递标记
            editingQuestionnaire.isDraft = false;
            editingQuestionnaire.sentTime = Date.now();
            editingQuestionnaire.status = 'ing';
            
            // 使用统一存储函数保存
            const prevVersion = editingQuestionnaire.version; // 投递前的版本
            saveQuestionnaireVersion(
                editingQuestionnaire.id,
                newVersion,
                prevVersion,
                editingQuestionnaire.questions,
                'ing',
                editingQuestionnaire.sentTime
            );
            
            showNotification(`📬 问卷已投递！版本：${newVersion}`, 'success', 2000);
            
            // 启动后台回复逻辑
            setTimeout(async () => {
                try {
                    const result = await simulateReplyLogic(
                        editingQuestionnaire.id,
                        newVersion,  // 投递后的版本号作为当前版本
                        caseType
                    );
                    console.log('[后台回复] 结果:', result);
                    // TODO: 阶段7 - 显示正式回复弹窗
                    // TODO: 阶段7 - 更新卡片状态
                } catch (error) {
                    console.error('[后台回复] 错误:', error);
                    showNotification('后台回复处理出错，请稍后查看', 'error', 3000);
                }
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

// ============================================================
// 阶段3：后台回复逻辑框架（模拟线程）
// ============================================================

/**
 * 睡眠工具 - 返回一个在指定毫秒后 resolved 的 Promise
 * @param {number} ms - 毫秒数
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 后台回复逻辑入口
 * @param {string} questionnaireId - 问卷ID
 * @param {string} currentVersion - 当前版本号（投递时的版本号）
 * @param {string} caseType - 投递情况类型 ('case1' | 'case2' | 'case3' | 'case4')
 * @returns {Promise<Object>} 返回 { enteredBigLoop, enteredYes, updatedQuestions, newVersion, prevVersion }
 */
async function simulateReplyLogic(questionnaireId, currentVersion, caseType) {
    console.log(`[后台回复] 开始 - ID: ${questionnaireId}, 版本: ${currentVersion}, 情况: ${caseType}`);
    
    const prefix = getVersionPrefix(currentVersion);
    const num = getVersionNumber(currentVersion);
    
    // 定义结果标志
    let enteredBigLoop = false;
    let enteredYes = false;
    let updatedQuestions = [];
    let prevVersion = currentVersion;
    
    // ============================================================
    // 前置判断：首字母是否为 A 或 B
    // ============================================================
    if (prefix !== 'A' && prefix !== 'B') {
        // 首字母非A/B → 执行【回复逻辑一】
        console.log('[后台回复] 进入【回复逻辑一】（首字母非A/B）');
        const result = await replyLogicOne(questionnaireId, currentVersion);
        enteredBigLoop = result.enteredBigLoop;
        enteredYes = result.enteredYes;
        updatedQuestions = result.updatedQuestions || [];
        prevVersion = result.prevVersion || currentVersion;
    } else {
        // 首字母是A或B → 判断数字
        const timeLimit = num === 1 ? 5 * 60 * 1000 : 2.5 * 60 * 1000;
        console.log(`[后台回复] 大循环时间上限: ${timeLimit / 1000 / 60} 分钟`);
        
        if (prefix === 'A') {
            // 首字母A → 【回复逻辑二】
            console.log('[后台回复] 进入【回复逻辑二】（首字母A）');
            const result = await replyLogicTwo(questionnaireId, currentVersion, timeLimit);
            enteredBigLoop = result.enteredBigLoop;
            enteredYes = result.enteredYes;
            updatedQuestions = result.updatedQuestions || [];
            prevVersion = result.prevVersion || currentVersion;
        } else {
            // 首字母B → 【回复逻辑三】
            console.log('[后台回复] 进入【回复逻辑三】（首字母B）');
            const result = await replyLogicThree(questionnaireId, currentVersion, timeLimit);
            enteredBigLoop = result.enteredBigLoop;
            enteredYes = result.enteredYes;
            updatedQuestions = result.updatedQuestions || [];
            prevVersion = result.prevVersion || currentVersion;
        }
    }
    
    // ============================================================
    // 更新版本号并保存数据（使用实际标志值）
    // ============================================================
    const newVersion = updateVersion(currentVersion, {
        enteredBigLoop: enteredBigLoop,
        enteredYes: enteredYes
    });
    
    console.log(`[后台回复] 版本号: ${currentVersion} → ${newVersion}`);
    console.log(`[后台回复] enteredBigLoop: ${enteredBigLoop}, enteredYes: ${enteredYes}`);
    console.log(`[后台回复] 更新了 ${updatedQuestions.length} 个问题`);
    
    // 保存到存储（只有当有更新内容或进入过大循环时才保存）
    if (updatedQuestions.length > 0 || enteredBigLoop) {
        saveQuestionnaireVersion(
            questionnaireId,
            newVersion,
            prevVersion,
            updatedQuestions,
            'ing'
        );
    } else {
        console.log('[后台回复] 无内容变化，跳过保存');
    }
    
    return {
        enteredBigLoop,
        enteredYes,
        updatedQuestions,
        newVersion,
        prevVersion
    };
}

// ============================================================
// 回复逻辑一（首字母非A/B）- 完整实现
// ============================================================
async function replyLogicOne(questionnaireId, currentVersion) {
    console.log('[回复逻辑一] 开始执行');
    
    // 从存储中获取当前问卷数据
    let questionnaire = null;
    let sourceArr = null;
    let sourceIndex = -1;
    
    // 在 ing 中查找
    const ingIndex = curiosityData.ing.findIndex(item => item.id === questionnaireId);
    if (ingIndex > -1) {
        questionnaire = { ...curiosityData.ing[ingIndex] };
        sourceArr = 'ing';
        sourceIndex = ingIndex;
    } else {
        const archivedIndex = curiosityData.archived.findIndex(item => item.id === questionnaireId);
        if (archivedIndex > -1) {
            questionnaire = { ...curiosityData.archived[archivedIndex] };
            sourceArr = 'archived';
            sourceIndex = archivedIndex;
        }
    }
    
    if (!questionnaire) {
        console.error('[回复逻辑一] 未找到问卷:', questionnaireId);
        return { enteredBigLoop: false, enteredYes: false, updatedQuestions: [] };
    }
    
    const questions = questionnaire.questions || [];
    const prevVersion = questionnaire.version;
    
    // ============================================================
    // 步骤1：静默倒计时 60 秒（1分钟）
    // ============================================================
    console.log('[回复逻辑一] 步骤1：静默倒计时 60 秒...');
    await sleep(60 * 1000);
    console.log('[回复逻辑一] 静默完成');
    
    // ============================================================
    // 步骤2：在 0~360 秒（0~6分钟）范围内随机一个数字 R
    // ============================================================
    const R = Math.floor(Math.random() * 361); // 0 ~ 360 秒
    console.log(`[回复逻辑一] 步骤2：随机选择倒计时 ${R} 秒（0~6分钟）`);
    
    // ============================================================
    // 步骤3：等待 R 秒
    // ============================================================
    if (R > 0) {
        console.log(`[回复逻辑一] 步骤3：等待 ${R} 秒...`);
        await sleep(R * 1000);
    } else {
        console.log('[回复逻辑一] 步骤3：无需等待，立即继续');
    }
    
    // ============================================================
    // 步骤4：检查是否有【同问.互动一】标记的问题
    // ============================================================
    const updatedQuestions = questions.map(q => {
        const newQ = { ...q };
        if (q.isInteractiveOne === true) {
            // 将【同问.互动一】变为【同问.互动一.√】
            newQ.isInteractiveOne = false;
            newQ.isInteractiveOneDone = true;
            console.log(`[回复逻辑一] 问题 "${q.text}" 的【同问.互动一】已标记为完成`);
        }
        return newQ;
    });
    
    const changedCount = updatedQuestions.filter(q => q.isInteractiveOneDone === true).length;
    console.log(`[回复逻辑一] 共处理 ${changedCount} 个【同问.互动一】标记`);
    
    // ============================================================
    // 【结束】整理数据，返回结果
    // ============================================================
    console.log('[回复逻辑一] 执行完成');
    console.log(`[回复逻辑一] enteredBigLoop: false, enteredYes: false`);
    
    return {
        enteredBigLoop: false,   // 未进入大循环
        enteredYes: false,       // 未进入YES
        updatedQuestions: updatedQuestions,
        prevVersion: prevVersion
    };
}
// ============================================================
// 回复逻辑二（首字母A）- 完整实现
// ============================================================
async function replyLogicTwo(questionnaireId, currentVersion, timeLimit) {
    console.log('[回复逻辑二] 开始执行，时间上限:', timeLimit / 1000 / 60, '分钟');
    
    // 从存储中获取当前问卷数据
    let questionnaire = null;
    let sourceArr = null;
    let sourceIndex = -1;
    
    // 在 ing 中查找
    const ingIndex = curiosityData.ing.findIndex(item => item.id === questionnaireId);
    if (ingIndex > -1) {
        questionnaire = { ...curiosityData.ing[ingIndex] };
        sourceArr = 'ing';
        sourceIndex = ingIndex;
    } else {
        const archivedIndex = curiosityData.archived.findIndex(item => item.id === questionnaireId);
        if (archivedIndex > -1) {
            questionnaire = { ...curiosityData.archived[archivedIndex] };
            sourceArr = 'archived';
            sourceIndex = archivedIndex;
        }
    }
    
    if (!questionnaire) {
        console.error('[回复逻辑二] 未找到问卷:', questionnaireId);
        return { enteredBigLoop: false, enteredYes: false, updatedQuestions: [] };
    }
    
    const questions = questionnaire.questions || [];
    const totalQuestions = questions.length;
    
    // ============================================================
    // 步骤1：静默倒计时 60 秒（计入已用时间）
    // ============================================================
    console.log('[回复逻辑二] 步骤1：静默倒计时 60 秒...');
    await sleep(60 * 1000);
    let elapsedTime = 60; // 已用时间（秒）
    console.log(`[回复逻辑二] 静默完成，已用时间: ${elapsedTime}秒`);
    
    // ============================================================
    // 步骤2：进入大循环
    // ============================================================
    console.log('[回复逻辑二] 步骤2：进入大循环');
    let enteredYes = false;
    let enteredBigLoop = true;
    const timeLimitSeconds = timeLimit / 1000; // 转换为秒
    
    // 保存投递起始时间（用于判断是否超时）
    let loopStartTime = Date.now();
    // 已用时间（从投递开始算，包含之前的60秒）
    let totalElapsed = elapsedTime;
    
    // ============================================================
    // 大循环迭代
    // ============================================================
    let loopCount = 0;
    while (true) {
        loopCount++;
        console.log(`[回复逻辑二] 大循环 #${loopCount}`);
    
        // 在 1~30 秒内随机一个数字 d
        const d = randomSeconds(1, 30);
        console.log(`[回复逻辑二] 抽取随机等待: ${d} 秒`);
        console.log(`[回复逻辑二] 当前已用: ${totalElapsed}秒，加上 ${d} 秒后为 ${totalElapsed + d}秒，上限: ${timeLimitSeconds}秒`);
    
        // ⭐ 先判断：已用时间 + d 是否 ≥ 时间上限？
        if (totalElapsed + d >= timeLimitSeconds) {
            console.log(`[回复逻辑二] ⏰ 已用时间 ${totalElapsed}秒 + ${d}秒 = ${totalElapsed + d}秒 ≥ 上限 ${timeLimitSeconds}秒，大循环结束，未进入YES`);
            return {
                enteredBigLoop: true,
                enteredYes: false,
                updatedQuestions: questions,
                prevVersion: questionnaire.version
            };
        }
    
        // 未超时，等待 d 秒
        console.log(`[回复逻辑二] 等待 ${d} 秒...`);
        await sleep(d * 1000);
        totalElapsed += d;
        console.log(`[回复逻辑二] 当前已用时间: ${totalElapsed}秒`);
    
        // 进入 YES/NO 判断（各50%）
        const yesNo = Math.random() < 0.5 ? 'YES' : 'NO';
        console.log(`[回复逻辑二] YES/NO 判断: ${yesNo}`);
    
        if (yesNo === 'YES') {
            enteredYes = true;
            console.log('[回复逻辑二] ✅ 进入 YES，开始处理每个问题');
            break;
        } else {
            console.log('[回复逻辑二] ❌ 进入 NO，继续大循环');
            // 继续循环
        }
    }
    
    // ============================================================
    // 分支A：已进入 YES，依次处理每个问题
    // ============================================================
    console.log('[回复逻辑二] 分支A：开始处理每个问题');
    const updatedQuestions = [...questions];
    const unansweredList = []; // 记录被标记为"暂不回答"的问题索引
    
    for (let i = 0; i < updatedQuestions.length; i++) {
        const q = updatedQuestions[i];
        console.log(`[回复逻辑二] 处理问题 Q${i + 1}: "${q.text}"`);
        
        // 步骤(A)：在 1~30 秒内随机一个时间，等待
        const waitTime = randomSeconds(1, 30);
        console.log(`[回复逻辑二] Q${i + 1} 等待 ${waitTime} 秒...`);
        await sleep(waitTime * 1000);
        
        // 三选一判断
        const decision = randomDecision();
        console.log(`[回复逻辑二] Q${i + 1} 决策: ${decision}`);
        
        // 更新问题状态
        q.status = decision;
        q.selectedOptions = [];
        
        // 根据决策处理
        if (decision === 'rejected') {
            // 拒绝回答
            console.log(`[回复逻辑二] Q${i + 1} 拒绝回答`);
            // 后续统一处理反问
        } else if (decision === 'unanswered') {
            // 暂不回答 → 记录到第二轮列表
            console.log(`[回复逻辑二] Q${i + 1} 暂不回答，加入第二轮`);
            unansweredList.push(i);
        } else {
            // 回答（decision === 'answered'）
            console.log(`[回复逻辑二] Q${i + 1} 开始回答`);
            // 判断是否多选题
            if (q.type === 'multiple') {
                // 多选：先随机 1~N（N为选项数）
                const count = randomSeconds(1, q.options.length);
                console.log(`[回复逻辑二] Q${i + 1} 多选题，选择 ${count} 个选项`);
                // 在 40 秒内随机一个时间，等待
                const waitTime2 = randomSeconds(1, 40);
                console.log(`[回复逻辑二] Q${i + 1} 等待 ${waitTime2} 秒后选择...`);
                await sleep(waitTime2 * 1000);
                // 随机选择 count 个选项
                q.selectedOptions = randomSelectMultiple(q.options, count);
                console.log(`[回复逻辑二] Q${i + 1} 选中选项: ${q.selectedOptions.map(idx => q.options[idx]).join(', ')}`);
            } else {
                // 单选：在 40 秒内随机一个时间，等待
                const waitTime2 = randomSeconds(1, 40);
                console.log(`[回复逻辑二] Q${i + 1} 等待 ${waitTime2} 秒后选择...`);
                await sleep(waitTime2 * 1000);
                // 随机选一个选项
                const selected = randomSelectOption(q.options);
                q.selectedOptions = [selected];
                console.log(`[回复逻辑二] Q${i + 1} 选中选项: ${q.options[selected]}`);
            }
        }
        
        // ⭐ 静默 15 秒
        console.log(`[回复逻辑二] Q${i + 1} 静默 15 秒...`);
        await sleep(15 * 1000);
        
        // 投骰子决定是否反问（各50%）
        const askBack = Math.random() < 0.5;
        if (askBack) {
            q.isSameQuestion = true;
            console.log(`[回复逻辑二] Q${i + 1} 🔄 反问 → 标记【同问】`);
        } else {
            q.isSameQuestion = false;
            console.log(`[回复逻辑二] Q${i + 1} 不反问`);
        }
        
        console.log(`[回复逻辑二] Q${i + 1} 处理完成`);
    }
    
    // ============================================================
    // 第二轮：处理所有被标记为「暂不回答」的问题
    // ============================================================
    if (unansweredList.length > 0) {
        console.log(`[回复逻辑二] 第二轮：处理 ${unansweredList.length} 个暂不回答的问题`);
        for (const idx of unansweredList) {
            const q = updatedQuestions[idx];
            console.log(`[回复逻辑二] 第二轮 Q${idx + 1}: "${q.text}"`);
            
            // 重新走分支A流程
            const waitTime = randomSeconds(1, 30);
            console.log(`[回复逻辑二] 第二轮 Q${idx + 1} 等待 ${waitTime} 秒...`);
            await sleep(waitTime * 1000);
            
            // 三选一判断（仍然可以选暂不回答，但必须执行反问）
            const decision = randomDecision();
            console.log(`[回复逻辑二] 第二轮 Q${idx + 1} 决策: ${decision}`);
            
            // 更新问题状态（二轮答案覆盖一轮）
            q.status = decision;
            q.selectedOptions = [];
            
            if (decision === 'rejected') {
                console.log(`[回复逻辑二] 第二轮 Q${idx + 1} 拒绝回答`);
            } else if (decision === 'unanswered') {
                console.log(`[回复逻辑二] 第二轮 Q${idx + 1} 再次暂不回答`);
                // 即使再次选到暂不回答，也继续执行反问
            } else {
                // 回答
                console.log(`[回复逻辑二] 第二轮 Q${idx + 1} 开始回答`);
                if (q.type === 'multiple') {
                    const count = randomSeconds(1, q.options.length);
                    const waitTime2 = randomSeconds(1, 40);
                    await sleep(waitTime2 * 1000);
                    q.selectedOptions = randomSelectMultiple(q.options, count);
                    console.log(`[回复逻辑二] 第二轮 Q${idx + 1} 选中选项: ${q.selectedOptions.map(i => q.options[i]).join(', ')}`);
                } else {
                    const waitTime2 = randomSeconds(1, 40);
                    await sleep(waitTime2 * 1000);
                    const selected = randomSelectOption(q.options);
                    q.selectedOptions = [selected];
                    console.log(`[回复逻辑二] 第二轮 Q${idx + 1} 选中选项: ${q.options[selected]}`);
                }
            }
            
            // ⭐ 静默 15 秒
            await sleep(15 * 1000);
            
            // 投骰子决定是否反问（各50%）
            const askBack = Math.random() < 0.5;
            if (askBack) {
                q.isSameQuestion = true;
                console.log(`[回复逻辑二] 第二轮 Q${idx + 1} 🔄 反问 → 标记【同问】`);
            } else {
                q.isSameQuestion = false;
                console.log(`[回复逻辑二] 第二轮 Q${idx + 1} 不反问`);
            }
            
            console.log(`[回复逻辑二] 第二轮 Q${idx + 1} 处理完成`);
        }
    } else {
        console.log('[回复逻辑二] 第二轮：无暂不回答的问题，跳过');
    }
    
    // ============================================================
    // 【结束】整理数据，返回结果
    // ============================================================
    const prevVersion = questionnaire.version;
    
    // 保存到存储（版本号由主调度器更新）
    console.log('[回复逻辑二] 执行完成');
    console.log(`[回复逻辑二] 共处理 ${updatedQuestions.length} 个问题`);
    console.log(`[回复逻辑二] 已回答: ${updatedQuestions.filter(q => q.status === 'answered').length}`);
    console.log(`[回复逻辑二] 暂不回答: ${updatedQuestions.filter(q => q.status === 'unanswered').length}`);
    console.log(`[回复逻辑二] 拒绝回答: ${updatedQuestions.filter(q => q.status === 'rejected').length}`);
    console.log(`[回复逻辑二] 【同问】标记: ${updatedQuestions.filter(q => q.isSameQuestion).length}`);
    
    return {
        enteredBigLoop: true,
        enteredYes: true,
        updatedQuestions: updatedQuestions,
        prevVersion: prevVersion
    };
}

// ============================================================
// 回复逻辑三（首字母B）- 完整实现
// ============================================================
async function replyLogicThree(questionnaireId, currentVersion, timeLimit) {
    console.log('[回复逻辑三] 开始执行，时间上限:', timeLimit / 1000 / 60, '分钟');
    
    // 从存储中获取当前问卷数据
    let questionnaire = null;
    let sourceArr = null;
    let sourceIndex = -1;
    
    // 在 ing 中查找
    const ingIndex = curiosityData.ing.findIndex(item => item.id === questionnaireId);
    if (ingIndex > -1) {
        questionnaire = { ...curiosityData.ing[ingIndex] };
        sourceArr = 'ing';
        sourceIndex = ingIndex;
    } else {
        const archivedIndex = curiosityData.archived.findIndex(item => item.id === questionnaireId);
        if (archivedIndex > -1) {
            questionnaire = { ...curiosityData.archived[archivedIndex] };
            sourceArr = 'archived';
            sourceIndex = archivedIndex;
        }
    }
    
    if (!questionnaire) {
        console.error('[回复逻辑三] 未找到问卷:', questionnaireId);
        return { enteredBigLoop: false, enteredYes: false, updatedQuestions: [] };
    }
    
    const questions = questionnaire.questions || [];
    const prevVersion = questionnaire.version;
    
    // ============================================================
    // 步骤1：静默倒计时 60 秒（计入已用时间）
    // ============================================================
    console.log('[回复逻辑三] 步骤1：静默倒计时 60 秒...');
    await sleep(60 * 1000);
    let elapsedTime = 60; // 已用时间（秒）
    console.log(`[回复逻辑三] 静默完成，已用时间: ${elapsedTime}秒`);
    
    // ============================================================
    // 步骤2：筛选出所有被标记为「暂不回答」的问题
    // ============================================================
    const unansweredIndices = [];
    questions.forEach((q, idx) => {
        if (q.status === 'unanswered') {
            unansweredIndices.push(idx);
        }
    });
    const hasUnanswered = unansweredIndices.length > 0;
    console.log(`[回复逻辑三] 步骤2：暂不回答的问题数量: ${unansweredIndices.length}`);
    
    // 初始化标志
    let enteredBigLoop = false;
    let enteredYes = false;
    let updatedQuestions = [...questions];
    
    // ============================================================
    // 如果有暂不回答的问题，进入大循环
    // ============================================================
    if (hasUnanswered) {
        console.log('[回复逻辑三] 进入大循环处理暂不回答的问题');
        enteredBigLoop = true;
        const timeLimitSeconds = timeLimit / 1000; // 转换为秒
        let totalElapsed = elapsedTime;
        let loopCount = 0;
        let hasEnteredYes = false;
        
        // ============================================================
        // 大循环迭代（只针对暂不回答列表）
        // ============================================================
        while (true) {
            loopCount++;
            console.log(`[回复逻辑三] 大循环 #${loopCount}`);
            
            // 在 1~30 秒内随机一个数字 d
            const d = randomSeconds(1, 30);
            console.log(`[回复逻辑三] 抽取随机等待: ${d} 秒`);
            console.log(`[回复逻辑三] 当前已用: ${totalElapsed}秒，加上 ${d} 秒后为 ${totalElapsed + d}秒，上限: ${timeLimitSeconds}秒`);
            
            // 先判断：已用时间 + d 是否 ≥ 时间上限？
            if (totalElapsed + d >= timeLimitSeconds) {
                console.log(`[回复逻辑三] ⏰ 已用时间 ${totalElapsed}秒 + ${d}秒 = ${totalElapsed + d}秒 ≥ 上限 ${timeLimitSeconds}秒，大循环结束，未进入YES`);
                enteredYes = false;
                break;
            }
            
            // 未超时，等待 d 秒
            console.log(`[回复逻辑三] 等待 ${d} 秒...`);
            await sleep(d * 1000);
            totalElapsed += d;
            console.log(`[回复逻辑三] 当前已用时间: ${totalElapsed}秒`);
            
            // 进入 YES/NO 判断（各50%）
            const yesNo = Math.random() < 0.5 ? 'YES' : 'NO';
            console.log(`[回复逻辑三] YES/NO 判断: ${yesNo}`);
            
            if (yesNo === 'YES') {
                hasEnteredYes = true;
                enteredYes = true;
                console.log('[回复逻辑三] ✅ 进入 YES，开始处理暂不回答的问题');
                break;
            } else {
                console.log('[回复逻辑三] ❌ 进入 NO，继续大循环');
                // 继续循环
            }
        }
        
        // ============================================================
        // 分支A：已进入 YES，处理所有暂不回答的问题（一轮定结果）
        // ============================================================
        if (hasEnteredYes) {
            console.log(`[回复逻辑三] 分支A：处理 ${unansweredIndices.length} 个暂不回答的问题`);
            
            for (const idx of unansweredIndices) {
                const q = updatedQuestions[idx];
                console.log(`[回复逻辑三] 处理暂不回答问题 Q${idx + 1}: "${q.text}"`);
                
                // 步骤(A)：在 1~30 秒内随机一个时间，等待
                const waitTime = randomSeconds(1, 30);
                console.log(`[回复逻辑三] Q${idx + 1} 等待 ${waitTime} 秒...`);
                await sleep(waitTime * 1000);
                
                // 三选一判断
                const decision = randomDecision();
                console.log(`[回复逻辑三] Q${idx + 1} 决策: ${decision}`);
                
                // 更新问题状态（覆盖原来的暂不回答）
                q.status = decision;
                q.selectedOptions = [];
                
                if (decision === 'rejected') {
                    console.log(`[回复逻辑三] Q${idx + 1} 拒绝回答`);
                } else if (decision === 'unanswered') {
                    console.log(`[回复逻辑三] Q${idx + 1} 再次暂不回答`);
                    // ⭐ 即使再次选到暂不回答，也要继续执行反问
                } else {
                    // 回答
                    console.log(`[回复逻辑三] Q${idx + 1} 开始回答`);
                    if (q.type === 'multiple') {
                        const count = randomSeconds(1, q.options.length);
                        console.log(`[回复逻辑三] Q${idx + 1} 多选题，选择 ${count} 个选项`);
                        const waitTime2 = randomSeconds(1, 40);
                        console.log(`[回复逻辑三] Q${idx + 1} 等待 ${waitTime2} 秒后选择...`);
                        await sleep(waitTime2 * 1000);
                        q.selectedOptions = randomSelectMultiple(q.options, count);
                        console.log(`[回复逻辑三] Q${idx + 1} 选中选项: ${q.selectedOptions.map(i => q.options[i]).join(', ')}`);
                    } else {
                        const waitTime2 = randomSeconds(1, 40);
                        console.log(`[回复逻辑三] Q${idx + 1} 等待 ${waitTime2} 秒后选择...`);
                        await sleep(waitTime2 * 1000);
                        const selected = randomSelectOption(q.options);
                        q.selectedOptions = [selected];
                        console.log(`[回复逻辑三] Q${idx + 1} 选中选项: ${q.options[selected]}`);
                    }
                }
                
                // ⭐ 静默 15 秒
                console.log(`[回复逻辑三] Q${idx + 1} 静默 15 秒...`);
                await sleep(15 * 1000);
                
                // 投骰子决定是否反问（各50%）
                const askBack = Math.random() < 0.5;
                if (askBack) {
                    q.isSameQuestion = true;
                    console.log(`[回复逻辑三] Q${idx + 1} 🔄 反问 → 标记【同问】`);
                } else {
                    q.isSameQuestion = false;
                    console.log(`[回复逻辑三] Q${idx + 1} 不反问`);
                }
                
                console.log(`[回复逻辑三] Q${idx + 1} 处理完成`);
            }
        }
    } else {
        console.log('[回复逻辑三] 步骤2：无暂不回答的问题，跳过');
    }
    
    // ============================================================
    // 步骤3：等待 30 秒（无论步骤2是否执行，都等待）
    // ============================================================
    console.log('[回复逻辑三] 步骤3：等待 30 秒...');
    await sleep(30 * 1000);
    console.log('[回复逻辑三] 等待完成');
    
    // ============================================================
    // 步骤4：检查是否有【同问.互动一】标记的问题
    // ============================================================
    let interactiveOneCount = 0;
    const finalQuestions = updatedQuestions.map(q => {
        const newQ = { ...q };
        if (q.isInteractiveOne === true) {
            // 将【同问.互动一】变为【同问.互动一.√】
            newQ.isInteractiveOne = false;
            newQ.isInteractiveOneDone = true;
            interactiveOneCount++;
            console.log(`[回复逻辑三] 问题 "${q.text}" 的【同问.互动一】已标记为完成`);
        }
        return newQ;
    });
    console.log(`[回复逻辑三] 步骤4：共处理 ${interactiveOneCount} 个【同问.互动一】标记`);
    
    // ============================================================
    // 【结束】整理数据，返回结果
    // ============================================================
    console.log('[回复逻辑三] 执行完成');
    console.log(`[回复逻辑三] enteredBigLoop: ${enteredBigLoop}, enteredYes: ${enteredYes}`);
    console.log(`[回复逻辑三] 共处理 ${unansweredIndices.length} 个暂不回答的问题`);
    console.log(`[回复逻辑三] 【同问】标记新增: ${finalQuestions.filter(q => q.isSameQuestion === true).length}`);
    console.log(`[回复逻辑三] 【同问.互动一.√】新增: ${interactiveOneCount}`);
    
    return {
        enteredBigLoop: enteredBigLoop,
        enteredYes: enteredYes,
        updatedQuestions: finalQuestions,
        prevVersion: prevVersion
    };
}

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
        id: 'q_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
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