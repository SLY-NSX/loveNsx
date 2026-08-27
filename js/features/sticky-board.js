/* 留言板功能 - Sticky Board */

// 配置：方便后续替换图片 URL
const StickyBoardConfig = {
    // 你的 PNG 图片 URL 列表（建议 600x800）
    images: [
        'img/sticky_bg_1.png', 
        'img/sticky_bg_2.png', 

    ],
    // 文字样式配置池（制造真实感）
    textStyles: [
        { font: '14px "Noto Serif SC", serif', color: '#333', weight: '400' },
        { font: '16px "Comic Sans MS", cursive', color: '#5C4033', weight: '500' },
        { font: '13px "KaiTi", "楷体", serif', color: '#006666', weight: '600' },
        { font: '15px "Microsoft YaHei", sans-serif', color: '#4A235A', weight: '400' },
        { font: '17px "PingFang SC", sans-serif', color: '#8B4513', weight: '700' }
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

                <!-- 便签展示墙 -->
                <div id="sticky-board-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 15px; padding-bottom: 20px;">
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
        div.style.cssText = `width: 40px; height: 50px; background: url(${img}) center/cover; border: 2px solid transparent; border-radius: 4px; transition: all 0.2s;`;
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

    // 随机抽取文字样式
    const randomTextStyle = StickyBoardConfig.textStyles[Math.floor(Math.random() * StickyBoardConfig.textStyles.length)];

    const newSticky = {
        id: Date.now(),
        text: text,
        bgImg: StickyBoardConfig.images[imgIndex],
        textStyle: randomTextStyle,
        date: new Date().toLocaleString()
    };

    StickyBoardData.unshift(newSticky);
    saveStickyBoardData();
    textInput.value = '';
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
            border-radius: 8px;
            box-shadow: 0 4px 8px rgba(0,0,0,0.2);
            cursor: pointer;
            transition: transform 0.2s, box-shadow 0.2s;
            overflow: hidden;
        `;
        item.onmouseover = () => { item.style.transform = 'scale(1.05)'; item.style.boxShadow = '0 8px 16px rgba(0,0,0,0.3)'; };
        item.onmouseout = () => { item.style.transform = 'scale(1)'; item.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)'; };
        item.onclick = () => showStickyLarge(sticky);

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
        `;
        item.appendChild(text);
        grid.appendChild(item);
    });
}

// 显示大图（全屏预览）
function showStickyLarge(sticky) {
    const overlay = document.createElement('div');
    overlay.style.cssText = `position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); z-index: 9999; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(4px);`;
    overlay.onclick = () => document.body.removeChild(overlay);

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
        font-size: 18px;
        display: flex;
        align-items: center;
        justify-content: center;
        text-align: center;
    `;

    const date = document.createElement('div');
    date.innerText = sticky.date;
    date.style.cssText = `position: absolute; bottom: 5%; width: 100%; text-align: center; font-size: 10px; color: rgba(0,0,0,0.5);`;

    card.appendChild(text);
    card.appendChild(date);
    overlay.appendChild(card);
    document.body.appendChild(overlay);
}

// 打开留言板
function openStickyBoard() {
    loadStickyBoardData();
    const modal = createStickyBoardModal();
    renderStyleSelector();
    renderStickyBoard();
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