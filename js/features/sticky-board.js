/* 留言板功能 - Sticky Board V9 (补充暂存，张贴正式保存) */

const StickyBoardConfig = {
    images: [
        'img/sticky_bg_1.png', 
        'img/sticky_bg_2.png', 

    ],
    textStyles: [
        { font: '14px "Noto Serif SC", serif', color: '#333', weight: '400' }
    ]
};

// 状态枚举
const SB_STATUS = {
    NEED_INTERACT: 'need_interact',   // 需互动
    NO_REPLY: 'no_reply',             // 不可回复
    REPLIED: 'replied'                // 已回复
};

let StickyBoardData = []; 

function loadStickyBoardData() {
    const saved = localStorage.getItem('stickyBoardData');
    if (saved) {
        try { 
            StickyBoardData = JSON.parse(saved); 
            StickyBoardData = StickyBoardData.map(item => {
                if (item.text && !item.messages) {
                    return {
                        id: item.id || Date.now(),
                        bgImg: item.bgImg || StickyBoardConfig.images[0],
                        status: SB_STATUS.NEED_INTERACT,
                        messages: [{
                            id: Date.now() + 1,
                            sender: 'user',
                            text: item.text,
                            textStyle: item.textStyle || StickyBoardConfig.textStyles[0]
                        }]
                    };
                }
                if (!Array.isArray(item.messages)) item.messages = [];
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

    overlay.onclick = () => overlay.remove();
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
    overlay.onclick = () => overlay.remove();
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

            <div style="background: var(--primary-bg); padding: 20px; flex: 1; display: flex; flex-direction: column; overflow-y: auto;">
                <div style="background: rgba(255,255,255,0.05); border: 2px dashed var(--accent-color); border-radius: 12px; padding: 15px; margin-bottom: 20px;">
                    <div style="font-size: 14px; font-weight: 600; color: var(--text-primary); margin-bottom: 10px;">✍️ 新建便签</div>
                    <textarea id="sticky-input" placeholder="写下你想说的话..." style="min-height: 80px; padding: 10px; border-radius: 8px; border: 1px solid var(--border-color); background: var(--secondary-bg); color: var(--text-primary); font-size: 14px; resize: none; outline: none; width: 100%; box-sizing: border-box;"></textarea>

                    <div style="display: flex; gap: 10px; align-items: center; margin: 12px 0;">
                        <div style="font-size: 12px; color: var(--text-secondary);">选择样式：</div>
                        <div style="display: flex; gap: 5px; cursor: pointer;" id="sticky-style-selector">
                        </div>
                    </div>

                    <button onclick="submitSticky()" style="width: 100%; padding: 12px; background: var(--accent-color); color: #fff; border: none; border-radius: 8px; font-size: 15px; font-weight: 600; cursor: pointer;">
                        <i class="fas fa-paper-plane"></i> 贴出便签
                    </button>
                </div>

                <div id="sticky-board-grid" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; padding-bottom: 20px;">
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    return modal;
}

function renderStyleSelector() {
    const container = document.getElementById('sticky-style-selector');
    if (!container) return;
    container.innerHTML = '';
    StickyBoardConfig.images.forEach((img, index) => {
        const div = document.createElement('div');
        div.style.cssText = `width: 30px; height: 40px; background: url(${img}) center/cover; border: 2px solid transparent; border-radius: 4px; transition: all 0.2s;`;
        if (index === 0) div.style.borderColor = 'var(--accent-color)';
        div.onclick = () => {
            container.querySelectorAll('div').forEach(el => el.style.borderColor = 'transparent');
            div.style.borderColor = 'var(--accent-color)';
        };
        container.appendChild(div);
    });
}

// 新建便签：直接进入需互动状态
function submitSticky() {
    const textInput = document.getElementById('sticky-input');
    const text = textInput.value.trim();
    if (!text) {
        alert('请输入内容再贴出哦~');
        return;
    }
    
    const selector = document.getElementById('sticky-style-selector');
    const selectedStyle = selector.querySelector('div[style*="border-color: var(--accent-color)"]');
    const imgIndex = selectedStyle ? Array.from(selector.children).indexOf(selectedStyle) : Math.floor(Math.random() * StickyBoardConfig.images.length);

    const newSticky = {
        id: Date.now(),
        bgImg: StickyBoardConfig.images[imgIndex],
        status: SB_STATUS.NEED_INTERACT,
        messages: [
            {
                id: Date.now() + 1, 
                sender: 'user', 
                text: text,
                textStyle: StickyBoardConfig.textStyles[0]
            }
        ]
    };

    StickyBoardData.unshift(newSticky);
    saveStickyBoardData();
    textInput.value = '';
    renderStickyBoard();
}

// 【核心】张贴：把暂存内容正式保存，并进入需互动
function pinSticky(stickyId, tempContent) {
    const sticky = StickyBoardData.find(item => item.id === stickyId);
    if (!sticky) return false;

    // 检查是否有暂存的未正式保存的新增内容
    if (!tempContent || tempContent.trim() === '') {
        alert('没有暂存内容，无法张贴。');
        return false;
    }

    // 正式写入
    sticky.messages.push({
        id: Date.now() + Math.random(),
        sender: 'user',
        text: tempContent.trim(),
        textStyle: StickyBoardConfig.textStyles[0]
    });

    // 重置状态为需互动
    sticky.status = SB_STATUS.NEED_INTERACT;

    saveStickyBoardData();
    renderStickyBoard();
    return true;
}

// END：叠加不可回复状态
function endSticky(stickyId) {
    customConfirm('确定将此便签设为不可回复吗？', () => {
        const sticky = StickyBoardData.find(item => item.id === stickyId);
        if (!sticky) return;
        sticky.status = SB_STATUS.NO_REPLY; 
        saveStickyBoardData();
        renderStickyBoard();
    });
}

// 删除整个便签
function deleteSticky(stickyId) {
    customConfirm('确定要删除这张便签吗？', () => {
        StickyBoardData = StickyBoardData.filter(item => item.id !== stickyId);
        saveStickyBoardData();
        renderStickyBoard();
    });
}

// 删除单条消息
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
    });
}

// 获取所有需互动的便签
function getNeedInteractStickies() {
    return StickyBoardData.filter(item => item.status === SB_STATUS.NEED_INTERACT);
}

async function processStickyBoardReply() {
    const needInteractList = getNeedInteractStickies();
    
    const noReplyStickies = needInteractList.filter(item => item.status === SB_STATUS.NO_REPLY);
    noReplyStickies.forEach(item => {
        item.status = SB_STATUS.REPLIED;
        console.log('便签设为不可回复，已跳过回复:', item.id);
    });

    let replyStickies = needInteractList.filter(item => item.status === SB_STATUS.NEED_INTERACT);
    
    if (replyStickies.length === 0) {
        saveStickyBoardData();
        return;
    }

    let selectedStickies = [];
    if (replyStickies.length >= 3) {
        const shuffled = replyStickies.sort(() => 0.5 - Math.random());
        selectedStickies = shuffled.slice(0, 2);
    } else {
        selectedStickies = replyStickies;
    }

    for (const sticky of selectedStickies) {
        const count = Math.floor(Math.random() * 6) + 2; 

        let replyTexts = [];
        if (typeof customReplies !== 'undefined' && customReplies.length > 0) {
            for (let i = 0; i < count; i++) {
                const randomReply = customReplies[Math.floor(Math.random() * customReplies.length)];
                replyTexts.push(randomReply);
            }
        } else {
            console.warn('回复库为空，无法生成便签回复');
        }

        const puncts = ['，', '。', '！', '？', '…', '、'];
        let finalText = '';
        replyTexts.forEach((txt, i) => {
            finalText += txt;
            if (i < replyTexts.length - 1) {
                finalText += puncts[Math.floor(Math.random() * puncts.length)];
            }
        });

        sticky.messages.push({
            id: Date.now() + Math.random(),
            sender: 'partner',
            text: finalText,
            textStyle: StickyBoardConfig.textStyles[0]
        });
        sticky.status = SB_STATUS.REPLIED;
    }

    saveStickyBoardData();
    renderStickyBoard();
    console.log('留言板回复处理完毕');
    return true;
}

function renderStickyBoard() {
    const grid = document.getElementById('sticky-board-grid');
    if (!grid) return;

    if (StickyBoardData.length === 0) {
        grid.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; padding: 50px; color: var(--text-secondary); opacity: 0.6;">
            <i class="fas fa-heart" style="font-size: 40px; display: block; margin-bottom: 10px;"></i>
            还没有留言，写下第一张便签吧~
        </div>`;
        return;
    }

    grid.innerHTML = '';
    StickyBoardData.forEach(sticky => {
        const item = document.createElement('div');
        item.style.cssText = `
            position: relative;
            aspect-ratio: 3 / 4;
            background-image: url(${sticky.bgImg});
            background-size: cover;
            background-position: center;
            border-radius: 6px;
            box-shadow: 0 3px 6px rgba(0,0,0,0.2);
            cursor: pointer;
            transition: transform 0.2s, box-shadow 0.2s;
            overflow: hidden;
        `;

        const statusBadge = document.createElement('div');
        let badgeText = '';
        let badgeColor = '';
        if (sticky.status === SB_STATUS.REPLIED) {
            badgeText = '✓ 已回复';
            badgeColor = 'rgba(46, 204, 113, 0.9)';
        } else if (sticky.status === SB_STATUS.NO_REPLY) {
            badgeText = '✓ 已结束';
            badgeColor = 'rgba(150, 150, 150, 0.9)';
        } else if (sticky.status === SB_STATUS.NEED_INTERACT) {
            badgeText = '需互动';
            badgeColor = 'rgba(241, 196, 15, 0.9)';
        }
        statusBadge.innerText = badgeText;
        statusBadge.style.cssText = `position:absolute; bottom: 5px; left: 50%; transform: translateX(-50%); background: ${badgeColor}; color: white; font-size: 10px; padding: 2px 6px; border-radius: 10px; z-index: 10; pointer-events: none;`;
        item.appendChild(statusBadge);

        if (sticky.messages && sticky.messages.length > 0) {
            const firstMsg = sticky.messages[0];
            const text = document.createElement('div');
            text.innerText = firstMsg.text;
            text.style.cssText = `
                position: absolute;
                top: 10%; left: 10%; right: 10%; bottom: 10%;
                overflow-y: auto;
                font-family: ${firstMsg.textStyle.font};
                color: ${firstMsg.textStyle.color};
                font-weight: ${firstMsg.textStyle.weight};
                line-height: 1.6;
                word-break: break-word;
                text-align: center;
                font-size: 12px;
                pointer-events: none; 
            `;
            item.appendChild(text);
        }

        item.onclick = () => showStickyLarge(sticky);
        grid.appendChild(item);
    });
}

// 大图模式
function showStickyLarge(sticky) {
    const overlay = document.createElement('div');
    overlay.style.cssText = `position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); z-index: 9999; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(4px);`;
    overlay.onclick = (e) => { if (e.target === overlay) document.body.removeChild(overlay); };

    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'display: flex; flex-direction: column; align-items: center; gap: 15px; width: 100%; max-width: 400px;';

    const card = document.createElement('div');
    card.style.cssText = `
        width: 100%;
        aspect-ratio: 3 / 4;
        background-image: url(${sticky.bgImg});
        background-size: cover;
        background-position: center;
        border-radius: 16px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.5);
        position: relative;
        padding: 5%;
        box-sizing: border-box;
    `;

    const msgContainer = document.createElement('div');
    msgContainer.style.cssText = `
        width: 100%; height: 100%;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 10px;
    `;

    // 暂存内容变量（不保存到数据，只作为临时变量）
    let tempContent = null; 

    (sticky.messages || []).forEach(msg => {
        const msgWrap = document.createElement('div');
        msgWrap.style.cssText = `position: relative; padding: 8px; margin-bottom: 8px; width: fit-content; max-width: 90%;`;
        
        const textDiv = document.createElement('div');
        textDiv.innerText = msg.text;
        textDiv.style.cssText = `
            font-family: ${msg.textStyle.font};
            color: ${msg.textStyle.color};
            line-height: 1.8;
            font-size: 16px;
            word-break: break-word;
            text-align: left;
        `;
        msgWrap.appendChild(textDiv);

        const delBtn = document.createElement('div');
        delBtn.className = 'inline-del';
        delBtn.innerHTML = '<i class="fas fa-times"></i>';
        delBtn.style.cssText = `
            position: absolute; top: 4px; right: -10px; width: 18px; height: 18px;
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
        msgContainer.appendChild(msgWrap);
    });

    card.appendChild(msgContainer);
    wrapper.appendChild(card);

    const actions = document.createElement('div');
    actions.style.cssText = 'display: flex; width: 100%; justify-content: center; gap: 10px;';

    // 【修改1：张贴】检查暂存内容是否为空
    const pinBtn = document.createElement('button');
    pinBtn.innerHTML = '张贴';
    pinBtn.style.cssText = 'padding: 10px 20px; border: none; border-radius: 8px; background: rgba(255,255,255,0.8); color: #333; cursor: pointer; font-size: 14px; flex: 1;';
    pinBtn.onclick = () => {
        // 正式保存
        if (pinSticky(sticky.id, tempContent)) {
            document.body.removeChild(overlay);
        }
    };

    // 【修改2：补充】只暂存内容到 tempContent，不保存到数据，不刷新页面
    const supplementBtn = document.createElement('button');
    supplementBtn.innerHTML = '补充';
    supplementBtn.style.cssText = 'padding: 10px 20px; border: none; border-radius: 8px; background: var(--accent-color); color: white; cursor: pointer; font-size: 14px; flex: 1;';
    supplementBtn.onclick = () => {
        customPrompt('补充内容', '输入你想补充的话...', (text) => {
            tempContent = text; // 暂存，不保存
            // 在页面上临时显示一下（但还没保存）
            alert('内容已暂存，点击【张贴】后才会正式保存。');
        });
    };

    const endBtn = document.createElement('button');
    endBtn.innerHTML = 'END';
    endBtn.style.cssText = 'padding: 10px 20px; border: none; border-radius: 8px; background: rgba(255,255,255,0.8); color: #333; cursor: pointer; font-size: 14px; flex: 1;';
    endBtn.onclick = () => {
        endSticky(sticky.id);
    };

    const deleteBtn = document.createElement('button');
    deleteBtn.innerHTML = '删除';
    deleteBtn.style.cssText = 'padding: 10px 20px; border: 1px solid rgba(255,80,80,0.5); border-radius: 8px; background: rgba(255,80,80,0.1); color: #ff5050; cursor: pointer; font-size: 14px; flex: 1;';
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
    renderStyleSelector();
    renderStickyBoard();
    showModal(modal);
}

function closeStickyBoard() {
    const modal = document.getElementById('sticky-board-modal');
    if (modal && typeof hideModal === 'function') {
        hideModal(modal);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const entry = document.getElementById('sticky-board-function');
    if (entry) {
        entry.addEventListener('click', openStickyBoard);
    }
});