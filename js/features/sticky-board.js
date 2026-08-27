/* 留言板功能 - Sticky Board V30 (删除恢复 + 吞字修复 + 按需渲染) */

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

function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randFloat(min, max) { return Math.random() * (max - min) + min; }

function wrapTextByWidth(text, lineWidth) {
    if (!text) return [];
    const chars = text.split('');
    const lines = [];
    for (let i = 0; i < chars.length; i += lineWidth) {
        lines.push(chars.slice(i, i + lineWidth).join(''));
    }
    return lines;
}

function createNewMessage(text, sender) {
    const fontSize = rand(11, 16);
    const lineWidth = rand(12, 20);
    const marginBottom = rand(5, 9);
    const rotate = randFloat(-2.5, 2.5);
    const leftOffset = rand(4, 50);
    
    return {
        id: Date.now() + Math.random(),
        sender: sender,
        text: text,
        textStyle: StickyBoardConfig.textStyles[sender],
        layout: {
            fontSize: fontSize,
            lineWidth: lineWidth,
            marginBottom: marginBottom,
            rotate: rotate,
            leftOffset: leftOffset
        }
    };
}

function ensureLayout(msg) {
    if (!msg.layout) {
        msg.layout = {
            fontSize: rand(13, 15),
            lineWidth: rand(14, 18),
            marginBottom: rand(6, 8),
            rotate: randFloat(-1.5, 1.5),
            leftOffset: rand(10, 40)
        };
    }
    return msg;
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
                    const newMsg = createNewMessage(item.text, 'user');
                    return {
                        id: item.id || Date.now(),
                        bgColor: item.bgColor,
                        status: SB_STATUS.NEED_INTERACT,
                        messages: [newMsg]
                    };
                }
                if (!Array.isArray(item.messages)) item.messages = [];
                item.messages = item.messages.map(m => {
                    if (!m.sender) m.sender = 'user';
                    ensureLayout(m);
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

    const newMsg = createNewMessage(text, 'user');
    
    const newSticky = {
        id: Date.now(),
        bgColor: color,
        status: SB_STATUS.NEED_INTERACT,
        messages: [newMsg]
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
    const newMsg = createNewMessage(tempContent.trim(), 'user');
    sticky.messages.push(newMsg);
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
        // 关闭大图
        const overlay = document.getElementById('sticky-overlay');
        if (overlay) document.body.removeChild(overlay);
    });
}

