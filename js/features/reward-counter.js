/**
 * reward-counter.js - 奖励累计统计模块（总统计）
 */

(function () {
    'use strict';

    // ============================================================
    // 工具函数 - 获取数据
    // ============================================================
    function getAllTodoData() {
        try {
            const raw = localStorage.getItem('plan_todo_data');
            return raw ? JSON.parse(raw) : {};
        } catch { return {}; }
    }

    // ============================================================
    // 核心统计函数
    // ============================================================
    function calculateTotalRewards() {
        const allData = getAllTodoData();
        let rewards = {
            black: 0,
            silver: 0,
            gold: 0
        };

        const colorMap = {
            '黑': 'black',
            '银': 'silver',
            '金': 'gold'
        };

        for (const dateStr in allData) {
            const day = allData[dateStr];

            // 统计计划
            if (day.plans) {
                day.plans.forEach(p => {
                    if (p.status === 'completed' && p.reward && p.reward.total) {
                        const color = p.reward.total.color || '金';
                        const count = p.reward.total.count || 0;
                        const key = colorMap[color];
                        if (key && rewards[key] !== undefined) {
                            rewards[key] += count;
                        }
                    }

                    // 统计阶段奖励
                    if (p.stages && p.stages.length > 0 && p.reward && p.reward.stages) {
                        p.stages.forEach((stage, idx) => {
                            if (stage.completed === true) {
                                const stageReward = p.reward.stages[idx];
                                if (stageReward && !stageReward.noReward) {
                                    const color = stageReward.color || '金';
                                    const count = stageReward.count || 0;
                                    const key = colorMap[color];
                                    if (key && rewards[key] !== undefined) {
                                        rewards[key] += count;
                                    }
                                }
                            }
                        });
                    }
                });
            }

            // 统计待办
            if (day.todos) {
                day.todos.forEach(t => {
                    if (t.status === 'completed' && t.reward && t.reward.total) {
                        const color = t.reward.total.color || '金';
                        const count = t.reward.total.count || 0;
                        const key = colorMap[color];
                        if (key && rewards[key] !== undefined) {
                            rewards[key] += count;
                        }
                    }
                });
            }
        }

        return rewards;
    }

    function getRewardDisplayText(rewards) {
        const parts = [];
        if (rewards.black > 0) parts.push(`${rewards.black}颗黑曜石`);
        if (rewards.silver > 0) parts.push(`${rewards.silver}颗银曜石`);
        if (rewards.gold > 0) parts.push(`${rewards.gold}颗金曜石`);
        return parts.length > 0 ? parts.join(' ') : '暂无奖励';
    }

    // ============================================================
    // 渲染奖励统计 - 不破坏现有 DOM
    // ============================================================
    function renderRewardStats() {
        // ★ 等待 plan-todo 卡片渲染完成
        const containerCheck = setInterval(function() {
            const planTodoContainer = document.getElementById('plan-todo-container');
            if (planTodoContainer) {
                clearInterval(containerCheck);
                // 卡片已渲染，现在添加奖励统计
                doRenderRewardStats();
            }
        }, 200);

        // 5秒超时，即使没有卡片也尝试渲染
        setTimeout(function() {
            clearInterval(containerCheck);
            if (!document.getElementById('reward-stats-container')) {
                doRenderRewardStats();
            }
        }, 5000);
    }

function doRenderRewardStats() {
    const statsEl = document.getElementById('comp-records-stats');
    if (!statsEl) {
        setTimeout(doRenderRewardStats, 300);
        return;
    }

    if (document.getElementById('reward-stats-container')) {
        updateRewardStats();
        return;
    }

    const parent = statsEl.parentNode;
    if (!parent) return;

    const container = document.createElement('div');
    container.id = 'reward-stats-container';
    // ★ 初始样式也包含大间距
    container.style.cssText = `
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-top: 14px;
        padding-top: 10px;
        border-top: 1px solid var(--border-color);
        font-size: 13px;
        color: var(--text-secondary);
        width: 100%;
    `;

    parent.insertBefore(container, statsEl.nextSibling);
    updateRewardStats();
}

function updateRewardStats() {
    const container = document.getElementById('reward-stats-container');
    if (!container) return;

    const rewards = calculateTotalRewards();
    const rewardText = getRewardDisplayText(rewards);
    const totalCount = rewards.black + rewards.silver + rewards.gold;

    // ★ 增加上边距，与待办统计拉开距离
    container.style.cssText = `
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-top: 14px;
        padding-top: 10px;
        border-top: 1px solid var(--border-color);
        font-size: 13px;
        color: var(--text-secondary);
        width: 100%;
    `;

    container.innerHTML = `
        <span>
            🏆 奖励合计：${rewardText}
            ${totalCount > 0 ? `<span style="font-size:10px;opacity:0.5;margin-left:6px;">(总计 ${totalCount} 颗)</span>` : ''}
        </span>
        <button id="reward-exchange-btn" style="
            padding: 4px 14px;
            border-radius: 16px;
            border: 1px solid var(--accent-color);
            background: rgba(var(--accent-color-rgb), 0.1);
            color: var(--accent-color);
            font-size: 12px;
            font-weight: 600;
            cursor: pointer;
            font-family: var(--font-family);
            transition: all 0.2s;
            flex-shrink: 0;
        " onmouseover="this.style.background='rgba(var(--accent-color-rgb), 0.2)'" onmouseout="this.style.background='rgba(var(--accent-color-rgb), 0.1)'">
            兑换
        </button>
    `;

    const exchangeBtn = document.getElementById('reward-exchange-btn');
    if (exchangeBtn) {
        const newBtn = exchangeBtn.cloneNode(true);
        exchangeBtn.parentNode.replaceChild(newBtn, exchangeBtn);
        newBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            if (typeof showToast === 'function') {
                showToast('🔧 兑换功能开发中，敬请期待 ✦', 'info');
            } else if (typeof showNotification === 'function') {
                showNotification('🔧 兑换功能开发中，敬请期待 ✦', 'info');
            } else {
                alert('兑换功能开发中，敬请期待 ✦');
            }
        });
    }
}

    // ============================================================
    // 强制刷新
    // ============================================================
    function refreshRewardStats() {
        if (!document.getElementById('reward-stats-container')) {
            renderRewardStats();
        } else {
            updateRewardStats();
        }
    }

    // ============================================================
    // 监听
    // ============================================================
    function setupRewardListener() {
        window.addEventListener('storage', function(e) {
            if (e.key === 'plan_todo_data') {
                setTimeout(refreshRewardStats, 200);
            }
        });

        document.addEventListener('planTodoDataChanged', function() {
            setTimeout(refreshRewardStats, 200);
        });

        document.addEventListener('planTodoCompleted', function(e) {
            console.log('[reward-counter] 收到完成事件，刷新奖励统计', e.detail);
            setTimeout(refreshRewardStats, 300);
        });
    }

    // ============================================================
    // 对外暴露
    // ============================================================
    window.RewardCounter = {
        calculateTotalRewards: calculateTotalRewards,
        renderRewardStats: renderRewardStats,
        updateRewardStats: updateRewardStats,
        refreshRewardStats: refreshRewardStats,
        getRewardDisplayText: getRewardDisplayText
    };
    window._refreshRewardStats = refreshRewardStats;

    // ============================================================
    // 初始化
    // ============================================================
    function initRewardCounter() {
        console.log('[reward-counter] 奖励累计模块已加载');
        
        // ★ 等待 plan-todo 完成初始化
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function() {
                setTimeout(renderRewardStats, 800);
            });
        } else {
            setTimeout(renderRewardStats, 800);
        }

        setupRewardListener();

        // 监听陪伴记录模态框打开
        const observer = new MutationObserver(function(mutations) {
            for (const mutation of mutations) {
                if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                    const modal = document.getElementById('companion-records-modal');
                    if (modal && modal.style.display !== 'none' && modal.style.display !== '') {
                        setTimeout(refreshRewardStats, 300);
                    }
                }
            }
        });

        const modal = document.getElementById('companion-records-modal');
        if (modal) {
            observer.observe(modal, { attributes: true, attributeFilter: ['style'] });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initRewardCounter);
    } else {
        initRewardCounter();
    }

    console.log('[reward-counter] 模块加载完成（总统计版）');
})();