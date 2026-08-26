/**
 * reward-counter.js - 奖励累计统计模块（总统计）
 */
(function () {
    'use strict';

    function getAllTodoData() {
        try {
            const raw = localStorage.getItem('plan_todo_data');
            return raw ? JSON.parse(raw) : {};
        } catch { return {}; }
    }

    function calculateTotalRewards() {
        const allData = getAllTodoData();
        let rewards = { black: 0, silver: 0, gold: 0 };
        const colorMap = { '黑': 'black', '银': 'silver', '金': 'gold' };

        for (const dateStr in allData) {
            const day = allData[dateStr];

            if (day.plans) {
                day.plans.forEach(p => {
                    if (p.status === 'completed' && p.reward && p.reward.total) {
                        const key = colorMap[p.reward.total.color] || 'gold';
                        rewards[key] += p.reward.total.count || 0;
                    }
                    if (p.stages && p.stages.length > 0 && p.reward && p.reward.stages) {
                        p.stages.forEach((stage, idx) => {
                            if (stage.completed === true) {
                                const stageReward = p.reward.stages[idx];
                                if (stageReward && !stageReward.noReward) {
                                    const key = colorMap[stageReward.color] || 'gold';
                                    rewards[key] += stageReward.count || 0;
                                }
                            }
                        });
                    }
                });
            }

            if (day.todos) {
                day.todos.forEach(t => {
                    if (t.status === 'completed' && t.reward && t.reward.total) {
                        const key = colorMap[t.reward.total.color] || 'gold';
                        rewards[key] += t.reward.total.count || 0;
                    }
                });
            }
        }

        return rewards;
    }

    function getRewardDisplayText(rewards) {
        const parts = [];
        if (rewards.black > 0) parts.push(rewards.black + '颗黑曜石');
        if (rewards.silver > 0) parts.push(rewards.silver + '颗银曜石');
        if (rewards.gold > 0) parts.push(rewards.gold + '颗金曜石');
        return parts.length > 0 ? parts.join(' ') : '暂无奖励';
    }

    function updateRewardStats() {
        const textEl = document.getElementById('reward-stats-text');
        if (!textEl) return;
        const rewards = calculateTotalRewards();
        textEl.textContent = '🏆 奖励合计：' + getRewardDisplayText(rewards);
    }

    function initRewardCounter() {
        console.log('[reward-counter] 奖励累计模块已加载');
        // 初始更新
        setTimeout(updateRewardStats, 500);

        // 监听完成事件
        document.addEventListener('planTodoCompleted', function(e) {
            console.log('[reward-counter] 收到完成事件，刷新奖励统计', e.detail);
            setTimeout(updateRewardStats, 300);
        });

        // 监听 storage 变化
        window.addEventListener('storage', function(e) {
            if (e.key === 'plan_todo_data') {
                setTimeout(updateRewardStats, 200);
            }
        });

        // 兑换按钮
        document.addEventListener('click', function(e) {
            if (e.target.id === 'reward-exchange-btn' || e.target.closest('#reward-exchange-btn')) {
                if (typeof showToast === 'function') {
                    showToast('🔧 兑换功能开发中，敬请期待 ✦', 'info');
                } else {
                    alert('兑换功能开发中，敬请期待 ✦');
                }
            }
        });
    }

    window.RewardCounter = {
        calculateTotalRewards: calculateTotalRewards,
        updateRewardStats: updateRewardStats,
        getRewardDisplayText: getRewardDisplayText
    };
    window._refreshRewardStats = updateRewardStats;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initRewardCounter);
    } else {
        initRewardCounter();
    }

    console.log('[reward-counter] 模块加载完成');
})();