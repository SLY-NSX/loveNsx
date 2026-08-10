/**
 * companion.js - 陪伴睡眠功能（完整修复版）
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

    let audioElement = null;
    let _isSoftLooping = false;   // ★ 防止重复触发软循环
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
                    // ★ 修复：确保每个条目都有 id
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
                        saveMusicList(); // 保存修复后的数据
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
    // 音频播放
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

        // 创建音频上下文和 GainNode
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        if (ctx.state === 'suspended') ctx.resume().catch(() => {});
        const source = ctx.createMediaElementSource(audioElement);
        gainNode = ctx.createGain();
        // 先给一个默认值，稍后 applyVolume 覆盖
        gainNode.gain.value = 0.2;
        source.connect(gainNode);
        gainNode.connect(ctx.destination);

        // 保存上下文以便后续使用
        session._audioCtx = ctx;

        // ★★★ 新增：应用当前音量（根据歌曲类型和用户设置） ★★★
        applyVolume();

        audioElement.addEventListener('canplaythrough', function onReady() {
            audioElement.removeEventListener('canplaythrough', onReady);
            console.log('[companion] 音频加载完成，开始播放');
            playMusic();
        });

        audioElement.addEventListener('error', function (e) {
            if (isStopping) {
                // 正在主动停止，不显示错误
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
    // 先确保增益为 0，准备淡入
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
            // 淡入到目标音量
            if (gainNode && session._audioCtx && session._audioCtx.state !== 'closed') {
                const ctx = session._audioCtx;
                // 计算目标增益（与 applyVolume 保持一致）
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
    // 移除旧监听避免重复绑定
    audioElement.removeEventListener('timeupdate', _softLoopHandler);
    _isSoftLooping = false;
    audioElement.addEventListener('timeupdate', _softLoopHandler);
}

// 软循环处理函数（单独定义以便移除）
function _softLoopHandler() {
    if (isStopping) return;
    if (!audioElement || !audioElement.duration) return;
    if (_isSoftLooping) return;
    
    const duration = audioElement.duration;
    const current = audioElement.currentTime;
    // 在距离结尾 0.8 秒时触发
    if (current < duration - 0.8) return;
    
    _isSoftLooping = true;
    
    // 计算当前目标增益（与 applyVolume 保持一致）
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
    const fadeDuration = 0.3; // 300ms 淡出
    
    try {
        // 淡出
        gainNode.gain.cancelScheduledValues(now);
        gainNode.gain.setValueAtTime(targetGain, now);
        gainNode.gain.linearRampToValueAtTime(0, now + fadeDuration);
    } catch (e) {
        _isSoftLooping = false;
        return;
    }
    
    // 淡出完成后跳转并淡入
    setTimeout(() => {
        if (isStopping || !audioElement) {
            _isSoftLooping = false;
            return;
        }
        try {
            // 跳转到开头
            audioElement.currentTime = 0;
            // 重新播放
            audioElement.play().catch(() => {});
            // 淡入
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
    isStopping = true;   // 设为 true，直到下次 initAudioElement 重置
    _isSoftLooping = false;   // ★ 重置软循环标志
    if (audioElement) {
        try {
            audioElement.removeEventListener('timeupdate', _softLoopHandler); // ★ 移除监听
            audioElement.pause();
            audioElement.src = '';
            audioElement.load();
        } catch (e) {}
        audioElement = null;
    }
    // 断开 GainNode 和上下文
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
        // ★★★ 清理定时器和监听器（移到这里） ★★★
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
    const fc = document.getElementById('companion-floating-control');
    if (fc) fc.style.display = 'none';
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

        // ---- 事件绑定：使用事件委托 ----
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

    // 只在设置界面时刷新列表
    if (currentUI === 'setup') {
        renderSetupUI();
    } else if (currentUI === 'sleeping' || currentUI === 'ready_to_start') {
        // 睡眠界面只更新悬浮控件的标题
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
    // 睡眠计时
    // ============================================================
function startSleepTracking() {
    if (session.state === STATE.ENDED) return;

    // ★ 将 overlay 声明在函数顶部，仅声明一次 ★
    const overlay = document.getElementById('companion-overlay');

    // ★★★ 清理之前的变暗定时器和监听器 ★★★
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

    // ★ 继续使用顶部的 overlay 变量，不再重复声明 ★
    if (overlay) {
        // 移除已有的 dim 类
        overlay.classList.remove('idle-dim');
        // 清除之前的定时器
        if (window._companionIdleTimer) {
            clearTimeout(window._companionIdleTimer);
        }
        // 定义重置函数
        const resetIdleTimer = () => {
            overlay.classList.remove('idle-dim');
            if (window._companionIdleTimer) {
                clearTimeout(window._companionIdleTimer);
            }
            window._companionIdleTimer = setTimeout(() => {
                overlay.classList.add('idle-dim');
            }, 10000);
        };
        // 移除旧监听器（防止重复绑定）
        if (overlay._resetIdleTimer) {
            overlay.removeEventListener('touchstart', overlay._resetIdleTimer);
            overlay.removeEventListener('click', overlay._resetIdleTimer);
        }
        // 绑定事件
        overlay.addEventListener('touchstart', resetIdleTimer, { passive: true });
        overlay.addEventListener('click', resetIdleTimer);
        // 保存引用以便清理
        overlay._resetIdleTimer = resetIdleTimer;
        // 立即启动计时器
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
        let fc = document.getElementById('companion-floating-control');
        if (!fc) {
            fc = document.createElement('div');
            fc.id = 'companion-floating-control';
            fc.innerHTML = `
                <span class="fc-title" id="fc-title">无音乐</span>
                <div class="fc-volume-wrap">
                    <input type="range" min="0" max="150" value="20" class="fc-volume-slider" id="fc-volume-slider">
                    <span class="fc-volume-label" id="fc-volume-label">20%</span>
                </div>
                <button class="fc-btn" id="fc-play-btn"><i class="fas fa-play"></i></button>
                <button class="fc-btn" id="fc-select-btn"><i class="fas fa-list"></i></button>
            `;
            const overlay = document.getElementById('companion-overlay');
            if (overlay) overlay.appendChild(fc);
            else document.body.appendChild(fc);

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
                    // 应用音量（根据当前歌曲类型计算增益）
                    applyVolume();
                });
            }

        updateFloatingControlUI();
        fc.style.display = 'flex';

        let idleTimer = null;

        function resetIdleTimer() {
            if (idleTimer) clearTimeout(idleTimer);
            fc.classList.remove('dim');
            idleTimer = setTimeout(() => {
                fc.classList.add('dim');
            }, 10000);
        }

        // 监听交互事件
        fc.addEventListener('mouseenter', resetIdleTimer);
        fc.addEventListener('mouseleave', () => {
            if (idleTimer) clearTimeout(idleTimer);
            idleTimer = setTimeout(() => {
                fc.classList.add('dim');
            }, 10000);
        });
        fc.addEventListener('touchstart', resetIdleTimer);

        // 点击内部按钮或滑块时也重置
        fc.querySelectorAll('.fc-btn, .fc-volume-slider').forEach(el => {
            el.addEventListener('pointerdown', resetIdleTimer);
        });

        // 初始启动计时器
        resetIdleTimer();

    }
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
        // 读取当前实际增益
        const currentGain = gainNode.gain.value;
        // 为了显示更直观，我们显示当前增益对应的百分比（乘以100）
        const percent = Math.round(currentGain * 100);
        // 更新滑块位置（滑块仍基于用户设定的百分比，所以这里不修改滑块值）
        // 只更新标签显示
        if (volLabel) {
            // 显示实际百分比
            volLabel.textContent = Math.min(150, percent) + '%';
        }
    }
}

    // 应用当前音量设置（根据用户设定的百分比和歌曲倍率计算实际增益）
    function applyVolume() {
        if (!gainNode) return;
        const boost = getMusicBoost(session.musicUrl);
        const rawGain = (session.volumePercent / 100) * boost;
        // 为避免过大破音，暂时不限制上限，但建议限制在 1.5 以内
        const finalGain = Math.min(rawGain, 4.0); // 可根据需要调整上限
        gainNode.gain.value = finalGain;
        // 更新 UI 显示
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
    // 计时器
    // ============================================================
    function startTimer() {
        if (session.rafId) cancelAnimationFrame(session.rafId);
        const start = Date.now();
        const baseElapsed = session.elapsed || 0;

        function tick() {
            if (session.state !== STATE.SLEEPING) return;
            const now = Date.now();
            session.elapsed = baseElapsed + (now - start);
            session.lastAliveTime = now;
            updateSleepTimerUI();

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
// 结束会话
// ============================================================
function endSession(mode) {
    if (session.isEnding) return;
    if (session.state !== STATE.SLEEPING) return;

    session.isEnding = true;
    stopTimer();
    stopAlarm();

    const elapsedMs = session.elapsed || 0;
    const elapsedMinutes = elapsedMs / (60 * 1000);

    // 完成陪伴和选择终止：不足20分钟不记录
    if (elapsedMinutes < MIN_VALID_MINUTES && mode !== 'system_interrupt') {
        stopMusic();
        releaseWakeLock();
        hideOverlay();
        showToast(`陪伴时长不足${MIN_VALID_MINUTES}分钟，不生成记录`, 'info');
        resetSession();
        session.isEnding = false;
        currentUI = 'idle';
        return;
    }

    const startDate = session.startTime ? new Date(session.startTime) : new Date();
    const endDate = new Date();
    const durationMs = elapsedMs;

    // ★ 修改：status 根据 mode 显示不同文案
    let statusText = '完成陪伴';
    if (mode === 'interrupted') statusText = '选择终止';
    else if (mode === 'completed') statusText = '完成陪伴';

    const record = {
        id: 'comp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        date: startDate.toISOString().split('T')[0],
        startTime: startDate.toISOString(),
        endTime: endDate.toISOString(),
        duration: durationMs,
        mode: mode,
        soundType: session.musicTitle || '无音乐',
        status: statusText,
        interruptReason: '',
        feeling: '',                       // ★ 新增：感受字段
        isSystemInterrupt: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };

    // ★ 修改：使用新的弹窗函数
    if (mode === 'interrupted') {
        hideOverlay();
        showInterruptToast(record, () => {
            saveRecordAndCleanup(record);
        });
        return;
    }

    if (mode === 'completed') {
        hideOverlay();
        showCompletionToast(record, () => {
            saveRecordAndCleanup(record);
        });
        return;
    }

    stopMusic();
    releaseWakeLock();
    hideOverlay();
    resetSession();
    session.isEnding = false;
    currentUI = 'idle';
}

    // ============================================================
    // 记录保存与清理
    // ============================================================
    function saveRecordAndCleanup(record) {
        try {
            // 1. 直接更新内存数据
            if (!window._companionRecords) window._companionRecords = [];
            window._companionRecords.push(record);
            // 按日期排序（可选）
            window._companionRecords.sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));

            // 2. 保存到 localStorage
            const key = 'companion_records';
            localStorage.setItem(key, JSON.stringify(window._companionRecords));

            showToast('陪伴记录已保存 ✓', 'success');
        } catch (e) {
            console.error('[companion] 保存记录失败:', e);
            showToast('保存失败，请重试', 'error');
        } finally {
            // 3. 清理会话
            stopMusic();
            stopAlarm();
            releaseWakeLock();
            clearAccident();
            resetSession();
            session.isEnding = false;
            currentUI = 'idle';

            // 4. 如果陪伴记录模态框已打开，刷新日历
            const modal = document.getElementById('companion-records-modal');
            if (modal && modal.style.display !== 'none') {
                renderCompanionCalendar();
            }
        }
    }

// ============================================================
// 完成陪伴 - 弹窗（含感受输入）
// ============================================================
function showCompletionToast(record, onSave) {
    // 创建主弹窗
    const toast = document.createElement('div');
    toast.className = 'companion-toast open';
    toast.id = 'companion-toast-temp';
    toast.innerHTML = `
        <div class="toast-box">
            <div class="toast-title">🌙 好梦</div>
            <div class="toast-body">
                <div>开始时间：${formatDateTime(record.startTime)}</div>
                <div>睡眠时长：${formatDuration(record.duration)}</div>
                <div>结束时间：${formatDateTime(record.endTime)}</div>
                ${record.feeling ? `<div style="margin-top:10px;padding:8px 12px;background:rgba(var(--accent-color-rgb),0.08);border-radius:8px;font-style:italic;color:var(--text-secondary);">💭 ${record.feeling}</div>` : ''}
            </div>
            <div style="display:flex;gap:10px;margin-top:12px;flex-wrap:wrap;justify-content:center;">
                <button class="toast-btn" id="toast-feeling-btn" style="background:rgba(var(--accent-color-rgb),0.15);color:var(--text-primary);border:1px solid rgba(var(--accent-color-rgb),0.2);">💭 感受</button>
                <button class="toast-btn" id="toast-confirm-btn">确定</button>
            </div>
        </div>
    `;
    document.body.appendChild(toast);

    const confirmBtn = toast.querySelector('#toast-confirm-btn');
    const feelingBtn = toast.querySelector('#toast-feeling-btn');

    // 确定：保存并关闭
    confirmBtn.addEventListener('click', () => {
        document.body.removeChild(toast);
        if (onSave) onSave();
    });

    // 感受：弹出输入框
    feelingBtn.addEventListener('click', () => {
        showFeelingInput(record, (newFeeling) => {
            record.feeling = newFeeling;
            // 更新弹窗显示
            const body = toast.querySelector('.toast-body');
            const existing = body.querySelector('.feeling-display');
            if (existing) existing.remove();
            if (newFeeling) {
                const div = document.createElement('div');
                div.className = 'feeling-display';
                div.style.cssText = 'margin-top:10px;padding:8px 12px;background:rgba(var(--accent-color-rgb),0.08);border-radius:8px;font-style:italic;color:var(--text-secondary);';
                div.textContent = '💭 ' + newFeeling;
                body.appendChild(div);
            }
        });
    });

    // 点击背景不关闭
    toast.addEventListener('click', (e) => {
        if (e.target === toast) {
            // 不关闭
        }
    });
}

// ============================================================
// 选择终止 - 弹窗（含原因输入）
// ============================================================
function showInterruptToast(record, onSave) {
    const toast = document.createElement('div');
    toast.className = 'companion-toast open';
    toast.id = 'companion-toast-temp';
    toast.innerHTML = `
        <div class="toast-box">
            <div class="toast-title">⏸️ 选择终止</div>
            <div class="toast-body">
                <div>开始时间：${formatDateTime(record.startTime)}</div>
                <div>睡眠时长：${formatDuration(record.duration)}</div>
                <div>结束时间：${formatDateTime(record.endTime)}</div>
                ${record.interruptReason ? `<div style="margin-top:10px;padding:8px 12px;background:rgba(255,150,0,0.08);border-radius:8px;font-style:italic;color:var(--text-secondary);">📝 ${record.interruptReason}</div>` : ''}
            </div>
            <div style="display:flex;gap:10px;margin-top:12px;flex-wrap:wrap;justify-content:center;">
                <button class="toast-btn" id="toast-reason-btn" style="background:rgba(255,150,0,0.15);color:var(--text-primary);border:1px solid rgba(255,150,0,0.2);">📝 原因</button>
                <button class="toast-btn" id="toast-confirm-btn">确定</button>
            </div>
        </div>
    `;
    document.body.appendChild(toast);

    const confirmBtn = toast.querySelector('#toast-confirm-btn');
    const reasonBtn = toast.querySelector('#toast-reason-btn');

    confirmBtn.addEventListener('click', () => {
        document.body.removeChild(toast);
        if (onSave) onSave();
    });

    reasonBtn.addEventListener('click', () => {
        showReasonInput(record, (newReason) => {
            record.interruptReason = newReason;
            const body = toast.querySelector('.toast-body');
            const existing = body.querySelector('.reason-display');
            if (existing) existing.remove();
            if (newReason) {
                const div = document.createElement('div');
                div.className = 'reason-display';
                div.style.cssText = 'margin-top:10px;padding:8px 12px;background:rgba(255,150,0,0.08);border-radius:8px;font-style:italic;color:var(--text-secondary);';
                div.textContent = '📝 ' + newReason;
                body.appendChild(div);
            }
        });
    });

    toast.addEventListener('click', (e) => {
        if (e.target === toast) {
            // 不关闭
        }
    });
}

// ============================================================
// 感受输入对话框
// ============================================================
function showFeelingInput(record, onSave) {
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
            <div style="font-size:18px;font-weight:700;margin-bottom:8px;color:var(--text-primary,#fff);">💭 记录感受</div>
            <div style="font-size:13px;color:var(--text-secondary);margin-bottom:14px;">分享你此刻的心情吧</div>
            <textarea id="feeling-input" rows="4" placeholder="今天的陪伴感受..." style="width:100%;padding:10px 14px;border-radius:12px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.05);color:var(--text-primary,#fff);font-size:14px;resize:vertical;font-family:var(--font-family);box-sizing:border-box;">${record.feeling || ''}</textarea>
            <div style="display:flex;gap:10px;margin-top:12px;">
                <button class="companion-btn secondary" id="feeling-cancel" style="flex:1;padding:10px;font-size:14px;min-width:unset;">取消</button>
                <button class="companion-btn" id="feeling-confirm" style="flex:2;padding:10px;font-size:14px;min-width:unset;">确定</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    const textarea = overlay.querySelector('#feeling-input');
    const confirmBtn = overlay.querySelector('#feeling-confirm');
    const cancelBtn = overlay.querySelector('#feeling-cancel');

    const close = (save) => {
        if (save && onSave) {
            onSave(textarea.value.trim());
        }
        document.body.removeChild(overlay);
    };

    confirmBtn.addEventListener('click', () => close(true));
    cancelBtn.addEventListener('click', () => close(false));
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) close(false);
    });
    setTimeout(() => textarea?.focus(), 100);
}

// ============================================================
// 原因输入对话框
// ============================================================
function showReasonInput(record, onSave) {
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
            <div style="font-size:18px;font-weight:700;margin-bottom:8px;color:var(--text-primary,#fff);">📝 中断原因</div>
            <div style="font-size:13px;color:var(--text-secondary);margin-bottom:14px;">可以简单说明一下中断的原因</div>
            <textarea id="reason-input" rows="4" placeholder="例如：被电话吵醒了..." style="width:100%;padding:10px 14px;border-radius:12px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.05);color:var(--text-primary,#fff);font-size:14px;resize:vertical;font-family:var(--font-family);box-sizing:border-box;">${record.interruptReason || ''}</textarea>
            <div style="display:flex;gap:10px;margin-top:12px;">
                <button class="companion-btn secondary" id="reason-cancel" style="flex:1;padding:10px;font-size:14px;min-width:unset;">取消</button>
                <button class="companion-btn" id="reason-confirm" style="flex:2;padding:10px;font-size:14px;min-width:unset;">确定</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    const textarea = overlay.querySelector('#reason-input');
    const confirmBtn = overlay.querySelector('#reason-confirm');
    const cancelBtn = overlay.querySelector('#reason-cancel');

    const close = (save) => {
        if (save && onSave) {
            onSave(textarea.value.trim());
        }
        document.body.removeChild(overlay);
    };

    confirmBtn.addEventListener('click', () => close(true));
    cancelBtn.addEventListener('click', () => close(false));
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) close(false);
    });
    setTimeout(() => textarea?.focus(), 100);
}

    // ============================================================
    // 遗言机制
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

    // 暴露给 app.js
    window._backupCompanionAccident = backupAccident;

    window.checkCompanionAccident = function () {
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

window.restoreCompanionAccident = function (accidentData) {
    if (!accidentData) return;

    let durationMs = 0;
    let startTime = null;
    let endTime = new Date();

    if (accidentData.state === STATE.SLEEPING && accidentData.startTime) {
        startTime = new Date(accidentData.startTime);
        const lastAlive = accidentData.lastAliveTime || accidentData.startTime;
        durationMs = Math.max(0, lastAlive - accidentData.startTime);
    } else if (accidentData.state === STATE.COUNTDOWN || accidentData.state === STATE.READY_TO_START) {
        // 倒计时或待开始状态被中断 → 不生成记录
        clearAccident();
        resetSession();
        showToast('陪伴尚未正式开始，不生成记录', 'info');
        return;
    }

    // ★ 系统中断不参与不足20分钟不记录的判断 ★
    // 只要有睡眠状态，即使不足20分钟也记录

    const record = {
        id: 'comp_sys_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        date: startTime ? startTime.toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        startTime: startTime ? startTime.toISOString() : new Date().toISOString(),
        endTime: endTime.toISOString(),
        duration: durationMs,
        mode: 'system_interrupt',
        soundType: accidentData.musicTitle || '未知',
        status: '系统中断',
        interruptReason: '',
        feeling: '',
        isSystemInterrupt: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };

    // ★ Step 1: 先保存记录 ★
    let saved = false;
    try {
        // 直接更新内存数据
        if (!window._companionRecords) window._companionRecords = [];
        window._companionRecords.push(record);
        window._companionRecords.sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));

        const key = 'companion_records';
        localStorage.setItem(key, JSON.stringify(window._companionRecords));
        saved = true;
    } catch (e) {
        console.error('[companion] 补录失败:', e);
    }

    // ★ Step 2: 清除遗言（无论是否保存成功） ★
    clearAccident();
    resetSession();
    currentUI = 'idle';

    if (!saved) {
        showToast('系统中断记录保存失败，请检查存储空间', 'error');
        return;
    }

    // ★ Step 3: 弹窗提示用户是否编辑 ★
    const dateStr = startTime ? new Date(startTime).toLocaleString('zh-CN') : '未知时间';
    const durationStr = formatDuration(durationMs);
    
    if (confirm(
        `检测到未完成的陪伴，已自动生成系统中断记录。\n\n` +
        `开始时间：${dateStr}\n` +
        `中断时间：${new Date(endTime).toLocaleString('zh-CN')}\n` +
        `睡眠时长：${durationStr}\n\n` +
        `是否立即编辑结束时间？\n` +
        `（点击"取消"则稍后在陪伴记录中修改）`
    )) {
        // 用户选择编辑 → 打开陪伴记录，定位到该记录
        // 将记录 ID 存入临时变量，供 showCompanionRecords 使用
        window._pendingEditRecordId = record.id;
        if (typeof showCompanionRecords === 'function') {
            showCompanionRecords();
            // 延迟一下，等日历渲染完成后切换到编辑状态
            setTimeout(() => {
                // 跳转到该记录所在日期
                const targetDate = record.date;
                const parts = targetDate.split('-');
                const year = parseInt(parts[0]);
                const month = parseInt(parts[1]) - 1;
                const day = parseInt(parts[2]);
                _compRecordsCurrentDate = new Date(year, month, 1);
                renderCompanionCalendar();
                // 自动点击对应日期的记录
                setTimeout(() => {
                    // 查找该日期的记录并进入详情
                    const dayRecords = getRecordsForDate(targetDate);
                    if (dayRecords && dayRecords.length > 0) {
                        // 找到目标记录
                        const targetRecord = dayRecords.find(r => r.id === record.id) || dayRecords[0];
                        if (targetRecord) {
                            // 直接进入详情编辑模式
                            showRecordDetail(targetRecord, true); // true = 自动进入编辑模式
                        }
                    }
                }, 300);
            }, 400);
        } else {
            showToast('陪伴记录功能未加载，请刷新页面后编辑', 'warning');
        }
    } else {
        showToast('已生成系统中断记录，可在陪伴记录中查看和编辑', 'info');
    }
};

// ★ 辅助：获取某日期的所有记录 ★
function getRecordsForDate(dateStr) {
    const records = window._companionRecords || [];
    return records.filter(r => r.date === dateStr);
}

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

    // ============================================================
    // 初始化
    // ============================================================
    function initCompanionFeature() {
        console.log('[companion] 陪伴功能已加载（完整修复版）');
        window.showCompanionPicker = showCompanionPicker;
        window.openCompanion = showCompanionPicker;

        loadMusicList();
        stopMusic();
        stopAlarm();
        bindCompanionCalendarEvents();
    }

    // 页面卸载时清理
    window.addEventListener('beforeunload', function () {
        if (session.state === STATE.SLEEPING || session.state === STATE.COUNTDOWN || session.state === STATE.READY_TO_START) {
            backupAccident();
        }
        stopMusic();
        stopAlarm();
        releaseWakeLock();
    });

    window.initCompanionFeature = initCompanionFeature;

    console.log('[companion] 模块加载完成（完整修复版）');
})();

let _compRecordsCurrentDate = new Date(); // 当前显示的月份

// ============================================================
// 陪伴记录 - 统计视图（全局）
// ============================================================

function renderCompanionStats() {
    const year = _compRecordsCurrentDate.getFullYear();
    const month = _compRecordsCurrentDate.getMonth();
    
    const label = document.getElementById('comp-stats-month-label');
    if (label) label.textContent = year + '年' + String(month + 1).padStart(2, '0') + '月';
    
    const records = window._companionRecords || [];
    const monthRecords = records.filter(r => {
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
    
    // 无记录时：显示灰条 + "无记录"
    if (monthRecords.length === 0) {
        summaryEl.textContent = '陪伴 0 天 · 0 次';
        if (avgBedtimeEl) avgBedtimeEl.textContent = '平均: --:--';
        if (avgDurationEl) avgDurationEl.textContent = '平均: --';
        
        // 为入睡时间显示灰色条
        barsBedtime.innerHTML = '';
        const emptyBar1 = document.createElement('div');
        emptyBar1.style.cssText = `width:100%;height:20px;border-radius:4px;background:var(--border-color);display:flex;align-items:center;justify-content:center;font-size:11px;color:var(--text-secondary);opacity:0.5;`;
        emptyBar1.textContent = '无记录';
        barsBedtime.appendChild(emptyBar1);
        
        // 为睡眠时长显示灰色条
        barsDuration.innerHTML = '';
        const emptyBar2 = document.createElement('div');
        emptyBar2.style.cssText = `width:100%;height:20px;border-radius:4px;background:var(--border-color);display:flex;align-items:center;justify-content:center;font-size:11px;color:var(--text-secondary);opacity:0.5;`;
        emptyBar2.textContent = '无记录';
        barsDuration.appendChild(emptyBar2);
        
        if (emptyEl) emptyEl.style.display = 'none'; // 隐藏空状态文字（因为已经有灰条了）
        return;
    }
    if (emptyEl) emptyEl.style.display = 'none';
    
    // 按日期分组
    const dayMap = {};
    monthRecords.forEach(r => {
        const day = new Date(r.date + 'T00:00:00').getDate();
        if (!dayMap[day]) dayMap[day] = [];
        dayMap[day].push(r);
    });
    const days = Object.keys(dayMap).sort((a,b) => a-b);
    summaryEl.textContent = `陪伴 ${days.length} 天 · ${monthRecords.length} 次`;
    
    // 提取入睡时间和睡眠时长
    const bedtimeValues = [];
    const durationValues = [];
    monthRecords.forEach(r => {
        if (r.startTime) {
            const d = new Date(r.startTime);
            const totalMinutes = d.getHours() * 60 + d.getMinutes();
            bedtimeValues.push(totalMinutes);
        }
        if (r.duration) {
            durationValues.push(r.duration / 60000); // 分钟
        }
    });
    
    // ---- 计算平均值 ----
    // 平均入睡时间
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
    
    // ---- 渲染入睡时间长条 ----
    barsBedtime.innerHTML = '';
    if (bedtimeValues.length > 0) {
        // 按日期顺序排列
        const sorted = days.map(day => {
            const recs = dayMap[day];
            const first = recs[0];
            if (first && first.startTime) {
                const d = new Date(first.startTime);
                return d.getHours() * 60 + d.getMinutes();
            }
            return null;
        }).filter(v => v !== null);
        
        // 计算最小值/最大值用于映射颜色
        const minVal = Math.min(...sorted);
        const maxVal = Math.max(...sorted);
        const range = maxVal - minVal || 1;
        
        sorted.forEach(val => {
            const ratio = (val - minVal) / range;
            const hue = 240 - ratio * 60;
            const color = `hsl(${Math.round(hue)}, 70%, 55%)`;
            const bar = document.createElement('div');
            bar.style.cssText = `flex:1;min-width:12px;height:20px;border-radius:4px;background:${color};opacity:0.9;transition:0.2s;`;
            bar.title = formatTimeFromMinutes(val);
            barsBedtime.appendChild(bar);
        });
    } else {
        // 有天数但无入睡时间（理论上不会发生，但留作保险）
        const emptyBar = document.createElement('div');
        emptyBar.style.cssText = `width:100%;height:20px;border-radius:4px;background:var(--border-color);display:flex;align-items:center;justify-content:center;font-size:11px;color:var(--text-secondary);opacity:0.5;`;
        emptyBar.textContent = '无记录';
        barsBedtime.appendChild(emptyBar);
    }
    
    // ---- 渲染睡眠时长条 ----
    barsDuration.innerHTML = '';
    if (durationValues.length > 0) {
        // 按日期顺序排列
        const sorted = days.map(day => {
            const recs = dayMap[day];
            const total = recs.reduce((sum, r) => sum + (r.duration || 0), 0);
            return total / 60000; // 分钟
        });
        
        const minVal = Math.min(...sorted);
        const maxVal = Math.max(...sorted);
        const range = maxVal - minVal || 1;
        
        sorted.forEach(val => {
            const ratio = (val - minVal) / range;
            const hue = 120 - ratio * 60;
            const color = `hsl(${Math.round(hue)}, 70%, 55%)`;
            const bar = document.createElement('div');
            bar.style.cssText = `flex:1;min-width:12px;height:20px;border-radius:4px;background:${color};opacity:0.9;transition:0.2s;`;
            bar.title = Math.round(val) + '分钟';
            barsDuration.appendChild(bar);
        });
    } else {
        const emptyBar = document.createElement('div');
        emptyBar.style.cssText = `width:100%;height:20px;border-radius:4px;background:var(--border-color);display:flex;align-items:center;justify-content:center;font-size:11px;color:var(--text-secondary);opacity:0.5;`;
        emptyBar.textContent = '无记录';
        barsDuration.appendChild(emptyBar);
    }
}

// 辅助函数：格式化分钟数为 "X小时X分钟"
function formatHoursMinutes(totalMinutes) {
    if (!totalMinutes || totalMinutes < 0) return '0分钟';
    const hours = Math.floor(totalMinutes / 60);
    const mins = Math.round(totalMinutes % 60);
    if (hours === 0) return mins + '分钟';
    if (mins === 0) return hours + '小时';
    return hours + '小时' + mins + '分钟';
}

// 辅助函数：将分钟数转为 HH:MM（用于 tooltip）
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
    
    // 加载数据
    loadCompanionRecordsData();
    
    // 重置到当前月份
    _compRecordsCurrentDate = new Date();
    renderCompanionCalendar();
    
    // 确保日历面板可见，统计隐藏
    const panelCalendar = document.getElementById('comp-records-calendar-panel');
    const panelStats = document.getElementById('comp-records-stats-panel');
    if (panelCalendar) panelCalendar.style.display = 'block';
    if (panelStats) panelStats.style.display = 'none';
    
    // 重置标签页激活状态
    const tabCal = document.getElementById('comp-records-tab-calendar');
    const tabStat = document.getElementById('comp-records-tab-stats');
    if (tabCal) tabCal.classList.add('active');
    if (tabStat) tabStat.classList.remove('active');
    
    showModal(modal);
}

function loadCompanionRecordsData() {
    // 从 localStorage 加载记录
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

function renderCompanionCalendar() {
    const year = _compRecordsCurrentDate.getFullYear();
    const month = _compRecordsCurrentDate.getMonth();
    
    // 更新标题（两种显示方式）
    const label = document.getElementById('comp-records-month-label');
    if (label) {
        label.textContent = year + '年' + String(month + 1).padStart(2, '0') + '月';
    }
    // 更新下拉框
    updateCompanionDateSelectors();
    
    // 获取该月第一天和最后一天
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDayOfWeek = firstDay.getDay(); // 0=周日
    const daysInMonth = lastDay.getDate();
    
    // 获取该月的记录
    const records = window._companionRecords || [];
    const monthRecords = records.filter(r => {
        if (!r.date) return false;
        const d = new Date(r.date + 'T00:00:00');
        return d.getFullYear() === year && d.getMonth() === month;
    });
    
    // 按日期分组统计
    const dayMap = {};
    monthRecords.forEach(r => {
        const day = new Date(r.date + 'T00:00:00').getDate();
        if (!dayMap[day]) dayMap[day] = [];
        dayMap[day].push(r);
    });
    
    // 渲染网格
    const grid = document.getElementById('comp-records-grid');
    if (!grid) return;
    
    let html = '';
    // 填充空白
    for (let i = 0; i < startDayOfWeek; i++) {
        html += `<div class="calendar-day empty"></div>`;
    }
    // 填充日期
    for (let d = 1; d <= daysInMonth; d++) {
        const hasRecord = dayMap[d] && dayMap[d].length > 0;
        const isToday = (d === new Date().getDate() && 
                         year === new Date().getFullYear() && 
                         month === new Date().getMonth());
        const recordsOfDay = dayMap[d] || [];
        const totalDuration = recordsOfDay.reduce((sum, r) => sum + (r.duration || 0), 0);
        const totalMinutes = Math.floor(totalDuration / 60000);
        const totalHours = Math.floor(totalMinutes / 60);
        const displayTime = totalHours > 0 ? totalHours + 'h' + (totalMinutes % 60) + 'm' : totalMinutes + 'm';
        
        let dotHTML = '';
        if (hasRecord) {
            const count = recordsOfDay.length;
            // ★ 1条记录 → 1个圆点，≥2条 → 2个圆点 ★
            const dotCount = count >= 2 ? 2 : 1;
            const dots = [];
            for (let i = 0; i < dotCount; i++) {
                dots.push(`<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--accent-color);margin:0 2px;"></span>`);
            }
            // 如果有2条以上，显示 +N
            const extraLabel = count > 2 ? `<span style="font-size:9px;color:var(--text-secondary);margin-left:2px;">+${count - 2}</span>` : '';
            dotHTML = `<div style="display:flex;gap:2px;justify-content:center;margin-top:3px;">
                ${dots.join('')}
                ${extraLabel}
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
    
    // 更新统计
    const statsEl = document.getElementById('comp-records-stats');
    if (statsEl) {
        const totalDays = Object.keys(dayMap).length;
        const totalRecords = monthRecords.length;
        statsEl.textContent = `本月陪伴: ${totalDays} 天 · ${totalRecords} 次`;
    }
    
    // 绑定点击日期事件
    grid.querySelectorAll('.calendar-day.has-record').forEach(el => {
        el.addEventListener('click', function() {
            const day = parseInt(this.dataset.day);
            const month = parseInt(this.dataset.month);
            const year = parseInt(this.dataset.year);
            const dateStr = year + '-' + String(month + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0');
            showCompanionDayDetail(dateStr);
        });
    });
}

// ============================================================
// 记录详情 - 入口
// ============================================================
function showCompanionDayDetail(dateStr) {
    const records = getRecordsForDate(dateStr);
    if (!records || records.length === 0) {
        showToast('该日期没有陪伴记录', 'info');
        return;
    }

    // 关闭当前可能打开的详情
    closeRecordDetail();

    if (records.length === 1) {
        // 单条记录 → 直接显示详情
        showRecordDetail(records[0], false);
    } else {
        // 多条记录 → 显示列表
        showRecordList(records, dateStr);
    }
}

// ============================================================
// 多条记录列表
// ============================================================
function showRecordList(records, dateStr) {
    const container = document.getElementById('comp-record-detail-container');
    if (!container) return;

    // 隐藏日历面板，显示详情面板
    const panelCalendar = document.getElementById('comp-records-calendar-panel');
    const panelStats = document.getElementById('comp-records-stats-panel');
    if (panelCalendar) panelCalendar.style.display = 'none';
    if (panelStats) panelStats.style.display = 'none';

    container.style.display = 'block';
    container.innerHTML = `
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">
            <button class="calendar-nav-btn" id="comp-detail-back-btn" style="font-size:14px;padding:4px 10px;">
                <i class="fas fa-arrow-left"></i> 返回
            </button>
            <span style="font-size:15px;font-weight:600;">📅 ${dateStr}</span>
            <span style="font-size:12px;color:var(--text-secondary);">共 ${records.length} 条记录</span>
        </div>
        <div id="comp-record-list" style="display:flex;flex-direction:column;gap:10px;">
            ${records.map((r, idx) => `
                <div class="comp-record-card" data-id="${r.id}" style="background:var(--primary-bg);border-radius:12px;border:1px solid var(--border-color);padding:14px 16px;cursor:pointer;transition:all 0.2s;display:flex;justify-content:space-between;align-items:center;"
                     onmouseover="this.style.borderColor='var(--accent-color)';this.style.transform='translateY(-1px)';"
                     onmouseout="this.style.borderColor='var(--border-color)';this.style.transform='none';">
                    <div>
                        <div style="font-weight:600;font-size:14px;color:var(--text-primary);">
                            ${r.status || (r.mode === 'completed' ? '完成陪伴' : r.mode === 'interrupted' ? '选择终止' : '系统中断')}
                        </div>
                        <div style="font-size:12px;color:var(--text-secondary);margin-top:3px;">
                            ${formatDateTime(r.startTime)} → ${formatDateTime(r.endTime)}
                            <span style="margin-left:10px;opacity:0.6;">${formatDuration(r.duration)}</span>
                        </div>
                    </div>
                    <i class="fas fa-chevron-right" style="color:var(--text-secondary);opacity:0.4;"></i>
                </div>
            `).join('')}
        </div>
    `;

    // 绑定返回按钮
    const backBtn = document.getElementById('comp-detail-back-btn');
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            closeRecordDetail();
            // 恢复日历面板
            if (panelCalendar) panelCalendar.style.display = 'block';
            renderCompanionCalendar();
        });
    }

    // 绑定卡片点击事件
    document.querySelectorAll('.comp-record-card').forEach(el => {
        el.addEventListener('click', function() {
            const id = this.dataset.id;
            const record = findRecordById(id);
            if (record) {
                showRecordDetail(record, false);
            }
        });
    });
}

// ============================================================
// 单条记录详情
// ============================================================
function showRecordDetail(record, autoEdit = false) {
    const container = document.getElementById('comp-record-detail-container');
    if (!container) return;

    // 隐藏日历面板
    const panelCalendar = document.getElementById('comp-records-calendar-panel');
    const panelStats = document.getElementById('comp-records-stats-panel');
    if (panelCalendar) panelCalendar.style.display = 'none';
    if (panelStats) panelStats.style.display = 'none';

    container.style.display = 'block';

    const isEditable = isRecordEditable(record);
    const isSystemInterrupt = record.mode === 'system_interrupt';
    const typeLabel = record.status || (record.mode === 'completed' ? '完成陪伴' : record.mode === 'interrupted' ? '选择终止' : '系统中断');

    // 构建详情 HTML
    let html = `
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">
            <button class="calendar-nav-btn" id="comp-detail-back-btn" style="font-size:14px;padding:4px 10px;">
                <i class="fas fa-arrow-left"></i> 返回
            </button>
            <span style="font-size:15px;font-weight:600;">📋 ${typeLabel}</span>
            <span style="font-size:11px;color:var(--text-secondary);margin-left:auto;">
                ${isEditable ? '🟢 可编辑' : '🔒 只读'}
            </span>
        </div>
        <div style="background:var(--secondary-bg);border-radius:14px;border:1px solid var(--border-color);padding:18px 20px;">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                <div>
                    <div style="font-size:11px;color:var(--text-secondary);">开始时间</div>
                    <div style="font-size:14px;font-weight:500;">${formatDateTime(record.startTime)}</div>
                </div>
                <div>
                    <div style="font-size:11px;color:var(--text-secondary);">睡眠时长</div>
                    <div style="font-size:14px;font-weight:500;">${formatDuration(record.duration)}</div>
                </div>
            </div>
            <div style="margin-top:10px;">
                <div style="font-size:11px;color:var(--text-secondary);">结束时间</div>
                <div style="font-size:14px;font-weight:500;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                    ${isSystemInterrupt && isEditable ? `
                        <input type="datetime-local" id="comp-endtime-editor" value="${formatDatetimeLocal(record.endTime)}" 
                               style="padding:6px 10px;border-radius:8px;border:1px solid var(--border-color);background:var(--primary-bg);color:var(--text-primary);font-size:13px;">
                        <button class="modal-btn modal-btn-primary" id="comp-endtime-save-btn" style="padding:4px 12px;font-size:12px;">更新</button>
                    ` : `
                        <span>${formatDateTime(record.endTime)}</span>
                    `}
                </div>
            </div>
    `;

    // 感受（完成陪伴 / 系统中断）
    if (record.mode === 'completed' || isSystemInterrupt) {
        const feeling = record.feeling || '';
        html += `
            <div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border-color);">
                <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                    <span style="font-size:11px;color:var(--text-secondary);">💭 感受</span>
                    ${isEditable ? `<button class="modal-btn modal-btn-secondary" id="comp-edit-feeling-btn" style="padding:2px 10px;font-size:11px;">编辑</button>` : ''}
                </div>
                <div id="comp-feeling-display" style="margin-top:4px;font-size:14px;${feeling ? '' : 'color:var(--text-secondary);opacity:0.5;'}">
                    ${feeling || '未记录感受'}
                </div>
                ${isEditable ? `
                    <div id="comp-feeling-editor" style="display:none;margin-top:8px;">
                        <textarea id="comp-feeling-textarea" rows="3" style="width:100%;padding:8px 12px;border-radius:10px;border:1px solid var(--border-color);background:var(--primary-bg);color:var(--text-primary);font-size:13px;resize:vertical;font-family:var(--font-family);box-sizing:border-box;">${feeling}</textarea>
                        <div style="display:flex;gap:8px;margin-top:6px;">
                            <button class="modal-btn modal-btn-primary" id="comp-feeling-save-btn" style="padding:4px 14px;font-size:12px;">保存</button>
                            <button class="modal-btn modal-btn-secondary" id="comp-feeling-cancel-btn" style="padding:4px 14px;font-size:12px;">取消</button>
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    }

    // 中断原因（选择终止）
    if (record.mode === 'interrupted') {
        const reason = record.interruptReason || '';
        html += `
            <div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border-color);">
                <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                    <span style="font-size:11px;color:var(--text-secondary);">📝 中断原因</span>
                    ${isEditable ? `<button class="modal-btn modal-btn-secondary" id="comp-edit-reason-btn" style="padding:2px 10px;font-size:11px;">编辑</button>` : ''}
                </div>
                <div id="comp-reason-display" style="margin-top:4px;font-size:14px;${reason ? '' : 'color:var(--text-secondary);opacity:0.5;'}">
                    ${reason || '未记录原因'}
                </div>
                ${isEditable ? `
                    <div id="comp-reason-editor" style="display:none;margin-top:8px;">
                        <textarea id="comp-reason-textarea" rows="3" style="width:100%;padding:8px 12px;border-radius:10px;border:1px solid var(--border-color);background:var(--primary-bg);color:var(--text-primary);font-size:13px;resize:vertical;font-family:var(--font-family);box-sizing:border-box;">${reason}</textarea>
                        <div style="display:flex;gap:8px;margin-top:6px;">
                            <button class="modal-btn modal-btn-primary" id="comp-reason-save-btn" style="padding:4px 14px;font-size:12px;">保存</button>
                            <button class="modal-btn modal-btn-secondary" id="comp-reason-cancel-btn" style="padding:4px 14px;font-size:12px;">取消</button>
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    }

    // 删除按钮（始终可删除）
    html += `
            <div style="margin-top:16px;padding-top:12px;border-top:1px solid var(--border-color);display:flex;gap:10px;justify-content:flex-end;">
                <button class="modal-btn modal-btn-secondary" id="comp-delete-record-btn" style="color:#ff6b6b;border-color:rgba(255,107,107,0.3);">
                    <i class="fas fa-trash"></i> 删除记录
                </button>
            </div>
        </div>
    `;

    container.innerHTML = html;

    // ---- 绑定事件 ----

    // 返回按钮
    const backBtn = document.getElementById('comp-detail-back-btn');
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            const dateStr = record.date;
            closeRecordDetail();
            const panelCalendar = document.getElementById('comp-records-calendar-panel');
            if (panelCalendar) panelCalendar.style.display = 'block';
            // 重新加载该日期的记录列表
            const records = getRecordsForDate(dateStr);
            if (records.length > 1) {
                showRecordList(records, dateStr);
            } else {
                renderCompanionCalendar();
            }
        });
    }

    // 结束时间编辑（系统中断）
    if (isSystemInterrupt && isEditable) {
        const saveEndBtn = document.getElementById('comp-endtime-save-btn');
        if (saveEndBtn) {
            saveEndBtn.addEventListener('click', function() {
                const input = document.getElementById('comp-endtime-editor');
                if (!input || !input.value) {
                    showToast('请选择有效的结束时间', 'warning');
                    return;
                }
                const newEndTime = new Date(input.value);
                if (isNaN(newEndTime.getTime())) {
                    showToast('无效的时间格式', 'error');
                    return;
                }
                // 检查是否早于开始时间
                const start = new Date(record.startTime);
                if (newEndTime <= start) {
                    showToast('结束时间必须晚于开始时间', 'warning');
                    return;
                }
                // 更新记录
                updateSystemInterruptEndTime(record.id, newEndTime.toISOString());
            });
        }
    }

    // 感受编辑
    if (isEditable && (record.mode === 'completed' || isSystemInterrupt)) {
        const editBtn = document.getElementById('comp-edit-feeling-btn');
        if (editBtn) {
            editBtn.addEventListener('click', () => {
                document.getElementById('comp-feeling-display').style.display = 'none';
                document.getElementById('comp-feeling-editor').style.display = 'block';
            });
        }
        const saveFeeling = document.getElementById('comp-feeling-save-btn');
        const cancelFeeling = document.getElementById('comp-feeling-cancel-btn');
        if (saveFeeling) {
            saveFeeling.addEventListener('click', () => {
                const textarea = document.getElementById('comp-feeling-textarea');
                const newFeeling = textarea ? textarea.value.trim() : '';
                updateRecordField(record.id, 'feeling', newFeeling);
                // 刷新视图
                const updated = findRecordById(record.id);
                if (updated) showRecordDetail(updated, false);
            });
        }
        if (cancelFeeling) {
            cancelFeeling.addEventListener('click', () => {
                document.getElementById('comp-feeling-display').style.display = 'block';
                document.getElementById('comp-feeling-editor').style.display = 'none';
            });
        }
    }

    // 原因编辑（选择终止）
    if (isEditable && record.mode === 'interrupted') {
        const editBtn = document.getElementById('comp-edit-reason-btn');
        if (editBtn) {
            editBtn.addEventListener('click', () => {
                document.getElementById('comp-reason-display').style.display = 'none';
                document.getElementById('comp-reason-editor').style.display = 'block';
            });
        }
        const saveReason = document.getElementById('comp-reason-save-btn');
        const cancelReason = document.getElementById('comp-reason-cancel-btn');
        if (saveReason) {
            saveReason.addEventListener('click', () => {
                const textarea = document.getElementById('comp-reason-textarea');
                const newReason = textarea ? textarea.value.trim() : '';
                updateRecordField(record.id, 'interruptReason', newReason);
                const updated = findRecordById(record.id);
                if (updated) showRecordDetail(updated, false);
            });
        }
        if (cancelReason) {
            cancelReason.addEventListener('click', () => {
                document.getElementById('comp-reason-display').style.display = 'block';
                document.getElementById('comp-reason-editor').style.display = 'none';
            });
        }
    }

    // 删除记录
    const deleteBtn = document.getElementById('comp-delete-record-btn');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', () => {
            if (confirm('确定要删除这条陪伴记录吗？此操作不可恢复！')) {
                deleteRecord(record.id);
                closeRecordDetail();
                const panelCalendar = document.getElementById('comp-records-calendar-panel');
                if (panelCalendar) panelCalendar.style.display = 'block';
                renderCompanionCalendar();
                showToast('记录已删除', 'success');
            }
        });
    }

    // 如果 autoEdit 为 true，自动展开编辑
    if (autoEdit) {
        if (isSystemInterrupt) {
            const input = document.getElementById('comp-endtime-editor');
            if (input) {
                input.focus();
                input.select();
                showToast('请修改结束时间，然后点击"更新"', 'info', 3000);
            }
        }
    }
}

// ============================================================
// 辅助函数
// ============================================================

// 关闭记录详情
function closeRecordDetail() {
    const container = document.getElementById('comp-record-detail-container');
    if (container) {
        container.style.display = 'none';
        container.innerHTML = '';
    }
}

// 根据 ID 查找记录
function findRecordById(id) {
    const records = window._companionRecords || [];
    return records.find(r => r.id === id);
}

// 检查记录是否可编辑（三天内）
function isRecordEditable(record) {
    if (!record || !record.startTime) return false;
    const start = new Date(record.startTime);
    const now = new Date();
    const diffDays = (now - start) / (1000 * 60 * 60 * 24);
    return diffDays <= 3;
}

// 格式化日期时间（本地化）
function formatDateTime(isoStr) {
    if (!isoStr) return '--:--';
    try {
        const d = new Date(isoStr);
        return d.toLocaleString('zh-CN', {
            month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit',
            hour12: false
        });
    } catch { return isoStr; }
}

// 格式化 datetime-local 输入框的值
function formatDatetimeLocal(isoStr) {
    if (!isoStr) return '';
    try {
        const d = new Date(isoStr);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const hours = String(d.getHours()).padStart(2, '0');
        const mins = String(d.getMinutes()).padStart(2, '0');
        return `${year}-${month}-${day}T${hours}:${mins}`;
    } catch { return ''; }
}

function populateCompanionYearMonthSelectors() {
    const yearSelect = document.getElementById('comp-records-year-select');
    const monthSelect = document.getElementById('comp-records-month-select');
    if (!yearSelect || !monthSelect) return;
    
    const currentYear = new Date().getFullYear();
    // 填充年份：从当前年份往前10年到往后2年
    yearSelect.innerHTML = '';
    for (let y = currentYear - 10; y <= currentYear + 2; y++) {
        const opt = document.createElement('option');
        opt.value = y;
        opt.textContent = y;
        if (y === _compRecordsCurrentDate.getFullYear()) opt.selected = true;
        yearSelect.appendChild(opt);
    }
    
    // 填充月份
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
            // 重新渲染日历（确保数据最新）
            renderCompanionCalendar();
        });
        tabStats.addEventListener('click', function() {
            tabStats.classList.add('active');
            tabCalendar.classList.remove('active');
            panelStats.style.display = 'block';
            panelCalendar.style.display = 'none';
            // 渲染统计
            renderCompanionStats();
        });
    }
    
    // ---- 月份导航 ----
    const prevBtn = document.getElementById('comp-records-prev-month');
    const nextBtn = document.getElementById('comp-records-next-month');
    if (prevBtn) {
        prevBtn.addEventListener('click', function() {
            _compRecordsCurrentDate.setMonth(_compRecordsCurrentDate.getMonth() - 1);
            updateCompanionDateSelectors();
            renderCompanionCalendar();
            // 如果统计面板可见，也刷新统计
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
            if (panelStats && panelStats.style.display !== 'none') {
                renderCompanionStats();
            }
        });
    }
    
    // ---- 年份/月份下拉框填充 ----
    populateCompanionYearMonthSelectors();
    
    // ---- 跳转按钮 ----
    const goBtn = document.getElementById('comp-records-go-to-date');
    if (goBtn) {
        goBtn.addEventListener('click', function() {
            const yearSelect = document.getElementById('comp-records-year-select');
            const monthSelect = document.getElementById('comp-records-month-select');
            if (yearSelect && monthSelect) {
                const year = parseInt(yearSelect.value);
                const month = parseInt(monthSelect.value);
                _compRecordsCurrentDate = new Date(year, month, 1);
                updateCompanionDateSelectors();
                renderCompanionCalendar();
                if (panelStats && panelStats.style.display !== 'none') {
                    renderCompanionStats();
                }
            }
        });
    }
    
    // ---- 关闭按钮 ----
    const closeBtns = document.querySelectorAll('#close-companion-records, #close-companion-records-btn');
    closeBtns.forEach(btn => {
        if (btn) {
            btn.addEventListener('click', function() {
                hideModal(document.getElementById('companion-records-modal'));
            });
        }
    });
}

// ============================================================
// 记录修改/删除操作
// ============================================================

// 更新记录字段（感受/中断原因）
function updateRecordField(id, field, value) {
    const records = window._companionRecords || [];
    const index = records.findIndex(r => r.id === id);
    if (index === -1) {
        showToast('记录不存在', 'error');
        return;
    }

    // 检查是否可编辑
    if (!isRecordEditable(records[index])) {
        showToast('该记录已超过3天，不可修改', 'warning');
        return;
    }

    records[index][field] = value;
    records[index].updatedAt = new Date().toISOString();

    // 保存到 localStorage
    try {
        const key = 'companion_records';
        localStorage.setItem(key, JSON.stringify(records));
        window._companionRecords = records;
        showToast('已更新 ✓', 'success');
    } catch (e) {
        console.error('[companion] 更新记录失败:', e);
        showToast('更新失败，请重试', 'error');
    }
}

// 更新系统中断的结束时间
function updateSystemInterruptEndTime(id, newEndTime) {
    const records = window._companionRecords || [];
    const index = records.findIndex(r => r.id === id);
    if (index === -1) {
        showToast('记录不存在', 'error');
        return;
    }

    const record = records[index];
    if (record.mode !== 'system_interrupt') {
        showToast('仅系统中断记录可修改结束时间', 'warning');
        return;
    }

    if (!isRecordEditable(record)) {
        showToast('该记录已超过3天，不可修改', 'warning');
        return;
    }

    const start = new Date(record.startTime);
    const end = new Date(newEndTime);
    if (end <= start) {
        showToast('结束时间必须晚于开始时间', 'warning');
        return;
    }

    const newDuration = end - start;
    records[index].endTime = newEndTime;
    records[index].duration = newDuration;
    records[index].updatedAt = new Date().toISOString();

    try {
        const key = 'companion_records';
        localStorage.setItem(key, JSON.stringify(records));
        window._companionRecords = records;
        showToast('结束时间已更新 ✓', 'success');
        // 刷新详情
        const updated = findRecordById(id);
        if (updated) showRecordDetail(updated, false);
    } catch (e) {
        console.error('[companion] 更新结束时间失败:', e);
        showToast('更新失败，请重试', 'error');
    }
}

// 删除记录
function deleteRecord(id) {
    let records = window._companionRecords || [];
    records = records.filter(r => r.id !== id);
    try {
        const key = 'companion_records';
        localStorage.setItem(key, JSON.stringify(records));
        window._companionRecords = records;
    } catch (e) {
        console.error('[companion] 删除记录失败:', e);
        showToast('删除失败，请重试', 'error');
    }
}