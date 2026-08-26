/**
 * companion.js - 陪伴睡眠功能（实时记录版）
 */

// 全局通话禁止标志（仅用于陪伴大弹窗期间）
window.__companionActive = false;
window.__setCompanionActive = function(active) {
    window.__companionActive = active;
};
window.__isCompanionActive = function() {
    return window.__companionActive;
};

(function () {
    'use strict';

    const ACCIDENT_KEY = 'companionAccident';
    const MUSIC_STORAGE_KEY = 'companion_music_list';
    const MIN_VALID_MINUTES = 0;

    const STATE = {
        IDLE: 'idle',
        SETUP: 'setup',
        COUNTDOWN: 'countdown',
        READY_TO_START: 'ready_to_start',
        SLEEPING: 'sleeping',
        ENDED: 'ended',
    };

    let session = {
        state: STATE.IDLE,
        musicList: [],
        selectedMusicId: null,
        musicUrl: null,
        musicTitle: '无音乐',
        countdownMinutes: 5,
        startTime: null,
        lastAliveTime: null,
        elapsed: 0,
        countdownRemain: 0,
        rafId: null,
        countdownInterval: null,
        isEnding: false,
        _autoStopped: false,
        volumePercent: 20,
    };

    // ★ 新增：当前活动记录的ID（用于实时更新）
    let activeRecordId = null;

    let audioElement = null;
    let _isSoftLooping = false;
    let _softLoopTargetGain = 0.2;
    let isStopping = false;
    let isPlaying = false;
    let gainNode = null;
    let alarmNodes = [];
    let alarmInterval = null;
    let wakeLock = null;
    let overlayEl = null;
    let contentEl = null;
    let currentUI = 'setup';
    let searchTerm = '';

    // ============================================================
    // 工具函数
    // ============================================================
    function getPartnerName() {
        try {
            return window.settings?.partnerName ||
                document.getElementById('partner-name')?.textContent?.trim() ||
                '梦角';
        } catch { return '梦角'; }
    }

    function getPartnerAvatarSrc() {
        try {
            const img = document.querySelector('#partner-avatar img, [id*="partner-avatar"] img, .partner-avatar img');
            return img ? img.src : null;
        } catch { return null; }
    }

    function getPartnerAvatarHTML() {
        const src = getPartnerAvatarSrc();
        if (src) {
            return `<img src="${src}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
        }
        return `<i class="fas fa-user" style="font-size:32px;color:rgba(255,255,255,0.6);"></i>`;
    }

    function formatTime(isoStr) {
        if (!isoStr) return '--:--';
        try {
            const d = new Date(isoStr);
            return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        } catch { return isoStr; }
    }

    function formatDuration(ms) {
        if (!ms || ms < 0) return '0分钟';
        const totalSec = Math.floor(ms / 1000);
        const h = Math.floor(totalSec / 3600);
        const m = Math.floor((totalSec % 3600) / 60);
        const s = totalSec % 60;
        if (h > 0) return `${h}小时${m}分钟`;
        if (m > 0) return `${m}分钟${s > 0 ? s + '秒' : ''}`;
        return `${s}秒`;
    }

    function formatDateTime(isoStr) {
        if (!isoStr) return '--:--';
        try {
            const d = new Date(isoStr);
            const month = d.getMonth() + 1;
            const day = d.getDate();
            const hours = String(d.getHours()).padStart(2, '0');
            const minutes = String(d.getMinutes()).padStart(2, '0');
            return month + '月' + day + '日 ' + hours + ':' + minutes;
        } catch { return isoStr; }
    }

    function getMusicBoost(url) {
        if (url && (url.includes('bonfire') || url.includes('bonfire.mp3'))) {
            return 3.0;
        }
        return 1.0;
    }

    function showToast(msg, type = 'info') {
        if (typeof showNotification === 'function') {
            showNotification(msg, type);
        } else {
            console.log('[companion]', msg);
        }
    }

    // ============================================================
    // ★ 实时记录管理函数
    // ============================================================
    function _getRecords() {
        try {
            const data = localStorage.getItem('companion_records');
            return data ? JSON.parse(data) : [];
        } catch { return []; }
    }

    function _saveRecords(records) {
        try {
            localStorage.setItem('companion_records', JSON.stringify(records));
            window._companionRecords = records;
        } catch (e) {
            console.error('[companion] 保存记录失败:', e);
        }
    }

    // 创建一条进行中的记录
function createOngoingRecord() {
    const now = new Date();
    // 使用本地日期（年-月-日），避免时区偏移
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const localDate = year + '-' + month + '-' + day;

    const record = {
        id: 'comp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        date: localDate,
        startTime: now.toISOString(),
        endTime: null,
        duration: 0,
        mode: 'ongoing',
        soundType: session.musicTitle || '无音乐',
        status: '进行中',
        interruptReason: '',
        isSystemInterrupt: false,
        reflection: '',
        terminateReason: ''
    };
    const records = _getRecords();
    records.push(record);
    _saveRecords(records);
    activeRecordId = record.id;
    return record.id;
}

    // 更新进行中记录的时长
    function updateOngoingRecord() {
        if (!activeRecordId) return;
        const records = _getRecords();
        const idx = records.findIndex(r => r.id === activeRecordId);
        if (idx === -1) {
            activeRecordId = null;
            return;
        }
        const record = records[idx];
        if (record.mode !== 'ongoing') {
            activeRecordId = null;
            return;
        }
        record.duration = session.elapsed || 0;
        _saveRecords(records);
    }

    // 完成或中断时，结束记录
    function finalizeOngoingRecord(mode) {
        if (!activeRecordId) return;
        const records = _getRecords();
        const idx = records.findIndex(r => r.id === activeRecordId);
        if (idx === -1) {
            activeRecordId = null;
            return;
        }
        const record = records[idx];
        if (record.mode !== 'ongoing') {
            activeRecordId = null;
            return;
        }
        const now = new Date();
        record.endTime = now.toISOString();
        record.duration = session.elapsed || 0;
        record.mode = mode;                 // 'completed' 或 'interrupted'
        record.status = mode === 'completed' ? '完成陪伴' : '未能完成陪伴';
        _saveRecords(records);
        activeRecordId = null;
    }

    // 检查并恢复意外中断的进行中记录
function checkAndRecoverOngoingRecord() {
    console.log('[companion] 开始检查 ongoing 记录...');
    try {
        const records = _getRecords();
        const ongoing = records.filter(r => r.mode === 'ongoing');
        console.log('[companion] 找到 ongoing 记录数:', ongoing.length);
        if (ongoing.length === 0) {
            console.log('[companion] 没有未完成的记录，跳过恢复');
            return;
        }

        const record = ongoing[0];
        console.log('[companion] 准备恢复记录:', record.id);
        const now = new Date();
        record.endTime = now.toISOString();
        record.mode = 'system_interrupt';
        record.status = '系统中断';
        record.interruptReason = '';
        record.isSystemInterrupt = true;
        record.reflection = '';
        record.terminateReason = '';
        _saveRecords(records);
        console.log('[companion] 记录已保存为系统中断');
        showModalWithConfirm(record);
    } catch (e) {
        console.error('[companion] 恢复 ongoing 记录时出错:', e);
        showToast('检测到未完成的陪伴，但恢复失败，请手动检查存储', 'error');
    }
}

// 自定义模态框（系统中断专用）
function showModalWithConfirm(record) {
    if (!record) return;
    const startTime = formatDateTime(record.startTime);

    const modal = document.createElement('div');
    modal.className = 'companion-toast open';
    modal.style.cssText = `
        position: fixed;
        top: 0; left: 0; right: 0; bottom: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(0,0,0,0.5);
        backdrop-filter: blur(8px);
        z-index: 100000;
        animation: companionToastIn 0.3s ease;
    `;
    modal.innerHTML = `
        <div class="toast-box" style="
            background: var(--secondary-bg, #1e1e2e);
            max-width: 320px;
            width: 85%;
            margin: 0 auto;
            border-radius: 24px;
            padding: 28px 22px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.6);
            border: 1px solid var(--border-color, rgba(255,255,255,0.08));
            color: var(--text-primary, #fff);
            text-align: center;
        ">
            <div class="toast-title" style="
                font-size: 18px; 
                font-weight: 700; 
                margin-bottom: 8px;
                color: var(--text-primary);
            ">🌙 陪伴中断</div>
            <div class="toast-body" style="
                font-size: 14px; 
                color: var(--text-secondary, rgba(255,255,255,0.7)); 
                line-height: 1.6; 
                margin-bottom: 16px;
            ">开始于 ${startTime} 的陪伴意外中断，是否立即进行补录？</div>
            <div style="
                display:flex;
                gap:12px;
                justify-content:center;
                margin-top:12px;
            ">
                <button class="toast-btn" id="modal-cancel-btn" style="
                    flex:1;
                    padding:10px 0;
                    border-radius:30px;
                    border:1px solid var(--border-color,rgba(255,255,255,0.2));
                    background:transparent;
                    color:var(--text-secondary,rgba(255,255,255,0.7));
                    font-size:15px;
                    font-weight:400;
                    cursor:pointer;
                    transition:background 0.2s;
                ">取消</button>
                <button class="toast-btn" id="modal-confirm-btn" style="
                    flex:1;
                    padding:10px 0;
                    border-radius:30px;
                    border:none;
                    background:var(--accent-color,#7c5cbf);
                    color:#fff;
                    font-size:15px;
                    font-weight:600;
                    cursor:pointer;
                    box-shadow:0 2px 8px rgba(var(--accent-color-rgb,124,92,191),0.3);
                ">补录</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    const confirmBtn = modal.querySelector('#modal-confirm-btn');
    const cancelBtn = modal.querySelector('#modal-cancel-btn');

    confirmBtn.addEventListener('click', () => {
        document.body.removeChild(modal);
        // 跳转到月历
        if (typeof showCompanionRecords === 'function') {
            showCompanionRecords();
        } else {
            showToast('已补录系统中断记录，请到陪伴记录中查看', 'info');
        }
    });

    cancelBtn.addEventListener('click', () => {
        document.body.removeChild(modal);
        // 仅关闭，无额外操作
    });

    // 点击背景关闭
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            document.body.removeChild(modal);
        }
    });
}

    // ============================================================
    // 音乐列表存储（自动修复 id）
    // ============================================================
    const DEFAULT_MUSIC = [
        {
            title: '雨声',
            sub: '舒缓的雨滴白噪音',
            url: 'https://3wt.music.zhangtiandi.cn/2026/08-09/55d8583929a644d08a205b1f75c9b20a3wcn835496.mp3'
        },
        {
            title: '篝火',
            sub: '温暖的火苗噼啪声',
            url: 'https://img.tofaka.com/autoupload/f/ikeej/20260809/JWvl/bonfire.mp3'
        }
    ];

    function loadMusicList() {
        try {
            const data = localStorage.getItem(MUSIC_STORAGE_KEY);
            if (data) {
                const parsed = JSON.parse(data);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    let needSave = false;
                    const fixed = parsed.map(item => {
                        if (!item.id) {
                            needSave = true;
                            return {
                                ...item,
                                id: 'comp_music_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4)
                            };
                        }
                        return item;
                    });
                    session.musicList = fixed;
                    if (needSave) {
                        saveMusicList();
                        console.log('[companion] 已自动修复缺失的 id');
                    }
                    console.log('[companion] 加载本地音乐列表，共', session.musicList.length, '首');
                    return;
                }
            }
        } catch (e) {}

        const defaultWithIds = DEFAULT_MUSIC.map(item => ({
            ...item,
            id: 'comp_music_default_' + item.title + '_' + Date.now()
        }));
        session.musicList = defaultWithIds;
        saveMusicList();
        console.log('[companion] 已加载内置默认音乐');
    }

    function saveMusicList() {
        try {
            localStorage.setItem(MUSIC_STORAGE_KEY, JSON.stringify(session.musicList));
        } catch (e) {
            showToast('音乐列表保存失败', 'error');
        }
    }

    function addMusicItem(title, sub, url) {
        const item = {
            id: 'comp_music_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
            title: title.trim() || '未命名音乐',
            sub: sub.trim() || '',
            url: url.trim(),
            createdAt: new Date().toISOString(),
        };
        session.musicList.push(item);
        saveMusicList();
        return item;
    }

    function deleteMusicItem(id) {
        session.musicList = session.musicList.filter(item => item.id !== id);
        if (session.selectedMusicId === id) {
            session.selectedMusicId = null;
            session.musicUrl = null;
            session.musicTitle = '无音乐';
            stopMusic();
        }
        saveMusicList();
        if (currentUI === 'setup') {
            renderSetupUI();
        }
    }

    function getMusicItem(id) {
        return session.musicList.find(item => item.id === id);
    }

    // ============================================================
    // 音频播放（保持不变）
    // ============================================================
    function initAudioElement(url) {
        isStopping = false;
        stopMusic();
        if (!url) {
            session.musicUrl = null;
            session.musicTitle = '无音乐';
            isPlaying = false;
            return;
        }

        try {
            console.log('[companion] 尝试播放:', url);
            audioElement = new Audio(url);
            audioElement.loop = true;
            audioElement.crossOrigin = 'anonymous';

            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            if (ctx.state === 'suspended') ctx.resume().catch(() => {});
            const source = ctx.createMediaElementSource(audioElement);
            gainNode = ctx.createGain();
            gainNode.gain.value = 0.2;
            source.connect(gainNode);
            gainNode.connect(ctx.destination);

            session._audioCtx = ctx;

            applyVolume();

            audioElement.addEventListener('canplaythrough', function onReady() {
                audioElement.removeEventListener('canplaythrough', onReady);
                console.log('[companion] 音频加载完成，开始播放');
                playMusic();
            });

            audioElement.addEventListener('error', function (e) {
                if (isStopping) {
                    console.log('[companion] 音频停止，忽略错误');
                    return;
                }
                console.error('[companion] 音频加载错误:', e);
                showToast('音频加载失败，请检查链接', 'error');
            });

            audioElement.load();
            session.musicUrl = url;
            setupSoftLoop();
            if (audioElement.readyState >= 3) {
                audioElement.removeEventListener('canplaythrough', onReady);
                playMusic();
            }
        } catch (e) {
            console.error('[companion] 初始化音频失败:', e);
            showToast('音频初始化失败', 'error');
        }
    }

    function playMusic() {
        if (!audioElement) return;
        _isSoftLooping = false;
        if (gainNode && session._audioCtx) {
            try {
                const ctx = session._audioCtx;
                gainNode.gain.cancelScheduledValues(ctx.currentTime);
                gainNode.gain.setValueAtTime(0, ctx.currentTime);
            } catch (e) {}
        }
        audioElement.play()
            .then(() => {
                isPlaying = true;
                console.log('[companion] 播放成功');
                if (gainNode && session._audioCtx && session._audioCtx.state !== 'closed') {
                    const ctx = session._audioCtx;
                    const boost = getMusicBoost(session.musicUrl);
                    const rawGain = (session.volumePercent / 100) * boost;
                    const finalGain = Math.min(rawGain, 1.5);
                    try {
                        gainNode.gain.cancelScheduledValues(ctx.currentTime);
                        gainNode.gain.setValueAtTime(0, ctx.currentTime);
                        gainNode.gain.linearRampToValueAtTime(finalGain, ctx.currentTime + 1.5);
                    } catch (e) {}
                }
                updateFloatingControlUI();
                if (currentUI === 'setup' && session.state !== STATE.SLEEPING) {
                    renderSetupUI();
                }
            })
            .catch(err => {
                if (isStopping) return;
                console.warn('[companion] 播放被阻止:', err);
                showToast('播放失败，请点击列表重试', 'warning');
            });
    }

    function setupSoftLoop() {
        if (!audioElement) return;
        audioElement.removeEventListener('timeupdate', _softLoopHandler);
        _isSoftLooping = false;
        audioElement.addEventListener('timeupdate', _softLoopHandler);
    }

    function _softLoopHandler() {
        if (isStopping) return;
        if (!audioElement || !audioElement.duration) return;
        if (_isSoftLooping) return;

        const duration = audioElement.duration;
        const current = audioElement.currentTime;
        if (current < duration - 0.8) return;

        _isSoftLooping = true;

        const boost = getMusicBoost(session.musicUrl);
        const rawGain = (session.volumePercent / 100) * boost;
        const targetGain = Math.min(rawGain, 1.5);
        _softLoopTargetGain = targetGain;

        const ctx = session._audioCtx;
        if (!ctx || ctx.state === 'closed') {
            _isSoftLooping = false;
            return;
        }

        const now = ctx.currentTime;
        const fadeDuration = 0.3;

        try {
            gainNode.gain.cancelScheduledValues(now);
            gainNode.gain.setValueAtTime(targetGain, now);
            gainNode.gain.linearRampToValueAtTime(0, now + fadeDuration);
        } catch (e) {
            _isSoftLooping = false;
            return;
        }

        setTimeout(() => {
            if (isStopping || !audioElement) {
                _isSoftLooping = false;
                return;
            }
            try {
                audioElement.currentTime = 0;
                audioElement.play().catch(() => {});
                const ctx2 = session._audioCtx;
                if (ctx2 && ctx2.state !== 'closed' && gainNode) {
                    const now2 = ctx2.currentTime;
                    gainNode.gain.cancelScheduledValues(now2);
                    gainNode.gain.setValueAtTime(0, now2);
                    gainNode.gain.linearRampToValueAtTime(_softLoopTargetGain, now2 + fadeDuration);
                }
            } catch (e) {}
            _isSoftLooping = false;
        }, fadeDuration * 1000 + 50);
    }

    function stopMusic() {
        isStopping = true;
        _isSoftLooping = false;
        if (audioElement) {
            try {
                audioElement.removeEventListener('timeupdate', _softLoopHandler);
                audioElement.pause();
                audioElement.src = '';
                audioElement.load();
            } catch (e) {}
            audioElement = null;
        }
        if (gainNode) {
            try { gainNode.disconnect(); } catch (e) {}
            gainNode = null;
        }
        if (session._audioCtx) {
            try { session._audioCtx.close(); } catch (e) {}
            session._audioCtx = null;
        }
        isPlaying = false;
        session.musicUrl = null;
        updateFloatingControlUI();
    }

    function toggleMusicPlay() {
        if (!audioElement) {
            if (session.selectedMusicId) {
                const item = getMusicItem(session.selectedMusicId);
                if (item) {
                    initAudioElement(item.url);
                    session.musicTitle = item.title;
                }
            }
            return;
        }

        if (isPlaying) {
            audioElement.pause();
            isPlaying = false;
            updateFloatingControlUI();
        } else {
            audioElement.play()
                .then(() => {
                    isPlaying = true;
                    updateFloatingControlUI();
                })
                .catch(err => console.warn('[companion] 恢复播放失败:', err));
        }
    }

    function fadeOutMusic(duration = 1500) {
        if (!gainNode || !session._audioCtx) {
            stopMusic();
            return;
        }
        const ctx = session._audioCtx;
        if (ctx.state === 'closed') {
            stopMusic();
            return;
        }
        try {
            const currentGain = gainNode.gain.value;
            gainNode.gain.cancelScheduledValues(ctx.currentTime);
            gainNode.gain.setValueAtTime(currentGain, ctx.currentTime);
            gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + duration / 1000);
            setTimeout(() => {
                stopMusic();
            }, duration + 100);
        } catch (e) {
            stopMusic();
        }
    }

    // ============================================================
    // 闹钟
    // ============================================================
    function playAlarm() {
        stopAlarm();
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            if (ctx.state === 'suspended') ctx.resume().catch(() => {});
            const notes = [523.25, 659.25, 783.99, 987.77, 1046.50];
            const pattern = [0, 1, 2, 3, 4, 3, 2, 1, 0];
            let noteIndex = 0;

            function playNextNote() {
                if (session.state !== STATE.READY_TO_START && session.state !== STATE.COUNTDOWN) return;
                const freq = notes[pattern[noteIndex % pattern.length]];
                noteIndex++;
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.value = freq;
                gain.gain.value = 0;
                const now = ctx.currentTime;
                gain.gain.setValueAtTime(0, now);
                gain.gain.linearRampToValueAtTime(0.15, now + 0.02);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(now);
                osc.stop(now + 0.9);
                alarmNodes.push(osc, gain);
                alarmInterval = setTimeout(playNextNote, 1800);
            }

            for (let i = 0; i < 3; i++) {
                setTimeout(() => {
                    if (session.state === STATE.READY_TO_START || session.state === STATE.COUNTDOWN) {
                        const freq = notes[Math.floor(Math.random() * notes.length)];
                        const osc = ctx.createOscillator();
                        const gain = ctx.createGain();
                        osc.type = 'sine';
                        osc.frequency.value = freq;
                        gain.gain.value = 0;
                        const now = ctx.currentTime;
                        gain.gain.setValueAtTime(0, now);
                        gain.gain.linearRampToValueAtTime(0.12, now + 0.02);
                        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
                        osc.connect(gain);
                        gain.connect(ctx.destination);
                        osc.start(now);
                        osc.stop(now + 0.9);
                        alarmNodes.push(osc, gain);
                    }
                }, i * 300);
            }
            setTimeout(playNextNote, 900);
        } catch (e) {
            console.warn('[companion] 闹钟播放失败:', e);
        }
    }

    function stopAlarm() {
        if (alarmInterval) {
            clearTimeout(alarmInterval);
            alarmInterval = null;
        }
        alarmNodes.forEach(node => {
            try { node.stop(); node.disconnect(); } catch (e) {}
        });
        alarmNodes = [];
    }

    // ============================================================
    // 屏幕常亮
    // ============================================================
    async function requestWakeLock() {
        try {
            if ('wakeLock' in navigator) {
                wakeLock = await navigator.wakeLock.request('screen');
                return true;
            }
        } catch (err) {}
        return false;
    }

    function releaseWakeLock() {
        if (wakeLock) {
            try { wakeLock.release(); wakeLock = null; } catch (e) {}
        }
    }

    // ============================================================
    // UI 渲染（完整样式）
    // ============================================================
    function getOverlayContainer() {
        let el = document.getElementById('companion-overlay');
        if (!el) {
            el = document.createElement('div');
            el.id = 'companion-overlay';
            el.style.cssText = `
                position: fixed; inset: 0; z-index: 99999;
                display: none; align-items: center; justify-content: center;
                background: radial-gradient(ellipse at center, #0a0e1a 0%, #000000 100%);
                flex-direction: column;
                padding: 24px;
                overflow: hidden;
                transition: opacity 0.6s ease;
            `;

            const style = document.createElement('style');
            style.id = 'companion-style';
            style.textContent = `
                #companion-overlay .breath-orb {
                    position: absolute;
                    border-radius: 50%;
                    filter: blur(80px);
                    opacity: 0.25;
                    animation: companionBreath 6s ease-in-out infinite alternate;
                    pointer-events: none;
                }
                #companion-overlay .breath-orb-1 {
                    width: 300px; height: 300px;
                    background: rgba(120, 80, 200, 0.4);
                    top: -80px; right: -80px;
                    animation-delay: 0s;
                }
                #companion-overlay .breath-orb-2 {
                    width: 400px; height: 400px;
                    background: rgba(60, 120, 220, 0.3);
                    bottom: -120px; left: -120px;
                    animation-delay: 3s;
                }
                #companion-overlay .star {
                    position: absolute;
                    background: #fff;
                    border-radius: 50%;
                    pointer-events: none;
                    animation: companionTwinkle ease-in-out infinite alternate;
                }
                @keyframes companionBreath {
                    0% { opacity: 0.15; transform: scale(0.9); }
                    100% { opacity: 0.35; transform: scale(1.2); }
                }
                @keyframes companionTwinkle {
                    0% { opacity: 0.1; transform: scale(0.8); }
                    100% { opacity: 0.8; transform: scale(1.2); }
                }
                #companion-overlay .companion-content {
                    position: relative; z-index: 10;
                    display: flex; flex-direction: column;
                    align-items: center; justify-content: center;
                    max-width: 420px; width: 100%;
                    gap: 12px;
                    color: var(--text-primary, #fff);
                    text-align: center;
                }
                #companion-overlay .companion-avatar {
                    width: 80px; height: 80px;
                    border-radius: 50%;
                    border: 2px solid rgba(255,255,255,0.2);
                    overflow: hidden;
                    background: rgba(255,255,255,0.05);
                    box-shadow: 0 0 40px rgba(100,80,200,0.2);
                    display: flex; align-items: center; justify-content: center;
                }
                #companion-overlay .companion-avatar img { width:100%; height:100%; object-fit:cover; }
                #companion-overlay .companion-name {
                    font-size: 24px; font-weight: 700;
                    margin-top: 4px;
                    text-shadow: 0 2px 20px rgba(0,0,0,0.5);
                }
                #companion-overlay .companion-status {
                    font-size: 15px;
                    color: rgba(255,255,255,0.7);
                    min-height: 28px;
                    transition: opacity 0.5s ease;
                    margin-top: 2px;
                }
                #companion-overlay .companion-status.hidden {
                    opacity: 0;
                    transition: opacity 0.8s ease;
                }
                #companion-overlay .companion-timer {
                    font-size: 52px;
                    font-weight: 300;
                    font-variant-numeric: tabular-nums;
                    letter-spacing: 2px;
                    color: var(--text-primary, rgba(255,255,255,0.9));
                    text-shadow: 0 0 30px rgba(100,80,200,0.15);
                    margin: 8px 0 16px;
                }
                #companion-overlay .companion-btn {
                    padding: 14px 40px;
                    border-radius: 40px;
                    border: none;
                    font-size: 17px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    min-width: 160px;
                    background: var(--accent-color, #7c5cbf);
                    color: #fff;
                    box-shadow: 0 4px 24px rgba(124, 92, 191, 0.3);
                }
                #companion-overlay .companion-btn:hover {
                    transform: scale(1.04);
                    box-shadow: 0 6px 32px rgba(124, 92, 191, 0.45);
                }
                #companion-overlay .companion-btn:active { transform: scale(0.96); }
                #companion-overlay .companion-btn.secondary {
                    background: rgba(255,255,255,0.08);
                    backdrop-filter: blur(8px);
                    border: 1px solid rgba(255,255,255,0.12);
                    box-shadow: none;
                    color: rgba(255,255,255,0.8);
                }
                #companion-overlay .companion-btn.secondary:hover {
                    background: rgba(255,255,255,0.16);
                }
                #companion-overlay .companion-btn.danger {
                    background: rgba(255, 70, 70, 0.2);
                    border: 1px solid rgba(255,70,70,0.3);
                    color: #ff6b6b;
                }
                #companion-overlay .companion-btn.danger:hover {
                    background: rgba(255, 70, 70, 0.3);
                }
                #companion-overlay .companion-btn-group {
                    display: flex; gap: 12px; flex-wrap: wrap; justify-content: center;
                }
                #companion-overlay .companion-btn-group .companion-btn { min-width: 120px; }
                #companion-music-list {
                    width: 100%; max-height: 240px; overflow-y: auto;
                    background: rgba(255,255,255,0.04);
                    border-radius: 12px;
                    border: 1px solid rgba(255,255,255,0.06);
                    padding: 4px 0;
                }
                #companion-music-list .music-item {
                    display: flex; align-items: center; gap: 8px;
                    padding: 8px 12px;
                    cursor: pointer;
                    border-bottom: 1px solid rgba(255,255,255,0.04);
                    transition: background 0.15s;
                    font-size: 13px;
                    color: var(--text-secondary, rgba(255,255,255,0.7));
                }
                #companion-music-list .music-item:hover {
                    background: rgba(255,255,255,0.06);
                }
                #companion-music-list .music-item.active {
                    background: rgba(var(--accent-color-rgb), 0.15);
                    color: var(--text-primary, #fff);
                }
                #companion-music-list .music-item .music-title { flex: 1; text-align: left; }
                #companion-music-list .music-item .music-sub { font-size: 11px; opacity: 0.5; margin-left: 6px; }
                #companion-music-list .music-item .music-delete {
                    color: rgba(255,255,255,0.3);
                    cursor: pointer;
                    font-size: 14px;
                    padding: 0 4px;
                    transition: color 0.2s;
                }
                #companion-music-list .music-item .music-delete:hover { color: #ff6b6b; }
                #companion-music-list .music-empty {
                    padding: 20px;
                    text-align: center;
                    color: rgba(255,255,255,0.3);
                    font-size: 13px;
                }
                .companion-setup-header {
                    display: flex; align-items: center; justify-content: space-between;
                    width: 100%; margin-bottom: 8px;
                }
                .companion-setup-header .search-box {
                    display: flex; gap: 6px; flex: 1; max-width: 240px;
                }
                .companion-setup-header .search-box input {
                    flex: 1; padding: 5px 10px; border-radius: 8px;
                    border: 1px solid rgba(255,255,255,0.12);
                    background: rgba(255,255,255,0.05);
                    color: var(--text-primary, #fff);
                    font-size: 12px; outline: none;
                }
                .companion-setup-header .search-box input::placeholder { color: rgba(255,255,255,0.3); }
                .companion-setup-header .add-btn {
                    padding: 5px 14px; border-radius: 8px;
                    border: none; background: var(--accent-color);
                    color: #fff; font-size: 12px; font-weight: 600;
                    cursor: pointer; transition: opacity 0.2s;
                }
                .companion-setup-header .add-btn:hover { opacity: 0.8; }
                .companion-setup-footer {
                    display: flex; gap: 12px; width: 100%; margin-top: 12px;
                }
                .companion-setup-footer .companion-btn {
                    flex: 1; min-width: unset; padding: 12px 20px; font-size: 15px;
                }
                .companion-countdown-row {
                    display: flex; align-items: center; gap: 12px;
                    width: 100%; justify-content: center;
                }
                .companion-countdown-row label {
                    font-size: 14px; color: var(--text-secondary, rgba(255,255,255,0.6));
                }
                .companion-countdown-row input[type="number"] {
                    width: 60px; padding: 6px 8px; border-radius: 8px;
                    border: 1px solid rgba(255,255,255,0.12);
                    background: rgba(255,255,255,0.05);
                    color: var(--text-primary, #fff);
                    font-size: 16px; text-align: center; outline: none;
                }
                .companion-countdown-row span {
                    font-size: 14px; color: var(--text-secondary, rgba(255,255,255,0.5));
                }
                #companion-floating-control {
                    position: absolute; top: 12px; right: 12px;
                    z-index: 20;
                    display: none; align-items: center; gap: 8px;
                    background: rgba(0,0,0,0.6);
                    backdrop-filter: blur(12px);
                    border: 1px solid rgba(255,255,255,0.08);
                    border-radius: 24px;
                    padding: 6px 12px 6px 16px;
                    color: var(--text-primary, #fff);
                    font-size: 12px;
                    cursor: pointer;
                    transition: all 0.3s;
                }
                #companion-floating-control:hover {
                    background: rgba(0,0,0,0.8);
                    border-color: rgba(255,255,255,0.15);
                }
                #companion-floating-control .fc-title {
                    max-width: 100px; overflow: hidden; text-overflow: ellipsis;
                    white-space: nowrap;
                }
                #companion-floating-control .fc-btn {
                    background: none; border: none; color: var(--text-primary, #fff);
                    cursor: pointer; font-size: 14px; padding: 4px;
                    opacity: 0.7; transition: opacity 0.2s;
                }
                #companion-floating-control .fc-btn:hover { opacity: 1; }
                .companion-toast {
                    position: fixed; z-index: 100000;
                    top: 0; left: 0; right: 0; bottom: 0;
                    display: none; align-items: center; justify-content: center;
                    background: rgba(0,0,0,0.5);
                    backdrop-filter: blur(8px);
                    animation: companionToastIn 0.3s ease;
                }
                .companion-toast.open { display: flex; }
                .companion-toast .toast-box {
                    background: var(--modal-bg, #1e1e2e);
                    border-radius: 24px;
                    padding: 32px 28px;
                    max-width: 340px;
                    width: 90%;
                    box-shadow: 0 20px 60px rgba(0,0,0,0.6);
                    border: 1px solid rgba(255,255,255,0.06);
                    color: var(--text-primary, #fff);
                    text-align: center;
                }
                .companion-toast .toast-box .toast-title {
                    font-size: 18px; font-weight: 700; margin-bottom: 8px;
                }
                .companion-toast .toast-box .toast-body {
                    font-size: 14px; color: rgba(255,255,255,0.6); line-height: 1.6;
                    margin-bottom: 16px;
                }
                .companion-toast .toast-box .toast-body input {
                    width: 100%; padding: 10px 14px; border-radius: 12px;
                    border: 1px solid rgba(255,255,255,0.1);
                    background: rgba(255,255,255,0.05);
                    color: #fff; font-size: 14px;
                    margin-top: 6px;
                }
                .companion-toast .toast-box .toast-btn {
                    padding: 10px 28px; border-radius: 30px; border: none;
                    background: var(--accent-color, #7c5cbf);
                    color: #fff; font-size: 15px; font-weight: 600;
                    cursor: pointer; transition: opacity 0.2s;
                }
                .companion-toast .toast-box .toast-btn:hover { opacity: 0.85; }
                @keyframes companionToastIn {
                    from { opacity: 0; transform: scale(0.92); }
                    to { opacity: 1; transform: scale(1); }
                }
            `;
            document.head.appendChild(style);

            for (let i = 0; i < 60; i++) {
                const star = document.createElement('div');
                star.className = 'star';
                const size = Math.random() * 3 + 1;
                star.style.cssText = `
                    width: ${size}px; height: ${size}px;
                    left: ${Math.random() * 100}%;
                    top: ${Math.random() * 100}%;
                    animation-duration: ${2 + Math.random() * 4}s;
                    animation-delay: ${Math.random() * 4}s;
                    opacity: ${0.2 + Math.random() * 0.5};
                `;
                el.appendChild(star);
            }

            const orb1 = document.createElement('div');
            orb1.className = 'breath-orb breath-orb-1';
            el.appendChild(orb1);
            const orb2 = document.createElement('div');
            orb2.className = 'breath-orb breath-orb-2';
            el.appendChild(orb2);

            const content = document.createElement('div');
            content.className = 'companion-content';
            content.id = 'companion-content';
            el.appendChild(content);

            document.body.appendChild(el);
        }
        overlayEl = el;
        contentEl = document.getElementById('companion-content');
        return el;
    }

    function renderOverlay(html) {
        const overlay = getOverlayContainer();
        if (contentEl) contentEl.innerHTML = html;
        overlay.style.display = 'flex';
        overlay.style.opacity = '1';
    }

