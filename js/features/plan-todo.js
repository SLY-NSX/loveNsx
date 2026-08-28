/**
 * plan-todo.js - 计划与待办完整功能模块
 * 包含：卡片展示、新建条目、数据持久化
 * 一级标题规则：
 *   - 计划：一级标题唯一，完整标题（一级.二级）唯一
 *   - 待办：一级标题唯一，二级标题无限制
 *   - 名称一旦创建，颜色即固定
 */

(function () {
    'use strict';

    // ============================================================
    // 常量 & 配置
    // ============================================================
    const STORAGE_KEY = 'plan_todo_data';
    const META_KEY = 'plan_todo_meta'; // 存储一级标题元数据

    const COLORS = [
        { name: '红', value: '#E74C3C' },
        { name: '橙', value: '#E67E22' },
        { name: '黄', value: '#F1C40F' },
        { name: '绿', value: '#2ECC71' },
        { name: '蓝', value: '#3498DB' },
        { name: '紫', value: '#9B59B6' },
        { name: '粉', value: '#E84393' },
        { name: '灰', value: '#95A5A6' }
    ];

    const PRIORITIES = [
        { label: '高', value: 'high', color: '#E74C3C' },
        { label: '中', value: 'medium', color: '#F39C12' },
        { label: '低', value: 'low', color: '#2ECC71' }
    ];

    const REWARD_COLORS = ['黑', '银', '金'];

    // ============================================================
    // 工具函数
    // ============================================================
    function getTodayStr() {
        const d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return y + '-' + m + '-' + day;
    }

    function formatDateDisplay(dateStr) {
        if (!dateStr) return '';
        const parts = dateStr.split('-');
        return parts[0] + '年' + parseInt(parts[1]) + '月' + parseInt(parts[2]) + '日';
    }

    function isDateBeforeToday(dateStr) {
        return dateStr < getTodayStr();
    }

    function generateId() {
        return 'pt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
    }

    function getWeekdayIndex(weekday) {
        // 返回 1-7 (周一=1, 周日=7)
        const map = { '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '日': 7 };
        return map[weekday] || 0;
    }

    // ============================================================
    // 数据读写（核心存储）
    // ============================================================
    function getAllData() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            return raw ? JSON.parse(raw) : {};
        } catch { return {}; }
    }

    function saveAllData(data) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
            window._planTodoData = data;
        } catch (e) {
            console.error('[plan-todo] 保存数据失败', e);
            showToast('保存失败，请检查存储空间', 'error');
        }
    }

    // 获取某一天的完整数据 { plans: [], todos: [] }
    function getDayData(dateStr) {
        const all = getAllData();
        return all[dateStr] || { plans: [], todos: [] };
    }

    // 保存某一天的数据
    function saveDayData(dateStr, dayData) {
        const all = getAllData();
        all[dateStr] = dayData;
        saveAllData(all);
    }

// ============================================================
// 获取某一天的完整数据（包含重复待办的展开实例）
// ============================================================
function getDayDataWithExpanded(dateStr) {
    const all = getAllData();
    const result = { plans: [], todos: [] };
    
    // 1. 获取该日期的计划（计划直接存储在该日期下）
    if (all[dateStr] && all[dateStr].plans) {
        result.plans = all[dateStr].plans.filter(p => p.status !== 'completed');
    }
    
    // 2. 获取该日期的待办（包含从其他日期展开的重复实例）
    const allTodos = [];
    for (const date in all) {
        if (all[date] && all[date].todos) {
            all[date].todos.forEach(t => {
                allTodos.push({ ...t, _sourceDate: date });
            });
        }
    }
    
    // 筛选出今天应该显示的待办
    allTodos.forEach(t => {
        if (t.isRepeating) {
            // 重复待办：检查今天是否在重复实例中
            const allDates = expandRepeatDates(t);
            if (allDates.includes(dateStr)) {
                // 为今天创建一个"实例副本"
                const instance = { ...t };
                // 实例的日期是今天
                result.todos.push(instance);
            }
        } else {
            // 非重复待办：检查日期是否匹配
            if (t.startDate === dateStr) {
                result.todos.push({ ...t });
            }
        }
    });
    
    return result;
}

    // 获取所有条目（用于去重检测）
    function getAllItems() {
        const all = getAllData();
        const items = [];
        for (const date in all) {
            const day = all[date];
            if (day.plans) {
                day.plans.forEach(item => {
                    items.push({ ...item, _date: date, _type: 'plan' });
                });
            }
            if (day.todos) {
                day.todos.forEach(item => {
                    items.push({ ...item, _date: date, _type: 'todo' });
                });
            }
        }
        return items;
    }

    // ============================================================
    // 一级标题元数据管理（名称 + 颜色绑定）
    // ============================================================
    function getMeta() {
        try {
            const raw = localStorage.getItem(META_KEY);
            return raw ? JSON.parse(raw) : { plans: [], todos: [] };
        } catch { return { plans: [], todos: [] }; }
    }

    function saveMeta(meta) {
        try {
            localStorage.setItem(META_KEY, JSON.stringify(meta));
        } catch (e) {
            console.error('[plan-todo] 保存元数据失败', e);
        }
    }

    // 获取已有的一级标题列表（用于下拉选项）
    function getPrimaryLabelOptions(type) {
        const meta = getMeta();
        const list = meta[type] || [];
        return list; // [{ name: '学习', color: '#3498DB' }]
    }

    // 添加或更新一级标题（去重）
    function addPrimaryLabel(type, name, color) {
        if (!name || !name.trim()) return false;
        const meta = getMeta();
        if (!meta[type]) meta[type] = [];

        const existing = meta[type].find(item => item.name === name.trim());
        if (existing) {
            // 名称已存在，颜色不可变更（规则：名称一旦创建，颜色即固定）
            return false;
        }

        meta[type].push({ name: name.trim(), color: color || COLORS[0].value });
        saveMeta(meta);
        return true;
    }

    // 获取某个一级标题的颜色（如果存在）
    function getPrimaryLabelColor(type, name) {
        if (!name) return COLORS[0].value;
        const meta = getMeta();
        const list = meta[type] || [];
        const found = list.find(item => item.name === name.trim());
        return found ? found.color : COLORS[0].value;
    }
// ============================================================
// 去重检测函数（修正版）
// ============================================================
function checkDuplicate(type, primaryLabel, secondaryTitle, excludeId) {
    const allItems = getAllItems();
    const filtered = excludeId ? allItems.filter(item => item.id !== excludeId) : allItems;

    if (type === 'plan') {
        // 计划：一级标题唯一
        const samePrimary = filtered.filter(item => item._type === 'plan' && item.primaryLabel === primaryLabel);
        if (samePrimary.length > 0) {
            return { conflict: 'primary', message: `计划中已存在一级标题「${primaryLabel}」，请勿重复创建` };
        }
        // 计划：完整标题唯一（一级.二级）
        const fullTitle = primaryLabel + '.' + secondaryTitle;
        const sameFull = filtered.filter(item => item._type === 'plan' && item.fullTitle === fullTitle);
        if (sameFull.length > 0) {
            return { conflict: 'full', message: `计划中已存在「${fullTitle}」，请勿重复创建` };
        }
    } else if (type === 'todo') {
        // 待办：一级标题唯一
        const samePrimary = filtered.filter(item => item._type === 'todo' && item.primaryLabel === primaryLabel);
        if (samePrimary.length > 0) {
            return { conflict: 'primary', message: `待办中已存在一级标题「${primaryLabel}」，请勿重复创建` };
        }
        // ✅ 待办：二级标题无限制（不做任何检测）
        // ✅ 待办：完整标题无限制（不做任何检测）
    }
    return null; // 无冲突
}

    // ============================================================
    // 保存新条目
    // ============================================================
    function saveNewItem(formData) {
        const { type, primaryLabel, primaryColor, secondaryTitle, date, ...rest } = formData;

        // 1. 去重检测
        const dupCheck = checkDuplicate(type, primaryLabel, secondaryTitle);
        if (dupCheck) {
            showToast(dupCheck.message, 'warning');
            return false;
        }

        // 2. 确保一级标题元数据已存储（名称+颜色绑定）
        addPrimaryLabel(type, primaryLabel, primaryColor);

        // 3. 构建条目对象
        const fullTitle = primaryLabel + '.' + secondaryTitle;
        const now = Date.now();

        const item = {
            id: generateId(),
            type: type,
            primaryLabel: primaryLabel,
            primaryColor: primaryColor,
            secondaryTitle: secondaryTitle,
            fullTitle: fullTitle,
            status: 'active',
            createdAt: now,
            updatedAt: now,
            ...rest
        };

        // 4. 存入对应日期
        const dayData = getDayData(date);
        if (type === 'plan') {
            if (!dayData.plans) dayData.plans = [];
            dayData.plans.push(item);
        } else {
            if (!dayData.todos) dayData.todos = [];
            dayData.todos.push(item);
        }
        saveDayData(date, dayData);

        showToast(`✅ 「${fullTitle}」创建成功！`, 'success');
        return true;
    }

    // ============================================================
    // 获取某一天的统计信息
    // ============================================================
// ============================================================
// 获取某一天的统计信息（包含跨天计划和重复待办）
// ============================================================
function getDayStats(dateStr) {
    // 1. 统计计划：从所有日期中查找包含 dateStr 的计划（去重）
    const allData = getAllData();
    let activePlans = [];
    for (const date in allData) {
        const day = allData[date];
        if (day.plans) {
            day.plans.forEach(p => {
                if (p.startDate <= dateStr && p.endDate >= dateStr && p.status === 'active') {
                    if (!activePlans.some(item => item.id === p.id)) {
                        activePlans.push(p);
                    }
                }
            });
        }
    }
    
    // 2. 统计待办：使用展开函数获取当天的待办实例
    const dayData = getDayDataWithExpanded(dateStr);
    const todos = dayData.todos || [];
    const activeTodos = todos.filter(t => t.status === 'active');
    const completedTodos = todos.filter(t => t.status === 'completed');

    return {
        plansCount: activePlans.length,
        todosTotal: activeTodos.length + completedTodos.length,
        todosCompleted: completedTodos.length
    };
}

// ============================================================
// 卡片渲染（更新下方两张卡片的内容）
// ============================================================
function renderCards(dateStr) {
    const container = document.getElementById('plan-todo-container');
    if (!container) return;

    const parts = dateStr.split('-');
    const year = parseInt(parts[0]);
    const month = parseInt(parts[1]) - 1;
    const day = parseInt(parts[2]);
    const dateObj = new Date(year, month, day);

    // 获取农历信息
    let lunarDateStr = '农历??月??';
    let lunarYearInfo = '????年.??';
    let weekDayStr = '星期?';
    if (typeof Lunar !== 'undefined') {
        try {
            const lunar = Lunar.fromDate(dateObj);
            lunarDateStr = `农历${lunar.lunarMonthName}${lunar.lunarDayName}`;
            lunarYearInfo = `${lunar.lunarYearName}${lunar.lunarYearShengXiao}年`;
            weekDayStr = lunar.weekDay || dateObj.toLocaleDateString('zh-CN', { weekday: 'long' });
        } catch (e) { /* 回退到公历 */ }
    }
    if (lunarDateStr === '农历??月??') {
        const d = new Date(dateObj);
        lunarDateStr = `农历${d.getMonth()+1}月${d.getDate()}日`;
        lunarYearInfo = `${d.getFullYear()}年`;
        weekDayStr = d.toLocaleDateString('zh-CN', { weekday: 'long' });
    }

    // 获取统计数据（计划 + 待办）
    const stats = getDayStats(dateStr);

    // ----- 计划卡片：计算真实数据 -----
    const allData = getAllData();
    let activePlans = [];
    
    // 收集所有包含 dateStr 的进行中计划（去重）
    for (const date in allData) {
        const day = allData[date];
        if (day.plans) {
            day.plans.forEach(p => {
                if (p.startDate <= dateStr && p.endDate >= dateStr && p.status === 'active') {
                    if (!activePlans.some(item => item.id === p.id)) {
                        activePlans.push(p);
                    }
                }
            });
        }
    }
    
    // 计算距离完成最近的一项计划
    let closestPlan = null;
    let closestDays = Infinity;
    
    if (activePlans.length > 0) {
        // 按结束日期排序，找最近的一个
        const sorted = [...activePlans].sort((a, b) => a.endDate.localeCompare(b.endDate));
        const today = new Date(dateStr);
        today.setHours(0, 0, 0, 0);
        
        for (const p of sorted) {
            const endDate = new Date(p.endDate);
            endDate.setHours(0, 0, 0, 0);
            // 只取结束日期 >= 今天 的计划
            if (endDate >= today) {
                const diffTime = endDate - today;
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                closestPlan = p;
                closestDays = diffDays;
                break;
            }
        }
    }
    
    // 构建计划卡片显示文字
    let planTitleText = '';
    let planSubText = '';
    
    if (closestPlan) {
        const daysText = closestDays === 0 ? '今天' : `${closestDays}天`;
        planTitleText = `距离完成【${closestPlan.fullTitle}】还有 ${daysText}`;
        planSubText = `共 ${activePlans.length} 项计划正在进行中`;
    } else {
        planTitleText = '暂无排期';
        planSubText = `共 ${activePlans.length} 项计划正在进行中`;
    }

    const planDateStr = `${year}年${month+1}月${day}日`;

    container.innerHTML = `
        <!-- 计划卡片 -->
        <div class="plan-todo-card" data-type="plan" style="
            background: var(--primary-bg);
            border: 1px solid var(--border-color);
            border-left: 4px solid var(--accent-color);
            border-radius: 10px;
            padding: 14px 16px;
            cursor: pointer;
            transition: background 0.2s, transform 0.1s;
            display: flex;
            flex-direction: column;
            gap: 4px;
        ">
            <div style="font-weight: 700; font-size: 17px; color: var(--text-primary);">📅 ${planDateStr}</div>
            <div style="font-size: 14px; color: var(--text-secondary);">${planTitleText}</div>
            <div style="font-size: 14px; color: var(--text-secondary);">${planSubText}</div>
        </div>

        <!-- 待办卡片 -->
        <div class="plan-todo-card" data-type="todo" style="
            background: var(--primary-bg);
            border: 1px solid var(--border-color);
            border-left: 4px solid var(--accent-color);
            border-radius: 10px;
            padding: 14px 16px;
            cursor: pointer;
            transition: background 0.2s, transform 0.1s;
            display: flex;
            flex-direction: column;
            gap: 4px;
        ">
            <div style="font-weight: 700; font-size: 17px; color: var(--text-primary);">📆 ${lunarDateStr}</div>
            <div style="font-size: 14px; color: var(--text-secondary);">${lunarYearInfo} · ${weekDayStr}</div>
            <div style="font-size: 14px; color: var(--text-secondary);">今日待办共 ${stats.todosTotal} 项，已完成 ${stats.todosCompleted} 项</div>
        </div>

        <!-- 按钮行 -->
        <div style="
            display: flex;
            justify-content: flex-end;
            gap: 10px;
            margin-top: 6px;
            padding: 0 2px;
        ">
            <button class="plan-todo-action-btn" data-action="overview" style="
                padding: 6px 18px;
                border-radius: 20px;
                border: 1px solid var(--border-color);
                background: transparent;
                color: var(--text-secondary);
                font-size: 13px;
                font-weight: 500;
                cursor: pointer;
                font-family: var(--font-family);
                transition: all 0.2s;
            ">总况</button>
            <button class="plan-todo-action-btn" data-action="create" style="
                padding: 6px 18px;
                border-radius: 20px;
                border: none;
                background: var(--accent-color);
                color: #fff;
                font-size: 13px;
                font-weight: 500;
                cursor: pointer;
                font-family: var(--font-family);
                transition: all 0.2s;
                box-shadow: 0 2px 8px rgba(var(--accent-color-rgb), 0.25);
            ">新建</button>
        </div>
    `;

    // ---------- 事件绑定 ----------
    // 卡片点击 → 二级列表
    container.querySelectorAll('.plan-todo-card').forEach(card => {
        card.addEventListener('click', function (e) {
            e.stopPropagation();
            const type = this.dataset.type === 'plan' ? 'plan' : 'todo';
            openPlanTodoList(type, dateStr);
        });
    });

// 按钮点击
container.querySelectorAll('.plan-todo-action-btn').forEach(btn => {
    btn.addEventListener('click', function (e) {
        e.stopPropagation();
        const action = this.dataset.action;
        if (action === 'create') {
            openCreateModal(dateStr);
        } else if (action === 'overview') {
            openOverview();  // ← 调用总况
        }
    });
});
}

