(function () {
    'use strict';
    (function blockDm6CSS() {
        if (document.getElementById('dm6-style')) return; 
        var s = document.createElement('style');
        s.id = 'dm6-style'; 
        s.textContent = '/* dm6-style blocked by data-modal v9 */';
        document.head.appendChild(s);
    })();

    var INNER_HTML =
        '<div class="dm-topbar">'
        +   '<div class="dm-topbar-left">'
        +     '<button class="dm-topbar-back" id="back-data"><i class="fas fa-arrow-left"></i></button>'
        +     '<span class="dm-topbar-title">数据管理</span>'
        +   '</div>'
        +   '<button class="dm-topbar-close" id="close-data"><i class="fas fa-xmark"></i></button>'
        + '</div>'

        + '<div class="dm-body">'

        +   '<div class="dm-storage-card">'
        +     '<div class="dm-storage-header">'
        +       '<span class="dm-storage-title"><i class="fas fa-database" style="margin-right:5px;opacity:0.55"></i>存储用量</span>'
        +       '<span class="dm-storage-label" id="dm-storage-total">计算中…</span>'
        +     '</div>'
        +     '<div class="dm-stats-grid">'
        +       '<div class="dm-stat-block"><div class="dm-stat-block-icon" style="color:var(--accent-color)"><i class="fas fa-comments"></i></div><div class="dm-stat-pill-val" id="dm-stat-msgs">—</div><div class="dm-stat-pill-key">聊天记录</div></div>'
        +       '<div class="dm-stat-block"><div class="dm-stat-block-icon" style="color:#9C6FD4"><i class="fas fa-sliders"></i></div><div class="dm-stat-pill-val" id="dm-stat-settings">—</div><div class="dm-stat-pill-key">设置数据</div></div>'
        +       '<div class="dm-stat-block"><div class="dm-stat-block-icon" style="color:#3BC8A4"><i class="fas fa-images"></i></div><div class="dm-stat-pill-val" id="dm-stat-media">—</div><div class="dm-stat-pill-key">图片媒体</div></div>'
        +     '</div>'
        +     '<div class="dm-progress-track"><div class="dm-progress-fill" id="dm-storage-bar" style="width:0%"></div></div>'
        +   '</div>'

        +   '<div class="dm-section-label"><i class="fas fa-cloud-upload-alt"></i> 备份与恢复</div>'
        +   '<div class="dm-grid">'
        +     '<div class="dm-tile" id="dm-tile-full-backup">'
        +       '<div class="dm-tile-icon blue"><i class="fas fa-layer-group"></i></div>'
        +       '<div class="dm-tile-info"><div class="dm-tile-title">全量备份</div><div class="dm-tile-desc">所有设置与数据</div></div>'
        +       '<i class="fas fa-chevron-right dm-tile-arrow"></i>'
        +     '</div>'
        +     '<div class="dm-tile" id="dm-tile-chat-backup">'
        +       '<div class="dm-tile-icon teal"><i class="fas fa-comments"></i></div>'
        +       '<div class="dm-tile-info"><div class="dm-tile-title">聊天记录</div><div class="dm-tile-desc">消息内容单独备份</div></div>'
        +       '<i class="fas fa-chevron-right dm-tile-arrow"></i>'
        +     '</div>'
        +   '</div>'

        +   '<div style="display:none">'
        +     '<button id="export-all-settings"></button>'
        +     '<button id="import-all-settings"></button>'
        +     '<button id="export-chat-btn"></button>'
        +     '<button id="import-chat-btn"></button>'
        +   '</div>'

        +   '<div class="dm-section-label"><i class="fas fa-bell"></i> 通知与关于</div>'
        +   '<div class="dm-row-card">'
        +     '<div class="dm-row-item">'
        +       '<div class="dm-row-icon amber"><i class="fas fa-bell"></i></div>'
        +       '<div class="dm-row-info"><div class="dm-row-title">后台消息推送</div><div class="dm-row-desc" id="notif-status-text">收到新消息时弹出提醒</div></div>'
        +       '<label class="dm-toggle-pill"><input type="checkbox" id="notif-permission-toggle" onchange="handleNotifToggle(this)"><span class="dm-toggle-slider"></span></label>'
        +     '</div>'
        +     '<div class="dm-row-item" id="replay-tutorial-btn-row" style="cursor:pointer">'
        +       '<div class="dm-row-icon slate"><i class="fas fa-compass"></i></div>'
        +       '<div class="dm-row-info"><div class="dm-row-title">重放新手引导</div><div class="dm-row-desc">重新播放功能介绍教程</div></div>'
        +       '<button class="dm-nav-btn" id="replay-tutorial-btn"><i class="fas fa-play"></i></button>'
        +     '</div>'
        +     '<div class="dm-row-item" id="open-credits-row" style="cursor:pointer">'
        +       '<div class="dm-row-icon violet"><i class="fas fa-scroll"></i></div>'
        +       '<div class="dm-row-info"><div class="dm-row-title">声明与致谢</div><div class="dm-row-desc">开源声明、致谢名单</div></div>'
        +       '<button class="dm-nav-btn" id="open-credits-btn"><i class="fas fa-chevron-right"></i></button>'
        +     '</div>'
        +   '</div>'

        +   '<div class="dm-section-label danger-label"><i class="fas fa-triangle-exclamation"></i> 危险操作</div>'
        +   '<div class="dm-danger-cards dm-danger-cards-row">'
        +     '<button class="dm-danger-card dm-danger-card-orange dm-danger-card-half" id="clear-chat-only">'
        +       '<div class="dm-danger-card-icon"><i class="fas fa-eraser"></i></div>'
        +       '<div class="dm-danger-card-body">'
        +         '<div class="dm-danger-card-title">清除会话</div>'
        +         '<div class="dm-danger-card-desc">删除本会话消息</div>'
        +       '</div>'
        +     '</button>'
        +     '<button class="dm-danger-card dm-danger-card-red dm-danger-card-half" id="clear-storage">'
        +       '<div class="dm-danger-card-icon"><i class="fas fa-skull-crossbones"></i></div>'
        +       '<div class="dm-danger-card-body">'
        +         '<div class="dm-danger-card-title">重置数据</div>'
        +         '<div class="dm-danger-card-desc">清空所有，不可撤销</div>'
        +       '</div>'
        +     '</button>'
        +   '</div>'

        + '</div>'
        ;

    var DRAWER_FULL_HTML =
        '<div class="dm-action-drawer" id="dm-drawer-full">'
        +   '<div class="dm-drawer-backdrop" id="dm-drawer-full-backdrop"></div>'
        +   '<div class="dm-drawer-sheet">'
        +     '<div class="dm-drawer-handle"></div>'
        +     '<div class="dm-drawer-title">'
        +       '<div class="dm-drawer-title-icon blue" style="background:linear-gradient(135deg,#4A90E2,#3576C8);color:#fff"><i class="fas fa-layer-group"></i></div>'
        +       '<div><div class="dm-drawer-title-text">全量备份</div><div class="dm-drawer-subtitle">包含所有设置、外观、字卡等数据</div></div>'
        +     '</div>'
        +     '<div class="dm-drawer-actions">'
        +       '<button class="dm-drawer-action-btn primary" id="export-all-settings-real">'
        +         '<div class="dm-drawer-btn-icon"><i class="fas fa-download"></i></div>'
        +         '<div class="dm-drawer-btn-text"><div class="dm-drawer-btn-title">导出备份</div><div class="dm-drawer-btn-desc">将数据保存为文件</div></div>'
        +       '</button>'
        +       '<button class="dm-drawer-action-btn" id="import-all-settings-real">'
        +         '<div class="dm-drawer-btn-icon"><i class="fas fa-upload"></i></div>'
        +         '<div class="dm-drawer-btn-text"><div class="dm-drawer-btn-title">从文件恢复</div><div class="dm-drawer-btn-desc">选择之前导出的备份文件</div></div>'
        +       '</button>'
        +     '</div>'
        +     '<button class="dm-drawer-cancel" id="dm-drawer-full-cancel">取消</button>'
        +   '</div>'
        + '</div>';

    var DRAWER_CHAT_HTML =
        '<div class="dm-action-drawer" id="dm-drawer-chat">'
        +   '<div class="dm-drawer-backdrop" id="dm-drawer-chat-backdrop"></div>'
        +   '<div class="dm-drawer-sheet">'
        +     '<div class="dm-drawer-handle"></div>'
        +     '<div class="dm-drawer-title">'
        +       '<div class="dm-drawer-title-icon" style="background:linear-gradient(135deg,#3BC8A4,#20A882);color:#fff"><i class="fas fa-comments"></i></div>'
        +       '<div><div class="dm-drawer-title-text">聊天记录</div><div class="dm-drawer-subtitle">仅包含消息内容</div></div>'
        +     '</div>'
        +     '<div class="dm-drawer-actions">'
        +       '<button class="dm-drawer-action-btn primary" id="export-chat-btn-real" style="background:linear-gradient(135deg,#3BC8A4,#20A882);border-color:#3BC8A4">'
        +         '<div class="dm-drawer-btn-icon"><i class="fas fa-download"></i></div>'
        +         '<div class="dm-drawer-btn-text"><div class="dm-drawer-btn-title">导出聊天</div><div class="dm-drawer-btn-desc">将消息记录保存为文件</div></div>'
        +       '</button>'
        +       '<button class="dm-drawer-action-btn" id="import-chat-btn-real">'
        +         '<div class="dm-drawer-btn-icon"><i class="fas fa-upload"></i></div>'
        +         '<div class="dm-drawer-btn-text"><div class="dm-drawer-btn-title">导入聊天</div><div class="dm-drawer-btn-desc">从文件恢复历史消息</div></div>'
        +       '</button>'
        +     '</div>'
        +     '<button class="dm-drawer-cancel" id="dm-drawer-chat-cancel">取消</button>'
        +   '</div>'
        + '</div>';

    function isCorrect(mc) {
        return mc.querySelector('.dm-topbar') !== null
            && mc.querySelector('.dm-storage-card') !== null
            && mc.querySelector('.dm6') === null
            && mc.querySelector('.dm6-tabs') === null;
    }

    function ensureDrawersOnBody() {
        var DRAWER_IDS = ['dm-drawer-full', 'dm-drawer-chat'];
        DRAWER_IDS.forEach(function(id) {
            var existing = document.getElementById(id);
            if (existing && existing.parentElement === document.body) return;
            if (existing) {
                document.body.appendChild(existing);
                return;
            }
            var dummy = document.createElement('div');
            if (id === 'dm-drawer-full') dummy.innerHTML = DRAWER_FULL_HTML;
            else dummy.innerHTML = DRAWER_CHAT_HTML;
            document.body.appendChild(dummy.firstElementChild);
        });
    }

    function writeHTML(mc) {
        mc.innerHTML = INNER_HTML;
        mc.dataset.dm6Built = 'v9'; 
        ensureDrawersOnBody();
        bindAll(mc);
    }

    function ensureHTML(mc) {
        if (!mc) return;
        mc.dataset.dm6Built = 'v9'; 
        if (!isCorrect(mc)) writeHTML(mc);
        else ensureDrawersOnBody(); 
    }

function fmt(b) {
    if (b < 1024) return Math.round(b) + ' B';
    if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
    return (b / 1048576).toFixed(2) + ' MB';
}

function applyStats(total, msgs, cfg, media) {
    var g = function (id) { return document.getElementById(id); };

    // 直接显示手动累加的分类
    if (g('dm-stat-msgs'))     g('dm-stat-msgs').textContent     = fmt(msgs);
    if (g('dm-stat-settings')) g('dm-stat-settings').textContent = fmt(cfg);
    if (g('dm-stat-media'))    g('dm-stat-media').textContent    = fmt(media);

    // 顶部总用量 = total（手动累加），进度条 = total / quota
    var totalEl = g('dm-storage-total');
    var barEl   = g('dm-storage-bar');

    if (navigator.storage && navigator.storage.estimate) {
        navigator.storage.estimate().then(function(est) {
            var quota = est.quota || 0;
            var pct = quota > 0 ? Math.min(100, total / quota * 100) : 0;
            var pctStr = pct.toFixed(1);
            var quotaStr = quota >= 1073741824 ? (quota/1073741824).toFixed(2)+' GB'
                         : quota >= 1048576    ? (quota/1048576).toFixed(1)+' MB'
                         : quota > 0           ? (quota/1024).toFixed(1)+' KB' : '未知';
            if (totalEl) totalEl.textContent = fmt(total) + ' / ' + quotaStr + ' (' + pctStr + '%)';
            if (barEl) {
                barEl.style.width = pctStr + '%';
                barEl.style.background = pct > 80
                    ? 'linear-gradient(90deg,#FF3B30,#CC0000)'
                    : pct > 50
                    ? 'linear-gradient(90deg,#FF9F0A,#E07000)'
                    : 'linear-gradient(90deg,var(--accent-color),rgba(var(--accent-color-rgb),0.6))';
            }
        }).catch(function() {
            if (totalEl) totalEl.textContent = fmt(total);
            if (barEl) barEl.style.width = '0%';
        });
    } else {
        if (totalEl) totalEl.textContent = fmt(total);
        if (barEl) barEl.style.width = '0%';
    }
}

    function updateStats() {
        var total = 0, msgs = 0, cfg = 0, media = 0;
        var processLS = function () {
            for (var i = 0; i < localStorage.length; i++) {
                var k = localStorage.key(i) || '';
                var v = localStorage.getItem(k) || '';
                var bytes = (k.length + v.length) * 2;
                total += bytes;
                if (/messages|msgs|session/i.test(k)) msgs += bytes;
                else if (v.startsWith('data:image') || v.startsWith('data:video')) media += bytes;
                else cfg += bytes;
            }
            applyStats(total, msgs, cfg, media);
        };
        try {
            if (window.localforage) {
                localforage.keys().then(function (keys) {
                    var promises = keys.map(function (k) {
                        return localforage.getItem(k).then(function (raw) {
                            if (raw == null) return { k: k, b: 0 };
                            var str = typeof raw === 'string' ? raw : JSON.stringify(raw);
                            return { k: k, b: (k.length + str.length) * 2 };
                        });
                    });
                    Promise.all(promises).then(function (results) {
                        results.forEach(function (r) {
                            total += r.b;
                            if (/messages|msgs|session/i.test(r.k)) msgs += r.b;
                            else if (/avatar|image|photo|bg|background|wallpaper/i.test(r.k)) media += r.b;
                            else cfg += r.b;
                        });
                        applyStats(total, msgs, cfg, media);
                    }).catch(processLS);
                }).catch(processLS);
            } else { processLS(); }
        } catch (e) { processLS(); }
    }

    function syncToggles() {
        var n = document.getElementById('notif-permission-toggle');
        if (n) n.checked = localStorage.getItem('notifEnabled') === '1'
                        && 'Notification' in window
                        && Notification.permission === 'granted';
    }

    function openDrawer(drawerId) {
        var drawer = document.getElementById(drawerId);
        if (!drawer) return;
        drawer.classList.add('open');
        document.body.style.overflow = 'hidden';
    }
    function closeDrawer(drawerId) {
        var drawer = document.getElementById(drawerId);
        if (!drawer) return;
        drawer.classList.remove('open');
        document.body.style.overflow = '';
    }

    function bindAll(mc) {
        var closeBtn = mc.querySelector('#close-data');
        if (closeBtn) closeBtn.addEventListener('click', function () {
            var modal = document.getElementById('data-modal');
            if (modal && typeof hideModal === 'function') hideModal(modal);
        });

        var backBtn = mc.querySelector('#back-data');
        if (backBtn) backBtn.addEventListener('click', function () {
            var dataModal = document.getElementById('data-modal');
            if (dataModal && typeof hideModal === 'function') hideModal(dataModal);
            var settingsModal = document.getElementById('settings-modal');
            if (settingsModal && typeof showModal === 'function') showModal(settingsModal);
        });

        var tileFullBackup = mc.querySelector('#dm-tile-full-backup');
        if (tileFullBackup) tileFullBackup.addEventListener('click', function () { openDrawer('dm-drawer-full'); });

        var tileChatBackup = mc.querySelector('#dm-tile-chat-backup');
        if (tileChatBackup) tileChatBackup.addEventListener('click', function () { openDrawer('dm-drawer-chat'); });

        var fullDrawer = document.getElementById('dm-drawer-full');
        if (fullDrawer) {
            var backdrop1 = fullDrawer.querySelector('#dm-drawer-full-backdrop');
            if (backdrop1) backdrop1.addEventListener('click', function () { closeDrawer('dm-drawer-full'); });
            var cancelBtn1 = fullDrawer.querySelector('#dm-drawer-full-cancel');
            if (cancelBtn1) cancelBtn1.addEventListener('click', function () { closeDrawer('dm-drawer-full'); });
            var exportAllReal = fullDrawer.querySelector('#export-all-settings-real');
            if (exportAllReal) exportAllReal.addEventListener('click', function () {
                closeDrawer('dm-drawer-full');
                if (typeof exportAllData === 'function') exportAllData();
            });
            var importAllReal = fullDrawer.querySelector('#import-all-settings-real');
            if (importAllReal) importAllReal.addEventListener('click', function () {
                closeDrawer('dm-drawer-full');
                var inp = document.createElement('input');
                inp.type = 'file'; inp.accept = '.json,.zip,application/json,application/zip';
                inp.onchange = function (e) {
                    var f = e.target.files && e.target.files[0];
                    if (f && typeof importAllData === 'function') importAllData(f);
                };
                inp.click();
            });
        }

        var chatDrawer = document.getElementById('dm-drawer-chat');
        if (chatDrawer) {
            var backdrop2 = chatDrawer.querySelector('#dm-drawer-chat-backdrop');
            if (backdrop2) backdrop2.addEventListener('click', function () { closeDrawer('dm-drawer-chat'); });
            var cancelBtn2 = chatDrawer.querySelector('#dm-drawer-chat-cancel');
            if (cancelBtn2) cancelBtn2.addEventListener('click', function () { closeDrawer('dm-drawer-chat'); });
            var exportChatReal = chatDrawer.querySelector('#export-chat-btn-real');
            if (exportChatReal) exportChatReal.addEventListener('click', function () {
                closeDrawer('dm-drawer-chat');
                if (typeof exportChatHistory === 'function') exportChatHistory();
            });
            var importChatReal = chatDrawer.querySelector('#import-chat-btn-real');
            if (importChatReal) importChatReal.addEventListener('click', function () {
                closeDrawer('dm-drawer-chat');
                var inp = document.createElement('input');
                inp.type = 'file'; inp.accept = '.json';
                inp.onchange = function (e) {
                    var f = e.target.files && e.target.files[0];
                    if (f && typeof importChatHistory === 'function') importChatHistory(f);
                };
                inp.click();
            });
        }

        var clearChatBtn = mc.querySelector('#clear-chat-only');
        if (clearChatBtn) clearChatBtn.addEventListener('click', function () {
            if (!confirm('确定要清除当前会话的所有消息吗？\n\n所有设置、头像、字卡等数据将保留，仅聊天记录会被删除。\n\n此操作无法恢复！')) return;
            // 修复：直接赋值 let messages（window.messages 赋值不影响 let 绑定）
            messages = [];
            displayedMessageCount = typeof HISTORY_BATCH_SIZE !== 'undefined' ? HISTORY_BATCH_SIZE : 20;
            try { localStorage.removeItem('BACKUP_V1_critical'); } catch(e) {}
            try { localStorage.removeItem('BACKUP_V1_timestamp'); } catch(e) {}
            if (window.localforage && typeof getStorageKey === 'function') {
                localforage.setItem(getStorageKey('chatMessages'), []).catch(function() {});
            }
            if (typeof renderMessages === 'function') renderMessages();
            if (typeof showNotification === 'function') showNotification('聊天记录已清除', 'success');
        });

        var clearBtn = mc.querySelector('#clear-storage');
        if (clearBtn) clearBtn.addEventListener('click', function () {
            if (!confirm('⚠️ 确定要清空全部数据吗？\n\n所有消息、设置、字卡、头像等将被永久删除，不可恢复！')) return;
            if (!confirm('最后确认：清空后页面将自动刷新，无法撤销，继续吗？')) return;
            window._skipBackup = true;
            var doReset = function () {
                localStorage.clear();
                if (typeof showNotification === 'function') showNotification('所有数据已清空，即将刷新…', 'info', 2000);
                setTimeout(function () { window.location.href = window.location.pathname + '?reset=' + Date.now(); }, 2000);
            };
            window.localforage ? localforage.clear().then(doReset).catch(doReset) : doReset();
        });

        var exportAll = mc.querySelector('#export-all-settings');
        if (exportAll) exportAll.addEventListener('click', function () {
            if (typeof exportAllData === 'function') exportAllData();
        });

        var importAll = mc.querySelector('#import-all-settings');
        if (importAll) importAll.addEventListener('click', function () {
            var inp = document.createElement('input');
            inp.type = 'file'; inp.accept = '.json,.zip,application/json,application/zip';
            inp.onchange = function (e) {
                var f = e.target.files && e.target.files[0];
                if (f && typeof importAllData === 'function') importAllData(f);
            };
            inp.click();
        });

        var exportChat = mc.querySelector('#export-chat-btn');
        if (exportChat) exportChat.addEventListener('click', function () {
            if (typeof exportChatHistory === 'function') exportChatHistory();
        });

        var importChat = mc.querySelector('#import-chat-btn');
        if (importChat) importChat.addEventListener('click', function () {
            var inp = document.createElement('input');
            inp.type = 'file'; inp.accept = '.json';
            inp.onchange = function (e) {
                var f = e.target.files && e.target.files[0];
                if (f && typeof importChatHistory === 'function') importChatHistory(f);
            };
            inp.click();
        });

        var creditsBtn = mc.querySelector('#open-credits-btn');
        if (creditsBtn) creditsBtn.addEventListener('click', function () {
            var dataModal = document.getElementById('data-modal');
            if (dataModal && typeof hideModal === 'function') hideModal(dataModal);
            var disc = document.getElementById('disclaimer-modal');
            if (disc && typeof showModal === 'function') showModal(disc);
        });

        var tutorialBtn = mc.querySelector('#replay-tutorial-btn');
        if (tutorialBtn) tutorialBtn.addEventListener('click', function () {
            var dataModal = document.getElementById('data-modal');
            if (dataModal && typeof hideModal === 'function') hideModal(dataModal);
            if (typeof startTour === 'function') {
                if (window.localforage && window.APP_PREFIX) {
                    localforage.removeItem(APP_PREFIX + 'tour_seen').then(startTour).catch(startTour);
                } else { startTour(); }
            }
        });
    }

    function onModalOpen(modal) {
        var mc = modal.querySelector('.modal-content');
        if (!mc) return;
        ensureHTML(mc);
        requestAnimationFrame(function () {
            mc.style.opacity = '1';
            mc.style.transform = 'none';
        });
        setTimeout(function () {
            updateStats();
            syncToggles();
        }, 60);
    }

    var _styleObserver = null;
    var _contentObserver = null;

    function init() {
        var modal = document.getElementById('data-modal');
        if (!modal) return;

        var mc = modal.querySelector('.modal-content');
        if (mc) mc.dataset.dm6Built = 'v9';

        if (_styleObserver) { _styleObserver.disconnect(); _styleObserver = null; }
        if (_contentObserver) { _contentObserver.disconnect(); _contentObserver = null; }

        _styleObserver = new MutationObserver(function () {
            var d = modal.style.display;
            if (d === 'flex' || d === 'block') onModalOpen(modal);
        });
        _styleObserver.observe(modal, { attributes: true, attributeFilter: ['style'] });

        if (mc) {
            _contentObserver = new MutationObserver(function () {
                var mc2 = modal.querySelector('.modal-content');
                if (mc2 && !isCorrect(mc2)) {
                    mc2.dataset.dm6Built = 'v9';
                    writeHTML(mc2);
                }
            });
            _contentObserver.observe(mc, { childList: true, subtree: false });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () { setTimeout(init, 0); });
    } else {
        init();
    }
window.updateStats = updateStats;
})();

