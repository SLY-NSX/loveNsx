/**
 * ============================================================
 *  📌 便利贴留言板 - Sticky Board
 *  真实软木板风格
 * ============================================================
 */

// ─── 数据结构 ──────────────────────────────────────────────
// {
//   id: string,
//   color: 'yellow' | 'blue' | 'pink' | 'green' | 'orange' | 'purple',
//   messages: [
//     { id: string, text: string, role: 'user' | 'partner', timestamp: number }
//   ],
//   isActive: true,
//   createdAt: number
// }

// ─── 状态 ──────────────────────────────────────────────────
let stickyNotes = [];
let currentStickyColor = 'yellow';
let viewingStickyId = null;
let isStickyBoardOpen = false;

// ─── 颜色配置（更真实的便利贴色） ──────────────────────
const STICKY_COLORS = {
    yellow: { bg: '#FFF9C4', border: '#F9D976', text: '#5D4E37', pin: '#E53935' },
    blue: { bg: '#BBDEFB', border: '#64B5F6', text: '#1A237E', pin: '#1E88E5' },
    pink: { bg: '#F8BBD0', border: '#F06292', text: '#880E4F', pin: '#E91E63' },
    green: { bg: '#C8E6C9', border: '#81C784', text: '#1B5E20', pin: '#43A047' },
    orange: { bg: '#FFE0B2', border: '#FFB74D', text: '#E65100', pin: '#FB8C00' },
    purple: { bg: '#E1BEE7', border: '#BA68C8', text: '#4A148C', pin: '#8E24AA' },
};

// ─── 贴纸样式（代替图钉） ──────────────────────────────────
const STICKER_STYLES = [
    { emoji: '🌸', label: '花朵' },
    { emoji: '⭐', label: '星星' },
    { emoji: '❤️', label: '爱心' },
    { emoji: '🍀', label: '四叶草' },
    { emoji: '🌈', label: '彩虹' },
    { emoji: '🦋', label: '蝴蝶' },
];

// ─── DOM 引用 ──────────────────────────────────────────────
let stickyBoardModal = null;
let stickyBoardContent = null;

