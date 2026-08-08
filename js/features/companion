/**
 * companion.js - 陪伴睡眠功能核心模块
 * 依赖：state.js, data.js (提供存储接口)
 */
(function () {
    'use strict';

    // ============================================================
    // 1. 常量与状态
    // ============================================================
    const STORAGE_KEY = 'companion_session';
    const ACCIDENT_KEY = 'companionAccident';
    const WAIT_MINUTES = 5;          // 5分钟倒计时
    const MIN_VALID_MINUTES = 20;    // 不足20分钟不记录

    // 预设白噪音类型
    const SOUND_TYPES = {
        piano: '钢琴',
        rain: '下雨',
        wave: '海浪',
        fire: '篝火'
    };

    // 状态机
    const STATE = {
        IDLE: 'idle',                     // 空闲
        SELECTING: 'selecting',           // 选择音效中
        COUNTDOWN: 'countdown',           // 5分钟倒计时（后台）
        READY_TO_START: 'ready_to_start', // 倒计时结束，等待用户点击“开始睡眠”
        SLEEPING: 'sleeping',             // 睡眠计时中
        ENDED: 'ended',                   // 已结束（正常/中断）
    };

    // 当前会话对象（内存中）
    let session = {
        state: STATE.IDLE,
        soundType: null,
        soundNode: null,          // AudioBufferSourceNode
        gainNode: null,           // 音量控制
        filterNode: null,         // 用于音效漂移
        lfoNode: null,            // LFO振荡器
        startTime: null,          // 入睡开始时间戳（点击“开始睡眠”时记录）
        lastAliveTime: null,      // 最后一次心跳时间（每秒更新）
        elapsed: 0,               // 已持续毫秒
        countdownRemain: WAIT_MINUTES * 60, // 倒计时剩余秒数
        rafId: null,              // requestAnimationFrame ID
        countdownInterval: null,  // 倒计时定时器
        isEnding: false,          // 防止重复结束
    };

    let audioCtx = null;
    let wakeLock = null;          // 屏幕常亮

    // ============================================================
    // 2. DOM 工具函数（头像/名字提取，参考call.js）
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

    // ============================================================
    // 3. 屏幕常亮 (Wake Lock)
    // ============================================================
    async function requestWakeLock() {
        try {
            if ('wakeLock' in navigator) {
                wakeLock = await navigator.wakeLock.request('screen');
                console.log('[companion] 屏幕常亮已启用');
                return true;
            }
        } catch (err) {
            console.warn('[companion] 屏幕常亮请求失败:', err);
        }
        return false;
    }

    function releaseWakeLock() {
        if (wakeLock) {
            try { wakeLock.release(); wakeLock = null; } catch (e) {}
        }
    }

    // ============================================================
    // 4. Web Audio 白噪音合成引擎（30秒循环 + 参数漂移）
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

    // 4.1 工具：生成白噪声缓冲
    function createWhiteNoiseBuffer(duration, sampleRate) {
        const bufferSize = Math.floor(duration * sampleRate);
        const buffer = audioCtx.createBuffer(1, bufferSize, sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2) - 1;
        }
        return buffer;
    }

    // 4.2 工具：生成粉红噪声缓冲
    function createPinkNoiseBuffer(duration, sampleRate) {
        const bufferSize = Math.floor(duration * sampleRate);
        const buffer = audioCtx.createBuffer(1, bufferSize, sampleRate);
        const data = buffer.getChannelData(0);
        let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
        for (let i = 0; i < bufferSize; i++) {
            const white = (Math.random() * 2) - 1;
            b0 = 0.99886 * b0 + white * 0.0555179;
            b1 = 0.99332 * b1 + white * 0.0750759;
            b2 = 0.96900 * b2 + white * 0.1538520;
            b3 = 0.86650 * b3 + white * 0.3104856;
            b4 = 0.55000 * b4 + white * 0.5329522;
            b5 = -0.7616 * b5 - white * 0.0168980;
            const pink = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
            b6 = white * 0.115926;
            data[i] = pink * 0.11; // 归一化
        }
        return buffer;
    }

    // 4.3 钢琴：30秒循环琶音
    function createPianoBuffer(duration, sampleRate) {
        const bufferSize = Math.floor(duration * sampleRate);
        const buffer = audioCtx.createBuffer(1, bufferSize, sampleRate);
        const data = buffer.getChannelData(0);
        const notes = [523.25, 587.33, 659.25, 783.99, 880.00, 987.77]; // C5-B5
        const pattern = [0, 1, 2, 3, 4, 5, 4, 3, 2, 1];
        const totalPatterns = Math.floor(duration / 3.5); // 每3.5秒循环一次
        const patternDuration = 3.5;

        for (let p = 0; p < totalPatterns; p++) {
            const baseTime = p * patternDuration;
            for (let i = 0; i < pattern.length; i++) {
                const noteTime = baseTime + i * 0.25;
                const freq = notes[pattern[i]];
                const amp = 0.15;
                const envDuration = 0.5;
                const startIdx = Math.floor(noteTime * sampleRate);
                const endIdx = Math.floor((noteTime + envDuration) * sampleRate);
                for (let j = startIdx; j < endIdx && j < bufferSize; j++) {
                    const t = (j - startIdx) / sampleRate;
                    const env = Math.exp(-t * 8) * amp;
                    const val = Math.sin(2 * Math.PI * freq * t) * env;
                    data[j] += val;
                }
            }
        }
        // 归一化
        let max = 0;
        for (let i = 0; i < bufferSize; i++) if (Math.abs(data[i]) > max) max = Math.abs(data[i]);
        if (max > 0) for (let i = 0; i < bufferSize; i++) data[i] /= max * 1.2;
        return buffer;
    }

    // 4.4 下雨：粉红噪声 + 低通滤波 + LFO调制
    function createRainBuffer(duration, sampleRate) {
        return createPinkNoiseBuffer(duration, sampleRate);
    }
    // 注：下雨的滤波器会在playSound中动态设置

    // 4.5 海浪：白噪声 + 梳状滤波模拟波浪
    function createWaveBuffer(duration, sampleRate) {
        const buffer = createWhiteNoiseBuffer(duration, sampleRate);
        // 在播放时使用梳状滤波器，此处只生成噪声
        return buffer;
    }

    // 4.6 篝火：随机脉冲噪声
    function createFireBuffer(duration, sampleRate) {
        const bufferSize = Math.floor(duration * sampleRate);
        const buffer = audioCtx.createBuffer(1, bufferSize, sampleRate);
        const data = buffer.getChannelData(0);
        // 随机噼啪声
        for (let i = 0; i < bufferSize; i++) {
            if (Math.random() < 0.008) { // 约0.8%的概率产生脉冲
                const amp = (Math.random() * 0.3 + 0.1);
                const len = Math.floor(Math.random() * 300 + 100);
                for (let j = 0; j < len && i + j < bufferSize; j++) {
                    const decay = 1 - j / len;
                    data[i + j] += (Math.random() * 2 - 1) * amp * decay;
                }
                i += len;
            }
        }
        let max = 0;
        for (let i = 0; i < bufferSize; i++) if (Math.abs(data[i]) > max) max = Math.abs(data[i]);
        if (max > 0) for (let i = 0; i < bufferSize; i++) data[i] /= max * 0.8;
        return buffer;
    }

    // 4.7 主播放函数
    function playSound(type, volume = 0.5) {
        stopSound();

        const ctx = getAudioContext();
        const sampleRate = ctx.sampleRate;
        const duration = 30; // 30秒循环

        let buffer = null;
        let useFilter = false;
        let filterType = 'lowpass';
        let filterFreq = 2000;

        switch (type) {
            case SOUND_TYPES.piano:
                buffer = createPianoBuffer(duration, sampleRate);
                break;
            case SOUND_TYPES.rain:
                buffer = createRainBuffer(duration, sampleRate);
                useFilter = true;
                filterType = 'lowpass';
                filterFreq = 800; // 低频雨声
                break;
            case SOUND_TYPES.wave:
                buffer = createWaveBuffer(duration, sampleRate);
                useFilter = true;
                filterType = 'lowpass';
                filterFreq = 600;
                break;
            case SOUND_TYPES.fire:
                buffer = createFireBuffer(duration, sampleRate);
                useFilter = true;
                filterType = 'lowpass';
                filterFreq = 1200;
                break;
            default:
                return;
        }

        if (!buffer) return;

        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;
        source.loopEnd = duration;

        const gain = ctx.createGain();
        gain.gain.value = Math.min(volume, 1.0);

        let output = gain;
        let filter = null;

        if (useFilter) {
            filter = ctx.createBiquadFilter();
            filter.type = filterType;
            filter.frequency.value = filterFreq;
            filter.Q.value = 1.0;
            source.connect(filter);
            filter.connect(gain);
            output = gain;
            session.filterNode = filter;
        } else {
            source.connect(gain);
        }

        gain.connect(ctx.destination);

        source.start(0);

        // 保存节点以便停止
        session.soundNode = source;
        session.gainNode = gain;

        // --- 参数漂移 (LFO) ---
        if (useFilter && filter) {
            const lfo = ctx.createOscillator();
            lfo.type = 'sine';
            lfo.frequency.value = 0.1; // 每10秒一个周期
            const lfoGain = ctx.createGain();
            lfoGain.gain.value = 150; // 频率漂移范围 ±150Hz
            lfo.connect(lfoGain);
            lfoGain.connect(filter.frequency);
            lfo.start(0);
            session.lfoNode = lfo;
        } else if (type === SOUND_TYPES.piano) {
            // 钢琴：用LFO微调节奏感
            const lfo = ctx.createOscillator();
            lfo.type = 'sine';
            lfo.frequency.value = 0.05;
            const lfoGain = ctx.createGain();
            lfoGain.gain.value = 0.02;
            lfo.connect(lfoGain);
            // 连接到gain做微颤音
            // 用另一个gain node做AM
            const amGain = ctx.createGain();
            amGain.gain.value = 0.5;
            const amOffset = ctx.createConstantSource();
            amOffset.offset.value = 0.5;
            amOffset.connect(amGain);
            // 简化：直接在gain上做微调
            lfoGain.connect(gain.gain);
            lfo.start(0);
            session.lfoNode = lfo;
        }

        console.log('[companion] 白噪音已启动:', type);
    }

    function stopSound() {
        try {
            if (session.soundNode) {
                session.soundNode.stop();
                session.soundNode.disconnect();
                session.soundNode = null;
            }
            if (session.gainNode) {
                session.gainNode.disconnect();
                session.gainNode = null;
            }
            if (session.filterNode) {
                session.filterNode.disconnect();
                session.filterNode = null;
            }
            if (session.lfoNode) {
                session.lfoNode.stop();
                session.lfoNode.disconnect();
                session.lfoNode = null;
            }
        } catch (e) {}
    }

    // ============================================================
    // 5. 计时器核心
    // ============================================================
    function startTimer() {
        if (session.rafId) cancelAnimationFrame(session.rafId);
        const start = Date.now();
        const baseElapsed = session.elapsed || 0;

        function tick() {
            if (session.state !== STATE.SLEEPING && session.state !== STATE.READY_TO_START) {
                // 如果不在睡眠或待开始状态，停止计时
                return;
            }
            const now = Date.now();
            session.elapsed = baseElapsed + (now - start);
            session.lastAliveTime = now;

            // 更新UI中的计时器
            updateSleepTimerUI();

            // 检查是否满30分钟（状态语消失）
            if (session.state === STATE.SLEEPING && session.elapsed >= 30 * 60 * 1000) {
                hideStatusText();
            }

            // 写入遗言（每秒更新lastAliveTime）
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

    // ============================================================
    // 6. UI 渲染函数
    // ============================================================

    // 6.1 获取/创建全屏遮罩容器
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
            // 星光与呼吸光晕 (纯CSS)
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
                    color: rgba(255,255,255,0.9);
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
                /* 小弹窗 */
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
        return el;
    }

    function getContentContainer() {
        return document.getElementById('companion-content');
    }

    // 6.2 渲染全屏界面
    function renderOverlay(html) {
        const overlay = getOverlayContainer();
        const content = getContentContainer();
        if (content) content.innerHTML = html;
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

    // 6.3 状态语预设
    const STATUS_MESSAGES = [
        '你先休息，我处理一些事情',
        '✨ 已进入梦境',
        '稍等一下，我马上来',
        '来吧，一起休息 🌙'
    ];

    function getRandomStatus() {
        return STATUS_MESSAGES[Math.floor(Math.random() * STATUS_MESSAGES.length)];
    }

    // ============================================================
    // 7. 核心业务流程
    // ============================================================

    // 7.0 选择音效界面（对外入口）
    window.showCompanionPicker = function () {
        if (session.state === STATE.SLEEPING || session.state === STATE.COUNTDOWN || session.state === STATE.READY_TO_START) {
            showToast('已有进行中的陪伴，请先结束当前会话', 'warning');
            return;
        }
        // 重置会话
        resetSession();
        session.state = STATE.SELECTING;

        const html = `
            <div style="margin-bottom:16px;font-size:20px;font-weight:600;">🧘 选择白噪音</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;width:100%;max-width:300px;margin-bottom:20px;">
                ${Object.values(SOUND_TYPES).map(type => `
                    <button class="companion-btn secondary" data-sound="${type}" style="padding:12px 0;font-size:15px;min-width:unset;">
                        ${type}
                    </button>
                `).join('')}
            </div>
            <button class="companion-btn secondary" id="companion-cancel-picker" style="background:transparent;border:1px solid rgba(255,255,255,0.1);padding:8px 20px;font-size:13px;">取消</button>
        `;
        renderOverlay(html);

        // 绑定音效选择
        document.querySelectorAll('[data-sound]').forEach(btn => {
            btn.addEventListener('click', () => {
                const sound = btn.dataset.sound;
                startCountdown(sound);
            });
        });
        document.getElementById('companion-cancel-picker')?.addEventListener('click', () => {
            hideOverlay();
            session.state = STATE.IDLE;
        });
    };

    // 7.1 开始5分钟倒计时
    function startCountdown(soundType) {
        session.soundType = soundType;
        session.state = STATE.COUNTDOWN;
        session.countdownRemain = WAIT_MINUTES * 60;

        // 开始播放白噪音
        playSound(soundType, 0.5);

        // 显示"倒计时中"界面（但按照需求，5分钟完全隐形，不显示任何UI）
        // 所以我们直接隐藏弹窗，后台倒计时
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
                // 倒计时结束，弹出“开始睡眠”界面
                showReadyToStart();
            }
        }, 1000);

        // 写入遗言（倒计时状态）
        backupAccident();

        console.log('[companion] 开始5分钟倒计时，白噪音已播放');
    }

    // 7.2 倒计时结束，显示“开始睡眠”
    function showReadyToStart() {
        if (session.state === STATE.ENDED) return;
        session.state = STATE.READY_TO_START;
        session.lastAliveTime = Date.now();
        backupAccident();

        const name = getPartnerName();
        const avatarHTML = getPartnerAvatarHTML();

        const html = `
            <div class="companion-avatar">${avatarHTML}</div>
            <div class="companion-name">${name}</div>
            <div style="font-size:14px;color:rgba(255,255,255,0.5);margin-top:-4px;">已准备好陪伴</div>
            <div style="margin:18px 0 6px;font-size:15px;color:rgba(255,255,255,0.7);">🌙 可以开始入睡了</div>
            <button class="companion-btn" id="companion-start-sleep" style="margin-top:12px;">开始睡眠</button>
            <button class="companion-btn secondary" id="companion-cancel-session" style="margin-top:8px;padding:8px 20px;font-size:13px;background:rgba(255,255,255,0.05);">取消</button>
        `;
        renderOverlay(html);

        document.getElementById('companion-start-sleep')?.addEventListener('click', () => {
            startSleepTracking();
        });
        document.getElementById('companion-cancel-session')?.addEventListener('click', () => {
            endSession('cancelled');
        });
    }

    // 7.3 开始睡眠计时
    function startSleepTracking() {
        if (session.state === STATE.ENDED) return;
        session.state = STATE.SLEEPING;
        session.startTime = Date.now();
        session.elapsed = 0;
        session.lastAliveTime = Date.now();

        // 更新UI为大睡眠界面
        const name = getPartnerName();
        const avatarHTML = getPartnerAvatarHTML();
        const status = getRandomStatus();

        const html = `
            <div class="companion-avatar">${avatarHTML}</div>
            <div class="companion-name">${name}</div>
            <div class="companion-status" id="companion-status-text">${status}</div>
            <div class="companion-timer" id="companion-timer-display">00:00</div>
            <div class="companion-btn-group">
                <button class="companion-btn" id="companion-end-sleep">结束睡眠</button>
                <button class="companion-btn danger" id="companion-interrupt-sleep">中断</button>
            </div>
        `;
        renderOverlay(html);

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

    // 7.4 结束会话（正常/中断）
    function endSession(mode) {
        if (session.isEnding) return;
        if (session.state !== STATE.SLEEPING && session.state !== STATE.READY_TO_START) {
            // 如果是取消倒计时
            if (session.state === STATE.COUNTDOWN) {
                clearInterval(session.countdownInterval);
                session.countdownInterval = null;
                stopSound();
                releaseWakeLock();
                hideOverlay();
                resetSession();
                return;
            }
            return;
        }
        session.isEnding = true;

        // 停止计时
        stopTimer();
        clearInterval(session.countdownInterval);

        const elapsedMs = session.elapsed || 0;
        const elapsedMinutes = elapsedMs / (60 * 1000);

        // 如果不足20分钟，静默丢弃
        if (elapsedMinutes < MIN_VALID_MINUTES && mode !== 'cancelled') {
            // 不足20分钟，不记录，直接清理
            stopSound();
            releaseWakeLock();
            hideOverlay();
            showToast(`陪伴时长不足${MIN_VALID_MINUTES}分钟，不生成记录`, 'info');
            resetSession();
            session.isEnding = false;
            return;
        }

        // 计算时间
        const startDate = session.startTime ? new Date(session.startTime) : new Date();
        const endDate = new Date();
        const durationMs = elapsedMs;

        // 构建记录
        const record = {
            id: 'comp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
            date: startDate.toISOString().split('T')[0], // YYYY-MM-DD
            startTime: startDate.toISOString(),
            endTime: endDate.toISOString(),
            duration: durationMs,
            mode: mode, // 'completed' | 'interrupted' | 'cancelled'
            soundType: session.soundType,
            status: mode === 'completed' ? '完成陪伴' : '未能完成陪伴',
            interruptReason: '', // 仅中断时填写
            isSystemInterrupt: false,
        };

        // 如果是中断，弹出小弹窗让用户填写原因
        if (mode === 'interrupted') {
            hideOverlay();
            showInterruptReasonToast(record, () => {
                // 保存记录
                saveRecordAndCleanup(record);
            });
            return;
        }

        // 正常结束：显示小弹窗
        if (mode === 'completed') {
            hideOverlay();
            showCompletionToast(record, () => {
                saveRecordAndCleanup(record);
            });
            return;
        }

        // cancelled 或其他
        stopSound();
        releaseWakeLock();
        hideOverlay();
        resetSession();
        session.isEnding = false;
    }

    // 7.5 保存记录并清理
    function saveRecordAndCleanup(record) {
        try {
            if (typeof window.saveCompanionRecord === 'function') {
                window.saveCompanionRecord(record);
            } else {
                // fallback: 存入localStorage
                const key = 'companion_records';
                let records = JSON.parse(localStorage.getItem(key) || '[]');
                records.push(record);
                localStorage.setItem(key, JSON.stringify(records));
            }
            showToast('陪伴记录已保存 ✓', 'success');
        } catch (e) {
            console.error('[companion] 保存记录失败:', e);
        }

        stopSound();
        releaseWakeLock();
        clearAccident();
        resetSession();
        session.isEnding = false;
    }

    // 7.6 中断原因弹窗
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
        toast.addEventListener('click', (e) => {
            if (e.target === toast) {
                // 点击空白不关闭，强制用户操作
            }
        });
    }

    // 7.7 完成小弹窗
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

    // 7.8 通用toast
    function showToast(msg, type = 'info') {
        // 简单的通知，利用现有showNotification或自己实现
        if (typeof showNotification === 'function') {
            showNotification(msg, type);
        } else {
            alert(msg);
        }
    }

    // ============================================================
    // 8. 遗言机制（心跳写入）
    // ============================================================
    function backupAccident() {
        if (session.state === STATE.IDLE || session.state === STATE.ENDED) {
            clearAccident();
            return;
        }
        try {
            const data = {
                state: session.state,
                soundType: session.soundType,
                startTime: session.startTime,
                lastAliveTime: session.lastAliveTime || Date.now(),
                elapsed: session.elapsed || 0,
                countdownRemain: session.countdownRemain || 0,
                timestamp: Date.now(),
            };
            localStorage.setItem(ACCIDENT_KEY, JSON.stringify(data));
        } catch (e) {}
    }

    function clearAccident() {
        try { localStorage.removeItem(ACCIDENT_KEY); } catch (e) {}
    }

    // 检测遗言（由app.js调用）
    window.checkCompanionAccident = function () {
        try {
            const raw = localStorage.getItem(ACCIDENT_KEY);
            if (!raw) return null;
            const data = JSON.parse(raw);
            // 如果状态是sleeping或ready_to_start或countdown，说明未正常结束
            if (data.state === STATE.SLEEPING || data.state === STATE.READY_TO_START || data.state === STATE.COUNTDOWN) {
                return data;
            }
            return null;
        } catch { return null; }
    };

    // 恢复遗言（生成系统中断记录）
    window.restoreCompanionAccident = function (accidentData) {
        if (!accidentData) return;

        // 计算持续时间
        let durationMs = 0;
        let startTime = null;
        let endTime = new Date();

        if (accidentData.state === STATE.SLEEPING && accidentData.startTime) {
            startTime = new Date(accidentData.startTime);
            const lastAlive = accidentData.lastAliveTime || accidentData.startTime;
            durationMs = Math.max(0, lastAlive - accidentData.startTime);
        } else if (accidentData.state === STATE.COUNTDOWN || accidentData.state === STATE.READY_TO_START) {
            // 倒计时或待开始状态被中断，不足20分钟，不记录
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
            soundType: accidentData.soundType || '未知',
            status: '系统中断',
            interruptReason: '页面意外退出',
            isSystemInterrupt: true,
        };

        // 保存
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
    };

    // ============================================================
    // 9. 辅助工具
    // ============================================================
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

    function resetSession() {
        stopTimer();
        clearInterval(session.countdownInterval);
        session.countdownInterval = null;
        session.state = STATE.IDLE;
        session.startTime = null;
        session.elapsed = 0;
        session.lastAliveTime = null;
        session.isEnding = false;
        session.soundType = null;
        // 不停止声音，由调用者决定
    }

    // ============================================================
    // 10. 初始化入口
    // ============================================================
    function initCompanionFeature() {
        console.log('[companion] 陪伴功能已加载');

        // 在设置-高级功能中挂载入口（由外部HTML按钮调用）
        // 将 showCompanionPicker 暴露到全局，供HTML onclick调用
        window.showCompanionPicker = window.showCompanionPicker || function () {
            // 如果已经有实例则复用
            if (typeof window._showCompanionPicker === 'function') {
                window._showCompanionPicker();
            } else {
                // 首次调用
                window._showCompanionPicker = function () {
                    // 重新绑定
                    showCompanionPicker();
                };
                showCompanionPicker();
            }
        };

        // 暴露给外部调用的别名
        window.openCompanion = window.showCompanionPicker;

        // 如果有正在播放的声音但状态丢失，清理
        if (session.state === STATE.IDLE) {
            stopSound();
        }
    }

    // 页面卸载时清理
    window.addEventListener('beforeunload', function () {
        if (session.state === STATE.SLEEPING || session.state === STATE.COUNTDOWN || session.state === STATE.READY_TO_START) {
            backupAccident();
        }
        stopSound();
        releaseWakeLock();
    });

    // 暴露初始化
    window.initCompanionFeature = initCompanionFeature;

    // 自执行：如果DOM已加载，立即初始化（但app.js会再调一次，无害）
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
            // 静默初始化，等app.js调
        });
    }

    console.log('[companion] 模块加载完成');

})();