function hideOverlay() {
    const overlay = document.getElementById('companion-overlay');
    if (currentUI === 'ready_to_start' || currentUI === 'sleeping') {
        window.__setCompanionActive(false);
    }
    if (overlay) {
        overlay.style.opacity = '0';
        setTimeout(() => {
            overlay.style.display = 'none';
            overlay.style.opacity = '1';
        }, 400);
        // 清理定时器
        if (window._companionIdleTimer) {
            clearTimeout(window._companionIdleTimer);
            window._companionIdleTimer = null;
        }
        if (overlay._resetIdleTimer) {
            overlay.removeEventListener('touchstart', overlay._resetIdleTimer);
            overlay.removeEventListener('click', overlay._resetIdleTimer);
            delete overlay._resetIdleTimer;
        }
        overlay.classList.remove('idle-dim');
    }
    // ★ 直接移除悬浮窗（而非隐藏）
    const fc = document.getElementById('companion-floating-control');
    if (fc) fc.remove();
}

    // ============================================================
    // 渲染 - 设置界面
    // ============================================================
    function renderSetupUI() {
        currentUI = 'setup';
        session.state = STATE.SETUP;

        if (session.musicList.length === 0) {
            loadMusicList();
        }

        const name = getPartnerName();
        const avatarHTML = getPartnerAvatarHTML();

        const filtered = session.musicList.filter(item =>
            item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.sub.toLowerCase().includes(searchTerm.toLowerCase())
        );

        let musicListHTML = '';
        if (filtered.length === 0) {
            musicListHTML = `<div class="music-empty">${searchTerm ? '未找到匹配的音乐' : '还没有导入任何音乐 ✦<br>点击"添加"导入你的白噪音'}</div>`;
        } else {
            musicListHTML = filtered.map(item => {
                const isActive = session.selectedMusicId === item.id;
                const playingMark = isActive && isPlaying ? ' ▶' : '';
                return `
                    <div class="music-item ${isActive ? 'active' : ''}" data-id="${item.id}">
                        <span class="music-title">${item.title}${playingMark}</span>
                        ${item.sub ? `<span class="music-sub">${item.sub}</span>` : ''}
                        <span class="music-delete" data-id="${item.id}" title="删除">✕</span>
                    </div>
                `;
            }).join('');
        }

        const html = `
            <div style="font-size:20px;font-weight:600;margin-bottom:8px;">🧘 陪伴设置</div>
            <div style="font-size:13px;color:rgba(255,255,255,0.4);margin-bottom:12px;">选择白噪音，设置倒计时</div>

            <div class="companion-setup-header">
                <div class="search-box">
                    <input type="text" id="companion-search-input" placeholder="搜索音乐..." value="${searchTerm}">
                    <button class="add-btn" id="companion-add-music-btn">+ 添加</button>
                </div>
            </div>

            <div id="companion-music-list">
                ${musicListHTML}
            </div>

            <div class="companion-countdown-row">
                <label>⏱ 倒计时</label>
                <input type="number" id="companion-countdown-input" min="0" max="10" value="${session.countdownMinutes}" style="color:#fff;">
                <span>分钟</span>
            </div>

            <div style="font-size:11px;color:rgba(255,255,255,0.3);margin-top:-4px;">0分钟 = 不等待，直接开始</div>

            <div class="companion-setup-footer">
                <button class="companion-btn secondary" id="companion-setup-cancel">取消</button>
                <button class="companion-btn" id="companion-setup-confirm">确定</button>
            </div>
        `;

        renderOverlay(html);

        const musicListEl = document.getElementById('companion-music-list');
        if (musicListEl) {
            musicListEl._listener && musicListEl.removeEventListener('click', musicListEl._listener);

            const handler = function(e) {
                const musicItem = e.target.closest('.music-item');
                if (!musicItem) return;

                if (e.target.classList.contains('music-delete')) {
                    const id = musicItem.dataset.id;
                    if (id && confirm('确定要删除这首音乐吗？')) {
                        deleteMusicItem(id);
                    }
                    return;
                }

                const id = musicItem.dataset.id;
                if (id) {
                    console.log('[companion] 点击音乐:', id);
                    selectMusic(id);
                } else {
                    console.warn('[companion] 点击的音乐缺少 id，请刷新页面重试');
                }
            };

            musicListEl.addEventListener('click', handler);
            musicListEl._listener = handler;
        }

        document.getElementById('companion-search-input')?.addEventListener('input', (e) => {
            searchTerm = e.target.value;
            renderSetupUI();
        });

        document.getElementById('companion-add-music-btn')?.addEventListener('click', showAddMusicDialog);

        const countdownInput = document.getElementById('companion-countdown-input');
        if (countdownInput) {
            countdownInput.addEventListener('change', () => {
                let val = parseInt(countdownInput.value) || 0;
                val = Math.max(0, Math.min(10, val));
                session.countdownMinutes = val;
                countdownInput.value = val;
            });
        }

        document.getElementById('companion-setup-cancel')?.addEventListener('click', () => {
            stopMusic();
            hideOverlay();
            session.state = STATE.IDLE;
            currentUI = 'idle';
        });

        document.getElementById('companion-setup-confirm')?.addEventListener('click', () => {
            const input = document.getElementById('companion-countdown-input');
            if (input) {
                let val = parseInt(input.value) || 0;
                val = Math.max(0, Math.min(10, val));
                session.countdownMinutes = val;
            }
            startCountdown();
        });

        updateFloatingControlUI();
    }

    // ============================================================
    // 选择音乐
    // ============================================================
    function selectMusic(id) {
        const item = getMusicItem(id);
        if (!item) {
            console.warn('[companion] 未找到音乐:', id);
            return;
        }

        console.log('[companion] 选择音乐:', item.title, item.url);

        if (session.selectedMusicId === id) {
            toggleMusicPlay();
            return;
        }

        stopMusic();
        session.selectedMusicId = id;
        session.musicTitle = item.title;
        initAudioElement(item.url);

        if (currentUI === 'setup') {
            renderSetupUI();
        } else if (currentUI === 'sleeping' || currentUI === 'ready_to_start') {
            updateFloatingControlUI();
        }
    }

    // ============================================================
    // 添加音乐对话框
    // ============================================================
    function showAddMusicDialog() {
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed; inset: 0; z-index: 100001;
            display: flex; align-items: center; justify-content: center;
            background: rgba(0,0,0,0.6); backdrop-filter: blur(8px);
            animation: companionToastIn 0.3s ease;
        `;
        overlay.innerHTML = `
            <div style="background: var(--modal-bg, #1e1e2e); border-radius: 24px;
                padding: 28px 24px; max-width: 360px; width: 90%;
                border: 1px solid rgba(255,255,255,0.06);">
                <div style="font-size:18px;font-weight:700;margin-bottom:16px;color:var(--text-primary,#fff);">
                    <i class="fas fa-music" style="color:var(--accent-color);margin-right:8px;"></i>添加白噪音
                </div>
                <div style="margin-bottom:12px;">
                    <label style="font-size:12px;color:var(--text-secondary);display:block;margin-bottom:4px;">名称</label>
                    <input type="text" id="add-music-title" placeholder="例如：雨声" style="width:100%;padding:8px 12px;border-radius:10px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.05);color:var(--text-primary,#fff);font-size:14px;outline:none;box-sizing:border-box;">
                </div>
                <div style="margin-bottom:12px;">
                    <label style="font-size:12px;color:var(--text-secondary);display:block;margin-bottom:4px;">备注（可选）</label>
                    <input type="text" id="add-music-sub" placeholder="例如：舒缓的雨声" style="width:100%;padding:8px 12px;border-radius:10px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.05);color:var(--text-primary,#fff);font-size:14px;outline:none;box-sizing:border-box;">
                </div>
                <div style="margin-bottom:16px;">
                    <label style="font-size:12px;color:var(--text-secondary);display:block;margin-bottom:4px;">音频链接 或 <span style="color:var(--accent-color);cursor:pointer;" id="add-music-upload-trigger">上传本地文件</span></label>
                    <input type="text" id="add-music-url" placeholder="https://example.com/audio.mp3" style="width:100%;padding:8px 12px;border-radius:10px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.05);color:var(--text-primary,#fff);font-size:14px;outline:none;box-sizing:border-box;">
                    <input type="file" id="add-music-file-input" accept="audio/*" style="display:none;">
                </div>
                <div style="display:flex;gap:10px;">
                    <button class="companion-btn secondary" id="add-music-cancel" style="flex:1;padding:10px;font-size:14px;min-width:unset;">取消</button>
                    <button class="companion-btn" id="add-music-confirm" style="flex:2;padding:10px;font-size:14px;min-width:unset;">添加</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        const titleInput = document.getElementById('add-music-title');
        const subInput = document.getElementById('add-music-sub');
        const urlInput = document.getElementById('add-music-url');
        const fileInput = document.getElementById('add-music-file-input');
        const uploadTrigger = document.getElementById('add-music-upload-trigger');

        if (uploadTrigger && fileInput) {
            uploadTrigger.addEventListener('click', () => fileInput.click());
            fileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) return;
                if (file.size > 10 * 1024 * 1024) {
                    showToast('文件不能超过10MB', 'error');
                    return;
                }
                const reader = new FileReader();
                reader.onload = (ev) => {
                    urlInput.value = ev.target.result;
                    if (!titleInput.value) {
                        titleInput.value = file.name.replace(/\.[^.]+$/, '');
                    }
                    showToast('音频已加载 ✓', 'success');
                };
                reader.readAsDataURL(file);
                fileInput.value = '';
            });
        }

        document.getElementById('add-music-confirm')?.addEventListener('click', () => {
            const title = titleInput.value.trim();
            const sub = subInput.value.trim();
            const url = urlInput.value.trim();

            if (!title) { showToast('请输入名称', 'warning'); return; }
            if (!url) { showToast('请输入音频链接或上传文件', 'warning'); return; }

            const item = addMusicItem(title, sub, url);
            selectMusic(item.id);
            document.body.removeChild(overlay);
            if (currentUI === 'setup') renderSetupUI();
        });

        document.getElementById('add-music-cancel')?.addEventListener('click', () => {
            document.body.removeChild(overlay);
        });

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) document.body.removeChild(overlay);
        });

        setTimeout(() => titleInput?.focus(), 100);
    }

    // ============================================================
    // 倒计时与睡眠流程
    // ============================================================
    function startCountdown() {
        const minutes = session.countdownMinutes || 0;

        if (session.selectedMusicId && !audioElement) {
            const item = getMusicItem(session.selectedMusicId);
            if (item) {
                initAudioElement(item.url);
                session.musicTitle = item.title;
            }
        }

        if (minutes <= 0) {
            session.state = STATE.READY_TO_START;
            session.countdownRemain = 0;
            showReadyToStart(false);
            return;
        }

        session.state = STATE.COUNTDOWN;
        session.countdownRemain = minutes * 60;
        hideOverlay();
        requestWakeLock();

        if (session.countdownInterval) clearInterval(session.countdownInterval);
        session.countdownInterval = setInterval(() => {
            session.countdownRemain--;
            if (session.countdownRemain <= 0) {
                clearInterval(session.countdownInterval);
                session.countdownInterval = null;
                session.state = STATE.READY_TO_START;
                showReadyToStart(true);
            }
        }, 1000);

        backupAccident();
        showToast(`⏱ 倒计时 ${minutes} 分钟，到点会提醒你`, 'info');
    }

    // ============================================================
    // "开始睡眠"弹窗
    // ============================================================
    function showReadyToStart(withAlarm) {
        if (session.state === STATE.ENDED) return;
        currentUI = 'ready_to_start';

        const name = getPartnerName();
        const avatarHTML = getPartnerAvatarHTML();

        const html = `
            <div class="companion-avatar">${avatarHTML}</div>
            <div class="companion-name">${name}</div>
            <div style="font-size:14px;color:rgba(255,255,255,0.5);margin-top:-4px;">${withAlarm ? '⏰ 该休息了' : '准备好了吗'}</div>
            <div style="margin:18px 0 6px;font-size:15px;color:rgba(255,255,255,0.7);">${withAlarm ? '🌙 点击开始睡眠，闹钟将关闭' : '🌙 可以开始入睡了'}</div>
            <button class="companion-btn" id="companion-start-sleep" style="margin-top:12px;">开始睡眠</button>
            <button class="companion-btn secondary" id="companion-cancel-session" style="margin-top:8px;padding:8px 20px;font-size:13px;background:rgba(255,255,255,0.05);">取消</button>
        `;

        renderOverlay(html);
        window.__setCompanionActive(true);

        if (withAlarm) {
            playAlarm();
        }

        document.getElementById('companion-start-sleep')?.addEventListener('click', () => {
            stopAlarm();
            startSleepTracking();
        });

        document.getElementById('companion-cancel-session')?.addEventListener('click', () => {
            stopAlarm();
            stopMusic();
            releaseWakeLock();
            hideOverlay();
            resetSession();
            currentUI = 'idle';
        });
    }

    // ============================================================
    // ★ 睡眠计时（核心修改）
    // ============================================================
    function startSleepTracking() {
        if (session.state === STATE.ENDED) return;

        const overlay = document.getElementById('companion-overlay');

        if (overlay) {
            if (window._companionIdleTimer) {
                clearTimeout(window._companionIdleTimer);
                window._companionIdleTimer = null;
            }
            if (overlay._resetIdleTimer) {
                overlay.removeEventListener('touchstart', overlay._resetIdleTimer);
                overlay.removeEventListener('click', overlay._resetIdleTimer);
                delete overlay._resetIdleTimer;
            }
            overlay.classList.remove('idle-dim');
        }

        session.state = STATE.SLEEPING;
        currentUI = 'sleeping';
        session.startTime = Date.now();
        session.elapsed = 0;
        session.lastAliveTime = Date.now();
        session._autoStopped = false;

        // ★ 创建进行中的记录
        createOngoingRecord();
        console.log('[companion] 创建实时记录，id:', activeRecordId);

        if (gainNode) {
            applyVolume();
        } else {
            updateVolumeUI();
        }

        const name = getPartnerName();
        const avatarHTML = getPartnerAvatarHTML();
        const statuses = [
            '你先休息，我处理一些事情',
            '✨ 已进入梦境',
            '稍等一下，我马上来',
            '来吧，一起休息 🌙'
        ];
        const status = statuses[Math.floor(Math.random() * statuses.length)];

        const html = `
            <div class="companion-avatar">${avatarHTML}</div>
            <div class="companion-name">${name}</div>
            <div class="companion-status" id="companion-status-text">${status}</div>
            <div class="companion-timer" id="companion-timer-display">00:00</div>
            <div class="companion-btn-group">
                <button class="companion-btn" id="companion-end-sleep">结束睡眠</button>
                <button class="companion-btn secondary" id="companion-interrupt-sleep">中断</button>
            </div>
        `;

        renderOverlay(html);

        if (overlay) {
            overlay.classList.remove('idle-dim');
            if (window._companionIdleTimer) {
                clearTimeout(window._companionIdleTimer);
            }
            const resetIdleTimer = () => {
                overlay.classList.remove('idle-dim');
                if (window._companionIdleTimer) {
                    clearTimeout(window._companionIdleTimer);
                }
                window._companionIdleTimer = setTimeout(() => {
                    overlay.classList.add('idle-dim');
                }, 10000);
            };
            if (overlay._resetIdleTimer) {
                overlay.removeEventListener('touchstart', overlay._resetIdleTimer);
                overlay.removeEventListener('click', overlay._resetIdleTimer);
            }
            overlay.addEventListener('touchstart', resetIdleTimer, { passive: true });
            overlay.addEventListener('click', resetIdleTimer);
            overlay._resetIdleTimer = resetIdleTimer;
            resetIdleTimer();
        }

        addFloatingControl();
        startTimer();
        backupAccident();

        document.getElementById('companion-end-sleep')?.addEventListener('click', () => {
            endSession('completed');
        });
        document.getElementById('companion-interrupt-sleep')?.addEventListener('click', () => {
            endSession('interrupted');
        });

        console.log('[companion] 睡眠计时开始');
    }

    // ============================================================
    // 悬浮音乐控制
    // ============================================================
