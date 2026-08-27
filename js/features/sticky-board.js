/* 留言板功能 - Sticky Board V27 (每轮随机：字体/间距/行宽/左右偏移) */

const StickyBoardConfig = {
    paperColors: [
        { id: 'yellow', color: '#FFF8DC', textColor: '#5C4033', shadow: 'rgba(180, 155, 90, 0.3)' },
        { id: 'purple', color: '#E6E6FA', textColor: '#4B0082', shadow: 'rgba(100, 80, 150, 0.2)' },
        { id: 'blue', color: '#E0F7FA', textColor: '#006064', shadow: 'rgba(0, 100, 120, 0.2)' },
        { id: 'pink', color: '#FFE4E1', textColor: '#8B4513', shadow: 'rgba(200, 100, 100, 0.2)' }
    ],
    textStyles: {
        user: { 
            font: '"华文圆体", "幼圆", "楷体", cursive', 
            color: '#B39DDB', 
            weight: '500'
        },
        partner: { 
            font: '"华文行楷", "STXingkai", "楷体", cursive', 
            color: '#000080', 
            weight: '600'
        }
    }
};

const SB_STATUS = {
    NEED_INTERACT: 'need_interact',   
    NO_REPLY: 'no_reply',             
    REPLIED: 'replied'                
};

let StickyBoardData = []; 

// ========== 工具函数：随机数 ==========
function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randFloat(min, max) { return Math.random() * (max - min) + min; }

// ========== 按行宽硬换行 ==========
function wrapTextByWidth(text, lineWidth) {
    if (!text) return [];
    const chars = text.split('');
    const lines = [];
    for (let i = 0; i < chars.length; i += lineWidth) {
        lines.push(chars.slice(i, i + lineWidth).join(''));
    }
    return lines;
}

function loadStickyBoardData() {
    const saved = localStorage.getItem('stickyBoardData');
    if (saved) {
        try { 
            StickyBoardData = JSON.parse(saved); 
            StickyBoardData = StickyBoardData.map(item => {
                if (!item.bgColor) item.bgColor = StickyBoardConfig.paperColors[0].color;
                if (item.bgImg) delete item.bgImg; 
                if (item.text && !item.messages) {
                    return {
                        id: item.id || Date.now(),
                        bgColor: item.bgColor,
                        status: SB_STATUS.NEED_INTERACT,
                        messages: [{
                            id: Date.now() + 1,
                            sender: 'user',
                            text: item.text,
                            textStyle: StickyBoardConfig.textStyles.user
                        }]
                    };
                }
                if (!Array.isArray(item.messages)) item.messages = [];
                item.messages = item.messages.map(m => {
                    if (!m.sender) m.sender = 'user';
                    return m;
                });
                return item;
            }).filter(item => item.messages.length > 0);
        } catch(e) { StickyBoardData = []; }
    }
}

function saveStickyBoardData() {
    localStorage.setItem('stickyBoardData', JSON.stringify(StickyBoardData));
}

function customConfirm(message, onConfirm) {
    const oldOverlay = document.getElementById('custom-confirm-overlay');
    if (oldOverlay) oldOverlay.remove();
    const overlay = document.createElement('div');
    overlay.id = 'custom-confirm-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:100000;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);';
    const box = document.createElement('div');
    box.style.cssText = 'background:var(--secondary-bg);border-radius:16px;padding:20px;width:80%;max-width:320px;box-shadow:0 10px 30px rgba(0,0,0,0.3);text-align:center;';
    const msg = document.createElement('div');
    msg.innerText = message;
    msg.style.cssText = 'font-size:15px;color:var(--text-primary);margin-bottom:20px;line-height:1.5;';
    const btnContainer = document.createElement('div');
    btnContainer.style.cssText = 'display:flex;justify-content:space-between;gap:10px;';
    const cancelBtn = document.createElement('button');
    cancelBtn.innerText = '取消';
    cancelBtn.style.cssText = 'flex:1;padding:10px;border:none;border-radius:8px;background:var(--primary-bg);color:var(--text-secondary);cursor:pointer;font-size:14px;';
    cancelBtn.onclick = (e) => { e.stopPropagation(); overlay.remove(); };
    const okBtn = document.createElement('button');
    okBtn.innerText = '确定';
    okBtn.style.cssText = 'flex:1;padding:10px;border:none;border-radius:8px;background:#e74c3c;color:#fff;cursor:pointer;font-size:14px;';
    okBtn.onclick = (e) => { 
        e.stopPropagation(); 
        overlay.remove(); 
        if (typeof onConfirm === 'function') onConfirm(); 
    };
    btnContainer.appendChild(cancelBtn);
    btnContainer.appendChild(okBtn);
    box.appendChild(msg);
    box.appendChild(btnContainer);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    overlay.addEventListener('click', (e) => { 
        if (e.target === overlay) overlay.remove(); 
    });
}

