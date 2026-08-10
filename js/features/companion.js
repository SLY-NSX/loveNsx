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
    const MIN_VALID_MINUTES = 20;

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
// 陪伴记录工具函数
// ============================================================

/**
 * 格式化时间：8月10日 23:16（不含秒）
 */
function formatDetailTime(isoStr) {
    if (!isoStr) return '--';
    try {
        const d = new Date(isoStr);
        const month = d.getMonth() + 1;
        const day = d.getDate();
        const hours = String(d.getHours()).padStart(2, '0');
        const mins = String(d.getMinutes()).padStart(2, '0');
        return `${month}月${day}日 ${hours}:${mins}`;
    } catch {
        return isoStr;
    }
}

/**
 * 判断记录是否在3天内（可修改）
 * 3天前的记录不可修改，保留删除权利
 */
function isRecordEditable(record) {
    if (!record || !record.startTime) return false;
    try {
        const startDate = new Date(record.startTime);
        const now = new Date();
        // 计算天数差（只比较日期，不比较时间）
        const startDay = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
        const nowDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const diffDays = Math.floor((nowDay - startDay) / (1000 * 60 * 60 * 24));
        return diffDays <= 3;
    } catch {
        return false;
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

        if (elapsedMinutes < MIN_VALID_MINUTES) {
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

        const record = {
            id: 'comp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
            date: startDate.toISOString().split('T')[0],
            startTime: startDate.toISOString(),
            endTime: endDate.toISOString(),
            duration: durationMs,
            mode: mode,
            soundType: session.musicTitle || '无音乐',
            status: mode === 'completed' ? '完成陪伴' : '未能完成陪伴',
            interruptReason: '',
            isSystemInterrupt: false,
        };

        if (mode === 'interrupted') {
            hideOverlay();
            showInterruptReasonToast(record, () => saveRecordAndCleanup(record));
            return;
        }

        if (mode === 'completed') {
            hideOverlay();
            showCompletionToast(record, () => saveRecordAndCleanup(record));
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
            if (typeof window.saveCompanionRecord === 'function') {
                window.saveCompanionRecord(record);
            } else {
                const key = 'companion_records';
                let records = JSON.parse(localStorage.getItem(key) || '[]');
                records.push(record);
                localStorage.setItem(key, JSON.stringify(records));
            }
            showToast('陪伴记录已保存 ✓', 'success');
        } catch (e) {
            console.error('[companion] 保存记录失败:', e);
        }

        stopMusic();
        stopAlarm();
        releaseWakeLock();
        clearAccident();
        resetSession();
        session.isEnding = false;
        currentUI = 'idle';
    }

function showInterruptReasonToast(record, onSave) {
    const toast = document.createElement('div');
    toast.className = 'companion-toast open';
    toast.id = 'companion-toast-temp';
    toast.innerHTML = `
        <div class="toast-box">
            <div class="toast-title">⏸️ 睡眠中断</div>
            <div class="toast-body">
                <div>开始时间：${formatDetailTime(record.startTime)}</div>
                <div>睡眠时长：${formatDuration(record.duration)}</div>
                <div>结束时间：${formatDetailTime(record.endTime)}</div>
                ${record.interruptReason ? `<div style="margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,0.06);font-style:italic;color:rgba(255,255,255,0.5);">📝 ${record.interruptReason}</div>` : ''}
                ${record.note ? `<div style="margin-top:6px;padding-top:6px;border-top:1px solid rgba(255,255,255,0.04);font-style:italic;color:rgba(255,255,255,0.35);font-size:12px;">💭 ${record.note}</div>` : ''}
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center;">
                <button class="toast-btn" id="toast-reason-btn" style="background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.1);font-size:13px;padding:8px 16px;">📝 填写原因</button>
                <button class="toast-btn" id="toast-note-btn" style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.06);font-size:13px;padding:8px 16px;">💭 感受</button>
                <button class="toast-btn" id="toast-confirm-btn">确定</button>
            </div>
        </div>
    `;
    document.body.appendChild(toast);

    const confirmBtn = toast.querySelector('#toast-confirm-btn');
    const reasonBtn = toast.querySelector('#toast-reason-btn');
    const noteBtn = toast.querySelector('#toast-note-btn');

    // 确定按钮
    confirmBtn.addEventListener('click', () => {
        document.body.removeChild(toast);
        if (onSave) onSave();
    });

    // 点击空白关闭
    toast.addEventListener('click', (e) => {
        if (e.target === toast) {
            document.body.removeChild(toast);
            if (onSave) onSave();
        }
    });

    // 填写原因
    reasonBtn.addEventListener('click', () => {
        showReasonInputDialog(record, (reason) => {
            record.interruptReason = reason;
            if (typeof window.updateCompanionRecord === 'function') {
                window.updateCompanionRecord(record.id, { interruptReason: reason }, function(success) {
                    if (success) {
                        showToast('中断原因已保存 ✓', 'success');
                    }
                });
            }
            // 刷新弹窗显示
            const bodyEl = toast.querySelector('.toast-body');
            if (bodyEl) {
                const reasonDiv = bodyEl.querySelector('div[style*="border-top"]');
                if (reason) {
                    if (reasonDiv && reasonDiv.textContent.includes('📝')) {
                        reasonDiv.innerHTML = `📝 ${reason}`;
                    } else {
                        const newReason = document.createElement('div');
                        newReason.style.cssText = 'margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,0.06);font-style:italic;color:rgba(255,255,255,0.5);';
                        newReason.textContent = '📝 ' + reason;
                        bodyEl.appendChild(newReason);
                    }
                } else if (reasonDiv && reasonDiv.textContent.includes('📝')) {
                    reasonDiv.remove();
                }
            }
        });
    });

    // 填写感受
    noteBtn.addEventListener('click', () => {
        showNoteInputDialog(record, (note) => {
            record.note = note;
            if (typeof window.updateCompanionRecord === 'function') {
                window.updateCompanionRecord(record.id, { note: note }, function(success) {
                    if (success) {
                        showToast('感受已保存 ✓', 'success');
                    }
                });
            }
            // 刷新弹窗显示
            const bodyEl = toast.querySelector('.toast-body');
            if (bodyEl) {
                const noteDiv = bodyEl.querySelector('div[style*="border-top"]:last-child');
                if (note) {
                    if (noteDiv && noteDiv.textContent.includes('💭')) {
                        noteDiv.innerHTML = `💭 ${note}`;
                    } else {
                        const newNote = document.createElement('div');
                        newNote.style.cssText = 'margin-top:6px;padding-top:6px;border-top:1px solid rgba(255,255,255,0.04);font-style:italic;color:rgba(255,255,255,0.35);font-size:12px;';
                        newNote.textContent = '💭 ' + note;
                        bodyEl.appendChild(newNote);
                    }
                } else if (noteDiv && noteDiv.textContent.includes('💭')) {
                    noteDiv.remove();
                }
            }
        });
    });
}

function showCompletionToast(record, onSave) {
    const toast = document.createElement('div');
    toast.className = 'companion-toast open';
    toast.id = 'companion-toast-temp';
    toast.innerHTML = `
        <div class="toast-box">
            <div class="toast-title">🌙 好梦</div>
            <div class="toast-body">
                <div>开始时间：${formatDetailTime(record.startTime)}</div>
                <div>睡眠时长：${formatDuration(record.duration)}</div>
                <div>结束时间：${formatDetailTime(record.endTime)}</div>
                ${record.note ? `<div style="margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,0.06);font-style:italic;color:rgba(255,255,255,0.5);">💭 ${record.note}</div>` : ''}
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center;">
                <button class="toast-btn" id="toast-note-btn" style="background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.1);font-size:13px;padding:8px 16px;">💭 填写感受</button>
                <button class="toast-btn" id="toast-confirm-btn">确定</button>
            </div>
        </div>
    `;
    document.body.appendChild(toast);

    const confirmBtn = toast.querySelector('#toast-confirm-btn');
    const noteBtn = toast.querySelector('#toast-note-btn');

    // 确定按钮
    confirmBtn.addEventListener('click', () => {
        document.body.removeChild(toast);
        if (onSave) onSave();
    });

    // 点击空白关闭
    toast.addEventListener('click', (e) => {
        if (e.target === toast) {
            document.body.removeChild(toast);
            if (onSave) onSave();
        }
    });

    // 填写感受
    noteBtn.addEventListener('click', () => {
        showNoteInputDialog(record, (note) => {
            record.note = note;
            // 更新存储
            if (typeof window.updateCompanionRecord === 'function') {
                window.updateCompanionRecord(record.id, { note: note }, function(success) {
                    if (success) {
                        showToast('感受已保存 ✓', 'success');
                    }
                });
            }
            // 刷新弹窗显示
            const bodyEl = toast.querySelector('.toast-body');
            if (bodyEl) {
                const noteDiv = bodyEl.querySelector('div[style*="border-top"]');
                if (note) {
                    if (noteDiv) {
                        noteDiv.innerHTML = `💭 ${note}`;
                    } else {
                        const newNote = document.createElement('div');
                        newNote.style.cssText = 'margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,0.06);font-style:italic;color:rgba(255,255,255,0.5);';
                        newNote.textContent = '💭 ' + note;
                        bodyEl.appendChild(newNote);
                    }
                } else if (noteDiv) {
                    noteDiv.remove();
                }
            }
        });
    });
}

// ============================================================
// 独立输入对话框（感受/原因）
// ============================================================

/**
 * 显示填写感受的独立输入框
 */
function showNoteInputDialog(record, onSave) {
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
                💭 填写感受
            </div>
            <div style="margin-bottom:16px;">
                <label style="font-size:12px;color:var(--text-secondary);display:block;margin-bottom:4px;">记录下这次陪伴的感受</label>
                <textarea id="note-input-dialog" rows="3" placeholder="例如：睡得很好..." style="width:100%;padding:10px 12px;border-radius:10px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.05);color:var(--text-primary,#fff);font-size:14px;outline:none;box-sizing:border-box;font-family:var(--font-family);resize:vertical;">${record.note || ''}</textarea>
            </div>
            <div style="display:flex;gap:10px;">
                <button class="companion-btn secondary" id="note-dialog-cancel" style="flex:1;padding:10px;font-size:14px;min-width:unset;">取消</button>
                <button class="companion-btn" id="note-dialog-confirm" style="flex:2;padding:10px;font-size:14px;min-width:unset;">保存</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    const textarea = overlay.querySelector('#note-input-dialog');
    const confirmBtn = overlay.querySelector('#note-dialog-confirm');
    const cancelBtn = overlay.querySelector('#note-dialog-cancel');

    confirmBtn.addEventListener('click', () => {
        const note = textarea.value.trim();
        document.body.removeChild(overlay);
        if (onSave) onSave(note);
    });

    cancelBtn.addEventListener('click', () => {
        document.body.removeChild(overlay);
    });

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            document.body.removeChild(overlay);
        }
    });

    setTimeout(() => textarea?.focus(), 100);
}