// ─── 初始化 ──────────────────────────────────────────────────
async function initStickyBoard() {
    await loadStickyNotes();
    
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
    
    if (!stickyBoardModal) {
        createStickyBoardModal();
    }
    
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

// ─── 创建模态框（软木板风格） ──────────────────────────
function createStickyBoardModal() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'sticky-board-modal';
    modal.style.zIndex = '9999';
    
    modal.innerHTML = `
        <div class="modal-content" style="
            max-width: 820px; 
            max-height: 90vh; 
            padding: 0; 
            overflow: hidden; 
            display: flex; 
            flex-direction: column; 
            background: transparent;
            border-radius: 0;
            box-shadow: none;
        ">
            <!-- 软木板背景 -->
            <div style="
                position: relative;
                background: #C4A882;
                background-image: 
                    repeating-linear-gradient(
                        0deg,
                        rgba(0,0,0,0.03) 0px,
                        rgba(0,0,0,0.03) 1px,
                        transparent 1px,
                        transparent 3px
                    ),
                    repeating-linear-gradient(
                        90deg,
                        rgba(0,0,0,0.02) 0px,
                        rgba(0,0,0,0.02) 1px,
                        transparent 1px,
                        transparent 4px
                    );
                border-radius: 16px;
                padding: 20px 20px 16px;
                border: 6px solid #8B7355;
                box-shadow: 
                    inset 0 0 60px rgba(0,0,0,0.15),
                    0 8px 32px rgba(0,0,0,0.3);
                flex: 1;
                display: flex;
                flex-direction: column;
                min-height: 60vh;
                max-height: 90vh;
            ">
                <!-- 顶部栏（半透明毛玻璃） -->
                <div style="
                    display: flex; 
                    align-items: center; 
                    justify-content: space-between; 
                    padding: 10px 16px;
                    background: rgba(255,255,255,0.15);
                    backdrop-filter: blur(8px);
                    -webkit-backdrop-filter: blur(8px);
                    border-radius: 12px;
                    margin-bottom: 16px;
                    flex-shrink: 0;
                    border: 1px solid rgba(255,255,255,0.2);
                ">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span style="font-size: 18px;">📌</span>
                        <span style="font-size: 15px; font-weight: 700; color: #fff; text-shadow: 0 1px 4px rgba(0,0,0,0.3);">留言板</span>
                        <span id="sticky-count-badge" style="font-size: 11px; color: rgba(255,255,255,0.7); background: rgba(0,0,0,0.2); padding: 1px 12px; border-radius: 20px;"></span>
                    </div>
                    <button id="sticky-close-btn" style="background: rgba(255,255,255,0.2); border: none; font-size: 18px; color: #fff; cursor: pointer; padding: 4px 10px; border-radius: 8px; transition: background 0.2s;">×</button>
                </div>
                
                <!-- 创建新便利贴区域（毛玻璃） -->
                <div style="
                    padding: 14px 16px;
                    background: rgba(255,255,255,0.12);
                    backdrop-filter: blur(6px);
                    -webkit-backdrop-filter: blur(6px);
                    border-radius: 12px;
                    margin-bottom: 16px;
                    flex-shrink: 0;
                    border: 1px solid rgba(255,255,255,0.15);
                ">
                    <div style="display: flex; gap: 10px; align-items: flex-start; flex-wrap: wrap;">
                        <textarea id="sticky-new-input" placeholder="写点什么贴上去..." style="
                            flex: 1; 
                            min-width: 140px; 
                            padding: 10px 14px; 
                            border: none; 
                            border-radius: 10px; 
                            background: rgba(255,255,255,0.85); 
                            color: #2C2C2C; 
                            font-size: 14px; 
                            font-family: var(--font-family); 
                            resize: none; 
                            height: 42px; 
                            outline: none; 
                            box-sizing: border-box;
                            backdrop-filter: blur(4px);
                        "></textarea>
                        
                        <div style="display: flex; gap: 6px; align-items: center; flex-shrink: 0; flex-wrap: wrap;">
                            <!-- 颜色选择器 -->
                            <div style="display: flex; gap: 4px;" id="sticky-color-picker">
                                ${Object.keys(STICKY_COLORS).map(c => `
                                    <div class="sticky-color-dot" data-color="${c}" style="
                                        width: 28px; 
                                        height: 28px; 
                                        border-radius: 4px; 
                                        background: ${STICKY_COLORS[c].bg}; 
                                        border: 2.5px solid ${c === currentStickyColor ? '#fff' : STICKY_COLORS[c].border}; 
                                        cursor: pointer; 
                                        transition: all 0.2s; 
                                        flex-shrink: 0;
                                        box-shadow: ${c === currentStickyColor ? '0 0 0 2px rgba(255,255,255,0.5)' : 'none'};
                                    "></div>
                                `).join('')}
                            </div>
                            <button id="sticky-add-btn" style="
                                padding: 10px 20px; 
                                border: none; 
                                border-radius: 10px; 
                                background: #fff; 
                                color: #5D4E37; 
                                font-size: 13px; 
                                font-weight: 600; 
                                cursor: pointer; 
                                font-family: var(--font-family); 
                                white-space: nowrap; 
                                transition: transform 0.15s, box-shadow 0.15s;
                                box-shadow: 0 2px 8px rgba(0,0,0,0.15);
                            ">
                                ✏️ 贴一张
                            </button>
                        </div>
                    </div>
                </div>
                
                <!-- 便利贴列表（软木板上的便利贴） -->
                <div id="sticky-list-container" style="
                    flex: 1; 
                    overflow-y: auto; 
                    padding: 12px 8px; 
                    display: flex; 
                    flex-wrap: wrap; 
                    gap: 24px 30px; 
                    align-content: flex-start; 
                    min-height: 200px;
                    scroll-behavior: smooth;
                ">
                    <!-- 由 JS 渲染 -->
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    stickyBoardModal = modal;
    stickyBoardContent = modal.querySelector('#sticky-list-container');
    
    // ─── 事件绑定 ──────────────────────────────────────────
    modal.querySelector('#sticky-close-btn').addEventListener('click', closeStickyBoard);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeStickyBoard();
    });
    
    // 颜色选择
    modal.querySelectorAll('.sticky-color-dot').forEach(el => {
        el.addEventListener('click', () => {
            currentStickyColor = el.dataset.color;
            modal.querySelectorAll('.sticky-color-dot').forEach(d => {
                d.style.borderColor = d.dataset.color === currentStickyColor ? '#fff' : STICKY_COLORS[d.dataset.color].border;
                d.style.boxShadow = d.dataset.color === currentStickyColor ? '0 0 0 2px rgba(255,255,255,0.5)' : 'none';
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
        input.style.height = '42px';
        renderStickyBoard();
    });
    
    const input = modal.querySelector('#sticky-new-input');
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            modal.querySelector('#sticky-add-btn').click();
        }
    });
    input.addEventListener('input', () => {
        input.style.height = '42px';
        input.style.height = Math.min(input.scrollHeight, 100) + 'px';
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
    stickyNotes.unshift(note);
    saveStickyNotes();
}

// ─── 渲染留言板（软木板上的便利贴） ──────────────────
function renderStickyBoard() {
    const container = stickyBoardContent;
    if (!container) return;
    
    const countBadge = document.getElementById('sticky-count-badge');
    if (countBadge) {
        countBadge.textContent = stickyNotes.length + ' 张';
    }
    
    if (stickyNotes.length === 0) {
        container.innerHTML = `
            <div style="
                width: 100%; 
                text-align: center; 
                padding: 60px 20px; 
                color: rgba(255,255,255,0.6);
                text-shadow: 0 1px 4px rgba(0,0,0,0.2);
            ">
                <div style="font-size: 52px; opacity: 0.5; margin-bottom: 12px;">📌</div>
                <div style="font-size: 15px; font-weight: 500;">还没有留言呢</div>
                <div style="font-size: 12px; opacity: 0.6; margin-top: 4px;">写点什么，贴到软木板上吧</div>
            </div>
        `;
        return;
    }
    
    let html = '';
    stickyNotes.forEach((note, index) => {
        const color = STICKY_COLORS[note.color] || STICKY_COLORS.yellow;
        const firstMsg = note.messages[0];
        const msgCount = note.messages.length;
        
        // 随机旋转（更自然）
        const rotation = ((index % 7) - 3) * 0.6 + (Math.random() - 0.5) * 0.8;
        
        // 随机偏移（更自然）
        const offsetX = ((index % 5) - 2) * 2;
        const offsetY = ((index % 4) - 1.5) * 2;
        
        // 随机贴纸
        const sticker = STICKER_STYLES[index % STICKER_STYLES.length];
        
        html += `
            <div class="sticky-note-card" data-id="${note.id}" style="
                width: 180px;
                min-height: 160px;
                background: ${color.bg};
                border: 2px solid ${color.border};
                border-radius: 6px;
                padding: 20px 16px 16px;
                box-shadow: 
                    0 4px 12px rgba(0,0,0,0.15),
                    inset 0 1px 0 rgba(255,255,255,0.6);
                position: relative;
                transform: rotate(${rotation}deg) translate(${offsetX}px, ${offsetY}px);
                transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.25s ease;
                cursor: pointer;
                flex-shrink: 0;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                text-align: center;
                box-sizing: border-box;
                font-family: 'Caveat', 'Patrick Hand', cursive;
            ">
                <!-- 贴纸（代替图钉，放在右上角） -->
                <div style="
                    position: absolute;
                    top: -8px;
                    right: -6px;
                    font-size: 22px;
                    filter: drop-shadow(0 2px 4px rgba(0,0,0,0.15));
                    transform: rotate(${(Math.random() - 0.5) * 20}deg);
                    pointer-events: none;
                    z-index: 2;
                ">
                    ${sticker.emoji}
                </div>
                
                <!-- 删除按钮（悬停显示） -->
                <div class="sticky-delete-btn" data-id="${note.id}" style="
                    position: absolute;
                    top: 4px;
                    left: 6px;
                    width: 20px;
                    height: 20px;
                    border-radius: 50%;
                    background: rgba(0,0,0,0.06);
                    border: none;
                    color: ${color.text};
                    font-size: 11px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    opacity: 0;
                    transition: opacity 0.2s, background 0.2s;
                    font-family: var(--font-family);
                    line-height: 1;
                    z-index: 3;
                ">×</div>
                
                <!-- 消息内容（大字居中） -->
                <div style="
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    width: 100%;
                    gap: 4px;
                ">
                    ${msgCount > 1 ? `
                        <div style="
                            font-size: 11px;
                            color: ${color.text};
                            opacity: 0.3;
                            font-family: var(--font-family);
                            font-style: normal;
                            margin-bottom: 4px;
                            letter-spacing: 0.5px;
                        ">
                            ${msgCount} 张留言
                        </div>
                    ` : ''}
                    <div style="
                        font-size: 20px;
                        font-weight: 500;
                        color: ${color.text};
                        line-height: 1.4;
                        word-break: break-word;
                        max-width: 100%;
                        padding: 0 2px;
                        font-family: 'Caveat', 'Patrick Hand', cursive;
                        ${msgCount > 1 ? 'opacity: 0.85;' : ''}
                    ">
                        ${escapeHtml(firstMsg.text)}
                    </div>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
    
    // ─── 事件绑定 ──────────────────────────────────────────
    container.querySelectorAll('.sticky-note-card').forEach(el => {
        el.addEventListener('click', (e) => {
            if (e.target.closest('.sticky-delete-btn')) return;
            const id = el.dataset.id;
            openStickyDetail(id);
        });
        
        // 悬停效果：放大
        el.addEventListener('mouseenter', () => {
            el.style.transform = `scale(1.05) rotate(${(parseFloat(el.style.transform?.match(/rotate\(([^)]+)\)/)?.[1] || 0)}deg)`;
            el.style.boxShadow = '0 8px 30px rgba(0,0,0,0.25)';
            el.style.zIndex = '10';
            const delBtn = el.querySelector('.sticky-delete-btn');
            if (delBtn) delBtn.style.opacity = '1';
        });
        el.addEventListener('mouseleave', () => {
            const rot = parseFloat(el.dataset.rotation || '0');
            el.style.transform = `rotate(${rot}deg)`;
            el.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.6)';
            el.style.zIndex = '1';
            const delBtn = el.querySelector('.sticky-delete-btn');
            if (delBtn) delBtn.style.opacity = '0';
        });
        // 记录旋转角度
        const match = el.style.transform.match(/rotate\(([^)]+)\)/);
        if (match) el.dataset.rotation = match[1];
    });
    
    // 删除按钮
    container.querySelectorAll('.sticky-delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = btn.dataset.id;
            if (confirm('确定要撕掉这张便利贴吗？')) {
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
    showNotification('已撕掉', 'success', 1200);
}

// ─── 打开便利贴详情（放大查看） ──────────────────────
function openStickyDetail(id) {
    const note = stickyNotes.find(n => n.id === id);
    if (!note) {
        showNotification('便利贴不存在', 'error');
        return;
    }
    viewingStickyId = id;
    
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
        <div class="modal-content" style="
            max-width: 420px;
            max-height: 85vh;
            padding: 0;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            background: transparent;
            border-radius: 0;
            box-shadow: none;
        ">
            <div id="sticky-detail-paper" style="
                background: #FFF9C4;
                border-radius: 8px;
                padding: 28px 24px 20px;
                box-shadow: 
                    0 12px 48px rgba(0,0,0,0.3),
                    inset 0 1px 0 rgba(255,255,255,0.8);
                border: 2px solid #F9D976;
                position: relative;
                max-height: 85vh;
                display: flex;
                flex-direction: column;
            ">
                <!-- 贴纸装饰 -->
                <div style="
                    position: absolute;
                    top: -6px;
                    right: 12px;
                    font-size: 28px;
                    filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1));
                    pointer-events: none;
                ">
                    ${STICKER_STYLES[Math.floor(Math.random() * STICKER_STYLES.length)].emoji}
                </div>
                
                <!-- 关闭按钮 -->
                <button id="sticky-detail-close-btn" style="
                    position: absolute;
                    top: 8px;
                    right: 10px;
                    background: none;
                    border: none;
                    font-size: 20px;
                    color: rgba(0,0,0,0.3);
                    cursor: pointer;
                    padding: 4px 8px;
                    transition: color 0.2s;
                    font-family: var(--font-family);
                    line-height: 1;
                    z-index: 5;
                ">×</button>
                
                <!-- 留言列表（可滚动） -->
                <div id="sticky-detail-messages" style="
                    flex: 1;
                    overflow-y: auto;
                    padding: 4px 0 12px;
                    display: flex;
                    flex-direction: column;
                    gap: 14px;
                    min-height: 120px;
                    max-height: 50vh;
                "></div>
                
                <!-- 底部操作栏 -->
                <div style="
                    padding-top: 14px;
                    border-top: 1.5px dashed rgba(0,0,0,0.08);
                    flex-shrink: 0;
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                ">
                    <!-- 输入区 -->
                    <div style="display: flex; gap: 8px;">
                        <textarea id="sticky-detail-input" placeholder="继续写..." style="
                            flex: 1;
                            padding: 8px 12px;
                            border: none;
                            border-radius: 6px;
                            background: rgba(255,255,255,0.5);
                            color: #2C2C2C;
                            font-size: 14px;
                            font-family: 'Caveat', 'Patrick Hand', cursive;
                            resize: none;
                            height: 38px;
                            outline: none;
                            box-sizing: border-box;
                            backdrop-filter: blur(4px);
                        "></textarea>
                        <button id="sticky-detail-add-btn" style="
                            padding: 8px 16px;
                            border: none;
                            border-radius: 6px;
                            background: rgba(0,0,0,0.08);
                            color: #5D4E37;
                            font-size: 13px;
                            font-weight: 600;
                            cursor: pointer;
                            font-family: var(--font-family);
                            white-space: nowrap;
                            transition: background 0.2s;
                        ">✏️ 写</button>
                    </div>
                    <!-- 操作按钮 -->
                    <div style="display: flex; gap: 8px; justify-content: flex-end;">
                        <button id="sticky-detail-over-btn" style="
                            padding: 6px 16px;
                            border: none;
                            border-radius: 6px;
                            background: rgba(229,115,115,0.15);
                            color: #E57373;
                            font-size: 12px;
                            font-weight: 500;
                            cursor: pointer;
                            font-family: var(--font-family);
                            transition: background 0.2s;
                        ">📌 揭下来</button>
                        <button id="sticky-detail-reopen-btn" style="
                            display: none;
                            padding: 6px 16px;
                            border: none;
                            border-radius: 6px;
                            background: rgba(76,175,80,0.15);
                            color: #43A047;
                            font-size: 12px;
                            font-weight: 500;
                            cursor: pointer;
                            font-family: var(--font-family);
                            transition: background 0.2s;
                        ">🔄 重新贴上</button>
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
        input.style.height = '38px';
        renderStickyDetail(note, modal);
        renderStickyBoard();
    });
    
    const input = modal.querySelector('#sticky-detail-input');
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            modal.querySelector('#sticky-detail-add-btn').click();
        }
    });
    input.addEventListener('input', () => {
        input.style.height = '38px';
        input.style.height = Math.min(input.scrollHeight, 80) + 'px';
    });
    
    // 结束
    modal.querySelector('#sticky-detail-over-btn').addEventListener('click', () => {
        const note = stickyNotes.find(n => n.id === viewingStickyId);
        if (!note) return;
        if (note.isActive === false) return;
        if (confirm('揭下这张便利贴？之后不会再收到回复。')) {
            note.isActive = false;
            saveStickyNotes();
            renderStickyDetail(note, modal);
            renderStickyBoard();
            showNotification('已揭下', 'info', 1500);
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
        showNotification('重新贴上', 'success', 1500);
    });
    
    return modal;
}