function addFloatingControl() {
    // ★ 只有在睡眠状态才显示悬浮窗，否则强制隐藏
    if (session.state !== STATE.SLEEPING) {
        const fc = document.getElementById('companion-floating-control');
        if (fc) fc.style.display = 'none';
        return;
    }

    let fc = document.getElementById('companion-floating-control');

    // 如果已存在，确保在 body 中，并重置显示状态
    if (fc) {
        if (fc.parentNode !== document.body) {
            document.body.appendChild(fc);
        }
        fc.classList.remove('dim');
        fc.style.opacity = '1';
        fc.style.display = 'flex';
        updateFloatingControlUI();
        return;
    }

    // 创建新元素
    fc = document.createElement('div');
    fc.id = 'companion-floating-control';
    fc.innerHTML = `
        <span class="fc-title" id="fc-title">无音乐</span>
        <div class="fc-volume-wrap">
            <input type="range" min="0" max="150" value="${session.volumePercent || 20}" class="fc-volume-slider" id="fc-volume-slider">
            <span class="fc-volume-label" id="fc-volume-label">${session.volumePercent || 20}%</span>
        </div>
        <button class="fc-btn" id="fc-play-btn"><i class="fas fa-play"></i></button>
        <button class="fc-btn" id="fc-select-btn"><i class="fas fa-list"></i></button>
    `;
    document.body.appendChild(fc);

    // 事件绑定
    document.getElementById('fc-play-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleMusicPlay();
    });

    document.getElementById('fc-select-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        showMusicSelectPopup();
    });

    const volSlider = document.getElementById('fc-volume-slider');
    const volLabel = document.getElementById('fc-volume-label');
    if (volSlider) {
        volSlider.addEventListener('input', function() {
            const val = parseInt(this.value);
            session.volumePercent = val;
            applyVolume();
            if (volLabel) volLabel.textContent = val + '%';
        });
    }

    updateFloatingControlUI();

    // 自动变暗逻辑
    let idleTimer = null;
    function resetIdleTimer() {
        if (idleTimer) clearTimeout(idleTimer);
        fc.classList.remove('dim');
        fc.style.opacity = '1';
        idleTimer = setTimeout(() => {
            fc.classList.add('dim');
            fc.style.opacity = '0.55';
        }, 10000);
    }

    fc.addEventListener('mouseenter', resetIdleTimer);
    fc.addEventListener('mouseleave', () => {
        if (idleTimer) clearTimeout(idleTimer);
        idleTimer = setTimeout(() => {
            fc.classList.add('dim');
            fc.style.opacity = '0.55';
        }, 10000);
    });
    fc.addEventListener('touchstart', resetIdleTimer);

    fc.querySelectorAll('.fc-btn, .fc-volume-slider').forEach(el => {
        el.addEventListener('pointerdown', resetIdleTimer);
    });

    resetIdleTimer();
}
    function updateFloatingControlUI() {
        const fc = document.getElementById('companion-floating-control');
        if (!fc) return;
        const titleEl = document.getElementById('fc-title');
        const playBtn = document.getElementById('fc-play-btn');
        if (titleEl) titleEl.textContent = session.musicTitle || '无音乐';
        if (playBtn) playBtn.innerHTML = isPlaying ? '<i class="fas fa-pause"></i>' : '<i class="fas fa-play"></i>';
    }

    function updateVolumeUI() {
        const volSlider = document.getElementById('fc-volume-slider');
        const volLabel = document.getElementById('fc-volume-label');
        if (volSlider && gainNode) {
            const currentGain = gainNode.gain.value;
            const percent = Math.round(currentGain * 100);
            if (volLabel) {
                volLabel.textContent = Math.min(150, percent) + '%';
            }
        }
    }

    function applyVolume() {
        if (!gainNode) return;
        const boost = getMusicBoost(session.musicUrl);
        const rawGain = (session.volumePercent / 100) * boost;
        const finalGain = Math.min(rawGain, 4.0);
        gainNode.gain.value = finalGain;
        updateVolumeUI();
    }

    function showMusicSelectPopup() {
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed; inset: 0; z-index: 100002;
            display: flex; align-items: center; justify-content: center;
            background: rgba(0,0,0,0.6); backdrop-filter: blur(8px);
            animation: companionToastIn 0.3s ease;
        `;

        let listHTML = session.musicList.map(item => {
            const isActive = session.selectedMusicId === item.id;
            return `
                <div style="display:flex;align-items:center;padding:10px 14px;border-bottom:1px solid rgba(255,255,255,0.05);cursor:pointer;transition:background 0.15s;${isActive ? 'background:rgba(var(--accent-color-rgb),0.12);' : ''}"
                     class="music-select-item" data-id="${item.id}">
                    <span style="flex:1;font-size:14px;color:var(--text-primary,#fff);">${item.title}</span>
                    ${item.sub ? `<span style="font-size:12px;color:rgba(255,255,255,0.4);margin-right:8px;">${item.sub}</span>` : ''}
                    ${isActive ? '<span style="color:var(--accent-color);font-size:12px;">● 当前</span>' : ''}
                </div>
            `;
        }).join('');

        if (!listHTML) {
            listHTML = `<div style="padding:30px;text-align:center;color:rgba(255,255,255,0.3);font-size:14px;">暂无音乐，请在设置中添加</div>`;
        }

        overlay.innerHTML = `
            <div style="background:var(--modal-bg,#1e1e2e);border-radius:20px;padding:20px;max-width:340px;width:90%;max-height:70vh;overflow-y:auto;border:1px solid rgba(255,255,255,0.06);">
                <div style="font-size:16px;font-weight:600;margin-bottom:14px;color:var(--text-primary,#fff);">🎵 选择音乐</div>
                <div id="music-select-list">
                    ${listHTML}
                </div>
                <div style="margin-top:14px;display:flex;gap:8px;">
                    <button class="companion-btn secondary" id="music-select-close" style="flex:1;padding:8px;font-size:13px;min-width:unset;">关闭</button>
                    <button class="companion-btn secondary" id="music-select-stop" style="flex:1;padding:8px;font-size:13px;min-width:unset;background:rgba(255,70,70,0.15);border-color:rgba(255,70,70,0.2);color:#ff6b6b;">停止音乐</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        overlay.querySelectorAll('.music-select-item').forEach(el => {
            el.addEventListener('click', () => {
                const id = el.dataset.id;
                selectMusic(id);
                document.body.removeChild(overlay);
                updateFloatingControlUI();
            });
        });

        overlay.querySelector('#music-select-close')?.addEventListener('click', () => {
            document.body.removeChild(overlay);
        });

        overlay.querySelector('#music-select-stop')?.addEventListener('click', () => {
            stopMusic();
            session.selectedMusicId = null;
            session.musicTitle = '无音乐';
            updateFloatingControlUI();
            document.body.removeChild(overlay);
            if (session.state === STATE.SLEEPING) {
                const titleEl = document.getElementById('fc-title');
                if (titleEl) titleEl.textContent = '无音乐';
            }
        });

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) document.body.removeChild(overlay);
        });
    }

    // ============================================================
    // 计时器（修改：每5秒保存一次记录）
    // ============================================================
    function startTimer() {
        if (session.rafId) cancelAnimationFrame(session.rafId);
        const start = Date.now();
        const baseElapsed = session.elapsed || 0;
        let lastSaveTime = Date.now();

        function tick() {
            if (session.state !== STATE.SLEEPING) return;
            const now = Date.now();
            session.elapsed = baseElapsed + (now - start);
            session.lastAliveTime = now;
            updateSleepTimerUI();

            // ★ 每5秒保存一次记录
            if (now - lastSaveTime >= 5000) {
                updateOngoingRecord();
                lastSaveTime = now;
            }

            if (session.elapsed >= 30 * 60 * 1000) {
                hideStatusText();
            }

            if (session.elapsed >= 60 * 60 * 1000 && isPlaying) {
                if (!session._autoStopped) {
                    session._autoStopped = true;
                    fadeOutMusic(3000);
                }
            }

            backupAccident();
            session.rafId = requestAnimationFrame(tick);
        }
        session.rafId = requestAnimationFrame(tick);
    }

    function stopTimer() {
        if (session.rafId) {
            cancelAnimationFrame(session.rafId);
            session.rafId = null;
        }
    }

    function updateSleepTimerUI() {
        const timerEl = document.getElementById('companion-timer-display');
        if (timerEl) {
            const totalSeconds = Math.floor(session.elapsed / 1000);
            const mins = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
            const secs = String(totalSeconds % 60).padStart(2, '0');
            timerEl.textContent = `${mins}:${secs}`;
        }
    }

    function hideStatusText() {
        const el = document.getElementById('companion-status-text');
        if (el) el.classList.add('hidden');
    }

    // ============================================================
    // 结束会话（修改）
    // ============================================================
    function endSession(mode) {
    // ★ 强制隐藏悬浮窗
        const fc = document.getElementById('companion-floating-control');
        if (fc) fc.style.display = 'none';
        if (session.isEnding) return;
        if (session.state !== STATE.SLEEPING) return;

        session.isEnding = true;
        stopTimer();
        stopAlarm();

        const elapsedMs = session.elapsed || 0;
        const elapsedMinutes = elapsedMs / (60 * 1000);

        if (elapsedMinutes < MIN_VALID_MINUTES) {
            // 时长不足，删除进行中的记录（或不保存）
            if (activeRecordId) {
                const records = _getRecords();
                const idx = records.findIndex(r => r.id === activeRecordId);
                if (idx !== -1) records.splice(idx, 1);
                _saveRecords(records);
                activeRecordId = null;
            }
            stopMusic();
            releaseWakeLock();
            hideOverlay();
            showToast(`陪伴时长不足${MIN_VALID_MINUTES}分钟，不生成记录`, 'info');
            resetSession();
            session.isEnding = false;
            currentUI = 'idle';
            return;
        }

        // 先完成记录
        finalizeOngoingRecord(mode);

        // 构造用于显示Toast的记录（使用session数据）
        const startDate = session.startTime ? new Date(session.startTime) : new Date();
        const endDate = new Date();
        const record = {
            startTime: startDate.toISOString(),
            endTime: endDate.toISOString(),
            duration: elapsedMs,
            mode: mode,
        };

        if (mode === 'interrupted') {
            hideOverlay();
            showInterruptReasonToast(record, () => {
                // 在确认保存原因后，更新记录
                // 但因为我们已经在 finalizeOngoingRecord 中保存了，这里只需要清理UI
                // 实际原因更新在 showInterruptReasonToast 内部处理
                stopMusic();
                releaseWakeLock();
                clearAccident();
                resetSession();
                session.isEnding = false;
                currentUI = 'idle';
            });
        } else {
            // 完成
            hideOverlay();
            showCompletionToast(record, () => {
                stopMusic();
                releaseWakeLock();
                clearAccident();
                resetSession();
                session.isEnding = false;
                currentUI = 'idle';
            });
        }
    }