// ============================================================
// 二级列表（计划/待办列表）
// ============================================================
function openPlanTodoList(type, dateStr) {
    const isPlan = type === 'plan';
    const allData = getAllData();
    
    // 收集该日期下所有符合条件的条目
    let items = [];
    const dayData = getDayDataWithExpanded(dateStr);
    
if (isPlan) {
    // 计划：从所有日期中查找，筛选出在 dateStr 范围内的计划
    const allData = getAllData();
    items = [];
    for (const date in allData) {
        const day = allData[date];
        if (day.plans) {
            day.plans.forEach(p => {
                // 如果该计划的起止日期包含 dateStr
                if (p.startDate <= dateStr && p.endDate >= dateStr && p.status !== 'completed') {
                    // 去重（同一个计划可能在多个日期出现，只取一次）
                    if (!items.some(item => item.id === p.id)) {
                        items.push({ ...p });
                    }
                }
            });
        }
    }
    // 按结束日期排序
    items.sort((a, b) => a.endDate.localeCompare(b.endDate));
    } else {
        // 待办：当日日期的所有待办（包括重复待办的实例）
        const todos = dayData.todos || [];
        // 过滤出今天日期的待办（包括重复实例）
        items = todos.filter(t => {
            // 如果是重复待办，检查今天是否在重复实例中
            if (t.isRepeating) {
                const allDates = expandRepeatDates(t);
                return allDates.includes(dateStr);
            }
            // 非重复待办：开始日期 <= 今天 <= 结束日期
            return t.startDate <= dateStr && t.endDate >= dateStr;
        });
        // 按创建时间排序
        items.sort((a, b) => a.createdAt - b.createdAt);
    }
    
    // 构建模态框
    const overlay = document.createElement('div');
    overlay.id = 'pt-list-overlay';
    overlay.style.cssText = `
        position: fixed; inset: 0; z-index: 100001;
        display: flex; align-items: center; justify-content: center;
        background: rgba(0,0,0,0.6);
        backdrop-filter: blur(8px);
        animation: companionToastIn 0.3s ease;
        padding: 12px;
        box-sizing: border-box;
        overflow-y: auto;
    `;
    
    const modal = document.createElement('div');
    modal.style.cssText = `
        background: var(--secondary-bg);
        max-width: 480px;
        width: 100%;
        max-height: 85vh;
        border-radius: 24px;
        padding: 20px 20px 16px;
        border: 1px solid var(--border-color);
        color: var(--text-primary);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        position: relative;
        box-shadow: 0 20px 60px rgba(0,0,0,0.5);
    `;
    
    // 标题和日期
    const titleText = isPlan ? '📋 我的计划' : '📋 我的一天';
    const dateDisplay = formatDateDisplay(dateStr);
    
    // 构建列表内容
    let listHTML = '';
    if (items.length === 0) {
        listHTML = `
            <div style="text-align:center; padding:40px 20px; color:var(--text-secondary); opacity:0.6;">
                <i class="fas fa-inbox" style="font-size:32px; display:block; margin-bottom:12px; opacity:0.3;"></i>
                <div style="font-size:14px;">${isPlan ? '暂无计划' : '今日暂无待办'}</div>
                <div style="font-size:12px; margin-top:4px;">点击下方「新建」来添加</div>
            </div>
        `;
    } else {
        listHTML = items.map(item => {
            // 计算状态
            const status = calculateItemStatus(item);
            const statusColor = getStatusColor(status);
            const statusIcon = getStatusIcon(status);
            const statusLabel = getStatusLabel(status);
            
            // 待办：右侧方框（已完成时显示 ✓）
            let rightCheckbox = '';
            if (!isPlan) {
                const isCompleted = status === '已完成';
                rightCheckbox = `
                    <div style="
                        width:28px; height:28px; border-radius:6px; 
                        border:2px solid ${isCompleted ? 'var(--accent-color)' : 'var(--border-color)'};
                        background: ${isCompleted ? 'var(--accent-color)' : 'transparent'};
                        display:flex; align-items:center; justify-content:center;
                        flex-shrink:0; transition: all 0.2s;
                    ">
                        ${isCompleted ? '<span style="color:#fff; font-size:16px;">✓</span>' : ''}
                    </div>
                `;
            }
            
            // 截止时间显示（计划显示结束日期，待办显示日期）
            let timeDisplay = '';
            if (isPlan) {
                timeDisplay = `截止：${formatDateDisplay(item.endDate)}`;
            } else {
                timeDisplay = formatDateDisplay(dateStr);
            }
            
            return `
                <div class="pt-list-item" data-id="${item.id}" style="
                    display:flex; align-items:center; gap:12px;
                    padding:12px 14px; margin-bottom:8px;
                    background:var(--primary-bg); border-radius:10px;
                    border-left:4px solid ${item.primaryColor || 'var(--accent-color)'};
                    cursor:pointer; transition: all 0.2s;
                    position:relative;
                ">
                    <div style="flex:1; min-width:0;" class="pt-list-item-content">
                        <div style="font-size:14px; font-weight:600; color:var(--text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                            ${item.fullTitle}
                        </div>
                        <div style="display:flex; gap:12px; margin-top:4px; font-size:12px; color:var(--text-secondary);">
                            <span>${timeDisplay}</span>
                            <span style="color:${statusColor};">
                                ${statusIcon} ${statusLabel}
                            </span>
                        </div>
                    </div>
                    ${rightCheckbox}
                    <!-- 删除按钮 -->
                    <button class="pt-list-delete-btn" data-id="${item.id}" data-type="${type}" style="
                        background:#E74C3C; color:#fff; border:none; border-radius:8px;
                        padding:6px 14px; font-size:12px; font-weight:600; cursor:pointer;
                        opacity:0; transition: opacity 0.25s ease, transform 0.25s ease;
                        font-family:var(--font-family); flex-shrink:0;
                        transform: translateX(10px);
                    ">删除</button>
                </div>
            `;
        }).join('');
    }
    
    modal.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px; flex-shrink:0;">
            <div>
                <div style="font-size:18px; font-weight:700; color:var(--text-primary);">${titleText}</div>
                <div style="font-size:13px; color:var(--text-secondary); margin-top:2px;">${dateDisplay}</div>
            </div>
            <button id="pt-list-close-btn" style="
                background:none; border:none; color:var(--text-secondary);
                font-size:24px; cursor:pointer; padding:0 6px;
            ">✕</button>
        </div>
        
        <!-- 列表内容（滚动） -->
        <div style="flex:1; overflow-y:auto; padding-right:4px; margin-bottom:12px;">
            ${listHTML}
        </div>
        
        <!-- 底部按钮：新建 + 关闭 -->
        <div style="display:flex; gap:10px; flex-shrink:0; padding-top:12px; border-top:1px solid var(--border-color);">
            <button id="pt-list-new-btn" style="
                flex:1; padding:10px 0; border-radius:10px;
                border:none; background:var(--accent-color); color:#fff;
                font-size:14px; font-weight:600; cursor:pointer;
                font-family:var(--font-family);
                box-shadow: 0 2px 8px rgba(var(--accent-color-rgb),0.3);
            ">
                <i class="fas fa-plus" style="margin-right:6px;"></i>新建
            </button>
            <button id="pt-list-close-btn-bottom" style="
                flex:1; padding:10px 0; border-radius:10px;
                border:1.5px solid var(--border-color); background:transparent;
                color:var(--text-secondary); font-size:14px; font-weight:600;
                cursor:pointer; font-family:var(--font-family);
            ">关闭</button>
        </div>
    `;
    
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    
    // --- 事件绑定 ---
    const closeFn = () => { overlay.remove(); };
    
    // 关闭按钮
    document.getElementById('pt-list-close-btn').addEventListener('click', closeFn);
    document.getElementById('pt-list-close-btn-bottom').addEventListener('click', closeFn);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeFn(); });
    
    // 新建按钮
    document.getElementById('pt-list-new-btn').addEventListener('click', function() {
        closeFn();
        openCreateModal(dateStr);
    });
    
    // 列表项点击 → 三级详情页（排除删除按钮点击）
    modal.querySelectorAll('.pt-list-item').forEach(el => {
        // 点击内容区域进入详情
        const content = el.querySelector('.pt-list-item-content');
        if (content) {
            content.addEventListener('click', function(e) {
                e.stopPropagation();
                const parent = this.closest('.pt-list-item');
                const id = parent.dataset.id;
                // 查找条目获取类型
                const allData = getAllData();
                let foundType = '';
                let foundDate = '';
                for (const date in allData) {
                    const day = allData[date];
                    if (day.plans) {
                        const found = day.plans.find(p => p.id === id);
                        if (found) {
                            foundType = 'plan';
                            foundDate = date;
                            break;
                        }
                    }
                    if (day.todos) {
                        const found = day.todos.find(t => t.id === id);
                        if (found) {
                            foundType = 'todo';
                            foundDate = date;
                            break;
                        }
                    }
                }
                if (foundType) {
                    closeFn();
                    showPlanTodoDetail(id, foundType, foundDate);
                } else {
                    showToast('条目不存在', 'error');
                }
            });
        }
        
        // 删除按钮点击
        const deleteBtn = el.querySelector('.pt-list-delete-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                const id = this.dataset.id;
                const type = this.dataset.type;
                handleDeleteItem(id, type, closeFn, dateStr);
            });
        }
        
        // 移动端左滑支持
        let startX = 0;
        let isSwiping = false;
        el.addEventListener('touchstart', function(e) {
            startX = e.touches[0].clientX;
            isSwiping = true;
        }, { passive: true });
        
        el.addEventListener('touchmove', function(e) {
            if (!isSwiping) return;
            const deltaX = e.touches[0].clientX - startX;
            if (deltaX < -30) {
                this.classList.add('swiped');
                document.querySelectorAll('.pt-list-item.swiped').forEach(other => {
                    if (other !== this) other.classList.remove('swiped');
                });
                isSwiping = false;
            } else if (deltaX > 30) {
                this.classList.remove('swiped');
                isSwiping = false;
            }
        }, { passive: true });
        
        el.addEventListener('touchend', function() {
            isSwiping = false;
        }, { passive: true });
    });
}

// ============================================================
// 删除处理函数
// ============================================================
function handleDeleteItem(itemId, type, closeListFn, currentDateStr) {
    // 从存储中查找条目
    let targetItem = null;
    let targetDate = '';
    let targetType = type; // 'plan' 或 'todo'
    let targetDayData = null;
    
    const allData = getAllData();
    for (const date in allData) {
        const day = allData[date];
        if (type === 'plan' && day.plans) {
            const found = day.plans.find(p => p.id === itemId);
            if (found) {
                targetItem = found;
                targetDate = date;
                targetDayData = day;
                break;
            }
        } else if (type === 'todo' && day.todos) {
            const found = day.todos.find(t => t.id === itemId);
            if (found) {
                targetItem = found;
                targetDate = date;
                targetDayData = day;
                break;
            }
        }
    }
    
    if (!targetItem) {
        showToast('未找到该条目', 'error');
        return;
    }
    
    const isPlan = type === 'plan';
    const isRepeating = targetItem.isRepeating || false;
    const fullTitle = targetItem.fullTitle || `${targetItem.primaryLabel}.${targetItem.secondaryTitle}`;
    
    // ===== 计划：简单二次确认 =====
    if (isPlan) {
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed; inset: 0; z-index: 100004;
            display: flex; align-items: center; justify-content: center;
            background: rgba(0,0,0,0.5);
            backdrop-filter: blur(4px);
            padding: 12px;
        `;
        
        overlay.innerHTML = `
            <div style="background:var(--secondary-bg); border-radius:20px; padding:24px; max-width:340px; width:100%; border:1px solid var(--border-color);">
                <div style="font-size:18px; font-weight:700; margin-bottom:8px; text-align:center; color:var(--text-primary);">
                    ⚠️ 确认删除
                </div>
                <div style="font-size:13px; color:var(--text-secondary); margin-bottom:16px; text-align:center; line-height:1.8;">
                    确定要永久删除计划<br>
                    <strong style="color:var(--accent-color);">「${fullTitle}」</strong><br>
                    吗？此操作不可恢复。
                </div>
                <div style="display:flex; gap:10px;">
                    <button id="pt-delete-cancel" style="
                        flex:1; padding:10px 0; border-radius:10px;
                        border:1.5px solid var(--border-color); background:transparent;
                        color:var(--text-secondary); font-size:14px; font-weight:600;
                        cursor:pointer; font-family:var(--font-family);
                    ">取消</button>
                    <button id="pt-delete-confirm" style="
                        flex:2; padding:10px 0; border-radius:10px;
                        border:none; background:#E74C3C; color:#fff;
                        font-size:14px; font-weight:600; cursor:pointer;
                        font-family:var(--font-family);
                        box-shadow: 0 2px 8px rgba(231,76,60,0.3);
                    ">确认删除</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        
        overlay.querySelector('#pt-delete-cancel').addEventListener('click', function() {
            overlay.remove();
        });
        
        overlay.querySelector('#pt-delete-confirm').addEventListener('click', function() {
            // 执行删除：遍历所有日期，删除该计划的所有实例
            const allData = getAllData();
            for (const date in allData) {
                const day = allData[date];
                if (day.plans) {
                    day.plans = day.plans.filter(p => p.id !== itemId);
                }
            }
            saveAllData(allData);
            
            // 清理 meta 中对应的一级标题（如果没有其他条目使用）
            cleanupMeta('plan', targetItem.primaryLabel);
            
            overlay.remove();
            showToast(`已删除「${fullTitle}」`, 'success');
            
            // 关闭列表，刷新卡片
            if (closeListFn) closeListFn();
            const currentDate = document.querySelector('.calendar-day.selected');
            if (currentDate && typeof window.updatePlanTodoCards === 'function') {
                const day = currentDate.dataset.day;
                const month = currentDate.dataset.month;
                const year = currentDate.dataset.year;
                const dateStr = year + '-' + String(parseInt(month) + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0');
                window.updatePlanTodoCards(dateStr);
            }
        });
        
        overlay.addEventListener('click', function(e) {
            if (e.target === overlay) overlay.remove();
        });
        return;
    }
    
    // ===== 待办：判断是否重复 =====
    if (!isRepeating) {
        // 非重复待办：简单二次确认
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed; inset: 0; z-index: 100004;
            display: flex; align-items: center; justify-content: center;
            background: rgba(0,0,0,0.5);
            backdrop-filter: blur(4px);
            padding: 12px;
        `;
        
        overlay.innerHTML = `
            <div style="background:var(--secondary-bg); border-radius:20px; padding:24px; max-width:340px; width:100%; border:1px solid var(--border-color);">
                <div style="font-size:18px; font-weight:700; margin-bottom:8px; text-align:center; color:var(--text-primary);">
                    ⚠️ 确认删除
                </div>
                <div style="font-size:13px; color:var(--text-secondary); margin-bottom:16px; text-align:center; line-height:1.8;">
                    确定要永久删除待办<br>
                    <strong style="color:var(--accent-color);">「${fullTitle}」</strong><br>
                    吗？此操作不可恢复。
                </div>
                <div style="display:flex; gap:10px;">
                    <button id="pt-delete-cancel" style="
                        flex:1; padding:10px 0; border-radius:10px;
                        border:1.5px solid var(--border-color); background:transparent;
                        color:var(--text-secondary); font-size:14px; font-weight:600;
                        cursor:pointer; font-family:var(--font-family);
                    ">取消</button>
                    <button id="pt-delete-confirm" style="
                        flex:2; padding:10px 0; border-radius:10px;
                        border:none; background:#E74C3C; color:#fff;
                        font-size:14px; font-weight:600; cursor:pointer;
                        font-family:var(--font-family);
                        box-shadow: 0 2px 8px rgba(231,76,60,0.3);
                    ">确认删除</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        
        overlay.querySelector('#pt-delete-cancel').addEventListener('click', function() {
            overlay.remove();
        });
        
        overlay.querySelector('#pt-delete-confirm').addEventListener('click', function() {
            // 执行删除
            const allData = getAllData();
            for (const date in allData) {
                const day = allData[date];
                if (day.todos) {
                    day.todos = day.todos.filter(t => t.id !== itemId);
                }
            }
            saveAllData(allData);
            cleanupMeta('todo', targetItem.primaryLabel);
            
            overlay.remove();
            showToast(`已删除「${fullTitle}」`, 'success');
            
            if (closeListFn) closeListFn();
            const currentDate = document.querySelector('.calendar-day.selected');
            if (currentDate && typeof window.updatePlanTodoCards === 'function') {
                const day = currentDate.dataset.day;
                const month = currentDate.dataset.month;
                const year = currentDate.dataset.year;
                const dateStr = year + '-' + String(parseInt(month) + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0');
                window.updatePlanTodoCards(dateStr);
            }
        });
        
        overlay.addEventListener('click', function(e) {
            if (e.target === overlay) overlay.remove();
        });
        return;
    }
    
    // ===== 重复待办：三选一 =====
    const allInstances = getRepeatInstances(itemId, targetItem);
    const todayStr = getTodayStr();
    
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed; inset: 0; z-index: 100004;
        display: flex; align-items: center; justify-content: center;
        background: rgba(0,0,0,0.5);
        backdrop-filter: blur(4px);
        padding: 12px;
    `;
    
    overlay.innerHTML = `
        <div style="background:var(--secondary-bg); border-radius:20px; padding:24px; max-width:360px; width:100%; border:1px solid var(--border-color);">
            <div style="font-size:18px; font-weight:700; margin-bottom:8px; text-align:center; color:var(--text-primary);">
                ⚠️ 删除重复待办
            </div>
            <div style="font-size:13px; color:var(--text-secondary); margin-bottom:16px; text-align:center; line-height:1.6;">
                <strong style="color:var(--accent-color);">「${fullTitle}」</strong><br>
                这是一个重复待办，请选择删除范围：
            </div>
            <div style="display:flex; flex-direction:column; gap:8px; margin-bottom:16px;">
                <button id="pt-delete-option-today" style="
                    padding:12px 0; border-radius:10px;
                    border:1.5px solid var(--border-color); background:var(--primary-bg);
                    color:var(--text-primary); font-size:13px; font-weight:500; cursor:pointer;
                    font-family:var(--font-family); text-align:center; transition:all 0.2s;
                " onmouseover="this.style.borderColor='var(--accent-color)'" onmouseout="this.style.borderColor='var(--border-color)'">
                    📅 仅删除今天（${formatDateDisplay(todayStr)}）
                </button>
                <button id="pt-delete-option-future" style="
                    padding:12px 0; border-radius:10px;
                    border:1.5px solid var(--border-color); background:var(--primary-bg);
                    color:var(--text-primary); font-size:13px; font-weight:500; cursor:pointer;
                    font-family:var(--font-family); text-align:center; transition:all 0.2s;
                " onmouseover="this.style.borderColor='var(--accent-color)'" onmouseout="this.style.borderColor='var(--border-color)'">
                    📅 删除今天及以后所有实例
                </button>
                <button id="pt-delete-option-all" style="
                    padding:12px 0; border-radius:10px;
                    border:1.5px solid var(--border-color); background:var(--primary-bg);
                    color:var(--text-primary); font-size:13px; font-weight:500; cursor:pointer;
                    font-family:var(--font-family); text-align:center; transition:all 0.2s;
                " onmouseover="this.style.borderColor='var(--accent-color)'" onmouseout="this.style.borderColor='var(--border-color)'">
                    🗑️ 删除全部（所有历史及未来实例）
                </button>
            </div>
            <div style="display:flex; gap:10px;">
                <button id="pt-delete-cancel" style="
                    flex:1; padding:10px 0; border-radius:10px;
                    border:1.5px solid var(--border-color); background:transparent;
                    color:var(--text-secondary); font-size:14px; font-weight:600;
                    cursor:pointer; font-family:var(--font-family);
                ">取消</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
    
    // 取消
    overlay.querySelector('#pt-delete-cancel').addEventListener('click', function() {
        overlay.remove();
    });
    
    // 仅删除今天
    overlay.querySelector('#pt-delete-option-today').addEventListener('click', function() {
        const allData = getAllData();
        for (const date in allData) {
            const day = allData[date];
            if (day.todos) {
                if (date === todayStr) {
                    day.todos = day.todos.filter(t => t.id !== itemId);
                }
            }
        }
        saveAllData(allData);
        overlay.remove();
        showToast(`已删除今天的「${fullTitle}」`, 'success');
        if (closeListFn) closeListFn();
        refreshCards();
    });
    
    // 删除今天及以后
    overlay.querySelector('#pt-delete-option-future').addEventListener('click', function() {
        const allData = getAllData();
        for (const date in allData) {
            const day = allData[date];
            if (day.todos) {
                if (date >= todayStr) {
                    day.todos = day.todos.filter(t => t.id !== itemId);
                }
            }
        }
        saveAllData(allData);
        overlay.remove();
        showToast(`已删除「${fullTitle}」今天及以后的所有实例`, 'success');
        if (closeListFn) closeListFn();
        refreshCards();
    });
    
    // 删除全部
    overlay.querySelector('#pt-delete-option-all').addEventListener('click', function() {
        const allData = getAllData();
        for (const date in allData) {
            const day = allData[date];
            if (day.todos) {
                day.todos = day.todos.filter(t => t.id !== itemId);
            }
        }
        saveAllData(allData);
        cleanupMeta('todo', targetItem.primaryLabel);
        overlay.remove();
        showToast(`已删除「${fullTitle}」全部实例`, 'success');
        if (closeListFn) closeListFn();
        refreshCards();
    });
    
    overlay.addEventListener('click', function(e) {
        if (e.target === overlay) overlay.remove();
    });
}

// ============================================================
// 辅助：获取重复待办的所有实例
// ============================================================
function getRepeatInstances(itemId, targetItem) {
    const allData = getAllData();
    const instances = [];
    for (const date in allData) {
        const day = allData[date];
        if (day.todos) {
            const found = day.todos.find(t => t.id === itemId);
            if (found) {
                instances.push({ date: date, item: found });
            }
        }
    }
    return instances;
}

// ============================================================
// 辅助：清理 Meta 中无用的标题
// ============================================================
function cleanupMeta(type, primaryLabel) {
    if (!primaryLabel) return;
    const meta = getMeta();
    const list = meta[type] || [];
    // 检查该一级标题下是否还有条目
    const allData = getAllData();
    let hasEntry = false;
    for (const date in allData) {
        const day = allData[date];
        if (type === 'plan' && day.plans) {
            if (day.plans.some(p => p.primaryLabel === primaryLabel)) {
                hasEntry = true;
                break;
            }
        } else if (type === 'todo' && day.todos) {
            if (day.todos.some(t => t.primaryLabel === primaryLabel)) {
                hasEntry = true;
                break;
            }
        }
    }
    if (!hasEntry) {
        meta[type] = list.filter(item => item.name !== primaryLabel);
        saveMeta(meta);
    }
}

// ============================================================
// 辅助：刷新卡片
// ============================================================
function refreshCards() {
    const currentDate = document.querySelector('.calendar-day.selected');
    if (currentDate && typeof window.updatePlanTodoCards === 'function') {
        const day = currentDate.dataset.day;
        const month = currentDate.dataset.month;
        const year = currentDate.dataset.year;
        const dateStr = year + '-' + String(parseInt(month) + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0');
        window.updatePlanTodoCards(dateStr);
    }
}

// ============================================================
// 三级详情页
// ============================================================
function showPlanTodoDetail(recordId, type, dateStr) {
    // 从存储中查找真实条目
    let targetItem = null;
    let targetDate = '';
    let targetType = type || 'todo';
    
    const allData = getAllData();
    for (const date in allData) {
        const day = allData[date];
        if (day.plans) {
            const found = day.plans.find(p => p.id === recordId);
            if (found) {
                targetItem = found;
                targetDate = date;
                targetType = 'plan';
                break;
            }
        }
        if (day.todos) {
            const found = day.todos.find(t => t.id === recordId);
            if (found) {
                targetItem = found;
                targetDate = date;
                targetType = 'todo';
                break;
            }
        }
    }
    
    if (!targetItem) {
        showToast('未找到该条目', 'error');
        return;
    }
    
    const isPlan = targetType === 'plan';
    const todayStr = getTodayStr();

    // 构建模态框
    const overlay = document.createElement('div');
    overlay.id = 'pt-detail-overlay';
    overlay.style.cssText = `
        position: fixed; inset: 0; z-index: 100001;
        display: flex; align-items: center; justify-content: center;
        background: rgba(0,0,0,0.6);
        backdrop-filter: blur(8px);
        animation: companionToastIn 0.3s ease;
        padding: 12px;
        box-sizing: border-box;
        overflow-y: auto;
    `;

    const modal = document.createElement('div');
    modal.style.cssText = `
        background: var(--secondary-bg);
        max-width: 480px;
        width: 100%;
        max-height: 90vh;
        border-radius: 24px;
        padding: 20px 20px 16px;
        border: 1px solid var(--border-color);
        color: var(--text-primary);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        position: relative;
        box-shadow: 0 20px 60px rgba(0,0,0,0.5);
    `;

    // 计算状态
    const status = calculateItemStatus(targetItem);
    const statusColor = getStatusColor(status);
    const statusIcon = getStatusIcon(status);
    const statusLabel = getStatusLabel(status);

    // 判断按钮是否可用
    const isEditable = status !== '已过期' && status !== '已完成';
    const isPaused = targetItem.status === 'paused';
    const pauseRestartText = isPaused ? '重启' : '暂停';

    // 构建内容
    const titleText = isPlan ? '📅 计划' : '📋 今日待办';
    const dateDisplay = formatDateDisplay(targetItem.startDate);
    const timeRange = isPlan 
        ? `${formatDateDisplay(targetItem.startDate)} 至 ${formatDateDisplay(targetItem.endDate)}`
        : `${formatDateDisplay(targetItem.startDate)}（当天）`;

    // 第五行：待办显示重复规则，计划显示阶段进程
    let fifthRowHTML = '';
    if (isPlan) {
        // 计划：阶段进程（带完成方框）
        if (targetItem.stages && targetItem.stages.length > 0) {
            // 检查整体计划是否可操作
            const overallStatus = calculateItemStatus(targetItem);
            const isPlanEditable = overallStatus === '进行中';
            
            let stagesHTML = targetItem.stages.map((stage, idx) => {
                // 阶段状态
                let stageStatus = '未开始';
                let stageCompleted = stage.completed || false;
                
                if (stageCompleted) {
                    stageStatus = '已完成';
                } else {
                    stageStatus = calculateStageStatus(stage.start, stage.end);
                }
                
                const isCompleted = stageStatus === '已完成';
                const isExpired = stageStatus === '已过期';
                const isClickable = isPlanEditable && !isCompleted && !isExpired;
                
                const statusColor = getStageStatusColor(stageStatus);
                const statusLabel = getStageStatusLabel(stageStatus);
                
                const reward = targetItem.reward.stages && targetItem.reward.stages[idx] 
                    ? targetItem.reward.stages[idx] 
                    : { count: 0, color: '黑', noReward: true };
                const rewardText = reward.noReward || reward.count === 0 
                    ? '无' 
                    : `${reward.count}颗${reward.color}曜石`;
                
                return `
                    <div style="margin-top:6px; padding:8px 10px; background:var(--primary-bg); border-radius:8px; border-left:3px solid ${isCompleted ? '#3498DB' : isExpired ? '#E74C3C' : 'var(--accent-color)'}; display:flex; align-items:flex-start; gap:10px;">
                        <!-- 完成方框 -->
                        <div class="stage-checkbox" data-stage-index="${idx}" style="
                            width:24px; height:24px; border-radius:6px; 
                            border:2px solid ${isCompleted ? '#3498DB' : isExpired ? '#E74C3C' : 'var(--border-color)'};
                            background: ${isCompleted ? '#3498DB' : 'transparent'};
                            display:flex; align-items:center; justify-content:center;
                            flex-shrink:0; margin-top:2px;
                            cursor: ${isClickable ? 'pointer' : 'not-allowed'};
                            opacity: ${isClickable ? '1' : '0.6'};
                            transition: all 0.2s;
                        " ${!isClickable ? 'disabled' : ''}>
                            ${isCompleted ? '<span style="color:#fff; font-size:14px;">✓</span>' : ''}
                            ${isExpired ? '<span style="color:#E74C3C; font-size:12px;">✕</span>' : ''}
                        </div>
                        <div style="flex:1; min-width:0;">
                            <div style="font-weight:600; font-size:13px; color:var(--text-primary); display:flex; justify-content:space-between; align-items:center;">
                                <span>阶段 ${idx+1}</span>
                                <span style="font-size:11px; color:${statusColor}; font-weight:500;">
                                    ${statusLabel}
                                </span>
                            </div>
                            <div style="font-size:12px; color:var(--text-secondary);">${formatDateDisplay(stage.start)} 至 ${formatDateDisplay(stage.end)}</div>
                            ${stage.note ? `<div style="font-size:12px; color:var(--text-secondary); margin-top:2px;">${stage.note}</div>` : ''}
                            <div style="font-size:11px; color:var(--accent-color); margin-top:2px;">
                                🏆 奖励：${rewardText}
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
            
            fifthRowHTML = `
                <div style="font-size:13px; font-weight:600; color:var(--text-secondary); margin-bottom:4px;">📌 阶段进程</div>
                ${stagesHTML}
            `;
        } else {
            fifthRowHTML = `<div style="font-size:13px; color:var(--text-secondary); opacity:0.6;">无阶段拆分</div>`;
        }
    } else {
        // 待办：重复规则
        let repeatText = '无';
        if (targetItem.isRepeating) {
            if (targetItem.repeatType === 'daily') {
                repeatText = `每隔 ${targetItem.repeatInterval} 天重复`;
            } else if (targetItem.repeatType === 'weekly') {
                repeatText = `每周 ${targetItem.repeatDays.join('、')} 重复`;
            }
            if (targetItem.repeatEndDate) {
                repeatText += ` 至 ${formatDateDisplay(targetItem.repeatEndDate)}`;
            }
        }
        fifthRowHTML = `
            <div style="font-size:13px; font-weight:600; color:var(--text-secondary); margin-bottom:4px;">🔄 重复规则</div>
            <div style="font-size:13px; color:var(--text-primary);">${repeatText}</div>
        `;
    }

    // 奖励
    const rewardText = targetItem.noReward 
        ? '无奖励' 
        : `${targetItem.reward.total.count} 颗 ${targetItem.reward.total.color}曜石`;

    modal.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; flex-shrink:0;">
            <div style="font-size:20px; font-weight:700; display:flex; align-items:center; gap:8px;">
                <span>${titleText}</span>
            </div>
            <button id="pt-detail-close-btn" style="
                background:none; border:none; color:var(--text-secondary);
                font-size:24px; cursor:pointer; padding:0 6px;
            ">✕</button>
        </div>

        <!-- 第二行：日期 -->
        <div style="text-align:right; font-size:13px; color:var(--text-secondary); margin-bottom:10px;">
            ${dateDisplay}
        </div>

        <!-- 第三行：完整标题 -->
        <div style="font-size:18px; font-weight:700; color:var(--text-primary); margin-bottom:12px; word-break:break-word;">
            ${targetItem.fullTitle}
        </div>

        <!-- 第四行：时间 -->
        <div style="font-size:13px; color:var(--text-secondary); margin-bottom:12px; padding:8px 12px; background:var(--primary-bg); border-radius:8px;">
            🕐 ${timeRange}
        </div>

        <!-- 第五行：差异部分 -->
        <div style="margin-bottom:12px; padding:8px 12px; background:var(--primary-bg); border-radius:8px;">
            ${fifthRowHTML}
        </div>

        <!-- 第六行：奖励 -->
        <div style="font-size:13px; color:var(--text-secondary); margin-bottom:12px; padding:8px 12px; background:var(--primary-bg); border-radius:8px; display:flex; justify-content:space-between;">
            <span>🏆 完成奖励</span>
            <span style="font-weight:600; color:var(--accent-color);">${rewardText}</span>
        </div>

        <!-- 第七行：状态 -->
        <div style="font-size:13px; color:var(--text-secondary); margin-bottom:16px; padding:8px 12px; background:var(--primary-bg); border-radius:8px; display:flex; justify-content:space-between; align-items:center;">
            <span>📊 状态</span>
            <span style="font-weight:600; color:${statusColor};">
                ${statusIcon} ${statusLabel}
            </span>
        </div>

        <!-- 底部按键 -->
        <div style="display:flex; gap:8px; flex-shrink:0; padding-top:12px; border-top:1px solid var(--border-color);">
            <button class="pt-detail-action-btn" data-action="edit" ${!isEditable ? 'disabled style="opacity:0.4;cursor:not-allowed;"' : ''} style="
                flex:1; padding:10px 0; border-radius:10px;
                border:1.5px solid var(--border-color); background:transparent;
                color:var(--text-secondary); font-size:13px; font-weight:600;
                cursor:${!isEditable ? 'not-allowed' : 'pointer'}; font-family:var(--font-family);
                transition:all 0.2s;
            ">✏️ 修改</button>

            <button class="pt-detail-action-btn" data-action="pause" ${!isEditable ? 'disabled style="opacity:0.4;cursor:not-allowed;"' : ''} style="
                flex:1; padding:10px 0; border-radius:10px;
                border:1.5px solid var(--border-color); background:transparent;
                color:var(--text-secondary); font-size:13px; font-weight:600;
                cursor:${!isEditable ? 'not-allowed' : 'pointer'}; font-family:var(--font-family);
                transition:all 0.2s;
            ">${pauseRestartText}</button>

            <button class="pt-detail-action-btn" data-action="complete" ${!isEditable ? 'disabled style="opacity:0.4;cursor:not-allowed;"' : ''} style="
                flex:1; padding:10px 0; border-radius:10px;
                border:none; background:var(--accent-color);
                color:#fff; font-size:13px; font-weight:600;
                cursor:${!isEditable ? 'not-allowed' : 'pointer'}; font-family:var(--font-family);
                box-shadow:0 2px 8px rgba(var(--accent-color-rgb),0.3);
                transition:all 0.2s;
            ">✅ 已完成</button>
        </div>
    `;

    // ★★★ 阶段方框点击事件（必须放在 modal.innerHTML 之后，overlay.appendChild 之前） ★★★
    modal.querySelectorAll('.stage-checkbox').forEach(el => {
        el.addEventListener('click', function(e) {
            e.stopPropagation();
            // 检查是否可点击
            if (this.style.cursor === 'not-allowed' || this.hasAttribute('disabled')) {
                return;
            }
            const stageIndex = parseInt(this.dataset.stageIndex);
            handleStageComplete(targetItem.id, stageIndex);
        });
    });

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    
    const closeFn = () => { overlay.remove(); };
    document.getElementById('pt-detail-close-btn').addEventListener('click', closeFn);
    
    // 底部按键
    modal.querySelectorAll('.pt-detail-action-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const action = this.dataset.action;
            const label = this.textContent.trim();
            
            if (action === 'edit') {
                if (!isEditable) {
                    showToast('已过期或已完成的条目不可修改', 'warning');
                    return;
                }
                openEditModal(targetItem.id);
                closeFn();
                return;
            }
            
            if (action === 'pause') {
                if (!isEditable) {
                    showToast('已过期或已完成的条目不可操作', 'warning');
                    return;
                }
                handlePauseRestart(targetItem.id, targetItem);
                return;
            }
            
            if (action === 'complete') {
                if (!isEditable) {
                    showToast('已过期或已完成的条目不可操作', 'warning');
                    return;
                }
                const currentStatus = calculateItemStatus(targetItem);
                if (currentStatus !== '进行中') {
                    showToast('只有进行中的条目才能标记为已完成', 'warning');
                    return;
                }
                handleComplete(targetItem.id);
                return;
            }
            
            // 其他按键占位
            if (typeof showToast === 'function') {
                showToast(`🔧 「${label}」功能开发中，敬请期待 ✦`, 'info');
            } else {
                alert(`「${label}」功能开发中`);
            }
        });
    });
    
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeFn(); });
}
// ============================================================
// 状态计算函数（自然时间判定，延后半天）
// ============================================================

/**
 * 展开重复待办的所有实例日期
 * @param {Object} item - 待办条目
 * @returns {Array<string>} 日期数组 ['2026-08-18', '2026-08-21', ...]
 */
function expandRepeatDates(item) {
    if (!item.isRepeating) {
        return [item.startDate];
    }
    
    const dates = [];
    const start = new Date(item.startDate);
    const end = item.repeatEndDate ? new Date(item.repeatEndDate) : new Date(start);
    end.setFullYear(end.getFullYear() + 10); // 无结束日期默认10年
    
    const current = new Date(start);
    
    if (item.repeatType === 'daily') {
        // 按天数重复
        const interval = item.repeatInterval || 1;
        while (current <= end) {
            dates.push(formatDateStr(current));
            current.setDate(current.getDate() + interval);
        }
    } else if (item.repeatType === 'weekly') {
        // 按星期重复
        const weekdays = item.repeatDays || []; // ['一','二','三']
        const weekdayMap = { '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '日': 0 };
        const targetDays = weekdays.map(d => weekdayMap[d]).filter(d => d !== undefined);
        
        if (targetDays.length === 0) {
            // 如果没选任何星期，默认按开始日期
            return [item.startDate];
        }
        
        // 从开始日期开始，逐个检查
        const checkDate = new Date(start);
        // 最多检查2年，防止死循环
        const maxAttempts = 730;
        let attempts = 0;
        
        while (checkDate <= end && attempts < maxAttempts) {
            const dayOfWeek = checkDate.getDay(); // 0=周日
            if (targetDays.includes(dayOfWeek)) {
                dates.push(formatDateStr(checkDate));
            }
            checkDate.setDate(checkDate.getDate() + 1);
            attempts++;
        }
    }
    
    return dates.length > 0 ? dates : [item.startDate];
}

/**
 * 格式化日期为 YYYY-MM-DD
 */
function formatDateStr(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + d;
}

// 修改 calculateItemStatus 函数中的重复待办处理逻辑

/**
 * 计算条目在当前日期的状态（自然时间判定，延后半天）
 * @param {Object} item - 条目对象
 * @param {string} dateStr - 要查询的日期（可选，默认今天）
 * @returns {string} '未开始' | '进行中' | '已过期'
 */
function calculateItemStatus(item, dateStr) {
    // 如果已暂停，永远显示为「已暂停」
    if (item.status === 'paused') {
        return '已暂停';
    }
    
    const today = dateStr ? new Date(dateStr) : new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = formatDateStr(today);
    
    // 如果是重复待办，根据当前实例日期计算状态
    if (item.isRepeating) {
        const allDates = expandRepeatDates(item);
        
        // 1. 如果今天不在重复实例中，找最近的一个实例
        if (!allDates.includes(todayStr)) {
            // 查找今天之前最近的一个实例
            const beforeToday = allDates.filter(d => d < todayStr);
            if (beforeToday.length > 0) {
                const lastDate = beforeToday[beforeToday.length - 1];
                return calculateSingleInstanceStatus(item, lastDate);
            } else {
                // 今天之前没有实例，说明还没开始
                return '未开始';
            }
        } else {
            // 2. 今天在重复实例中，判断今天这个实例的状态
            return calculateSingleInstanceStatus(item, todayStr);
        }
    }
    
    // 非重复待办：使用原有逻辑
    const startDate = new Date(item.startDate);
    startDate.setHours(0, 0, 0, 0);
    
    const endDate = new Date(item.endDate || item.startDate);
    endDate.setHours(0, 0, 0, 0);
    
    // 延后半天：结束日期的次日中午12点
    const expireThreshold = new Date(endDate);
    expireThreshold.setDate(expireThreshold.getDate() + 1);
    expireThreshold.setHours(12, 0, 0, 0);
    
    const now = new Date();
    
    // 未开始：当前日期 < 开始日期
    if (now < startDate) {
        return '未开始';
    }
    
    // 进行中：当前日期 < 过期阈值
    if (now < expireThreshold) {
        return '进行中';
    }
    
    // 已过期：当前日期 >= 过期阈值
    return '已过期';
}

/**
 * 计算单个重复实例的状态
 * @param {Object} item - 待办条目
 * @param {string} instanceDate - 实例日期 (YYYY-MM-DD)
 * @returns {string} '未开始' | '进行中' | '已过期'
 */
function calculateSingleInstanceStatus(item, instanceDate) {
    const now = new Date();
    const instance = new Date(instanceDate);
    instance.setHours(0, 0, 0, 0);
    
    // 实例的过期阈值：当天 + 1天 + 半天（即次日中午12点）
    const expireThreshold = new Date(instance);
    expireThreshold.setDate(expireThreshold.getDate() + 1);
    expireThreshold.setHours(12, 0, 0, 0);
    
    // 如果当前日期 < 实例日期 → 未开始
    if (now < instance) {
        return '未开始';
    }
    
    // 如果当前日期 < 过期阈值 → 进行中
    if (now < expireThreshold) {
        return '进行中';
    }
    
    // 否则 → 已过期
    return '已过期';
}

// ============================================================
// 阶段状态计算（独立于计划整体状态）
// ============================================================
function calculateStageStatus(stageStart, stageEnd) {
    const now = new Date();
    const startDate = new Date(stageStart);
    startDate.setHours(0, 0, 0, 0);
    
    const endDate = new Date(stageEnd);
    endDate.setHours(0, 0, 0, 0);
    
    // 延后半天
    const expireThreshold = new Date(endDate);
    expireThreshold.setDate(expireThreshold.getDate() + 1);
    expireThreshold.setHours(12, 0, 0, 0);
    
    if (now < startDate) {
        return '未开始';
    }
    if (now < expireThreshold) {
        return '进行中';
    }
    return '已过期';
}

function getStageStatusLabel(status) {
    switch (status) {
        case '未开始': return '未开始';
        case '进行中': return '进行中';
        case '已完成': return '✅ 已完成';
        case '已过期': return '⚠️ 已过期';
        default: return '';
    }
}

function getStageStatusColor(status) {
    switch (status) {
        case '未开始': return '#95A5A6';
        case '进行中': return '#2ECC71';
        case '已完成': return '#3498DB';
        case '已过期': return '#E74C3C';
        default: return '#95A5A6';
    }
}

/**
 * 获取状态对应的颜色
 */
function getStatusLabel(status) {
    switch (status) {
        case '未开始': return '未开始';
        case '进行中': return '进行中';
        case '已过期': return '已过期';
        case '已暂停': return '已暂停';
        default: return '';
    }
}

function getStatusColor(status) {
    switch (status) {
        case '未开始': return '#95A5A6';
        case '进行中': return '#2ECC71';
        case '已过期': return '#E74C3C';
        case '已暂停': return '#F39C12';  // 橙色
        default: return '#95A5A6';
    }
}

function getStatusIcon(status) {
    switch (status) {
        case '未开始': return '⏳';
        case '进行中': return '●';
        case '已过期': return '⚠️';
        case '已暂停': return '⏸️';
        default: return '';
    }
}

// ============================================================
// 暂停/重启 处理函数
// ============================================================
function handlePauseRestart(itemId, mockItem) {
    // 从存储中查找真实条目
    let targetItem = null;
    let targetDate = '';
    let targetType = '';
    
    const allData = getAllData();
    for (const date in allData) {
        const day = allData[date];
        if (day.plans) {
            const found = day.plans.find(p => p.id === itemId);
            if (found) {
                targetItem = found;
                targetDate = date;
                targetType = 'plan';
                break;
            }
        }
        if (day.todos) {
            const found = day.todos.find(t => t.id === itemId);
            if (found) {
                targetItem = found;
                targetDate = date;
                targetType = 'todo';
                break;
            }
        }
    }
    
    if (!targetItem) {
        showToast('未找到该条目', 'error');
        return;
    }
    
    const currentStatus = calculateItemStatus(targetItem);
    const isPaused = targetItem.status === 'paused';
    
    // 如果当前是已暂停 → 重启
    if (isPaused) {
        // 弹出结束日期选择器
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed; inset: 0; z-index: 100003;
            display: flex; align-items: center; justify-content: center;
            background: rgba(0,0,0,0.5);
            backdrop-filter: blur(4px);
            padding: 12px;
        `;
        
        overlay.innerHTML = `
            <div style="background:var(--secondary-bg); border-radius:20px; padding:24px; max-width:340px; width:100%; border:1px solid var(--border-color);">
                <div style="font-size:18px; font-weight:700; margin-bottom:12px; text-align:center; color:var(--text-primary);">
                    🔄 重启计划/待办
                </div>
                <div style="font-size:13px; color:var(--text-secondary); margin-bottom:16px; text-align:center; line-height:1.6;">
                    请设置新的结束日期，系统将根据此日期重新判定状态。
                </div>
                <div style="margin-bottom:16px;">
                    <label style="font-size:12px; color:var(--text-secondary); display:block; margin-bottom:4px;">新的结束日期</label>
                    <input type="date" id="pt-restart-end-date" value="${getTodayStr()}" style="
                        width:100%; padding:10px 12px; border:1.5px solid var(--border-color);
                        border-radius:10px; background:var(--primary-bg); color:var(--text-primary);
                        font-size:14px; outline:none; font-family:var(--font-family);
                        box-sizing:border-box;
                    ">
                </div>
                <div style="display:flex; gap:10px;">
                    <button id="pt-restart-cancel" style="
                        flex:1; padding:10px 0; border-radius:10px;
                        border:1.5px solid var(--border-color); background:transparent;
                        color:var(--text-secondary); font-size:14px; font-weight:600;
                        cursor:pointer; font-family:var(--font-family);
                    ">取消</button>
                    <button id="pt-restart-confirm" style="
                        flex:2; padding:10px 0; border-radius:10px;
                        border:none; background:var(--accent-color); color:#fff;
                        font-size:14px; font-weight:600; cursor:pointer;
                        font-family:var(--font-family);
                        box-shadow: 0 2px 8px rgba(var(--accent-color-rgb),0.3);
                    ">确认重启</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        
        overlay.querySelector('#pt-restart-cancel').addEventListener('click', function() {
            overlay.remove();
        });
        
        overlay.querySelector('#pt-restart-confirm').addEventListener('click', function() {
            const newEndDate = document.getElementById('pt-restart-end-date').value;
            if (!newEndDate) {
                showToast('请选择结束日期', 'warning');
                return;
            }
            if (newEndDate < targetItem.startDate) {
                showToast('结束日期不能早于开始日期', 'warning');
                return;
            }
            
            // 更新存储
            targetItem.status = 'active';  // 恢复为进行中
            targetItem.endDate = newEndDate;
            targetItem.updatedAt = Date.now();
            
            const updatedData = getAllData();  // ← 改名
            for (const date in updatedData) {
                const day = updatedData[date];
                if (targetType === 'plan' && day.plans) {
                    const idx = day.plans.findIndex(p => p.id === itemId);
                    if (idx !== -1) {
                        day.plans[idx] = targetItem;
                        break;
                    }
                } else if (targetType === 'todo' && day.todos) {
                    const idx = day.todos.findIndex(t => t.id === itemId);
                    if (idx !== -1) {
                        day.todos[idx] = targetItem;
                        break;
                    }
                }
            }
            saveAllData(updatedData);
            
            showToast('✅ 已重启，结束日期已更新', 'success');
            overlay.remove();
            
            // 刷新详情页
            const detailOverlay = document.getElementById('pt-detail-overlay');
            if (detailOverlay) detailOverlay.remove();
            // 重新打开详情页
            showPlanTodoDetail(itemId, targetType, targetDate);
            
            // 刷新卡片
            const currentDate = document.querySelector('.calendar-day.selected');
            if (currentDate && typeof window.updatePlanTodoCards === 'function') {
                const day = currentDate.dataset.day;
                const month = currentDate.dataset.month;
                const year = currentDate.dataset.year;
                const dateStr = year + '-' + String(parseInt(month) + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0');
                window.updatePlanTodoCards(dateStr);
            }
        });
        
        overlay.addEventListener('click', function(e) {
            if (e.target === overlay) overlay.remove();
        });
        return;
    }
    
    // 当前不是已暂停 → 暂停
    if (currentStatus === '已过期' || currentStatus === '已完成') {
        showToast('已过期或已完成的条目不可暂停', 'warning');
        return;
    }
    
    // 确认暂停
    targetItem.status = 'paused';
    targetItem.updatedAt = Date.now();
    
    const updatedData = getAllData();  // ← 改名
    for (const date in updatedData) {
        const day = updatedData[date];
        if (targetType === 'plan' && day.plans) {
            const idx = day.plans.findIndex(p => p.id === itemId);
            if (idx !== -1) {
                day.plans[idx] = targetItem;
                break;
            }
        } else if (targetType === 'todo' && day.todos) {
            const idx = day.todos.findIndex(t => t.id === itemId);
            if (idx !== -1) {
                day.todos[idx] = targetItem;
                break;
            }
        }
    }
    saveAllData(updatedData);
    
    showToast('⏸️ 已暂停，结束日期已失效', 'info');
    
    // 刷新详情页
    const detailOverlay = document.getElementById('pt-detail-overlay');
    if (detailOverlay) detailOverlay.remove();
    showPlanTodoDetail(itemId, targetType, targetDate);
    
    // 刷新卡片
    const currentDate = document.querySelector('.calendar-day.selected');
    if (currentDate && typeof window.updatePlanTodoCards === 'function') {
        const day = currentDate.dataset.day;
        const month = currentDate.dataset.month;
        const year = currentDate.dataset.year;
        const dateStr = year + '-' + String(parseInt(month) + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0');
        window.updatePlanTodoCards(dateStr);
    }
}
// ============================================================
// 修改模态框
// ============================================================
function openEditModal(itemId) {
    // 从存储中查找条目
    let targetItem = null;
    let targetDate = '';
    let targetType = '';
    
    const allData = getAllData();
    for (const date in allData) {
        const day = allData[date];
        // 查找计划
        if (day.plans) {
            const found = day.plans.find(p => p.id === itemId);
            if (found) {
                targetItem = found;
                targetDate = date;
                targetType = 'plan';
                break;
            }
        }
        // 查找待办
        if (day.todos) {
            const found = day.todos.find(t => t.id === itemId);
            if (found) {
                targetItem = found;
                targetDate = date;
                targetType = 'todo';
                break;
            }
        }
    }
    
    if (!targetItem) {
        showToast('未找到该条目', 'error');
        return;
    }
    
    const isPlan = targetType === 'plan';
    
    // 构建模态框
    const overlay = document.createElement('div');
    overlay.id = 'pt-edit-overlay';
    overlay.style.cssText = `
        position: fixed; inset: 0; z-index: 100002;
        display: flex; align-items: center; justify-content: center;
        background: rgba(0,0,0,0.6);
        backdrop-filter: blur(8px);
        animation: companionToastIn 0.3s ease;
        padding: 12px;
        box-sizing: border-box;
        overflow-y: auto;
    `;
    
    const modal = document.createElement('div');
    modal.style.cssText = `
        background: var(--secondary-bg);
        max-width: 560px;
        width: 100%;
        max-height: 90vh;
        border-radius: 24px;
        padding: 20px 20px 16px;
        border: 1px solid var(--border-color);
        color: var(--text-primary);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        position: relative;
        box-shadow: 0 20px 60px rgba(0,0,0,0.5);
    `;
    
    // 构建可编辑内容
    let editHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; flex-shrink:0;">
            <div style="font-size:20px; font-weight:700; display:flex; align-items:center; gap:8px;">
                <i class="fas fa-edit" style="color:var(--accent-color);"></i>
                <span>修改 ${isPlan ? '计划' : '待办'}</span>
            </div>
            <button id="pt-edit-close-btn" style="
                background:none; border:none; color:var(--text-secondary);
                font-size:24px; cursor:pointer; padding:0 6px;
            ">✕</button>
        </div>
        
        <!-- 标题（只读） -->
        <div style="margin-bottom:12px; padding:10px 14px; background:var(--primary-bg); border-radius:10px;">
            <div style="font-size:11px; color:var(--text-secondary); margin-bottom:4px;">标题（不可修改）</div>
            <div style="font-size:16px; font-weight:600; color:var(--text-primary);">${targetItem.fullTitle}</div>
        </div>
    `;
    
    if (isPlan) {
        // ===== 计划修改 =====
        editHTML += `
            <!-- 结束日期 -->
            <div style="margin-bottom:12px;">
                <label style="font-size:12px; color:var(--text-secondary); display:block; margin-bottom:4px;">结束日期</label>
                <input type="date" id="pt-edit-plan-end" value="${targetItem.endDate}" style="
                    width:100%; padding:8px 10px; border:1.5px solid var(--border-color);
                    border-radius:10px; background:var(--primary-bg); color:var(--text-primary);
                    font-size:13px; outline:none; font-family:var(--font-family);
                    box-sizing:border-box;
                ">
            </div>
            
            <!-- 阶段管理 -->
            <div style="margin-bottom:12px; border-top:1px dashed var(--border-color); padding-top:10px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                    <span style="font-size:12px; color:var(--text-secondary); font-weight:500;">📌 阶段拆分</span>
                    <button id="pt-edit-add-stage-btn" style="
                        padding:4px 14px; border:none; border-radius:8px;
                        background:rgba(var(--accent-color-rgb),0.15); color:var(--accent-color);
                        font-size:12px; font-weight:600; cursor:pointer;
                        font-family:var(--font-family);
                    ">+ 添加阶段</button>
                </div>
                <div id="pt-edit-stage-list" style="display:flex; flex-direction:column; gap:6px;">
                    ${targetItem.stages && targetItem.stages.length > 0 ? targetItem.stages.map((stage, idx) => `
                        <div style="background:var(--primary-bg); border-radius:8px; padding:8px 10px; border:1px solid var(--border-color);">
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                                <span style="font-size:11px; font-weight:600; color:var(--text-secondary);">阶段 ${idx+1}</span>
                                <button class="pt-edit-remove-stage" data-index="${idx}" style="
                                    background:none; border:none; color:var(--text-secondary); cursor:pointer;
                                    font-size:12px; padding:0 4px; opacity:0.5;
                                ">✕</button>
                            </div>
                            <div style="display:flex; gap:6px; margin-bottom:4px;">
                                <input type="date" value="${stage.start}" class="pt-edit-stage-start" data-index="${idx}" style="
                                    flex:1; padding:4px 6px; border:1px solid var(--border-color);
                                    border-radius:6px; background:var(--primary-bg); color:var(--text-primary);
                                    font-size:11px; outline:none; font-family:var(--font-family);
                                ">
                                <span style="font-size:11px; color:var(--text-secondary); display:flex; align-items:center;">~</span>
                                <input type="date" value="${stage.end}" class="pt-edit-stage-end" data-index="${idx}" style="
                                    flex:1; padding:4px 6px; border:1px solid var(--border-color);
                                    border-radius:6px; background:var(--primary-bg); color:var(--text-primary);
                                    font-size:11px; outline:none; font-family:var(--font-family);
                                ">
                            </div>
                            <input type="text" placeholder="阶段说明（选填）" value="${stage.note || ''}" class="pt-edit-stage-note" data-index="${idx}" style="
                                width:100%; padding:4px 8px; border:1px solid var(--border-color);
                                border-radius:6px; background:var(--primary-bg); color:var(--text-primary);
                                font-size:11px; outline:none; font-family:var(--font-family);
                                box-sizing:border-box;
                            ">
                        </div>
                    `).join('') : `
                        <div style="font-size:12px; color:var(--text-secondary); opacity:0.5; text-align:center; padding:8px 0;">暂无阶段</div>
                    `}
                </div>
            </div>
        `;
    } else {
        // ===== 待办修改 =====
        const isRepeating = targetItem.isRepeating || false;
        const repeatType = targetItem.repeatType || 'weekly';
        const repeatDays = targetItem.repeatDays || [];
        const repeatInterval = targetItem.repeatInterval || 1;
        const repeatEndDate = targetItem.repeatEndDate || '';
        
        editHTML += `
            <!-- 是否重复 -->
            <div style="margin-bottom:10px;">
                <label style="display:flex; align-items:center; gap:8px; cursor:pointer; font-size:13px; color:var(--text-secondary);">
                    <input type="checkbox" id="pt-edit-repeat-toggle" ${isRepeating ? 'checked' : ''} style="width:16px;height:16px;accent-color:var(--accent-color);">
                    重复
                </label>
            </div>
            
            <div id="pt-edit-repeat-detail" style="${isRepeating ? 'display:block' : 'display:none'}; padding:10px 12px; background:var(--primary-bg); border-radius:10px; margin-bottom:10px;">
                <div style="display:flex; gap:12px; margin-bottom:8px;">
                    <label style="font-size:12px; color:var(--text-secondary); display:flex; align-items:center; gap:4px; cursor:pointer;">
                        <input type="radio" name="pt-edit-repeat-type" value="weekly" ${repeatType === 'weekly' ? 'checked' : ''}> 按星期
                    </label>
                    <label style="font-size:12px; color:var(--text-secondary); display:flex; align-items:center; gap:4px; cursor:pointer;">
                        <input type="radio" name="pt-edit-repeat-type" value="daily" ${repeatType === 'daily' ? 'checked' : ''}> 按天数
                    </label>
                </div>
                
                <div id="pt-edit-repeat-weekly" style="display:${repeatType === 'weekly' ? 'flex' : 'none'}; gap:4px; flex-wrap:wrap;">
                    ${['一','二','三','四','五','六','日'].map(d => `
                        <label style="font-size:12px; color:var(--text-secondary); display:flex; align-items:center; gap:3px; cursor:pointer; padding:2px 6px; background:rgba(var(--border-color),0.3); border-radius:6px;">
                            <input type="checkbox" value="${d}" ${repeatDays.includes(d) ? 'checked' : ''} style="width:14px;height:14px;accent-color:var(--accent-color);"> ${d}
                        </label>
                    `).join('')}
                </div>
                
                <div id="pt-edit-repeat-daily" style="display:${repeatType === 'daily' ? 'flex' : 'none'}; align-items:center; gap:6px; margin-top:4px;">
                    <span style="font-size:12px; color:var(--text-secondary);">每隔</span>
                    <input type="number" id="pt-edit-repeat-interval" value="${repeatInterval}" min="1" max="30" style="
                        width:50px; padding:4px 6px; border:1px solid var(--border-color);
                        border-radius:6px; background:var(--primary-bg); color:var(--text-primary);
                        font-size:13px; text-align:center; outline:none;
                    ">
                    <span style="font-size:12px; color:var(--text-secondary);">天</span>
                </div>
                
                <div style="display:flex; gap:8px; margin-top:8px; border-top:1px solid var(--border-color); padding-top:8px;">
                    <div style="flex:1;">
                        <label style="font-size:11px; color:var(--text-secondary); display:block; margin-bottom:3px;">开始日期（不可修改）</label>
                        <input type="date" value="${targetItem.startDate}" disabled style="
                            width:100%; padding:6px 8px; border:1.5px solid var(--border-color);
                            border-radius:8px; background:var(--primary-bg); color:var(--text-secondary);
                            font-size:12px; outline:none; font-family:var(--font-family);
                            box-sizing:border-box; opacity:0.6;
                        ">
                    </div>
                    <div style="flex:1;">
                        <label style="font-size:11px; color:var(--text-secondary); display:block; margin-bottom:3px;">结束日期（选填）</label>
                        <input type="date" id="pt-edit-repeat-end" value="${repeatEndDate}" style="
                            width:100%; padding:6px 8px; border:1.5px solid var(--border-color);
                            border-radius:8px; background:var(--primary-bg); color:var(--text-primary);
                            font-size:12px; outline:none; font-family:var(--font-family);
                            box-sizing:border-box;
                        ">
                    </div>
                </div>
            </div>
        `;
    }
    
    editHTML += `
        <!-- 底部按钮 -->
        <div style="display:flex; gap:10px; flex-shrink:0; padding-top:12px; border-top:1px solid var(--border-color);">
            <button id="pt-edit-cancel-btn" style="
                flex:1; padding:11px 0; border-radius:12px;
                border:1.5px solid var(--border-color); background:transparent;
                color:var(--text-secondary); font-size:15px; font-weight:600;
                cursor:pointer; font-family:var(--font-family);
            ">取消</button>
            <button id="pt-edit-save-btn" style="
                flex:2; padding:11px 0; border-radius:12px;
                border:none; background:var(--accent-color); color:#fff;
                font-size:15px; font-weight:600; cursor:pointer;
                font-family:var(--font-family);
                box-shadow: 0 2px 10px rgba(var(--accent-color-rgb),0.3);
            ">💾 保存修改</button>
        </div>
    `;
    
    modal.innerHTML = editHTML;
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    document.getElementById('pt-edit-close-btn').addEventListener('click', closeFn);
    document.getElementById('pt-edit-cancel-btn').addEventListener('click', closeFn);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeFn(); });
    
    if (isPlan) {
        // 计划：阶段增删改
        let editStages = targetItem.stages ? targetItem.stages.map(s => ({ ...s })) : [];
        
        function renderEditStages() {
            const container = document.getElementById('pt-edit-stage-list');
            if (!container) return;
            
            if (editStages.length === 0) {
                container.innerHTML = `<div style="font-size:12px; color:var(--text-secondary); opacity:0.5; text-align:center; padding:8px 0;">暂无阶段</div>`;
                return;
            }
            
            container.innerHTML = editStages.map((stage, idx) => `
                <div style="background:var(--primary-bg); border-radius:8px; padding:8px 10px; border:1px solid var(--border-color);">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                        <span style="font-size:11px; font-weight:600; color:var(--text-secondary);">阶段 ${idx+1}</span>
                        <button class="pt-edit-remove-stage" data-index="${idx}" style="
                            background:none; border:none; color:var(--text-secondary); cursor:pointer;
                            font-size:12px; padding:0 4px; opacity:0.5;
                        ">✕</button>
                    </div>
                    <div style="display:flex; gap:6px; margin-bottom:4px;">
                        <input type="date" value="${stage.start}" class="pt-edit-stage-start" data-index="${idx}" style="
                            flex:1; padding:4px 6px; border:1px solid var(--border-color);
                            border-radius:6px; background:var(--primary-bg); color:var(--text-primary);
                            font-size:11px; outline:none; font-family:var(--font-family);
                        ">
                        <span style="font-size:11px; color:var(--text-secondary); display:flex; align-items:center;">~</span>
                        <input type="date" value="${stage.end}" class="pt-edit-stage-end" data-index="${idx}" style="
                            flex:1; padding:4px 6px; border:1px solid var(--border-color);
                            border-radius:6px; background:var(--primary-bg); color:var(--text-primary);
                            font-size:11px; outline:none; font-family:var(--font-family);
                        ">
                    </div>
                    <input type="text" placeholder="阶段说明（选填）" value="${stage.note || ''}" class="pt-edit-stage-note" data-index="${idx}" style="
                        width:100%; padding:4px 8px; border:1px solid var(--border-color);
                        border-radius:6px; background:var(--primary-bg); color:var(--text-primary);
                        font-size:11px; outline:none; font-family:var(--font-family);
                        box-sizing:border-box;
                    ">
                </div>
            `).join('');
            
            // 绑定删除事件
            container.querySelectorAll('.pt-edit-remove-stage').forEach(btn => {
                btn.addEventListener('click', function() {
                    const idx = parseInt(this.dataset.index);
                    editStages.splice(idx, 1);
                    renderEditStages();
                });
            });
            
            // 绑定修改事件
            container.querySelectorAll('.pt-edit-stage-start').forEach(input => {
                input.addEventListener('change', function() {
                    const idx = parseInt(this.dataset.index);
                    editStages[idx].start = this.value;
                });
            });
            container.querySelectorAll('.pt-edit-stage-end').forEach(input => {
                input.addEventListener('change', function() {
                    const idx = parseInt(this.dataset.index);
                    editStages[idx].end = this.value;
                });
            });
            container.querySelectorAll('.pt-edit-stage-note').forEach(input => {
                input.addEventListener('input', function() {
                    const idx = parseInt(this.dataset.index);
                    editStages[idx].note = this.value;
                });
            });
        }
        
        renderEditStages();
        
        // 添加阶段
        document.getElementById('pt-edit-add-stage-btn').addEventListener('click', function() {
            const planStart = document.getElementById('pt-edit-plan-end')?.value || getTodayStr();
            editStages.push({
                start: planStart,
                end: planStart,
                note: ''
            });
            renderEditStages();
        });
        
        // 保存计划修改
        document.getElementById('pt-edit-save-btn').addEventListener('click', function() {
            const newEndDate = document.getElementById('pt-edit-plan-end').value;
            if (!newEndDate) {
                showToast('请填写结束日期', 'warning');
                return;
            }
            if (newEndDate < targetItem.startDate) {
                showToast('结束日期不能早于开始日期', 'warning');
                return;
            }
            
            // 验证阶段
            for (const stage of editStages) {
                if (!stage.start || !stage.end) continue;
                if (stage.start < targetItem.startDate || stage.end > newEndDate || stage.start > stage.end) {
                    showToast('阶段起止时间超出整体范围或顺序有误', 'warning');
                    return;
                }
            }
            
            // 保存到存储
            const allData = getAllData();
            let found = false;
            for (const date in allData) {
                const day = allData[date];
                if (day.plans) {
                    const idx = day.plans.findIndex(p => p.id === targetItem.id);
                    if (idx !== -1) {
                        day.plans[idx].endDate = newEndDate;
                        day.plans[idx].stages = editStages;
                        day.plans[idx].updatedAt = Date.now();
                        found = true;
                        break;
                    }
                }
            }
            
            if (found) {
                saveAllData(allData);
                showToast('✅ 修改已保存！', 'success');
                closeFn();
                // 刷新卡片
                const currentDate = document.querySelector('.calendar-day.selected');
                if (currentDate && typeof window.updatePlanTodoCards === 'function') {
                    const day = currentDate.dataset.day;
                    const month = currentDate.dataset.month;
                    const year = currentDate.dataset.year;
                    const dateStr = year + '-' + String(parseInt(month) + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0');
                    window.updatePlanTodoCards(dateStr);
                }
            } else {
                showToast('保存失败，未找到条目', 'error');
            }
        });
        
    } else {
        // ===== 待办修改 =====
        // 重复开关
        const repeatToggle = document.getElementById('pt-edit-repeat-toggle');
        const repeatDetail = document.getElementById('pt-edit-repeat-detail');
        
        repeatToggle.addEventListener('change', function() {
            repeatDetail.style.display = this.checked ? 'block' : 'none';
        });
        
        // 重复方式切换
        const repeatRadios = document.querySelectorAll('input[name="pt-edit-repeat-type"]');
        repeatRadios.forEach(radio => {
            radio.addEventListener('change', function() {
                const weekly = document.getElementById('pt-edit-repeat-weekly');
                const daily = document.getElementById('pt-edit-repeat-daily');
                if (this.value === 'weekly') {
                    weekly.style.display = 'flex';
                    daily.style.display = 'none';
                } else {
                    weekly.style.display = 'none';
                    daily.style.display = 'flex';
                }
            });
        });
        
        // 保存待办修改
        document.getElementById('pt-edit-save-btn').addEventListener('click', function() {
            const isRepeating = repeatToggle.checked;
            let repeatType = 'weekly';
            let repeatDays = [];
            let repeatInterval = 1;
            let repeatEndDate = '';
            
            if (isRepeating) {
                const radios = document.querySelectorAll('input[name="pt-edit-repeat-type"]');
                radios.forEach(r => { if (r.checked) repeatType = r.value; });
                
                if (repeatType === 'weekly') {
                    const checkboxes = document.querySelectorAll('#pt-edit-repeat-weekly input[type="checkbox"]:checked');
                    repeatDays = Array.from(checkboxes).map(cb => cb.value);
                    if (repeatDays.length === 0) {
                        showToast('请至少选择一个星期几', 'warning');
                        return;
                    }
                } else {
                    const intervalEl = document.getElementById('pt-edit-repeat-interval');
                    repeatInterval = parseInt(intervalEl?.value) || 1;
                    if (repeatInterval < 1) {
                        showToast('间隔天数至少为1', 'warning');
                        return;
                    }
                }
                
                const endEl = document.getElementById('pt-edit-repeat-end');
                repeatEndDate = endEl?.value || '';
                if (repeatEndDate && repeatEndDate < targetItem.startDate) {
                    showToast('结束日期不能早于开始日期', 'warning');
                    return;
                }
            }
            
            // 保存到存储
            const allData = getAllData();
            let found = false;
            for (const date in allData) {
                const day = allData[date];
                if (day.todos) {
                    const idx = day.todos.findIndex(t => t.id === targetItem.id);
                    if (idx !== -1) {
                        day.todos[idx].isRepeating = isRepeating;
                        day.todos[idx].repeatType = repeatType;
                        day.todos[idx].repeatDays = repeatDays;
                        day.todos[idx].repeatInterval = repeatInterval;
                        day.todos[idx].repeatEndDate = repeatEndDate;
                        day.todos[idx].updatedAt = Date.now();
                        found = true;
                        break;
                    }
                }
            }
            
            if (found) {
                saveAllData(allData);
                showToast('✅ 修改已保存！', 'success');
                closeFn();
                const currentDate = document.querySelector('.calendar-day.selected');
                if (currentDate && typeof window.updatePlanTodoCards === 'function') {
                    const day = currentDate.dataset.day;
                    const month = currentDate.dataset.month;
                    const year = currentDate.dataset.year;
                    const dateStr = year + '-' + String(parseInt(month) + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0');
                    window.updatePlanTodoCards(dateStr);
                }
            } else {
                showToast('保存失败，未找到条目', 'error');
            }
        });
    }
}
// ============================================================
// 已完成 处理函数
// ============================================================
function handleComplete(itemId) {
    // 从存储中查找条目
    let targetItem = null;
    let targetDate = '';
    let targetType = '';
    
    const allData = getAllData();
    for (const date in allData) {
        const day = allData[date];
        if (day.plans) {
            const found = day.plans.find(p => p.id === itemId);
            if (found) {
                targetItem = found;
                targetDate = date;
                targetType = 'plan';
                break;
            }
        }
        if (day.todos) {
            const found = day.todos.find(t => t.id === itemId);
            if (found) {
                targetItem = found;
                targetDate = date;
                targetType = 'todo';
                break;
            }
        }
    }
    
    if (!targetItem) {
        showToast('未找到该条目', 'error');
        return;
    }
    
    // 二次确认
    const fullTitle = targetItem.fullTitle || `${targetItem.primaryLabel}.${targetItem.secondaryTitle}`;
    const rewardText = targetItem.noReward 
        ? '无奖励' 
        : `${targetItem.reward.total.count} 颗 ${targetItem.reward.total.color}曜石`;
    
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed; inset: 0; z-index: 100003;
        display: flex; align-items: center; justify-content: center;
        background: rgba(0,0,0,0.5);
        backdrop-filter: blur(4px);
        padding: 12px;
    `;
    
    overlay.innerHTML = `
        <div style="background:var(--secondary-bg); border-radius:20px; padding:24px; max-width:340px; width:100%; border:1px solid var(--border-color);">
            <div style="font-size:18px; font-weight:700; margin-bottom:8px; text-align:center; color:var(--text-primary);">
                ✅ 确认完成
            </div>
            <div style="font-size:13px; color:var(--text-secondary); margin-bottom:16px; text-align:center; line-height:1.8;">
                确定要将 <strong style="color:var(--accent-color);">「${fullTitle}」</strong><br>
                标记为已完成吗？
            </div>
            <div style="font-size:12px; color:var(--text-secondary); text-align:center; margin-bottom:16px; padding:8px; background:var(--primary-bg); border-radius:8px;">
                🏆 奖励：${rewardText}
            </div>
            <div style="display:flex; gap:10px;">
                <button id="pt-complete-cancel" style="
                    flex:1; padding:10px 0; border-radius:10px;
                    border:1.5px solid var(--border-color); background:transparent;
                    color:var(--text-secondary); font-size:14px; font-weight:600;
                    cursor:pointer; font-family:var(--font-family);
                ">取消</button>
                <button id="pt-complete-confirm" style="
                    flex:2; padding:10px 0; border-radius:10px;
                    border:none; background:var(--accent-color); color:#fff;
                    font-size:14px; font-weight:600; cursor:pointer;
                    font-family:var(--font-family);
                    box-shadow: 0 2px 8px rgba(var(--accent-color-rgb),0.3);
                ">✅ 确认完成</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
    
    overlay.querySelector('#pt-complete-cancel').addEventListener('click', function() {
        overlay.remove();
    });
    
    overlay.querySelector('#pt-complete-confirm').addEventListener('click', function() {
        // 更新状态
        targetItem.status = 'completed';
        targetItem.updatedAt = Date.now();
        
    const updatedData = getAllData();
    for (const date in updatedData) {
        const day = updatedData[date];
            if (targetType === 'plan' && day.plans) {
                const idx = day.plans.findIndex(p => p.id === itemId);
                if (idx !== -1) {
                    day.plans[idx] = targetItem;
                    break;
                }
            } else if (targetType === 'todo' && day.todos) {
                const idx = day.todos.findIndex(t => t.id === itemId);
                if (idx !== -1) {
                    day.todos[idx] = targetItem;
                    break;
                }
            }
        }
saveAllData(updatedData);

// ★ 触发奖励统计更新事件
document.dispatchEvent(new CustomEvent('planTodoCompleted', {
    detail: {
        type: targetType,
        id: itemId,
        fullTitle: fullTitle,
        reward: targetItem.reward
    }
}));

overlay.remove();

// 弹出完成通知
const rewardMsg = targetItem.noReward 
    ? '无奖励' 
    : `🏆 已发放 ${targetItem.reward.total.count} 颗 ${targetItem.reward.total.color}曜石！`;

showToast(`✅ 已完成「${fullTitle}」！${rewardMsg}`, 'success');
        
        // 刷新详情页
        const detailOverlay = document.getElementById('pt-detail-overlay');
        if (detailOverlay) detailOverlay.remove();
        showPlanTodoDetail(itemId, targetType, targetDate);
        
        // 刷新卡片
        const currentDate = document.querySelector('.calendar-day.selected');
        if (currentDate && typeof window.updatePlanTodoCards === 'function') {
            const day = currentDate.dataset.day;
            const month = currentDate.dataset.month;
            const year = currentDate.dataset.year;
            const dateStr = year + '-' + String(parseInt(month) + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0');
            window.updatePlanTodoCards(dateStr);
        }
    });
    
    overlay.addEventListener('click', function(e) {
        if (e.target === overlay) overlay.remove();
    });
}

// ============================================================
// 阶段完成处理函数
// ============================================================
function handleStageComplete(itemId, stageIndex) {
    // 从存储中查找条目
    let targetItem = null;
    let targetDate = '';
    let targetType = '';
    
    const allData = getAllData();
    for (const date in allData) {
        const day = allData[date];
        if (day.plans) {
            const found = day.plans.find(p => p.id === itemId);
            if (found) {
                targetItem = found;
                targetDate = date;
                targetType = 'plan';
                break;
            }
        }
    }
    
    if (!targetItem) {
        showToast('未找到该条目', 'error');
        return;
    }
    
    // 检查阶段是否存在
    if (!targetItem.stages || stageIndex >= targetItem.stages.length) {
        showToast('阶段不存在', 'error');
        return;
    }
    
    // 检查阶段是否已完成
    if (targetItem.stages[stageIndex].completed) {
        showToast('该阶段已完成，不可重复操作', 'warning');
        return;
    }
    
    // 检查整体计划状态
    const overallStatus = calculateItemStatus(targetItem);
    if (overallStatus !== '进行中') {
        showToast('计划当前状态为「' + overallStatus + '」，不可操作阶段', 'warning');
        return;
    }
    
    const stage = targetItem.stages[stageIndex];
    
    // 检查阶段是否已过期
    const stageStatus = calculateStageStatus(stage.start, stage.end);
    if (stageStatus === '已过期') {
        showToast('该阶段已过期，无法标记完成', 'warning');
        return;
    }
    
    // 二次确认
    const fullTitle = targetItem.fullTitle || `${targetItem.primaryLabel}.${targetItem.secondaryTitle}`;
    const stageName = `阶段 ${stageIndex + 1}`;
    const reward = targetItem.reward.stages && targetItem.reward.stages[stageIndex] 
        ? targetItem.reward.stages[stageIndex] 
        : { count: 0, color: '黑', noReward: true };
    const rewardText = reward.noReward || reward.count === 0 
        ? '无奖励' 
        : `${reward.count} 颗 ${reward.color}曜石`;
    
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed; inset: 0; z-index: 100006;
        display: flex; align-items: center; justify-content: center;
        background: rgba(0,0,0,0.5);
        backdrop-filter: blur(4px);
        padding: 12px;
    `;
    
    overlay.innerHTML = `
        <div style="background:var(--secondary-bg); border-radius:20px; padding:24px; max-width:340px; width:100%; border:1px solid var(--border-color);">
            <div style="font-size:18px; font-weight:700; margin-bottom:8px; text-align:center; color:var(--text-primary);">
                ✅ 确认阶段完成
            </div>
            <div style="font-size:13px; color:var(--text-secondary); margin-bottom:16px; text-align:center; line-height:1.8;">
                确定要将 <strong style="color:var(--accent-color);">「${fullTitle}」</strong><br>
                的 <strong>${stageName}</strong> 标记为已完成吗？
            </div>
            <div style="font-size:12px; color:var(--text-secondary); text-align:center; margin-bottom:16px; padding:8px; background:var(--primary-bg); border-radius:8px;">
                🏆 奖励：${rewardText}
            </div>
            <div style="display:flex; gap:10px;">
                <button id="pt-stage-complete-cancel" style="
                    flex:1; padding:10px 0; border-radius:10px;
                    border:1.5px solid var(--border-color); background:transparent;
                    color:var(--text-secondary); font-size:14px; font-weight:600;
                    cursor:pointer; font-family:var(--font-family);
                ">取消</button>
                <button id="pt-stage-complete-confirm" style="
                    flex:2; padding:10px 0; border-radius:10px;
                    border:none; background:var(--accent-color); color:#fff;
                    font-size:14px; font-weight:600; cursor:pointer;
                    font-family:var(--font-family);
                    box-shadow: 0 2px 8px rgba(var(--accent-color-rgb),0.3);
                ">✅ 确认完成</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
    
    overlay.querySelector('#pt-stage-complete-cancel').addEventListener('click', function() {
        overlay.remove();
    });
    
    overlay.querySelector('#pt-stage-complete-confirm').addEventListener('click', function() {
        // 标记阶段为已完成
        targetItem.stages[stageIndex].completed = true;
        targetItem.stages[stageIndex].completedAt = Date.now();
        targetItem.updatedAt = Date.now();
        
        // 保存到存储
        const allData = getAllData();
        for (const date in allData) {
            const day = allData[date];
            if (day.plans) {
                const idx = day.plans.findIndex(p => p.id === itemId);
                if (idx !== -1) {
                    day.plans[idx] = targetItem;
                    break;
                }
            }
        }
saveAllData(allData);

// ★ 触发奖励统计更新事件（阶段完成）
document.dispatchEvent(new CustomEvent('planTodoCompleted', {
    detail: {
        type: 'stage',
        id: itemId,
        fullTitle: fullTitle + '.' + stageName,
        reward: reward
    }
}));

overlay.remove();

// 弹出完成通知
const rewardMsg = reward.noReward || reward.count === 0 
    ? '无奖励' 
    : `🏆 已发放 ${reward.count} 颗 ${reward.color}曜石！`;

showToast(`✅ 「${fullTitle}.${stageName}」已完成！${rewardMsg}`, 'success');
        
        // 刷新详情页
        const detailOverlay = document.getElementById('pt-detail-overlay');
        if (detailOverlay) detailOverlay.remove();
        showPlanTodoDetail(itemId, targetType, targetDate);
        
        // 刷新卡片
        const currentDate = document.querySelector('.calendar-day.selected');
        if (currentDate && typeof window.updatePlanTodoCards === 'function') {
            const day = currentDate.dataset.day;
            const month = currentDate.dataset.month;
            const year = currentDate.dataset.year;
            const dateStr = year + '-' + String(parseInt(month) + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0');
            window.updatePlanTodoCards(dateStr);
        }
    });
    
    overlay.addEventListener('click', function(e) {
        if (e.target === overlay) overlay.remove();
    });
}

    function showComingSoon(label) {
        if (typeof showToast === 'function') {
            showToast(`📋 「${label}」功能开发中，敬请期待 ✦`, 'info');
        } else {
            alert(`「${label}」功能开发中`);
        }
    }

// ============================================================
// 总况功能（只统计计划）
// ============================================================
function openOverview() {
    // 收集所有计划（从所有日期中获取，去重）
    const allData = getAllData();
    let allItems = [];
    
    for (const date in allData) {
        const day = allData[date];
        if (day.plans) {
            day.plans.forEach(p => {
                if (!allItems.some(item => item.id === p.id)) {
                    allItems.push({ ...p, _sourceDate: date });
                }
            });
        }
        // 不收集待办
    }
    
    // 按创建时间排序
    allItems.sort((a, b) => a.createdAt - b.createdAt);
    
    // 构建模态框
    const overlay = document.createElement('div');
    overlay.id = 'pt-overview-overlay';
    overlay.style.cssText = `
        position: fixed; inset: 0; z-index: 100005;
        display: flex; align-items: center; justify-content: center;
        background: rgba(0,0,0,0.6);
        backdrop-filter: blur(8px);
        animation: companionToastIn 0.3s ease;
        padding: 12px;
        box-sizing: border-box;
        overflow-y: auto;
    `;
    
    const modal = document.createElement('div');
    modal.style.cssText = `
        background: var(--secondary-bg);
        max-width: 520px;
        width: 100%;
        max-height: 90vh;
        border-radius: 24px;
        padding: 20px 20px 16px;
        border: 1px solid var(--border-color);
        color: var(--text-primary);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        position: relative;
        box-shadow: 0 20px 60px rgba(0,0,0,0.5);
    `;
    
    // 状态分类
    const statuses = [
        { key: 'all', label: '全部' },
        { key: '进行中', label: '进行中' },
        { key: '未开始', label: '未开始' },
        { key: '已暂停', label: '已暂停' },
        { key: '已完成', label: '已完成' },
        { key: '已过期', label: '已过期' }
    ];
    
    // 当前选中的状态
    let currentStatus = 'all';
    
    // 渲染列表
    function renderOverviewList(statusKey) {
        const container = document.getElementById('pt-overview-list');
        if (!container) return;
        
        // 过滤条目
        let filtered = [];
        if (statusKey === 'all') {
            filtered = allItems;
        } else {
            filtered = allItems.filter(item => {
                const status = calculateItemStatus(item);
                return status === statusKey;
            });
        }
        
        // 按状态分组显示（仅在"全部"模式下分组）
        if (statusKey === 'all') {
            const groups = {};
            filtered.forEach(item => {
                const status = calculateItemStatus(item);
                if (!groups[status]) groups[status] = [];
                groups[status].push(item);
            });
            
            // 按状态顺序排列
            const statusOrder = ['进行中', '未开始', '已暂停', '已完成', '已过期'];
            let html = '';
            let totalCount = filtered.length;
            
            // 显示总数
            html += `
                <div style="font-size:13px; color:var(--text-secondary); padding:6px 0 12px; border-bottom:1px solid var(--border-color);">
                    共 <strong style="color:var(--accent-color);">${totalCount}</strong> 项
                </div>
            `;
            
            statusOrder.forEach(statusKey => {
                const items = groups[statusKey] || [];
                if (items.length === 0) return;
                
                const statusColor = getStatusColor(statusKey);
                const statusIcon = getStatusIcon(statusKey);
                
                html += `
                    <div style="margin-top:12px;">
                        <div style="font-size:12px; font-weight:600; color:${statusColor}; margin-bottom:6px; display:flex; align-items:center; gap:6px;">
                            ${statusIcon} ${statusKey} · ${items.length} 项
                        </div>
                        ${items.map(item => renderListItem(item)).join('')}
                    </div>
                `;
            });
            
            if (totalCount === 0) {
                html = `
                    <div style="text-align:center; padding:40px 20px; color:var(--text-secondary); opacity:0.6;">
                        <i class="fas fa-inbox" style="font-size:32px; display:block; margin-bottom:12px; opacity:0.3;"></i>
                        <div style="font-size:14px;">暂无任何计划或待办</div>
                    </div>
                `;
            }
            
            container.innerHTML = html;
            
        } else {
            // 单一状态模式
            const statusColor = getStatusColor(statusKey);
            const statusIcon = getStatusIcon(statusKey);
            
            let html = `
                <div style="font-size:13px; color:var(--text-secondary); padding:6px 0 12px; border-bottom:1px solid var(--border-color);">
                    ${statusIcon} <strong style="color:${statusColor};">${statusKey}</strong> · 共 <strong style="color:var(--accent-color);">${filtered.length}</strong> 项
                </div>
            `;
            
            if (filtered.length === 0) {
                html += `
                    <div style="text-align:center; padding:40px 20px; color:var(--text-secondary); opacity:0.6;">
                        <div style="font-size:14px;">暂无 ${statusKey} 的条目</div>
                    </div>
                `;
            } else {
                html += filtered.map(item => renderListItem(item)).join('');
            }
            
            container.innerHTML = html;
        }
    }
    
    // 渲染单个列表项
    function renderListItem(item) {
        const status = calculateItemStatus(item);
        const statusColor = getStatusColor(status);
        const statusIcon = getStatusIcon(status);
        const statusLabel = getStatusLabel(status);
        const isPlan = item.type === 'plan';
        
        // 显示日期信息
        let dateInfo = '';
        if (isPlan) {
            dateInfo = `📅 ${formatDateDisplay(item.startDate)} → ${formatDateDisplay(item.endDate)}`;
        } else {
            dateInfo = `📋 ${formatDateDisplay(item.startDate)}`;
        }
        
        return `
            <div class="pt-overview-list-item" data-id="${item.id}" style="
                display:flex; align-items:center; gap:12px;
                padding:10px 12px; margin-bottom:6px;
                background:var(--primary-bg); border-radius:10px;
                border-left:4px solid ${item.primaryColor || 'var(--accent-color)'};
                cursor:pointer; transition: all 0.2s;
            " onmouseover="this.style.transform='translateX(4px)'" onmouseout="this.style.transform='translateX(0)'">
                <div style="flex:1; min-width:0;">
                    <div style="font-size:13px; font-weight:600; color:var(--text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                        ${item.fullTitle}
                    </div>
                    <div style="display:flex; gap:10px; margin-top:3px; font-size:11px; color:var(--text-secondary); flex-wrap:wrap;">
                        <span>${dateInfo}</span>
                        <span style="color:${statusColor};">
                            ${statusIcon} ${statusLabel}
                        </span>
                    </div>
                </div>
                <div style="
                    font-size:10px; color:var(--text-secondary); opacity:0.5; flex-shrink:0;
                    padding:2px 8px; background:var(--secondary-bg); border-radius:10px;
                ">
                    计划
                </div>
            </div>
        `;
    }
    
    // 构建模态框内容
    modal.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; flex-shrink:0;">
            <div style="font-size:18px; font-weight:700; display:flex; align-items:center; gap:8px;">
                <i class="fas fa-chart-bar" style="color:var(--accent-color);"></i>
                <span>📊 总况</span>
            </div>
            <button id="pt-overview-close-btn" style="
                background:none; border:none; color:var(--text-secondary);
                font-size:24px; cursor:pointer; padding:0 6px;
            ">✕</button>
        </div>
        
        <!-- 标签切换 -->
        <div style="display:flex; gap:4px; flex-wrap:wrap; margin-bottom:12px; flex-shrink:0;">
            ${statuses.map(s => `
                <button class="pt-overview-tab" data-status="${s.key}" style="
                    flex:1; min-width:40px; padding:6px 8px; border:none; border-radius:8px;
                    font-size:11px; font-weight:600; cursor:pointer;
                    background:${s.key === 'all' ? 'var(--accent-color)' : 'var(--primary-bg)'};
                    color:${s.key === 'all' ? '#fff' : 'var(--text-secondary)'};
                    font-family:var(--font-family); transition: all 0.2s;
                    white-space:nowrap;
                ">${s.label}</button>
            `).join('')}
        </div>
        
        <!-- 列表内容 -->
        <div id="pt-overview-list" style="flex:1; overflow-y:auto; padding-right:4px; margin-bottom:12px; min-height:100px;">
            <!-- 由 JS 动态渲染 -->
        </div>
        
        <!-- 底部按钮 -->
        <div style="display:flex; gap:10px; flex-shrink:0; padding-top:12px; border-top:1px solid var(--border-color);">
            <button id="pt-overview-close-btn-bottom" style="
                flex:1; padding:10px 0; border-radius:10px;
                border:1.5px solid var(--border-color); background:transparent;
                color:var(--text-secondary); font-size:14px; font-weight:600;
                cursor:pointer; font-family:var(--font-family);
            ">关闭</button>
        </div>
    `;
    
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    
    // --- 事件绑定 ---
    const closeFn = () => { overlay.remove(); };
    
    document.getElementById('pt-overview-close-btn').addEventListener('click', closeFn);
    document.getElementById('pt-overview-close-btn-bottom').addEventListener('click', closeFn);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeFn(); });
    
    // 标签切换
    document.querySelectorAll('.pt-overview-tab').forEach(tab => {
        tab.addEventListener('click', function() {
            const status = this.dataset.status;
            currentStatus = status;
            
            // 更新标签样式
            document.querySelectorAll('.pt-overview-tab').forEach(t => {
                const isActive = t.dataset.status === status;
                t.style.background = isActive ? 'var(--accent-color)' : 'var(--primary-bg)';
                t.style.color = isActive ? '#fff' : 'var(--text-secondary)';
            });
            
            renderOverviewList(status);
        });
    });
    
    // 列表项点击 → 三级详情页
    modal.addEventListener('click', function(e) {
        const itemEl = e.target.closest('.pt-overview-list-item');
        if (!itemEl) return;
        
        const id = itemEl.dataset.id;
        // 查找条目获取类型和日期
        const allData = getAllData();
        let foundType = '';
        let foundDate = '';
        for (const date in allData) {
            const day = allData[date];
            if (day.plans) {
                const found = day.plans.find(p => p.id === id);
                if (found) {
                    foundType = 'plan';
                    foundDate = date;
                    break;
                }
            }
            if (day.todos) {
                const found = day.todos.find(t => t.id === id);
                if (found) {
                    foundType = 'todo';
                    foundDate = date;
                    break;
                }
            }
        }
        if (foundType) {
            closeFn();
            showPlanTodoDetail(id, foundType, foundDate);
        } else {
            showToast('条目不存在', 'error');
        }
    });
    
    // 初始渲染
    renderOverviewList('all');
}

    // ============================================================
    // 🆕 新建模态框（核心功能）
    // ============================================================
    let currentDateStr = '';
    let currentType = 'todo'; // 'todo' | 'plan'
    let stageList = [];
    let selectedPrimaryLabel = ''; // 当前选中的一级标题名称

    function openCreateModal(dateStr) {
        currentDateStr = dateStr || getTodayStr();
        currentType = 'todo';
        stageList = [];
        selectedPrimaryLabel = '';
        selectedColor = COLORS[0].value;

        // 构建模态框
        const overlay = document.createElement('div');
        overlay.id = 'plan-todo-create-overlay';
        overlay.style.cssText = `
            position: fixed; inset: 0; z-index: 100000;
            display: flex; align-items: center; justify-content: center;
            background: rgba(0,0,0,0.6);
            backdrop-filter: blur(8px);
            animation: companionToastIn 0.3s ease;
            padding: 12px;
            box-sizing: border-box;
            overflow-y: auto;
        `;

        const modal = document.createElement('div');
        modal.style.cssText = `
            background: var(--secondary-bg);
            max-width: 560px;
            width: 100%;
            max-height: 95vh;
            border-radius: 24px;
            padding: 20px 20px 16px;
            border: 1px solid var(--border-color);
            color: var(--text-primary);
            display: flex;
            flex-direction: column;
            overflow: hidden;
            position: relative;
            box-shadow: 0 20px 60px rgba(0,0,0,0.5);
        `;

        // --- 模态框内容（由 renderCreateForm 填充） ---
        modal.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; flex-shrink:0;">
                <div style="font-size:20px; font-weight:700; display:flex; align-items:center; gap:8px;">
                    <i class="fas fa-plus-circle" style="color:var(--accent-color);"></i>
                    <span>新建</span>
                </div>
                <button id="pt-create-close-btn" style="
                    background:none; border:none; color:var(--text-secondary);
                    font-size:24px; cursor:pointer; padding:0 6px;
                ">✕</button>
            </div>

            <!-- 标签页切换 -->
            <div style="display:flex; gap:8px; margin-bottom:16px; flex-shrink:0; background:var(--primary-bg); border-radius:12px; padding:4px;">
                <button class="pt-type-tab active" data-type="todo" style="
                    flex:1; padding:9px 0; border:none; border-radius:10px;
                    font-size:14px; font-weight:600; cursor:pointer;
                    background:var(--accent-color); color:#fff;
                    font-family:var(--font-family); transition:all 0.25s;
                ">
                    <i class="fas fa-clipboard-list" style="margin-right:6px;"></i>今日待办
                </button>
                <button class="pt-type-tab" data-type="plan" style="
                    flex:1; padding:9px 0; border:none; border-radius:10px;
                    font-size:14px; font-weight:600; cursor:pointer;
                    background:transparent; color:var(--text-secondary);
                    font-family:var(--font-family); transition:all 0.25s;
                ">
                    <i class="fas fa-tasks" style="margin-right:6px;"></i>计划
                </button>
            </div>

            <!-- 表单内容（滚动区域） -->
            <div id="pt-form-body" style="flex:1; overflow-y:auto; padding-right:4px; margin-bottom:12px;">
                <!-- 由 renderFormBody 动态填充 -->
            </div>

            <!-- 底部按钮 -->
            <div style="display:flex; gap:10px; flex-shrink:0; padding-top:12px; border-top:1px solid var(--border-color);">
                <button id="pt-cancel-btn" style="
                    flex:1; padding:11px 0; border-radius:12px;
                    border:1.5px solid var(--border-color); background:transparent;
                    color:var(--text-secondary); font-size:15px; font-weight:600;
                    cursor:pointer; font-family:var(--font-family);
                ">取消</button>
                <button id="pt-save-btn" style="
                    flex:2; padding:11px 0; border-radius:12px;
                    border:none; background:var(--accent-color); color:#fff;
                    font-size:15px; font-weight:600; cursor:pointer;
                    font-family:var(--font-family);
                    box-shadow: 0 2px 10px rgba(var(--accent-color-rgb),0.3);
                ">✦ 保存</button>
            </div>
        `;

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        // --- 事件绑定 ---
        // 关闭
        const closeBtn = modal.querySelector('#pt-create-close-btn');
        const cancelBtn = modal.querySelector('#pt-cancel-btn');
        const closeFn = () => { overlay.remove(); };
        closeBtn.addEventListener('click', closeFn);
        cancelBtn.addEventListener('click', closeFn);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) closeFn(); });

        // 标签页切换
        modal.querySelectorAll('.pt-type-tab').forEach(tab => {
            tab.addEventListener('click', function () {
                const type = this.dataset.type;
                switchType(type);
            });
        });

        // 保存
        modal.querySelector('#pt-save-btn').addEventListener('click', function () {
            handleSave();
        });

        // 初始化渲染
        renderFormBody();
        updatePrimaryLabelOptions();
        updateStageUI();
        updateRewardUI();

        // 一级标题输入框的实时去重检测
        const primaryInput = modal.querySelector('#pt-primary-input');
        if (primaryInput) {
            primaryInput.addEventListener('input', function () {
                const val = this.value.trim();
                const type = currentType;
                const meta = getMeta();
                const list = meta[type] || [];
                const existing = list.find(item => item.name === val);
                if (existing) {
                    // 已存在，自动锁定颜色
                    selectedPrimaryLabel = val;
                    const colorPicker = modal.querySelector('#pt-primary-color-picker');
                    if (colorPicker) {
                        colorPicker.value = existing.color;
                        colorPicker.disabled = true;
                        colorPicker.style.opacity = '0.6';
                    }
                    // 显示提示
                    const hint = modal.querySelector('#pt-primary-hint');
                    if (hint) {
                        hint.textContent = '✅ 已有标签，颜色已固定';
                        hint.style.color = 'var(--text-secondary)';
                    }
                } else {
                    selectedPrimaryLabel = '';
                    const colorPicker = modal.querySelector('#pt-primary-color-picker');
                    if (colorPicker) {
                        colorPicker.disabled = false;
                        colorPicker.style.opacity = '1';
                    }
                    const hint = modal.querySelector('#pt-primary-hint');
                    if (hint) {
                        hint.textContent = '新标签，可选择颜色';
                        hint.style.color = 'var(--text-secondary)';
                    }
                }
                // 更新预览
                updateTitlePreview();
            });
        }

        // 颜色选择变化时更新预览
        const colorPicker = modal.querySelector('#pt-primary-color-picker');
        if (colorPicker) {
            colorPicker.addEventListener('input', function () {
                updateTitlePreview();
            });
        }

        const secondaryInput = modal.querySelector('#pt-secondary-input');
        if (secondaryInput) {
            secondaryInput.addEventListener('input', updateTitlePreview);
        }

// 阶段管理：添加阶段（使用事件委托，避免动态元素问题）
document.addEventListener('click', function(e) {
    if (e.target.id === 'pt-add-stage-btn' || e.target.closest('#pt-add-stage-btn')) {
        addStage();
    }
});

        // 重复方式切换
        const repeatTypeRadios = modal.querySelectorAll('input[name="pt-repeat-type"]');
        repeatTypeRadios.forEach(radio => {
            radio.addEventListener('change', function () {
                toggleRepeatDetail(this.value);
            });
        });

        // 奖励不设开关
        const noRewardCheck = modal.querySelector('#pt-no-reward');
        if (noRewardCheck) {
            noRewardCheck.addEventListener('change', function () {
                toggleRewardFields(this.checked);
            });
        }
    }

    // ============================================================
    // 表单渲染函数
    // ============================================================