/**
 * 显示填写原因的独立输入框
 */
function showReasonInputDialog(record, onSave) {
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
                📝 中断原因
            </div>
            <div style="margin-bottom:16px;">
                <label style="font-size:12px;color:var(--text-secondary);display:block;margin-bottom:4px;">记录中断的原因</label>
                <textarea id="reason-input-dialog" rows="3" placeholder="例如：被电话吵醒..." style="width:100%;padding:10px 12px;border-radius:10px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.05);color:var(--text-primary,#fff);font-size:14px;outline:none;box-sizing:border-box;font-family:var(--font-family);resize:vertical;">${record.interruptReason || ''}</textarea>
            </div>
            <div style="display:flex;gap:10px;">
                <button class="companion-btn secondary" id="reason-dialog-cancel" style="flex:1;padding:10px;font-size:14px;min-width:unset;">取消</button>
                <button class="companion-btn" id="reason-dialog-confirm" style="flex:2;padding:10px;font-size:14px;min-width:unset;">保存</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    const textarea = overlay.querySelector('#reason-input-dialog');
    const confirmBtn = overlay.querySelector('#reason-dialog-confirm');
    const cancelBtn = overlay.querySelector('#reason-dialog-cancel');

    confirmBtn.addEventListener('click', () => {
        const reason = textarea.value.trim();
        document.body.removeChild(overlay);
        if (onSave) onSave(reason);
    });

    cancelBtn.addEventListener('click', () => {
        document.body.removeChild(overlay);
    });

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            document.body.removeChild(overlay);
        }
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
        clearAccident();
        resetSession();
        showToast('陪伴尚未正式开始，不生成记录', 'info');
        return;
    }

    const elapsedMinutes = durationMs / (60 * 1000);
    if (elapsedMinutes < MIN_VALID_MINUTES) {
        clearAccident();
        resetSession();
        showToast(`陪伴时长不足${MIN_VALID_MINUTES}分钟，不生成记录`, 'info');
        return;
    }

    // 构建系统中断记录
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
        note: '',
        isSystemInterrupt: true,
    };

    // 保存记录
    let saved = false;
    if (typeof window.saveCompanionRecord === 'function') {
        window.saveCompanionRecord(record, function(success) {
            if (success) {
                saved = true;
                // 清除遗言
                clearAccident();
                resetSession();
                // 弹窗提示
                showToast('已生成系统中断记录，请完善结束时间', 'warning');
                // 打开日历并定位到该记录
                setTimeout(function() {
                    showCompanionRecords(record.id);
                }, 300);
            } else {
                showToast('补录失败，请重试', 'error');
            }
        });
    } else {
        // 降级方案
        try {
            const key = 'companion_records';
            let records = JSON.parse(localStorage.getItem(key) || '[]');
            records.push(record);
            localStorage.setItem(key, JSON.stringify(records));
            saved = true;
            clearAccident();
            resetSession();
            showToast('已生成系统中断记录，请完善结束时间', 'warning');
            setTimeout(function() {
                showCompanionRecords(record.id);
            }, 300);
        } catch (e) {
            console.error('[companion] 补录失败:', e);
            showToast('补录失败', 'error');
        }
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
// 陪伴记录 - 日历视图
// ============================================================

/**
 * 打开陪伴记录日历模态框
 * @param {string} [targetRecordId] - 可选，指定要打开的记录ID（用于补录跳转）
 */
function showCompanionRecords(targetRecordId) {
    // 加载所有记录
    if (typeof window.loadCompanionRecords === 'function') {
        window.loadCompanionRecords(function(records) {
            renderCalendarModal(records || [], targetRecordId);
        });
    } else {
        // 降级方案：从 localStorage 读取
        try {
            const data = localStorage.getItem('companion_records');
            const records = data ? JSON.parse(data) : [];
            renderCalendarModal(records, targetRecordId);
        } catch (e) {
            renderCalendarModal([], targetRecordId);
        }
    }
}

// ============================================================
// 日历视图渲染
// ============================================================

/**
 * 渲染日历模态框
 * @param {Array} records - 所有记录
 * @param {string} [targetRecordId] - 可选，要定位的记录ID
 */
function renderCalendarModal(records, targetRecordId) {
    // 按日期分组
    const grouped = {};
    records.forEach(record => {
        if (!record.date) return;
        if (!grouped[record.date]) grouped[record.date] = [];
        grouped[record.date].push(record);
    });

    // 获取当前日期
    const now = new Date();
    let currentYear = now.getFullYear();
    let currentMonth = now.getMonth();

    // 移除旧的模态框（避免事件监听器残留）
    let modal = document.getElementById('companion-calendar-modal');
    if (modal) modal.remove();

    // 创建新的模态框
    modal = document.createElement('div');
    modal.id = 'companion-calendar-modal';
    modal.className = 'modal';
    modal.style.cssText = 'z-index: 99998 !important;';
    document.body.appendChild(modal);

    // 渲染逻辑
    function renderCalendar(year, month) {
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];

        let daysHTML = '';
        // 填充空白
        for (let i = 0; i < firstDay; i++) {
            daysHTML += `<div class="calendar-day empty"></div>`;
        }
        // 填充日期
        for (let d = 1; d <= daysInMonth; d++) {
            const dateObj = new Date(year, month, d);
            const dateStr = dateObj.toISOString().split('T')[0];
            const isToday = dateStr === todayStr;
            const hasRecords = grouped[dateStr] && grouped[dateStr].length > 0;
            const dotCount = hasRecords ? (grouped[dateStr].length > 1 ? 2 : 1) : 0;
            const isClickable = hasRecords;

            daysHTML += `
                <div class="calendar-day${isToday ? ' today' : ''}${isClickable ? ' has-record' : ''}" 
                     data-date="${dateStr}"
                     style="${isClickable ? 'cursor:pointer;' : ''}${isToday ? 'border-color:var(--accent-color);' : ''}">
                    <span style="font-size:13px;font-weight:${isToday ? '700' : '400'};color:${isToday ? 'var(--accent-color)' : 'var(--text-primary)'};">${d}</span>
                    ${dotCount > 0 ? `<div style="display:flex;gap:3px;justify-content:center;margin-top:2px;">${'<span style="width:5px;height:5px;border-radius:50%;background:var(--accent-color);display:inline-block;"></span>'.repeat(dotCount)}</div>` : ''}
                </div>
            `;
        }

        const monthNames = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];

        const html = `
            <div class="modal-content" style="max-width:420px;padding:20px;background:var(--secondary-bg);border-radius:20px;max-height:85vh;display:flex;flex-direction:column;overflow:hidden;">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;flex-shrink:0;">
                    <div style="font-size:18px;font-weight:700;color:var(--text-primary);display:flex;align-items:center;gap:8px;">
                        <i class="fas fa-moon" style="color:var(--accent-color);"></i>陪伴记录
                    </div>
                    <button id="close-calendar-btn" style="width:32px;height:32px;border-radius:50%;border:none;background:rgba(var(--accent-color-rgb),0.1);color:var(--text-secondary);cursor:pointer;font-size:16px;display:flex;align-items:center;justify-content:center;">×</button>
                </div>

                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;flex-shrink:0;">
                    <button id="calendar-prev-month" style="background:none;border:none;color:var(--text-secondary);cursor:pointer;font-size:14px;padding:4px 10px;"><i class="fas fa-chevron-left"></i></button>
                    <span style="font-size:15px;font-weight:600;color:var(--text-primary);">${year}年 ${monthNames[month]}</span>
                    <button id="calendar-next-month" style="background:none;border:none;color:var(--text-secondary);cursor:pointer;font-size:14px;padding:4px 10px;"><i class="fas fa-chevron-right"></i></button>
                </div>

                <div style="display:grid;grid-template-columns:repeat(7,1fr);text-align:center;font-size:11px;color:var(--text-secondary);margin-bottom:6px;flex-shrink:0;">
                    <div>日</div><div>一</div><div>二</div><div>三</div><div>四</div><div>五</div><div>六</div>
                </div>

                <div id="calendar-grid-container" style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;flex-shrink:0;">
                    ${daysHTML}
                </div>

                <div id="calendar-day-detail" style="flex:1;overflow-y:auto;margin-top:12px;padding-top:12px;border-top:1px solid var(--border-color);min-height:80px;max-height:300px;display:none;">
                    <!-- 动态加载当日记录列表 -->
                </div>

                <div style="display:flex;gap:8px;margin-top:12px;flex-shrink:0;">
                    <button id="calendar-close-btn" class="modal-btn modal-btn-secondary" style="flex:1;">关闭</button>
                </div>
            </div>
        `;

        modal.innerHTML = html;
        modal.style.display = 'flex';

        // ---- 事件绑定 ----
        // 关闭按钮
        modal.querySelector('#close-calendar-btn')?.addEventListener('click', closeCalendar);
        modal.querySelector('#calendar-close-btn')?.addEventListener('click', closeCalendar);

        // 点击背景关闭
        modal.addEventListener('click', function(e) {
            if (e.target === modal) closeCalendar();
        });

        // 月份切换
        modal.querySelector('#calendar-prev-month')?.addEventListener('click', function() {
            currentMonth--;
            if (currentMonth < 0) { currentMonth = 11; currentYear--; }
            renderCalendar(currentYear, currentMonth);
        });
        modal.querySelector('#calendar-next-month')?.addEventListener('click', function() {
            currentMonth++;
            if (currentMonth > 11) { currentMonth = 0; currentYear++; }
            renderCalendar(currentYear, currentMonth);
        });

        // 点击日期
        modal.querySelectorAll('.calendar-day.has-record').forEach(el => {
            el.addEventListener('click', function() {
                const dateStr = this.dataset.date;
                const dayRecords = grouped[dateStr] || [];
                renderDayRecords(dateStr, dayRecords, grouped);
            });
        });

        // 如果有目标记录ID，自动定位并打开
        if (targetRecordId) {
            const targetRecord = records.find(r => r.id === targetRecordId);
            if (targetRecord && targetRecord.date) {
                // 切换到目标记录的月份
                const targetDate = new Date(targetRecord.startTime);
                currentYear = targetDate.getFullYear();
                currentMonth = targetDate.getMonth();
                // 重新渲染并打开对应日期的记录
                setTimeout(() => {
                    renderCalendar(currentYear, currentMonth);
                    setTimeout(() => {
                        const dateStr = targetRecord.date;
                        const dayRecords = grouped[dateStr] || [];
                        if (dayRecords.length > 0) {
                            renderDayRecords(dateStr, dayRecords, grouped);
                            // 如果只有一条记录，直接进入详情
                            if (dayRecords.length === 1) {
                                setTimeout(() => {
                                    renderRecordDetail(dayRecords[0], grouped);
                                }, 200);
                            }
                        }
                    }, 100);
                }, 50);
            }
        }

        function closeCalendar() {
            const currentModal = document.getElementById('companion-calendar-modal');
            if (currentModal) {
                currentModal.style.display = 'none';
            }
        }
    }

    // 初始渲染
    renderCalendar(currentYear, currentMonth);
}