function showInterruptReasonToast(record, onSave) {
    const startFormatted = window.formatDateTime(record.startTime);
    const endFormatted = window.formatDateTime(record.endTime);
    const durationFormatted = window.formatDuration(record.duration);

    const toast = document.createElement('div');
    toast.className = 'companion-toast open';
    toast.id = 'companion-toast-temp';
    toast.innerHTML = `
        <div class="toast-box" style="background:var(--secondary-bg);border-radius:24px;padding:24px 22px 20px;max-width:340px;width:90%;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.6);border:1px solid var(--border-color);">
            <div class="toast-title" style="font-size:22px;font-weight:700;margin-bottom:14px;color:var(--text-primary);letter-spacing:1px;">⏸️ 睡眠终止</div>
            <div class="toast-body" style="font-size:14px;color:var(--text-secondary);line-height:1.8;margin-bottom:6px;text-align:left;padding-left:4px;">
                <div>开始时间：${startFormatted}</div>
                <div>结束时间：${endFormatted}</div>
                <div>睡眠时长：${durationFormatted}</div>
            </div>
            <div style="margin-top:14px;border-top:1px solid var(--border-color);padding-top:12px;text-align:left;">
                <label style="font-size:12px;color:var(--text-secondary);display:block;margin-bottom:4px;">终止原因</label>
                <textarea id="interrupt-reason-input" rows="2" placeholder="例如：被电话吵醒…" style="width:100%;padding:8px 10px;border-radius:10px;border:1px solid var(--border-color);background:var(--primary-bg);color:var(--text-primary);font-family:var(--font-family);font-size:13px;resize:vertical;box-sizing:border-box;outline:none;">${record.interruptReason || ''}</textarea>
            </div>
            <div style="display:flex;gap:12px;justify-content:center;margin-top:16px;">
                <button class="toast-btn" id="toast-cancel-btn" style="flex:1;padding:10px 0;border-radius:30px;border:1px solid var(--border-color);background:transparent;color:var(--text-secondary);font-size:14px;font-weight:500;cursor:pointer;transition:background 0.2s;">取消</button>
                <button class="toast-btn" id="toast-save-btn" style="flex:1;padding:10px 0;border-radius:30px;border:none;background:var(--accent-color);color:#fff;font-size:14px;font-weight:600;cursor:pointer;box-shadow:0 2px 8px rgba(var(--accent-color-rgb),0.3);">保存</button>
            </div>
        </div>
    `;
    document.body.appendChild(toast);

    const saveBtn = toast.querySelector('#toast-save-btn');
    const cancelBtn = toast.querySelector('#toast-cancel-btn');
    const input = toast.querySelector('#interrupt-reason-input');

    const doSave = (reason) => {
        const records = _getRecords();
        // 使用开始时间 + mode 精确定位
        const idx = records.findIndex(r => r.startTime === record.startTime && r.mode === 'interrupted');
        if (idx !== -1) {
            records[idx].terminateReason = reason || '';
            _saveRecords(records);
        }
        document.body.removeChild(toast);
        if (onSave) onSave();
    };

    saveBtn.addEventListener('click', () => doSave(input.value.trim()));
    cancelBtn.addEventListener('click', () => {
        document.body.removeChild(toast);
        if (onSave) onSave();
    });
    toast.addEventListener('click', (e) => {
        if (e.target === toast) {
            document.body.removeChild(toast);
            if (onSave) onSave();
        }
    });
}