function renderFormBody() {
    const body = document.getElementById('pt-form-body');
    if (!body) return;

    const isPlan = currentType === 'plan';
    const meta = getMeta();
    const primaryOptions = meta[currentType] || [];

    // 获取当前输入的一级标题（用于过滤二级标题）
    const primaryInputEl = document.getElementById('pt-primary-input');
    const currentPrimary = primaryInputEl ? primaryInputEl.value.trim() : '';

    // 获取当前一级标题下已有的二级标题（仅计划模式）
    let secondaryOptions = [];
    if (isPlan && currentPrimary) {
        const allData = getAllData();
        const seen = new Set();
        for (const date in allData) {
            const day = allData[date];
            if (day.plans) {
                day.plans.forEach(item => {
                    if (item.primaryLabel === currentPrimary && item.secondaryTitle) {
                        const key = item.secondaryTitle;
                        if (!seen.has(key)) {
                            seen.add(key);
                            secondaryOptions.push({ title: item.secondaryTitle, id: item.id });
                        }
                    }
                });
            }
        }
        // 按字母排序
        secondaryOptions.sort((a, b) => a.title.localeCompare(b.title));
    }

    body.innerHTML = `
        <!-- 一、标题设置 -->
        <div style="margin-bottom:18px;">
            <div style="font-size:13px; font-weight:600; color:var(--text-secondary); margin-bottom:10px; letter-spacing:0.5px;">
                <i class="fas fa-tag" style="margin-right:6px;color:var(--accent-color);"></i>标题设置
            </div>

            <!-- 一级标题：色块在左，输入框在右（同一行，色块上移4px） -->
            <div style="display:flex; gap:10px; align-items:flex-start; margin-bottom:6px;">
                <!-- 色块选择器（左） -->
                <div style="position:relative; flex-shrink:0; margin-top:-4px;">
                    <div id="pt-color-preview" style="
                        width:40px; height:40px; border-radius:50%; 
                        border:2px solid var(--border-color); 
                        background: ${selectedColor || '#3498DB'}; 
                        cursor:pointer; 
                        transition: all 0.2s;
                        box-shadow: 0 2px 6px rgba(0,0,0,0.1);
                    " onclick="toggleColorPicker()"></div>
                    
                    <div id="pt-color-dropdown" style="
                        display:none; position:absolute; top:48px; left:0; 
                        background:var(--secondary-bg); border:1px solid var(--border-color); 
                        border-radius:12px; padding:12px; width:220px; 
                        box-shadow: 0 8px 24px rgba(0,0,0,0.3); z-index:10;
                    ">
                        <!-- 预设颜色 -->
                        <div style="display:grid; grid-template-columns:repeat(4,1fr); gap:6px; margin-bottom:8px;">
                            ${COLORS.map(c => `
                                <div class="pt-color-option" data-color="${c.value}" style="
                                    width:36px; height:36px; border-radius:50%; 
                                    background:${c.value}; cursor:pointer; 
                                    border:2px solid transparent; 
                                    transition: all 0.2s;
                                " onclick="selectColor('${c.value}')" onmouseover="this.style.borderColor='rgba(255,255,255,0.5)'" onmouseout="this.style.borderColor='transparent'"></div>
                            `).join('')}
                        </div>
                        
                        <!-- 自定义颜色 -->
                        <div style="display:flex; gap:6px; align-items:center; border-top:1px solid var(--border-color); padding-top:8px;">
                            <span style="font-size:11px; color:var(--text-secondary); flex-shrink:0;">自定义：</span>
                            <input type="color" id="pt-custom-color-input" value="${selectedColor || '#3498DB'}" style="
                                width:32px; height:32px; border:none; border-radius:50%; cursor:pointer; padding:0; flex-shrink:0;
                            " onchange="selectColor(this.value)">
                            <div style="position:relative; flex:1; min-width:0;">
                                <input type="text" id="pt-custom-color-hex" placeholder="#xxxxxx" value="${selectedColor || '#3498DB'}" style="
                                    width:100%; padding:4px 8px; border:1px solid var(--border-color);
                                    border-radius:6px; background:var(--primary-bg); color:var(--text-primary);
                                    font-size:11px; outline:none; font-family:var(--font-family);
                                    box-sizing:border-box;
                                " oninput="onCustomHexInput(this.value)">
                                <div id="pt-custom-color-preview" style="
                                    position:absolute; right:4px; top:50%; transform:translateY(-50%);
                                    width:16px; height:16px; border-radius:4px; 
                                    background:${selectedColor || '#3498DB'}; border:1px solid var(--border-color);
                                    pointer-events:none;
                                "></div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 一级标题输入框 + 下拉菜单（右） -->
                <div style="flex:1; min-width:0; position:relative;">
                    <div style="position:relative;">
                        <input type="text" id="pt-primary-input" placeholder="一级标题（如：学习）" maxlength="20" autocomplete="off" style="
                            width:100%; padding:9px 12px; border:1.5px solid var(--border-color);
                            border-radius:10px; background:var(--primary-bg); color:var(--text-primary);
                            font-size:14px; outline:none; font-family:var(--font-family);
                            box-sizing:border-box;
                        ">
                        <!-- 一级标题下拉菜单 -->
                        <div id="pt-primary-dropdown" style="
                            display:none; position:absolute; top:calc(100% + 4px); left:0; right:0;
                            background:var(--secondary-bg); border:1px solid var(--border-color);
                            border-radius:10px; max-height:150px; overflow-y:auto;
                            box-shadow: 0 8px 24px rgba(0,0,0,0.2); z-index:20;
                        ">
                            ${primaryOptions.length > 0 ? primaryOptions.map(opt => `
                                <div class="pt-primary-option" data-name="${opt.name}" data-color="${opt.color}" style="
                                    display:flex; align-items:center; gap:10px; padding:8px 12px;
                                    cursor:pointer; transition:background 0.15s;
                                    border-bottom:1px solid var(--border-color);
                                " onmouseover="this.style.background='rgba(var(--accent-color-rgb),0.06)'" onmouseout="this.style.background='transparent'">
                                    <span style="display:inline-block; width:14px; height:14px; border-radius:50%; background:${opt.color}; flex-shrink:0;"></span>
                                    <span style="font-size:13px; color:var(--text-primary);">${opt.name}</span>
                                </div>
                            `).join('') : `
                                <div style="padding:12px; text-align:center; color:var(--text-secondary); font-size:12px; opacity:0.6;">
                                    暂无已创建的一级标题
                                </div>
                            `}
                        </div>
                    </div>
                    <div id="pt-primary-hint" style="font-size:10px; color:var(--text-secondary); margin-top:3px; opacity:0.7;">输入已有标签将自动锁定颜色，点击下拉可快速选择</div>
                </div>
            </div>

            <!-- 二级标题（带下拉菜单） -->
            <div style="position:relative; margin-top:6px;">
                <input type="text" id="pt-secondary-input" placeholder="二级标题（如：看完一本书）" maxlength="30" autocomplete="off" style="
                    width:100%; padding:9px 12px; border:1.5px solid var(--border-color);
                    border-radius:10px; background:var(--primary-bg); color:var(--text-primary);
                    font-size:14px; outline:none; font-family:var(--font-family);
                    box-sizing:border-box;
                ">
                <!-- 二级标题下拉菜单（仅计划模式且有选项时显示） -->
                ${isPlan ? `
                <div id="pt-secondary-dropdown" style="
                    display:none; position:absolute; top:calc(100% + 4px); left:0; right:0;
                    background:var(--secondary-bg); border:1px solid var(--border-color);
                    border-radius:10px; max-height:150px; overflow-y:auto;
                    box-shadow: 0 8px 24px rgba(0,0,0,0.2); z-index:20;
                ">
                    ${secondaryOptions.length > 0 ? secondaryOptions.map(opt => `
                        <div class="pt-secondary-option" data-title="${opt.title}" style="
                            display:flex; align-items:center; gap:10px; padding:8px 12px;
                            cursor:pointer; transition:background 0.15s;
                            border-bottom:1px solid var(--border-color);
                        " onmouseover="this.style.background='rgba(var(--accent-color-rgb),0.06)'" onmouseout="this.style.background='transparent'">
                            <span style="font-size:13px; color:var(--text-primary);">${opt.title}</span>
                            <span style="font-size:10px; color:var(--text-secondary); opacity:0.5; margin-left:auto;">已存在</span>
                        </div>
                    `).join('') : `
                        <div style="padding:12px; text-align:center; color:var(--text-secondary); font-size:12px; opacity:0.6;">
                            暂无已创建的二级标题
                        </div>
                    `}
                </div>
                ` : ''}
            </div>
            ${isPlan ? `<div style="font-size:10px; color:var(--text-secondary); margin-top:3px; opacity:0.6;">点击下拉可选择已有二级标题（仅当前一级标题下）</div>` : ''}

            <div id="pt-title-preview" style="
                margin-top:6px; font-size:14px; color:var(--text-secondary);
                padding:4px 10px; background:rgba(var(--accent-color-rgb),0.06);
                border-radius:8px; min-height:28px; display:flex; align-items:center;
            ">
                📌 预览：<span id="pt-title-preview-text" style="color:var(--text-primary);font-weight:500;margin-left:4px;"></span>
            </div>
        </div>

        <!-- 二、时间设置 -->
        <div style="margin-bottom:18px;">
            <div style="font-size:13px; font-weight:600; color:var(--text-secondary); margin-bottom:10px; letter-spacing:0.5px;">
                <i class="fas fa-clock" style="margin-right:6px;color:var(--accent-color);"></i>时间设置
            </div>

            ${isPlan ? `
                <!-- 计划模式 -->
                <div style="display:flex; gap:8px; margin-bottom:6px;">
                    <div style="flex:1;">
                        <label style="font-size:11px; color:var(--text-secondary); display:block; margin-bottom:3px;">开始日期</label>
                        <input type="date" id="pt-plan-start" value="${getTodayStr()}" style="
                            width:100%; padding:8px 10px; border:1.5px solid var(--border-color);
                            border-radius:10px; background:var(--primary-bg); color:var(--text-primary);
                            font-size:13px; outline:none; font-family:var(--font-family);
                            box-sizing:border-box;
                        ">
                    </div>
                    <div style="flex:1;">
                        <label style="font-size:11px; color:var(--text-secondary); display:block; margin-bottom:3px;">结束日期</label>
                        <input type="date" id="pt-plan-end" style="
                            width:100%; padding:8px 10px; border:1.5px solid var(--border-color);
                            border-radius:10px; background:var(--primary-bg); color:var(--text-primary);
                            font-size:13px; outline:none; font-family:var(--font-family);
                            box-sizing:border-box;
                        ">
                    </div>
                </div>

                <!-- 阶段拆分 -->
                <div style="margin-top:10px; border-top:1px dashed var(--border-color); padding-top:10px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                        <span style="font-size:12px; color:var(--text-secondary); font-weight:500;">📌 阶段拆分（可选）</span>
                        <button id="pt-add-stage-btn" style="
                            padding:4px 14px; border:none; border-radius:8px;
                            background:rgba(var(--accent-color-rgb),0.15); color:var(--accent-color);
                            font-size:12px; font-weight:600; cursor:pointer;
                            font-family:var(--font-family);
                        ">+ 添加阶段</button>
                    </div>
                    <div id="pt-stage-list" style="display:flex; flex-direction:column; gap:8px;">
                        <!-- 由 JS 动态渲染 -->
                    </div>
                </div>
            ` : `
                <!-- 待办模式 -->
                <div style="margin-bottom:8px;">
                    <label style="display:flex; align-items:center; gap:8px; cursor:pointer; font-size:13px; color:var(--text-secondary);">
                        <input type="checkbox" id="pt-repeat-toggle" style="width:16px;height:16px;accent-color:var(--accent-color);">
                        重复
                    </label>
                </div>

                <div id="pt-repeat-detail" style="display:none; padding:10px 12px; background:var(--primary-bg); border-radius:10px; margin-bottom:8px;">
                    <div style="display:flex; gap:12px; margin-bottom:8px;">
                        <label style="font-size:12px; color:var(--text-secondary); display:flex; align-items:center; gap:4px; cursor:pointer;">
                            <input type="radio" name="pt-repeat-type" value="weekly" checked> 按星期
                        </label>
                        <label style="font-size:12px; color:var(--text-secondary); display:flex; align-items:center; gap:4px; cursor:pointer;">
                            <input type="radio" name="pt-repeat-type" value="daily"> 按天数
                        </label>
                    </div>

                    <div id="pt-repeat-weekly" style="display:flex; gap:4px; flex-wrap:wrap;">
                        ${['一','二','三','四','五','六','日'].map(d => `
                            <label style="font-size:12px; color:var(--text-secondary); display:flex; align-items:center; gap:3px; cursor:pointer; padding:2px 6px; background:rgba(var(--border-color),0.3); border-radius:6px;">
                                <input type="checkbox" value="${d}" style="width:14px;height:14px;accent-color:var(--accent-color);"> ${d}
                            </label>
                        `).join('')}
                    </div>

                    <div id="pt-repeat-daily" style="display:none; align-items:center; gap:6px; margin-top:4px;">
                        <span style="font-size:12px; color:var(--text-secondary);">每隔</span>
                        <input type="number" id="pt-repeat-interval" value="1" min="1" max="30" style="
                            width:50px; padding:4px 6px; border:1px solid var(--border-color);
                            border-radius:6px; background:var(--primary-bg); color:var(--text-primary);
                            font-size:13px; text-align:center; outline:none;
                        ">
                        <span style="font-size:12px; color:var(--text-secondary);">天</span>
                    </div>

                    <div style="display:flex; gap:8px; margin-top:8px; border-top:1px solid var(--border-color); padding-top:8px;">
                        <div style="flex:1;">
                            <label style="font-size:11px; color:var(--text-secondary); display:block; margin-bottom:3px;">开始日期</label>
                            <input type="date" id="pt-todo-start" value="${getTodayStr()}" style="
                                width:100%; padding:6px 8px; border:1.5px solid var(--border-color);
                                border-radius:8px; background:var(--primary-bg); color:var(--text-primary);
                                font-size:12px; outline:none; font-family:var(--font-family);
                                box-sizing:border-box;
                            ">
                        </div>
                        <div style="flex:1;">
                            <label style="font-size:11px; color:var(--text-secondary); display:block; margin-bottom:3px;">结束日期（选填）</label>
                            <input type="date" id="pt-todo-end" style="
                                width:100%; padding:6px 8px; border:1.5px solid var(--border-color);
                                border-radius:8px; background:var(--primary-bg); color:var(--text-primary);
                                font-size:12px; outline:none; font-family:var(--font-family);
                                box-sizing:border-box;
                            ">
                        </div>
                    </div>
                </div>

                <!-- 待办：无重复时的单日日期 -->
                <div id="pt-todo-single-date" style="display:block;">
                    <label style="font-size:11px; color:var(--text-secondary); display:block; margin-bottom:3px;">日期</label>
                    <input type="date" id="pt-todo-date" value="${currentDateStr}" style="
                        width:100%; padding:8px 10px; border:1.5px solid var(--border-color);
                        border-radius:10px; background:var(--primary-bg); color:var(--text-primary);
                        font-size:13px; outline:none; font-family:var(--font-family);
                        box-sizing:border-box;
                    ">
                </div>
            `}
        </div>

        <!-- 三、奖励预设 -->
        <div style="margin-bottom:12px;">
            <div style="font-size:13px; font-weight:600; color:var(--text-secondary); margin-bottom:10px; letter-spacing:0.5px;">
                <i class="fas fa-gem" style="margin-right:6px;color:var(--accent-color);"></i>奖励预设
            </div>

            <div style="display:flex; align-items:center; gap:10px; margin-bottom:6px;">
                <label style="font-size:12px; color:var(--text-secondary); display:flex; align-items:center; gap:4px; cursor:pointer;">
                    <input type="checkbox" id="pt-no-reward"> 不设奖励
                </label>
            </div>

            <div id="pt-reward-fields">
                <!-- 总奖励 -->
                <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px; flex-wrap:wrap;">
                    <span style="font-size:12px; color:var(--text-secondary);">总奖励：</span>
                    <input type="number" id="pt-reward-total-count" value="1" min="0" max="99" style="
                        width:50px; padding:4px 6px; border:1px solid var(--border-color);
                        border-radius:6px; background:var(--primary-bg); color:var(--text-primary);
                        font-size:13px; text-align:center; outline:none;
                    ">
                    <span style="font-size:12px; color:var(--text-secondary);">颗</span>
                    <select id="pt-reward-total-color" style="
                        padding:4px 8px; border:1px solid var(--border-color);
                        border-radius:6px; background:var(--primary-bg); color:var(--text-primary);
                        font-size:12px; outline:none;
                    ">
                        ${REWARD_COLORS.map(c => `<option value="${c}">${c}曜石</option>`).join('')}
                    </select>
                </div>

                <!-- 阶段奖励（仅计划模式显示） -->
                <div id="pt-stage-rewards" style="display:${isPlan ? 'block' : 'none'}; margin-top:6px; border-top:1px dashed var(--border-color); padding-top:8px;">
                    <div style="font-size:11px; color:var(--text-secondary); margin-bottom:4px;">各阶段奖励：</div>
                    <div id="pt-stage-reward-list">
                        <!-- 由 JS 动态渲染 -->
                    </div>
                </div>
            </div>
        </div>

        <!-- 四、其他设置 -->
        <div style="margin-bottom:4px;">
            <div style="font-size:13px; font-weight:600; color:var(--text-secondary); margin-bottom:8px; letter-spacing:0.5px;">
                <i class="fas fa-cog" style="margin-right:6px;color:var(--accent-color);"></i>其他设置
            </div>
            <label style="font-size:13px; color:var(--text-secondary); display:flex; align-items:center; gap:8px; cursor:pointer;">
                <input type="checkbox" id="pt-viewable" style="width:16px;height:16px;accent-color:var(--accent-color);">
                可查看（未来功能联动）
            </label>
        </div>
    `;

    // ---------- 事件绑定 ----------
    const primaryInput = document.getElementById('pt-primary-input');
    const secondaryInput = document.getElementById('pt-secondary-input');
    const primaryDropdown = document.getElementById('pt-primary-dropdown');
    const secondaryDropdown = document.getElementById('pt-secondary-dropdown');

    // 一级标题：输入时实时过滤下拉菜单
    if (primaryInput) {
        primaryInput.addEventListener('input', function() {
            const val = this.value.trim();
            const type = currentType;
            const meta = getMeta();
            const list = meta[type] || [];
            
            // 检查是否已有该标签
            const existing = list.find(item => item.name === val);
            if (existing && val) {
                selectedColor = existing.color;
                const colorPicker = document.getElementById('pt-color-preview');
                if (colorPicker) colorPicker.style.background = existing.color;
                const customPreview = document.getElementById('pt-custom-color-preview');
                if (customPreview) customPreview.style.background = existing.color;
                // 锁定颜色
                const hint = document.getElementById('pt-primary-hint');
                if (hint) {
                    hint.textContent = '✅ 已有标签，颜色已固定';
                    hint.style.color = 'var(--accent-color)';
                }
            } else if (val) {
                const hint = document.getElementById('pt-primary-hint');
                if (hint) {
                    hint.textContent = '新标签，可选择颜色';
                    hint.style.color = 'var(--text-secondary)';
                }
            } else {
                const hint = document.getElementById('pt-primary-hint');
                if (hint) {
                    hint.textContent = '输入已有标签将自动锁定颜色，点击下拉可快速选择';
                    hint.style.color = 'var(--text-secondary)';
                }
            }
            
            // 过滤下拉菜单选项
            if (primaryDropdown) {
                const options = primaryDropdown.querySelectorAll('.pt-primary-option');
                options.forEach(opt => {
                    const name = opt.dataset.name || '';
                    opt.style.display = name.includes(val) ? 'flex' : 'none';
                });
                // 如果有输入，显示下拉；如果没输入也显示（让用户点击选择）
                primaryDropdown.style.display = 'block';
            }
            
            // 更新预览
            updateTitlePreview();
            // 更新二级标题下拉（计划模式）
            if (isPlan) {
                updateSecondaryDropdown();
            }
        });

        // 一级标题：获得焦点时显示下拉
        primaryInput.addEventListener('focus', function() {
            if (primaryDropdown) {
                // 过滤选项
                const val = this.value.trim();
                const options = primaryDropdown.querySelectorAll('.pt-primary-option');
                options.forEach(opt => {
                    const name = opt.dataset.name || '';
                    opt.style.display = name.includes(val) ? 'flex' : 'none';
                });
                primaryDropdown.style.display = 'block';
            }
        });

        // 一级标题：点击外部关闭下拉
        document.addEventListener('click', function(e) {
            if (primaryDropdown && primaryInput) {
                if (!primaryDropdown.contains(e.target) && e.target !== primaryInput) {
                    primaryDropdown.style.display = 'none';
                }
            }
        });
    }

    // 一级标题下拉菜单选项点击
    if (primaryDropdown) {
        primaryDropdown.querySelectorAll('.pt-primary-option').forEach(opt => {
            opt.addEventListener('click', function() {
                const name = this.dataset.name;
                const color = this.dataset.color;
                if (primaryInput) {
                    primaryInput.value = name;
                    selectedColor = color;
                    const preview = document.getElementById('pt-color-preview');
                    if (preview) preview.style.background = color;
                    const customPreview = document.getElementById('pt-custom-color-preview');
                    if (customPreview) customPreview.style.background = color;
                    const hint = document.getElementById('pt-primary-hint');
                    if (hint) {
                        hint.textContent = '✅ 已有标签，颜色已固定';
                        hint.style.color = 'var(--accent-color)';
                    }
                    updateTitlePreview();
                    // 更新二级标题下拉
                    if (isPlan) {
                        updateSecondaryDropdown();
                    }
                }
                primaryDropdown.style.display = 'none';
            });
        });
    }

    // 二级标题：输入时过滤下拉（仅计划模式）
    if (isPlan && secondaryInput && secondaryDropdown) {
        secondaryInput.addEventListener('input', function() {
            const val = this.value.trim();
            const options = secondaryDropdown.querySelectorAll('.pt-secondary-option');
            options.forEach(opt => {
                const title = opt.dataset.title || '';
                opt.style.display = title.includes(val) ? 'flex' : 'none';
            });
            if (val.length > 0) {
                secondaryDropdown.style.display = 'block';
            } else {
                secondaryDropdown.style.display = 'none';
            }
            updateTitlePreview();
        });

        secondaryInput.addEventListener('focus', function() {
            // 只有有选项时才显示
            const options = secondaryDropdown.querySelectorAll('.pt-secondary-option');
            let hasVisible = false;
            options.forEach(opt => {
                if (opt.style.display !== 'none') hasVisible = true;
            });
            if (hasVisible && secondaryOptions.length > 0) {
                secondaryDropdown.style.display = 'block';
            }
        });

        // 二级下拉选项点击
        secondaryDropdown.querySelectorAll('.pt-secondary-option').forEach(opt => {
            opt.addEventListener('click', function() {
                const title = this.dataset.title;
                if (secondaryInput) {
                    secondaryInput.value = title;
                    updateTitlePreview();
                }
                secondaryDropdown.style.display = 'none';
            });
        });

        // 点击外部关闭二级下拉
        document.addEventListener('click', function(e) {
            if (secondaryDropdown && secondaryInput) {
                if (!secondaryDropdown.contains(e.target) && e.target !== secondaryInput) {
                    secondaryDropdown.style.display = 'none';
                }
            }
        });
    }

    // 重复开关
    const repeatToggle = document.getElementById('pt-repeat-toggle');
    if (repeatToggle) {
        repeatToggle.addEventListener('change', function () {
            const detail = document.getElementById('pt-repeat-detail');
            const single = document.getElementById('pt-todo-single-date');
            if (this.checked) {
                detail.style.display = 'block';
                single.style.display = 'none';
            } else {
                detail.style.display = 'none';
                single.style.display = 'block';
            }
        });
    }

    // 重复方式切换（按星期 / 按天数）
    const repeatRadios = document.querySelectorAll('input[name="pt-repeat-type"]');
    repeatRadios.forEach(radio => {
        radio.addEventListener('change', function () {
            const weekly = document.getElementById('pt-repeat-weekly');
            const daily = document.getElementById('pt-repeat-daily');
            if (this.value === 'weekly') {
                weekly.style.display = 'flex';
                daily.style.display = 'none';
            } else {
                weekly.style.display = 'none';
                daily.style.display = 'flex';
            }
        });
    });

    // 不设奖励
    const noRewardCheck = document.getElementById('pt-no-reward');
    if (noRewardCheck) {
        noRewardCheck.addEventListener('change', function () {
            const fields = document.getElementById('pt-reward-fields');
            if (fields) {
                fields.style.opacity = this.checked ? '0.4' : '1';
                fields.style.pointerEvents = this.checked ? 'none' : 'auto';
            }
        });
    }

    // 初始化阶段列表
    updateStageUI();
    updateRewardUI();
    updateTitlePreview();
}

