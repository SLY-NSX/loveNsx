/**
 * reward-counter.js - 奖励累计统计模块（总统计）
 * 统计所有已完成条目（计划/待办/阶段）的奖励，在陪伴月历底部显示
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
    // 核心统计函数 - 统计所有已完成条目的奖励（总统计）
    // ============================================================
    function calculateTotalRewards() {
        const allData = getAllTodoData();
        let rewards = {
            black: 0,   // 黑曜石
            silver: 0,  // 银曜石
            gold: 0     // 金曜石
        };

        // 颜色映射
        const colorMap = {
            '黑': 'black',
            '银': 'silver', 
            '金': 'gold'
        };

        for (const dateStr in allData) {
            const day = allData[dateStr];
            
            // ---- 统计计划 ----
            if (day.plans) {
                day.plans.forEach(p => {
                    // 只统计已完成的计划
                    if (p.status === 'completed' && p.reward && p.reward.total) {
                        const color = p.reward.total.color || '金';
                        const count = p.reward.total.count || 0;
                        const key = colorMap[color];
                        if (key && rewards[key] !== undefined) {
                            rewards[key] += count;
                        }
                    }
                    
                    // ★ 统计计划的阶段奖励（每个已完成阶段单独算）
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

            // ---- 统计待办 ----
            if (day.todos) {
                day.todos.forEach(t => {
                    // 只统计已完成的待办
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

    // ============================================================
    // 获取奖励显示文本
    // ============================================================
    function getRewardDisplayText(rewards) {
        const parts = [];
        if (rewards.black > 0) parts.push(`${rewards.black}颗黑曜石`);
        if (rewards.silver > 0) parts.push(`${rewards.silver}颗银曜石`);
        if (rewards.gold > 0) parts.push(`${rewards.gold}颗金曜石`);
        return parts.length > 0 ? parts.join(' ') : '暂无奖励';
    }

    // ============================================================
    // 渲染奖励统计到月历底部
    // ============================================================
    function renderRewardStats() {
        // 查找月历统计容器
        const statsEl = document.getElementById('comp-records-stats');
        if (!statsEl) {
            // 如果还没渲染，等待后重试
            setTimeout(renderRewardStats, 500);
            return;
        }

        // 防止重复添加
        if (document.getElementById('reward-stats-container')) {
            updateRewardStats();
            return;
        }

        // 创建奖励统计容器（放在陪伴统计下方）
        const container = document.createElement('div');
        container.id = 'reward-stats-container';
        container.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-top: 6px;
            padding-top: 6px;
            border-top: 1px solid var(--border-color);
            font-size: 13px;
            color: var(--text-secondary);
        `;

        // 插入到 statsEl 后面
        statsEl.parentNode.insertBefore(container, statsEl.nextSibling);

        updateRewardStats();
    }

    function updateRewardStats() {
        const container = document.getElementById('reward-stats-container');
        if (!container) return;

        const rewards = calculateTotalRewards();
        const rewardText = getRewardDisplayText(rewards);

        // 获取总奖励数量（用于显示角标）
        const totalCount = rewards.black + rewards.silver + rewards.gold;

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
                🔄 兑换
            </button>
        `;

        // 绑定兑换按钮事件
        const exchangeBtn = document.getElementById('reward-exchange-btn');
        if (exchangeBtn) {
            // 移除旧监听器（避免重复绑定）
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
    // 强制刷新（供外部调用）
    // ============================================================
    function refreshRewardStats() {
        // 确保容器存在
        if (!document.getElementById('reward-stats-container')) {
            renderRewardStats();
        } else {
            updateRewardStats();
        }
    }

    // ============================================================
    // 监听数据变化
    // ============================================================
    function setupRewardListener() {
        // 监听 localStorage 变化
        window.addEventListener('storage', function(e) {
            if (e.key === 'plan_todo_data') {
                refreshRewardStats();
            }
        });

        // 监听自定义事件（plan-todo 保存时触发）
        document.addEventListener('planTodoDataChanged', function() {
            refreshRewardStats();
        });

        // ★ 监听完成事件（由 plan-todo 触发）
        document.addEventListener('planTodoCompleted', function(e) {
            console.log('[reward-counter] 收到完成事件，刷新奖励统计', e.detail);
            // 延迟一下确保数据已保存
            setTimeout(refreshRewardStats, 100);
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

    // 方便外部直接调用
    window._refreshRewardStats = refreshRewardStats;

    // ============================================================
    // 初始化
    // ============================================================
    function initRewardCounter() {
        console.log('[reward-counter] 奖励累计模块已加载');
        
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function() {
                setTimeout(renderRewardStats, 400);
            });
        } else {
            setTimeout(renderRewardStats, 400);
        }

        setupRewardListener();

        // 监听陪伴记录模态框打开（重新渲染）
        const observer = new MutationObserver(function(mutations) {
            for (const mutation of mutations) {
                if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                    const modal = document.getElementById('companion-records-modal');
                    if (modal && modal.style.display !== 'none' && modal.style.display !== '') {
                        setTimeout(refreshRewardStats, 150);
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