function updateStorageUsageBar() {
    if (typeof window.updateStats === 'function') window.updateStats();
}

(function() {
    var orig = window.showModal;
    if (typeof orig === 'function') {
        window.showModal = function(el) {
            orig.apply(this, arguments);
            if (el && el.id === 'data-modal') {
                setTimeout(updateStorageUsageBar, 250);
            }
        };
    }
})();

document.addEventListener('DOMContentLoaded', function() {
    var btn = document.getElementById('data-settings');
    if (btn) {
        btn.addEventListener('click', function() { setTimeout(updateStorageUsageBar, 350); });
    }
});

window._sendPartnerNotification = function(title, body) {
    try {
        if (localStorage.getItem('notifEnabled') !== '1') return;
        if (!('Notification' in window)) return;
        if (Notification.permission !== 'granted') return;

        // ── 核心判断逻辑升级 ──
        const isHidden = document.hidden;
        const hasFocus = window._windowHasFocus;
        // 距离上次用户在页面上操作的时间（毫秒），超过 30 秒视为挂机
        const isInactive = (Date.now() - (window._lastUserActiveTime || 0)) > 30000;

        // 如果网页完全隐藏，肯定要弹窗
        if (isHidden) {
            // 继续执行发通知
        } else {
            // 如果网页在前台，但用户没有焦点（在看别的软件），或者挂机超过 30 秒了
            if (!hasFocus || isInactive) {
                // 继续执行发通知
            } else {
                // 用户正盯着网页看并且刚刚有操作，不打扰用户
                return;
            }
        }

        new Notification(title || '传讯', {
            body: body || '对方发来了消息',
            icon: (document.querySelector('#partner-avatar img') || {}).src,
            // 删掉 tag 属性，防止多条消息被系统合并
        });
    } catch(e) {
        console.warn("通知发送异常:", e);
    }
};