// ─── 渲染便利贴详情 ──────────────────────────────────────
function renderStickyDetail(note, modal) {
    const container = modal.querySelector('#sticky-detail-messages');
    const color = STICKY_COLORS[note.color] || STICKY_COLORS.yellow;
    const isActive = note.isActive !== false;
    
    // 更新便利贴背景色
    const paper = modal.querySelector('#sticky-detail-paper');
    if (paper) {
        paper.style.background = color.bg;
        paper.style.borderColor = color.border;
    }
    
    // 更新按钮状态
    const overBtn = modal.querySelector('#sticky-detail-over-btn');
    const reopenBtn = modal.querySelector('#sticky-detail-reopen-btn');
    if (isActive) {
        overBtn.style.display = 'inline-block';
        reopenBtn.style.display = 'none';
        overBtn.textContent = '📌 揭下来';
    } else {
        overBtn.style.display = 'none';
        reopenBtn.style.display = 'inline-block';
    }
    
    const input = modal.querySelector('#sticky-detail-input');
    input.placeholder = isActive ? '继续写...' : '已揭下，不能写了';
    input.disabled = !isActive;
    input.style.opacity = isActive ? '1' : '0.4';
    modal.querySelector('#sticky-detail-add-btn').style.opacity = isActive ? '1' : '0.4';
    modal.querySelector('#sticky-detail-add-btn').style.pointerEvents = isActive ? 'auto' : 'none';
    
    if (note.messages.length === 0) {
        container.innerHTML = `<div style="text-align: center; color: rgba(0,0,0,0.3); font-size: 14px; padding: 30px 0; font-family: 'Caveat', cursive;">还没有内容</div>`;
        return;
    }
    
    let html = '';
    note.messages.forEach((msg, idx) => {
        const isUser = msg.role === 'user';
        const isFirst = idx === 0;
        const isLast = idx === note.messages.length - 1;
        
        // 模拟手写：不同角色不同风格
        html += `
            <div style="
                display: flex;
                flex-direction: column;
                align-items: ${isUser ? 'flex-end' : 'flex-start'};
                ${idx > 0 ? 'margin-top: 2px;' : ''}
            ">
                <div style="
                    font-size: ${isFirst ? '20px' : (isUser ? '16px' : '18px')};
                    font-family: 'Caveat', 'Patrick Hand', cursive;
                    color: ${isUser ? '#2C2C2C' : '#4A7CF7'};
                    font-style: italic;
                    text-align: ${isUser ? 'right' : 'left'};
                    transform: ${isUser ? 'rotate(0.5deg)' : 'rotate(-0.3deg)'};
                    line-height: 1.5;
                    padding: ${isUser ? '4px 6px 4px 12px' : '4px 12px 4px 6px'};
                    max-width: 92%;
                    word-break: break-word;
                    white-space: pre-wrap;
                    ${isFirst ? 'font-weight: 500;' : ''}
                ">
                    ${escapeHtml(msg.text)}
                </div>
                ${isLast && isActive ? `
                    <div style="
                        font-size: 11px;
                        color: rgba(0,0,0,0.2);
                        margin-top: 2px;
                        ${isUser ? 'margin-right: 4px;' : 'margin-left: 4px;'}
                        font-family: var(--font-family);
                        font-style: normal;
                    ">
                        ${isUser ? '✧ 等回复中...' : '✦ 已读'}
                    </div>
                ` : ''}
            </div>
        `;
    });
    
    container.innerHTML = html;
    container.scrollTop = container.scrollHeight;
}

// ─── 工具 ──────────────────────────────────────────────────
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ─── 导出 ──────────────────────────────────────────────────
window.initStickyBoard = initStickyBoard;
window.openStickyBoard = openStickyBoard;
window.closeStickyBoard = closeStickyBoard;
window.addStickyNote = addStickyNote;
window.deleteStickyNote = deleteStickyNote;
window.renderStickyBoard = renderStickyBoard;

// ─── 自动初始化 ──────────────────────────────────────────
if (typeof SESSION_ID !== 'undefined' && SESSION_ID) {
    initStickyBoard();
}

console.log('[StickyBoard] 📌 软木板模块已加载 ✓');