function showCompletionToast(record, onSave) {
    const startFormatted = window.formatDateTime(record.startTime);
    const endFormatted = window.formatDateTime(record.endTime);
    const durationFormatted = window.formatDuration(record.duration);

    const toast = document.createElement('div');
    toast.className = 'companion-toast open';
    toast.id = 'companion-toast-temp';
    toast.innerHTML = `
        <div class="toast-box" style="background:var(--secondary-bg);border-radius:24px;padding:24px 22px 20px;max-width:340px;width:90%;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.6);border:1px solid var(--border-color);">
            <div class="toast-title" style="font-size:22px;font-weight:700;margin-bottom:14px;color:var(--text-primary);letter-spacing:1px;">🌙 好梦</div>
            <div class="toast-body" style="font-size:14px;color:var(--text-secondary);line-height:1.8;margin-bottom:6px;text-align:left;padding-left:4px;">
                <div>开始时间：${startFormatted}</div>
                <div>结束时间：${endFormatted}</div>
                <div>睡眠时长：${durationFormatted}</div>
            </div>
            <div style="margin-top:14px;border-top:1px solid var(--border-color);padding-top:12px;text-align:left;">
                <label style="font-size:12px;color:var(--text-secondary);display:block;margin-bottom:4px;">感想记录</label>
                <textarea id="completion-reflection-input" rows="2" placeholder="记录此刻的感想…" style="width:100%;padding:8px 10px;border-radius:10px;border:1px solid var(--border-color);background:var(--primary-bg);color:var(--text-primary);font-family:var(--font-family);font-size:13px;resize:vertical;box-sizing:border-box;outline:none;"></textarea>
            </div>
            <div style="display:flex;gap:12px;justify-content:center;margin-top:16px;">
                <button class="toast-btn" id="toast-cancel-btn" style="flex:1;padding:10px 0;border-radius:30px;border:1px solid var(--border-color);background:transparent;color:var(--text-secondary);font-size:14px;font-weight:500;cursor:pointer;transition:background 0.2s;">取消</button>
                <button class="toast-btn" id="toast-save-btn" style="flex:1;padding:10px 0;border-radius:30px;border:none;background:var(--accent-color);color:#fff;font-size:14px;font-weight:600;cursor:pointer;box-shadow:0 2px 8px rgba(var(--accent-color-rgb),0.3);">保存</button>
            </div>
        </div>
    `;
    document.body.appendChild(toast);

    const saveBtn = toast.querySelector('#toast-save-btn');
    const cancelBtn = toast.querySelector('#toast-cancel-btn');
    const input = toast.querySelector('#completion-reflection-input');

    const doSave = () => {
        const reflection = input.value.trim();
        let allRecords = [];
        try {
            const data = localStorage.getItem('companion_records');
            allRecords = data ? JSON.parse(data) : [];
        } catch (e) { allRecords = []; }
        // 用开始时间和模式定位记录
        const idx = allRecords.findIndex(r => r.startTime === record.startTime && r.mode === 'completed');
        if (idx !== -1) {
            allRecords[idx].reflection = reflection;
            try {
                localStorage.setItem('companion_records', JSON.stringify(allRecords));
                window._companionRecords = allRecords;
            } catch (e) { console.warn('保存感想失败', e); }
        }
        document.body.removeChild(toast);
        if (onSave) onSave();
    };

    saveBtn.addEventListener('click', doSave);
    cancelBtn.addEventListener('click', () => {
        document.body.removeChild(toast);
        if (onSave) onSave();
    });
    toast.addEventListener('click', (e) => {
        if (e.target === toast) {
            document.body.removeChild(toast);
            if (onSave) onSave();
        }
    });
}

    // ============================================================
    // 遗言机制（保留作为备选，但主要靠实时记录）
    // ============================================================
    function backupAccident() {
        if (session.state === STATE.IDLE || session.state === STATE.ENDED) {
            clearAccident();
            return;
        }
        try {
            const data = {
                state: session.state,
                musicTitle: session.musicTitle,
                musicUrl: session.musicUrl,
                selectedMusicId: session.selectedMusicId,
                startTime: session.startTime,
                lastAliveTime: session.lastAliveTime || Date.now(),
                elapsed: session.elapsed || 0,
                countdownRemain: session.countdownRemain || 0,
                countdownMinutes: session.countdownMinutes || 5,
                timestamp: Date.now(),
            };
            localStorage.setItem(ACCIDENT_KEY, JSON.stringify(data));
        } catch (e) {}
    }

    function clearAccident() {
        try { localStorage.removeItem(ACCIDENT_KEY); } catch (e) {}
    }

    window._backupCompanionAccident = backupAccident;

    // 检查遗言（兼容旧逻辑，但优先使用实时记录恢复）
    window.checkCompanionAccident = function () {
        // 先检查是否有 ongoing 记录
        const records = _getRecords();
        const ongoing = records.filter(r => r.mode === 'ongoing');
        if (ongoing.length > 0) {
            return {
                state: STATE.SLEEPING,
                startTime: ongoing[0].startTime,
                lastAliveTime: Date.now(),
                musicTitle: ongoing[0].soundType,
            };
        }
        // 否则检查旧的遗言
        try {
            const raw = localStorage.getItem(ACCIDENT_KEY);
            if (!raw) return null;
            const data = JSON.parse(raw);
            if (data.state === STATE.SLEEPING || data.state === STATE.READY_TO_START || data.state === STATE.COUNTDOWN) {
                return data;
            }
            return null;
        } catch { return null; }
    };

    // 恢复遗言（统一处理）
    window.restoreCompanionAccident = function (accidentData) {
        // 优先调用实时记录恢复
        checkAndRecoverOngoingRecord();

        // 如果还有旧的遗言（可能在实时记录没有的情况下），也处理
        if (accidentData) {
            const records = _getRecords();
            const hasOngoing = records.some(r => r.mode === 'ongoing');
            if (hasOngoing) {
                clearAccident();
                resetSession();
                return;
            }
            // 否则按旧逻辑处理（但旧逻辑可能不会产生记录，只提示）
            if (accidentData.state === STATE.SLEEPING && accidentData.startTime) {
                const startTime = new Date(accidentData.startTime);
                const durationMs = Math.max(0, (accidentData.lastAliveTime || Date.now()) - startTime);
                if (durationMs / 60000 >= MIN_VALID_MINUTES) {
                    const record = {
                        id: 'comp_sys_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
                        date: startTime.toISOString().split('T')[0],
                        startTime: startTime.toISOString(),
                        endTime: new Date().toISOString(),
                        duration: durationMs,
                        mode: 'system_interrupt',
                        soundType: accidentData.musicTitle || '未知',
                        status: '系统中断',
                        interruptReason: '页面意外退出（遗言恢复）',
                        isSystemInterrupt: true,
                    };
                    const records2 = _getRecords();
                    records2.push(record);
                    _saveRecords(records2);
                    showToast('检测到未完成的陪伴，已补录系统中断记录', 'warning');
                }
            }
            clearAccident();
            resetSession();
            currentUI = 'idle';
        }
    };

    // ============================================================
    // 重置会话
    // ============================================================
function resetSession() {
    stopTimer();
    clearInterval(session.countdownInterval);
    session.countdownInterval = null;
    session.state = STATE.IDLE;
    session.startTime = null;
    session.elapsed = 0;
    session.lastAliveTime = null;
    session.isEnding = false;
    session.countdownRemain = 0;
    // ★ 直接移除悬浮窗（彻底清除）
    const fc = document.getElementById('companion-floating-control');
    if (fc) fc.remove();
}

    // ============================================================
    // 对外入口
    // ============================================================
    function showCompanionPicker() {
        if (session.state === STATE.SLEEPING || session.state === STATE.COUNTDOWN || session.state === STATE.READY_TO_START) {
            showToast('已有进行中的陪伴，请先结束当前会话', 'warning');
            return;
        }

        resetSession();
        session.state = STATE.SETUP;
        currentUI = 'setup';

        if (session.musicList.length === 0) {
            loadMusicList();
        }

        renderSetupUI();
    }