// ============================================================
// 辅助：更新二级标题下拉菜单（仅计划模式）
// ============================================================
function updateSecondaryDropdown() {
    const isPlan = currentType === 'plan';
    if (!isPlan) return;
    
    const primaryInput = document.getElementById('pt-primary-input');
    const currentPrimary = primaryInput ? primaryInput.value.trim() : '';
    const dropdown = document.getElementById('pt-secondary-dropdown');
    if (!dropdown) return;
    
    if (!currentPrimary) {
        dropdown.innerHTML = `
            <div style="padding:12px; text-align:center; color:var(--text-secondary); font-size:12px; opacity:0.6;">
                请先填写一级标题
            </div>
        `;
        return;
    }
    
    const allData = getAllData();
    const seen = new Set();
    const options = [];
    for (const date in allData) {
        const day = allData[date];
        if (day.plans) {
            day.plans.forEach(item => {
                if (item.primaryLabel === currentPrimary && item.secondaryTitle) {
                    const key = item.secondaryTitle;
                    if (!seen.has(key)) {
                        seen.add(key);
                        options.push({ title: item.secondaryTitle });
                    }
                }
            });
        }
    }
    options.sort((a, b) => a.title.localeCompare(b.title));
    
    if (options.length === 0) {
        dropdown.innerHTML = `
            <div style="padding:12px; text-align:center; color:var(--text-secondary); font-size:12px; opacity:0.6;">
                暂无已创建的二级标题
            </div>
        `;
        return;
    }
    
    dropdown.innerHTML = options.map(opt => `
        <div class="pt-secondary-option" data-title="${opt.title}" style="
            display:flex; align-items:center; gap:10px; padding:8px 12px;
            cursor:pointer; transition:background 0.15s;
            border-bottom:1px solid var(--border-color);
        " onmouseover="this.style.background='rgba(var(--accent-color-rgb),0.06)'" onmouseout="this.style.background='transparent'">
            <span style="font-size:13px; color:var(--text-primary);">${opt.title}</span>
            <span style="font-size:10px; color:var(--text-secondary); opacity:0.5; margin-left:auto;">已存在</span>
        </div>
    `).join('');
    
    // 重新绑定点击事件
    dropdown.querySelectorAll('.pt-secondary-option').forEach(opt => {
        opt.addEventListener('click', function() {
            const title = this.dataset.title;
            const input = document.getElementById('pt-secondary-input');
            if (input) {
                input.value = title;
                updateTitlePreview();
            }
            dropdown.style.display = 'none';
        });
    });
}

    // ============================================================
    // 表单交互辅助函数
    // ============================================================
