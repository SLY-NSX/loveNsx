/**
 * ============================================================
 *  📌 便利贴留言板 - Sticky Board
 *  独立功能模块，不依赖主聊天逻辑
 * ============================================================
 */

// ─── 数据结构 ──────────────────────────────────────────────
// 每条便利贴：
// {
//   id: string,
//   color: 'yellow' | 'blue' | 'pink' | 'green' | 'orange' | 'purple',
//   messages: [
//     { id: string, text: string, role: 'user' | 'partner', timestamp: number }
//   ],
//   isActive: true,        // true=可被回复，false=已结束
//   createdAt: number
// }

// ─── 状态 ──────────────────────────────────────────────────
let stickyNotes = [];                    // 所有便利贴
let currentStickyColor = 'yellow';       // 当前选中的颜色
let viewingStickyId = null;              // 正在查看详情的便利贴ID
let isStickyBoardOpen = false;           // 留言板是否打开

// ─── 颜色配置 ──────────────────────────────────────────────
const STICKY_COLORS = {
    yellow: { bg: '#FFF9C4', border: '#F9D976', shadow: 'rgba(249,217,118,0.4)', text: '#5D4E37' },
    blue: { bg: '#BBDEFB', border: '#64B5F6', shadow: 'rgba(100,181,246,0.4)', text: '#1A237E' },
    pink: { bg: '#F8BBD0', border: '#F06292', shadow: 'rgba(240,98,146,0.4)', text: '#880E4F' },
    green: { bg: '#C8E6C9', border: '#81C784', shadow: 'rgba(129,199,132,0.4)', text: '#1B5E20' },
    orange: { bg: '#FFE0B2', border: '#FFB74D', shadow: 'rgba(255,183,77,0.4)', text: '#E65100' },
    purple: { bg: '#E1BEE7', border: '#BA68C8', shadow: 'rgba(186,104,200,0.4)', text: '#4A148C' },
};

// ─── DOM 引用 ──────────────────────────────────────────────
let stickyBoardModal = null;
let stickyBoardContent = null;

// ─── 初始化 ──────────────────────────────────────────────────
async function initStickyBoard() {
    // 加载数据
    await loadStickyNotes();
    
    // 绑定入口点击
    const entryBtn = document.getElementById('sticky-board-function');
    if (entryBtn) {
        entryBtn.addEventListener('click', openStickyBoard);
    }
}

// ─── 数据持久化 ──────────────────────────────────────────
function getStickyStorageKey() {
    return `${APP_PREFIX}${SESSION_ID}_stickyNotes`;
}

async function loadStickyNotes() {
    try {
        const data = await localforage.getItem(getStickyStorageKey());
        if (data && Array.isArray(data)) {
            stickyNotes = data;
        } else {
            stickyNotes = [];
        }
    } catch (e) {
        stickyNotes = [];
    }
}

async function saveStickyNotes() {
    try {
        await localforage.setItem(getStickyStorageKey(), stickyNotes);
    } catch (e) {
        console.warn('[StickyBoard] 保存失败', e);
    }
}

// ─── 打开留言板 ──────────────────────────────────────────
function openStickyBoard() {
    if (isStickyBoardOpen) return;
    isStickyBoardOpen = true;
    
    // 创建模态框（如果不存在）
    if (!stickyBoardModal) {
        createStickyBoardModal();
    }
    
    // 渲染
    renderStickyBoard();
    stickyBoardModal.style.display = 'flex';
    showModal(stickyBoardModal);
}

function closeStickyBoard() {
    if (stickyBoardModal) {
        hideModal(stickyBoardModal);
        isStickyBoardOpen = false;
    }
}