function initCompanionFeature() {
    console.log('[companion] 陪伴功能已加载（实时记录版）');
    window.showCompanionPicker = showCompanionPicker;
    window.openCompanion = showCompanionPicker;

    loadMusicList();
    stopMusic();
    stopAlarm();

    // ★ 调用全局的 bindCompanionCalendarEvents（已在自执行函数外定义）
    if (typeof bindCompanionCalendarEvents === 'function') {
        bindCompanionCalendarEvents();
    } else {
        console.warn('[companion] bindCompanionCalendarEvents 未定义，跳过绑定');
    }

    // ★ 监听开屏动画结束事件
    window.addEventListener('welcomeAnimationEnded', function onWelcomeEnded() {
        console.log('[companion] 收到开屏动画结束事件');
        window.removeEventListener('welcomeAnimationEnded', onWelcomeEnded);
        checkAndRecoverOngoingRecord();
    });

}

    // 页面卸载时清理
    window.addEventListener('beforeunload', function () {
        if (session.state === STATE.SLEEPING || session.state === STATE.COUNTDOWN || session.state === STATE.READY_TO_START) {
            backupAccident();
            if (session.state === STATE.SLEEPING && activeRecordId) {
                updateOngoingRecord();
            }
        }
        stopMusic();
        stopAlarm();
        releaseWakeLock();
    });

    window.addEventListener('pagehide', function() {
        if (session.state !== STATE.IDLE && session.state !== STATE.ENDED) {
            backupAccident();
            if (session.state === STATE.SLEEPING && activeRecordId) {
                updateOngoingRecord();
            }
        }
    });

    window.initCompanionFeature = initCompanionFeature;
    // 显示子菜单（开启陪伴的子选项）
    window.showCompanionSubMenu = function() {
        const mainMenu = document.getElementById('companion-main-menu');
        const subMenu = document.getElementById('companion-sub-menu');
        if (mainMenu) mainMenu.style.display = 'none';
        if (subMenu) subMenu.style.display = 'block';
    };

    // 隐藏子菜单（返回主菜单）
    window.hideCompanionSubMenu = function() {
        const mainMenu = document.getElementById('companion-main-menu');
        const subMenu = document.getElementById('companion-sub-menu');
        if (mainMenu) mainMenu.style.display = 'block';
        if (subMenu) subMenu.style.display = 'none';
    };
    window.showToast = showToast;
    window.formatTime = formatTime;
    window.formatDuration = formatDuration;
    window.formatDateTime = formatDateTime;

    console.log('[companion] 模块加载完成（实时记录版）');
})();

// ============================================================
// 陪伴记录 - 日历事件绑定（全局）
// ============================================================
function bindCompanionCalendarEvents() {
    // ---- 标签页切换 ----
    const tabCalendar = document.getElementById('comp-records-tab-calendar');
    const tabStats = document.getElementById('comp-records-tab-stats');
    const panelCalendar = document.getElementById('comp-records-calendar-panel');
    const panelStats = document.getElementById('comp-records-stats-panel');

    if (tabCalendar && tabStats && panelCalendar && panelStats) {
        tabCalendar.addEventListener('click', function() {
            tabCalendar.classList.add('active');
            tabStats.classList.remove('active');
            panelCalendar.style.display = 'block';
            panelStats.style.display = 'none';
            renderCompanionCalendar();
        });
        tabStats.addEventListener('click', function() {
            tabStats.classList.add('active');
            tabCalendar.classList.remove('active');
            panelStats.style.display = 'block';
            panelCalendar.style.display = 'none';
            renderCompanionStats();
        });
    }

    // ---- 月份导航（左右箭头） ----
    const prevBtn = document.getElementById('comp-records-prev-month');
    const nextBtn = document.getElementById('comp-records-next-month');
    if (prevBtn) {
        prevBtn.addEventListener('click', function() {
            _compRecordsCurrentDate.setMonth(_compRecordsCurrentDate.getMonth() - 1);
            updateCompanionDateSelectors();
            renderCompanionCalendar();
            const panelStats = document.getElementById('comp-records-stats-panel');
            if (panelStats && panelStats.style.display !== 'none') {
                renderCompanionStats();
            }
        });
    }
    if (nextBtn) {
        nextBtn.addEventListener('click', function() {
            _compRecordsCurrentDate.setMonth(_compRecordsCurrentDate.getMonth() + 1);
            updateCompanionDateSelectors();
            renderCompanionCalendar();
            const panelStats = document.getElementById('comp-records-stats-panel');
            if (panelStats && panelStats.style.display !== 'none') {
                renderCompanionStats();
            }
        });
    }

    // ---- 年份/月份下拉框填充（保留以备不时之需，但已隐藏） ----
    populateCompanionYearMonthSelectors();

    // ---- 跳转按钮（弹窗选择年月） ----
    const jumpBtn = document.getElementById('comp-records-jump-btn');
    if (jumpBtn) {
        jumpBtn.replaceWith(jumpBtn.cloneNode(true));
        const newJumpBtn = document.getElementById('comp-records-jump-btn');
        if (newJumpBtn) {
            newJumpBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                showCompanionJumpPanel();
            });
        }
    }

    // ---- 当前按钮（回到当前月份） ----
    const currentBtn = document.getElementById('comp-records-current-btn');
    if (currentBtn) {
        currentBtn.replaceWith(currentBtn.cloneNode(true));
        const newCurrentBtn = document.getElementById('comp-records-current-btn');
        if (newCurrentBtn) {
            newCurrentBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                _compRecordsCurrentDate = new Date(); // 设置为当前日期
                updateCompanionDateSelectors();
                renderCompanionCalendar();
                const panelStats = document.getElementById('comp-records-stats-panel');
                if (panelStats && panelStats.style.display !== 'none') {
                    renderCompanionStats();
                }
            });
        }
    }

    // ---- 关闭按钮（只保留右上角） ----
    const closeTop = document.getElementById('close-companion-records');
    if (closeTop) {
        closeTop.replaceWith(closeTop.cloneNode(true));
        const newCloseTop = document.getElementById('close-companion-records');
        if (newCloseTop) {
            newCloseTop.addEventListener('click', function() {
                hideModal(document.getElementById('companion-records-modal'));
            });
        }
    }
    const closeBottom = document.getElementById('close-companion-records-btn');
    if (closeBottom) closeBottom.style.display = 'none';

    // 日详情右上角关闭
    const closeDayTop = document.getElementById('close-companion-day-modal');
    if (closeDayTop) {
        closeDayTop.replaceWith(closeDayTop.cloneNode(true));
        const newCloseDayTop = document.getElementById('close-companion-day-modal');
        if (newCloseDayTop) {
            newCloseDayTop.addEventListener('click', function() {
                hideModal(document.getElementById('companion-day-modal'));
            });
        }
    }
    const closeDayBottom = document.getElementById('close-companion-day-modal-btn');
    if (closeDayBottom) closeDayBottom.style.display = 'none';

    // 记录详情右上角关闭（已在 showCompanionRecordDetail 中处理，但保留兜底）
    const closeDetailTop = document.getElementById('close-companion-record-detail-modal');
    if (closeDetailTop) {
        closeDetailTop.replaceWith(closeDetailTop.cloneNode(true));
        const newCloseDetailTop = document.getElementById('close-companion-record-detail-modal');
        if (newCloseDetailTop) {
            newCloseDetailTop.addEventListener('click', function() {
                hideModal(document.getElementById('companion-record-detail-modal'));
            });
        }
    }
    const closeDetailBottom = document.getElementById('close-companion-record-detail-modal-btn');
    if (closeDetailBottom) closeDetailBottom.style.display = 'none';
}

// ============================================================
// 陪伴记录 - 统计视图（全局）
// ============================================================

let _compRecordsCurrentDate = new Date();

// 辅助函数：获取记录并过滤掉 ongoing
function getFilteredRecords() {
    const records = window._companionRecords || [];
    return records.filter(r => r.mode !== 'ongoing');
}

function renderCompanionStats() {
    const year = _compRecordsCurrentDate.getFullYear();
    const month = _compRecordsCurrentDate.getMonth();

    const label = document.getElementById('comp-stats-month-label');
    if (label) label.textContent = year + '年' + String(month + 1).padStart(2, '0') + '月';

    // ★ 只统计"顺利完成"的记录（mode === 'completed'）
    const allRecords = window._companionRecords || [];
    const completedRecords = allRecords.filter(r => r.mode === 'completed');
    const monthRecords = completedRecords.filter(r => {
        if (!r.date) return false;
        const d = new Date(r.date + 'T00:00:00');
        return d.getFullYear() === year && d.getMonth() === month;
    });

    const summaryEl = document.getElementById('comp-stats-summary');
    const avgBedtimeEl = document.getElementById('comp-stats-avg-bedtime');
    const avgDurationEl = document.getElementById('comp-stats-avg-duration');
    const barsBedtime = document.getElementById('comp-stats-bedtime-bars');
    const barsDuration = document.getElementById('comp-stats-duration-bars');
    const emptyEl = document.getElementById('comp-stats-empty');

    if (!summaryEl || !barsBedtime || !barsDuration) return;

    // 无记录时的空状态
    if (monthRecords.length === 0) {
        summaryEl.textContent = '陪伴 0 天 · 0 次';
        if (avgBedtimeEl) avgBedtimeEl.textContent = '平均: --:--';
        if (avgDurationEl) avgDurationEl.textContent = '平均: --';
        
        barsBedtime.innerHTML = '';
        const emptyBar1 = document.createElement('div');
        emptyBar1.style.cssText = `width:100%;height:12px;border-radius:4px;background:var(--border-color);display:flex;align-items:center;justify-content:center;font-size:11px;color:var(--text-secondary);opacity:0.5;`;
        emptyBar1.textContent = '无记录';
        barsBedtime.appendChild(emptyBar1);
        
        barsDuration.innerHTML = '';
        const emptyBar2 = document.createElement('div');
        emptyBar2.style.cssText = `width:100%;height:12px;border-radius:4px;background:var(--border-color);display:flex;align-items:center;justify-content:center;font-size:11px;color:var(--text-secondary);opacity:0.5;`;
        emptyBar2.textContent = '无记录';
        barsDuration.appendChild(emptyBar2);
        
        if (emptyEl) emptyEl.style.display = 'none';
        return;
    }
    if (emptyEl) emptyEl.style.display = 'none';

    // 按日期分组统计天数
    const dayMap = {};
    monthRecords.forEach(r => {
        const day = new Date(r.date + 'T00:00:00').getDate();
        if (!dayMap[day]) dayMap[day] = [];
        dayMap[day].push(r);
    });
    const days = Object.keys(dayMap).sort((a,b) => a-b);
    summaryEl.textContent = `陪伴 ${days.length} 天 · ${monthRecords.length} 次`;

    // ---- 计算平均值 ----
    // 平均入睡时间
    const bedtimeValues = [];
    monthRecords.forEach(r => {
        if (r.startTime) {
            const d = new Date(r.startTime);
            const totalMinutes = d.getHours() * 60 + d.getMinutes();
            bedtimeValues.push(totalMinutes);
        }
    });
    let avgBedtime = null;
    if (bedtimeValues.length > 0) {
        const sum = bedtimeValues.reduce((a,b) => a+b, 0);
        avgBedtime = Math.round(sum / bedtimeValues.length);
    }
    if (avgBedtimeEl) {
        if (avgBedtime !== null) {
            const h = Math.floor(avgBedtime / 60);
            const m = Math.round(avgBedtime % 60);
            avgBedtimeEl.textContent = '平均: ' + String(h).padStart(2,'0') + ':' + String(m).padStart(2,'0');
        } else {
            avgBedtimeEl.textContent = '平均: --:--';
        }
    }

    // 平均睡眠时长（分钟）
    const durationValues = [];
    monthRecords.forEach(r => {
        if (r.duration) {
            durationValues.push(r.duration / 60000);
        }
    });
    let avgDuration = null;
    if (durationValues.length > 0) {
        const sum = durationValues.reduce((a,b) => a+b, 0);
        avgDuration = Math.round(sum / durationValues.length);
    }
    if (avgDurationEl) {
        if (avgDuration !== null) {
            avgDurationEl.textContent = '平均: ' + formatHoursMinutes(avgDuration);
        } else {
            avgDurationEl.textContent = '平均: --';
        }
    }

    // ---- ★ 入睡时间横轴（按固定颜色顺序） ----
    barsBedtime.innerHTML = '';
    barsBedtime.style.cssText = 'display:flex;height:12px;border-radius:4px;overflow:hidden;';
    
    if (bedtimeValues.length > 0) {
        // 定义区间：7个区间，固定顺序
        const bedtimeRanges = [
            { label: '21:00-23:00', min: 21*60, max: 23*60, color: '#FF6B81' },
            { label: '23:00-23:30', min: 23*60, max: 23*60+30, color: '#C9A0DC' },
            { label: '23:30-00:00', min: 23*60+30, max: 24*60, color: '#A67CBF' },
            { label: '00:00-00:30', min: 0, max: 30, color: '#7B68EE' },
            { label: '00:30-01:00', min: 30, max: 60, color: '#4A6FA5' },
            { label: '01:00-07:00', min: 60, max: 7*60, color: '#666666' },
            { label: '07:00-21:00', min: 7*60, max: 21*60, color: '#E8DDD0' }
        ];

        // 统计每个区间的记录数
        const rangeCounts = bedtimeRanges.map(range => {
            let count = 0;
            bedtimeValues.forEach(val => {
                if (val >= range.min && val < range.max) {
                    count++;
                }
            });
            return count;
        });

        const total = bedtimeValues.length;
        // 生成横轴分段
        rangeCounts.forEach((count, index) => {
            if (count === 0) return;
            const ratio = count / total;
            const bar = document.createElement('div');
            const color = bedtimeRanges[index].color;
            bar.style.cssText = `flex:${ratio};height:100%;background:${color};border-radius:0;`;
            bar.title = `${bedtimeRanges[index].label}: ${count}次`;
            barsBedtime.appendChild(bar);
        });

    } else {
        const emptyBar = document.createElement('div');
        emptyBar.style.cssText = `width:100%;height:12px;border-radius:4px;background:var(--border-color);display:flex;align-items:center;justify-content:center;font-size:11px;color:var(--text-secondary);opacity:0.5;`;
        emptyBar.textContent = '无记录';
        barsBedtime.appendChild(emptyBar);
    }

    // ---- ★ 睡眠时长横轴（按固定颜色顺序，新规则） ----
    barsDuration.innerHTML = '';
    barsDuration.style.cssText = 'display:flex;height:12px;border-radius:4px;overflow:hidden;';
    
    if (durationValues.length > 0) {
        // 定义区间：6个区间，固定顺序（单位：小时）
        const durationRanges = [
            { label: '≥8h', min: 8, max: Infinity, color: '#FF6B81' },
            { label: '7.5h-8h', min: 7.5, max: 8, color: '#C9A0DC' },
            { label: '7h-7.5h', min: 7, max: 7.5, color: '#A67CBF' },
            { label: '6.5h-7h', min: 6.5, max: 7, color: '#7B68EE' },
            { label: '6h-6.5h', min: 6, max: 6.5, color: '#4A6FA5' },
            { label: '<6h', min: 0, max: 6, color: '#666666' }
        ];

        // 将时长转换为小时
        const durationHours = durationValues.map(min => min / 60);
        // 统计每个区间的记录数
        const rangeCounts = durationRanges.map(range => {
            let count = 0;
            durationHours.forEach(val => {
                if (val >= range.min && val < range.max) {
                    count++;
                }
            });
            return count;
        });

        const total = durationHours.length;
        rangeCounts.forEach((count, index) => {
            if (count === 0) return;
            const ratio = count / total;
            const bar = document.createElement('div');
            const color = durationRanges[index].color;
            bar.style.cssText = `flex:${ratio};height:100%;background:${color};border-radius:0;`;
            bar.title = `${durationRanges[index].label}: ${count}次`;
            barsDuration.appendChild(bar);
        });

        if (barsDuration.children.length === 0) {
            const emptyBar = document.createElement('div');
            emptyBar.style.cssText = `width:100%;height:12px;border-radius:4px;background:var(--border-color);display:flex;align-items:center;justify-content:center;font-size:11px;color:var(--text-secondary);opacity:0.5;`;
            emptyBar.textContent = '无记录';
            barsDuration.appendChild(emptyBar);
        }
    } else {
        const emptyBar = document.createElement('div');
        emptyBar.style.cssText = `width:100%;height:12px;border-radius:4px;background:var(--border-color);display:flex;align-items:center;justify-content:center;font-size:11px;color:var(--text-secondary);opacity:0.5;`;
        emptyBar.textContent = '无记录';
        barsDuration.appendChild(emptyBar);
    }
}