function customPrompt(message, placeholder, onSave) {
    const oldOverlay = document.getElementById('custom-prompt-overlay');
    if (oldOverlay) oldOverlay.remove();
    const overlay = document.createElement('div');
    overlay.id = 'custom-prompt-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:100000;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);';
    const box = document.createElement('div');
    box.style.cssText = 'background:var(--secondary-bg);border-radius:16px;padding:20px;width:85%;max-width:360px;box-shadow:0 10px 30px rgba(0,0,0,0.3);';
    const title = document.createElement('div');
    title.innerText = message;
    title.style.cssText = 'font-size:15px;font-weight:600;color:var(--text-primary);margin-bottom:15px;text-align:center;';
    const input = document.createElement('textarea');
    input.placeholder = placeholder || '写下你要补充的内容...';
    input.style.cssText = 'width:100%;min-height:80px;padding:10px;border:1px solid var(--border-color);border-radius:8px;background:var(--primary-bg);color:var(--text-primary);font-size:14px;resize:none;outline:none;box-sizing:border-box;';
    input.addEventListener('click', (e) => e.stopPropagation());
    input.addEventListener('touchstart', (e) => e.stopPropagation());
    input.addEventListener('mousedown', (e) => e.stopPropagation());
    const btnContainer = document.createElement('div');
    btnContainer.style.cssText = 'display:flex;justify-content:space-between;gap:10px;margin-top:15px;';
    const cancelBtn = document.createElement('button');
    cancelBtn.innerText = '取消';
    cancelBtn.style.cssText = 'flex:1;padding:10px;border:none;border-radius:8px;background:var(--primary-bg);color:var(--text-secondary);cursor:pointer;font-size:14px;';
    cancelBtn.onclick = (e) => { e.stopPropagation(); overlay.remove(); };
    const saveBtn = document.createElement('button');
    saveBtn.innerText = '保存';
    saveBtn.style.cssText = 'flex:1;padding:10px;border:none;border-radius:8px;background:var(--accent-color);color:#fff;cursor:pointer;font-size:14px;';
    saveBtn.onclick = (e) => {
        e.stopPropagation();
        const val = input.value.trim();
        if (!val) return;
        overlay.remove();
        if (typeof onSave === 'function') onSave(val);
    };
    btnContainer.appendChild(cancelBtn);
    btnContainer.appendChild(saveBtn);
    box.appendChild(title);
    box.appendChild(input);
    box.appendChild(btnContainer);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    setTimeout(() => input.focus(), 100);
    overlay.addEventListener('click', (e) => { 
        if (e.target === overlay) overlay.remove(); 
    });
}

function showInternalMessage(msg, type = 'warning') {
    if (typeof showNotification === 'function') {
        showNotification(msg, type, 2000);
    } else {
        alert(msg); 
    }
}

