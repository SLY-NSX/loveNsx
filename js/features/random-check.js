/**
 * random-check.js - 梦角随机查看计划/待办
 * 独立于通话功能，复用 call.js 的调度逻辑
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

// 状态反馈文案池（作为 fallback，优先使用 plan-todo 的）
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

function generateMsgId() {
    return 'sys_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
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
// 选择日期和条目（使用 plan-todo 的状态计算）
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
    
    if (roll < CONFIG.PROB_VIEW_TODAY) {
        targetDate = todayStr;
    } else if (roll < CONFIG.PROB_VIEW_TODAY + CONFIG.PROB_VIEW_YESTERDAY) {
        targetDate = yesterdayStr;
    } else if (roll < CONFIG.PROB_VIEW_TODAY + CONFIG.PROB_VIEW_YESTERDAY + CONFIG.PROB_VIEW_TOMORROW) {
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
    
    // ★ 使用 plan-todo 的状态计算函数 ★
    let status = '进行中';
    if (typeof window.calculateItemStatus === 'function') {
        status = window.calculateItemStatus(selectedItem);
    } else {
        // fallback：简单的状态判断
        const todayStr2 = new Date().toISOString().split('T')[0];
        if (selectedItem.startDate > todayStr2) status = '未开始';
        else if (selectedItem.endDate && selectedItem.endDate < todayStr2) status = '已过期';
        else if (selectedItem.status === 'paused') status = '已暂停';
        else if (selectedItem.status === 'completed') status = '已完成';
        else status = '进行中';
    }
    
    // 优先使用 plan-todo 的反馈池
    let feedbackPool = null;
    if (window._planTodoFeedback && window._planTodoFeedback[status]) {
        feedbackPool = window._planTodoFeedback[status];
    }
    if (!feedbackPool || feedbackPool.length === 0) {
        feedbackPool = FEEDBACK[status] || ['嗯，我知道了 ✦'];
    }
    const feedback = randomPick(feedbackPool);
    
    return {
        date: selectedDate,
        item: selectedItem,
        feedback: feedback,
        status: status
    };
}

// ============================================================
// 发送系统消息（使用 addMessage，模仿拍一拍）
// ============================================================
function sendSystemMessage(messageData) {
    try {
        const partnerName = getPartnerName();
        
        let text = '';
        if (messageData.hasItem && messageData.item) {
            const dateDisplay = formatDateDisplay(messageData.item._date || messageData.item.startDate);
            const typeLabel = messageData.item._type === 'plan' ? '计划' : '待办';
            const title = messageData.item.fullTitle || 
                         `${messageData.item.primaryLabel}.${messageData.item.secondaryTitle}`;
            text = `${partnerName} 查看了<br>${dateDisplay} 的${typeLabel}「${title}」<br>${messageData.feedback}`;
        } else {
            text = `${partnerName} ${messageData.feedback}`;
        }
        
        const addFn = typeof window.addMessage === 'function' ? window.addMessage : 
                      (typeof addMessage === 'function' ? addMessage : null);
        
        if (addFn) {
            addFn({
                id: generateMsgId(),
                sender: 'system',
                text: text,
                timestamp: new Date(),
                type: 'system',
                status: 'received',
                favorited: false,
            });
        } else {
            const chatContainer = document.getElementById('chat-container') || document.querySelector('.chat-container');
            if (chatContainer) {
                const msgDiv = document.createElement('div');
                msgDiv.className = 'system-message';
                msgDiv.innerHTML = text;
                chatContainer.appendChild(msgDiv);
                chatContainer.scrollTop = chatContainer.scrollHeight;
            }
        }
    } catch (e) {
        console.error('[random-check] 发送系统消息失败:', e);
        if (typeof showToast === 'function') {
            showToast('随机查看出错', 'error');
        }
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
        
        sendSystemMessage({
            hasItem: !!(result.item && result.date),
            item: result.item,
            feedback: result.feedback,
        });
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
    console.log('[random-check] 模块已加载');

    setTimeout(() => {
        start();
    }, 3000);
}

window.randomCheck = {
    start: start,
    stop: stop,
    setEnabled: setEnabled,
    perform: performRandomCheck,
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

console.log('[random-check] 模块已初始化');
})();