// ⭐ 删除单条消息 - 带大图刷新
function deleteMessage(stickyId, msgId) {
    customConfirm('确定要删除这条内容吗？', () => {
        const sticky = StickyBoardData.find(item => item.id === stickyId);
        if (!sticky) return;
        sticky.messages = sticky.messages.filter(m => m.id !== msgId);
        if (sticky.messages.length === 0) {
            StickyBoardData = StickyBoardData.filter(item => item.id !== stickyId);
            saveStickyBoardData();
            renderStickyBoard();
            const overlay = document.getElementById('sticky-overlay');
            if (overlay) document.body.removeChild(overlay);
            return;
        }
        saveStickyBoardData();
        renderStickyBoard();
        // 刷新大图
        const overlay = document.getElementById('sticky-overlay');
        if (overlay) {
            document.body.removeChild(overlay);
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
        const newMsg = createNewMessage(finalText, 'partner');
        sticky.messages.push(newMsg);
        sticky.status = SB_STATUS.REPLIED;
    }
    saveStickyBoardData();
    renderStickyBoard();
    return true;
}

// ============================================================
// 核心：创建一张便签（300x300 基准画布）
// ⭐ 大图模式下每条消息带删除按钮（点击消息显示小×）
// ⭐ 修复右侧吞字：去掉 overflow:hidden，改用 word-break
// ============================================================
function createStickyCard(sticky, isThumb = true, onDelete = null) {
    const BASE_SIZE = 300;
    const PADDING = 6;

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

    if (isThumb) {
        card.innerHTML += `
            <div style="position:absolute; top:-4px; left:15px; width:14px; height:28px; z-index:20; transform:rotate(-5deg); pointer-events:none;">
                <svg width="14" height="28" viewBox="0 0 14 28" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M4 24 V7 C4 3.5 7 2 8.5 2 C10 2 11.5 4 11.5 6 V18 C11.5 20 10 21.5 8.5 21.5 C7 21.5 5.5 20 5.5 18 V8" stroke="#999" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity="0.9"/>
                </svg>
            </div>
        `;
    }

    card.innerHTML += `
        <div style="position:absolute; inset:0; pointer-events:none; border-radius:12px; overflow:hidden;">
            <svg style="position:absolute; width:150%; height:150%; left:-25%; top:-25%; opacity:0.08; transform:rotate(-15deg);" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
                <path d="M40,80 C50,50 80,20 120,10 C140,5 160,10 170,20 C130,40 90,60 40,80 Z" fill="none" stroke="#333" stroke-width="2"/>
                <path d="M20,120 C40,90 70,70 110,50" fill="none" stroke="#333" stroke-width="1.5"/>
                <path d="M30,160 C60,140 100,130 140,130" fill="none" stroke="#333" stroke-width="1"/>
            </svg>
        </div>
    `;

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

    // ⭐ 大图模式下 contentContainer 可滚动
    if (!isThumb) {
        contentContainer.style.overflowY = 'auto';
        contentContainer.style.overflowX = 'hidden';
        if (sticky.messages.length > 3) {
            contentContainer.style.justifyContent = 'flex-start';
        } else {
            contentContainer.style.justifyContent = 'center';
        }
        contentContainer.style.scrollbarWidth = 'thin';
        contentContainer.style.scrollbarColor = 'rgba(255,255,255,0.3) transparent';
    }

    sticky.messages.forEach((msg, index) => {
        const msgStyle = msg.textStyle || StickyBoardConfig.textStyles[msg.sender] || StickyBoardConfig.textStyles.user;
        const layout = msg.layout || { fontSize: 14, lineWidth: 16, marginBottom: 7, rotate: 0, leftOffset: 20 };
        
        const fontSize = layout.fontSize;
        const lineWidth = layout.lineWidth;
        const marginBottom = layout.marginBottom;
        const rotate = layout.rotate;
        
        const charWidth = fontSize * 0.9;
        const maxLineWidth = lineWidth * charWidth;
        const availableWidth = BASE_SIZE - PADDING * 2 - maxLineWidth - 6;
        const maxSafeLeft = Math.max(4, availableWidth - 4);
        let leftOffset = Math.min(layout.leftOffset, maxSafeLeft);
        leftOffset = Math.max(4, leftOffset);

        const lines = wrapTextByWidth(msg.text, lineWidth);

        // ⭐ 每条消息的外层容器（用于定位删除按钮）
        const msgWrapper = document.createElement('div');
        msgWrapper.style.cssText = `
            position: relative;
            width: auto;
            max-width: 100%;
            margin-bottom: ${marginBottom}px;
        `;

        lines.forEach((line) => {
            const lineEl = document.createElement('div');
            lineEl.innerText = line;
            lineEl.style.cssText = `
                font-family: ${msgStyle.font};
                font-size: ${fontSize}px;
                color: ${msgStyle.color};
                font-weight: ${msgStyle.weight};
                line-height: 1.8;
                text-align: left;
                width: auto;
                margin-left: ${leftOffset}px;
                transform: rotate(${rotate}deg) translateY(${randFloat(-0.5, 0.5)}px);
                word-break: break-word;
                white-space: nowrap;
                /* ⭐ 修复吞字：去掉 max-width 限制，用 overflow:visible */
                overflow: visible;
            `;
            msgWrapper.appendChild(lineEl);
        });

        // ⭐ 大图模式下：每条消息带删除按钮（点击消息显示小×）
        if (!isThumb) {
            const delBtn = document.createElement('div');
            delBtn.innerHTML = '×';
            delBtn.style.cssText = `
                position: absolute;
                top: -6px;
                right: -4px;
                width: 20px;
                height: 20px;
                background: rgba(0,0,0,0.6);
                color: #fff;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 14px;
                font-weight: 700;
                cursor: pointer;
                opacity: 0;
                transition: opacity 0.2s;
                z-index: 30;
                pointer-events: none;
            `;
            
            // 点击消息本身显示删除按钮
            msgWrapper.onclick = (e) => {
                e.stopPropagation();
                // 隐藏其他所有删除按钮
                document.querySelectorAll('#sticky-overlay .msg-del-btn').forEach(btn => {
                    btn.style.opacity = '0';
                    btn.style.pointerEvents = 'none';
                });
                delBtn.style.opacity = '1';
                delBtn.style.pointerEvents = 'auto';
                // 3秒后自动隐藏
                setTimeout(() => {
                    delBtn.style.opacity = '0';
                    delBtn.style.pointerEvents = 'none';
                }, 3000);
            };
            
            delBtn.className = 'msg-del-btn';
            delBtn.onclick = (e) => {
                e.stopPropagation();
                deleteMessage(sticky.id, msg.id);
            };
            msgWrapper.appendChild(delBtn);
        }

        contentContainer.appendChild(msgWrapper);
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
    const scale = cellWidth / 300;

    StickyBoardData.forEach(sticky => {
        const cell = document.createElement('div');
        cell.style.cssText = `
            width: 100%;
            aspect-ratio: 1 / 1;
            display: flex;
            justify-content: center;
            align-items: center;
            overflow: hidden;
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


// ========== 大图展示 ==========
function showStickyLarge(sticky) {
    const oldOverlay = document.getElementById('sticky-overlay');
    if (oldOverlay) document.body.removeChild(oldOverlay);

    const overlay = document.createElement('div');
    overlay.id = 'sticky-overlay';
    overlay.style.cssText = `position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); z-index: 9999; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(4px);`;
    overlay.addEventListener('click', (e) => { 
        if (e.target === overlay) document.body.removeChild(overlay); 
    });

    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'display: flex; flex-direction: column; align-items: center; gap: 15px; width: 100%; max-width: 420px; padding: 0 16px; box-sizing: border-box;';

    const maxWidth = Math.min(400, window.innerWidth - 32);
    const scale = maxWidth / 300;

    // ⭐ 用于预览的临时消息列表（包含补充内容）
    let previewMessages = [...sticky.messages];
    let tempContent = null; // 暂存的补充内容

    // ⭐ 渲染大图卡片
    function renderCard(messages) {
        const tempSticky = {
            ...sticky,
            messages: messages
        };
        const card = createStickyCard(tempSticky, false);
        card.style.transform = `scale(${scale})`;
        card.style.transformOrigin = 'center center';
        card.style.width = '300px';
        card.style.height = '300px';
        card.style.overflow = 'visible';

        cardWrapper.innerHTML = '';
        cardWrapper.appendChild(card);
    }

    const card = createStickyCard(sticky, false);
    card.style.transform = `scale(${scale})`;
    card.style.transformOrigin = 'center center';
    card.style.width = '300px';
    card.style.height = '300px';
    card.style.overflow = 'visible';

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
        position: relative;
    `;
    cardWrapper.appendChild(card);
    wrapper.appendChild(cardWrapper);

    // ===== 按钮区域 =====
    const actions = document.createElement('div');
    actions.style.cssText = 'display: flex; width: 100%; justify-content: center; gap: 8px; flex-wrap: wrap;';

    const pinBtn = document.createElement('button');
    pinBtn.innerText = '张贴';
    pinBtn.style.cssText = 'padding: 10px 16px; border: none; border-radius: 8px; background: rgba(255,255,255,0.85); color: #333; cursor: pointer; font-size: 14px; flex: 1; min-width: 60px; font-weight: 500;';
    pinBtn.onclick = () => { 
        if (!tempContent) {
            showInternalMessage('没有暂存内容，无法张贴。');
            return;
        }
        // ⭐ 正式保存到数据
        const newMsg = createNewMessage(tempContent, 'user');
        sticky.messages.push(newMsg);
        sticky.status = SB_STATUS.NEED_INTERACT;
        saveStickyBoardData();
        renderStickyBoard();
        document.body.removeChild(overlay);
        showInternalMessage('内容已张贴！', 'success');
        tempContent = null;
    };

    const supplementBtn = document.createElement('button');
    supplementBtn.innerText = '补充';
    supplementBtn.style.cssText = 'padding: 10px 16px; border: none; border-radius: 8px; background: var(--accent-color); color: white; cursor: pointer; font-size: 14px; flex: 1; min-width: 60px; font-weight: 500;';
    supplementBtn.onclick = () => {
        customPrompt('补充内容', '输入你想补充的话...', (text) => {
            tempContent = text;
            // ⭐ 预览：把补充内容临时加到消息列表里渲染
            const previewMsg = {
                id: Date.now() + 999,
                sender: 'user',
                text: text,
                textStyle: StickyBoardConfig.textStyles.user,
                layout: {
                    fontSize: rand(11, 16),
                    lineWidth: rand(12, 20),
                    marginBottom: rand(5, 9),
                    rotate: randFloat(-2.5, 2.5),
                    leftOffset: rand(4, 50)
                }
            };
            const previewList = [...sticky.messages, previewMsg];
            renderCard(previewList);
            showInternalMessage('内容已暂存，点击【张贴】后才会正式保存。', 'success');
        });
    };

    const endBtn = document.createElement('button');
    endBtn.innerText = 'END';
    endBtn.style.cssText = 'padding: 10px 16px; border: none; border-radius: 8px; background: rgba(255,255,255,0.85); color: #333; cursor: pointer; font-size: 14px; flex: 1; min-width: 60px; font-weight: 500;';
    endBtn.onclick = () => { 
        endSticky(sticky.id); 
        document.body.removeChild(overlay); 
    };

    const deleteBtn = document.createElement('button');
    deleteBtn.innerText = '删除';  // ⭐ 改回「删除」
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
    if (typeof showModal === 'function') showModal(modal);
}

function closeStickyBoard() {
    const modal = document.getElementById('sticky-board-modal');
    if (modal && typeof hideModal === 'function') hideModal(modal);
}

document.addEventListener('DOMContentLoaded', () => {
    const entry = document.getElementById('sticky-board-function');
    if (entry) entry.addEventListener('click', openStickyBoard);
});

// ⭐ 去掉 resize 重新渲染 - 只在数据变化时渲染
// resize 时只刷新当前大图（如果打开的话）
let resizeTimer;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
        // 如果大图打开，重新计算缩放
        const overlay = document.getElementById('sticky-overlay');
        if (overlay) {
            // 简单处理：关闭大图让用户重新点击
            // 或者更优雅：重新渲染大图
            const card = overlay.querySelector('[style*="width: 300px; height: 300px;"]');
            if (card) {
                const maxWidth = Math.min(400, window.innerWidth - 32);
                const newScale = maxWidth / 300;
                card.style.transform = `scale(${newScale})`;
                const wrapper = card.parentElement;
                if (wrapper) {
                    wrapper.style.width = maxWidth + 'px';
                    wrapper.style.height = maxWidth + 'px';
                }
            }
        }
    }, 200);
});