function createStickyBoardModal() {
    let modal = document.getElementById('sticky-board-modal');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'sticky-board-modal';
    modal.innerHTML = `
        <div class="modal-content" style="max-height: 90vh; overflow-y: auto; background: transparent; padding: 0; overflow: hidden; display: flex; flex-direction: column;">
            <div style="background: var(--accent-color); color: #fff; padding: 15px 20px; display: flex; justify-content: space-between; align-items: center; border-radius: 20px 20px 0 0; flex-shrink: 0;">
                <div style="font-size: 18px; font-weight: 700; letter-spacing: 2px;">
                    <i class="fas fa-sticky-note" style="margin-right: 8px;"></i>留言板
                </div>
                <button onclick="closeStickyBoard()" style="background: none; border: none; color: #fff; font-size: 20px; cursor: pointer;"><i class="fas fa-times"></i></button>
            </div>
            <div style="background: var(--primary-bg); padding: 12px; flex: 1; display: flex; flex-direction: column; overflow-y: auto; position: relative; height: calc(90vh - 60px);">
                <div id="sticky-board-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; padding-bottom: 80px;"></div>
                <button id="sticky-add-btn" onclick="openStickyCreateModal()" style="
                    position: absolute; 
                    bottom: 20px; 
                    right: 20px; 
                    width: 48px; 
                    height: 48px; 
                    border-radius: 50%; 
                    border: none; 
                    background: var(--accent-color); 
                    color: white; 
                    font-size: 24px; 
                    box-shadow: 0 4px 12px rgba(0,0,0,0.4); 
                    cursor: pointer; 
                    z-index: 99999;
                "><i class="fas fa-plus"></i></button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    return modal;
}

function openStickyCreateModal() {
    const old = document.getElementById('sticky-create-modal');
    if (old) old.remove();

    const overlay = document.createElement('div');
    overlay.id = 'sticky-create-modal';
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);z-index:999999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(8px);';
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

    const box = document.createElement('div');
    box.style.cssText = 'background:var(--secondary-bg);border-radius:16px;padding:24px;width:85%;max-width:360px;box-shadow:0 10px 30px rgba(0,0,0,0.5);';

    box.innerHTML = `
        <div style="font-size:16px;font-weight:700;color:var(--text-primary);margin-bottom:15px;text-align:center;">✍️ 写一张新便签</div>
        <textarea id="sticky-create-input" placeholder="写下你想说的话..." style="
            width:100%; min-height:100px; padding:12px; border:1.5px solid var(--border-color); 
            border-radius:10px; background:var(--primary-bg); color:var(--text-primary); 
            font-size:14px; resize:none; outline:none; box-sizing:border-box;
        "></textarea>
        <div style="display:flex; gap:10px; align-items:center; margin:15px 0;">
            <div style="font-size:12px; color:var(--text-secondary);">选择纸张：</div>
            <div id="sticky-create-selector" style="display:flex; gap:8px; cursor:pointer;"></div>
        </div>
        <div style="display:flex; gap:12px; margin-top:20px;">
            <button onclick="document.getElementById('sticky-create-modal').remove()" style="flex:1; padding:12px; border:none; border-radius:10px; background:var(--primary-bg); color:var(--text-secondary); cursor:pointer; font-size:14px;">取消</button>
            <button onclick="submitCreateSticky()" style="flex:2; padding:12px; border:none; border-radius:10px; background:var(--accent-color); color:white; cursor:pointer; font-size:14px; font-weight:600;">贴出便签</button>
        </div>
    `;

    overlay.appendChild(box);
    document.body.appendChild(overlay);

    const selector = document.getElementById('sticky-create-selector');
    StickyBoardConfig.paperColors.forEach((p, index) => {
        const div = document.createElement('div');
        div.style.cssText = `width: 32px; height: 32px; background: ${p.color}; border: 2px solid transparent; border-radius: 6px; transition: all 0.2s; box-shadow: 0 2px 4px rgba(0,0,0,0.1);`;
        if (index === 0) div.style.borderColor = 'var(--accent-color)';
        div.onclick = () => {
            selector.querySelectorAll('div').forEach(el => el.style.borderColor = 'transparent');
            div.style.borderColor = 'var(--accent-color)';
            document.getElementById('sticky-selected-color').value = p.color;
        };
        selector.appendChild(div);
    });

    setTimeout(() => document.getElementById('sticky-create-input').focus(), 100);
}

function submitCreateSticky() {
    const textInput = document.getElementById('sticky-create-input');
    const text = textInput.value.trim();
    if (!text) {
        showInternalMessage('请输入内容再贴出哦~');
        return;
    }
    
    const selector = document.getElementById('sticky-create-selector');
    const selectedColorDiv = selector.querySelector('div[style*="border-color: var(--accent-color)"]');
    const index = selectedColorDiv ? Array.from(selector.children).indexOf(selectedColorDiv) : 0;
    const color = StickyBoardConfig.paperColors[index].color;

    const newSticky = {
        id: Date.now(),
        bgColor: color,
        status: SB_STATUS.NEED_INTERACT,
        messages: [{
            id: Date.now() + 1,
            sender: 'user',
            text: text,
            textStyle: StickyBoardConfig.textStyles.user
        }]
    };
    
    StickyBoardData.unshift(newSticky);
    saveStickyBoardData();
    renderStickyBoard();
    
    document.getElementById('sticky-create-modal').remove();
    showInternalMessage('便签已贴出！', 'success');
}

function pinSticky(stickyId, tempContent) {
    const sticky = StickyBoardData.find(item => item.id === stickyId);
    if (!sticky) return false;
    if (!tempContent || tempContent.trim() === '') {
        showInternalMessage('没有暂存内容，无法张贴。');
        return false;
    }
    sticky.messages.push({
        id: Date.now() + Math.random(),
        sender: 'user',
        text: tempContent.trim(),
        textStyle: StickyBoardConfig.textStyles.user
    });
    sticky.status = SB_STATUS.NEED_INTERACT;
    saveStickyBoardData();
    renderStickyBoard();
    return true;
}

function endSticky(stickyId) {
    customConfirm('确定将此便签设为不可回复吗？', () => {
        const sticky = StickyBoardData.find(item => item.id === stickyId);
        if (!sticky) return;
        sticky.status = SB_STATUS.NO_REPLY; 
        saveStickyBoardData();
        renderStickyBoard();
    });
}

function deleteSticky(stickyId) {
    customConfirm('确定要删除这张便签吗？', () => {
        StickyBoardData = StickyBoardData.filter(item => item.id !== stickyId);
        saveStickyBoardData();
        renderStickyBoard();
    });
}

function deleteMessage(stickyId, msgId) {
    customConfirm('确定要删除这条内容吗？', () => {
        const sticky = StickyBoardData.find(item => item.id === stickyId);
        if (!sticky) return;
        sticky.messages = sticky.messages.filter(m => m.id !== msgId);
        if (sticky.messages.length === 0) {
            StickyBoardData = StickyBoardData.filter(item => item.id !== stickyId);
            saveStickyBoardData();
            renderStickyBoard();
            return;
        }
        saveStickyBoardData();
        renderStickyBoard();
        const overlay = document.getElementById('sticky-overlay');
        if (overlay) {
            overlay.remove();
            showStickyLarge(sticky);
        }
    });
}

function getNeedInteractStickies() {
    return StickyBoardData.filter(item => item.status === SB_STATUS.NEED_INTERACT);
}

async function processStickyBoardReply() {
    const needInteractList = getNeedInteractStickies();
    const noReplyStickies = needInteractList.filter(item => item.status === SB_STATUS.NO_REPLY);
    noReplyStickies.forEach(item => { item.status = SB_STATUS.REPLIED; });
    let replyStickies = needInteractList.filter(item => item.status === SB_STATUS.NEED_INTERACT);
    if (replyStickies.length === 0) { saveStickyBoardData(); return; }
    let selectedStickies = [];
    if (replyStickies.length >= 3) {
        const shuffled = replyStickies.sort(() => 0.5 - Math.random());
        selectedStickies = shuffled.slice(0, 2);
    } else { selectedStickies = replyStickies; }
    for (const sticky of selectedStickies) {
        const count = Math.floor(Math.random() * 6) + 2; 
        let replyTexts = [];
        if (typeof customReplies !== 'undefined' && customReplies.length > 0) {
            for (let i = 0; i < count; i++) {
                const randomReply = customReplies[Math.floor(Math.random() * customReplies.length)];
                replyTexts.push(randomReply);
            }
        } else { console.warn('回复库为空，无法生成便签回复'); }
        const puncts = ['，', '。', '！', '？', '…', '、'];
        let finalText = '';
        replyTexts.forEach((txt, i) => {
            finalText += txt;
            if (i < replyTexts.length - 1) finalText += puncts[Math.floor(Math.random() * puncts.length)];
        });
        sticky.messages.push({
            id: Date.now() + Math.random(),
            sender: 'partner',
            text: finalText,
            textStyle: StickyBoardConfig.textStyles.partner
        });
        sticky.status = SB_STATUS.REPLIED;
    }
    saveStickyBoardData();
    renderStickyBoard();
    return true;
}

// ============================================================
// 核心：创建一张便签（大图/小图共用，300x300 基准画布）
// 每条消息独立随机：字体/间距/行宽/左右偏移
// ============================================================
function createStickyCard(sticky, isThumb = true) {
    const BASE_SIZE = 300;
    const PADDING = 6;          // 固定边距
    const SAFE_MARGIN = 10;     // 最小左边距，保证不贴边
    const MAX_LEFT_OFFSET = 60; // 最大随机左偏移

    const card = document.createElement('div');
    card.style.cssText = `
        width: ${BASE_SIZE}px;
        height: ${BASE_SIZE}px;
        background-color: ${sticky.bgColor};
        border-radius: 12px;
        box-shadow: 0 6px 14px rgba(0,0,0,0.15);
        border: 1px solid rgba(255,255,255,0.6);
        padding: ${PADDING}px;
        box-sizing: border-box;
        overflow: hidden;
        position: relative;
        flex-shrink: 0;
        flex-grow: 0;
    `;

    // 回形针（仅小图）
    if (isThumb) {
        card.innerHTML += `
            <div style="position:absolute; top:-4px; left:15px; width:14px; height:28px; z-index:20; transform:rotate(-5deg); pointer-events:none;">
                <svg width="14" height="28" viewBox="0 0 14 28" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M4 24 V7 C4 3.5 7 2 8.5 2 C10 2 11.5 4 11.5 6 V18 C11.5 20 10 21.5 8.5 21.5 C7 21.5 5.5 20 5.5 18 V8" stroke="#999" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity="0.9"/>
                </svg>
            </div>
        `;
    }

    // 背景纹理
    card.innerHTML += `
        <div style="position:absolute; inset:0; pointer-events:none; border-radius:12px; overflow:hidden;">
            <svg style="position:absolute; width:150%; height:150%; left:-25%; top:-25%; opacity:0.08; transform:rotate(-15deg);" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
                <path d="M40,80 C50,50 80,20 120,10 C140,5 160,10 170,20 C130,40 90,60 40,80 Z" fill="none" stroke="#333" stroke-width="2"/>
                <path d="M20,120 C40,90 70,70 110,50" fill="none" stroke="#333" stroke-width="1.5"/>
                <path d="M30,160 C60,140 100,130 140,130" fill="none" stroke="#333" stroke-width="1"/>
            </svg>
        </div>
    `;

    // 内容容器：纵向排列，从上下居中开始
    const contentContainer = document.createElement('div');
    contentContainer.style.cssText = `
        position: absolute;
        top: ${PADDING}px;
        left: ${PADDING}px;
        right: ${PADDING}px;
        bottom: ${PADDING}px;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: flex-start;
        z-index: 10;
    `;

    // 遍历每条消息（每轮）
    sticky.messages.forEach((msg, index) => {
        const msgStyle = msg.sender === 'user' ? StickyBoardConfig.textStyles.user : StickyBoardConfig.textStyles.partner;
        
        // ---- 每轮随机参数 ----
        const fontSize = rand(11, 16);
        const lineWidth = rand(12, 20);          // 每行字数
        const marginBottom = rand(5, 9);          // 与下一条的间距
        const rotate = randFloat(-2.5, 2.5);      // 轻微歪斜
        const baseLeft = SAFE_MARGIN + (index * 3); // 基础左偏移（逐条递增，产生错落）

        // 计算安全左偏移：保证最长的行不超出右边界
        // 估算：每个中文字符宽度 ≈ fontSize * 0.9，加上一些余量
        const charWidth = fontSize * 0.9;
        const maxLineWidth = lineWidth * charWidth;
        // 可用宽度 = BASE_SIZE - PADDING*2 - maxLineWidth - 一点余量
        const availableWidth = BASE_SIZE - PADDING * 2 - maxLineWidth - 6;
        // 最大允许左偏移 = availableWidth - SAFE_MARGIN
        const maxSafeLeft = Math.max(0, availableWidth - SAFE_MARGIN);
        // 随机左偏移，但不能超过安全值，且至少为 SAFE_MARGIN
        let leftOffset = SAFE_MARGIN + rand(0, Math.min(MAX_LEFT_OFFSET, maxSafeLeft));
        // 但也要保证不撞到左边边界（至少留 4px）
        leftOffset = Math.max(4, Math.min(leftOffset, maxSafeLeft + SAFE_MARGIN));

        // 按行宽切分文本
        const lines = wrapTextByWidth(msg.text, lineWidth);

        // 每一行作为一个独立元素，但属于同一轮（同一消息）
        lines.forEach((line, lineIndex) => {
            const lineEl = document.createElement('div');
            lineEl.innerText = line;
            // 每行的样式：同一轮内字体一致，但行与行之间可以微调
            lineEl.style.cssText = `
                font-family: ${msgStyle.font};
                font-size: ${fontSize}px;
                color: ${msgStyle.color};
                font-weight: ${msgStyle.weight};
                line-height: 1.8;
                text-align: left;
                width: auto;
                max-width: ${maxLineWidth + 10}px;
                margin-left: ${leftOffset}px;
                margin-bottom: ${marginBottom}px;
                transform: rotate(${rotate}deg) translateY(${randFloat(-1, 1)}px);
                word-break: break-word;
                white-space: nowrap;
            `;
            contentContainer.appendChild(lineEl);
        });
    });

    card.appendChild(contentContainer);
    return card;
}

// ========== 渲染小图网格 ==========
function renderStickyBoard() {
    const grid = document.getElementById('sticky-board-grid');
    if (!grid) return;
    
    if (StickyBoardData.length === 0) {
        grid.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; padding: 50px; color: var(--text-secondary); opacity: 0.6;">
            <i class="fas fa-heart" style="font-size: 40px; display: block; margin-bottom: 10px;"></i>
            还没有留言，点击右下角 + 写一张吧~
        </div>`;
        return;
    }

    grid.innerHTML = '';

    const gridRect = grid.getBoundingClientRect();
    const gap = 6;
    const containerWidth = gridRect.width || (window.innerWidth - 24);
    const cellWidth = (containerWidth - gap) / 2;
    const scale = Math.min(cellWidth / 300, cellWidth / 300);

    StickyBoardData.forEach(sticky => {
        const cell = document.createElement('div');
        cell.style.cssText = `
            width: 100%;
            aspect-ratio: 1 / 1;
            display: flex;
            justify-content: center;
            align-items: center;
            overflow: hidden;
            position: relative;
            cursor: pointer;
        `;
        cell.onclick = () => showStickyLarge(sticky);

        const card = createStickyCard(sticky, true);
        card.style.transform = `scale(${scale})`;
        card.style.transformOrigin = 'center center';
        card.style.flexShrink = '0';
        card.style.flexGrow = '0';
        
        cell.appendChild(card);
        grid.appendChild(cell);
    });
}

