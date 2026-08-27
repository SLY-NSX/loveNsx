/* 留言板功能 - Sticky Board V4 */

const StickyBoardConfig = {
    images: [
        'img/sticky_bg_1.png', 
        'img/sticky_bg_2.png', 
        'img/sticky_bg_3.png', 
        'img/sticky_bg_4.png'
    ],
    textStyles: [
        { font: '14px "Noto Serif SC", serif', color: '#333', weight: '400' }
    ]
};

let StickyBoardData = []; 

function loadStickyBoardData() {
    const saved = localStorage.getItem('stickyBoardData');
    if (saved) {
        try { 
            StickyBoardData = JSON.parse(saved); 

            // 数据清洗兼容
            StickyBoardData = StickyBoardData.map(item => {
                if (item.text && !item.messages) {
                    return {
                        id: item.id || Date.now(),
                        bgImg: item.bgImg || StickyBoardConfig.images[0],
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
            document.getElementById('sticky-selected-index').value = index;
        };
        container.appendChild(div);
    });
}

// 创建新便签
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

// 删除整个便签
function deleteSticky(stickyId) {
    if (!confirm('确定要删除这张便签吗？')) return;
    StickyBoardData = StickyBoardData.filter(item => item.id !== stickyId);
    saveStickyBoardData();
    renderStickyBoard();
}

// 删除单条消息
function deleteMessage(stickyId, msgId) {
    const sticky = StickyBoardData.find(item => item.id === stickyId);
    if (!sticky) return;
    
    sticky.messages = sticky.messages.filter(m => m.id !== msgId);

    if (sticky.messages.length === 0) {
        deleteSticky(stickyId);
        return;
    }

    saveStickyBoardData();
    renderStickyBoard();
}

// 渲染小图
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
    // 点击空白处关闭，不设置 X 按钮
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

    // 消息容器
    const msgContainer = document.createElement('div');
    msgContainer.style.cssText = `
        width: 100%; height: 100%;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 10px;
    `;

    // 遍历消息
    (sticky.messages || []).forEach(msg => {
        const msgWrap = document.createElement('div');
        msgWrap.style.cssText = `
            position: relative;
            padding: 8px;
            margin-bottom: 8px;
            width: fit-content; /* 宽度随内容自适应，且不过分拉伸 */
            max-width: 90%;
        `;
        
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

        // 单条删除按钮（暗色半透明，点击文字时显示，紧贴文字右上角）
        const delBtn = document.createElement('div');
        delBtn.className = 'inline-del';
        delBtn.innerHTML = '<i class="fas fa-times"></i>';
        delBtn.style.cssText = `
            position: absolute;
            top: 4px;
            right: -10px; /* 紧贴文字末尾 */
            width: 18px; height: 18px;
            background: rgba(0,0,0,0.5); /* 暗色半透明 */
            color: rgba(255,255,255,0.7);
            border-radius: 50%;
            display: flex; align-items: center; justify-content: center;
            font-size: 11px;
            opacity: 0;
            transition: opacity 0.2s;
            cursor: pointer;
        `;
        
        // 点击文字即显示删除按钮
        msgWrap.onclick = (e) => {
            delBtn.style.opacity = '1';
            setTimeout(() => delBtn.style.opacity = '0', 2000);
            e.stopPropagation();
        };

        delBtn.onclick = (e) => {
            e.stopPropagation();
            if(confirm('确认删除这条内容？')) {
                deleteMessage(sticky.id, msg.id);
                document.body.removeChild(overlay);
            }
        };
        msgWrap.appendChild(delBtn);

        msgContainer.appendChild(msgWrap);
    });

    card.appendChild(msgContainer);
    wrapper.appendChild(card);

    // 下方按钮区
    const actions = document.createElement('div');
    actions.style.cssText = 'display: flex; width: 100%; justify-content: center; gap: 10px;';

    // 张贴按钮（占位）
    const pinBtn = document.createElement('button');
    pinBtn.innerHTML = '张贴';
    pinBtn.style.cssText = 'padding: 10px 20px; border: none; border-radius: 8px; background: rgba(255,255,255,0.8); color: #333; cursor: pointer; font-size: 14px; flex: 1;';
    pinBtn.onclick = () => alert('张贴功能待开发');

    // 补充按钮（占位）
    const supplementBtn = document.createElement('button');
    supplementBtn.innerHTML = '补充';
    supplementBtn.style.cssText = 'padding: 10px 20px; border: none; border-radius: 8px; background: var(--accent-color); color: white; cursor: pointer; font-size: 14px; flex: 1;';
    supplementBtn.onclick = () => alert('补充功能待开发');

    // END 按钮（占位）
    const endBtn = document.createElement('button');
    endBtn.innerHTML = 'END';
    endBtn.style.cssText = 'padding: 10px 20px; border: none; border-radius: 8px; background: rgba(255,255,255,0.8); color: #333; cursor: pointer; font-size: 14px; flex: 1;';
    endBtn.onclick = () => alert('END功能待开发');

    // 删除整张按钮
    const deleteBtn = document.createElement('button');
    deleteBtn.innerHTML = '删除';
    deleteBtn.style.cssText = 'padding: 10px 20px; border: 1px solid rgba(255,80,80,0.5); border-radius: 8px; background: rgba(255,80,80,0.1); color: #ff5050; cursor: pointer; font-size: 14px; flex: 1;';
    deleteBtn.onclick = () => {
        if(confirm('确定要删除整张便签吗？')) {
            deleteSticky(sticky.id);
            document.body.removeChild(overlay);
        }
    };

    actions.appendChild(pinBtn);
    actions.appendChild(supplementBtn);
    actions.appendChild(endBtn);
    actions.appendChild(deleteBtn);
    
    wrapper.appendChild(actions);
    overlay.appendChild(wrapper);
    document.body.appendChild(overlay);
}

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