/**
 * 渲染当日记录列表
 */
function renderDayRecords(dateStr, dayRecords, grouped) {
    const detailContainer = document.getElementById('calendar-day-detail');
    if (!detailContainer) return;

    detailContainer.style.display = 'block';

    // 如果只有一条记录，直接进入详情
    if (dayRecords.length === 1) {
        renderRecordDetail(dayRecords[0], grouped);
        return;
    }

    // 多条记录，显示列表
    let html = `
        <div style="font-size:13px;font-weight:600;color:var(--text-primary);margin-bottom:10px;">
            📅 ${formatDetailTime(dateStr + 'T00:00:00')}
            <span style="font-size:11px;font-weight:400;color:var(--text-secondary);margin-left:6px;">共 ${dayRecords.length} 条</span>
        </div>
        <div style="display:flex;flex-direction:column;gap:6px;">
    `;

    // 按开始时间倒序排列
    const sorted = [...dayRecords].sort((a, b) => (b.startTime || '').localeCompare(a.startTime || ''));

    sorted.forEach((record, index) => {
        const modeLabel = {
            'completed': '✅ 完成陪伴',
            'interrupted': '⏸️ 中断',
            'system_interrupt': '🔄 系统中断'
        }[record.mode] || record.mode;

        const isEditable = isRecordEditable(record);

        html += `
            <div class="calendar-record-item" data-record-id="${record.id}" style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:var(--primary-bg);border-radius:10px;border:1px solid var(--border-color);cursor:pointer;transition:border-color 0.2s;">
                <div style="display:flex;flex-direction:column;gap:2px;">
                    <span style="font-size:13px;color:var(--text-primary);font-weight:500;">${modeLabel}</span>
                    <span style="font-size:11px;color:var(--text-secondary);">${formatDetailTime(record.startTime)} ~ ${formatDetailTime(record.endTime)}</span>
                </div>
                <span style="font-size:11px;color:var(--text-secondary);">${isEditable ? '✏️' : '🔒'}</span>
            </div>
        `;
    });

    html += `
        </div>
        <div style="margin-top:10px;">
            <button id="back-to-calendar-btn" style="background:none;border:none;color:var(--accent-color);cursor:pointer;font-size:12px;display:flex;align-items:center;gap:4px;">
                <i class="fas fa-arrow-left"></i> 返回日历
            </button>
        </div>
    `;

    detailContainer.innerHTML = html;

    // 绑定点击事件：点击记录进入详情
    detailContainer.querySelectorAll('.calendar-record-item').forEach(el => {
        el.addEventListener('click', function() {
            const id = this.dataset.recordId;
            const record = dayRecords.find(r => r.id === id);
            if (record) {
                renderRecordDetail(record, grouped);
            }
        });
        // hover 效果
        el.addEventListener('mouseenter', function() {
            this.style.borderColor = 'var(--accent-color)';
        });
        el.addEventListener('mouseleave', function() {
            this.style.borderColor = 'var(--border-color)';
        });
    });

    // 返回日历
    detailContainer.querySelector('#back-to-calendar-btn')?.addEventListener('click', function() {
        // 重新渲染日历（回到当前视图）
        const modal = document.getElementById('companion-calendar-modal');
        if (modal) {
            // 获取当前显示的年份和月份（从标题中提取）
            const titleEl = modal.querySelector('.modal-content > div:nth-child(2) > span');
            if (titleEl) {
                const parts = titleEl.textContent.trim().split('年');
                if (parts.length === 2) {
                    const year = parseInt(parts[0]);
                    const month = ['一月','二月','三月','四月','五月','六月','七月','八月','九月','十月','十一月','十二月'].indexOf(parts[1].trim());
                    if (!isNaN(year) && month !== -1) {
                        // 关闭详情，重新渲染日历
                        const container = document.getElementById('calendar-day-detail');
                        if (container) {
                            container.style.display = 'none';
                            container.innerHTML = '';
                        }
                        // 重新绑定日期的点击事件（但日历已经渲染好了，只是隐藏详情区域）
                        // 实际上，重新调用 renderCalendar 可能会重置状态，但为了保留月份，我们只重新渲染日历区域
                        // 更好：只隐藏详情，刷新日期的 dot 状态
                        const gridContainer = document.getElementById('calendar-grid-container');
                        if (gridContainer) {
                            // 重新加载记录
                            if (typeof window.loadCompanionRecords === 'function') {
                                window.loadCompanionRecords(function(records) {
                                    const newGrouped = {};
                                    records.forEach(r => {
                                        if (!r.date) return;
                                        if (!newGrouped[r.date]) newGrouped[r.date] = [];
                                        newGrouped[r.date].push(r);
                                    });
                                    // 重新渲染网格
                                    // 因为重新渲染逻辑较复杂，直接调用 renderCalendar 但保持当前年月
                                    const modalEl = document.getElementById('companion-calendar-modal');
                                    if (modalEl) {
                                        // 关闭再重新打开
                                        modalEl.style.display = 'none';
                                        setTimeout(() => {
                                            showCompanionRecords();
                                        }, 100);
                                    }
                                });
                            }
                        }
                    }
                }
            }
        }
    });
}