// ─── 创建模态框 ──────────────────────────────────────────
function createStickyBoardModal() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'sticky-board-modal';
    modal.style.zIndex = '9999';
    
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 720px; max-height: 88vh; padding: 0; overflow: hidden; display: flex; flex-direction: column; background: var(--secondary-bg); border-radius: 20px;">
            <!-- 顶部栏 -->
            <div style="display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid var(--border-color); flex-shrink: 0; background: var(--primary-bg); border-radius: 20px 20px 0 0;">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="font-size: 20px;">📌</span>
                    <span style="font-size: 16px; font-weight: 700; color: var(--text-primary);">留言板</span>
                    <span id="sticky-count-badge" style="font-size: 11px; color: var(--text-secondary); background: var(--border-color); padding: 1px 10px; border-radius: 20px;"></span>
                </div>
                <button id="sticky-close-btn" style="background: none; border: none; font-size: 20px; color: var(--text-secondary); cursor: pointer; padding: 4px 8px;">×</button>
            </div>
            
            <!-- 创建新便利贴区域 -->
            <div style="padding: 16px 20px; border-bottom: 1px solid var(--border-color); flex-shrink: 0; background: var(--primary-bg);">
                <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
                    <textarea id="sticky-new-input" placeholder="随手写点什么..." style="flex: 1; min-width: 160px; padding: 10px 14px; border: 1.5px solid var(--border-color); border-radius: 12px; background: var(--primary-bg); color: var(--text-primary); font-size: 14px; font-family: var(--font-family); resize: none; height: 44px; outline: none; transition: border-color 0.2s; box-sizing: border-box;"></textarea>
                    
                    <div style="display: flex; gap: 6px; align-items: center; flex-shrink: 0;">
                        <!-- 颜色选择器 -->
                        <div style="display: flex; gap: 4px;" id="sticky-color-picker">
                            ${Object.keys(STICKY_COLORS).map(c => `
                                <div class="sticky-color-dot" data-color="${c}" style="width: 26px; height: 26px; border-radius: 50%; background: ${STICKY_COLORS[c].bg}; border: 2.5px solid ${c === currentStickyColor ? 'var(--accent-color)' : STICKY_COLORS[c].border}; cursor: pointer; transition: all 0.2s; flex-shrink: 0;"></div>
                            `).join('')}
                        </div>
                        <button id="sticky-add-btn" style="padding: 10px 18px; border: none; border-radius: 12px; background: var(--accent-color); color: #fff; font-size: 14px; font-weight: 600; cursor: pointer; font-family: var(--font-family); white-space: nowrap; transition: opacity 0.2s;">
                            <i class="fas fa-plus" style="margin-right: 4px;"></i> 贴上去
                        </button>
                    </div>
                </div>
            </div>
            
            <!-- 便利贴列表（滚动区域） -->
            <div id="sticky-list-container" style="flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-wrap: wrap; gap: 20px; align-content: flex-start; background: var(--primary-bg); min-height: 200px;">
                <!-- 由 JS 渲染 -->
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    stickyBoardModal = modal;
    stickyBoardContent = modal.querySelector('#sticky-list-container');
    
    // ─── 事件绑定 ──────────────────────────────────────────
    // 关闭
    modal.querySelector('#sticky-close-btn').addEventListener('click', closeStickyBoard);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeStickyBoard();
    });
    
    // 颜色选择
    modal.querySelectorAll('.sticky-color-dot').forEach(el => {
        el.addEventListener('click', () => {
            currentStickyColor = el.dataset.color;
            modal.querySelectorAll('.sticky-color-dot').forEach(d => {
                d.style.borderColor = d.dataset.color === currentStickyColor ? 'var(--accent-color)' : STICKY_COLORS[d.dataset.color].border;
            });
        });
    });
    
    // 添加便利贴
    modal.querySelector('#sticky-add-btn').addEventListener('click', () => {
        const input = modal.querySelector('#sticky-new-input');
        const text = input.value.trim();
        if (!text) {
            showNotification('写点什么再贴吧 ✦', 'info', 1500);
            return;
        }
        addStickyNote(text, currentStickyColor);
        input.value = '';
        input.style.height = '44px';
        renderStickyBoard();
    });
    
    // 回车快捷添加（Shift+Enter 换行）
    const input = modal.querySelector('#sticky-new-input');
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            modal.querySelector('#sticky-add-btn').click();
        }
    });
    
    // 自动调整高度
    input.addEventListener('input', () => {
        input.style.height = '44px';
        input.style.height = Math.min(input.scrollHeight, 120) + 'px';
    });
}

