/* 留言板功能 - Sticky Board V2 (基础逻辑版本) */

// 配置：图片路径（根据你的实际项目位置修改，例如 img/xxx.png）
const StickyBoardConfig = {
    images: [
        'img/sticky_bg_1.png', // 米黄
        'img/sticky_bg_2.png', // 淡紫

    ],
    // 后续再做样式优化，先随便给个通用字体
    textStyles: [
        { font: '14px "Noto Serif SC", serif', color: '#333', weight: '400' }
    ]
};

let StickyBoardData = [];

// 读取本地存储
function loadStickyBoardData() {
    const saved = localStorage.getItem('stickyBoardData');
    if (saved) {
        try { StickyBoardData = JSON.parse(saved); } catch(e) { StickyBoardData = []; }
    }
}

// 保存本地存储
function saveStickyBoardData() {
    localStorage.setItem('stickyBoardData', JSON.stringify(StickyBoardData));
}

// 模态框 DOM 构建
function createStickyBoardModal() {
    let modal = document.getElementById('sticky-board-modal');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'sticky-board-modal';
    modal.innerHTML = `
        <div class="modal-content" style="max-height: 90vh; overflow-y: auto; background: transparent; padding: 0; overflow: hidden; display: flex; flex-direction: column;">
            <!-- 标题栏 -->
            <div style="background: var(--accent-color); color: #fff; padding: 15px 20px; display: flex; justify-content: space-between; align-items: center; border-radius: 20px 20px 0 0; flex-shrink: 0;">
                <div style="font-size: 18px; font-weight: 700; letter-spacing: 2px;">
                    <i class="fas fa-sticky-note" style="margin-right: 8px;"></i>留言板
                </div>
                <button onclick="closeStickyBoard()" style="background: none; border: none; color: #fff; font-size: 20px; cursor: pointer;"><i class="fas fa-times"></i></button>
            </div>

            <!-- 内容区（包含新建和列表） -->
            <div style="background: var(--primary-bg); padding: 20px; flex: 1; display: flex; flex-direction: column; overflow-y: auto;">
                
                <!-- 新建便签区 -->
                <div style="background: rgba(255,255,255,0.05); border: 2px dashed var(--accent-color); border-radius: 12px; padding: 15px; margin-bottom: 20px; display: flex; flex-direction: column; gap: 12px;">
                    <div style="font-size: 14px; font-weight: 600; color: var(--text-primary);">✍️ 新建便签</div>
                    
                    <textarea id="sticky-input" placeholder="写下你想说的话..." style="min-height: 80px; padding: 10px; border-radius: 8px; border: 1px solid var(--border-color); background: var(--secondary-bg); color: var(--text-primary); font-size: 14px; resize: none; outline: none;"></textarea>

                    <div style="display: flex; gap: 10px; align-items: center;">
                        <div style="font-size: 12px; color: var(--text-secondary);">选择样式：</div>
                        <div style="display: flex; gap: 5px; cursor: pointer;" id="sticky-style-selector">
                            <!-- 动态渲染样式 -->
                        </div>
                    </div>

                    <button onclick="submitSticky()" style="margin-top: 5px; width: 100%; padding: 12px; background: var(--accent-color); color: #fff; border: none; border-radius: 8px; font-size: 15px; font-weight: 600; cursor: pointer; transition: opacity 0.2s;">
                        <i class="fas fa-paper-plane"></i> 贴出便签
                    </button>
                </div>

                <!-- 便签展示墙 (一行3个) -->
                <div id="sticky-board-grid" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; padding-bottom: 20px;">
                    <!-- 动态渲染 -->
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    return modal;
}

// 渲染样式选择器
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

// 提交留言
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

    // 目前先写死字体，后面再改
    const randomTextStyle = StickyBoardConfig.textStyles[0];

    const newSticky = {
        id: Date.now(),
        text: text,
        bgImg: StickyBoardConfig.images[imgIndex],
        textStyle: randomTextStyle,
        date: new Date().toLocaleString() // 数据里保留，但我不渲染它
    };

    StickyBoardData.unshift(newSticky);
    saveStickyBoardData();
    textInput.value = '';
    renderStickyBoard();
}

// 删除单条便签
function deleteSticky(id) {
    if (!confirm('确定要删除这张便签吗？')) return;
    StickyBoardData = StickyBoardData.filter(item => item.id !== id);
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

        // 右上角小 × 删除按钮
        const delBtn = document.createElement('div');
        delBtn.innerHTML = '<i class="fas fa-times"></i>';
        delBtn.style.cssText = `
            position: absolute;
            top: 3px;
            right: 3px;
            width: 18px;
            height: 18px;
            background: rgba(0,0,0,0.6);
            color: white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 10px;
            cursor: pointer;
            z-index: 10;
        `;
        delBtn.onclick = (e) => {
            e.stopPropagation(); // 阻止冒泡，不触发大图
            deleteSticky(sticky.id);
        };
        item.appendChild(delBtn);

        // 显示文字
        const text = document.createElement('div');
        text.innerText = sticky.text;
        text.style.cssText = `
            position: absolute;
            top: 15%;
            left: 10%;
            right: 10%;
            bottom: 15%;
            overflow-y: auto;
            font-family: ${sticky.textStyle.font};
            color: ${sticky.textStyle.color};
            font-weight: ${sticky.textStyle.weight};
            line-height: 1.6;
            word-break: break-word;
            display: flex;
            align-items: center;
            justify-content: center;
            text-align: center;
            font-size: 12px; /* 因为一行3个变窄了，所以稍微调小字体 */
        `;
        item.appendChild(text);

        // 点击进入大图
        item.onclick = () => showStickyLarge(sticky);

        grid.appendChild(item);
    });
}

// 显示大图（全屏预览）
function showStickyLarge(sticky) {
    const overlay = document.createElement('div');
    overlay.style.cssText = `position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); z-index: 9999; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(4px);`;
    overlay.onclick = (e) => {
        if (e.target === overlay) document.body.removeChild(overlay);
    };

    const card = document.createElement('div');
    card.style.cssText = `
        width: 80%; max-width: 400px;
        aspect-ratio: 3 / 4;
        background-image: url(${sticky.bgImg});
        background-size: cover;
        background-position: center;
        border-radius: 16px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.5);
        position: relative;
        padding: 20%;
        box-sizing: border-box;
    `;

    const text = document.createElement('div');
    text.innerText = sticky.text;
    text.style.cssText = `
        width: 100%; height: 100%;
        overflow-y: auto;
        font-family: ${sticky.textStyle.font};
        color: ${sticky.textStyle.color};
        font-weight: ${sticky.textStyle.weight};
        line-height: 1.8;
        font-size: 16px;
        display: flex;
        align-items: center;
        justify-content: center;
        text-align: center;
    `;
    card.appendChild(text);

    // 右上角关闭按钮
    const closeBtn = document.createElement('div');
    closeBtn.innerHTML = '<i class="fas fa-times"></i>';
    closeBtn.style.cssText = `
        position: absolute;
        top: 15px;
        right: 15px;
        width: 30px;
        height: 30px;
        background: rgba(255,255,255,0.8);
        color: #333;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        font-size: 16px;
    `;
    closeBtn.onclick = () => document.body.removeChild(overlay);
    card.appendChild(closeBtn);

    // 底部操作栏
    const actions = document.createElement('div');
    actions.style.cssText = `
        position: absolute;
        bottom: 15px;
        width: 100%;
        display: flex;
        justify-content: center;
        gap: 10px;
    `;

    // 删除本条按钮
    const delBtn = document.createElement('button');
    delBtn.innerHTML = '删除本条';
    delBtn.style.cssText = 'padding: 6px 12px; border: none; border-radius: 8px; background: #e74c3c; color: white; cursor: pointer; font-size: 13px;';
    delBtn.onclick = () => {
        if (confirm('确定要删除这条留言吗？')) {
            deleteSticky(sticky.id);
            document.body.removeChild(overlay);
        }
    };

    // 待开发：补充
    const supplementBtn = document.createElement('button');
    supplementBtn.innerHTML = '补充';
    supplementBtn.style.cssText = 'padding: 6px 12px; border: none; border-radius: 8px; background: rgba(255,255,255,0.8); color: #333; cursor: pointer; font-size: 13px;';
    supplementBtn.onclick = () => alert('该功能待开发');

    // 待开发：结束
    const endBtn = document.createElement('button');
    endBtn.innerHTML = '结束';
    endBtn.style.cssText = 'padding: 6px 12px; border: none; border-radius: 8px; background: rgba(255,255,255,0.8); color: #333; cursor: pointer; font-size: 13px;';
    endBtn.onclick = () => alert('该功能待开发');

    actions.appendChild(delBtn);
    actions.appendChild(supplementBtn);
    actions.appendChild(endBtn);
    card.appendChild(actions);

    overlay.appendChild(card);
    document.body.appendChild(overlay);
}

// 打开留言板
function openStickyBoard() {
    loadStickyBoardData();
    const modal = createStickyBoardModal();
    renderStyleSelector();
    renderStickyBoard();
    // 假设你的 main.js 里有 showModal 函数，如果没有，直接用下面这句：
    // modal.style.display = 'flex';
    showModal(modal);
}

// 关闭留言板
function closeStickyBoard() {
    const modal = document.getElementById('sticky-board-modal');
    if (modal && typeof hideModal === 'function') {
        hideModal(modal);
    }
}

// 自动挂载到入口
document.addEventListener('DOMContentLoaded', () => {
    const entry = document.getElementById('sticky-board-function');
    if (entry) {
        entry.addEventListener('click', openStickyBoard);
    }
});