function formatHoursMinutes(totalMinutes) {
    if (!totalMinutes || totalMinutes < 0) return '0分钟';
    const hours = Math.floor(totalMinutes / 60);
    const mins = Math.round(totalMinutes % 60);
    if (hours === 0) return mins + '分钟';
    if (mins === 0) return hours + '小时';
    return hours + '小时' + mins + '分钟';
}

function formatTimeFromMinutes(totalMinutes) {
    const h = Math.floor(totalMinutes / 60);
    const m = Math.round(totalMinutes % 60);
    return String(h).padStart(2,'0') + ':' + String(m).padStart(2,'0');
}

function showCompanionRecords() {
    const modal = document.getElementById('companion-records-modal');
    if (!modal) {
        showToast('陪伴记录模块未加载，请刷新页面', 'error');
        return;
    }
    loadCompanionRecordsData();
    _compRecordsCurrentDate = new Date();
    renderCompanionCalendar();
    const panelCalendar = document.getElementById('comp-records-calendar-panel');
    const panelStats = document.getElementById('comp-records-stats-panel');
    if (panelCalendar) panelCalendar.style.display = 'block';
    if (panelStats) panelStats.style.display = 'none';
    const tabCal = document.getElementById('comp-records-tab-calendar');
    const tabStat = document.getElementById('comp-records-tab-stats');
    if (tabCal) tabCal.classList.add('active');
    if (tabStat) tabStat.classList.remove('active');

    // ★ 修复右上角关闭键
    const closeTop = document.getElementById('close-companion-records');
    if (closeTop) {
        closeTop.replaceWith(closeTop.cloneNode(true));
        const newCloseTop = document.getElementById('close-companion-records');
        if (newCloseTop) {
            newCloseTop.addEventListener('click', function() {
                hideModal(modal);
            });
        }
    }

    // ★ 隐藏右下角关闭按钮
    const closeBottom = document.getElementById('close-companion-records-btn');
    if (closeBottom) {
        closeBottom.style.display = 'none';
    }

    showModal(modal);
}

function loadCompanionRecordsData() {
    try {
        const key = 'companion_records';
        const data = localStorage.getItem(key);
        if (data) {
            const parsed = JSON.parse(data);
            if (Array.isArray(parsed)) {
                window._companionRecords = parsed;
                return;
            }
        }
    } catch (e) {}
    window._companionRecords = [];
}

// ============================================================
// 跳转面板（年月选择弹窗）
// ============================================================
let jumpPanel = null;

function showCompanionJumpPanel() {
    if (jumpPanel) {
        document.body.removeChild(jumpPanel);
        jumpPanel = null;
    }

    const currentYear = _compRecordsCurrentDate.getFullYear();
    const currentMonth = _compRecordsCurrentDate.getMonth();

    const panel = document.createElement('div');
    panel.style.cssText = `
        position: fixed;
        inset: 0;
        z-index: 99999;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(0,0,0,0.4);
        backdrop-filter: blur(4px);
        animation: companionToastIn 0.3s ease;
    `;

    panel.innerHTML = `
        <div style="background: var(--secondary-bg); border-radius: 20px; padding: 24px; max-width: 300px; width: 85%; box-shadow: 0 10px 40px rgba(0,0,0,0.3); border: 1px solid var(--border-color);">
            <div style="font-size: 16px; font-weight: 600; margin-bottom: 16px; text-align: center; color: var(--text-primary);">跳转到</div>
            <div style="display: flex; gap: 12px; align-items: center; justify-content: center; margin-bottom: 20px;">
                <select id="jump-year-select" style="padding: 6px 10px; border-radius: 8px; border: 1px solid var(--border-color); background: var(--primary-bg); color: var(--text-primary); font-size: 14px; flex: 1;">
                    ${Array.from({length: 21}, (_, i) => {
                        const y = currentYear - 10 + i;
                        return `<option value="${y}" ${y === currentYear ? 'selected' : ''}>${y}</option>`;
                    }).join('')}
                </select>
                <span style="font-size: 14px; color: var(--text-secondary);">年</span>
                <select id="jump-month-select" style="padding: 6px 10px; border-radius: 8px; border: 1px solid var(--border-color); background: var(--primary-bg); color: var(--text-primary); font-size: 14px; flex: 1;">
                    ${Array.from({length: 12}, (_, i) => {
                        return `<option value="${i}" ${i === currentMonth ? 'selected' : ''}>${i+1}月</option>`;
                    }).join('')}
                </select>
            </div>
            <div style="display: flex; gap: 12px; justify-content: flex-end;">
                <button id="jump-cancel-btn" style="padding: 8px 16px; border-radius: 10px; border: 1px solid var(--border-color); background: transparent; color: var(--text-secondary); cursor: pointer; font-size: 14px;">取消</button>
                <button id="jump-confirm-btn" style="padding: 8px 16px; border-radius: 10px; border: none; background: var(--accent-color); color: #fff; cursor: pointer; font-size: 14px;">确定</button>
            </div>
        </div>
    `;

    document.body.appendChild(panel);
    jumpPanel = panel;

    panel.querySelector('#jump-cancel-btn').addEventListener('click', () => {
        if (jumpPanel) {
            document.body.removeChild(jumpPanel);
            jumpPanel = null;
        }
    });

    panel.querySelector('#jump-confirm-btn').addEventListener('click', () => {
        const year = parseInt(panel.querySelector('#jump-year-select').value);
        const month = parseInt(panel.querySelector('#jump-month-select').value);
        _compRecordsCurrentDate = new Date(year, month, 1);
        // 重新渲染日历和统计
        renderCompanionCalendar();
        const panelStats = document.getElementById('comp-records-stats-panel');
        if (panelStats && panelStats.style.display !== 'none') {
            renderCompanionStats();
        }
        // 关闭面板
        if (jumpPanel) {
            document.body.removeChild(jumpPanel);
            jumpPanel = null;
        }
    });

    panel.addEventListener('click', (e) => {
        if (e.target === panel) {
            if (jumpPanel) {
                document.body.removeChild(jumpPanel);
                jumpPanel = null;
            }
        }
    });
}

