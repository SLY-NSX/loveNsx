/* 留言板功能 - Sticky Board V20 (完美等比缩放 + 独立新建弹窗) */

const StickyBoardConfig = {
    paperColors: [
        { id: 'yellow', color: '#FFF8DC', textColor: '#5C4033', shadow: 'rgba(180, 155, 90, 0.3)' },
        { id: 'purple', color: '#E6E6FA', textColor: '#4B0082', shadow: 'rgba(100, 80, 150, 0.2)' },
        { id: 'blue', color: '#E0F7FA', textColor: '#006064', shadow: 'rgba(0, 100, 120, 0.2)' },
        { id: 'pink', color: '#FFE4E1', textColor: '#8B4513', shadow: 'rgba(200, 100, 100, 0.2)' }
    ],
    textStyles: {
        user: { 
            font: '18px "华文圆体", "幼圆", "楷体", cursive', 
            color: '#B39DDB', 
            weight: '500'
        },
        partner: { 
            font: '17px "华文行楷", "STXingkai", "楷体", cursive', 
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

// ── 页面结构 ──
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
            <div style="background: var(--primary-bg); padding: 20px; flex: 1; display: flex; flex-direction: column; overflow-y: auto; position: relative;">
                
                <!-- ⭐ 2. 移除新建板块，这里只显示已建立的便签 -->
                <div id="sticky-board-grid" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; padding-bottom: 80px;">
                </div>
                
                <!-- ⭐ 新建悬浮按钮 (右下角) -->
                <button id="sticky-add-btn" onclick="openStickyCreateModal()" style="
                    position: fixed; 
                    bottom: 30px; 
                    right: 30px; 
                    width: 56px; 
                    height: 56px; 
                    border-radius: 50%; 
                    border: none; 
                    background: var(--accent-color); 
                    color: white; 
                    font-size: 28px; 
                    box-shadow: 0 4px 12px rgba(0,0,0,0.3); 
                    cursor: pointer; 
                    z-index: 100;
                "><i class="fas fa-plus"></i></button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    return modal;
}

// ── 新建便签独立弹窗 ──
function openStickyCreateModal() {
    const old = document.getElementById('sticky-create-modal');
    if (old) old.remove();

    const overlay = document.createElement('div');
    overlay.id = 'sticky-create-modal';
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:1000;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);';
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

    const box = document.createElement('div');
    box.style.cssText = 'background:var(--secondary-bg);border-radius:16px;padding:20px;width:85%;max-width:360px;box-shadow:0 10px 30px rgba(0,0,0,0.3);';

    box.innerHTML = `
        <div style="font-size:16px;font-weight:700;color:var(--text-primary);margin-bottom:15px;text-align:center;">✍️ 写一张新便签</div>
        <textarea id="sticky-create-input" placeholder="写下你想说的话..." style="
            width:100%; min-height:100px; padding:10px; border:1px solid var(--border-color); 
            border-radius:8px; background:var(--primary-bg); color:var(--text-primary); 
            font-size:14px; resize:none; outline:none; box-sizing:border-box;
        "></textarea>
        <div style="display:flex; gap:10px; align-items:center; margin:12px 0;">
            <div style="font-size:12px; color:var(--text-secondary);">选择纸张：</div>
            <div id="sticky-create-selector" style="display:flex; gap:5px; cursor:pointer;"></div>
        </div>
        <div style="display:flex; gap:10px; margin-top:15px;">
            <button onclick="document.getElementById('sticky-create-modal').remove()" style="flex:1; padding:10px; border:none; border-radius:8px; background:var(--primary-bg); color:var(--text-secondary); cursor:pointer; font-size:14px;">取消</button>
            <button onclick="submitCreateSticky()" style="flex:2; padding:10px; border:none; border-radius:8px; background:var(--accent-color); color:white; cursor:pointer; font-size:14px; font-weight:600;">贴出便签</button>
        </div>
    `;

    overlay.appendChild(box);
    document.body.appendChild(overlay);

    // 渲染选择器
    const selector = document.getElementById('sticky-create-selector');
    StickyBoardConfig.paperColors.forEach((p, index) => {
        const div = document.createElement('div');
        div.style.cssText = `width: 30px; height: 30px; background: ${p.color}; border: 2px solid transparent; border-radius: 4px; transition: all 0.2s; box-shadow: 0 2px 4px rgba(0,0,0,0.1);`;
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
        messages: [
            { id: Date.now() + 1, sender: 'user', text: text, textStyle: StickyBoardConfig.textStyles.user }
        ]
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

// ⭐ 生成稳定且绝对一致的排版参数（小图大图共用）
function getSharedLayout(index, total) {
    const widthNum = 12 + ((index * 7 + total) % 9); // 12~20
    const marginLeft = (index * 3) % 15; // 0~15px
    const rotate = (((index * 13) % 100) / 100 - 0.5) * 2.4; // -1.2 ~ 1.2
    const yOffset = (((index * 17) % 100) / 100 - 0.5) * 4; // -2 ~ 2
    return { widthNum, marginLeft, rotate, yOffset };
}

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
    
    StickyBoardData.forEach(sticky => {
        const item = document.createElement('div');
        item.style.cssText = `
            position: relative;
            aspect-ratio: 1 / 1;
            padding: 12px; 
            box-sizing: border-box;
            cursor: pointer;
            transition: transform 0.2s;
            display: flex;
            justify-content: center;
            align-items: center;
        `;

        // ⭐ 基准画布 (大图画布的等比缩小版)
        const BASE_SIZE = 300; 
        const scale = 0.55; // 缩放系数

        const paper = document.createElement('div');
        paper.style.cssText = `
            width: ${BASE_SIZE}px;
            height: ${BASE_SIZE}px;
            background-color: ${sticky.bgColor};
            border-radius: 8px;
            box-shadow: 0 4px 10px rgba(0,0,0,0.2);
            border: 1px solid rgba(255,255,255,0.5);
            padding: 30px;
            box-sizing: border-box;
            overflow: hidden;
            position: relative;
            transform: scale(${scale});
            transform-origin: center center;
        `;

        paper.innerHTML += `
            <div style="position:absolute; inset:0; pointer-events:none; border-radius:8px; overflow:hidden;">
                <svg style="position:absolute; width:150%; height:150%; left:-25%; top:-25%; opacity:0.08; transform:rotate(-15deg);" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
                    <path d="M40,80 C50,50 80,20 120,10 C140,5 160,10 170,20 C130,40 90,60 40,80 Z" fill="none" stroke="#333" stroke-width="2"/>
                    <path d="M20,120 C40,90 70,70 110,50" fill="none" stroke="#333" stroke-width="1.5"/>
                    <path d="M30,160 C60,140 100,130 140,130" fill="none" stroke="#333" stroke-width="1"/>
                </svg>
            </div>
            
            <div style="position:absolute; top:-4px; left:40px; width:16px; height:32px; z-index:20; transform:rotate(-5deg);">
                <svg width="16" height="32" viewBox="0 0 16 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M4.5 28 V8 C4.5 4 8 2.5 10 2.5 C12 2.5 13.5 4.5 13.5 7 V21 C13.5 23 12 24.5 10 24.5 C8 24.5 6 23 6 21 V9" stroke="#999" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity="0.9"/>
                </svg>
            </div>
        `;

        // ⭐ 绝对固定内容的容器（当前页）
        const contentContainer = document.createElement('div');
        contentContainer.style.cssText = `
            position: absolute;
            top: 15%; left: 15%; right: 15%; bottom: 15%;
            overflow: hidden;
        `;

        // 固定字号和行距，小图大图一致
        const baseFontSize = 17; 
        const baseLineHeight = 1.8;

        // 只渲染当前内容
        sticky.messages.forEach((msg, index) => {
            const msgStyle = msg.sender === 'user' ? StickyBoardConfig.textStyles.user : StickyBoardConfig.textStyles.partner;
            const layout = getSharedLayout(index, sticky.messages.length);
            
            const line = document.createElement('div');
            line.innerText = msg.text; 
            line.style.cssText = `
                font-family: ${msgStyle.font};
                font-size: ${baseFontSize}px;
                color: ${msgStyle.color};
                font-weight: ${msgStyle.weight};
                line-height: ${baseLineHeight};
                text-align: left;
                max-width: ${layout.widthNum}em;
                margin-left: ${layout.marginLeft}px;
                margin-bottom: 5px;
                transform: rotate(${layout.rotate}deg) translateY(${layout.yOffset}px);
            `;
            contentContainer.appendChild(line);
        });

        // ⭐ 绝对等比缩放：大图怎么排，小图就怎么缩
        paper.appendChild(contentContainer);
        item.appendChild(paper);
        item.onclick = () => showStickyLarge(sticky);
        grid.appendChild(item);
    });
}

function showStickyLarge(sticky) {
    const overlay = document.createElement('div');
    overlay.id = 'sticky-overlay';
    overlay.style.cssText = `position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); z-index: 9999; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(4px);`;
    overlay.addEventListener('click', (e) => { if (e.target === overlay) document.body.removeChild(overlay); });

    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'display: flex; flex-direction: column; align-items: center; gap: 15px; width: 100%; max-width: 400px;';

    // ⭐ 大图就是原尺寸的 300x300 等比放大版
    const card = document.createElement('div');
    card.style.cssText = `
        width: 300px;
        height: 300px;
        background-color: ${sticky.bgColor};
        border-radius: 8px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.5);
        padding: 30px;
        box-sizing: border-box;
        position: relative;
    `;

    card.innerHTML += `
        <div style="position:absolute; inset:0; pointer-events:none; border-radius:8px; overflow:hidden;">
            <svg style="position:absolute; width:150%; height:150%; left:-25%; top:-25%; opacity:0.08; transform:rotate(-15deg);" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
                <path d="M40,80 C50,50 80,20 120,10 C140,5 160,10 170,20 C130,40 90,60 40,80 Z" fill="none" stroke="#333" stroke-width="2"/>
                <path d="M20,120 C40,90 70,70 110,50" fill="none" stroke="#333" stroke-width="1.5"/>
                <path d="M30,160 C60,140 100,130 140,130" fill="none" stroke="#333" stroke-width="1"/>
            </svg>
        </div>
        
        <div style="position:absolute; top:-4px; left:40px; width:16px; height:32px; z-index:20; transform:rotate(-5deg);">
            <svg width="16" height="32" viewBox="0 0 16 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M4.5 28 V8 C4.5 4 8 2.5 10 2.5 C12 2.5 13.5 4.5 13.5 7 V21 C13.5 23 12 24.5 10 24.5 C8 24.5 6 23 6 21 V9" stroke="#999" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity="0.9"/>
            </svg>
        </div>
    `;

    // ⭐ 大图的滚动容器，如果超长则滑动
    const msgContainer = document.createElement('div');
    msgContainer.style.cssText = `
        position: absolute;
        top: 15%; left: 15%; right: 15%; bottom: 15%;
        overflow-y: auto;
        z-index: 10;
    `;

    let tempContent = null; 
    let currentMsgContainer = msgContainer;

    const renderMsgs = () => {
        currentMsgContainer.innerHTML = '';
        const allMsgs = [...sticky.messages];
        if (tempContent) allMsgs.push({ text: tempContent, textStyle: StickyBoardConfig.textStyles.user });

        const baseFontSize = 17; 
        const baseLineHeight = 1.8;

        allMsgs.forEach((msg, index) => {
            const msgStyle = msg.sender === 'user' ? StickyBoardConfig.textStyles.user : StickyBoardConfig.textStyles.partner;
            const layout = getSharedLayout(index, allMsgs.length);
            
            const msgWrap = document.createElement('div');
            msgWrap.style.cssText = `
                position: relative;
                max-width: ${layout.widthNum}em;
                margin-left: ${layout.marginLeft}px;
                margin-bottom: 5px;
                cursor: pointer;
            `;
            
            const textDiv = document.createElement('div');
            textDiv.innerText = msg.text; 
            textDiv.style.cssText = `
                font-family: ${msgStyle.font};
                color: ${msgStyle.color};
                font-weight: ${msgStyle.weight};
                font-size: ${baseFontSize}px;
                line-height: ${baseLineHeight};
                word-break: break-word;
                text-align: left;
                transform: rotate(${layout.rotate}deg) translateY(${layout.yOffset}px);
            `;
            msgWrap.appendChild(textDiv);

            if (msg.id) {
                const delBtn = document.createElement('div');
                delBtn.className = 'inline-del';
                delBtn.innerHTML = '<i class="fas fa-times"></i>';
                delBtn.style.cssText = `
                    position: absolute; top: -8px; right: -10px; width: 20px; height: 20px;
                    background: rgba(0,0,0,0.5); color: rgba(255,255,255,0.7); border-radius: 50%;
                    display: flex; align-items: center; justify-content: center; font-size: 11px;
                    opacity: 0; transition: opacity 0.2s; cursor: pointer;
                `;
                
                msgWrap.onclick = (e) => {
                    delBtn.style.opacity = '1';
                    setTimeout(() => delBtn.style.opacity = '0', 2000);
                    e.stopPropagation();
                };

                delBtn.onclick = (e) => {
                    e.stopPropagation();
                    deleteMessage(sticky.id, msg.id);
                };
                msgWrap.appendChild(delBtn);
            }

            currentMsgContainer.appendChild(msgWrap);
        });
    };

    renderMsgs();
    card.appendChild(msgContainer);
    wrapper.appendChild(card);

    const actions = document.createElement('div');
    actions.style.cssText = 'display: flex; width: 100%; justify-content: center; gap: 10px;';

    const pinBtn = document.createElement('button');
    pinBtn.innerHTML = '张贴';
    pinBtn.style.cssText = 'padding: 10px 20px; border: none; border-radius: 8px; background: rgba(255,255,255,0.8); color: #333; cursor: pointer; font-size: 14px; flex: 1;';
    pinBtn.onclick = () => { if (pinSticky(sticky.id, tempContent)) document.body.removeChild(overlay); };

    const supplementBtn = document.createElement('button');
    supplementBtn.innerHTML = '补充';
    supplementBtn.style.cssText = 'padding: 10px 20px; border: none; border-radius: 8px; background: var(--accent-color); color: white; cursor: pointer; font-size: 14px; flex: 1;';
    supplementBtn.onclick = () => {
        customPrompt('补充内容', '输入你想补充的话...', (text) => {
            tempContent = text; 
            renderMsgs();
            showInternalMessage('内容已暂存，点击【张贴】后才会正式保存。', 'success');
        });
    };

    const endBtn = document.createElement('button');
    endBtn.innerHTML = 'END';
    endBtn.style.cssText = 'padding: 10px 20px; border: none; border-radius: 8px; background: rgba(255,255,255,0.8); color: #333; cursor: pointer; font-size: 14px; flex: 1;';
    endBtn.onclick = () => { endSticky(sticky.id); };

    const deleteBtn = document.createElement('button');
    deleteBtn.innerHTML = '删除';
    deleteBtn.style.cssText = 'padding: 10px 20px; border: 1px solid rgba(255,80,80,0.5); border-radius: 8px; background: rgba(255,80,80,0.1); color: #ff5050; cursor: pointer; font-size: 14px; flex: 1;';
    deleteBtn.onclick = () => { deleteSticky(sticky.id); document.body.removeChild(overlay); };

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