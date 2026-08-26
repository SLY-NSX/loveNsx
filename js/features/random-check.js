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
    // 随机间隔：45分钟 ~ 2小时（毫秒）
    MIN_INTERVAL: 45 * 60 * 1000,
    MAX_INTERVAL: 120 * 60 * 1000,
    // 查看概率（百分比）
    PROB_DIRECT_END: 70,      // 直接结束，无事发生
    // 进入查看后，按以下概率选择日期（百分比）
    PROB_VIEW_TODAY: 55,      // 查看当天
    PROB_VIEW_YESTERDAY: 20,  // 查看前一天
    PROB_VIEW_TOMORROW: 20,   // 查看后一天
    PROB_VIEW_DAY_AFTER: 5,   // 查看大后天
    // 总计 100%
};
    // 状态反馈文案池
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

    // 默认反馈（当没有条目时）
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
    // 状态计算（复用 plan-todo.js 的逻辑）
    // ============================================================
    function calculateItemStatus(item) {
        // 如果已暂停
        if (item.status === 'paused') {
            return '已暂停';
        }
        if (item.status === 'completed') {
            return '已完成';
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // 如果 item 有 expandRepeatDates 方法（重复待办）
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

        // 延后半天
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
// 选择日期和条目（重构版 - 只查近4天）
// ============================================================
function selectDateAndItem() {
    // 获取今天、昨天、明天、大后天的日期
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
    
    // 1. 获取所有条目
    const allItems = getAllViewableItems();
    
    // 2. 筛选出近4天内的可查看条目
    const availableItems = allItems.filter(item => {
        return targetDates.includes(item._date);
    });
    
    // 3. 如果没有可查看条目 → 返回无条目反馈
    if (availableItems.length === 0) {
        return { date: null, item: null, feedback: randomPick(DEFAULT_FEEDBACK) };
    }
    
    // 4. 按日期分组（仅近4天）
    const grouped = {};
    availableItems.forEach(item => {
        const date = item._date;
        if (!grouped[date]) grouped[date] = [];
        grouped[date].push(item);
    });
    
    // 5. 按概率选择目标日期
    const roll = Math.random() * 100;
    let targetDate = null;
    
    if (roll < 55) {
        // 55% 选中今天
        targetDate = todayStr;
    } else if (roll < 75) {
        // 20% 选中昨天
        targetDate = yesterdayStr;
    } else if (roll < 95) {
        // 20% 选中明天
        targetDate = tomorrowStr;
    } else {
        // 5% 选中大后天
        targetDate = dayAfterTomorrowStr;
    }
    
    // 6. 检查目标日期是否有数据
    let selectedItem = null;
    let selectedDate = targetDate;
    
    if (grouped[targetDate] && grouped[targetDate].length > 0) {
        // 目标日期有数据 → 从中随机选一条
        selectedItem = randomPick(grouped[targetDate]);
    } else {
        // 目标日期无数据 → 从所有近4天可查看条目中随机选一条
        selectedItem = randomPick(availableItems);
        selectedDate = selectedItem._date;
    }
    
    if (!selectedItem) {
        return { date: null, item: null, feedback: randomPick(DEFAULT_FEEDBACK) };
    }
    
    // 计算状态并获取反馈
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
// 发送系统消息（纯文字，无图标，显示在对话中间）
// ============================================================
function sendSystemMessage(message) {
    try {
        // 直接注入系统消息到聊天容器
        const chatContainer = document.getElementById('chat-container') || document.querySelector('.chat-container');
        if (chatContainer) {
            const msgDiv = document.createElement('div');
            msgDiv.className = 'system-message';
            msgDiv.textContent = message;
            // 移除可能存在的图标
            msgDiv.style.display = 'flex';
            msgDiv.style.alignItems = 'center';
            msgDiv.style.justifyContent = 'center';
            msgDiv.style.gap = '0';
            // 确保没有额外的图标
            chatContainer.appendChild(msgDiv);
            chatContainer.scrollTop = chatContainer.scrollHeight;
            return;
        }
        
        // fallback：如果找不到聊天容器，用 toast 显示
        if (typeof showToast === 'function') {
            showToast(message, 'info');
        } else {
            console.log('[random-check]', message);
        }
    } catch (e) {
        console.error('[random-check] 发送系统消息失败:', e);
        if (typeof showToast === 'function') {
            showToast(message, 'info');
        }
    }
}

    // ============================================================
    // 执行一次随机查看
    // ============================================================
    function performRandomCheck() {
        try {
            // 概率判断：40% 直接结束（无事发生）
            const roll = Math.random() * 100;
            if (roll < CONFIG.PROB_DIRECT_END) {
                // 无事发生
                return;
            }

            const result = selectDateAndItem();
            const partnerName = getPartnerName();

            let message = '';

            if (!result.item || !result.date) {
                // 没有可查看的条目
                const defaultMsg = randomPick(DEFAULT_FEEDBACK);
                message = `${partnerName} ${defaultMsg}`;
            } else {
                const typeLabel = result.item._type === 'plan' ? '计划' : '待办';
                const dateDisplay = formatDateDisplay(result.date);
                const title = result.item.fullTitle || `${result.item.primaryLabel}.${result.item.secondaryTitle}`;
                message = `${partnerName} 刚刚查看了你 ${dateDisplay} 的${typeLabel}「${title}」，他说：${result.feedback}`;
            }

            sendSystemMessage(message);
        } catch (e) {
            console.error('[random-check] 执行随机查看失败:', e);
        }
    }

    // ============================================================
    // 调度器（复用 call.js 的逻辑）
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
            scheduleNext(); // 递归调度下一次
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
    // 初始化（随页面加载启动）
    // ============================================================
    function init() {
        console.log('[random-check] 模块已加载');

        // 延迟启动，确保页面完全加载
        setTimeout(() => {
            start();
        }, 3000);
    }

    // 暴露到全局
    window.randomCheck = {
        start: start,
        stop: stop,
        setEnabled: setEnabled,
        perform: performRandomCheck,
    };

    // 页面加载时初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    console.log('[random-check] 模块已初始化');
})();