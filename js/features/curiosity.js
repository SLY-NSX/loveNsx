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
                    <div class="env-stamp curiosity-stamp" style="width:28px;height:34px;font-size:16px;background:rgba(255,255,255,0.2);display:flex;align-items:center;justify-content:center;border-radius:4px;box-shadow:none !important;border:1.5px solid rgba(255,255,255,0.3);">
                        📮
                    </div>
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

// ---------- 创建问卷（占位） ----------
window.openNewCuriosityForm = function() {
    // 隐藏列表，显示创建表单（暂不实现，仅提示）
    showNotification('创建问卷功能开发中，敬请期待 ✦', 'info', 3000);
    // 但是可以先隐藏列表区域（可选）
    // document.getElementById('curiosity-ing-section').style.display = 'none';
    // document.getElementById('curiosity-archived-section').style.display = 'none';
    // document.getElementById('curiosity-main-close-btn').style.display = 'none';
    // document.getElementById('curiosity-compose-form').style.display = 'block';
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
