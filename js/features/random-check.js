/**
 * random-check.js - 梦角随机查看计划/待办
 * 独立于通话功能，复用 call.js 的调度逻辑
 * 
 * 修改内容：
 * 1. 消息持久化（localStorage），支持手动删除
 * 2. 新排版：三行居中显示
 * 3. 反馈文案去掉"他说："
 */

(function () {
    'use strict';

// ============================================================
// 配置
// ============================================================
const CONFIG = {
    MIN_INTERVAL: 45 * 60 * 1000,
    MAX_INTERVAL: 120 * 60 * 1000,
    PROB_DIRECT_END: 70,
    PROB_VIEW_TODAY: 55,
    PROB_VIEW_YESTERDAY: 20,
    PROB_VIEW_TOMORROW: 20,
    PROB_VIEW_DAY_AFTER: 5,
};

// 状态反馈文案池（只保留反馈内容，不含"他说："）
const FEEDBACK = {
    '未开始': [
        '期待你把它完成 ✦',
        '可以提前开始哦',
        '你应该没忘记这个吧？',
        '是时候开始了，我在等你 ✦'
    ],
    '进行中': [
        '尽快做完，迅速收尾 ✦',
        '剩下的时间不多了，抓紧',
        '我在等你做完 ✦',
        '不想做吗？还是有什么困难？'
    ],
    '已完成': [
        '非常好！✦',
        '如我所料，你做到了 ✦',
        '这次很迅速，保持吧 ✦',
        '你做的比我想象的还要好 ✦'
    ],
    '已暂停': [
        '为什么不继续呢？',
        '我的建议是照原计划继续 ✦',
        '把它捡起来吧，继续 ✦',
        '暂停不是结束，重新开始吧 ✦'
    ],
    '已过期': [
        '看来你忘记了什么 ✦',
        '是忘记了还是不想做了？',
        '希望下不为例 ✦',
        '过期了…要不要重新规划一下？'
    ]
};

const DEFAULT_FEEDBACK = [
    '想知道你最近的计划 ✦',
    '你最近在忙什么呢？',
    '有没有什么计划想和我分享？'
];

// ============================================================
// 状态管理
// ============================================================
let _timer = null;
let _enabled = true;

// ============================================================
// 工具函数
// ============================================================
function getPartnerName() {
    try {
        return window.settings?.partnerName ||
            document.getElementById('partner-name')?.textContent?.trim() ||
            '梦角';
    } catch { return '梦角'; }
}

function formatDateDisplay(dateStr) {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    return parts[0] + '年' + parseInt(parts[1]) + '月' + parseInt(parts[2]) + '日';
}

function randomPick(arr) {
    if (!arr || arr.length === 0) return null;
    return arr[Math.floor(Math.random() * arr.length)];
}

// ============================================================
// 消息持久化
// ============================================================
const STORAGE_KEY = 'random_check_messages';

function getStoredMessages() {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch {
        return [];
    }
}

function saveMessages(messages) {
    try {
        // 只保留最近200条
        if (messages.length > 200) {
            messages = messages.slice(-200);
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch (e) {
        console.error('[random-check] 保存消息失败:', e);
    }
}

function addMessage(content) {
    const messages = getStoredMessages();
    messages.push({
        id: Date.now() + '_' + Math.random().toString(36).substr(2, 6),
        content: content,
        timestamp: Date.now()
    });
    saveMessages(messages);
    return messages;
}

function deleteMessage(id) {
    let messages = getStoredMessages();
    messages = messages.filter(m => m.id !== id);
    saveMessages(messages);
    renderMessages(); // 重新渲染
}

function clearAllMessages() {
    saveMessages([]);
    renderMessages();
}

// ============================================================
// 消息渲染（新版排版）
// ============================================================
function renderMessages() {
    const container = getChatContainer();
    if (!container) return;

    // 移除所有旧的系统消息（保留非系统消息）
    const oldSystemMessages = container.querySelectorAll('.system-message-wrapper');
    oldSystemMessages.forEach(el => el.remove());

    const messages = getStoredMessages();
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const recent = messages.filter(m => m.timestamp > weekAgo);

    recent.forEach(msg => {
        const wrapper = createMessageElement(msg.content, msg.id);
        container.appendChild(wrapper);
    });

    container.scrollTop = container.scrollHeight;
}

function getChatContainer() {
    return document.getElementById('chat-container') || 
           document.querySelector('.chat-container') ||
           document.querySelector('[class*="chat"][class*="container"]');
}

function createMessageElement(content, id) {
    const wrapper = document.createElement('div');
    wrapper.className = 'system-message-wrapper';
    wrapper.dataset.id = id || '';
    wrapper.style.cssText = `
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 12px 20px;
        margin: 8px auto;
        background: rgba(255, 255, 255, 0.04);
        border-radius: 14px;
        max-width: 85%;
        position: relative;
        line-height: 1.6;
        border: 1px solid rgba(255, 255, 255, 0.06);
    `;

    // 内容按行分割
    const lines = content.split('\n');
    lines.forEach((line, index) => {
        const p = document.createElement('div');
        p.textContent = line;
        p.style.cssText = `
            text-align: center;
            color: #b0b0b0;
            font-size: ${index === 0 ? '15px' : '14px'};
            font-weight: ${index === 0 ? '500' : '400'};
            width: 100%;
            padding: 1px 0;
        `;
        // 第一行稍微亮一点
        if (index === 0) {
            p.style.color = '#d0d0d0';
        }
        wrapper.appendChild(p);
    });

    // 删除按钮（悬停显示）
    if (id) {
        const deleteBtn = document.createElement('span');
        deleteBtn.textContent = '✕';
        deleteBtn.style.cssText = `
            position: absolute;
            top: -6px;
            right: -6px;
            width: 20px;
            height: 20px;
            border-radius: 50%;
            background: rgba(255, 80, 80, 0.2);
            color: #ff6b6b;
            font-size: 11px;
            line-height: 20px;
            text-align: center;
            cursor: pointer;
            opacity: 0;
            transition: opacity 0.2s;
            border: 1px solid rgba(255, 80, 80, 0.2);
        `;
        deleteBtn.title = '删除这条消息';
        deleteBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            if (confirm('确定要删除这条消息吗？')) {
                deleteMessage(id);
            }
        });

        wrapper.appendChild(deleteBtn);

        // 悬停显示删除按钮
        wrapper.addEventListener('mouseenter', function() {
            deleteBtn.style.opacity = '1';
        });
        wrapper.addEventListener('mouseleave', function() {
            deleteBtn.style.opacity = '0';
        });
    }

    return wrapper;
}

// ============================================================
// 核心数据读取
// ============================================================
function getAllViewableItems() {
    try {
        const raw = localStorage.getItem('plan_todo_data');
        if (!raw) return [];
        const allData = JSON.parse(raw);
        const items = [];
        for (const date in allData) {
            const day = allData[date];
            if (day.plans) {
                day.plans.forEach(p => {
                    if (p.isViewable) {
                        items.push({
                            ...p,
                            _date: date,
                            _type: 'plan'
                        });
                    }
                });
            }
            if (day.todos) {
                day.todos.forEach(t => {
                    if (t.isViewable) {
                        items.push({
                            ...t,
                            _date: date,
                            _type: 'todo'
                        });
                    }
                });
            }
        }
        return items;
    } catch (e) {
        console.error('[random-check] 读取数据失败:', e);
        return [];
    }
}

// ============================================================
// 状态计算
// ============================================================
function calculateItemStatus(item) {
    if (item.status === 'paused') {
        return '已暂停';
    }
    if (item.status === 'completed') {
        return '已完成';
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let targetDate = item.startDate;
    if (item.isRepeating && typeof window.expandRepeatDates === 'function') {
        const allDates = window.expandRepeatDates(item);
        const todayStr = today.toISOString().split('T')[0];
        const match = allDates.find(d => d === todayStr);
        if (match) {
            targetDate = match;
        } else {
            const beforeToday = allDates.filter(d => d <= todayStr);
            if (beforeToday.length > 0) {
                targetDate = beforeToday[beforeToday.length - 1];
            } else {
                return '未开始';
            }
        }
    }

    const startDate = new Date(targetDate);
    startDate.setHours(0, 0, 0, 0);

    let endDate;
    if (item.isRepeating) {
        endDate = new Date(targetDate);
    } else {
        endDate = new Date(item.endDate || item.startDate);
    }
    endDate.setHours(0, 0, 0, 0);

    const expireThreshold = new Date(endDate);
    expireThreshold.setDate(expireThreshold.getDate() + 1);
    expireThreshold.setHours(12, 0, 0, 0);

    const now = new Date();

    if (now < startDate) {
        return '未开始';
    }
    if (now < expireThreshold) {
        return '进行中';
    }
    return '已过期';
}

// ============================================================
// 选择日期和条目
// ============================================================
function selectDateAndItem() {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    
    const dayAfterTomorrow = new Date(today);
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);
    const dayAfterTomorrowStr = dayAfterTomorrow.toISOString().split('T')[0];
    
    const targetDates = [todayStr, yesterdayStr, tomorrowStr, dayAfterTomorrowStr];
    
    const allItems = getAllViewableItems();
    const availableItems = allItems.filter(item => {
        return targetDates.includes(item._date);
    });
    
    if (availableItems.length === 0) {
        return { date: null, item: null, feedback: randomPick(DEFAULT_FEEDBACK) };
    }
    
    const grouped = {};
    availableItems.forEach(item => {
        const date = item._date;
        if (!grouped[date]) grouped[date] = [];
        grouped[date].push(item);
    });
    
    const roll = Math.random() * 100;
    let targetDate = null;
    
    if (roll < 55) {
        targetDate = todayStr;
    } else if (roll < 75) {
        targetDate = yesterdayStr;
    } else if (roll < 95) {
        targetDate = tomorrowStr;
    } else {
        targetDate = dayAfterTomorrowStr;
    }
    
    let selectedItem = null;
    let selectedDate = targetDate;
    
    if (grouped[targetDate] && grouped[targetDate].length > 0) {
        selectedItem = randomPick(grouped[targetDate]);
    } else {
        selectedItem = randomPick(availableItems);
        selectedDate = selectedItem._date;
    }
    
    if (!selectedItem) {
        return { date: null, item: null, feedback: randomPick(DEFAULT_FEEDBACK) };
    }
    
    const status = calculateItemStatus(selectedItem);
    const feedbackPool = FEEDBACK[status] || ['嗯，我知道了 ✦'];
    const feedback = randomPick(feedbackPool);
    
    return {
        date: selectedDate,
        item: selectedItem,
        feedback: feedback,
        status: status
    };
}

// ============================================================
// 构建消息内容（新版排版）
// ============================================================
function buildMessageContent(result) {
    const partnerName = getPartnerName();

    // 无条目：一行显示
    if (!result.item || !result.date) {
        return `${partnerName} ${result.feedback}`;
    }

    // 有条目：三行显示
    const dateDisplay = formatDateDisplay(result.date);
    const typeLabel = result.item._type === 'plan' ? '计划' : '待办';
    const title = result.item.fullTitle || `${result.item.primaryLabel}.${result.item.secondaryTitle}`;

    const lines = [
        `${partnerName} 查看了`,
        `${dateDisplay}的${typeLabel}「${title}」`,
        result.feedback
    ];

    return lines.join('\n');
}

// ============================================================
// 发送系统消息（持久化 + 渲染）
// ============================================================
function sendSystemMessage(content) {
    // 保存到 localStorage
    addMessage(content);
    
    // 渲染到页面
    renderMessages();

    // 如果找不到容器，降级到 console
    if (!getChatContainer()) {
        console.log('[random-check]', content.replace(/\n/g, ' | '));
    }
}

// ============================================================
// 执行一次随机查看
// ============================================================
function performRandomCheck() {
    try {
        const roll = Math.random() * 100;
        if (roll < CONFIG.PROB_DIRECT_END) {
            return;
        }

        const result = selectDateAndItem();
        const content = buildMessageContent(result);
        sendSystemMessage(content);
        
    } catch (e) {
        console.error('[random-check] 执行随机查看失败:', e);
    }
}

// ============================================================
// 调度器
// ============================================================
function scheduleNext() {
    if (_timer) {
        clearTimeout(_timer);
        _timer = null;
    }

    if (!_enabled) return;

    const interval = CONFIG.MIN_INTERVAL + Math.random() * (CONFIG.MAX_INTERVAL - CONFIG.MIN_INTERVAL);

    _timer = setTimeout(() => {
        performRandomCheck();
        scheduleNext();
    }, interval);

    console.log(`[random-check] 下次检查将在 ${Math.round(interval / 60000)} 分钟后进行`);
}

// ============================================================
// 对外 API
// ============================================================
function start() {
    if (_timer) {
        clearTimeout(_timer);
        _timer = null;
    }
    _enabled = true;
    // 先恢复历史消息
    renderMessages();
    scheduleNext();
    console.log('[random-check] 已启动');
}

function stop() {
    if (_timer) {
        clearTimeout(_timer);
        _timer = null;
    }
    _enabled = false;
    console.log('[random-check] 已停止');
}

function setEnabled(enabled) {
    _enabled = enabled;
    if (enabled) {
        renderMessages();
        scheduleNext();
    } else {
        if (_timer) {
            clearTimeout(_timer);
            _timer = null;
        }
    }
}

// ============================================================
// 初始化
// ============================================================
function init() {
    console.log('[random-check] 模块已加载（持久化版）');

    // 延迟启动
    setTimeout(() => {
        // 先恢复历史消息
        renderMessages();
        start();
    }, 3000);
}

// 暴露到全局
window.randomCheck = {
    start: start,
    stop: stop,
    setEnabled: setEnabled,
    perform: performRandomCheck,
    // 新增：消息管理
    messages: {
        getAll: getStoredMessages,
        clear: clearAllMessages,
        delete: deleteMessage,
        render: renderMessages
    }
};

// 页面加载时初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

console.log('[random-check] 模块已初始化（持久化版）');
})();