/**
 * 渲染记录详情页
 */
function renderRecordDetail(record, grouped) {
    const detailContainer = document.getElementById('calendar-day-detail');
    if (!detailContainer) return;

    detailContainer.style.display = 'block';

    const isEditable = isRecordEditable(record);
    const isSystemInterrupt = record.mode === 'system_interrupt';

    // 模式标签
    const modeLabels = {
        'completed': { icon: '✅', label: '完成陪伴', color: 'var(--accent-color)' },
        'interrupted': { icon: '⏸️', label: '中断', color: '#ff9f43' },
        'system_interrupt': { icon: '🔄', label: '系统中断', color: '#4a90e2' }
    };
    const modeInfo = modeLabels[record.mode] || { icon: '📝', label: record.mode || '记录', color: 'var(--text-secondary)' };

    // 格式化开始/结束时间用于显示
    const startDisplay = formatDetailTime(record.startTime);
    const endDisplay = formatDetailTime(record.endTime);
    const durationDisplay = formatDuration(record.duration);

    // 可编辑的字段
    let endTimeInput = '';
    if (isEditable && isSystemInterrupt) {
        // 系统中断：结束时间可编辑
        const endDate = record.endTime ? new Date(record.endTime) : new Date();
        const localStr = endDate.toISOString().slice(0, 16);
        endTimeInput = `
            <div style="display:flex;align-items:center;gap:8px;margin-top:6px;">
                <label style="font-size:12px;color:var(--text-secondary);">修改结束时间：</label>
                <input type="datetime-local" id="record-endtime-input" value="${localStr}" style="padding:4px 8px;border-radius:8px;border:1px solid var(--border-color);background:var(--primary-bg);color:var(--text-primary);font-size:12px;">
                <button id="record-endtime-save" style="padding:4px 12px;border-radius:8px;border:none;background:var(--accent-color);color:#fff;cursor:pointer;font-size:12px;">更新</button>
            </div>
        `;
    }

    // 中断原因（仅中断类型可编辑）
    let reasonHTML = '';
    if (record.mode === 'interrupted') {
        reasonHTML = `
            <div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border-color);">
                <div style="display:flex;align-items:center;justify-content:space-between;">
                    <span style="font-size:12px;color:var(--text-secondary);">📝 中断原因</span>
                    ${isEditable ? `<button id="record-edit-reason-btn" style="background:none;border:none;color:var(--accent-color);cursor:pointer;font-size:12px;">编辑</button>` : ''}
                </div>
                <div id="record-reason-display" style="font-size:13px;color:var(--text-primary);margin-top:4px;padding:6px 10px;background:var(--primary-bg);border-radius:8px;min-height:30px;word-break:break-word;">${record.interruptReason || '（未填写）'}</div>
                ${isEditable ? `
                    <div id="record-reason-edit" style="display:none;margin-top:6px;">
                        <textarea id="record-reason-textarea" rows="2" style="width:100%;padding:8px 10px;border-radius:8px;border:1px solid var(--border-color);background:var(--primary-bg);color:var(--text-primary);font-size:13px;resize:vertical;font-family:var(--font-family);">${record.interruptReason || ''}</textarea>
                        <div style="display:flex;gap:6px;margin-top:4px;">
                            <button id="record-reason-save" style="padding:4px 12px;border-radius:8px;border:none;background:var(--accent-color);color:#fff;cursor:pointer;font-size:12px;">保存</button>
                            <button id="record-reason-cancel" style="padding:4px 12px;border-radius:8px;border:none;background:var(--primary-bg);color:var(--text-secondary);cursor:pointer;font-size:12px;border:1px solid var(--border-color);">取消</button>
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    }

    // 感受（所有类型通用）
    let noteHTML = `
        <div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border-color);">
            <div style="display:flex;align-items:center;justify-content:space-between;">
                <span style="font-size:12px;color:var(--text-secondary);">💭 感受</span>
                ${isEditable ? `<button id="record-edit-note-btn" style="background:none;border:none;color:var(--accent-color);cursor:pointer;font-size:12px;">编辑</button>` : ''}
            </div>
            <div id="record-note-display" style="font-size:13px;color:var(--text-primary);margin-top:4px;padding:6px 10px;background:var(--primary-bg);border-radius:8px;min-height:30px;word-break:break-word;">${record.note || '（未填写）'}</div>
            ${isEditable ? `
                <div id="record-note-edit" style="display:none;margin-top:6px;">
                    <textarea id="record-note-textarea" rows="2" style="width:100%;padding:8px 10px;border-radius:8px;border:1px solid var(--border-color);background:var(--primary-bg);color:var(--text-primary);font-size:13px;resize:vertical;font-family:var(--font-family);">${record.note || ''}</textarea>
                    <div style="display:flex;gap:6px;margin-top:4px;">
                        <button id="record-note-save" style="padding:4px 12px;border-radius:8px;border:none;background:var(--accent-color);color:#fff;cursor:pointer;font-size:12px;">保存</button>
                        <button id="record-note-cancel" style="padding:4px 12px;border-radius:8px;border:none;background:var(--primary-bg);color:var(--text-secondary);cursor:pointer;font-size:12px;border:1px solid var(--border-color);">取消</button>
                    </div>
                </div>
            ` : ''}
        </div>
    `;

    const html = `
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
            <button id="back-to-day-list-btn" style="background:none;border:none;color:var(--accent-color);cursor:pointer;font-size:14px;padding:4px;"><i class="fas fa-arrow-left"></i></button>
            <span style="font-size:15px;font-weight:600;color:var(--text-primary);">📋 记录详情</span>
            <span style="font-size:11px;padding:2px 10px;border-radius:12px;background:rgba(var(--accent-color-rgb),0.1);color:${modeInfo.color};border:1px solid ${modeInfo.color}22;">${modeInfo.icon} ${modeInfo.label}</span>
            ${!isEditable ? `<span style="font-size:10px;color:var(--text-secondary);margin-left:auto;">🔒 超过3天不可修改</span>` : ''}
        </div>

        <div style="background:var(--primary-bg);border-radius:12px;padding:14px;margin-top:8px;border:1px solid var(--border-color);">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                <div>
                    <div style="font-size:10px;color:var(--text-secondary);">开始时间</div>
                    <div style="font-size:14px;font-weight:600;color:var(--text-primary);">${startDisplay}</div>
                </div>
                <div>
                    <div style="font-size:10px;color:var(--text-secondary);">睡眠时长</div>
                    <div style="font-size:14px;font-weight:600;color:var(--accent-color);">${durationDisplay}</div>
                </div>
            </div>
            <div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--border-color);">
                <div style="font-size:10px;color:var(--text-secondary);">结束时间</div>
                <div style="font-size:14px;font-weight:600;color:var(--text-primary);">${endDisplay}</div>
                ${endTimeInput}
            </div>
            ${isSystemInterrupt && isEditable ? `<div id="system-interrupt-hint" style="font-size:11px;color:var(--text-secondary);margin-top:4px;">💡 修改结束时间后，睡眠时长将自动更新</div>` : ''}
        </div>

        ${reasonHTML}
        ${noteHTML}

        <div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap;">
            <button id="record-delete-btn" style="padding:6px 16px;border-radius:8px;border:1px solid rgba(255,70,70,0.3);background:rgba(255,70,70,0.08);color:#ff6b6b;cursor:pointer;font-size:12px;transition:all 0.2s;">🗑️ 删除记录</button>
        </div>
    `;

    detailContainer.innerHTML = html;

    // ---- 绑定事件 ----

    // 返回按钮
    detailContainer.querySelector('#back-to-day-list-btn')?.addEventListener('click', function() {
        const dateStr = record.date;
        if (grouped && grouped[dateStr]) {
            renderDayRecords(dateStr, grouped[dateStr], grouped);
        } else {
            // 如果 grouped 不可用，重新加载记录
            if (typeof window.loadCompanionRecords === 'function') {
                window.loadCompanionRecords(function(records) {
                    const newGrouped = {};
                    records.forEach(r => {
                        if (!r.date) return;
                        if (!newGrouped[r.date]) newGrouped[r.date] = [];
                        newGrouped[r.date].push(r);
                    });
                    const dayRecords = newGrouped[dateStr] || [];
                    renderDayRecords(dateStr, dayRecords, newGrouped);
                });
            }
        }
    });

    // 删除记录
    detailContainer.querySelector('#record-delete-btn')?.addEventListener('click', function() {
        deleteRecord(record.id);
    });

    // 系统中断：更新结束时间
    if (isSystemInterrupt && isEditable) {
        const saveBtn = document.getElementById('record-endtime-save');
        const timeInput = document.getElementById('record-endtime-input');
        if (saveBtn && timeInput) {
            saveBtn.addEventListener('click', function() {
                const newEndTime = timeInput.value;
                if (!newEndTime) return;
                const newEndDate = new Date(newEndTime);
                if (isNaN(newEndDate.getTime())) return;

                const startDate = new Date(record.startTime);
                const newDuration = Math.max(0, newEndDate.getTime() - startDate.getTime());

                if (newDuration < 20 * 60 * 1000) {
                    showToast('时长不足20分钟，不能更新', 'warning');
                    return;
                }

                // 更新记录
                const updates = {
                    endTime: newEndDate.toISOString(),
                    duration: newDuration,
                    date: startDate.toISOString().split('T')[0]
                };

                if (typeof window.updateCompanionRecord === 'function') {
                    window.updateCompanionRecord(record.id, updates, function(success) {
                        if (success) {
                            showToast('结束时间已更新 ✓', 'success');
                            // 刷新详情
                            const updatedRecord = { ...record, ...updates };
                            renderRecordDetail(updatedRecord, grouped);
                            // 刷新日历
                            if (typeof window.loadCompanionRecords === 'function') {
                                window.loadCompanionRecords(function(records) {
                                    const newGrouped = {};
                                    records.forEach(r => {
                                        if (!r.date) return;
                                        if (!newGrouped[r.date]) newGrouped[r.date] = [];
                                        newGrouped[r.date].push(r);
                                    });
                                    // 更新 grouped 引用
                                    grouped = newGrouped;
                                });
                            }
                        } else {
                            showToast('更新失败，请重试', 'error');
                        }
                    });
                } else {
                    showToast('存储功能不可用', 'error');
                }
            });
        }
    }

    // 编辑中断原因
    if (isEditable && record.mode === 'interrupted') {
        const editBtn = document.getElementById('record-edit-reason-btn');
        const displayDiv = document.getElementById('record-reason-display');
        const editDiv = document.getElementById('record-reason-edit');
        const textarea = document.getElementById('record-reason-textarea');
        const saveBtn = document.getElementById('record-reason-save');
        const cancelBtn = document.getElementById('record-reason-cancel');

        if (editBtn && displayDiv && editDiv) {
            editBtn.addEventListener('click', function() {
                displayDiv.style.display = 'none';
                editDiv.style.display = 'block';
                if (textarea) textarea.focus();
            });
            if (saveBtn && textarea) {
                saveBtn.addEventListener('click', function() {
                    const newReason = textarea.value.trim();
                    if (typeof window.updateCompanionRecord === 'function') {
                        window.updateCompanionRecord(record.id, { interruptReason: newReason }, function(success) {
                            if (success) {
                                record.interruptReason = newReason;
                                displayDiv.textContent = newReason || '（未填写）';
                                displayDiv.style.display = 'block';
                                editDiv.style.display = 'none';
                                showToast('中断原因已更新 ✓', 'success');
                            } else {
                                showToast('更新失败', 'error');
                            }
                        });
                    }
                });
            }
            if (cancelBtn) {
                cancelBtn.addEventListener('click', function() {
                    displayDiv.style.display = 'block';
                    editDiv.style.display = 'none';
                    if (textarea) textarea.value = record.interruptReason || '';
                });
            }
        }
    }

    // 编辑感受
    if (isEditable) {
        const editBtn = document.getElementById('record-edit-note-btn');
        const displayDiv = document.getElementById('record-note-display');
        const editDiv = document.getElementById('record-note-edit');
        const textarea = document.getElementById('record-note-textarea');
        const saveBtn = document.getElementById('record-note-save');
        const cancelBtn = document.getElementById('record-note-cancel');

        if (editBtn && displayDiv && editDiv) {
            editBtn.addEventListener('click', function() {
                displayDiv.style.display = 'none';
                editDiv.style.display = 'block';
                if (textarea) textarea.focus();
            });
            if (saveBtn && textarea) {
                saveBtn.addEventListener('click', function() {
                    const newNote = textarea.value.trim();
                    if (typeof window.updateCompanionRecord === 'function') {
                        window.updateCompanionRecord(record.id, { note: newNote }, function(success) {
                            if (success) {
                                record.note = newNote;
                                displayDiv.textContent = newNote || '（未填写）';
                                displayDiv.style.display = 'block';
                                editDiv.style.display = 'none';
                                showToast('感受已更新 ✓', 'success');
                            } else {
                                showToast('更新失败', 'error');
                            }
                        });
                    }
                });
            }
            if (cancelBtn) {
                cancelBtn.addEventListener('click', function() {
                    displayDiv.style.display = 'block';
                    editDiv.style.display = 'none';
                    if (textarea) textarea.value = record.note || '';
                });
            }
        }
    }
}