window.handleNotifToggle = function(checkbox) {
    var statusEl = document.getElementById('notif-status-text');
    if (!('Notification' in window)) {
        checkbox.checked = false;
        if (statusEl) statusEl.textContent = '⚠️ 您的浏览器不支持通知功能，请更换浏览器';
        return;
    }
    if (checkbox.checked) {
        Notification.requestPermission().then(function(perm) {
            if (perm === 'granted') {
                if (statusEl) statusEl.textContent = '✅ 已开启 — 当页面在后台时，收到消息会弹出系统通知';
                localStorage.setItem('notifEnabled', '1');
                try { new Notification('传讯通知已开启 ✨', { body: '你现在可以在后台收到消息提醒了', tag: 'notif-test' }); } catch(e) {}
            } else if (perm === 'denied') {
                checkbox.checked = false;
                if (statusEl) statusEl.textContent = '❌ 权限被拒绝，请自行搜索如何开启';
                localStorage.setItem('notifEnabled', '0');
            } else {
                checkbox.checked = false;
                if (statusEl) statusEl.textContent = '⚠️ 未做出选择，请重试';
                localStorage.setItem('notifEnabled', '0');
            }
        }).catch(function() {
            checkbox.checked = false;
            if (statusEl) statusEl.textContent = '❌ 请求权限失败，请自行搜索如何打开';
            localStorage.setItem('notifEnabled', '0');
        });
    } else {
        if (statusEl) statusEl.textContent = '已关闭 — 后台将不再弹出消息提醒';
        localStorage.setItem('notifEnabled', '0');
    }
};

