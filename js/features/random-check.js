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
        PROB_DIRECT_END: 40,      // 直接结束，无事发生
        PROB_VIEW_TODAY: 35,      // 查看当天
        PROB_VIEW_ADJACENT: 10,   // 查看前一天或后一天
        PROB_VIEW_DAY_AFTER: 5,   // 查看大后天
        // 总计 90%，剩余 10% 查看其他随机日期（或无事发生）
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
    // 选择日期和条目
    // ============================================================
    function selectDateAndItem() {
        const allItems = getAllViewableItems();
        if (allItems.length === 0) {
            return { date: null, item: null, feedback: randomPick(DEFAULT_FEEDBACK) };
        }

        // 按日期分组
        const grouped = {};
        allItems.forEach(item => {
            const date = item._date;
            if (!grouped[date]) grouped[date] = [];
            grouped[date].push(item);
        });

        const dates = Object.keys(grouped).sort();

        // 随机选择一个日期
        // 概率分布：35% 今天，10% 前一天/后一天，5% 大后天，剩余随机
        const today = new Date().toISOString().split('T')[0];
        const todayIndex = dates.indexOf(today);

        let targetDate = null;

        const roll = Math.random() * 100;

        if (roll < 35 && todayIndex !== -1) {
            // 35% 查看当天
            targetDate = today;
        } else if (roll < 45 && todayIndex !== -1) {
            // 10% 查看前一天或后一天
            const options = [];
            if (todayIndex > 0) options.push(dates[todayIndex - 1]);
            if (todayIndex < dates.length - 1) options.push(dates[todayIndex + 1]);
            if (options.length > 0) {
                targetDate = randomPick(options);
            }
        } else if (roll < 50 && todayIndex !== -1 && todayIndex + 2 < dates.length) {
            // 5% 查看大后天
            const targetIdx = todayIndex + 2;
            if (targetIdx < dates.length) {
                targetDate = dates[targetIdx];
            }
        }

        // 如果没选中特定日期，随机选一个
        if (!targetDate) {
            targetDate = randomPick(dates);
        }

        // 从该日期中随机选一个条目
        const itemsOnDate = grouped[targetDate] || [];
        const selectedItem = randomPick(itemsOnDate);

        if (!selectedItem) {
            return { date: null, item: null, feedback: randomPick(DEFAULT_FEEDBACK) };
        }

        // 计算状态并获取反馈
        const status = calculateItemStatus(selectedItem);
        const feedbackPool = FEEDBACK[status] || ['嗯，我知道了 ✦'];
        const feedback = randomPick(feedbackPool);

        return {
            date: targetDate,
            item: selectedItem,
            feedback: feedback,
            status: status
        };
    }

    // ============================================================
    // 发送系统消息（类似 call.js 的 sendCallEvent）
    // ============================================================
    function sendSystemMessage(message) {
        // 尝试使用 call.js 的 _addCallBubble 函数
        if (typeof window._addCallBubble === 'function') {
            window._addCallBubble('fa-eye', message, 'partner', null);
            return;
        }

        // fallback：使用 _addCallEvent
        if (typeof window._addCallEvent === 'function') {
            window._addCallEvent('fa-eye', message);
            return;
        }

        // 最终 fallback：在控制台输出
        console.log('[random-check]', message);
        if (typeof showToast === 'function') {
            showToast(message, 'info');
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