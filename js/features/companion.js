/**
 * companion.js - 陪伴睡眠功能核心模块（重构版）
 * 功能：音乐列表管理、倒计时、睡眠计时、闹钟、悬浮音乐控制
 * 依赖：state.js, data.js (提供存储接口)
 */
(function () {
    'use strict';

    // ============================================================
    // 1. 常量与状态
    // ============================================================
    const ACCIDENT_KEY = 'companionAccident';
    const MUSIC_STORAGE_KEY = 'companion_music_list';
    const MIN_VALID_MINUTES = 20;

    // 状态机
    const STATE = {
        IDLE: 'idle',
        SETUP: 'setup',                 // 在设置界面（选歌+倒计时）
        COUNTDOWN: 'countdown',         // 倒计时中
        READY_TO_START: 'ready_to_start', // 倒计时结束，等待点击“开始睡眠”（闹钟响）
        SLEEPING: 'sleeping',           // 睡眠计时中
        ENDED: 'ended',
    };

    // 会话对象
    let session = {
        state: STATE.IDLE,
        musicList: [],                  // 所有已导入的音乐
        selectedMusicId: null,          // 当前选中的音乐ID
        musicUrl: null,                 // 当前播放的URL
        musicTitle: '无音乐',
        countdownMinutes: 5,            // 用户选择的倒计时分钟数 (0-10)
        startTime: null,                // 入睡开始时间戳
        lastAliveTime: null,
        elapsed: 0,
        countdownRemain: 0,             // 倒计时剩余秒数
        rafId: null,
        countdownInterval: null,
        isEnding: false,
    };

    // 音频相关
    let audioElement = null;            // HTML5 Audio 实例
    let audioCtx = null;               // Web Audio Context (用于渐入渐出)
    let gainNode = null;               // 音量控制节点
    let mediaSource = null;            // MediaElementAudioSourceNode
    let isAudioReady = false;          // 是否已连接到 AudioContext
    let isPlaying = false;

    // 闹钟相关
    let alarmNodes = [];               // 闹钟声音节点
    let alarmInterval = null;

    // 屏幕常亮
    let wakeLock = null;

    // DOM 引用缓存
    let overlayEl = null;
    let contentEl = null;

    // 当前UI状态
    let currentUI = 'setup';           // 'setup' | 'sleeping'

    // ============================================================
    // 2. 工具函数（头像/名字提取）
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

    function showToast(msg, type = 'info') {
        if (typeof showNotification === 'function') {
            showNotification(msg, type);
        } else {
            console.log('[companion]', msg);
        }
    }

    // ============================================================
    // 3. 音乐列表存储
    // ============================================================
// ============================================================
// 3. 音乐列表存储
// ============================================================

// 内置默认音乐（硬编码，类似音乐播放器的 latestSystemSongs）
const DEFAULT_MUSIC = [
    {
        title: '雨声',
        sub: '舒缓的雨滴白噪音',
        url: 'https://SLY-NSX.github.io/loveNsx/audio/rain.mp3'
    },
    {
        title: '篝火',
        sub: '温暖的火苗噼啪声',
        url: 'https://SLY-NSX.github.io/loveNsx/audio/bonfire.mp3'
    }
];

function loadMusicList() {
    // 1. 先尝试从 localStorage 读取用户自定义列表
    try {
        const data = localStorage.getItem(MUSIC_STORAGE_KEY);
        if (data) {
            const parsed = JSON.parse(data);
            if (Array.isArray(parsed) && parsed.length > 0) {
                session.musicList = parsed;
                return;
            }
        }
    } catch (e) {}

    // 2. 没有本地数据时，使用硬编码的默认列表
    // 为每个默认项生成唯一 ID（只执行一次）
    const defaultWithIds = DEFAULT_MUSIC.map(item => ({
        ...item,
        id: 'comp_music_default_' + item.title + '_' + Date.now()
    }));
    session.musicList = defaultWithIds;
    saveMusicList(); // 保存到 localStorage
    console.log('[companion] 已加载内置默认音乐');
}

    function saveMusicList() {
        try {
            localStorage.setItem(MUSIC_STORAGE_KEY, JSON.stringify(session.musicList));
        } catch (e) {
            showToast('音乐列表保存失败，存储空间可能已满', 'error');
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
        // 如果当前在设置界面，重新渲染
        if (currentUI === 'setup') {
            renderSetupUI();
        }
    }

    function getMusicItem(id) {
        return session.musicList.find(item => item.id === id);
    }

    // ============================================================
    // 4. 音频播放引擎（渐入渐出）
    // ============================================================
    function getAudioContext() {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioCtx.state === 'suspended') {
            audioCtx.resume().catch(() => {});
        }
        return audioCtx;
    }

    function initAudioElement(url) {
        // 停止当前播放
        stopMusic();

        if (!url) {
            session.musicUrl = null;
            session.musicTitle = '无音乐';
            isAudioReady = false;
            return;
        }

        try {
            const ctx = getAudioContext();
            audioElement = new Audio(url);
            audioElement.loop = true;
            audioElement.crossOrigin = 'anonymous';
            audioElement.preload = 'auto';

            // 创建媒体源节点
            mediaSource = ctx.createMediaElementSource(audioElement);
            gainNode = ctx.createGain();
            gainNode.gain.value = 0; // 从0开始，渐入
            mediaSource.connect(gainNode);
            gainNode.connect(ctx.destination);

            isAudioReady = true;

            // 加载完成后自动播放
            audioElement.addEventListener('canplaythrough', function onReady() {
                audioElement.removeEventListener('canplaythrough', onReady);
                if (session.state === STATE.SETUP || session.state === STATE.COUNTDOWN ||
                    session.state === STATE.READY_TO_START || session.state === STATE.SLEEPING) {
                    playMusicWithFade();
                }
            });

            // 如果已经加载完成
            if (audioElement.readyState >= 3) {
                audioElement.removeEventListener('canplaythrough', onReady);
                if (session.state === STATE.SETUP || session.state === STATE.COUNTDOWN ||
                    session.state === STATE.READY_TO_START || session.state === STATE.SLEEPING) {
                    playMusicWithFade();
                }
            }

            audioElement.load();
            session.musicUrl = url;
        } catch (e) {
            console.error('[companion] 音频初始化失败:', e);
            showToast('音频加载失败，请检查链接是否有效', 'error');
            isAudioReady = false;
        }
    }

    function playMusicWithFade(duration = 2000) {
        if (!isAudioReady || !audioElement || !gainNode) {
            // 尝试重新初始化
            if (session.musicUrl) {
                initAudioElement(session.musicUrl);
                return;
            }
            return;
        }

        try {
            const ctx = getAudioContext();
            if (ctx.state === 'suspended') {
                ctx.resume().catch(() => {});
            }

            // 重置增益
            gainNode.gain.cancelScheduledValues(ctx.currentTime);
            gainNode.gain.value = 0;

            // 渐入
            const startTime = ctx.currentTime;
            gainNode.gain.linearRampToValueAtTime(0.8, startTime + duration / 1000);

            audioElement.play().then(() => {
                isPlaying = true;
                updateFloatingControlUI();
            }).catch(err => {
                console.warn('[companion] 播放失败:', err);
                // 静默失败，不打扰用户
            });
        } catch (e) {
            console.warn('[companion] 播放失败:', e);
        }
    }

    function fadeOutMusic(duration = 1500) {
        if (!isAudioReady || !gainNode || !audioCtx) {
            stopMusic();
            return;
        }

        try {
            const ctx = audioCtx;
            const currentGain = gainNode.gain.value;
            gainNode.gain.cancelScheduledValues(ctx.currentTime);
            gainNode.gain.setValueAtTime(currentGain, ctx.currentTime);
            gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + duration / 1000);

            setTimeout(() => {
                if (audioElement) {
                    try { audioElement.pause(); } catch (e) {}
                }
                isPlaying = false;
                updateFloatingControlUI();
            }, duration + 100);
        } catch (e) {
            stopMusic();
        }
    }

    function stopMusic() {
        try {
            if (audioElement) {
                audioElement.pause();
                audioElement.src = '';
                audioElement.load();
                audioElement = null;
            }
        } catch (e) {}
        try {
            if (mediaSource) {
                mediaSource.disconnect();
                mediaSource = null;
            }
        } catch (e) {}
        try {
            if (gainNode) {
                gainNode.disconnect();
                gainNode = null;
            }
        } catch (e) {}
        isAudioReady = false;
        isPlaying = false;
        session.musicUrl = null;
        updateFloatingControlUI();
    }

    function toggleMusicPlay() {
        if (!isAudioReady || !audioElement) {
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
            // 暂停（不淡出，直接暂停）
            try {
                audioElement.pause();
                isPlaying = false;
                updateFloatingControlUI();
            } catch (e) {}
        } else {
            // 恢复播放（渐入）
            try {
                const ctx = getAudioContext();
                if (ctx.state === 'suspended') ctx.resume().catch(() => {});
                if (gainNode) {
                    gainNode.gain.cancelScheduledValues(ctx.currentTime);
                    gainNode.gain.setValueAtTime(0, ctx.currentTime);
                    gainNode.gain.linearRampToValueAtTime(0.8, ctx.currentTime + 1.5);
                }
                audioElement.play().then(() => {
                    isPlaying = true;
                    updateFloatingControlUI();
                }).catch(() => {});
            } catch (e) {}
        }
    }

    // ============================================================
    // 5. 闹钟（自然风铃）
    // ============================================================
    function playAlarm() {
        stopAlarm();

        try {
            const ctx = getAudioContext();
            if (ctx.state === 'suspended') ctx.resume().catch(() => {});

            // 风铃音阶：C5, E5, G5, B5, C6
            const notes = [523.25, 659.25, 783.99, 987.77, 1046.50];
            const pattern = [0, 1, 2, 3, 4, 3, 2, 1, 0];

            let noteIndex = 0;

            function playNextNote() {
                if (session.state !== STATE.READY_TO_START && session.state !== STATE.COUNTDOWN) {
                    return;
                }

                const freq = notes[pattern[noteIndex % pattern.length]];
                noteIndex++;

                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.value = freq;
                gain.gain.value = 0;

                // 添加泛音使声音更丰富
                const osc2 = ctx.createOscillator();
                osc2.type = 'sine';
                osc2.frequency.value = freq * 2;
                const gain2 = ctx.createGain();
                gain2.gain.value = 0;

                // 包络
                const now = ctx.currentTime;
                const attack = 0.02;
                const decay = 0.8;
                const release = 1.5;

                gain.gain.setValueAtTime(0, now);
                gain.gain.linearRampToValueAtTime(0.15, now + attack);
                gain.gain.exponentialRampToValueAtTime(0.001, now + attack + decay);

                gain2.gain.setValueAtTime(0, now);
                gain2.gain.linearRampToValueAtTime(0.06, now + attack);
                gain2.gain.exponentialRampToValueAtTime(0.001, now + attack + decay);

                osc.connect(gain);
                gain.connect(ctx.destination);
                osc2.connect(gain2);
                gain2.connect(ctx.destination);

                osc.start(now);
                osc.stop(now + attack + decay + 0.1);
                osc2.start(now);
                osc2.stop(now + attack + decay + 0.1);

                alarmNodes.push(osc, osc2, gain, gain2);

                // 每1.8秒响一次
                alarmInterval = setTimeout(playNextNote, 1800);
            }

            // 先快速响三下，然后进入节奏
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

            // 主循环延迟启动
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
    // 6. 屏幕常亮
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
    // 7. UI 渲染 - 设置界面
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
            // 星光与呼吸光晕 (纯CSS) - 复用之前定义的样式
            const style = document.createElement('style');
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
                #companion-overlay .companion-btn-group .companion-btn {
                    min-width: 120px;
                }
                /* 音乐列表样式 */
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
                #companion-music-list .music-item .music-title {
                    flex: 1; text-align: left;
                }
                #companion-music-list .music-item .music-sub {
                    font-size: 11px; opacity: 0.5; margin-left: 6px;
                }
                #companion-music-list .music-item .music-delete {
                    color: rgba(255,255,255,0.3);
                    cursor: pointer;
                    font-size: 14px;
                    padding: 0 4px;
                    transition: color 0.2s;
                }
                #companion-music-list .music-item .music-delete:hover {
                    color: #ff6b6b;
                }
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
                .companion-setup-header .search-box input::placeholder {
                    color: rgba(255,255,255,0.3);
                }
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
                /* 悬浮音乐控制 */
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
                /* 小弹窗 (toast) */
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

            // 生成星星
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

            // 呼吸光晕
            const orb1 = document.createElement('div');
            orb1.className = 'breath-orb breath-orb-1';
            el.appendChild(orb1);
            const orb2 = document.createElement('div');
            orb2.className = 'breath-orb breath-orb-2';
            el.appendChild(orb2);

            // 内容容器
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
        if (overlay) {
            overlay.style.opacity = '0';
            setTimeout(() => {
                overlay.style.display = 'none';
                overlay.style.opacity = '1';
            }, 400);
        }
        // 隐藏悬浮控制
        const fc = document.getElementById('companion-floating-control');
        if (fc) fc.style.display = 'none';
    }

    // ============================================================
    // 8. 渲染 - 设置界面（主界面）
    // ============================================================
    let searchTerm = '';

    function renderSetupUI() {
        currentUI = 'setup';
        session.state = STATE.SETUP;

        // 加载音乐列表
        loadMusicList();

        const name = getPartnerName();
        const avatarHTML = getPartnerAvatarHTML();

        // 过滤音乐列表
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
                <input type="number" id="companion-countdown-input" min="0" max="10" value="${session.countdownMinutes}">
                <span>分钟</span>
            </div>

            <div style="font-size:11px;color:rgba(255,255,255,0.3);margin-top:-4px;">0分钟 = 不等待，直接开始</div>

            <div class="companion-setup-footer">
                <button class="companion-btn secondary" id="companion-setup-cancel">取消</button>
                <button class="companion-btn" id="companion-setup-confirm">确定</button>
            </div>
        `;

        renderOverlay(html);

        // ---- 绑定事件 ----

        // 搜索
        const searchInput = document.getElementById('companion-search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                searchTerm = e.target.value;
                renderSetupUI();
            });
        }

        // 添加音乐
        const addBtn = document.getElementById('companion-add-music-btn');
        if (addBtn) {
            addBtn.addEventListener('click', showAddMusicDialog);
        }

        // 点击音乐项
        document.querySelectorAll('#companion-music-list .music-item').forEach(item => {
            item.addEventListener('click', (e) => {
                // 如果点击的是删除按钮，不处理
                if (e.target.classList.contains('music-delete')) return;
                const id = item.dataset.id;
                selectMusic(id);
            });
        });

        // 删除音乐
        document.querySelectorAll('#companion-music-list .music-delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                if (confirm('确定要删除这首音乐吗？')) {
                    deleteMusicItem(id);
                }
            });
        });

        // 倒计时输入
        const countdownInput = document.getElementById('companion-countdown-input');
        if (countdownInput) {
            countdownInput.addEventListener('change', () => {
                let val = parseInt(countdownInput.value) || 0;
                val = Math.max(0, Math.min(10, val));
                session.countdownMinutes = val;
                countdownInput.value = val;
            });
        }

        // 取消
        const cancelBtn = document.getElementById('companion-setup-cancel');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                stopMusic();
                hideOverlay();
                session.state = STATE.IDLE;
                currentUI = 'idle';
            });
        }

        // 确定
        const confirmBtn = document.getElementById('companion-setup-confirm');
        if (confirmBtn) {
            confirmBtn.addEventListener('click', () => {
                // 读取倒计时
                const input = document.getElementById('companion-countdown-input');
                if (input) {
                    let val = parseInt(input.value) || 0;
                    val = Math.max(0, Math.min(10, val));
                    session.countdownMinutes = val;
                }

                // 开始流程
                startCountdown();
            });
        }

        // 更新浮动控制状态
        updateFloatingControlUI();
    }

    // ============================================================
    // 9. 选择音乐
    // ============================================================
    function selectMusic(id) {
        const item = getMusicItem(id);
        if (!item) return;

        // 如果选中的是同一首，切换播放/暂停
        if (session.selectedMusicId === id) {
            toggleMusicPlay();
            return;
        }

        // 停止当前音乐
        stopMusic();

        session.selectedMusicId = id;
        session.musicTitle = item.title;

        // 开始播放
        initAudioElement(item.url);

        // 重新渲染设置界面
        if (currentUI === 'setup') {
            renderSetupUI();
        }
    }

    // ============================================================
    // 10. 添加音乐对话框
    // ============================================================
    function showAddMusicDialog() {
        // 创建模态框
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

        // 上传本地文件
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

        const confirmBtn = document.getElementById('add-music-confirm');
        const cancelBtn = document.getElementById('add-music-cancel');

        if (confirmBtn) {
            confirmBtn.addEventListener('click', () => {
                const title = titleInput.value.trim();
                const sub = subInput.value.trim();
                const url = urlInput.value.trim();

                if (!title) {
                    showToast('请输入名称', 'warning');
                    return;
                }
                if (!url) {
                    showToast('请输入音频链接或上传文件', 'warning');
                    return;
                }

                const item = addMusicItem(title, sub, url);
                // 自动选中新添加的音乐
                selectMusic(item.id);
                document.body.removeChild(overlay);
                // 刷新设置界面
                if (currentUI === 'setup') {
                    renderSetupUI();
                }
            });
        }

        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                document.body.removeChild(overlay);
            });
        }

        // 点击背景关闭
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                document.body.removeChild(overlay);
            }
        });

        // 自动聚焦
        setTimeout(() => titleInput?.focus(), 100);
    }

    // ============================================================
    // 11. 倒计时与睡眠流程
    // ============================================================
    function startCountdown() {
        const minutes = session.countdownMinutes || 0;

        // 如果有选音乐但没播放，确保播放
        if (session.selectedMusicId && !isAudioReady) {
            const item = getMusicItem(session.selectedMusicId);
            if (item) {
                initAudioElement(item.url);
                session.musicTitle = item.title;
            }
        }

        if (minutes <= 0) {
            // 0分钟：直接进入"准备开始"状态，闹钟不响
            session.state = STATE.READY_TO_START;
            session.countdownRemain = 0;
            // 关闭设置界面
            hideOverlay();
            // 直接显示"开始睡眠"弹窗（无闹钟）
            showReadyToStart(false);
            return;
        }

        // 开始倒计时
        session.state = STATE.COUNTDOWN;
        session.countdownRemain = minutes * 60;

        // 关闭设置界面（音乐继续播放）
        hideOverlay();

        // 请求屏幕常亮
        requestWakeLock();

        // 启动倒计时
        if (session.countdownInterval) clearInterval(session.countdownInterval);
        session.countdownInterval = setInterval(() => {
            session.countdownRemain--;
            if (session.countdownRemain <= 0) {
                clearInterval(session.countdownInterval);
                session.countdownInterval = null;
                // 倒计时结束，显示"开始睡眠"（闹钟响起）
                session.state = STATE.READY_TO_START;
                showReadyToStart(true);
            }
        }, 1000);

        // 写入遗言
        backupAccident();

        // 显示一个提示（非侵入）
        showToast(`⏱ 倒计时 ${minutes} 分钟，到点会提醒你`, 'info');
    }

    // ============================================================
    // 12. "开始睡眠"弹窗
    // ============================================================
    function showReadyToStart(withAlarm) {
        if (session.state === STATE.ENDED) return;

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

        // 如果带闹钟，播放闹钟
        if (withAlarm) {
            playAlarm();
        }

        // 绑定事件
        document.getElementById('companion-start-sleep')?.addEventListener('click', () => {
            // 停止闹钟
            stopAlarm();
            // 开始睡眠计时
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
    // 13. 睡眠计时
    // ============================================================
function startSleepTracking() {
    if (session.state === STATE.ENDED) return;
    session.state = STATE.SLEEPING;
    session.startTime = Date.now();
    session.elapsed = 0;
    session.lastAliveTime = Date.now();
    session._autoStopped = false;

    // 更新UI为大睡眠界面
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

    // 添加悬浮音乐控制
    addFloatingControl();

    // 启动计时器
    startTimer();

    // 写入遗言
    backupAccident();

    // 绑定事件
    document.getElementById('companion-end-sleep')?.addEventListener('click', () => {
        endSession('completed');
    });
    document.getElementById('companion-interrupt-sleep')?.addEventListener('click', () => {
        endSession('interrupted');
    });

    console.log('[companion] 睡眠计时开始');
}

    // ============================================================
    // 14. 悬浮音乐控制
    // ============================================================
    function addFloatingControl() {
        let fc = document.getElementById('companion-floating-control');
        if (!fc) {
            fc = document.createElement('div');
            fc.id = 'companion-floating-control';
            fc.innerHTML = `
                <span class="fc-title" id="fc-title">无音乐</span>
                <button class="fc-btn" id="fc-play-btn"><i class="fas fa-play"></i></button>
                <button class="fc-btn" id="fc-select-btn"><i class="fas fa-list"></i></button>
            `;
            // 添加到 overlay 中
            const overlay = document.getElementById('companion-overlay');
            if (overlay) {
                overlay.appendChild(fc);
            } else {
                document.body.appendChild(fc);
            }

            // 绑定事件
            document.getElementById('fc-play-btn')?.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleMusicPlay();
            });

            document.getElementById('fc-select-btn')?.addEventListener('click', (e) => {
                e.stopPropagation();
                showMusicSelectPopup();
            });
        }

        // 更新显示
        updateFloatingControlUI();

        // 显示
        fc.style.display = 'flex';

        // 先确保 overlay 中有这个元素
        const overlay = document.getElementById('companion-overlay');
        if (overlay && fc.parentElement !== overlay) {
            overlay.appendChild(fc);
        }
    }

    function updateFloatingControlUI() {
        const fc = document.getElementById('companion-floating-control');
        if (!fc) return;

        const titleEl = document.getElementById('fc-title');
        const playBtn = document.getElementById('fc-play-btn');

        if (titleEl) {
            titleEl.textContent = session.musicTitle || '无音乐';
        }

        if (playBtn) {
            playBtn.innerHTML = isPlaying ? '<i class="fas fa-pause"></i>' : '<i class="fas fa-play"></i>';
        }
    }

    function showMusicSelectPopup() {
        // 创建一个简单的选择列表浮层
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

        // 点击选择
        overlay.querySelectorAll('.music-select-item').forEach(el => {
            el.addEventListener('click', () => {
                const id = el.dataset.id;
                selectMusic(id);
                document.body.removeChild(overlay);
                // 更新悬浮控制
                updateFloatingControlUI();
            });
        });

        // 关闭
        overlay.querySelector('#music-select-close')?.addEventListener('click', () => {
            document.body.removeChild(overlay);
        });

        // 停止音乐
        overlay.querySelector('#music-select-stop')?.addEventListener('click', () => {
            stopMusic();
            session.selectedMusicId = null;
            session.musicTitle = '无音乐';
            updateFloatingControlUI();
            document.body.removeChild(overlay);
            // 如果当前在睡眠界面，重新渲染以更新状态
            if (session.state === STATE.SLEEPING) {
                // 只更新标题，不重绘整个界面
                const titleEl = document.getElementById('fc-title');
                if (titleEl) titleEl.textContent = '无音乐';
            }
        });

        // 点击背景关闭
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                document.body.removeChild(overlay);
            }
        });
    }

    // ============================================================
    // 15. 计时器
    // ============================================================
function startTimer() {
    if (session.rafId) cancelAnimationFrame(session.rafId);
    const start = Date.now();
    const baseElapsed = session.elapsed || 0;

    function tick() {
        if (session.state !== STATE.SLEEPING) {
            return;
        }
        const now = Date.now();
        session.elapsed = baseElapsed + (now - start);
        session.lastAliveTime = now;

        updateSleepTimerUI();

        if (session.state === STATE.SLEEPING && session.elapsed >= 30 * 60 * 1000) {
            hideStatusText();
        }

        if (session.state === STATE.SLEEPING && session.elapsed >= 60 * 60 * 1000 && isPlaying) {
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
    // 16. 结束会话
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
            showInterruptReasonToast(record, () => {
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
    // 17. 记录保存与清理
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

    // ============================================================
    // 18. Toast弹窗（中断原因 / 完成）
    // ============================================================
    function showInterruptReasonToast(record, onSave) {
        const toast = document.createElement('div');
        toast.className = 'companion-toast open';
        toast.id = 'companion-toast-temp';
        toast.innerHTML = `
            <div class="toast-box">
                <div class="toast-title">⏸️ 睡眠中断</div>
                <div class="toast-body">
                    <div>开始时间：${formatTime(record.startTime)}</div>
                    <div>持续时间：${formatDuration(record.duration)}</div>
                    <div style="margin-top:12px;">
                        <label style="font-size:13px;color:rgba(255,255,255,0.5);">中断原因（选填）</label>
                        <input type="text" id="interrupt-reason-input" placeholder="例如：被电话吵醒..." maxlength="100">
                    </div>
                </div>
                <button class="toast-btn" id="toast-confirm-btn">确认保存</button>
                <div style="margin-top:8px;">
                    <button class="toast-btn" id="toast-skip-btn" style="background:transparent;border:1px solid rgba(255,255,255,0.1);padding:6px 16px;font-size:13px;">不保存原因</button>
                </div>
            </div>
        `;
        document.body.appendChild(toast);

        const confirmBtn = toast.querySelector('#toast-confirm-btn');
        const skipBtn = toast.querySelector('#toast-skip-btn');
        const input = toast.querySelector('#interrupt-reason-input');

        const doSave = (reason) => {
            record.interruptReason = reason || '';
            document.body.removeChild(toast);
            if (onSave) onSave();
        };

        confirmBtn.addEventListener('click', () => doSave(input.value.trim()));
        skipBtn.addEventListener('click', () => doSave(''));
    }

    function showCompletionToast(record, onSave) {
        const toast = document.createElement('div');
        toast.className = 'companion-toast open';
        toast.id = 'companion-toast-temp';
        toast.innerHTML = `
            <div class="toast-box">
                <div class="toast-title">🌙 好梦</div>
                <div class="toast-body">
                    <div>开始时间：${formatTime(record.startTime)}</div>
                    <div>持续时间：${formatDuration(record.duration)}</div>
                    <div>结束时间：${formatTime(record.endTime)}</div>
                </div>
                <button class="toast-btn" id="toast-confirm-btn">好的</button>
            </div>
        `;
        document.body.appendChild(toast);

        const confirmBtn = toast.querySelector('#toast-confirm-btn');
        confirmBtn.addEventListener('click', () => {
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
    // 19. 遗言机制
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

        const record = {
            id: 'comp_sys_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
            date: startTime ? startTime.toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
            startTime: startTime ? startTime.toISOString() : new Date().toISOString(),
            endTime: endTime.toISOString(),
            duration: durationMs,
            mode: 'system_interrupt',
            soundType: accidentData.musicTitle || '未知',
            status: '系统中断',
            interruptReason: '页面意外退出',
            isSystemInterrupt: true,
        };

        try {
            if (typeof window.saveCompanionRecord === 'function') {
                window.saveCompanionRecord(record);
            } else {
                const key = 'companion_records';
                let records = JSON.parse(localStorage.getItem(key) || '[]');
                records.push(record);
                localStorage.setItem(key, JSON.stringify(records));
            }
            showToast('检测到未完成的陪伴，已自动补录系统中断记录', 'warning');
        } catch (e) {
            console.error('[companion] 补录失败:', e);
        }

        clearAccident();
        resetSession();
        currentUI = 'idle';
    };

    // ============================================================
    // 20. 重置会话
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
        // 不停止音乐，由调用者决定
    }

    // ============================================================
    // 21. 对外入口
    // ============================================================
    function showCompanionPicker() {
        // 检查是否已有进行中的会话
        if (session.state === STATE.SLEEPING || session.state === STATE.COUNTDOWN || session.state === STATE.READY_TO_START) {
            showToast('已有进行中的陪伴，请先结束当前会话', 'warning');
            return;
        }

        // 重置状态
        resetSession();
        session.state = STATE.SETUP;
        currentUI = 'setup';

        // 加载音乐列表
        loadMusicList();

        // 渲染设置界面
        renderSetupUI();
    }

    // ============================================================
    // 22. 初始化
    // ============================================================
    function initCompanionFeature() {
        console.log('[companion] 陪伴功能已加载（重构版）');

        // 暴露入口
        window.showCompanionPicker = showCompanionPicker;
        window.openCompanion = showCompanionPicker;

        // 加载音乐列表
        loadMusicList();

        // 清理可能的残留音频
        stopMusic();
        stopAlarm();

        // 如果有正在播放的声音但状态丢失，清理
        if (session.state === STATE.IDLE) {
            stopMusic();
        }
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

    // 暴露初始化
    window.initCompanionFeature = initCompanionFeature;

    console.log('[companion] 模块加载完成（重构版）');

})();