// ========== 大图展示（可滚动） ==========
function showStickyLarge(sticky) {
    const overlay = document.createElement('div');
    overlay.id = 'sticky-overlay';
    overlay.style.cssText = `position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); z-index: 9999; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(4px);`;
    overlay.addEventListener('click', (e) => { if (e.target === overlay) document.body.removeChild(overlay); });

    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'display: flex; flex-direction: column; align-items: center; gap: 15px; width: 100%; max-width: 420px; padding: 0 16px; box-sizing: border-box;';

    // 大图卡片：可滚动
    const maxWidth = Math.min(400, window.innerWidth - 32);
    const scale = maxWidth / 300;

    // 大图用同样的 createStickyCard，但需要覆盖 overflow 为 auto
    const card = createStickyCard(sticky, false);
    // 让内容容器可滚动（修改 card 内部的 contentContainer）
    const contentContainer = card.querySelector('div[style*="position: absolute; top: 6px; left: 6px;"]');
    if (contentContainer) {
        contentContainer.style.overflowY = 'auto';
        contentContainer.style.overflowX = 'hidden';
        contentContainer.style.justifyContent = 'flex-start'; // 从顶部开始，方便滚动查看全部
        // 内容多时从顶部开始，内容少时居中
        if (sticky.messages.length > 3) {
            contentContainer.style.justifyContent = 'flex-start';
        } else {
            contentContainer.style.justifyContent = 'center';
        }
        // 给滚动条加一点美化
        contentContainer.style.scrollbarWidth = 'thin';
        contentContainer.style.scrollbarColor = 'rgba(255,255,255,0.3) transparent';
    }

    card.style.transform = `scale(${scale})`;
    card.style.transformOrigin = 'center center';
    card.style.width = '300px';
    card.style.height = '300px';
    card.style.overflow = 'visible'; // 让滚动在内部容器处理

    const cardWrapper = document.createElement('div');
    cardWrapper.style.cssText = `
        width: ${maxWidth}px;
        height: ${maxWidth}px;
        display: flex;
        justify-content: center;
        align-items: center;
        flex-shrink: 0;
        flex-grow: 0;
        overflow: hidden;
        border-radius: 16px;
    `;
    cardWrapper.appendChild(card);
    wrapper.appendChild(cardWrapper);

    // ===== 按钮区域（纯文字，无图标） =====
    const actions = document.createElement('div');
    actions.style.cssText = 'display: flex; width: 100%; justify-content: center; gap: 8px; flex-wrap: wrap;';

    let tempContent = null;

    // 重新渲染大图的辅助函数
    const reRenderLarge = (updatedSticky) => {
        const newCard = createStickyCard(updatedSticky, false);
        const newContent = newCard.querySelector('div[style*="position: absolute; top: 6px; left: 6px;"]');
        if (newContent) {
            newContent.style.overflowY = 'auto';
            newContent.style.overflowX = 'hidden';
            if (updatedSticky.messages.length > 3) {
                newContent.style.justifyContent = 'flex-start';
            } else {
                newContent.style.justifyContent = 'center';
            }
            newContent.style.scrollbarWidth = 'thin';
            newContent.style.scrollbarColor = 'rgba(255,255,255,0.3) transparent';
        }
        newCard.style.transform = `scale(${scale})`;
        newCard.style.transformOrigin = 'center center';
        newCard.style.width = '300px';
        newCard.style.height = '300px';
        newCard.style.overflow = 'visible';
        cardWrapper.innerHTML = '';
        cardWrapper.appendChild(newCard);
    };

    const pinBtn = document.createElement('button');
    pinBtn.innerText = '张贴';
    pinBtn.style.cssText = 'padding: 10px 16px; border: none; border-radius: 8px; background: rgba(255,255,255,0.85); color: #333; cursor: pointer; font-size: 14px; flex: 1; min-width: 60px; font-weight: 500;';
    pinBtn.onclick = () => { 
        if (pinSticky(sticky.id, tempContent)) {
            document.body.removeChild(overlay);
        }
    };

    const supplementBtn = document.createElement('button');
    supplementBtn.innerText = '补充';
    supplementBtn.style.cssText = 'padding: 10px 16px; border: none; border-radius: 8px; background: var(--accent-color); color: white; cursor: pointer; font-size: 14px; flex: 1; min-width: 60px; font-weight: 500;';
    supplementBtn.onclick = () => {
        customPrompt('补充内容', '输入你想补充的话...', (text) => {
            tempContent = text;
            const updatedSticky = {
                ...sticky,
                messages: [...sticky.messages, { 
                    id: Date.now(), 
                    sender: 'user', 
                    text: text, 
                    textStyle: StickyBoardConfig.textStyles.user 
                }]
            };
            reRenderLarge(updatedSticky);
            // 保存临时引用以便张贴时使用
            window._tempStickyData = updatedSticky;
            showInternalMessage('内容已暂存，点击【张贴】后才会正式保存。', 'success');
        });
    };

    const endBtn = document.createElement('button');
    endBtn.innerText = 'END';
    endBtn.style.cssText = 'padding: 10px 16px; border: none; border-radius: 8px; background: rgba(255,255,255,0.85); color: #333; cursor: pointer; font-size: 14px; flex: 1; min-width: 60px; font-weight: 500;';
    endBtn.onclick = () => { endSticky(sticky.id); document.body.removeChild(overlay); };

    const deleteBtn = document.createElement('button');
    deleteBtn.innerText = '删除';
    deleteBtn.style.cssText = 'padding: 10px 16px; border: 1px solid rgba(255,80,80,0.4); border-radius: 8px; background: rgba(255,80,80,0.08); color: #ff5050; cursor: pointer; font-size: 14px; flex: 1; min-width: 60px; font-weight: 500;';
    deleteBtn.onclick = () => { 
        deleteSticky(sticky.id); 
        document.body.removeChild(overlay); 
    };

    actions.appendChild(pinBtn);
    actions.appendChild(supplementBtn);
    actions.appendChild(endBtn);
    actions.appendChild(deleteBtn);
    wrapper.appendChild(actions);
    overlay.appendChild(wrapper);
    document.body.appendChild(overlay);
}

window.processStickyBoardReply = processStickyBoardReply;
window.getNeedInteractCount = function() {
    return getNeedInteractStickies().length;
};

function openStickyBoard() {
    loadStickyBoardData();
    const modal = createStickyBoardModal();
    renderStickyBoard();
    showModal(modal);
}

function closeStickyBoard() {
    const modal = document.getElementById('sticky-board-modal');
    if (modal && typeof hideModal === 'function') hideModal(modal);
}

document.addEventListener('DOMContentLoaded', () => {
    const entry = document.getElementById('sticky-board-function');
    if (entry) entry.addEventListener('click', openStickyBoard);
});

// 窗口尺寸变化重新渲染
let resizeTimer;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
        if (document.getElementById('sticky-board-modal') && document.getElementById('sticky-board-modal').style.display !== 'none') {
            renderStickyBoard();
        }
    }, 200);
});