document.addEventListener('DOMContentLoaded', function() {
    var toggle   = document.getElementById('notif-permission-toggle');
    var statusEl = document.getElementById('notif-status-text');
    if (!toggle) return;
    var enabled = localStorage.getItem('notifEnabled') === '1';
    var granted = ('Notification' in window) && Notification.permission === 'granted';
    toggle.checked = enabled && granted;
    if (!statusEl) return;
    if (toggle.checked) {
        statusEl.textContent = '✅ 已开启 — 当页面在后台时，收到消息会弹出系统通知';
    } else if ('Notification' in window && Notification.permission === 'denied') {
        statusEl.textContent = '❌ 通知权限已被浏览器屏蔽，请自行搜索如何开启';
    } else {
        statusEl.textContent = '关闭状态 — 开启后可在后台接收消息提醒';
    }
});

// ============================================================
// 陪伴记录存储 (Companion Records)
// ============================================================
(function () {
    'use strict';

    const COMPANION_STORAGE_KEY = 'companion_records';

    // 获取存储实例
    function getStorage() {
        if (window.localforage) {
            return {
                get: function (key) { return localforage.getItem(key); },
                set: function (key, val) { return localforage.setItem(key, val); },
                remove: function (key) { return localforage.removeItem(key); },
                isAsync: true
            };
        }
        // fallback: localStorage (同步)
        return {
            get: function (key) {
                try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
            },
            set: function (key, val) {
                try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
            },
            remove: function (key) {
                try { localStorage.removeItem(key); } catch {}
            },
            isAsync: false
        };
    }

    // 加载所有记录
    window.loadCompanionRecords = function (callback) {
        const store = getStorage();
        if (store.isAsync) {
            store.get(COMPANION_STORAGE_KEY).then(function (data) {
                const records = Array.isArray(data) ? data : [];
                if (callback) callback(records);
            }).catch(function () {
                if (callback) callback([]);
            });
        } else {
            const records = store.get(COMPANION_STORAGE_KEY) || [];
            if (callback) callback(records);
        }
    };

    // 同步版本（用于内部快速读取）
    window._loadCompanionRecordsSync = function () {
        const store = getStorage();
        if (!store.isAsync) {
            return store.get(COMPANION_STORAGE_KEY) || [];
        }
        // 异步时返回空，需用loadCompanionRecords
        return [];
    };

    // 保存单条记录
    window.saveCompanionRecord = function (record, callback) {
        if (!record || typeof record !== 'object') {
            if (callback) callback(false);
            return;
        }
        // 确保有id
        if (!record.id) {
            record.id = 'comp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
        }
        // 确保有日期
        if (!record.date && record.startTime) {
            record.date = new Date(record.startTime).toISOString().split('T')[0];
        }

        const store = getStorage();
        const saveFn = function (records) {
            const list = Array.isArray(records) ? records : [];
            // 检查是否已存在相同id，存在则更新
            const existingIdx = list.findIndex(function (r) { return r.id === record.id; });
            if (existingIdx >= 0) {
                list[existingIdx] = record;
            } else {
                list.push(record);
            }
            // 按日期排序（最新在前）
            list.sort(function (a, b) {
                return (b.startTime || b.date || '').localeCompare(a.startTime || a.date || '');
            });
            return list;
        };

        if (store.isAsync) {
            store.get(COMPANION_STORAGE_KEY).then(function (existing) {
                const newList = saveFn(existing);
                store.set(COMPANION_STORAGE_KEY, newList).then(function () {
                    if (callback) callback(true);
                }).catch(function () {
                    if (callback) callback(false);
                });
            }).catch(function () {
                const newList = saveFn([]);
                store.set(COMPANION_STORAGE_KEY, newList).then(function () {
                    if (callback) callback(true);
                }).catch(function () {
                    if (callback) callback(false);
                });
            });
        } else {
            const existing = store.get(COMPANION_STORAGE_KEY);
            const newList = saveFn(existing);
            store.set(COMPANION_STORAGE_KEY, newList);
            if (callback) callback(true);
        }
    };

    // 更新指定记录
    window.updateCompanionRecord = function (id, updates, callback) {
        if (!id || !updates) {
            if (callback) callback(false);
            return;
        }
        const store = getStorage();
        const updateFn = function (records) {
            const list = Array.isArray(records) ? records : [];
            const idx = list.findIndex(function (r) { return r.id === id; });
            if (idx === -1) return null; // 未找到
            list[idx] = Object.assign({}, list[idx], updates);
            // 重新排序
            list.sort(function (a, b) {
                return (b.startTime || b.date || '').localeCompare(a.startTime || a.date || '');
            });
            return list;
        };

        if (store.isAsync) {
            store.get(COMPANION_STORAGE_KEY).then(function (existing) {
                const newList = updateFn(existing);
                if (newList === null) {
                    if (callback) callback(false);
                    return;
                }
                store.set(COMPANION_STORAGE_KEY, newList).then(function () {
                    if (callback) callback(true);
                }).catch(function () {
                    if (callback) callback(false);
                });
            }).catch(function () {
                if (callback) callback(false);
            });
        } else {
            const existing = store.get(COMPANION_STORAGE_KEY);
            const newList = updateFn(existing);
            if (newList === null) {
                if (callback) callback(false);
                return;
            }
            store.set(COMPANION_STORAGE_KEY, newList);
            if (callback) callback(true);
        }
    };

    // 删除指定记录
    window.deleteCompanionRecord = function (id, callback) {
        if (!id) {
            if (callback) callback(false);
            return;
        }
        const store = getStorage();
        const deleteFn = function (records) {
            const list = Array.isArray(records) ? records : [];
            return list.filter(function (r) { return r.id !== id; });
        };

        if (store.isAsync) {
            store.get(COMPANION_STORAGE_KEY).then(function (existing) {
                const newList = deleteFn(existing);
                store.set(COMPANION_STORAGE_KEY, newList).then(function () {
                    if (callback) callback(true);
                }).catch(function () {
                    if (callback) callback(false);
                });
            }).catch(function () {
                if (callback) callback(false);
            });
        } else {
            const existing = store.get(COMPANION_STORAGE_KEY);
            const newList = deleteFn(existing);
            store.set(COMPANION_STORAGE_KEY, newList);
            if (callback) callback(true);
        }
    };

    // 按日期获取记录
    window.getCompanionRecordsByDate = function (dateStr, callback) {
        window.loadCompanionRecords(function (records) {
            const filtered = records.filter(function (r) {
                return r.date === dateStr;
            });
            if (callback) callback(filtered);
        });
    };

    // 获取所有有记录的日期列表（已排序）
    window.getCompanionRecordDates = function (callback) {
        window.loadCompanionRecords(function (records) {
            const dateSet = {};
            records.forEach(function (r) {
                if (r.date) dateSet[r.date] = true;
            });
            const dates = Object.keys(dateSet).sort();
            if (callback) callback(dates);
        });
    };

    // 扩展原有的导出/导入功能，将陪伴记录包含在全量备份中
    // 注意：如果 exportAllData 和 importAllData 已存在，我们增加钩子
    // 由于无法直接修改 exportAllData，我们在加载时自动将陪伴记录附加到导出数据中
    // 更好的方式：在 window.exportAllData 执行后，我们手动合并
    // 但由于 exportAllData 是定义在别处，我们使用 Monkey Patch

// 安全地增强全量导出
(function enhanceFullBackup() {
    // 需要额外备份的 localforage 键名列表（不含 APP_PREFIX）
    const EXTRA_KEYS = [
        'envelopeData',    // 信封投递
        'customReplies',   // 自定义回复库
        'customPokes',     // 自定义拍一拍
        'myStickers',      // 贴纸/表情包
        'favorites'        // 收藏消息
    ];

    // 获取带前缀的存储键名（如果 getStorageKey 可用）
    function getStorageKey(key) {
        if (typeof window.getStorageKey === 'function') {
            return window.getStorageKey(key);
        }
        return (window.APP_PREFIX || '') + key;
    }

    // 新的异步导出函数
window.exportAllData = async function () {
    var allData = {
        _exportedAt: new Date().toISOString(),
        _version: '2.3'  // 版本号升级，包含计划与待办
    };

    // ---- 同步获取聊天记录 ----
    if (typeof messages !== 'undefined' && Array.isArray(messages)) {
        allData.messages = messages.map(function (m) {
            return Object.assign({}, m, {
                timestamp: m.timestamp instanceof Date ? m.timestamp.toISOString() : m.timestamp
            });
        });
    }

    // ---- 同步获取设置 ----
    if (typeof settings !== 'undefined') {
        allData.settings = settings;
    }

    // ---- 异步获取好奇驿站数据 ----
    try {
        const curiosityKey = (window.APP_PREFIX || '') + 'curiosityData';
        const curiosityData = await localforage.getItem(curiosityKey);
        if (curiosityData) {
            allData.curiosity = curiosityData;
        }
    } catch (e) {
        console.warn('[exportAllData] 无法读取好奇驿站数据:', e);
    }

    // ---- 异步获取额外数据（信封投递、回复库、拍一拍、贴纸、收藏） ----
    for (var i = 0; i < EXTRA_KEYS.length; i++) {
        var key = EXTRA_KEYS[i];
        try {
            var fullKey = getStorageKey(key);
            var data = await localforage.getItem(fullKey);
            if (data !== null && data !== undefined) {
                allData[key] = data;
            }
        } catch (e) {
            console.warn('[exportAllData] 无法读取 ' + key + ':', e);
        }
    }

    // ---- 同步获取陪伴数据（localStorage） ----
    var companionData = {
        records: [],
        musicList: [],
        session: null,
        accident: null
    };
    try {
        var recordsRaw = localStorage.getItem('companion_records');
        if (recordsRaw) companionData.records = JSON.parse(recordsRaw);
    } catch (e) {}
    try {
        var musicRaw = localStorage.getItem('companion_music_list');
        if (musicRaw) companionData.musicList = JSON.parse(musicRaw);
    } catch (e) {}
    try {
        var sessionRaw = localStorage.getItem('companion_session');
        if (sessionRaw) companionData.session = JSON.parse(sessionRaw);
    } catch (e) {}
    try {
        companionData.accident = localStorage.getItem('companionAccident') || null;
    } catch (e) {}
    allData.companion = companionData;

    // ===== 新增：计划与待办数据 =====
    try {
        var planTodoRaw = localStorage.getItem('plan_todo_data');
        if (planTodoRaw) {
            allData.plan_todo_data = JSON.parse(planTodoRaw);
        }
    } catch (e) {
        console.warn('[exportAllData] 无法读取 plan_todo_data:', e);
    }
    try {
        var planTodoMetaRaw = localStorage.getItem('plan_todo_meta');
        if (planTodoMetaRaw) {
            allData.plan_todo_meta = JSON.parse(planTodoMetaRaw);
        }
    } catch (e) {
        console.warn('[exportAllData] 无法读取 plan_todo_meta:', e);
    }
    // ===== 新增结束 =====

    // ---- 导出 JSON 文件 ----
    var json = JSON.stringify(allData, null, 2);
    var blob = new Blob([json], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'backup_full_' + new Date().toISOString().split('T')[0] + '.json';
    a.click();
    URL.revokeObjectURL(url);

    if (typeof showNotification === 'function') {
        showNotification('全量备份导出成功 ✓', 'success');
    }
};

    // 新的异步导入函数
window.importAllData = function (file) {
    var reader = new FileReader();
    reader.onload = async function (e) {
        try {
            var data = JSON.parse(e.target.result);

            // ---- 导入好奇驿站数据 ----
            if (data.curiosity) {
                try {
                    const curiosityKey = (window.APP_PREFIX || '') + 'curiosityData';
                    await localforage.setItem(curiosityKey, data.curiosity);
                    if (typeof loadCuriosityData === 'function') {
                        await loadCuriosityData();
                    }
                    if (typeof renderCuriosityLists === 'function') {
                        renderCuriosityLists();
                    }
                    if (typeof showNotification === 'function') {
                        showNotification('好奇驿站数据导入成功 ✓', 'success');
                    }
                } catch (err) {
                    console.warn('[importAllData] 导入好奇驿站失败:', err);
                }
            }

            // ---- 导入额外数据（信封投递、回复库、拍一拍、贴纸、收藏） ----
            for (var i = 0; i < EXTRA_KEYS.length; i++) {
                var key = EXTRA_KEYS[i];
                if (data[key] !== undefined && data[key] !== null) {
                    try {
                        var fullKey = getStorageKey(key);
                        await localforage.setItem(fullKey, data[key]);
                        console.log('[importAllData] 已导入 ' + key);
                    } catch (err) {
                        console.warn('[importAllData] 导入 ' + key + ' 失败:', err);
                    }
                }
            }

            // 导入完成后，如果有对应函数，重新加载数据
            if (data.envelopeData && typeof loadEnvelopeData === 'function') {
                try { await loadEnvelopeData(); } catch(e) {}
            }
            if (data.customReplies && typeof renderReplyLibrary === 'function') {
                try { renderReplyLibrary(); } catch(e) {}
            }
            if (data.favorites && typeof renderFavoritesList === 'function') {
                try { renderFavoritesList(); } catch(e) {}
            }

            // ---- 导入陪伴数据（同步） ----
            if (data.companion) {
                var comp = data.companion;
                if (comp.records && Array.isArray(comp.records)) {
                    try {
                        localStorage.setItem('companion_records', JSON.stringify(comp.records));
                        if (typeof window._companionRecords !== 'undefined') {
                            window._companionRecords = comp.records;
                        }
                        if (typeof loadCompanionRecordsData === 'function') {
                            loadCompanionRecordsData();
                        }
                    } catch (e) {}
                }
                if (comp.musicList && Array.isArray(comp.musicList)) {
                    try {
                        localStorage.setItem('companion_music_list', JSON.stringify(comp.musicList));
                    } catch (e) {}
                }
                if (comp.session) {
                    try {
                        localStorage.setItem('companion_session', JSON.stringify(comp.session));
                    } catch (e) {}
                }
                if (comp.accident !== undefined && comp.accident !== null) {
                    try {
                        localStorage.setItem('companionAccident', comp.accident);
                    } catch (e) {}
                }
                if (typeof showNotification === 'function') {
                    showNotification('陪伴数据导入成功 ✓', 'success');
                }
            }

            // ===== 新增：导入计划与待办数据 =====
            if (data.plan_todo_data) {
                try {
                    localStorage.setItem('plan_todo_data', JSON.stringify(data.plan_todo_data));
                    // 刷新内存中的计划数据
                    if (typeof window._planTodoData !== 'undefined') {
                        window._planTodoData = data.plan_todo_data;
                    }
                    // 刷新卡片显示
                    if (typeof window._refreshPlanTodo === 'function') {
                        setTimeout(window._refreshPlanTodo, 300);
                    }
                    if (typeof showNotification === 'function') {
                        showNotification('计划与待办数据导入成功 ✓', 'success');
                    }
                } catch (e) {
                    console.warn('[importAllData] 导入 plan_todo_data 失败:', e);
                }
            }
            if (data.plan_todo_meta) {
                try {
                    localStorage.setItem('plan_todo_meta', JSON.stringify(data.plan_todo_meta));
                } catch (e) {
                    console.warn('[importAllData] 导入 plan_todo_meta 失败:', e);
                }
            }
            // ===== 新增结束 =====

            // ---- 导入聊天记录 ----
            if (data.messages && Array.isArray(data.messages) && typeof messages !== 'undefined') {
                try {
                    messages = data.messages.map(function (m) {
                        return Object.assign({}, m, {
                            timestamp: m.timestamp ? new Date(m.timestamp) : new Date()
                        });
                    });
                    if (typeof renderMessages === 'function') renderMessages();
                    if (typeof throttledSaveData === 'function') throttledSaveData();
                } catch (e) {}
            }

            // ---- 导入设置 ----
            if (data.settings && typeof settings !== 'undefined') {
                try {
                    Object.assign(settings, data.settings);
                    if (typeof updateUI === 'function') updateUI();
                    if (typeof throttledSaveData === 'function') throttledSaveData();
                } catch (e) {}
            }

            if (typeof showNotification === 'function') {
                showNotification('全量导入完成', 'success');
            }

        } catch (err) {
            console.error('[importAllData] 导入失败:', err);
            if (typeof showNotification === 'function') {
                showNotification('文件解析失败，请检查文件格式', 'error');
            }
        }
    };
    reader.readAsText(file);
};
    console.log('[data.js] 全量备份已增强，包含好奇驿站、信封投递、自定义回复、拍一拍、贴纸、收藏');
})();

    console.log('[data.js] 陪伴记录存储模块已加载');

})();
