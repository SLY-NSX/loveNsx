/* 留言板功能 - Sticky Board V3 (多轮对话逻辑) */

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

// 新版数据结构：数组里存的是“主便签”，每个主便签里有个 messages 数组
let StickyBoardData = []; 

function loadStickyBoardData() {
    const saved = localStorage.getItem('stickyBoardData');
    if (saved) {
        try { StickyBoardData = JSON.parse(saved); } catch(e) { StickyBoardData = []; }
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
                
                <!-- 新建便签区 -->
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

                <!-- 便签展示墙 (一行3个) -->
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

// 创建新便签（创建第一轮消息）
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
        // 初始只有一条消息
        messages: [
            {
                id: Date.now() + 1, // 消息独立ID
                sender: 'user', // 发送者身份：user 是自己，partner 是对方
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

// 删除主便签（整张图消失）
function deleteSticky(stickyId) {
    if (!confirm('确定要删除这张便签吗？')) return;
    StickyBoardData = StickyBoardData.filter(item => item.id !== stickyId);
    saveStickyBoardData();
    renderStickyBoard();
}

// 删除某一轮消息（保留主便签）
function deleteMessage(stickyId, msgId) {
    const sticky = StickyBoardData.find(item => item.id === stickyId);
    if (!sticky) return;
    
    // 过滤掉这一轮
    sticky.messages = sticky.messages.filter(m => m.id !== msgId);

    // 如果删完了，连便签一起删掉
    if (sticky.messages.length === 0) {
        deleteSticky(stickyId);
        return;
    }

    saveStickyBoardData();
    renderStickyBoard();
}

// 渲染留言墙
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

        // 暂时先只取第一条消息渲染在小图上（在没做好排版前）
        const firstMsg = sticky.messages[0];
        if (firstMsg) {
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
                pointer-events: none; /* 防止挡住点击大图 */
            `;
            item.appendChild(text);
        }

        item.onclick = () => showStickyLarge(sticky);
        grid.appendChild(item);
    });
}

// 大图模式（下方有按钮，且支持分段删除）
function showStickyLarge(sticky) {
    const overlay = document.createElement('div');
    overlay.style.cssText = `position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); z-index: 9999; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(4px);`;
    overlay.onclick = (e) => { if (e.target === overlay) document.body.removeChild(overlay); };

    // 外层包装：用于放置大图和下方按钮
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'display: flex; flex-direction: column; align-items: center; gap: 15px; width: 100%; max-width: 400px;';

    // 大图卡片
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

    // 关闭按钮
    const closeBtn = document.createElement('div');
    closeBtn.innerHTML = '<i class="fas fa-times"></i>';
    closeBtn.style.cssText = `
        position: absolute; top: 15px; right: 15px;
        width: 30px; height: 30px;
        background: rgba(255,255,255,0.8); color: #333;
        border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        cursor: pointer; font-size: 16px; z-index: 10;
    `;
    closeBtn.onclick = () => document.body.removeChild(overlay);
    card.appendChild(closeBtn);

    // 消息容器（透明气泡层）
    const msgContainer = document.createElement('div');
    msgContainer.style.cssText = `
        width: 100%; height: 100%;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 10px;
    `;

    // 遍历每一条消息
    sticky.messages.forEach(msg => {
        // 气泡包裹层
        const msgWrap = document.createElement('div');
        msgWrap.style.cssText = `
            position: relative;
            padding: 8px;
            border: 1px solid transparent;
            border-radius: 8px;
            transition: all 0.2s;
            cursor: pointer;
        `;
        
        // 移动端：直接点击显示删除按钮，桌面端：悬停显示
        msgWrap.onclick = (e) => {
            // 在气泡内显示一个隐藏的 ×，用于删除本条
            const del = msgWrap.querySelector('.inline-del');
            if (del) {
               del.style.opacity = '1';
               setTimeout(() => del.style.opacity = '0', 1500); // 显示1.5秒后自动消失
            }
            e.stopPropagation(); // 阻止消息点击冒泡到外层关闭
        };

        // 在真实排版中，这里会根据 sender 决定背景色等，现在先纯文字
        const textDiv = document.createElement('div');
        textDiv.innerText = msg.text;
        textDiv.style.cssText = `
            font-family: ${msg.textStyle.font};
            color: ${msg.textStyle.color};
            line-height: 1.8;
            font-size: 16px;
            word-break: break-word;
            text-align: left;
            pointer-events: none;
        `;
        msgWrap.appendChild(textDiv);

        // 隐藏的 × 删除按钮
        const delBtn = document.createElement('div');
        delBtn.className = 'inline-del';
        delBtn.innerHTML = '<i class="fas fa-times"></i>';
        delBtn.style.cssText = `
            position: absolute;
            top: -5px; right: -5px;
            width: 20px; height: 20px;
            background: rgba(255, 0, 0, 0.8);
            color: white;
            border-radius: 50%;
            display: flex; align-items: center; justify-content: center;
            font-size: 12px;
            opacity: 0;
            transition: opacity 0.2s;
        `;
        delBtn.onclick = (e) => {
            e.stopPropagation(); // 防止触发显示事件
            deleteMessage(sticky.id, msg.id); // 删除这一条消息
            document.body.removeChild(overlay); // 关闭弹窗，重新加载网格
        };
        msgWrap.appendChild(delBtn);

        msgContainer.appendChild(msgWrap);
    });

    card.appendChild(msgContainer);
    wrapper.appendChild(card);

    // 下方按钮区
    const actions = document.createElement('div');
    actions.style.cssText = 'display: flex; width: 100%; justify-content: center; gap: 10px;';

    // 待开发：补充
    const supplementBtn = document.createElement('button');
    supplementBtn.innerHTML = '补充';
    supplementBtn.style.cssText = 'padding: 10px 20px; border: none; border-radius: 8px; background: var(--accent-color); color: white; cursor: pointer; font-size: 14px; flex: 1;';
    supplementBtn.onclick = () => alert('该功能待开发');

    // 待开发：END
    const endBtn = document.createElement('button');
    endBtn.innerHTML = 'END';
    endBtn.style.cssText = 'padding: 10px 20px; border: none; border-radius: 8px; background: rgba(255,255,255,0.8); color: #333; cursor: pointer; font-size: 14px; flex: 1;';
    endBtn.onclick = () => alert('该功能待开发');

    actions.appendChild(supplementBtn);
    actions.appendChild(endBtn);
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