function renderCompanionCalendar() {
    const year = _compRecordsCurrentDate.getFullYear();
    const month = _compRecordsCurrentDate.getMonth();

    const label = document.getElementById('comp-records-month-label');
    if (label) {
        label.textContent = year + '年' + String(month + 1).padStart(2, '0') + '月';
    }
    updateCompanionDateSelectors();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDayOfWeek = firstDay.getDay();
    const daysInMonth = lastDay.getDate();

    const records = getFilteredRecords();
    const monthRecords = records.filter(r => {
        if (!r.date) return false;
        const d = new Date(r.date + 'T00:00:00');
        return d.getFullYear() === year && d.getMonth() === month;
    });

    const dayMap = {};
    monthRecords.forEach(r => {
        const day = new Date(r.date + 'T00:00:00').getDate();
        if (!dayMap[day]) dayMap[day] = [];
        dayMap[day].push(r);
    });

    const grid = document.getElementById('comp-records-grid');
    if (!grid) return;

    let html = '';
    for (let i = 0; i < startDayOfWeek; i++) {
        html += `<div class="calendar-day empty"></div>`;
    }
    for (let d = 1; d <= daysInMonth; d++) {
        const hasRecord = dayMap[d] && dayMap[d].length > 0;
        const isToday = (d === new Date().getDate() &&
                         year === new Date().getFullYear() &&
                         month === new Date().getMonth());
        const recordsOfDay = dayMap[d] || [];

        // ★ 简化圆点：1条绿色，≥2条橙色，不再显示时长
        let dotHTML = '';
        if (hasRecord) {
            const count = recordsOfDay.length;
            const dotColor = count === 1 ? '#4CAF50' : '#FF9800';
            dotHTML = `<div style="display:flex;justify-content:center;margin-top:2px;">
                <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${dotColor};"></span>
            </div>`;
        }

        html += `
            <div class="calendar-day ${hasRecord ? 'has-record' : ''} ${isToday ? 'today' : ''}"
                 data-day="${d}" data-month="${month}" data-year="${year}"
                 style="${hasRecord ? 'cursor:pointer;' : ''}">
                <span>${d}</span>
                ${dotHTML}
            </div>
        `;
    }
    grid.innerHTML = html;

const statsEl = document.getElementById('comp-records-stats');
if (statsEl) {
    const totalDays = Object.keys(dayMap).length;
    const totalRecords = monthRecords.length;
    
    // 获取当月待办统计数据
    let todoStats = { total: 0, completed: 0 };
    if (typeof window.getMonthlyTodoStats === 'function') {
        try {
            todoStats = window.getMonthlyTodoStats(year, month);
        } catch (e) {
            console.warn('[companion] 获取待办统计失败:', e);
        }
    }
    
    statsEl.innerHTML = `
        <div>本月陪伴: ${totalDays} 天 · ${totalRecords} 次</div>
        <div style="font-size:12px;opacity:0.7;margin-top:2px;">本月待办: 共 ${todoStats.total} 项 完成 ${todoStats.completed} 项</div>
    `;
}

    grid.querySelectorAll('.calendar-day:not(.empty)').forEach(el => {
        el.addEventListener('click', function() {
            const day = parseInt(this.dataset.day);
            const month = parseInt(this.dataset.month);
            const year = parseInt(this.dataset.year);
            const dateStr = year + '-' + String(month + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0');
            showCompanionDayDetail(dateStr);
        });
    });
}

function populateCompanionYearMonthSelectors() {
    const yearSelect = document.getElementById('comp-records-year-select');
    const monthSelect = document.getElementById('comp-records-month-select');
    if (!yearSelect || !monthSelect) return;

    const currentYear = new Date().getFullYear();
    yearSelect.innerHTML = '';
    for (let y = currentYear - 10; y <= currentYear + 2; y++) {
        const opt = document.createElement('option');
        opt.value = y;
        opt.textContent = y;
        if (y === _compRecordsCurrentDate.getFullYear()) opt.selected = true;
        yearSelect.appendChild(opt);
    }
    monthSelect.innerHTML = '';
    for (let m = 0; m < 12; m++) {
        const opt = document.createElement('option');
        opt.value = m;
        opt.textContent = (m + 1) + '月';
        if (m === _compRecordsCurrentDate.getMonth()) opt.selected = true;
        monthSelect.appendChild(opt);
    }
}

function updateCompanionDateSelectors() {
    const yearSelect = document.getElementById('comp-records-year-select');
    const monthSelect = document.getElementById('comp-records-month-select');
    if (yearSelect) yearSelect.value = _compRecordsCurrentDate.getFullYear();
    if (monthSelect) monthSelect.value = _compRecordsCurrentDate.getMonth();
}

function showCompanionDayDetail(dateStr) {
    const modal = document.getElementById('companion-day-modal');
    if (!modal) {
        showToast('详情模块未加载', 'error');
        return;
    }
    const titleEl = document.getElementById('companion-day-title');
    if (titleEl) {
        const parts = dateStr.split('-');
        titleEl.textContent = parts[0] + '年' + parseInt(parts[1]) + '月' + parseInt(parts[2]) + '日';
    }
    const records = getFilteredRecords();
    const dayRecords = records.filter(r => r.date === dateStr);
    const listEl = document.getElementById('companion-day-records-list');
    if (!listEl) return;

    if (dayRecords.length === 0) {
        listEl.innerHTML = `<div style="text-align:center;padding:30px 0;color:var(--text-secondary);opacity:0.6;font-size:14px;">当日无记录</div>`;
    } else {
        let html = '';
        dayRecords.forEach((rec, index) => {
            const recordNum = index + 1;
            const statusText = rec.mode === 'completed' ? '✅ 顺利完成' :
                   rec.mode === 'interrupted' ? '⏸️ 选择终止' : '⚠️ 系统中断';

            html += `
                <div class="companion-record-entry" data-id="${rec.id}" style="padding:12px 16px;margin-bottom:8px;background:var(--primary-bg);border-radius:10px;border:1px solid var(--border-color);cursor:pointer;transition:background 0.2s;">
                    <div style="display:flex;justify-content:space-between;align-items:center;">
                        <span style="font-weight:600;font-size:15px;">睡眠记录${recordNum}：<span style="font-weight:400;color:var(--text-secondary);">${statusText}</span></span>
                        <i class="fas fa-chevron-right" style="color:var(--text-secondary);opacity:0.5;"></i>
                    </div>
                    <div style="font-size:12px;color:var(--text-secondary);margin-top:4px;">
                        开始：${window.formatDateTime(rec.startTime)} · 时长：${window.formatDuration(rec.duration)}
                    </div>
                </div>
            `;
        });
        listEl.innerHTML = html;
        listEl.querySelectorAll('.companion-record-entry').forEach(el => {
            el.addEventListener('click', function() {
                const id = this.dataset.id;
                showCompanionRecordDetail(id);
            });
        });
    }

    // ★ 修复右上角关闭键
    const closeTop = document.getElementById('close-companion-day-modal');
    if (closeTop) {
        closeTop.replaceWith(closeTop.cloneNode(true));
        const newCloseTop = document.getElementById('close-companion-day-modal');
        if (newCloseTop) {
            newCloseTop.addEventListener('click', function() {
                hideModal(modal);
            });
        }
    }

    // ★ 隐藏右下角关闭按钮
    const closeBottom = document.getElementById('close-companion-day-modal-btn');
    if (closeBottom) {
        closeBottom.style.display = 'none';
    }

    showModal(modal);
}

// ============================================================
// ★ 评级计算函数
// ============================================================
function calculateRating(startTimeISO, durationMs) {
    // 只对已完成记录评级
    const startDate = new Date(startTimeISO);
    const hours = startDate.getHours();
    const minutes = startDate.getMinutes();
    const totalMinutes = hours * 60 + minutes;
    
    let stars = 3; // 初始3星
    
    // 1. 入睡时间评级（保持不变）
    const timeInMinutes = totalMinutes;
    
    if (timeInMinutes >= 1260 && timeInMinutes < 1380) {
        // 21:00 ~ 23:00（不含）
        stars += 2;
    } else if (timeInMinutes >= 1380 && timeInMinutes < 1410) {
        // 23:00 ~ 23:30（不含）
        stars += 1;
    } else if (timeInMinutes >= 1410 && timeInMinutes < 1440) {
        // 23:30 ~ 00:00（不含）：不加不减
    } else if (timeInMinutes >= 0 && timeInMinutes < 30) {
        // 00:00 ~ 00:30（不含）
        stars -= 1;
    } else if (timeInMinutes >= 30 && timeInMinutes < 60) {
        // 00:30 ~ 01:00（不含）
        stars -= 2;
    } else if (timeInMinutes >= 60 && timeInMinutes < 420) {
        // 01:00 ~ 07:00（不含）
        stars -= 3;
    }
    // 其他时间（7:00 ~ 21:00）不加不减

    // 2. 睡眠时长评级（单位：小时）
    const durationHours = durationMs / (1000 * 60 * 60);
    
    if (durationHours >= 8) {
        stars += 2;
    } else if (durationHours >= 7.5 && durationHours < 8) {
        stars += 1;
    } else if (durationHours >= 7 && durationHours < 7.5) {
        // 不加不减
    } else if (durationHours >= 6.5 && durationHours < 7) {
        stars -= 1;
    } else if (durationHours >= 6 && durationHours < 6.5) {
        stars -= 2;
    } else if (durationHours < 6) {
        stars -= 3;
    }
    
    // 限制范围 0~7
    stars = Math.max(0, Math.min(7, stars));
    
    return stars;
}

// 生成星级显示HTML
function renderStars(rating) {
    if (rating === null || rating === undefined) return '';
    if (rating === 0) return '<span style="font-size:16px;color:var(--accent-color);">0颗★</span>';
    return `<span style="font-size:16px;color:var(--accent-color);letter-spacing:1px;">${'★'.repeat(rating)}</span>`;
}

function showCompanionRecordDetail(recordId) {
    const records = getFilteredRecords();
    const record = records.find(r => r.id === recordId);
    if (!record) {
        showToast('记录不存在', 'error');
        return;
    }
    const modal = document.getElementById('companion-record-detail-modal');
    if (!modal) {
        showToast('详情模块未加载', 'error');
        return;
    }
    // 标题
    const titleEl = document.getElementById('companion-record-detail-title');
    if (titleEl) {
        const dateStr = record.date;
        const parts = dateStr.split('-');
        titleEl.textContent = parts[0] + '年' + parseInt(parts[1]) + '月' + parseInt(parts[2]) + '日';
    }

    const contentEl = document.getElementById('companion-record-detail-content');
    if (!contentEl) return;

    const isSystemInterrupt = (record.mode === 'system_interrupt');
    const isCompleted = (record.mode === 'completed');
    const isInterrupted = (record.mode === 'interrupted');
    
    let modeText = isCompleted ? '✅ 顺利完成' :
                   isInterrupted ? '⏸️ 选择终止' : '⚠️ 系统中断';

    // 可编辑字段
    let fieldLabel = '';
    let fieldKey = '';
    let fieldValue = '';
    if (isCompleted) {
        fieldLabel = '感想记录';
        fieldKey = 'reflection';
        fieldValue = record.reflection || '';
    } else if (isInterrupted) {
        fieldLabel = '终止原因';
        fieldKey = 'terminateReason';
        fieldValue = record.terminateReason || '';
    } else if (isSystemInterrupt) {
        fieldLabel = '感想记录';
        fieldKey = 'reflection';
        fieldValue = record.reflection || '';
    }

    const startTimeFormatted = window.formatDateTime(record.startTime);
    let endTimeDisplay = record.endTime ? window.formatDateTime(record.endTime) : '--:--';
    const canEditEndTime = (record.mode === 'system_interrupt');

    // ★ 评级计算（仅对顺利完成显示）
    let ratingHTML = '';
    if (isCompleted) {
        const stars = calculateRating(record.startTime, record.duration);
        ratingHTML = `
            <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
                <span style="font-weight:600;color:var(--text-primary);">评价</span>
                <span>${renderStars(stars)}</span>
            </div>
        `;
    }

    // ★ 构建最终 HTML
    let htmlParts = [];

    // 1. 状态行（含切换箭头）
    let statusHTML = '';
    if (canEditEndTime) {
        statusHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                <span style="font-weight:600;color:var(--text-primary);">状态</span>
                <span style="display:flex;align-items:center;gap:6px;">
                    <span>${modeText}</span>
                    <span id="status-arrow-${recordId}" style="cursor:pointer;color:var(--accent-color);font-size:14px;transition:transform 0.2s;" 
                          title="切换为「顺利完成」" onclick="confirmConvertToCompleted('${recordId}')">→</span>
                </span>
            </div>
        `;
    } else {
        statusHTML = `
            <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
                <span style="font-weight:600;color:var(--text-primary);">状态</span>
                <span>${modeText}</span>
            </div>
        `;
    }
    htmlParts.push(statusHTML);

    // 2. 开始时间
    htmlParts.push(`
        <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
            <span style="font-weight:600;color:var(--text-primary);">开始时间</span>
            <span>${startTimeFormatted}</span>
        </div>
    `);

    // 3. 结束时间（可编辑或只读）
    if (canEditEndTime) {
        const currentEndTime = record.endTime || new Date().toISOString();
        const localValue = currentEndTime.substring(0, 16);
        const startLocal = record.startTime ? new Date(record.startTime).toISOString().substring(0, 16) : '';
        htmlParts.push(`
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                <span style="font-weight:600;color:var(--text-primary);">结束时间</span>
                <span id="endtime-display-${recordId}" style="cursor:pointer;color:var(--accent-color);text-decoration:underline dotted;" 
                      onclick="document.getElementById('endtime-edit-${recordId}').style.display='inline-flex'; this.style.display='none';">
                    ${endTimeDisplay}
                </span>
                <span id="endtime-edit-${recordId}" style="display:none;align-items:center;gap:6px;">
                    <input type="datetime-local" id="endtime-edit-${recordId}-input" value="${localValue}" min="${startLocal}"
                           style="padding:4px 6px;border:1px solid var(--border-color);border-radius:6px;background:var(--primary-bg);color:var(--text-primary);font-size:13px;">
                    <button id="endtime-confirm-${recordId}" style="padding:4px 10px;border:none;border-radius:6px;background:var(--accent-color);color:#fff;cursor:pointer;font-size:12px;">✓</button>
                    <button onclick="document.getElementById('endtime-edit-${recordId}').style.display='none';document.getElementById('endtime-display-${recordId}').style.display='inline';" 
                            style="padding:4px 8px;border:none;border-radius:6px;background:var(--border-color);color:var(--text-secondary);cursor:pointer;font-size:12px;">✕</button>
                </span>
            </div>
        `);
    } else {
        htmlParts.push(`
            <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
                <span style="font-weight:600;color:var(--text-primary);">结束时间</span>
                <span>${endTimeDisplay}</span>
            </div>
        `);
    }

    // 4. 睡眠时长
    const durationId = 'duration-display-' + recordId;
    htmlParts.push(`
        <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
            <span style="font-weight:600;color:var(--text-primary);">睡眠时长</span>
            <span id="${durationId}">${window.formatDuration(record.duration)}</span>
        </div>
    `);

    // 5. ★ 评级（仅顺利完成显示）
    if (isCompleted) {
        htmlParts.push(ratingHTML);
    }

    // 6. 感想/终止原因（可编辑）
    if (fieldKey) {
        const displayId = 'field-display-' + recordId;
        const editId = 'field-edit-' + recordId;
        const displayText = fieldValue || '暂无记录';
        htmlParts.push(`
            <div style="margin-top:14px; border-top: 1px solid var(--border-color); padding-top:12px;">
                <div style="font-weight:600; color:var(--text-primary); margin-bottom:6px;">${fieldLabel}</div>
                <div id="${displayId}" style="font-size:13px; color:var(--text-secondary); padding:6px 8px; border-radius:6px; cursor:pointer; background:var(--primary-bg); min-height:24px; transition:background 0.15s;" 
                     onclick="document.getElementById('${editId}').style.display='block'; this.style.display='none'; document.getElementById('${editId}').focus();">
                    ${displayText}
                </div>
                <textarea id="${editId}" style="display:none; width:100%; padding:8px 10px; border-radius:8px; border:1px solid var(--accent-color); background:var(--primary-bg); color:var(--text-primary); font-family:var(--font-family); font-size:13px; resize:vertical; min-height:60px; box-sizing:border-box; margin-top:4px;" 
                          rows="3" placeholder="点击输入…">${fieldValue}</textarea>
            </div>
        `);
    }

    // 组装到主容器
    contentEl.innerHTML = `
        <div style="background:var(--secondary-bg);padding:16px;border-radius:12px;border:1px solid var(--border-color);">
            ${htmlParts.join('')}
        </div>
    `;

    // ★ 绑定结束时间确认事件
    if (canEditEndTime) {
        const confirmBtn = document.getElementById('endtime-confirm-' + recordId);
        if (confirmBtn) {
            confirmBtn.onclick = function() {
                const input = document.getElementById('endtime-edit-' + recordId + '-input');
                if (!input) return;
                const newEndTime = input.value;
                if (!newEndTime) {
                    showToast('请选择有效时间', 'warning');
                    return;
                }
                const endDate = new Date(newEndTime);
                if (isNaN(endDate.getTime())) {
                    showToast('时间格式无效', 'error');
                    return;
                }
                const startDate = new Date(record.startTime);
                if (endDate < startDate) {
                    showToast('结束时间不能早于开始时间', 'warning');
                    return;
                }
                const endISO = endDate.toISOString();
                let allRecords = [];
                try {
                    const data = localStorage.getItem('companion_records');
                    allRecords = data ? JSON.parse(data) : [];
                } catch (e) { allRecords = []; }
                const idx = allRecords.findIndex(r => r.id === recordId);
                if (idx === -1) {
                    showToast('记录不存在', 'error');
                    return;
                }
                const newDuration = Math.max(0, endDate - startDate);
                allRecords[idx].endTime = endISO;
                allRecords[idx].duration = newDuration;
                try {
                    localStorage.setItem('companion_records', JSON.stringify(allRecords));
                    window._companionRecords = allRecords;
                } catch (e) {
                    showToast('保存失败', 'error');
                    return;
                }
                showToast('结束时间已更新', 'success');
                showCompanionRecordDetail(recordId);
            };
        }
    }

    // ★ 底部按钮
    const footer = modal.querySelector('.modal-buttons');
    if (footer) {
        footer.innerHTML = '';

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'modal-btn modal-btn-danger';
        deleteBtn.textContent = '删除记录';
        deleteBtn.style.background = '#e74c3c';
        deleteBtn.style.color = '#fff';
        deleteBtn.style.border = 'none';
        deleteBtn.style.padding = '8px 16px';
        deleteBtn.style.borderRadius = '6px';
        deleteBtn.style.cursor = 'pointer';
        deleteBtn.onclick = function() {
            if (confirm('确定要删除这条陪伴记录吗？此操作不可恢复！')) {
                const allRecords = window._companionRecords || [];
                const index = allRecords.findIndex(r => r.id === recordId);
                if (index > -1) {
                    allRecords.splice(index, 1);
                    try {
                        localStorage.setItem('companion_records', JSON.stringify(allRecords));
                        window._companionRecords = allRecords;
                    } catch (e) {}
                    hideModal(modal);
                    hideModal(document.getElementById('companion-day-modal'));
                    renderCompanionCalendar();
                    const panelStats = document.getElementById('comp-records-stats-panel');
                    if (panelStats && panelStats.style.display !== 'none') {
                        renderCompanionStats();
                    }
                    showToast('记录已删除', 'success');
                }
            }
        };
        footer.appendChild(deleteBtn);

        if (fieldKey) {
            const saveBtn = document.createElement('button');
            saveBtn.className = 'modal-btn modal-btn-primary';
            saveBtn.textContent = '保存';
            saveBtn.style.marginLeft = 'auto';
            saveBtn.onclick = function() {
                const editId = 'field-edit-' + recordId;
                const textarea = document.getElementById(editId);
                if (textarea) {
                    const newValue = textarea.value.trim();
                    let allRecords = [];
                    try {
                        const data = localStorage.getItem('companion_records');
                        allRecords = data ? JSON.parse(data) : [];
                    } catch (e) { allRecords = []; }
                    const idx = allRecords.findIndex(r => r.id === recordId);
                    if (idx !== -1) {
                        allRecords[idx][fieldKey] = newValue;
                        try {
                            localStorage.setItem('companion_records', JSON.stringify(allRecords));
                            window._companionRecords = allRecords;
                        } catch (e) {
                            showToast('保存失败，请检查存储空间', 'error');
                            return;
                        }
                        showToast('已保存 ✓', 'success');
                        showCompanionRecordDetail(recordId);
                    } else {
                        showToast('记录不存在，无法保存', 'error');
                    }
                }
            };
            footer.appendChild(saveBtn);
        }
    }

    // ★ 修复右上角关闭键
    const closeBtn = document.getElementById('close-companion-record-detail-modal');
    if (closeBtn) {
        closeBtn.replaceWith(closeBtn.cloneNode(true));
        const newCloseBtn = document.getElementById('close-companion-record-detail-modal');
        if (newCloseBtn) {
            newCloseBtn.addEventListener('click', function() {
                hideModal(modal);
            });
        }
    }

    showModal(modal);
}

// ★ 辅助函数：系统中断转为顺利完成
window.confirmConvertToCompleted = function(recordId) {
    if (!confirm('确定要将该记录状态改为「顺利完成」吗？\n更改后将无法再编辑结束时间。')) {
        return;
    }
    // 从 localStorage 读取完整记录
    let allRecords = [];
    try {
        const data = localStorage.getItem('companion_records');
        allRecords = data ? JSON.parse(data) : [];
    } catch (e) { allRecords = []; }
    const idx = allRecords.findIndex(r => r.id === recordId);
    if (idx === -1) {
        showToast('记录不存在', 'error');
        return;
    }
    const record = allRecords[idx];
    if (record.mode !== 'system_interrupt') {
        showToast('该记录不是系统中断状态，无法转换', 'warning');
        return;
    }
    // 修改 mode 和 status
    record.mode = 'completed';
    record.status = '完成陪伴';
    // 清除系统中断标志
    record.isSystemInterrupt = false;
    // 将 interruptReason 清空（可选）
    record.interruptReason = '';
    // 保存
    try {
        localStorage.setItem('companion_records', JSON.stringify(allRecords));
        window._companionRecords = allRecords;
    } catch (e) {
        showToast('保存失败', 'error');
        return;
    }
    showToast('已切换为「顺利完成」', 'success');
    // 刷新详情
    showCompanionRecordDetail(recordId);
};