// ============================================================
// 记录编辑工具
// ============================================================

/**
 * 更新记录字段
 */
function updateRecordField(recordId, field, value, callback) {
    if (typeof window.updateCompanionRecord === 'function') {
        window.updateCompanionRecord(recordId, { [field]: value }, function(success) {
            if (callback) callback(success);
        });
    } else {
        // 降级方案：直接修改 localStorage
        try {
            const key = 'companion_records';
            const data = localStorage.getItem(key);
            const records = data ? JSON.parse(data) : [];
            const idx = records.findIndex(r => r.id === recordId);
            if (idx === -1) { if (callback) callback(false); return; }
            records[idx][field] = value;
            localStorage.setItem(key, JSON.stringify(records));
            if (callback) callback(true);
        } catch (e) {
            if (callback) callback(false);
        }
    }
}

/**
 * 删除记录（含确认）
 */
function deleteRecord(recordId) {
    if (!recordId) return;
    if (!confirm('确定要删除这条陪伴记录吗？\n\n删除后不可恢复！')) return;

    if (typeof window.deleteCompanionRecord === 'function') {
        window.deleteCompanionRecord(recordId, function(success) {
            if (success) {
                showToast('记录已删除 ✓', 'success');
                // 返回日历
                const modal = document.getElementById('companion-calendar-modal');
                if (modal) {
                    modal.style.display = 'none';
                    setTimeout(() => showCompanionRecords(), 200);
                }
            } else {
                showToast('删除失败，请重试', 'error');
            }
        });
    } else {
        // 降级方案
        try {
            const key = 'companion_records';
            const data = localStorage.getItem(key);
            let records = data ? JSON.parse(data) : [];
            records = records.filter(r => r.id !== recordId);
            localStorage.setItem(key, JSON.stringify(records));
            showToast('记录已删除 ✓', 'success');
            const modal = document.getElementById('companion-calendar-modal');
            if (modal) {
                modal.style.display = 'none';
                setTimeout(() => showCompanionRecords(), 200);
            }
        } catch (e) {
            showToast('删除失败', 'error');
        }
    }
}

    // ============================================================
    // 初始化
    // ============================================================
    function initCompanionFeature() {
        console.log('[companion] 陪伴功能已加载（完整修复版）');
        window.showCompanionPicker = showCompanionPicker;
        window.openCompanion = showCompanionPicker;
        window.showCompanionRecords = showCompanionRecords;

        loadMusicList();
        stopMusic();
        stopAlarm();
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