// ─── 添加便利贴 ──────────────────────────────────────────
function addStickyNote(text, color) {
    const note = {
        id: 'sticky_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        color: color || 'yellow',
        messages: [
            {
                id: 'msg_' + Date.now(),
                text: text,
                role: 'user',
                timestamp: Date.now()
            }
        ],
        isActive: true,
        createdAt: Date.now()
    };
    stickyNotes.unshift(note); // 最新的放最前面
    saveStickyNotes();
}

// ─── 渲染留言板 ──────────────────────────────────────────
function renderStickyBoard() {
    const container = stickyBoardContent;
    if (!container) return;
    
    const countBadge = document.getElementById('sticky-count-badge');
    if (countBadge) {
        countBadge.textContent = stickyNotes.length + ' 张';
    }
    
    if (stickyNotes.length === 0) {
        container.innerHTML = `
            <div style="width: 100%; text-align: center; padding: 60px 20px; color: var(--text-secondary);">
                <div style="font-size: 48px; opacity: 0.3; margin-bottom: 16px;">📌</div>
                <div style="font-size: 14px;">还没有留言呢</div>
                <div style="font-size: 12px; opacity: 0.6; margin-top: 4px;">在上面写点什么，贴到留言板上吧</div>
            </div>
        `;
        return;
    }
    
    let html = '';
    stickyNotes.forEach(note => {
        const color = STICKY_COLORS[note.color] || STICKY_COLORS.yellow;
        const firstMsg = note.messages[0];
        const msgCount = note.messages.length;
        const isActive = note.isActive !== false;
        
        // 取前两条消息预览
        const previewMsgs = note.messages.slice(0, 2);
        
        html += `
            <div class="sticky-note-card" data-id="${note.id}" style="
                width: 200px;
                min-height: 160px;
                background: ${color.bg};
                border: 2px solid ${color.border};
                border-radius: 12px;
                padding: 16px 14px 12px;
                box-shadow: 4px 6px 16px ${color.shadow}, 0 2px 4px rgba(0,0,0,0.04);
                position: relative;
                transform: rotate(${(Math.random() - 0.5) * 2.5}deg);
                transition: transform 0.2s ease, box-shadow 0.2s ease;
                cursor: pointer;
                flex-shrink: 0;
                display: flex;
                flex-direction: column;
            ">
                <!-- 图钉 -->
                <div style="position: absolute; top: -8px; left: 50%; transform: translateX(-50%); font-size: 22px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));">
                    📌
                </div>
                
                <!-- 删除按钮 -->
                <div class="sticky-delete-btn" data-id="${note.id}" style="
                    position: absolute; top: 6px; right: 8px;
                    width: 22px; height: 22px;
                    border-radius: 50%;
                    background: rgba(0,0,0,0.06);
                    border: none;
                    color: ${color.text};
                    font-size: 12px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    opacity: 0;
                    transition: opacity 0.2s, background 0.2s;
                    font-family: var(--font-family);
                    line-height: 1;
                ">×</div>
                
                <!-- 消息预览 -->
                <div style="flex: 1; display: flex; flex-direction: column; gap: 6px; margin-top: 6px;">
                    ${previewMsgs.map((msg, idx) => {
                        const isUser = msg.role === 'user';
                        return `
                            <div style="
                                font-size: ${isUser ? '13px' : '14px'};
                                font-family: 'Caveat', 'Patrick Hand', cursive;
                                color: ${isUser ? '#2C2C2C' : '#4A7CF7'};
                                font-style: italic;
                                text-align: ${isUser ? 'right' : 'left'};
                                transform: ${isUser ? 'rotate(0.5deg)' : 'rotate(-0.3deg)'};
                                line-height: 1.4;
                                ${idx > 0 ? 'opacity: 0.8;' : ''}
                                ${idx > 0 ? 'font-size: 12px;' : ''}
                                word-break: break-word;
                                overflow: hidden;
                                display: -webkit-box;
                                -webkit-line-clamp: 2;
                                -webkit-box-orient: vertical;
                            ">
                                ${isUser ? '✧ ' : '✦ '}${escapeHtml(msg.text)}
                            </div>
                        `;
                    }).join('')}
                </div>
                
                <!-- 底部信息 -->
                <div style="
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-top: 10px;
                    padding-top: 8px;
                    border-top: 1px solid rgba(0,0,0,0.06);
                    font-size: 10px;
                    color: ${color.text};
                    opacity: 0.6;
                ">
                    <span>${msgCount} 条${!isActive ? ' · 已结束' : ''}</span>
                    <span>${isActive ? '💬 可回复' : '🔒 已结束'}</span>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
    
    // ─── 事件绑定 ──────────────────────────────────────────
    // 点击便利贴 → 打开详情
    container.querySelectorAll('.sticky-note-card').forEach(el => {
        el.addEventListener('click', (e) => {
            // 如果点的是删除按钮，不触发详情
            if (e.target.closest('.sticky-delete-btn')) return;
            const id = el.dataset.id;
            openStickyDetail(id);
        });
        
        // 悬停显示删除按钮
        el.addEventListener('mouseenter', () => {
            const delBtn = el.querySelector('.sticky-delete-btn');
            if (delBtn) delBtn.style.opacity = '1';
        });
        el.addEventListener('mouseleave', () => {
            const delBtn = el.querySelector('.sticky-delete-btn');
            if (delBtn) delBtn.style.opacity = '0';
        });
    });
    
    // 删除按钮
    container.querySelectorAll('.sticky-delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = btn.dataset.id;
            if (confirm('确定要删除这张便利贴吗？所有留言将一并删除。')) {
                deleteStickyNote(id);
            }
        });
    });
}

// ─── 删除便利贴 ──────────────────────────────────────────
function deleteStickyNote(id) {
    stickyNotes = stickyNotes.filter(n => n.id !== id);
    saveStickyNotes();
    renderStickyBoard();
    showNotification('已删除', 'success', 1200);
}

// ─── 打开便利贴详情 ──────────────────────────────────────
function openStickyDetail(id) {
    const note = stickyNotes.find(n => n.id === id);
    if (!note) {
        showNotification('便利贴不存在', 'error');
        return;
    }
    viewingStickyId = id;
    
    // 创建详情模态框（如果不存在）
    let detailModal = document.getElementById('sticky-detail-modal');
    if (!detailModal) {
        detailModal = createStickyDetailModal();
    }
    
    renderStickyDetail(note, detailModal);
    detailModal.style.display = 'flex';
    showModal(detailModal);
}

function createStickyDetailModal() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'sticky-detail-modal';
    modal.style.zIndex = '10000';
    
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 480px; max-height: 85vh; padding: 0; overflow: hidden; display: flex; flex-direction: column; background: transparent; border-radius: 20px;">
            <div id="sticky-detail-inner" style="background: var(--secondary-bg); border-radius: 20px; overflow: hidden; display: flex; flex-direction: column; max-height: 85vh;">
                <!-- 顶部 -->
                <div style="display: flex; align-items: center; justify-content: space-between; padding: 14px 20px; border-bottom: 1px solid var(--border-color); flex-shrink: 0; background: var(--primary-bg);">
                    <span style="font-size: 14px; font-weight: 600; color: var(--text-primary);">📌 留言详情</span>
                    <button id="sticky-detail-close-btn" style="background: none; border: none; font-size: 20px; color: var(--text-secondary); cursor: pointer; padding: 4px 8px;">×</button>
                </div>
                
                <!-- 消息列表 -->
                <div id="sticky-detail-messages" style="flex: 1; overflow-y: auto; padding: 16px 20px; display: flex; flex-direction: column; gap: 10px; background: var(--primary-bg); min-height: 120px;"></div>
                
                <!-- 底部操作栏 -->
                <div style="padding: 12px 20px; border-top: 1px solid var(--border-color); flex-shrink: 0; background: var(--primary-bg); display: flex; flex-direction: column; gap: 10px;">
                    <!-- 输入区 -->
                    <div style="display: flex; gap: 8px;">
                        <textarea id="sticky-detail-input" placeholder="补充内容..." style="flex: 1; padding: 8px 12px; border: 1.5px solid var(--border-color); border-radius: 10px; background: var(--secondary-bg); color: var(--text-primary); font-size: 14px; font-family: var(--font-family); resize: none; height: 40px; outline: none; transition: border-color 0.2s; box-sizing: border-box;"></textarea>
                        <button id="sticky-detail-add-btn" style="padding: 8px 16px; border: none; border-radius: 10px; background: var(--accent-color); color: #fff; font-size: 13px; font-weight: 600; cursor: pointer; font-family: var(--font-family); white-space: nowrap;">补充</button>
                    </div>
                    <!-- 操作按钮 -->
                    <div style="display: flex; gap: 8px; justify-content: flex-end;">
                        <button id="sticky-detail-over-btn" style="padding: 8px 18px; border: 1.5px solid #e57373; border-radius: 10px; background: transparent; color: #e57373; font-size: 12px; font-weight: 600; cursor: pointer; font-family: var(--font-family);">结束</button>
                        <button id="sticky-detail-reopen-btn" style="display: none; padding: 8px 18px; border: 1.5px solid var(--accent-color); border-radius: 10px; background: transparent; color: var(--accent-color); font-size: 12px; font-weight: 600; cursor: pointer; font-family: var(--font-family);">重新开启</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // ─── 事件绑定 ──────────────────────────────────────────
    modal.querySelector('#sticky-detail-close-btn').addEventListener('click', () => {
        hideModal(modal);
        viewingStickyId = null;
    });
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            hideModal(modal);
            viewingStickyId = null;
        }
    });
    
    // 补充
    modal.querySelector('#sticky-detail-add-btn').addEventListener('click', () => {
        const input = modal.querySelector('#sticky-detail-input');
        const text = input.value.trim();
        if (!text) return;
        const note = stickyNotes.find(n => n.id === viewingStickyId);
        if (!note) return;
        note.messages.push({
            id: 'msg_' + Date.now(),
            text: text,
            role: 'user',
            timestamp: Date.now()
        });
        saveStickyNotes();
        input.value = '';
        input.style.height = '40px';
        renderStickyDetail(note, modal);
        renderStickyBoard(); // 更新列表预览
    });
    
    // 回车补充
    const input = modal.querySelector('#sticky-detail-input');
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            modal.querySelector('#sticky-detail-add-btn').click();
        }
    });
    input.addEventListener('input', () => {
        input.style.height = '40px';
        input.style.height = Math.min(input.scrollHeight, 100) + 'px';
    });
    
    // 结束
    modal.querySelector('#sticky-detail-over-btn').addEventListener('click', () => {
        const note = stickyNotes.find(n => n.id === viewingStickyId);
        if (!note) return;
        if (note.isActive === false) return;
        if (confirm('确定要结束这张便利贴吗？对方将不再回复。')) {
            note.isActive = false;
            saveStickyNotes();
            renderStickyDetail(note, modal);
            renderStickyBoard();
            showNotification('已结束', 'info', 1500);
        }
    });
    
    // 重新开启
    modal.querySelector('#sticky-detail-reopen-btn').addEventListener('click', () => {
        const note = stickyNotes.find(n => n.id === viewingStickyId);
        if (!note) return;
        note.isActive = true;
        saveStickyNotes();
        renderStickyDetail(note, modal);
        renderStickyBoard();
        showNotification('已重新开启', 'success', 1500);
    });
    
    return modal;
}

// ─── 渲染便利贴详情 ──────────────────────────────────────
function renderStickyDetail(note, modal) {
    const container = modal.querySelector('#sticky-detail-messages');
    const color = STICKY_COLORS[note.color] || STICKY_COLORS.yellow;
    const isActive = note.isActive !== false;
    
    // 更新按钮状态
    const overBtn = modal.querySelector('#sticky-detail-over-btn');
    const reopenBtn = modal.querySelector('#sticky-detail-reopen-btn');
    if (isActive) {
        overBtn.style.display = 'inline-block';
        reopenBtn.style.display = 'none';
        overBtn.textContent = '结束';
    } else {
        overBtn.style.display = 'none';
        reopenBtn.style.display = 'inline-block';
    }
    
    // 更新输入框占位
    const input = modal.querySelector('#sticky-detail-input');
    input.placeholder = isActive ? '补充内容...' : '已结束，无法补充';
    input.disabled = !isActive;
    modal.querySelector('#sticky-detail-add-btn').style.opacity = isActive ? '1' : '0.4';
    modal.querySelector('#sticky-detail-add-btn').style.pointerEvents = isActive ? 'auto' : 'none';
    
    if (note.messages.length === 0) {
        container.innerHTML = `<div style="text-align: center; color: var(--text-secondary); font-size: 13px; padding: 20px 0;">还没有留言内容</div>`;
        return;
    }
    
    let html = '';
    note.messages.forEach((msg, idx) => {
        const isUser = msg.role === 'user';
        const isFirst = idx === 0;
        const isLast = idx === note.messages.length - 1;
        
        // 不同角色使用不同样式
        html += `
            <div style="
                display: flex;
                flex-direction: column;
                align-items: ${isUser ? 'flex-end' : 'flex-start'};
                ${idx > 0 ? 'margin-top: 4px;' : ''}
            ">
                <div style="
                    font-size: ${isUser ? '15px' : '16px'};
                    font-family: 'Caveat', 'Patrick Hand', cursive;
                    color: ${isUser ? '#2C2C2C' : '#4A7CF7'};
                    font-style: italic;
                    text-align: ${isUser ? 'right' : 'left'};
                    transform: ${isUser ? 'rotate(0.5deg)' : 'rotate(-0.3deg)'};
                    line-height: 1.5;
                    background: ${isUser ? 'rgba(0,0,0,0.04)' : 'rgba(74,124,247,0.06)'};
                    padding: ${isUser ? '8px 14px 8px 18px' : '8px 18px 8px 14px'};
                    border-radius: ${isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px'};
                    max-width: 85%;
                    word-break: break-word;
                    white-space: pre-wrap;
                    border: 1px solid ${isUser ? 'rgba(0,0,0,0.06)' : 'rgba(74,124,247,0.15)'};
                    ${isFirst ? 'font-size: 17px; font-weight: 500;' : ''}
                ">
                    ${escapeHtml(msg.text)}
                </div>
                ${isLast && isActive ? `
                    <div style="font-size: 10px; color: var(--text-secondary); opacity: 0.5; margin-top: 2px; ${isUser ? 'margin-right: 4px;' : 'margin-left: 4px;'}">
                        ${isUser ? '我 · 等待回复中...' : '对方 · 可继续补充'}
                    </div>
                ` : ''}
            </div>
        `;
    });
    
    container.innerHTML = html;
    container.scrollTop = container.scrollHeight;
}

// ─── 工具：HTML 转义 ──────────────────────────────────────
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ─── 监听：外部打开（从设置入口调用） ──────────────────
// 在 app.js 或 listeners.js 中，入口已经绑定

// ─── 导出让全局可用 ──────────────────────────────────────
window.initStickyBoard = initStickyBoard;
window.openStickyBoard = openStickyBoard;
window.closeStickyBoard = closeStickyBoard;
window.addStickyNote = addStickyNote;
window.deleteStickyNote = deleteStickyNote;
window.renderStickyBoard = renderStickyBoard;

// ─── 自动初始化 ──────────────────────────────────────────
// 在页面加载完成后，由 app.js 或 core.js 调用
// 如果 SESSION_ID 已就绪，立即初始化
if (typeof SESSION_ID !== 'undefined' && SESSION_ID) {
    initStickyBoard();
}

console.log('[StickyBoard] 模块已加载 ✓');