/**
 * random-check.js - 梦角随机查看计划/待办
 * 系统消息：显示在聊天中间，三行/一行居中
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

// ============================================================
// 反馈文案
// ============================================================
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
        return { date: null, item: null };
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
    
    return {
        date: selectedDate,
        item: selectedItem
    };
}

// ============================================================
// 构建消息内容
// ============================================================
function buildMessageContent(result, feedback) {
    const partnerName = getPartnerName();

    // 无条目：一行
    if (!result.item || !result.date) {
        return `${partnerName} ${feedback}`;
    }

    // 有条目：三行
    const dateDisplay = formatDateDisplay(result.date);
    const typeLabel = result.item._type === 'plan' ? '计划' : '待办';
    const title = result.item.fullTitle || `${result.item.primaryLabel}.${result.item.secondaryTitle}`;

    return [
        `${partnerName} 查看了`,
        `${dateDisplay}的${typeLabel}「${title}」`,
        feedback
    ].join('\n');
}

// ============================================================
// 发送系统消息 - 完全模仿 call.js 的 sendCallEvent
// ============================================================
function sendSystemMessage(message) {
    // 直接用 call.js 的 _addCallEvent，显示在聊天中间
    if (typeof window._addCallEvent === 'function') {
        // 不带图标，纯文字
        window._addCallEvent('', message);
    } else {
        // fallback
        console.log('[random-check]', message);
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
        
        // 直接用 plan-todo.js 的 calculateItemStatus
        let status = '进行中';
        if (result.item && typeof window.calculateItemStatus === 'function') {
            status = window.calculateItemStatus(result.item);
        }
        
        const feedbackPool = FEEDBACK[status] || ['嗯，我知道了 ✦'];
        const feedback = randomPick(feedbackPool);
        
        const content = buildMessageContent(result, feedback);
        sendSystemMessage(content);
        
        console.log('[random-check] ✅ 已触发');
        
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
    console.log('  ✅ 消息用 _addCallEvent（系统消息，聊天中间）');
    console.log('  ✅ 状态用 plan-todo.js 的 calculateItemStatus');
    console.log('  ✅ 有条目三行，无条目一行');

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