function switchType(type) {
    currentType = type;
    // 更新标签页样式
    const tabs = document.querySelectorAll('.pt-type-tab');
    tabs.forEach(tab => {
        const isActive = tab.dataset.type === type;
        tab.style.background = isActive ? 'var(--accent-color)' : 'transparent';
        tab.style.color = isActive ? '#fff' : 'var(--text-secondary)';
    });
    // 重新渲染表单
    renderFormBody();
}

    function toggleRepeatDetail(value) {
        const weekly = document.getElementById('pt-repeat-weekly');
        const daily = document.getElementById('pt-repeat-daily');
        if (value === 'weekly') {
            weekly.style.display = 'flex';
            daily.style.display = 'none';
        } else {
            weekly.style.display = 'none';
            daily.style.display = 'flex';
        }
    }

    function toggleRewardFields(noReward) {
        const fields = document.getElementById('pt-reward-fields');
        if (fields) {
            fields.style.opacity = noReward ? '0.4' : '1';
            fields.style.pointerEvents = noReward ? 'none' : 'auto';
        }
    }

    function updateTitlePreview() {
        const primaryInput = document.getElementById('pt-primary-input');
        const secondaryInput = document.getElementById('pt-secondary-input');
        const previewText = document.getElementById('pt-title-preview-text');
        if (!previewText) return;
        const p = primaryInput ? primaryInput.value.trim() : '';
        const s = secondaryInput ? secondaryInput.value.trim() : '';
        if (p && s) {
            previewText.textContent = p + '.' + s;
        } else if (p) {
            previewText.textContent = p + '.______';
        } else {
            previewText.textContent = '请填写标题';
        }
    }

    function updatePrimaryLabelOptions() {
        // 可扩展：显示已有标签列表（目前仅通过输入提示实现）
        const input = document.getElementById('pt-primary-input');
        if (!input) return;
        // 已有逻辑在 input 事件中处理
    }

    // ============================================================
    // 阶段管理
    // ============================================================
    function addStage() {
        const planStart = document.getElementById('pt-plan-start');
        const planEnd = document.getElementById('pt-plan-end');
        const startVal = planStart ? planStart.value : getTodayStr();
        const endVal = planEnd ? planEnd.value : getTodayStr();

        stageList.push({
            start: startVal,
            end: endVal,
            note: ''
        });
        updateStageUI();
        updateRewardUI();
    }

    function removeStage(index) {
        stageList.splice(index, 1);
        updateStageUI();
        updateRewardUI();
    }

    function updateStageUI() {
        const container = document.getElementById('pt-stage-list');
        if (!container) return;

        if (stageList.length === 0) {
            container.innerHTML = `<div style="font-size:12px; color:var(--text-secondary); opacity:0.5; text-align:center; padding:8px 0;">暂无阶段，点击上方添加</div>`;
            return;
        }

        container.innerHTML = stageList.map((stage, idx) => `
            <div style="background:var(--primary-bg); border-radius:8px; padding:10px 12px; border:1px solid var(--border-color);">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                    <span style="font-size:12px; font-weight:600; color:var(--text-secondary);">阶段 ${idx+1}</span>
                    <button onclick="window._removeStage(${idx})" style="
                        background:none; border:none; color:var(--text-secondary); cursor:pointer;
                        font-size:14px; padding:0 4px; opacity:0.5;
                    ">✕</button>
                </div>
                <div style="display:flex; gap:6px; margin-bottom:4px;">
                    <input type="date" value="${stage.start}" style="
                        flex:1; padding:4px 6px; border:1px solid var(--border-color);
                        border-radius:6px; background:var(--primary-bg); color:var(--text-primary);
                        font-size:11px; outline:none; font-family:var(--font-family);
                    " onchange="window._updateStage(${idx}, 'start', this.value)">
                    <span style="font-size:11px; color:var(--text-secondary); display:flex; align-items:center;">~</span>
                    <input type="date" value="${stage.end}" style="
                        flex:1; padding:4px 6px; border:1px solid var(--border-color);
                        border-radius:6px; background:var(--primary-bg); color:var(--text-primary);
                        font-size:11px; outline:none; font-family:var(--font-family);
                    " onchange="window._updateStage(${idx}, 'end', this.value)">
                </div>
                <input type="text" placeholder="阶段说明（选填）" value="${stage.note}" style="
                    width:100%; padding:4px 8px; border:1px solid var(--border-color);
                    border-radius:6px; background:var(--primary-bg); color:var(--text-primary);
                    font-size:11px; outline:none; font-family:var(--font-family);
                    box-sizing:border-box;
                " onchange="window._updateStage(${idx}, 'note', this.value)">
            </div>
        `).join('');

        // 暴露给全局（用于 onclick）
        window._removeStage = removeStage;
        window._updateStage = function (idx, field, value) {
            if (stageList[idx]) {
                stageList[idx][field] = value;
            }
        };
    }

    // ============================================================
    // 奖励 UI 更新
    // ============================================================
    function updateRewardUI() {
        const container = document.getElementById('pt-stage-reward-list');
        if (!container) return;

        if (currentType === 'plan' && stageList.length > 0) {
            container.innerHTML = stageList.map((stage, idx) => `
                <div style="display:flex; align-items:center; gap:6px; margin-bottom:4px; flex-wrap:wrap;">
                    <span style="font-size:11px; color:var(--text-secondary);">阶段${idx+1}：</span>
                    <input type="number" value="1" min="0" max="99" style="
                        width:40px; padding:3px 4px; border:1px solid var(--border-color);
                        border-radius:4px; background:var(--primary-bg); color:var(--text-primary);
                        font-size:12px; text-align:center; outline:none;
                    " data-stage-reward-count="${idx}">
                    <span style="font-size:11px; color:var(--text-secondary);">颗</span>
                    <select style="
                        padding:3px 6px; border:1px solid var(--border-color);
                        border-radius:4px; background:var(--primary-bg); color:var(--text-primary);
                        font-size:11px; outline:none;
                    " data-stage-reward-color="${idx}">
                        ${REWARD_COLORS.map(c => `<option value="${c}">${c}曜石</option>`).join('')}
                    </select>
                    <label style="font-size:11px; color:var(--text-secondary); display:flex; align-items:center; gap:3px; cursor:pointer;">
                        <input type="checkbox" data-stage-no-reward="${idx}"> 不设
                    </label>
                </div>
            `).join('');
        } else {
            container.innerHTML = currentType === 'plan' ? `<div style="font-size:11px; color:var(--text-secondary); opacity:0.5;">添加阶段后自动生成阶段奖励</div>` : '';
        }
    }

    // ============================================================
    // 保存处理
    // ============================================================
    function handleSave() {
        const type = currentType;

        // ----- 1. 收集标题 -----
        const primaryInput = document.getElementById('pt-primary-input');
        const secondaryInput = document.getElementById('pt-secondary-input');
        const colorPicker = document.getElementById('pt-primary-color-picker');

        const primaryLabel = primaryInput ? primaryInput.value.trim() : '';
        const secondaryTitle = secondaryInput ? secondaryInput.value.trim() : '';
        // 颜色获取（从隐藏域或全局变量）
const primaryColor = selectedColor || COLORS[0].value;

        if (!primaryLabel) {
            showToast('请输入一级标题', 'warning');
            primaryInput?.focus();
            return;
        }
        if (!secondaryTitle) {
            showToast('请输入二级标题', 'warning');
            secondaryInput?.focus();
            return;
        }

        // ----- 2. 去重检测 -----
        const dupCheck = checkDuplicate(type, primaryLabel, secondaryTitle);
        if (dupCheck) {
            showToast(dupCheck.message, 'warning');
            return;
        }

        // ----- 3. 收集时间信息 -----
        let startDate, endDate, stages = [];
        let isRepeating = false,
            repeatType = 'weekly',
            repeatDays = [],
            repeatInterval = 1,
            repeatEndDate = '';

        if (type === 'plan') {
            const startEl = document.getElementById('pt-plan-start');
            const endEl = document.getElementById('pt-plan-end');
            startDate = startEl ? startEl.value : getTodayStr();
            endDate = endEl ? endEl.value : getTodayStr();

            if (!startDate || !endDate) {
                showToast('请填写完整的起止日期', 'warning');
                return;
            }
            if (startDate > endDate) {
                showToast('开始日期不能晚于结束日期', 'warning');
                return;
            }
            if (isDateBeforeToday(startDate)) {
                showToast('开始日期不能早于今天', 'warning');
                return;
            }

            // 收集阶段数据
            const stageItems = document.querySelectorAll('#pt-stage-list > div');
            let hasError = false;
            stageItems.forEach(el => {
                const inputs = el.querySelectorAll('input[type="date"]');
                const noteInput = el.querySelector('input[type="text"]');
                const s = inputs[0]?.value || '';
                const e = inputs[1]?.value || '';
                const note = noteInput?.value || '';
                if (s && e) {
                    if (s < startDate || e > endDate || s > e) {
                        hasError = true;
                        return;
                    }
                    stages.push({ start: s, end: e, note });
                }
            });
            if (hasError) {
                showToast('阶段起止时间超出整体范围或顺序有误，请调整', 'warning');
                return;
            }
        } else {
            // 待办
            const repeatToggle = document.getElementById('pt-repeat-toggle');
            isRepeating = repeatToggle ? repeatToggle.checked : false;

            if (isRepeating) {
                const startEl = document.getElementById('pt-todo-start');
                const endEl = document.getElementById('pt-todo-end');
                startDate = startEl ? startEl.value : getTodayStr();
                repeatEndDate = endEl ? endEl.value : '';

                if (!startDate) {
                    showToast('请选择开始日期', 'warning');
                    return;
                }
                if (isDateBeforeToday(startDate)) {
                    showToast('开始日期不能早于今天', 'warning');
                    return;
                }
                if (repeatEndDate && startDate > repeatEndDate) {
                    showToast('开始日期不能晚于结束日期', 'warning');
                    return;
                }

                const repeatTypeRadios = document.querySelectorAll('input[name="pt-repeat-type"]');
                repeatTypeRadios.forEach(r => { if (r.checked) repeatType = r.value; });

                if (repeatType === 'weekly') {
                    const checkboxes = document.querySelectorAll('#pt-repeat-weekly input[type="checkbox"]:checked');
                    repeatDays = Array.from(checkboxes).map(cb => cb.value);
                    if (repeatDays.length === 0) {
                        showToast('请至少选择一个星期几', 'warning');
                        return;
                    }
                } else {
                    const intervalEl = document.getElementById('pt-repeat-interval');
                    repeatInterval = parseInt(intervalEl?.value) || 1;
                    if (repeatInterval < 1) {
                        showToast('间隔天数至少为1', 'warning');
                        return;
                    }
                }
                endDate = repeatEndDate || '';
            } else {
                const dateEl = document.getElementById('pt-todo-date');
                startDate = dateEl ? dateEl.value : currentDateStr;
                endDate = startDate;
                if (!startDate) {
                    showToast('请选择日期', 'warning');
                    return;
                }
                if (isDateBeforeToday(startDate)) {
                    showToast('日期不能早于今天', 'warning');
                    return;
                }
            }
        }

        // ----- 4. 收集奖励 -----
        const noRewardCheck = document.getElementById('pt-no-reward');
        const noReward = noRewardCheck ? noRewardCheck.checked : false;

        let reward = { total: { count: 1, color: '金' }, stages: [] };

        if (!noReward) {
            const totalCountEl = document.getElementById('pt-reward-total-count');
            const totalColorEl = document.getElementById('pt-reward-total-color');
            const totalCount = parseInt(totalCountEl?.value) || 1;
            const totalColor = totalColorEl?.value || '金';
            reward.total = { count: Math.max(1, totalCount), color: totalColor };

            if (type === 'plan' && stageList.length > 0) {
                const stageCountInputs = document.querySelectorAll('[data-stage-reward-count]');
                const stageColorSelects = document.querySelectorAll('[data-stage-reward-color]');
                const stageNoRewardChecks = document.querySelectorAll('[data-stage-no-reward]');

                stageList.forEach((stage, idx) => {
                    const countEl = stageCountInputs[idx];
                    const colorEl = stageColorSelects[idx];
                    const noRewardEl = stageNoRewardChecks[idx];
                    if (noRewardEl && noRewardEl.checked) {
                        reward.stages.push({ count: 0, color: '黑', noReward: true });
                    } else {
                        const count = parseInt(countEl?.value) || 1;
                        const color = colorEl?.value || '金';
                        reward.stages.push({ count: Math.max(0, count), color, noReward: false });
                    }
                });
            }
        } else {
            reward = { total: { count: 0, color: '黑' }, stages: stageList.map(() => ({ count: 0, color: '黑', noReward: true })) };
        }

        // ----- 5. 其他 -----
        const viewableEl = document.getElementById('pt-viewable');
        const isViewable = viewableEl ? viewableEl.checked : false;

        // ----- 6. 构建 formData -----
        const formData = {
            type: type,
            primaryLabel: primaryLabel,
            primaryColor: primaryColor,
            secondaryTitle: secondaryTitle,
            date: type === 'plan' ? startDate : (isRepeating ? startDate : startDate),
            startDate: startDate,
            endDate: endDate,
            stages: stages,
            isRepeating: isRepeating,
            repeatType: repeatType,
            repeatDays: repeatDays,
            repeatInterval: repeatInterval,
            repeatEndDate: repeatEndDate,
            reward: reward,
            noReward: noReward,
            isViewable: isViewable,
            status: 'active'
        };

        // ----- 7. 保存 -----
        const success = saveNewItem(formData);
        if (success) {
            // 关闭模态框
            const overlay = document.getElementById('plan-todo-create-overlay');
            if (overlay) overlay.remove();

            // 刷新卡片
            const currentDate = document.querySelector('.calendar-day.selected');
            if (currentDate) {
                const day = currentDate.dataset.day;
                const month = currentDate.dataset.month;
                const year = currentDate.dataset.year;
                const dateStr = year + '-' + String(parseInt(month) + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0');
                if (typeof window.updatePlanTodoCards === 'function') {
                    window.updatePlanTodoCards(dateStr);
                }
            } else {
                // 刷新当前显示的日期
                const label = document.getElementById('comp-records-month-label');
                if (label) {
                    const match = label.textContent.match(/(\d{4})年(\d{2})月/);
                    if (match) {
                        const dateStr = match[1] + '-' + match[2] + '-01';
                        if (typeof window.updatePlanTodoCards === 'function') {
                            window.updatePlanTodoCards(dateStr);
                        }
                    }
                }
            }
        }
    }

    // ============================================================
    // 外部接口：更新卡片
    // ============================================================
window.updatePlanTodoCards = function (dateStr) {
    // 1. 获取日历面板容器
    var panel = document.getElementById('comp-records-calendar-panel');
    if (!panel) {
        console.warn('[plan-todo] 未找到日历面板');
        return;
    }

    // 2. 获取 grid（用于定位插入位置）
    var grid = document.getElementById('comp-records-grid');
    if (!grid) {
        console.warn('[plan-todo] 未找到日历网格');
        return;
    }

    // 3. 查找或创建容器
    var container = document.getElementById('plan-todo-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'plan-todo-container';
        container.style.cssText = 'display:flex;flex-direction:column;gap:10px;margin-top:12px;padding:0 2px;';
        // 插入到 grid 后面
        if (grid.nextSibling) {
            panel.insertBefore(container, grid.nextSibling);
        } else {
            panel.appendChild(container);
        }
    }

    // 4. 渲染卡片内容
    renderCards(dateStr);
};

    // ============================================================
    // 对外暴露：刷新函数（供月份切换等场景调用）
    // ============================================================
    window._refreshPlanTodo = function () {
        const selected = document.querySelector('.calendar-day.selected');
        if (selected) {
            const day = selected.dataset.day;
            const month = selected.dataset.month;
            const year = selected.dataset.year;
            const dateStr = year + '-' + String(parseInt(month) + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0');
            if (typeof window.updatePlanTodoCards === 'function') {
                window.updatePlanTodoCards(dateStr);
            }
        } else {
            // 默认选中第一天
            const firstDay = document.querySelector('.calendar-day[data-day="1"]');
            if (firstDay) {
                const day = firstDay.dataset.day;
                const month = firstDay.dataset.month;
                const year = firstDay.dataset.year;
                const dateStr = year + '-' + String(parseInt(month) + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0');
                if (typeof window.updatePlanTodoCards === 'function') {
                    window.updatePlanTodoCards(dateStr);
                }
            }
        }
    };

// 暴露状态计算函数供外部使用
window.calculateItemStatus = calculateItemStatus;
window.getStatusColor = getStatusColor;
window.getStatusIcon = getStatusIcon;
window.getStatusLabel = getStatusLabel;
window.expandRepeatDates = expandRepeatDates;
window.showPlanTodoDetail = showPlanTodoDetail;
window.openEditModal = openEditModal;
window.handlePauseRestart = handlePauseRestart;
window.handleComplete = handleComplete;
window.handleDeleteItem = handleDeleteItem;
window.getRepeatInstances = getRepeatInstances;
window.cleanupMeta = cleanupMeta;
window.openOverview = openOverview;
window.refreshCards = refreshCards;
window.handleStageComplete = handleStageComplete;
window.calculateStageStatus = calculateStageStatus;
window.getStageStatusLabel = getStageStatusLabel;
window.getStageStatusColor = getStageStatusColor;
window.openPlanTodoList = openPlanTodoList;
window._planTodoFeedback = FEEDBACK;

// ============================================================
// 获取月度待办统计数据（供陪伴月历调用）
// ============================================================
window.getMonthlyTodoStats = function(year, month) {
    // year: 年份数字, month: 月份数字 (0-11)
    const allData = getAllData();
    let totalTodos = 0;
    let completedTodos = 0;
    
    // 遍历所有日期
    for (const dateStr in allData) {
        const day = allData[dateStr];
        if (!day.todos) continue;
        
        // 检查该日期是否属于目标月份
        const dateParts = dateStr.split('-');
        const dYear = parseInt(dateParts[0]);
        const dMonth = parseInt(dateParts[1]) - 1; // 存储的是1-12，转为0-11
        if (dYear !== year || dMonth !== month) continue;
        
        // 统计该日期的待办
        day.todos.forEach(t => {
            // 只统计非重复待办，或重复待办中属于该月日的实例
            if (t.isRepeating) {
                // 重复待办：检查该日期是否在重复实例中
                const allDates = expandRepeatDates(t);
                if (allDates.includes(dateStr)) {
                    totalTodos++;
                    if (t.status === 'completed') completedTodos++;
                }
            } else {
                // 非重复待办：直接统计
                totalTodos++;
                if (t.status === 'completed') completedTodos++;
            }
        });
    }
    
    return {
        total: totalTodos,
        completed: completedTodos
    };
};

    console.log('[plan-todo] 完整模块已加载（含新建功能）');
})();


// ============================================================
// 颜色选择器交互（更新版 - 支持实时预览）
// ============================================================
let selectedColor = '#3498DB';

window.toggleColorPicker = function() {
    const dropdown = document.getElementById('pt-color-dropdown');
    if (dropdown) {
        dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
    }
};

window.selectColor = function(colorHex) {
    selectedColor = colorHex;
    const preview = document.getElementById('pt-color-preview');
    const customHex = document.getElementById('pt-custom-color-hex');
    const customInput = document.getElementById('pt-custom-color-input');
    const customPreview = document.getElementById('pt-custom-color-preview');
    const dropdown = document.getElementById('pt-color-dropdown');
    
    if (preview) preview.style.background = colorHex;
    if (customHex) customHex.value = colorHex;
    if (customInput) customInput.value = colorHex;
    if (customPreview) customPreview.style.background = colorHex;
    if (dropdown) dropdown.style.display = 'none';
    
    // 同步到隐藏的 color picker 值（用于保存）
    const hiddenPicker = document.getElementById('pt-primary-color-picker');
    if (hiddenPicker) hiddenPicker.value = colorHex;
};

// 自定义 HEX 输入框实时预览（输入时自动更新预览色块）
document.addEventListener('input', function(e) {
    if (e.target.id === 'pt-custom-color-hex') {
        const val = e.target.value.trim();
        // 简单验证是否为有效的 hex 颜色
        if (/^#[0-9a-fA-F]{6}$/.test(val)) {
            const preview = document.getElementById('pt-custom-color-preview');
            if (preview) preview.style.background = val;
            // 同步更新主色块
            const mainPreview = document.getElementById('pt-color-preview');
            if (mainPreview) mainPreview.style.background = val;
            selectedColor = val;
        }
    }
});

// 点击其他地方关闭下拉
document.addEventListener('click', function(e) {
    const dropdown = document.getElementById('pt-color-dropdown');
    const preview = document.getElementById('pt-color-preview');
    if (dropdown && preview) {
        if (!dropdown.contains(e.target) && !preview.contains(e.target)) {
            dropdown.style.display = 'none';
        }
    }
});