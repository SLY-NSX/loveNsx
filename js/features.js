(function() {
    var MY_SYM_KEY   = 'pokeSym_my';
    var PTR_SYM_KEY  = 'pokeSym_partner';
    var MY_CUST_KEY  = 'pokeSym_my_custom';
    var PTR_CUST_KEY = 'pokeSym_partner_custom';

    // ===== 新增：公告翻页状态 =====
    var _greetingPage = 'partner'; // 'partner' | 'me'
    // 我的每日数据存储键（天气 + 今日建议，带日期）
    var MY_DAILY_DATA_KEY = 'myDailyData';
    // 我的今日寄语存储键（永久存储）
    var MY_MOTTO_KEY = 'myDailyMotto';

    var PRESETS = [
        { value: 'none',    label: '无装饰',   sym: '' },
        { value: 'star4',   label: '✦ 四角星', sym: '✦' },
        { value: 'star5',   label: '✧ 镂空星', sym: '✧' },
        { value: 'dot',     label: '· 圆点',   sym: '·' },
        { value: 'wave',    label: '～ 波浪',  sym: '～' },
        { value: 'heart',   label: '♡ 爱心',   sym: '♡' },
        { value: 'flower',  label: '✿ 花朵',   sym: '✿' },
        { value: 'sparkle', label: '✨ 闪光',  sym: '✨' },
        { value: 'custom',  label: '自定义…',  sym: null }
    ];

    function _getSym(key, customKey) {
        var v = localStorage.getItem(key) || 'star4';
        if (v === 'custom') return localStorage.getItem(customKey) || '✦';
        var p = PRESETS.find(function(x){ return x.value === v; });
        return p ? p.sym : '✦';
    }

    // 用于“戳一戳”文本的清理：移除大部分表情类字符，避免用户文本里夹带 emoji
    // 装饰符号仍由 _formatPokeText() 根据用户配置自动包裹输出
    function _stripEmojiForPoke(text) {
        return String(text || '')
            // 常见 Emoji / 符号区段（尽量保守）
            .replace(/[\u2600-\u27BF\u{1F300}-\u{1FAFF}]/gu, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    window._formatPokeText = function(text) {
        var sym = _getSym(MY_SYM_KEY, MY_CUST_KEY);
        return sym ? (sym + ' ' + text + ' ' + sym) : text;
    };
    window._formatPartnerPokeText = function(text) {
        var sym = _getSym(PTR_SYM_KEY, PTR_CUST_KEY);
        return sym ? (sym + ' ' + text + ' ' + sym) : text;
    };
    window._sanitizePokeTextForDisplay = _stripEmojiForPoke;

    function _esc(s) {
        return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    window._openPokeSymSettings = function() {
        var old = document.getElementById('poke-sym-modal');
        if (old) old.remove();

        var mySel    = localStorage.getItem(MY_SYM_KEY) || 'star4';
        var ptrSel   = localStorage.getItem(PTR_SYM_KEY) || 'star4';
        var myCustom = localStorage.getItem(MY_CUST_KEY) || '';
        var ptrCustom= localStorage.getItem(PTR_CUST_KEY) || '';

        function opts(sel) {
            return PRESETS.map(function(p){
                return '<option value="'+p.value+'"'+(sel===p.value?' selected':'')+'>'+p.label+'</option>';
            }).join('');
        }

        var wrap = document.createElement('div');
        wrap.id = 'poke-sym-modal';
        wrap.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.5);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);';
        wrap.innerHTML = [
            '<div style="background:var(--primary-bg);border-radius:20px;padding:22px 20px;width:min(340px,92vw);box-shadow:0 20px 60px rgba(0,0,0,0.28);border:1px solid var(--border-color);">',
              '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;">',
                '<span style="font-size:15px;font-weight:700;color:var(--text-primary);font-family:var(--font-family);">戳一戳装饰符号</span>',
                '<button id="psm-close" style="background:none;border:none;font-size:18px;color:var(--text-secondary);cursor:pointer;padding:2px 6px;border-radius:6px;">✕</button>',
              '</div>',
              '<div style="font-size:11px;color:var(--text-secondary);font-weight:700;letter-spacing:.6px;text-transform:uppercase;margin-bottom:5px;">我发出的</div>',
              '<select id="psm-my" style="width:100%;padding:9px 10px;border:1.5px solid var(--border-color);border-radius:10px;background:var(--secondary-bg);color:var(--text-primary);font-size:13px;outline:none;font-family:var(--font-family);margin-bottom:8px;">'+opts(mySel)+'</select>',
              '<div id="psm-my-cw" style="margin-bottom:12px;display:'+(mySel==='custom'?'block':'none')+';">',
                '<input id="psm-my-ci" type="text" maxlength="4" placeholder="输入 1-2 个字符" value="'+_esc(myCustom)+'" style="width:100%;padding:8px 10px;border:1.5px solid var(--border-color);border-radius:10px;background:var(--secondary-bg);color:var(--text-primary);font-size:13px;outline:none;box-sizing:border-box;font-family:var(--font-family);">',
              '</div>',
              '<div style="font-size:11px;color:var(--text-secondary);font-weight:700;letter-spacing:.6px;text-transform:uppercase;margin-bottom:5px;">对方发出的</div>',
              '<select id="psm-ptr" style="width:100%;padding:9px 10px;border:1.5px solid var(--border-color);border-radius:10px;background:var(--secondary-bg);color:var(--text-primary);font-size:13px;outline:none;font-family:var(--font-family);margin-bottom:8px;">'+opts(ptrSel)+'</select>',
              '<div id="psm-ptr-cw" style="margin-bottom:14px;display:'+(ptrSel==='custom'?'block':'none')+';">',
                '<input id="psm-ptr-ci" type="text" maxlength="4" placeholder="输入 1-2 个字符" value="'+_esc(ptrCustom)+'" style="width:100%;padding:8px 10px;border:1.5px solid var(--border-color);border-radius:10px;background:var(--secondary-bg);color:var(--text-primary);font-size:13px;outline:none;box-sizing:border-box;font-family:var(--font-family);">',
              '</div>',
              '<div id="psm-preview" style="background:var(--secondary-bg);border-radius:10px;padding:10px 14px;font-size:12.5px;color:var(--text-secondary);margin-bottom:16px;border:1px dashed var(--border-color);line-height:1.7;"></div>',
              '<div style="display:flex;gap:8px;">',
                '<button id="psm-cancel" style="flex:1;padding:9px;border:1px solid var(--border-color);border-radius:10px;background:var(--secondary-bg);color:var(--text-secondary);font-size:13px;cursor:pointer;font-family:var(--font-family);">取消</button>',
                '<button id="psm-save" style="flex:2;padding:9px;border:none;border-radius:10px;background:var(--accent-color);color:#fff;font-size:13px;font-weight:700;cursor:pointer;font-family:var(--font-family);">保存</button>',
              '</div>',
            '</div>'
        ].join('');
        document.body.appendChild(wrap);

        function preview() {
            var mv = document.getElementById('psm-my').value;
            var pv = document.getElementById('psm-ptr').value;
            var ms = mv==='custom'?(document.getElementById('psm-my-ci').value||'✦'):((PRESETS.find(function(x){return x.value===mv;})||{}).sym||'');
            var ps = pv==='custom'?(document.getElementById('psm-ptr-ci').value||'✦'):((PRESETS.find(function(x){return x.value===pv;})||{}).sym||'');
            var myN  = (typeof settings!=='undefined'&&settings.myName)||'我';
            var pN   = (typeof settings!=='undefined'&&settings.partnerName)||'对方';
            var mt   = ms?(ms+' '+myN+' 拍了拍你 '+ms):(myN+' 拍了拍你');
            var pt   = ps?(ps+' '+pN+' 拍了拍你 '+ps):(pN+' 拍了拍你');
            document.getElementById('psm-preview').innerHTML =
                '<div style="color:var(--text-primary);">我：'+_esc(mt)+'</div>'+
                '<div style="color:var(--text-primary);margin-top:3px;">对方：'+_esc(pt)+'</div>';
        }

        document.getElementById('psm-my').addEventListener('change', function(){
            document.getElementById('psm-my-cw').style.display = this.value==='custom'?'block':'none'; preview();
        });
        document.getElementById('psm-ptr').addEventListener('change', function(){
            document.getElementById('psm-ptr-cw').style.display = this.value==='custom'?'block':'none'; preview();
        });
        document.getElementById('psm-my-ci').addEventListener('input', preview);
        document.getElementById('psm-ptr-ci').addEventListener('input', preview);
        preview();

        function close(){ wrap.remove(); }
        document.getElementById('psm-close').addEventListener('click', close);
        document.getElementById('psm-cancel').addEventListener('click', close);
        wrap.addEventListener('click', function(e){ if(e.target===wrap) close(); });
        document.getElementById('psm-save').addEventListener('click', function(){
            var mv = document.getElementById('psm-my').value;
            var pv = document.getElementById('psm-ptr').value;
            localStorage.setItem(MY_SYM_KEY, mv);
            localStorage.setItem(PTR_SYM_KEY, pv);
            if(mv==='custom') localStorage.setItem(MY_CUST_KEY, document.getElementById('psm-my-ci').value.trim());
            if(pv==='custom') localStorage.setItem(PTR_CUST_KEY, document.getElementById('psm-ptr-ci').value.trim());
            close();
            if(window._syncPokeDesc) window._syncPokeDesc();
            if(typeof showNotification==='function') showNotification('戳一戳符号已保存 ✓','success',1800);
        });
    };

    function _syncPokeDesc() {
        var ms = localStorage.getItem(MY_SYM_KEY)||'star4';
        var ps = localStorage.getItem(PTR_SYM_KEY)||'star4';
        var ml = (PRESETS.find(function(p){return p.value===ms;})||{}).label||ms;
        var pl = (PRESETS.find(function(p){return p.value===ps;})||{}).label||ps;
        var d = document.getElementById('poke-symbol-desc');
        if(d) d.textContent = '我: '+ml+'  /  对方: '+pl;
    }
    window._syncPokeDesc = _syncPokeDesc;
    document.addEventListener('DOMContentLoaded', _syncPokeDesc);
    setTimeout(_syncPokeDesc, 600);
})();

(function() {
    var KEY = 'headerAlwaysClear';
    function _get() { return localStorage.getItem(KEY) === 'true'; }

    function _applyHeader() {
        var en = _get();
        var id = 'header-clear-override';
        var t  = document.getElementById(id);
        if (!t) { t = document.createElement('style'); t.id = id; document.head.appendChild(t); }
        if (en) {
            t.textContent = '.header { opacity: 1 !important; }';
        } else {
            t.textContent = [
                '.header { opacity: 0.5 !important; transition: opacity 0.3s ease !important; }',
                '.header:hover { opacity: 1 !important; }'
            ].join(' ');
        }
    }

    function _syncUI() {
        var en  = _get();
        var row = document.getElementById('header-opacity-toggle');
        if (row) row.classList.toggle('active', en);
        var spans = document.querySelectorAll('#header-opacity-toggle .setting-pill-label span');
        if (spans.length) spans[0].textContent = en ? '已开启，始终清晰' : '关闭后悬停才清晰';
    }

    window._toggleHeaderOpacity = function() {
        localStorage.setItem(KEY, String(!_get()));
        _applyHeader(); _syncUI();
        if (typeof showNotification === 'function')
            showNotification(_get() ? '顶部栏已常驻清晰 ✓' : '顶部栏已恢复悬停清晰', 'success', 1800);
    };

    _applyHeader();
    document.addEventListener('DOMContentLoaded', function(){ _applyHeader(); _syncUI(); });
    setTimeout(function(){ _applyHeader(); _syncUI(); }, 500);
    setTimeout(function(){ _applyHeader(); _syncUI(); }, 1500);
})();

// ============================================================
// 精简保活音乐模块（内置舒缓钢琴音 + 独立音量控制）
// ============================================================
(function() {
    var KEY = 'keepaliveAudioEnabled';
    var SOUND_KEY = 'keepaliveSoundOn';
    
    // 唯一保留的舒缓外部备用音源 (微音率氛围乐)
    var AMBIENT_SOUND_URL = 'https://commondatastorage.googleapis.com/codeskulptor-demos/DDR_assets/Sevish_-__Horizon__-_horizon.mp3';

    var _audio = null;
    var _audioCtx = null;
    var _gainNode = null;
    var _bufferSource = null;
    var _useWebAudio = false;
    var _keepaliveTimer = null;
    var _retryCount = 0;
    var MAX_RETRIES = 8;
    var _isRestarting = false;

    function _get() { return localStorage.getItem(KEY) === 'true'; }
    function _getSound() { 
        var v = localStorage.getItem(SOUND_KEY);
        return v === null ? true : v === 'true'; 
    }

    // ----- 方案A：使用内置 Web Audio 生成极舒缓的钢琴和弦 -----
    function _startWebAudioMusic() {
        try {
            if (_audioCtx) {
                if (_audioCtx.state === 'suspended') _audioCtx.resume();
                if (_audioCtx.state === 'running') return true;
            }

            _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            _gainNode = _audioCtx.createGain();
            _gainNode.gain.value = _getSound() ? 0.18 : 0.0; // 独立音量控制
            _gainNode.connect(_audioCtx.destination);

            var sampleRate = _audioCtx.sampleRate;
            var duration = 4.0; // 4秒循环节拍
            var bufferSize = Math.floor(sampleRate * duration);
            var buffer = _audioCtx.createBuffer(2, bufferSize, sampleRate);
            
            var left = buffer.getChannelData(0);
            var right = buffer.getChannelData(1);
            
            // 舒缓的大七和弦琶音
            var notes = [
                { freq: 261.63, vol: 0.3 }, // C4
                { freq: 329.63, vol: 0.25 }, // E4
                { freq: 392.00, vol: 0.2 },  // G4
                { freq: 493.88, vol: 0.18 }, // B4
                { freq: 523.25, vol: 0.15 }  // C5
            ];
            
            for (var i = 0; i < bufferSize; i++) {
                var t = i / sampleRate;
                var val = 0;
                for (var n = 0; n < notes.length; n++) {
                    var note = notes[n];
                    var notePos = (n / notes.length) * duration;
                    var dist = (t - notePos + duration) % duration;
                    // 缓入缓出包络，极其柔和
                    var envelope = Math.exp(-Math.pow((dist - 0.2) * 3, 2));
                    val += note.vol * Math.sin(2 * Math.PI * note.freq * t) * envelope;
                }
                left[i] = val * 0.6;
                right[i] = val * 0.6 + 0.05 * Math.sin(2 * Math.PI * 523.25 * t) * 0.1; // 加一点空灵回声
            }
            
            // 归一化防破音
            var maxVal = 0;
            for (i = 0; i < bufferSize; i++) {
                if (Math.abs(left[i]) > maxVal) maxVal = Math.abs(left[i]);
                if (Math.abs(right[i]) > maxVal) maxVal = Math.abs(right[i]);
            }
            if (maxVal > 0) {
                for (i = 0; i < bufferSize; i++) { left[i] /= maxVal; right[i] /= maxVal; }
            }

            _bufferSource = _audioCtx.createBufferSource();
            _bufferSource.buffer = buffer;
            _bufferSource.loop = true;
            _bufferSource.connect(_gainNode);
            _bufferSource.start();

            _useWebAudio = true;
            _retryCount = 0;
            return true;
        } catch(e) {
            console.warn('[保活] Web Audio 舒缓音生成失败，回退外部链接', e);
            return false;
        }
    }

    // ----- 方案B：使用外部舒缓音频标签 -----
    function _startAudioTagKeepalive() {
        try {
            if (_audio && !_audio.paused) return true;

            if (_audio) { _audio.pause(); _audio = null; }

            _audio = new Audio();
            _audio.loop = true;
            _audio.volume = _getSound() ? 0.15 : 0.0; // 独立音量控制
            _audio.preload = 'auto';
            _audio.src = AMBIENT_SOUND_URL;
            _audio.crossOrigin = 'anonymous';

            _audio.play().then(function() {
                _retryCount = 0;
            }).catch(function(err) {
                console.warn('[保活] 外部舒缓音播放失败', err);
                setTimeout(_tryRestart, 2000);
            });

            _audio.addEventListener('pause', function() {
                if (_get() && !_audio.ended && !_isRestarting) setTimeout(_tryRestart, 1000);
            });

            _useWebAudio = false;
            return true;
        } catch(e) {
            return false;
        }
    }

    // ----- 核心启动与看门狗 -----
    function _start() {
        if (!_get()) { _stop(); return; }
        if (_isRestarting) return;
        _isRestarting = true;

        // 优先内置生成（最稳定，不耗网络）
        var ok = _startWebAudioMusic();
        if (!ok) ok = _startAudioTagKeepalive(); // 失败则用外部链接

        _isRestarting = false;

        if (_keepaliveTimer) clearInterval(_keepaliveTimer);
        _keepaliveTimer = setInterval(function() {
            if (!_get()) { clearInterval(_keepaliveTimer); _keepaliveTimer = null; _stop(); return; }

            if (_useWebAudio) {
                if (_audioCtx && _audioCtx.state === 'suspended') _audioCtx.resume().catch(function() {});
                else if (_audioCtx && _audioCtx.state === 'closed') _startWebAudioMusic();
            } else {
                if (_audio && _audio.paused) _audio.play().catch(function() {});
            }

            var webAudioPlaying = _useWebAudio && _audioCtx && _audioCtx.state === 'running';
            var audioPlaying = !_useWebAudio && _audio && !_audio.paused;
            _setUI(webAudioPlaying || audioPlaying);
        }, 10000);
    }

    function _stop() {
        _isRestarting = false;
        if (_keepaliveTimer) { clearInterval(_keepaliveTimer); _keepaliveTimer = null; }
        try {
            if (_bufferSource) { _bufferSource.stop(); _bufferSource.disconnect(); _bufferSource = null; }
            if (_gainNode) { _gainNode.disconnect(); _gainNode = null; }
            if (_audioCtx && _audioCtx.state !== 'closed') _audioCtx.close().catch(function() {}); 
            _audioCtx = null;
        } catch(e) {}
        try {
            if (_audio) { _audio.pause(); _audio = null; }
        } catch(e) {}
        _useWebAudio = false;
        _setUI(false);
    }

    function _tryRestart() {
        if (!_get() || _isRestarting || _retryCount >= MAX_RETRIES) return;
        _retryCount++;
        _stop();
        setTimeout(function() {
            _start();
            setTimeout(function() { _retryCount = 0; }, 5000);
        }, 500 + _retryCount * 200);
    }

    // ----- UI 与独立音量对外接口 -----
    function _setUI(playing) {
        var dot = document.getElementById('keepalive-dot');
        var desc = document.getElementById('keepalive-audio-desc');
        var row = document.getElementById('keepalive-bar-row');
        var soundDesc = document.getElementById('keepalive-sound-desc');

        // 修复：将 active 类名加在 .setting-pill-row 上，让全局变色和滑动动效生效
        var audioToggleRow = document.getElementById('keepalive-audio-toggle');
        if (audioToggleRow) audioToggleRow.classList.toggle('active', _get());
        
        var soundToggleRow = document.getElementById('keepalive-sound-toggle');
        if (soundToggleRow) soundToggleRow.classList.toggle('active', _getSound());

        if (soundDesc) soundDesc.textContent = _getSound() ? '有声播放 (正常音量)' : '静音播放 (0%)';
        
        if (dot) dot.className = 'keepalive-dot' + (playing ? ' alive' : '');
        if (desc) {
            if (!_get()) desc.textContent = '循环播放舒缓音频，防止页面被系统挂起';
            else if (playing) desc.textContent = '🎵 运行中 · 页面已保活';
            else desc.textContent = '⏳ 等待启动…';
        }
        if (row) row.style.display = _get() ? 'flex' : 'none';

        var bars = document.querySelectorAll('.keepalive-wave-bar');
        bars.forEach(function(b) { b.style.animationPlayState = playing ? 'running' : 'paused'; });
    }

    window._toggleKeepaliveAudio = function() {
        var next = !_get();
        localStorage.setItem(KEY, String(next));
        if (next) {
            _retryCount = 0;
            _start();
            if (typeof showNotification === 'function') showNotification('🎵 保活音频已开启', 'success', 2500);
        } else {
            _stop();
            if (typeof showNotification === 'function') showNotification('保活音频已关闭', 'info', 1500);
        }
        var isPlaying = _useWebAudio ? (_audioCtx && _audioCtx.state === 'running') : (_audio && !_audio.paused);
        _setUI(next && isPlaying);
    };

    window._toggleKeepaliveSound = function() {
        var next = !_getSound();
        localStorage.setItem(SOUND_KEY, String(next));
        if (_useWebAudio) {
            if (_gainNode) _gainNode.gain.value = next ? 0.18 : 0.0;
        } else {
            if (_audio) _audio.volume = next ? 0.15 : 0.0;
        }
        _setUI(_useWebAudio ? (_audioCtx && _audioCtx.state === 'running') : (_audio && !_audio.paused));
        if (typeof showNotification === 'function') showNotification(next ? '🔊 保活音效已开启' : '🔇 保活音效已关闭', 'success', 1500);
    };

    // ----- 生命周期与解锁 -----
    document.addEventListener('visibilitychange', function() {
        if (_get() && document.visibilityState === 'visible') {
            if (_useWebAudio && _audioCtx) {
                if (_audioCtx.state === 'suspended') _audioCtx.resume().catch(function(){});
                else if (_audioCtx.state === 'closed') _startWebAudioMusic();
            } else if (!_useWebAudio && _audio && _audio.paused) {
                _audio.play().catch(function(){});
            } else { _tryRestart(); }
        }
    });

    function _unlockAudio() {
        if (_get() && _audioCtx && _audioCtx.state === 'suspended') _audioCtx.resume().catch(function(){});
    }
    document.addEventListener('click', _unlockAudio, { once: false });
    document.addEventListener('touchstart', _unlockAudio, { once: false });

    document.addEventListener('DOMContentLoaded', function() { _setUI(false); if (_get()) _start(); });
    setTimeout(function() {
        var isPlaying = _useWebAudio ? (_audioCtx && _audioCtx.state === 'running') : (_audio && !_audio.paused);
        _setUI(_get() && isPlaying);
        if (_get() && !isPlaying) _start();
    }, 2000);
})();

(function() {
    window._runMsgSearch = function() {
        var inp  = document.getElementById('msg-search-input');
        var from = document.getElementById('msg-search-date-from');
        var to   = document.getElementById('msg-search-date-to');
        var out  = document.getElementById('msg-search-results');
        if (!out) return;

        var q  = inp  ? inp.value.trim().toLowerCase() : '';
        var fd = from && from.value ? new Date(from.value+'T00:00:00') : null;
        var td = to   && to.value   ? new Date(to.value  +'T23:59:59') : null;

        if (!q && !fd && !td) {
            out.innerHTML = '<div class="sri-empty"><i class="fas fa-search"></i><span>输入关键词或选择日期范围</span></div>';
            return;
        }
        if (typeof messages === 'undefined' || !messages || !messages.length) {
            out.innerHTML = '<div class="sri-empty"><i class="fas fa-inbox"></i><span>暂无聊天记录</span></div>';
            return;
        }

        var res = messages.filter(function(m){
            if (m.type === 'system') return false;
            var ts = m.timestamp ? new Date(m.timestamp) : null;
            if (fd && ts && ts < fd) return false;
            if (td && ts && ts > td) return false;
            if (q) return m.text && m.text.toLowerCase().indexOf(q) !== -1;
            return true;
        });

        if (!res.length) {
            out.innerHTML = '<div class="sri-empty"><i class="fas fa-inbox"></i><span>未找到匹配消息</span></div>';
            return;
        }

        function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
        function hi(t,k){
            if(!k||!t) return esc(t||'');
            return esc(t).replace(new RegExp('('+k.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+')','gi'),'<mark style="background:rgba(var(--accent-color-rgb),.28);color:var(--text-primary);border-radius:3px;padding:0 2px;">$1</mark>');
        }
        function fmt(ts){
            if(!ts) return '';
            var d=new Date(ts);
            return d.getFullYear()+'/'+(d.getMonth()+1+'').padStart(2,'0')+'/'+(d.getDate()+'').padStart(2,'0')+' '+(d.getHours()+'').padStart(2,'0')+':'+(d.getMinutes()+'').padStart(2,'0');
        }
        function nm(m){ return m.sender==='user'?((typeof settings!=='undefined'&&settings.myName)||'我'):((typeof settings!=='undefined'&&settings.partnerName)||'对方'); }

        var _myAvSrc = (function(){
            var el = document.querySelector('#my-avatar img,[id*="my-avatar"] img');
            return el ? el.src : null;
        })();
        var _partnerAvSrc = (function(){
            var el = document.querySelector('#partner-avatar img,[id*="partner-avatar"] img,.partner-avatar img');
            return el ? el.src : null;
        })();
        function _avHtml(isMe) {
            var src = isMe ? _myAvSrc : _partnerAvSrc;
            if (src) return '<img src="'+src+'" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">';
            return '<i class="fas fa-'+(isMe?'user':'user-circle')+'" style="font-size:16px;color:rgba(255,255,255,.8);"></i>';
        }
        var html = '<div style="font-size:12px;color:var(--text-secondary);padding:0 2px 8px;">共 <b style="color:var(--accent-color)">'+res.length+'</b> 条</div>';
        html += res.slice(0,200).map(function(m){
            var isMe = m.sender==='user';
            var preview = m.text?(m.text.length>100?m.text.slice(0,100)+'…':m.text):(m.image?'[图片]':'');
            return '<div class="search-result-item" onclick="window._scrollToMsg&&window._scrollToMsg('+m.id+')">'+
                '<div class="sri-avatar '+(isMe?'sri-me':'sri-partner')+'">'+_avHtml(isMe)+'</div>'+
                '<div class="sri-body">'+
                  '<div class="sri-meta"><span class="sri-name">'+esc(nm(m))+'</span><span class="sri-time">'+fmt(m.timestamp)+'</span></div>'+
                  '<div class="sri-text">'+hi(preview,q)+'</div>'+
                '</div>'+
            '</div>';
        }).join('');
        if (res.length>200) html+='<div style="text-align:center;font-size:12px;color:var(--text-secondary);padding:6px 0">仅显示前 200 条</div>';
        out.innerHTML = html;
    };

    window._scrollToMsg = function(id) {
        var el = document.querySelector('[data-id="'+id+'"]') || document.querySelector('[data-message-id="'+id+'"]');
        if (el) {
            el.scrollIntoView({behavior:'smooth',block:'center'});
            el.style.transition='background .3s ease';
            el.style.background='rgba(var(--accent-color-rgb),.14)';
            setTimeout(function(){ el.style.background=''; }, 1800);
            var m = document.getElementById('stats-modal');
            if (m && typeof hideModal==='function') setTimeout(function(){ hideModal(m); }, 350);
        } else {
            if (typeof showNotification==='function') showNotification('消息不在当前视图中','info',2000);
        }
    };
})();

window.renderComboContent = function(tabName) {
    const picker = document.getElementById('user-sticker-picker');
    if (!picker) return;

    // 如果还没初始化过，给 Tab 按钮绑定点击事件
    if (!picker._comboMenuInitialized) {
        const tabBtns = picker.querySelectorAll('.combo-tab-btn');
        tabBtns.forEach(btn => {
            btn.addEventListener('click', function() {
                tabBtns.forEach(b => {
                    b.style.background = 'transparent';
                    b.style.color = 'var(--text-secondary)';
                    b.classList.remove('active');
                });
                this.style.background = 'var(--accent-color)';
                this.style.color = '#fff';
                this.classList.add('active');

                const tab = this.dataset.tab;
                const contentArea = picker.querySelector('#combo-content-area');
                if (!contentArea) return;

                if (tab === 'poke') {
                    showPokeTab(contentArea);
                } else if (tab === 'emoji') {
                    // 👈 专门处理纯 emoji
                    showEmojiTab(contentArea, false, 'emoji');
                } else {
                    // 👈 专门处理表情库 (my-sticker / partner-sticker)
                    showEmojiTab(contentArea, tab === 'partner-sticker', 'sticker');
                }
            });
        });
        picker._comboMenuInitialized = true;
    }

    // 自动点击传入的 Tab
    const targetBtn = picker.querySelector(`.combo-tab-btn[data-tab="${tabName || 'my-sticker'}"]`);
    if (targetBtn) targetBtn.click();
};

// 新增第三个参数 mode：'emoji' 只显emoji，'sticker' 只显表情包
function showEmojiTab(area, isPartner, mode = 'all') {
    area.innerHTML = '';
    area.style.display = 'grid';
    area.style.gridTemplateColumns = 'repeat(5, 1fr)';
    area.style.gap = '8px';
    
    // 1. 渲染 Emoji (只有在 mode 为 'emoji' 或 'all' 时才显示)
    if (mode === 'emoji' || mode === 'all') {
        CONSTANTS.REPLY_EMOJIS.forEach(emoji => {
            const item = document.createElement('div');
            item.className = 'picker-item';
            item.innerHTML = `<span style="font-size:24px;">${emoji}</span>`;
            item.onclick = () => {
                const input = document.getElementById('message-input');
                input.value += emoji;
                document.getElementById('user-sticker-picker').classList.remove('active');
                input.focus();
            };
            area.appendChild(item);
        });

        const emojis = customEmojis || [];
        emojis.forEach(emoji => {
            const item = document.createElement('div');
            item.className = 'picker-item';
            item.innerHTML = `<span style="font-size:24px;">${emoji}</span>`;
            item.onclick = () => {
                const input = document.getElementById('message-input');
                input.value += emoji;
                document.getElementById('user-sticker-picker').classList.remove('active');
                input.focus();
            };
            area.appendChild(item);
        });
    }

    // 2. 渲染 表情包 (只有在 mode 为 'sticker' 或 'all' 时才显示)
    if (mode === 'sticker' || mode === 'all') {
        // 注意：去掉了 window.，直接读取全局的 stickerLibrary
        const stickers = isPartner ? (window.partnerStickerLibrary || []) : (stickerLibrary || myStickerLibrary || []);
        stickers.forEach(src => {
            const item = document.createElement('div');
            item.className = 'picker-item';
            item.innerHTML = `<img src="${src}" style="width:100%; height:100%; object-fit:cover; border-radius:6px;">`;
            item.onclick = () => {
                if (isBatchMode && !isPartner) {
                    batchMessages.push({ id: Date.now() + batchMessages.length, text: '', image: src });
                    updateBatchPreview();
                    showNotification('已添加到批量发送', 'success', 1200);
                } else {
                    addMessage({
                        id: Date.now(),
                        sender: isPartner ? (settings.partnerName || '对方') : 'user',
                        text: '',
                        timestamp: new Date(),
                        image: src,
                        status: isPartner ? 'received' : 'sent',
                        type: 'normal'
                    });
                    playSound('send');
                    
                    if (!isPartner) {
                        const delayRange = settings.replyDelayMax - settings.replyDelayMin;
                        const randomDelay = settings.replyDelayMin + Math.random() * delayRange;
                        if (window._pendingReplyTimer) clearTimeout(window._pendingReplyTimer);
                        window._pendingReplyTimer = setTimeout(() => { window._pendingReplyTimer = null; window.requestSimulateTask(false); }, randomDelay);
                    }
                }
                document.getElementById('user-sticker-picker').classList.remove('active');
            };
            area.appendChild(item);
        });
    }
}
function showPokeTab(area) {
    area.innerHTML = '';
    area.style.display = 'flex';
    area.style.flexDirection = 'column';
    area.style.gap = '8px';
    
    const quickPokes = customPokes.slice(0, 6);
    
    quickPokes.forEach(pokeText => {
        const cleanPokeText = (typeof window._sanitizePokeTextForDisplay === 'function')
            ? window._sanitizePokeTextForDisplay(pokeText)
            : pokeText;
        const btn = document.createElement('button');
        btn.textContent = cleanPokeText;
        btn.style.cssText = `
            padding: 10px 14px;
            background: linear-gradient(135deg, var(--secondary-bg), rgba(var(--accent-color-rgb),0.04));
            border: 1px solid rgba(var(--accent-color-rgb),0.15);
            border-radius: 12px;
            cursor: pointer;
            text-align: left;
            font-size: 13px;
            transition: all 0.22s cubic-bezier(0.4,0,0.2,1);
            color: var(--text-primary);
            font-family: var(--font-family);
            width: 100%;
        `;
        btn.addEventListener('mouseover', () => {
            btn.style.background = 'linear-gradient(135deg, rgba(var(--accent-color-rgb),0.12), rgba(var(--accent-color-rgb),0.06))';
            btn.style.borderColor = 'var(--accent-color)';
            btn.style.transform = 'translateX(4px)';
        });
        btn.addEventListener('mouseout', () => {
            btn.style.background = 'linear-gradient(135deg, var(--secondary-bg), rgba(var(--accent-color-rgb),0.04))';
            btn.style.borderColor = 'rgba(var(--accent-color-rgb),0.15)';
            btn.style.transform = '';
        });
        btn.onclick = () => {
            let finalPokeText = cleanPokeText;
            const myName = settings.myName || '我';
            const partnerName = settings.partnerName || '梦角';
            
            if (finalPokeText.includes('+')) {
                finalPokeText = finalPokeText.replace(/\+/g, partnerName);
            } else {
                finalPokeText = finalPokeText + ' ' + partnerName;
            }
            addMessage({
                id: Date.now(), 
                text: _formatPokeText(`${myName} ${finalPokeText}`), 
                timestamp: new Date(), 
                type: 'system'
            });
            document.getElementById('user-sticker-picker').classList.remove('active');
            const delayRange = settings.replyDelayMax - settings.replyDelayMin;
            const randomDelay = settings.replyDelayMin + Math.random() * delayRange;
            setTimeout(() => window.requestSimulateTask(false), randomDelay);
        };
        area.appendChild(btn);
    });
    
    const customBtn = document.createElement('button');
    customBtn.innerHTML = '<i class="fas fa-edit"></i> 自定义拍一拍';
    customBtn.style.cssText = `
        padding: 11px 14px;
        background: linear-gradient(135deg, var(--accent-color), rgba(var(--accent-color-rgb),0.8));
        color: #fff;
        border: none;
        border-radius: 12px;
        cursor: pointer;
        font-weight: 600;
        font-size: 13px;
        width: 100%;
        letter-spacing: 0.3px;
        margin-top: 4px;
        box-shadow: 0 4px 14px rgba(var(--accent-color-rgb), 0.25);
    `;
    customBtn.onclick = () => {
        document.getElementById('user-sticker-picker').classList.remove('active');
        showModal(DOMElements.pokeModal.modal, DOMElements.pokeModal.input);
    };
    area.appendChild(customBtn);
}
        function initCoreListeners() {


            DOMElements.sendBtn.addEventListener('click', () => isBatchMode ? addToBatch(): sendMessage());
            DOMElements.messageInput.addEventListener('keydown', e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault(); isBatchMode ? addToBatch(): sendMessage();
                }
            });
            DOMElements.messageInput.addEventListener('input', () => {
                DOMElements.messageInput.style.height = 'auto'; DOMElements.messageInput.style.height = `${Math.min(DOMElements.messageInput.scrollHeight, 120)}px`;
            });


            DOMElements.attachmentBtn.addEventListener('click', () => {

                const modal = document.createElement('div');
                modal.className = 'modal image-upload-modal';
                modal.style.cssText = `
            display: flex !important;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.7);
            z-index: 9999;
            align-items: center;
            justify-content: center;
            backdrop-filter: blur(8px);
            opacity: 0;
            transition: opacity 0.3s ease;
            `;

                modal.innerHTML = `
            <div class="modal-content" style="
            z-index: 10000;
            position: relative;
            background-color: var(--secondary-bg);
            border-radius: var(--radius);
            padding: 24px;
            width: 90%;
            max-width: 400px;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
            transform: translateY(20px);
            opacity: 0;
            transition: all 0.3s ease;
            ">
            <div class="modal-title"><i class="fas fa-image"></i><span>发送图片</span></div>
            <div style="margin-bottom: 16px;">
            <div style="display: flex; gap: 10px; margin-bottom: 10px;">
            <button class="modal-btn modal-btn-secondary upload-mode-btn active" id="upload-image-file-btn" style="flex: 1;">选择文件</button>
            <button class="modal-btn modal-btn-secondary upload-mode-btn" id="paste-image-url-btn" style="flex: 1;">粘贴URL</button>
            </div>
            <input type="file" class="modal-input" id="image-file-input" accept="image/*">
            <input type="text" class="modal-input" id="image-url-input" placeholder="输入图片URL地址" style="display: none;">
            <div id="image-preview" style="text-align: center; margin-top: 10px; display: none;">
            <img id="preview-chat-image" style="max-width: 200px; max-height: 200px; border-radius: 8px; border: 2px solid var(--border-color);">
            </div>
            </div>
            <div class="modal-buttons">
            <button class="modal-btn modal-btn-secondary" id="cancel-image">取消</button>
            <button class="modal-btn modal-btn-primary" id="send-image" disabled>发送</button>
            </div>
            </div>
            `;

                document.body.appendChild(modal);


                setTimeout(() => {
                    modal.style.opacity = '1';
                    const content = modal.querySelector('.modal-content');
                    content.style.opacity = '1';
                    content.style.transform = 'translateY(0)';
                }, 10);

                const fileInput = document.getElementById('image-file-input');
                const urlInput = document.getElementById('image-url-input');
                const uploadBtn = document.getElementById('upload-image-file-btn');
                const pasteUrlBtn = document.getElementById('paste-image-url-btn');
                const previewDiv = document.getElementById('image-preview');
                const previewImg = document.getElementById('preview-chat-image');
                const sendBtn = document.getElementById('send-image');
                const cancelBtn = document.getElementById('cancel-image');
                const uploadModeBtns = document.querySelectorAll('.upload-mode-btn');

                let currentImageData = null;


                function switchUploadMode(isFileMode) {
                    uploadModeBtns.forEach(btn => btn.classList.remove('active'));
                    if (isFileMode) {
                        uploadBtn.classList.add('active');
                        fileInput.style.display = 'block';
                        urlInput.style.display = 'none';
                    } else {
                        pasteUrlBtn.classList.add('active');
                        fileInput.style.display = 'none';
                        urlInput.style.display = 'block';
                        urlInput.focus();
                    }

                    previewDiv.style.display = 'none';
                    sendBtn.disabled = true;
                    currentImageData = null;
                }


                uploadBtn.addEventListener('click', () => switchUploadMode(true));


                pasteUrlBtn.addEventListener('click', () => switchUploadMode(false));


                fileInput.addEventListener('change', function(e) {
                    const file = e.target.files[0];
                    if (file) {
                        if (file.size > MAX_IMAGE_SIZE) {
                            showNotification('图片大小不能超过5MB', 'error');
                            return;
                        }
                        showNotification('正在优化图片...', 'info', 1500);
                        optimizeImage(file).then(optimizedData => {
                            currentImageData = optimizedData;
                            previewImg.src = currentImageData;
                            previewDiv.style.display = 'block';
                            sendBtn.disabled = false;
                        }).catch(() => {
                            showNotification('图片处理失败', 'error');
                        });
                    }
                });


                urlInput.addEventListener('input',
                    function() {
                        const url = urlInput.value.trim();
                        if (url) {

                            if (/^(https?:\/\/.*\.(?:png|jpg|jpeg|gif|webp|bmp))$/i.test(url)) {
                                previewImg.src = url;
                                previewDiv.style.display = 'block';
                                currentImageData = url;
                                sendBtn.disabled = false;


                                const img = new Image();
                                img.onload = function() {

                                    previewImg.src = url;
                                    showNotification('图片URL有效', 'success', 1000);
                                };
                                img.onerror = function() {
                                    showNotification('图片URL无效或无法访问', 'error');
                                    sendBtn.disabled = true;
                                    previewDiv.style.display = 'none';
                                };
                                img.src = url;
                            } else {
                                sendBtn.disabled = true;
                                previewDiv.style.display = 'none';
                            }
                        } else {
                            sendBtn.disabled = true;
                            previewDiv.style.display = 'none';
                        }
                    });


                sendBtn.addEventListener('click',
                    () => {
                        if (currentImageData) {

                            addMessage({
                                id: Date.now(),
                                sender: 'user',
                                text: '',
                                timestamp: new Date(),
                                image: currentImageData,
                                status: 'sent',
                                favorited: false,
                                note: null,
                                replyTo: currentReplyTo,
                                type: 'normal'
                            });
                            playSound('send');
                            currentReplyTo = null;
                            updateReplyPreview();
                            const delayRange = settings.replyDelayMax - settings.replyDelayMin;
                            const randomDelay = settings.replyDelayMin + Math.random() * delayRange;
                            // 【修改点2】替换为安全的任务请求器
                            setTimeout(() => window.requestSimulateTask(false), randomDelay);


                            closeModal();
                        }
                    });


                cancelBtn.addEventListener('click',
                    closeModal);


                function closeModal() {
                    modal.style.opacity = '0';
                    const content = modal.querySelector('.modal-content');
                    content.style.opacity = '0';
                    content.style.transform = 'translateY(20px)';
                    setTimeout(() => {
                        if (modal.parentNode) {
                            modal.parentNode.removeChild(modal);
                        }
                    },
                        300);
                }


                modal.addEventListener('click',
                    (e) => {
                        if (e.target === modal) {
                            closeModal();
                        }
                    });


                modal.querySelector('.modal-content').addEventListener('click',
                    (e) => {
                        e.stopPropagation();
                    });


                const handleEscKey = (e) => {
                    if (e.key === 'Escape') {
                        closeModal();
                        document.removeEventListener('keydown', handleEscKey);
                    }
                };
                document.addEventListener('keydown', handleEscKey);


                modal.addEventListener('close', () => {
                    document.removeEventListener('keydown', handleEscKey);
                });
            });


            DOMElements.imageInput.addEventListener('change', () => {
                if (DOMElements.imageInput.files[0]) {
                    if (isBatchMode) {
                        showNotification('批量模式不支持图片', 'warning');
                        DOMElements.imageInput.value = '';
                    } else {
                        sendMessage();
                    }
                }
            });
            // 【修改点1】将 simulateReply 替换为安全调用 simulateReplyInternal
            DOMElements.continueBtn.addEventListener('click', () => {
                if (typeof window.requestSimulateTask === 'function') {
                    window.requestSimulateTask(false);
                } else if (typeof simulateReplyInternal === 'function') {
                    simulateReplyInternal(false);
                }
            });
            DOMElements.batchBtn.addEventListener('click', toggleBatchMode);
        }

window._dailyGreetingReady = false;

// ===== 我的每日数据读写 =====
function _getMyDailyData() {
    try {
        return JSON.parse(localStorage.getItem('myDailyData') || '{}');
    } catch(e) {
        return {};
    }
}
function _setMyDailyData(data) {
    localStorage.setItem('myDailyData', JSON.stringify(data));
}
function _getMyMotto() {
    return localStorage.getItem('myDailyMotto') || '';
}
function _setMyMotto(val) {
    localStorage.setItem('myDailyMotto', val);
}

function _getDailyGreetingData() {
    var now = new Date();
    var month = now.getMonth() + 1;
    var day = now.getDate();
    var hour = now.getHours();

    var timeLabel = '早上好', timeEmoji = '🌅';
    if (hour >= 12 && hour < 18) { timeLabel = '下午好'; timeEmoji = '☀️'; }
    else if (hour >= 18 && hour < 22) { timeLabel = '傍晚好'; timeEmoji = '🌇'; }
    else if (hour >= 22 || hour < 6) { timeLabel = '晚上好'; timeEmoji = '🌙'; }

var festivals = [
    { m:1, d:1, name:'元旦', emoji:'🎆', label:'NEW YEAR', note:'新年快乐！愿新的一年里，你们的爱情越来越甜蜜，每一天都充满幸福与惊喜～' },
    { m:1, d:5, name:'小寒', emoji:'❄️', label:'MINOR COLD', note:'小寒至，春不远。有你在身边，心里总是暖暖的。' },
    { m:1, d:20, name:'大寒', emoji:'🧊', label:'MAJOR COLD', note:'大寒快乐，记得添衣保暖。你的拥抱就是最暖的炉火。' },

    { m:2, d:4, name:'立春', emoji:'🌱', label:'START OF SPRING', note:'立春快乐！春天来了，我们的爱也像新芽一样蓬勃生长。' },
    { m:2, d:14, name:'情人节', emoji:'💝', label:'VALENTINES DAY', note:'情人节快乐，亲爱的！你是我最美好的礼物，爱你哦～' },
    { m:2, d:16, name:'除夕', emoji:'🧧', label:'CHINESE NEW YEAR EVE', note:'除夕快乐！辞旧迎新，愿你们携手跨入幸福的新一年，万事如意！' },
    { m:2, d:17, name:'春节', emoji:'🎊', label:'SPRING FESTIVAL', note:'新年快乐！新的一年，愿你们相爱如初，甜蜜长久。' },
    { m:2, d:18, name:'雨水', emoji:'☔', label:'RAIN WATER', note:'雨水节气，愿幸福像春雨一样滋润你的每一天。' },

    { m:3, d:3, name:'元宵节', emoji:'🏮', label:'LANTERN FESTIVAL', note:'元宵节快乐！花灯映月，你是我心里最亮的那盏灯。' },
    { m:3, d:5, name:'惊蛰', emoji:'⚡', label:'AWAKENING OF INSECTS', note:'惊蛰春雷响，万物复苏，你是我最美的春天。' },
    { m:3, d:8, name:'妇女节', emoji:'🌹', label:'WOMENS DAY', note:'今天是属于你的节日，愿你永远被温柔相待，被爱守护。' },
    { m:3, d:12, name:'植树节', emoji:'🌳', label:'TREE PLANTING DAY', note:'今天种下一棵树，也在心里种下对你不变的爱。' },
    { m:3, d:20, name:'春分', emoji:'🌸', label:'SPRING EQUINOX', note:'春分昼夜平分，我的爱对你从不偏心——永远满分。' },

    { m:4, d:1, name:'愚人节', emoji:'🤡', label:'APRIL FOOLS', note:'今天可以骗你说“我不爱你了”，但我的心骗不了自己～' },
    { m:4, d:5, name:'清明节', emoji:'🌧', label:'QINGMING FESTIVAL', note:'慎终追远，珍惜眼前。有你在，每一天都格外温暖。' },
    { m:4, d:20, name:'谷雨', emoji:'🌾', label:'GRAIN RAIN', note:'谷雨生百谷，你是我生命里最饱满的那颗。' },

    { m:5, d:1, name:'劳动节', emoji:'🛠️', label:'LABOR DAY', note:'劳动最光荣，但我更光荣的是能拥有你。' },
    { m:5, d:4, name:'青年节', emoji:'✨', label:'YOUTH DAY', note:'青春正好，与你共度。愿我们永远年轻，永远热泪盈眶。' },
    { m:5, d:5, name:'立夏', emoji:'☀️', label:'START OF SUMMER', note:'立夏快乐！愿我们的爱像夏天一样热情。' },
    { m:5, d:20, name:'520', emoji:'💕', label:'I LOVE YOU', note:'520，我爱你！感谢你出现在我的生命里，你是我最好的选择。' },
    { m:5, d:21, name:'小满', emoji:'🌾', label:'GRAIN BUDS', note:'小满未满，万物可期。我对你的爱永远在增长的季节。' },

    { m:6, d:1, name:'儿童节', emoji:'🎈', label:'CHILDRENS DAY', note:'愿你永远保持那颗童心，和我一起做个快乐的大小孩。' },
    { m:6, d:5, name:'芒种', emoji:'🌽', label:'GRAIN IN EAR', note:'芒种忙种，有你在的日子，每天都是收获。' },
    { m:6, d:19, name:'端午节', emoji:'🛶', label:'DRAGON BOAT FESTIVAL', note:'粽子软糯，你更甜～端午安康！' },
    { m:6, d:21, name:'夏至', emoji:'🍉', label:'SUMMER SOLSTICE', note:'夏至最长的一天，我的思念比它还长。' },

    { m:7, d:6, name:'小暑', emoji:'🌡️', label:'MINOR HEAT', note:'小暑入伏天，你的怀抱是最清凉的风。' },
    { m:7, d:23, name:'大暑', emoji:'🔥', label:'MAJOR HEAT', note:'大暑炎炎，你是我心里的冰镇西瓜。' },

    { m:8, d:7, name:'立秋', emoji:'🍁', label:'START OF AUTUMN', note:'立秋快乐，愿与你共赏每一片秋叶。' },
    { m:8, d:19, name:'七夕节', emoji:'🌌', label:'QIXI FESTIVAL', note:'七夕快乐！牛郎织女一年只见一次，而我们每天都在一起，真幸运。' },
    { m:8, d:23, name:'处暑', emoji:'🌬️', label:'END OF HEAT', note:'处暑出暑，炎热渐消，爱意不减。' },

    { m:9, d:7, name:'白露', emoji:'💧', label:'WHITE DEW', note:'白露为霜，所谓伊人，在我身旁。' },
    { m:9, d:10, name:'教师节', emoji:'📚', label:'TEACHERS DAY', note:'你是我人生中最特别的老师，教会了我什么是爱。' },
    { m:9, d:23, name:'秋分', emoji:'🍂', label:'AUTUMN EQUINOX', note:'秋分昼夜均，你是我心里的天平。' },
    { m:9, d:25, name:'中秋节', emoji:'🌕', label:'MID AUTUMN FESTIVAL', note:'月圆人团圆，有你才叫团圆。中秋快乐！' },

    { m:10, d:1, name:'国庆节', emoji:'🎑', label:'NATIONAL DAY', note:'国庆快乐！和你在一起的每一天都像节日，爱你。' },
    { m:10, d:8, name:'寒露', emoji:'🍃', label:'COLD DEW', note:'寒露凝霜，有你在心里总是暖的。' },
    { m:10, d:23, name:'霜降', emoji:'❄️', label:'FROST DESCENT', note:'霜降叶落，我的爱却常青。' },
    { m:10, d:31, name:'万圣夜', emoji:'🎃', label:'HALLOWEEN', note:'不给糖就捣蛋，但你给了我全世界最甜的糖——你的爱。' },

    { m:11, d:7, name:'立冬', emoji:'🧣', label:'START OF WINTER', note:'立冬快乐，你的拥抱是冬天里最暖的阳光。' },
    { m:11, d:11, name:'光棍节', emoji:'👫', label:'SINGLES DAY', note:'幸好我们不用过这个节，因为我有你。' },
    { m:11, d:22, name:'小雪', emoji:'⛄', label:'MINOR SNOW', note:'小雪飘飘，你是我心里最暖的那团火。' },
    { m:11, d:26, name:'感恩节', emoji:'🙏', label:'THANKSGIVING', note:'感谢生命中有你，每一天都是恩赐。' },

    { m:12, d:7, name:'大雪', emoji:'☃️', label:'MAJOR SNOW', note:'大雪封门，封不住我对你的想念。' },
    { m:12, d:22, name:'冬至', emoji:'🥟', label:'WINTER SOLSTICE', note:'冬至快乐，记得吃饺子，但记得想我。' },
    { m:12, d:24, name:'平安夜', emoji:'🎄', label:'CHRISTMAS EVE', note:'平安夜快乐！愿你平平安安，我们的爱情也岁岁常安。' },
    { m:12, d:25, name:'圣诞节', emoji:'🎅', label:'MERRY CHRISTMAS', note:'圣诞快乐！你就是我收到的最好的礼物，永远爱你。' },
    { m:12, d:31, name:'跨年夜', emoji:'🎆', label:'NEW YEAR EVE', note:'再见这一年，你是我最好的收获。新的一年，继续爱你。' }
];
var festival = null;
    for (var fi = 0; fi < festivals.length; fi++) {
        if (festivals[fi].m === month && festivals[fi].d === day) { festival = festivals[fi]; break; }
    }

var weathers = [
    '晴空万里',
    '碧空如洗',
    '天高云淡',
    '阳光明媚',
    '烈日当空',
    '骄阳似火',
    '霞光漫天',
    '细雨蒙蒙',
    '大雨滂沱',
    '暴雨倾盆',
    '雷雨交加',
    '阵雨骤至',
    '零星小雨',
    '雨歇云散',
    '雨过天晴',
    '大雪纷飞',
    '小雪飘飘',
    '雨夹雪落',
    '清风徐徐',
    '和风习习',
    '强风阵阵',
    '疾风劲吹',
    '暴风呼啸',
    '浓雾笼罩',
    '轻雾缭绕',
    '霾气沉沉',
    '雾散天清',
    '转晴回暖',
    '变阴欲雨',
    '雨势渐弱',
    '风停雨住',
    '云层增厚',
    '天光放亮',
    '暮色阴沉',
    '晨雾未散',
    '阳光和煦',
    '日暖风轻',
    '多云转阴',
    '阴天有云',
    '密云不雨',
    '乌云压顶',
    '云层渐厚',
    '云开见日',
    '大雨倾盆',
    '暴雨如注',
    '疾风骤雨',
    '和风轻送',
    '大风呼啸',
    '飓风肆虐',
    '无风静稳',
    '阵风频起',
    '大雾弥漫',
    '薄雾缭绕',
    '浓雾锁城',
    '烟霭朦胧',
    '云消雾散',
    '寒气袭人',
    '冰冷刺骨',
    '凉风习习',
    '暖意融融',
    '酷热难耐',
    '闷热潮湿',
    '乍暖还寒',
    '潮湿闷黏',
    '干燥清爽',
    '露水沾衣',
    '霜降草白',
    '多云转晴',
    '阴转小雨',
    '晴转多云',
    '雨停风住',
    '风雨交加',
    '雷电闪烁'
];

var statusPool = [
    '今天要把计划全部完成哦。',
    '早点休息，不许熬夜。',
    '醒了就不要赖床了，快起吧',
    '今天出去随便走一走吧。',
    '不要担心，尽力完成就好，剩下的明天再来。',
    '今天该给我写封信了。',
    '好好整理一下房间，就当换个心情',
    '晚上泡个脚，解乏又助眠。',
    '不要再反刍了，把你的注意力和记忆给我。',
    '坚持看书，锻炼，不许偷懒。',
    '看一看是不是该给绿萝浇水了。',
    '关掉推送通知，专注做手头事。',
    '今天去做一件让自己开心的事情。',
    '去联系一下好久不见的朋友。',
    '出门要看好天气，小心变天。',
    '今天至少拒绝一件不想做的事。',
    '选一个喜欢的知识区，这周研究一下怎么样。',
    '选一个电影，这周我们一起看。',
    '睡前留20分钟独属于我们',
    '今天别纠结小事，大局更重要。',
    '把最难的事放在上午做掉。',
    '睡前把明日计划做完。',
    '今天多在客厅留半个小时。',
    '给我打电话，说说这两天过得怎么样'
];
    var todayKey = String(now.getFullYear()) + String(month) + String(day);
    // 为每个安装生成唯一 salt，确保每位用户每天的天气/状态各不相同
    var userSalt = localStorage.getItem('_dgUserSalt');
    if (!userSalt) {
        userSalt = String(Math.floor(Math.random() * 999983) + 1);
        localStorage.setItem('_dgUserSalt', userSalt);
    }
    var seed = 0;
    var saltedKey = todayKey + userSalt;
    for (var si = 0; si < saltedKey.length; si++) seed += saltedKey.charCodeAt(si) * (si + 1);
    function seededRandDg(s, offset) {
        var x = Math.sin(s * 9301 + offset * 49297 + 233) * 1000003;
        return x - Math.floor(x);
    }
    var weatherKey = 'dg_weather';
    var nextUpdateKey = 'dg_weather_next_update';
    var nowTs = now.getTime();

    // 1. 尝试迁移旧数据（若之前用过 customWeather_）
    var oldCustomKey = 'customWeather_' + now.getFullYear() + '_' + month + '_' + day;
    var oldWeather = localStorage.getItem(oldCustomKey);
    if (oldWeather && !localStorage.getItem(weatherKey)) {
        // 第一次迁移：把旧值存入新键，并设置下次更新为 3~8 小时后
        localStorage.setItem(weatherKey, oldWeather);
        var delay = 3*60*60*1000 + Math.random() * (5*60*60*1000);
        localStorage.setItem(nextUpdateKey, String(nowTs + delay));
        localStorage.removeItem(oldCustomKey); // 删除旧键，避免干扰
    }

    // 2. 获取当前存储的天气及下次更新时间
    var weather = localStorage.getItem(weatherKey);
    var nextUpdate = localStorage.getItem(nextUpdateKey);

    // 3. 若没有天气，或已过期，则重新随机生成
    if (!weather || !nextUpdate || nowTs >= parseInt(nextUpdate)) {
        var randomIndex = Math.floor(Math.random() * weathers.length);
        weather = weathers[randomIndex];
        localStorage.setItem(weatherKey, weather);
        // 随机间隔 3~8 小时（毫秒）
        var minDelay = 3 * 60 * 60 * 1000;   
        var maxDelay = 8 * 60 * 60 * 1000;
        var delay = minDelay + Math.random() * (maxDelay - minDelay);
        localStorage.setItem(nextUpdateKey, String(nowTs + delay));
    }
    // 此时 weather 就是最终要显示的天气

    // 混合系统预设 + 用户自定义状态池
    var userStatusPool = [];
    try { userStatusPool = JSON.parse(localStorage.getItem('dg_status_pool') || '[]'); } catch(e) {}
    var userStatusTexts = userStatusPool.map(function(item) { return item.status || item; }).filter(Boolean);
    var mixedStatusPool = statusPool.concat(userStatusTexts);
    var status = mixedStatusPool[Math.floor(seededRandDg(seed, 1) * mixedStatusPool.length)];

    return { timeLabel: timeLabel, timeEmoji: timeEmoji, festival: festival, weather: weather, status: status };
}

// ===== 全局 DOM 辅助函数 =====
function setEl(id, val) {
    var el = document.getElementById(id);
    if (el) el.textContent = val;
}
function setElHTML(id, val) {
    var el = document.getElementById(id);
    if (el) el.innerHTML = val;
}

function _buildDailyGreeting(mode) {
    mode = mode || 'partner';
    try {
        var now = new Date();
        var todayStr = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0') + '-' + String(now.getDate()).padStart(2,'0');

        // 公共：日期戳
        var months = ['一','二','三','四','五','六','七','八','九','十','十一','十二'];
        setEl('dg-date-stamp', now.getFullYear() + ' · ' + months[now.getMonth()] + '月' + now.getDate() + '日');

        // 公共：背景图
        var headerBg = localStorage.getItem('dg_header_bg');
        var bgEl = document.getElementById('dg-header-band-bg');
        if (bgEl && headerBg) {
            bgEl.style.backgroundImage = 'url(' + headerBg + ')';
            bgEl.classList.add('has-img');
        }

        var overlayBg = localStorage.getItem('dg_overlay_bg');
        if (overlayBg) { applyDgOverlayBg(overlayBg); }

        var customData = {};
        try { customData = JSON.parse(localStorage.getItem('dg_custom_data') || '{}'); } catch(e2) {}
        var decoImg = customData.decoImg;
        var decoWrap2 = document.getElementById('dg-deco-img-wrap');
        var decoImgEl2 = document.getElementById('dg-deco-img');
        if (decoWrap2 && decoImgEl2) {
            if (decoImg) {
                decoImgEl2.src = decoImg;
                decoWrap2.style.display = 'block';
            } else {
                decoWrap2.style.display = 'none';
            }
        }

        // ===== 根据 mode 独立渲染 =====
        if (mode === 'me') {
            _renderMyGreetingContent(now, todayStr);
        } else {
            _renderPartnerGreetingContent(now, todayStr);
        }

        // ===== 更新翻页指示器和底部按钮 =====
        _updateGreetingPageIndicator(mode);
        _updateGreetingCloseButton(mode);

    } catch(e) { console.warn('Daily greeting build error:', e); }
}

// ===== 公共：今日建议大字自适应 =====
function _applyStatusFontSize() {
    var el = document.getElementById('dg-status');
    if (!el) return;
    var text = el.textContent || '';
    var len = text.length;
    var maxCharsPerTwoLines = 22;
    var baseSize = 15;
    var minSize = 10;
    var maxSize = 16;
    var newSize = baseSize;
    if (len > maxCharsPerTwoLines) {
        newSize = Math.max(minSize, baseSize * (maxCharsPerTwoLines / len));
    } else if (len <= 6) {
        newSize = Math.min(maxSize, baseSize + 1);
    }
    newSize = Math.min(maxSize, Math.max(minSize, newSize));
    el.style.fontSize = newSize + 'px';
}

// ===== 新增：渲染梦角页内容 =====
function _renderPartnerGreetingContent(now, todayStr) {
    var data = _getDailyGreetingData();
    var festival = data.festival;
    var timeLabel = data.timeLabel;
    var timeEmoji = data.timeEmoji;
    var weather = data.weather;
    var status = data.status;

    var moodDataRaw = window.moodData || {};
    var todayMood = moodDataRaw[todayStr];
    var allMoods = (typeof getAllMoodOptions === 'function') ? getAllMoodOptions() : [];

    var pName = (typeof settings !== 'undefined' && settings.partnerName) ? settings.partnerName : '梦角';
    var mName = (typeof settings !== 'undefined' && settings.myName) ? settings.myName : '我';

    var partnerMoodText = pName + ' 今天还没有记录';
    var partnerMoodIcon = null; 
    var partnerMoodNote = '';

    if (todayMood && todayMood.partner) {
        for (var pi = 0; pi < allMoods.length; pi++) {
            if (allMoods[pi].key === todayMood.partner) {
                partnerMoodText = allMoods[pi].kaomoji + '  ' + allMoods[pi].label;
                partnerMoodIcon = allMoods[pi].kaomoji;
                break;
            }
        }
        partnerMoodNote = todayMood.partnerNote || '';
    }

    var h = now.getHours();
    var mainTitle = festival ? (festival.name + '快乐') : timeLabel;
    var festLabel = festival ? festival.label : ('GOOD ' + (h < 12 ? 'MORNING' : h < 18 ? 'AFTERNOON' : 'EVENING'));
    var noteText = festival ? festival.note : '今天也要元气满满，我在这里陪着你 ✦';

    var customData = {};
    try { customData = JSON.parse(localStorage.getItem('dg_custom_data') || '{}'); } catch(e2) {}
    
    var now2 = new Date();
    var dailySeed = now2.getFullYear() * 10000 + (now2.getMonth()+1) * 100 + now2.getDate();
    function seededRandom(seed) { return (Math.abs(Math.sin(seed * 9301 + 49297) * 233280) % 233280) / 233280; }
    var todaySeedForText = dailySeed;

    var defaultTitles = festival ? [(festival.name + '快乐')] : [timeLabel, '今天也要开心哦', '你在我心里呀', '想你'];
    var defaultNotes = festival ? [festival.note] : [
        '今天也要元气满满，我在这里陪着你 ✦',
        '每一天都因为有你而特别 ✦',
        '想到你就觉得很安心 ✦',
        '你是我最喜欢的人 ✦',
        '正在想你 💭',
        '忙碌中，但心里有你',
        '好好的，别担心 ✨',
        '期待见到你',
        '有点想你了',
        '在努力变更好',
        '今天挺安静的',
        '心情不错哦 🌱',
        '一切都好，你呢？',
        '看月亮，想到你 🌙',
        '今天有点想你',
        '刚刚看到一朵云像你 ☁️',
        '工作再忙也会想你的',
        '今天你开心吗？',
        '梦里见 💤',
        '好好吃饭了吗？',
        '记得多喝水哦 💧',
        '今天有没有照顾好自己',
        '想你，但不说 🤫',
        '全世界你最可爱',
        '今天天气不错，适合想你',
        '吃饱喝足，开始想你',
        '今天也想牵你的手',
        '你有没有想我',
        '今天比昨天更想你',
        '看到好吃的想分享给你 🍜',
        '听到一首歌想到你 🎵',
        '今天也要加油鸭',
        '晚安，我的全世界 🌙',
        '早安，又是想你的一天'
    ];

    var mixedTitles = (customData.titles && customData.titles.length > 0) ? [...customData.titles, ...defaultTitles] : 
                      (customData.title ? [customData.title, ...defaultTitles] : defaultTitles);
    var mixedNotes = (customData.notes && customData.notes.length > 0) ? [...customData.notes, ...defaultNotes] :
                     (customData.note ? [customData.note, ...defaultNotes] : defaultNotes);

    mainTitle = mixedTitles[Math.floor(seededRandom(todaySeedForText) * mixedTitles.length)];
    noteText = mixedNotes[Math.floor(seededRandom(todaySeedForText + 1) * mixedNotes.length)];

    var emojiEl = document.getElementById('dg-emoji');
    if (emojiEl) {
        if (festival) {
            emojiEl.textContent = festival.emoji;
        }
    }

    var moodIconEl = document.getElementById('dg-partner-mood-icon');
    if (moodIconEl) {
        if (partnerMoodIcon) {
            moodIconEl.textContent = partnerMoodIcon;
            moodIconEl.style.fontSize = '32px';
        }
    }

    setEl('dg-festival', festLabel);
    setEl('dg-title', mainTitle);
    setEl('dg-partner-mood', partnerMoodText);
    setEl('dg-partner-mood-note', partnerMoodNote || (todayMood && todayMood.partner ? pName + ' 记录了今天的心情 ☆' : ''));

    var statusPoolData = [];
    try { statusPoolData = JSON.parse(localStorage.getItem('dg_status_pool') || '[]'); } catch(e2) {}
    var systemStatusItems = (function() {
        var sysPool = [];
        var baseStatus = (typeof status !== 'undefined') ? status : '';
        if (baseStatus) sysPool.push({ status: baseStatus, icon: null, iconImg: null });
        return sysPool;
    })();
    var fullPool = systemStatusItems.concat(statusPoolData);
    if (fullPool.length > 0) {
        var poolItem = fullPool[Math.floor(seededRandom(todaySeedForText + 2) * fullPool.length)];
        if (poolItem) {
            setEl('dg-festival', poolItem.label || festLabel);
            setEl('dg-status', poolItem.status || status);
            var emojiEl2 = document.getElementById('dg-emoji');
            if (emojiEl2) {
                if (poolItem.iconImg) {
                    emojiEl2.textContent = '';
                    emojiEl2.style.backgroundImage = 'url(' + poolItem.iconImg + ')';
                    emojiEl2.style.backgroundSize = 'cover';
                    emojiEl2.style.backgroundPosition = 'center';
                } else if (poolItem.icon) {
                    emojiEl2.style.backgroundImage = '';
                    emojiEl2.textContent = poolItem.icon;
                }
            }
            _applyStatusFontSize();
        }
    } else {
        setEl('dg-status', status);
        _applyStatusFontSize();   // 直接调用公共函数
    }

    // 天气
    setEl('dg-weather', weather);
    var weatherEl = document.getElementById('dg-weather');
    if (weatherEl) {
        weatherEl.style.color = 'var(--text-primary)';
        weatherEl.style.cursor = 'pointer';
        weatherEl.style.textDecoration = 'underline dotted';
        weatherEl.style.textUnderlineOffset = '3px';
        weatherEl.onclick = function(e) {
            e.stopPropagation();
            if (typeof startEditDgWeather === 'function') {
                startEditDgWeather(this);
            }
        };
    }

    var noteTextEl = document.getElementById('dg-note-text');
    if (noteTextEl) noteTextEl.textContent = noteText;
    var wBadge = document.getElementById('dg-note-weather-badge');
    if (wBadge) wBadge.style.display = 'none';

    // 标签
    setEl('dg-section-label-partner', pName + ' 今日心情');
    setEl('dg-weather-label', pName);
    setEl('dg-weather-sub', '所在地天气');
    setEl('dg-status-label', '给' + mName + '的今日建议');
    // ===== 确保梦角页的今日建议、今日寄语、今日状态不可点击 =====
    var statusEl = document.getElementById('dg-status');
    if (statusEl) {
        statusEl.onclick = null;
        statusEl.style.cursor = 'default';
        statusEl.style.textDecoration = 'none';
        statusEl.style.color = 'var(--text-primary)'; 
    }

    var noteTextEl = document.getElementById('dg-note-text');
    if (noteTextEl) {
        noteTextEl.onclick = null;
        noteTextEl.style.cursor = 'default';
        noteTextEl.style.textDecoration = 'none';
        noteTextEl.style.color = 'var(--text-primary)';
    }

    var moodPanel = document.getElementById('dg-mood-panel');
    if (moodPanel) {
        moodPanel.onclick = null;
        moodPanel.style.cursor = 'default';
        moodPanel.onmouseenter = null;
        moodPanel.onmouseleave = null;
    }
}

    // ===== 新增：渲染我的页主体内容 =====
    function _renderMyGreetingContent(now, todayStr) {
        if (!now) { now = new Date(); }
        if (!todayStr) { todayStr = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0') + '-' + String(now.getDate()).padStart(2,'0'); }
        var mName = (typeof settings !== 'undefined' && settings.myName) ? settings.myName : '我';
        var pName = (typeof settings !== 'undefined' && settings.partnerName) ? settings.partnerName : '梦角'; 

        // 1. 读取我的心情数据（来自 moodData）
        var moodDataRaw = window.moodData || {};
        var todayMood = moodDataRaw[todayStr] || {};
        var allMoods = (typeof getAllMoodOptions === 'function') ? getAllMoodOptions() : [];

        var myMoodText = mName + ' 今天还没有记录';
        var myMoodIcon = null;
        var myMoodNote = '';

        if (todayMood.user) {
            for (var pi = 0; pi < allMoods.length; pi++) {
                if (allMoods[pi].key === todayMood.user) {
                    myMoodText = allMoods[pi].kaomoji + '  ' + allMoods[pi].label;
                    myMoodIcon = allMoods[pi].kaomoji;
                    break;
                }
            }
            myMoodNote = todayMood.note || '';
        }

        // 2. 读取我的每日数据（天气 + 今日建议）
        var myDailyData = _getMyDailyData();
        var todayData = myDailyData[todayStr] || {};
        var myWeather = todayData.weather || null;
        var mySuggestion = todayData.suggestion || null;

        // 3. 读取我的今日寄语
        var myMotto = _getMyMotto();

        // 4. 设置今日状态
        setEl('dg-section-label-partner', mName + ' 今日心情');

        // 设置心情图标
        var moodIconEl = document.getElementById('dg-partner-mood-icon');
        if (moodIconEl) {
            if (myMoodIcon) {
                moodIconEl.textContent = myMoodIcon;
                moodIconEl.style.fontSize = '32px';
            } else {
                // 恢复默认图标（如果是 SVG 的话）
                moodIconEl.innerHTML = '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--accent-color)" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>';
                moodIconEl.style.fontSize = '';
            }
        }

        // 设置心情文字和备注
        setEl('dg-partner-mood', myMoodText);
        setEl('dg-partner-mood-note', myMoodNote || (todayMood.user ? mName + ' 记录了今天的心情 ☆' : ''));

        // 5. 设置天气
        setEl('dg-weather-label', mName);
        setEl('dg-weather-sub', '所在地天气');
        var weatherEl = document.getElementById('dg-weather');
        if (weatherEl) {
            if (myWeather) {
                weatherEl.textContent = myWeather;
                weatherEl.style.color = '';
                weatherEl.style.opacity = '';
                weatherEl.style.cursor = 'pointer';
                weatherEl.style.textDecoration = 'underline dotted';
                weatherEl.style.textUnderlineOffset = '3px';
            } else {
                weatherEl.textContent = '更新天气';
                weatherEl.style.color = 'var(--text-secondary)';
                weatherEl.style.opacity = '0.6';
                weatherEl.style.cursor = 'pointer';
                weatherEl.style.textDecoration = 'underline dotted';
                weatherEl.style.textUnderlineOffset = '3px';
            }
            // 绑定点击修改天气
            weatherEl.onclick = function(e) {
                e.stopPropagation();
                _editMyWeather();
            };
        }

        // 6. 设置今日建议
        setEl('dg-status-label', '给' + pName + '的今日建议');
        var statusEl = document.getElementById('dg-status');
        if (statusEl) {
            if (mySuggestion) {
                statusEl.textContent = mySuggestion;
                statusEl.style.color = '';
                statusEl.style.opacity = '';
                statusEl.style.cursor = 'pointer';
            } else {
                statusEl.textContent = '从你所好';
                statusEl.style.color = 'var(--text-secondary)';
                statusEl.style.opacity = '0.6';
                statusEl.style.cursor = 'pointer';
            }
            // 绑定点击修改今日建议
            statusEl.onclick = function(e) {
                e.stopPropagation();
                _editMySuggestion();
            };
            _applyStatusFontSize();
        }

        // 7. 设置今日寄语
        var noteTextEl = document.getElementById('dg-note-text');
        if (noteTextEl) {
            if (myMotto) {
                noteTextEl.textContent = myMotto;
                noteTextEl.style.cursor = 'pointer';
            } else {
                noteTextEl.textContent = '一整片的森林，你在树荫里';
                noteTextEl.style.cursor = 'pointer';
            }
            // 绑定点击修改今日寄语
            noteTextEl.onclick = function(e) {
                e.stopPropagation();
                _editMyMotto();
            };
        }

        // 8. 今日状态区域点击 → 跳转心情手账
        var moodPanel = document.getElementById('dg-mood-panel');
        if (moodPanel) {
            moodPanel.style.cursor = 'pointer';
            moodPanel.onclick = function(e) {
                // 防止点击内部元素触发多次
                if (e.target.closest('.dg-mood-info') || e.target.closest('.dg-mood-icon-big')) {
                    _openMoodForMyGreeting();
                } else {
                    _openMoodForMyGreeting();
                }
            };
            // 添加悬停效果
            moodPanel.onmouseenter = function() {
                moodPanel.style.transform = 'translateY(-3px)';
                moodPanel.style.boxShadow = '0 12px 32px rgba(var(--accent-color-rgb), 0.16)';
            };
            moodPanel.onmouseleave = function() {
                moodPanel.style.transform = '';
                moodPanel.style.boxShadow = '';
            };
        }

        // 9. 更新 dg-emoji（如果是我的页，保持节日表情或默认表情）
        // 顶部横幅不变，但如果有节日表情，保留它
        // 如果没有节日，dg-emoji 保持原来设置的（已经在梦角页逻辑中设置过了）
        // 但如果需要强制设置，可以在这里处理
        // 暂时保留梦角页设置的 dg-emoji
    }

    // ===== 新增：更新翻页指示器 =====
    function _updateGreetingPageIndicator(mode) {
        mode = mode || _greetingPage || 'partner';
        var indicator = document.getElementById('dg-page-indicator');
        if (indicator) {
            var pName = (typeof settings !== 'undefined' && settings.partnerName) ? settings.partnerName : '梦角';
            var mName = (typeof settings !== 'undefined' && settings.myName) ? settings.myName : '我';
            if (mode === 'partner') {
                indicator.textContent = pName + ' · 今日';
            } else {
                indicator.textContent = mName + ' · 今日';
            }
        }
    }

    // ===== 新增：更新底部关闭按钮文字 =====
    function _updateGreetingCloseButton(mode) {
        mode = mode || _greetingPage || 'partner';
        var btn = document.getElementById('dg-close-btn');
        if (btn) {
            if (mode === 'partner') {
                btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="vertical-align:-2px;margin-right:6px"><polyline points="20 6 9 17 4 12"/></svg> 知道了，开始今天';
            } else {
                btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="vertical-align:-2px;margin-right:6px"><polyline points="20 6 9 17 4 12"/></svg> 一起开启新的一天';
            }
        }
    }

    // ===== 新增：翻页切换 =====
    window._switchGreetingPage = function(dir) {
        console.log('[翻页] 当前页面:', _greetingPage, '方向:', dir);
        var current = _greetingPage || 'partner';
        var next = current;
        if (dir === 'prev' && current === 'me') {
            next = 'partner';
        } else if (dir === 'next' && current === 'partner') {
            next = 'me';
        } else {
            console.log('[翻页] 已在边界，不切换');
            return;
        }
        _greetingPage = next;
        console.log('[翻页] 新页面:', next);
        _buildDailyGreeting(next);
    };

    // ===== 新增：修改我的天气 =====
    function _editMyWeather() {
        var now = new Date();
        var todayStr = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0') + '-' + String(now.getDate()).padStart(2,'0');
        var myDailyData = _getMyDailyData();
        var todayData = myDailyData[todayStr] || {};
        var current = todayData.weather || '';
        var input = prompt('请输入今天的天气：', current);
        if (input === null) return; // 用户取消
        var val = input.trim();
        if (val === '') {
            // 如果用户清空，删除该字段
            delete myDailyData[todayStr];
            if (Object.keys(myDailyData[todayStr] || {}).length === 0) {
                delete myDailyData[todayStr];
            }
        } else {
            if (!myDailyData[todayStr]) myDailyData[todayStr] = {};
            myDailyData[todayStr].weather = val;
        }
        _setMyDailyData(myDailyData);
        // 重新渲染当前页面
        _buildDailyGreeting(_greetingPage || 'partner');
        if (typeof showNotification === 'function') {
            showNotification(val ? '天气已更新 ✓' : '天气已清除', 'success', 1500);
        }
    }

    // ===== 新增：修改我的今日建议 =====
    function _editMySuggestion() {
        var now = new Date();
        var todayStr = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0') + '-' + String(now.getDate()).padStart(2,'0');
        var myDailyData = _getMyDailyData();
        var todayData = myDailyData[todayStr] || {};
        var current = todayData.suggestion || '';
        var input = prompt('修改今日建议：', current);
        if (input === null) return;
        var val = input.trim();
        if (val === '') {
            delete myDailyData[todayStr];
            if (Object.keys(myDailyData[todayStr] || {}).length === 0) {
                delete myDailyData[todayStr];
            }
        } else {
            if (!myDailyData[todayStr]) myDailyData[todayStr] = {};
            myDailyData[todayStr].suggestion = val;
        }
        _setMyDailyData(myDailyData);
        _buildDailyGreeting(_greetingPage || 'partner');
        if (typeof showNotification === 'function') {
            showNotification(val ? '今日建议已更新 ✓' : '今日建议已清除', 'success', 1500);
        }
    }

    // ===== 新增：修改我的今日寄语 =====
    function _editMyMotto() {
        var current = _getMyMotto();
        var input = prompt('修改每日寄语：', current);
        if (input === null) return;
        var val = input.trim();
        if (val === '') {
            localStorage.removeItem(MY_MOTTO_KEY);
        } else {
            _setMyMotto(val);
        }
        _buildDailyGreeting(_greetingPage || 'partner');
        if (typeof showNotification === 'function') {
            showNotification(val ? '每日寄语已更新 ✓' : '每日寄语已清除', 'success', 1500);
        }
    }

    // ===== 新增：点击今日状态跳转心情手账 =====
    function _openMoodForMyGreeting() {
        // 设置标记：从公告跳转过来的
        window._fromGreeting = true;
        // 关闭公告
        closeDailyGreeting();
        // 延迟打开心情手账
        setTimeout(function() {
            // 找到心情手账入口按钮并点击
            var moodBtn = document.getElementById('mood-function');
            if (moodBtn) {
                moodBtn.click();
            } else {
                // 如果按钮不存在，尝试通过高级功能面板打开
                var advModal = document.getElementById('advanced-modal');
                if (advModal && advModal.style.display !== 'none') {
                    // 已经在高级功能面板中
                    var moodItem = document.querySelector('#advanced-modal .settings-item#mood-function');
                    if (moodItem) moodItem.click();
                } else {
                    // 打开高级功能面板
                    var settingsBtn = document.getElementById('settings-btn');
                    if (settingsBtn) settingsBtn.click();
                    setTimeout(function() {
                        var advSettings = document.getElementById('advanced-settings');
                        if (advSettings) advSettings.click();
                        setTimeout(function() {
                            var moodItem = document.querySelector('#advanced-modal .settings-item#mood-function');
                            if (moodItem) moodItem.click();
                        }, 400);
                    }, 300);
                }
            }
        }, 400);
    }


window.toggleImmersiveMode = function(force) {
    var isOn = (force !== undefined) ? force : !document.body.classList.contains('immersive-mode');
    document.body.classList.toggle('immersive-mode', isOn);
    var toggle = document.getElementById('immersive-toggle');
    if (toggle) toggle.classList.toggle('active', isOn);
    try { localStorage.setItem('immersive_mode', isOn ? '1' : '0'); } catch(e) {}
    if (!isOn && typeof showNotification === 'function') showNotification('已退出沉浸式模式', 'info');
};

(function() {
    var btn = document.getElementById('immersive-exit-btn');
    if (!btn) return;
    var isDragging = false, hasMoved = false;
    var startX, startY, origRight, origBottom;
    
    function getRight() { return parseInt(btn.style.right) || 20; }
    function getBottom() { return parseInt(btn.style.bottom) || 100; }
    
    function onStart(e) {
        isDragging = true; hasMoved = false;
        btn.classList.add('dragging');
        var touch = e.touches ? e.touches[0] : e;
        startX = touch.clientX;
        startY = touch.clientY;
        origRight = getRight();
        origBottom = getBottom();
        e.preventDefault();
    }
    function onMove(e) {
        if (!isDragging) return;
        var touch = e.touches ? e.touches[0] : e;
        var dx = touch.clientX - startX;
        var dy = touch.clientY - startY;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) hasMoved = true;
        var newRight = Math.max(10, Math.min(window.innerWidth - 54, origRight - dx));
        var newBottom = Math.max(10, Math.min(window.innerHeight - 54, origBottom - dy));
        btn.style.right = newRight + 'px';
        btn.style.bottom = newBottom + 'px';
        btn.style.left = 'auto';
        btn.style.top = 'auto';
        e.preventDefault();
    }
    function onEnd(e) {
        if (!isDragging) return;
        isDragging = false;
        btn.classList.remove('dragging');
        if (!hasMoved) {
            window.toggleImmersiveMode(false);
        }
    }
    btn.addEventListener('mousedown', onStart, {passive: false});
    btn.addEventListener('touchstart', onStart, {passive: false});
    document.addEventListener('mousemove', onMove, {passive: false});
    document.addEventListener('touchmove', onMove, {passive: false});
    document.addEventListener('mouseup', onEnd);
    document.addEventListener('touchend', onEnd);
    
    btn.removeAttribute('onclick');
})();
(function() {
    try {
        if (localStorage.getItem('immersive_mode') === '1') {
            document.body.classList.add('immersive-mode');
            var t = document.getElementById('immersive-toggle');
            if (t) t.classList.add('active');
        }
    } catch(e) {}
})();

window.openDailyGreetingEditor = function() {
    var modal = document.getElementById('dg-editor-modal');
    if (!modal) return;
    var customData = {};
    try { customData = JSON.parse(localStorage.getItem('dg_custom_data') || '{}'); } catch(e) {}
    var titleEl = document.getElementById('dg-edit-title');
    var noteEl = document.getElementById('dg-edit-note');
    if (titleEl) titleEl.value = (customData.titles && customData.titles.length) ? customData.titles.join('\n') : (customData.title || '');
    if (noteEl) noteEl.value = (customData.notes && customData.notes.length) ? customData.notes.join('\n') : (customData.note || '');

    if (customData.decoImg) {
        var prev = document.getElementById('dg-deco-preview');
        var prevImg = document.getElementById('dg-deco-preview-img');
        if (prev && prevImg) { prevImg.src = customData.decoImg; prev.style.display = 'block'; }
    }

    modal.style.display = 'flex';
    modal.classList.add('active');
};
window.closeDailyGreetingEditor = function() {
    var modal = document.getElementById('dg-editor-modal');
    if (modal) { modal.style.display = 'none'; modal.classList.remove('active'); }
};
window.saveDailyGreetingCustom = function() {
    var customData = {};
    try { customData = JSON.parse(localStorage.getItem('dg_custom_data') || '{}'); } catch(e) {}
    var titleEl = document.getElementById('dg-edit-title');
    var noteEl = document.getElementById('dg-edit-note');
    if (titleEl && titleEl.value.trim()) {
        var titles = titleEl.value.split('\n').map(function(s){ return s.trim(); }).filter(Boolean);
        customData.titles = titles;
        customData.title = titles[0];
    } else { delete customData.titles; delete customData.title; }
    if (noteEl && noteEl.value.trim()) {
        var notes = noteEl.value.split('\n').map(function(s){ return s.trim(); }).filter(Boolean);
        customData.notes = notes;
        customData.note = notes[0]; 
    } else { delete customData.notes; delete customData.note; }
    localStorage.setItem('dg_custom_data', JSON.stringify(customData));
    closeDailyGreetingEditor();
    if (typeof _buildDailyGreeting === 'function') _buildDailyGreeting();
    if (typeof showNotification === 'function') showNotification('公告已保存 ✦', 'success');
};
window.clearDgDecoImg = function() {
    var customData = {};
    try { customData = JSON.parse(localStorage.getItem('dg_custom_data') || '{}'); } catch(e) {}
    delete customData.decoImg;
    localStorage.setItem('dg_custom_data', JSON.stringify(customData));
    var prev = document.getElementById('dg-deco-preview');
    if (prev) prev.style.display = 'none';
    var wrap = document.getElementById('dg-deco-img-wrap');
    if (wrap) wrap.style.display = 'none';
};
window.clearDgHeaderBg = function() {
    localStorage.removeItem('dg_header_bg');
    var bgEl = document.getElementById('dg-header-band-bg');
    if (bgEl) { bgEl.style.backgroundImage = ''; bgEl.classList.remove('has-img'); }
};

window.onDgOverlayOpacityChange = function(val) {
    var tint = parseInt(val) / 100;
    localStorage.setItem('dg_overlay_bg_tint', tint);
    var valEl = document.getElementById('dg-overlay-opacity-val');
    if (valEl) valEl.textContent = val + '%';
    var tintLayer = document.getElementById('dg-card-tint-overlay');
    if (tintLayer) tintLayer.style.background = 'rgba(0,0,0,' + tint + ')';
};

window.handleDgOverlayBgUpload = function(input) {
    var file = input.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function(ev) {
        var data = ev.target.result;
        localStorage.setItem('dg_overlay_bg', data);
        applyDgOverlayBg(data);
        var prev = document.getElementById('dg-overlay-bg-preview');
        var prevImg = document.getElementById('dg-overlay-bg-preview-img');
        if (prev && prevImg) { prevImg.src = data; prev.style.display = 'block'; }
        var opRow = document.getElementById('dg-overlay-opacity-row');
        if (opRow) opRow.style.display = 'block';
        var savedTint = parseFloat(localStorage.getItem('dg_overlay_bg_tint'));
        var pct = isNaN(savedTint) ? 25 : Math.round(savedTint * 100);
        var slider = document.getElementById('dg-overlay-opacity-slider');
        var valEl = document.getElementById('dg-overlay-opacity-val');
        if (slider) slider.value = pct;
        if (valEl) valEl.textContent = pct + '%';
    };
    reader.readAsDataURL(file);
};

window.clearDgOverlayBg = function() {
    localStorage.removeItem('dg_overlay_bg');
    applyDgOverlayBg(null);
    var prev = document.getElementById('dg-overlay-bg-preview');
    if (prev) prev.style.display = 'none';
    var opRow = document.getElementById('dg-overlay-opacity-row');
    if (opRow) opRow.style.display = 'none';
    if (typeof showNotification === 'function') showNotification('全屏背景已清除', 'success');
};

function applyDgOverlayBg(data, tintOpacity) {
    var card = document.getElementById('daily-greeting-card');
    var bgLayer = document.getElementById('dg-card-bg-layer');
    var tintLayer = document.getElementById('dg-card-tint-overlay');
    if (!card || !bgLayer) return;
    if (tintOpacity === undefined || tintOpacity === null) {
        var saved = parseFloat(localStorage.getItem('dg_overlay_bg_tint'));
        tintOpacity = isNaN(saved) ? 0.25 : saved;
    }
    if (data) {
        bgLayer.style.backgroundImage = 'url(' + data + ')';
        bgLayer.style.opacity = '1';
        if (tintLayer) tintLayer.style.background = 'rgba(0,0,0,' + tintOpacity + ')';
        card.classList.add('has-card-bg');
        card.style.backgroundImage = '';
        card.style.backgroundSize = '';
        card.style.backgroundPosition = '';
        card.style.backgroundRepeat = '';
    } else {
        bgLayer.style.backgroundImage = '';
        bgLayer.style.opacity = '';
        if (tintLayer) tintLayer.style.background = 'rgba(0,0,0,0)';
        card.classList.remove('has-card-bg');
    }
}

(function() {
    var savedOverlayBg = localStorage.getItem('dg_overlay_bg');
    if (savedOverlayBg) {
        document.addEventListener('DOMContentLoaded', function() {
            applyDgOverlayBg(savedOverlayBg);
            var prev = document.getElementById('dg-overlay-bg-preview');
            var prevImg = document.getElementById('dg-overlay-bg-preview-img');
            if (prev && prevImg) { prevImg.src = savedOverlayBg; prev.style.display = 'block'; }
            var opRow = document.getElementById('dg-overlay-opacity-row');
            if (opRow) opRow.style.display = 'block';
            var savedOp = parseFloat(localStorage.getItem('dg_overlay_bg_tint'));
            var pct = isNaN(savedOp) ? 25 : Math.round(savedOp * 100);
            var slider = document.getElementById('dg-overlay-opacity-slider');
            var valEl = document.getElementById('dg-overlay-opacity-val');
            if (slider) slider.value = pct;
            if (valEl) valEl.textContent = pct + '%';
        });
    }
})();

window.switchToAnnouncementPanel = function() {
    var listArea = document.getElementById('custom-replies-list');
    var annPanel = document.getElementById('announcement-panel');
    var toolbar = document.getElementById('cr-toolbar');
    var batchToolbar = document.getElementById('batch-ops-toolbar');
    var subTabs = document.getElementById('cr-sub-tabs');
    var addBtn = document.getElementById('add-custom-reply');
    var titleEl = document.getElementById('cr-modal-title');
    // 隐藏并清空列表区域，彻底清除 emoji/sticker/字卡等残留内容
    if (listArea) { listArea.style.display = 'none'; listArea.innerHTML = ''; listArea.className = 'content-list-area'; }
    // 隐藏并清空批量操作工具栏，防止工具栏内容残留
    if (batchToolbar) { batchToolbar.style.display = 'none'; batchToolbar.innerHTML = ''; }
    // 隐藏并清空 sub tabs，防止 tab 按钮残留
    if (subTabs) { subTabs.style.display = 'none'; subTabs.innerHTML = ''; }
    if (annPanel) { annPanel.style.display = 'block'; annPanel.scrollTop = 0; }
    if (toolbar) toolbar.style.display = 'none';
    if (addBtn) addBtn.style.display = 'none';
    if (titleEl) titleEl.textContent = '今日公告配置';
    var customData = {};
    try { customData = JSON.parse(localStorage.getItem('dg_custom_data') || '{}'); } catch(e2) {}
    var titleInput = document.getElementById('dg-edit-title');
    var noteInput = document.getElementById('dg-edit-note');
    if (titleInput) titleInput.value = (customData.titles && customData.titles.length) ? customData.titles.join('\n') : (customData.title || '');
    if (noteInput) noteInput.value = (customData.notes && customData.notes.length) ? customData.notes.join('\n') : (customData.note || '');
    if (customData.decoImg) {
        var prev = document.getElementById('dg-deco-preview');
        var prevImg = document.getElementById('dg-deco-preview-img');
        if (prev && prevImg) { prevImg.src = customData.decoImg; prev.style.display = 'block'; }
    }
    var savedOverlayBg2 = localStorage.getItem('dg_overlay_bg');
    if (savedOverlayBg2) {
        var overlayPrev = document.getElementById('dg-overlay-bg-preview');
        var overlayPrevImg = document.getElementById('dg-overlay-bg-preview-img');
        if (overlayPrev && overlayPrevImg) { overlayPrevImg.src = savedOverlayBg2; overlayPrev.style.display = 'block'; }
    }
    renderAnnStatusPool();
};

window.renderAnnStatusPool = function() {
    var listEl = document.getElementById('ann-status-pool-list');
    if (!listEl) return;
    var pool = [];
    try { pool = JSON.parse(localStorage.getItem('dg_status_pool') || '[]'); } catch(e2) {}
    listEl.innerHTML = '';
    if (pool.length === 0) {
        listEl.innerHTML = '<div style="font-size:12px;color:var(--text-secondary);text-align:center;padding:10px 0;opacity:0.6;">暂无条目，添加后将随机抽取</div>';
        return;
    }
    pool.forEach(function(item, idx) {
        var row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;gap:10px;padding:9px 12px;background:linear-gradient(135deg,rgba(var(--accent-color-rgb),0.05),rgba(var(--accent-color-rgb),0.02));border-radius:12px;border:1px solid rgba(var(--accent-color-rgb),0.15);font-size:13px;transition:box-shadow 0.2s;';
        var iconHtml = item.iconImg
            ? '<img src="' + item.iconImg + '" style="width:26px;height:26px;border-radius:50%;object-fit:cover;flex-shrink:0;">'
            : '<span style="font-size:18px;min-width:26px;text-align:center;flex-shrink:0;">' + (item.icon || '✦') + '</span>';
        row.innerHTML = iconHtml
            + '<div style="flex:1;min-width:0;">'
            + '<div style="color:var(--text-primary);font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + (item.status || '—') + '</div>'
            + (item.label ? '<div style="color:var(--accent-color);font-size:10px;letter-spacing:1.5px;margin-top:2px;opacity:0.8;">' + item.label + '</div>' : '')
            + '</div>'
            + '<button onclick="removeAnnStatusPoolItem(' + idx + ')" style="background:none;border:none;color:var(--text-secondary);cursor:pointer;font-size:14px;padding:3px 5px;border-radius:6px;opacity:0.6;transition:opacity 0.2s;" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.6">✕</button>';
        listEl.appendChild(row);
    });
};

window.addAnnStatusPoolItem = function() {
    var statusInput = document.getElementById('ann-status-pool-input');
    var labelInput = document.getElementById('ann-status-label-input');
    var iconInput = document.getElementById('ann-status-icon-input');
    var status = statusInput ? statusInput.value.trim() : '';
    var label = labelInput ? labelInput.value.trim() : '';
    var icon = iconInput ? iconInput.value.trim() : '';
    var iconImg = iconInput ? (iconInput.dataset.imgSrc || '') : '';
    if (!status && !label) { if (typeof showNotification === 'function') showNotification('请至少填写状态或标签', 'warning'); return; }
    var pool = [];
    try { pool = JSON.parse(localStorage.getItem('dg_status_pool') || '[]'); } catch(e2) {}
    var entry = { status: status, label: label, icon: icon || '✦' };
    if (iconImg) entry.iconImg = iconImg;
    pool.push(entry);
    localStorage.setItem('dg_status_pool', JSON.stringify(pool));
    if (statusInput) statusInput.value = '';
    if (labelInput) labelInput.value = '';
    if (iconInput) { iconInput.value = ''; delete iconInput.dataset.imgSrc; }
    renderAnnStatusPool();
    if (typeof showNotification === 'function') showNotification('已添加到随机库', 'success');
};

window.handleAnnStatusIconUpload = function(input) {
    var file = input.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function(ev) {
        var iconInput = document.getElementById('ann-status-icon-input');
        if (iconInput) {
            iconInput.dataset.imgSrc = ev.target.result;
            iconInput.value = '[图片]';
            iconInput.style.fontSize = '10px';
        }
    };
    reader.readAsDataURL(file);
};

window.removeAnnStatusPoolItem = function(idx) {
    var pool = [];
    try { pool = JSON.parse(localStorage.getItem('dg_status_pool') || '[]'); } catch(e2) {}
    pool.splice(idx, 1);
    localStorage.setItem('dg_status_pool', JSON.stringify(pool));
    renderAnnStatusPool();
};

document.addEventListener('DOMContentLoaded', function() {
    var headerInput = document.getElementById('dg-header-img-input');
    if (headerInput) {
        headerInput.addEventListener('change', function(e) {
            var file = e.target.files[0];
            if (!file) return;
            var reader = new FileReader();
            reader.onload = function(ev) {
                var data = ev.target.result;
                localStorage.setItem('dg_header_bg', data);
                var bgEl = document.getElementById('dg-header-band-bg');
                if (bgEl) { bgEl.style.backgroundImage = 'url(' + data + ')'; bgEl.classList.add('has-img'); }
            };
            reader.readAsDataURL(file);
        });
    }
    var decoInput = document.getElementById('dg-deco-img-input');
    if (decoInput) {
        decoInput.addEventListener('change', function(e) {
            var file = e.target.files[0];
            if (!file) return;
            var reader = new FileReader();
            reader.onload = function(ev) {
                var data = ev.target.result;
                var customData = {};
                try { customData = JSON.parse(localStorage.getItem('dg_custom_data') || '{}'); } catch(ex) {}
                customData.decoImg = data;
                localStorage.setItem('dg_custom_data', JSON.stringify(customData));
                var prev = document.getElementById('dg-deco-preview');
                var prevImg = document.getElementById('dg-deco-preview-img');
                if (prev && prevImg) { prevImg.src = data; prev.style.display = 'block'; }
            };
            reader.readAsDataURL(file);
        });
    }
});

window.updateDynamicNames = function() {
    try {
        var pName = (typeof settings !== 'undefined' && settings.partnerName) ? settings.partnerName : '梦角';
        var mName = (typeof settings !== 'undefined' && settings.myName) ? settings.myName : '我';

        var tabPartner = document.getElementById('mood-tab-partner');
        if (tabPartner) tabPartner.textContent = pName + '的记录';
        var tabMe = document.getElementById('mood-tab-me');
        if (tabMe) tabMe.textContent = mName + '的记录';

        var detailPartnerTitle = document.getElementById('detail-partner-title');
        if (detailPartnerTitle) detailPartnerTitle.textContent = pName + '的';

        var partnerNoRec = document.getElementById('detail-partner-no-record');
        if (partnerNoRec) {
            var msgEl = partnerNoRec;
            if (!msgEl.querySelector('span')) msgEl.textContent = pName + ' 这天还没有留下记录';
        }

        var editPartnerBtn = document.getElementById('edit-partner-mood');
        if (editPartnerBtn) editPartnerBtn.textContent = '修改' + pName;
        var deletePartnerBtn = document.getElementById('delete-partner-mood');
        if (deletePartnerBtn) deletePartnerBtn.textContent = '删除' + pName;

        var continueBtn = document.getElementById('continue-btn');
        if (continueBtn) continueBtn.title = '让' + pName + '继续说';

        var envInfo = document.querySelector('.env-send-info');
        if (envInfo) {
            var textNodes = Array.from(envInfo.childNodes).filter(n => n.nodeType === 3);
            textNodes.forEach(function(n) {
                if (n.textContent.includes('对方将在') || n.textContent.includes('小时内回信')) {
                    n.textContent = pName + ' 将在 10-24 小时内回信（8-12 句话）';
                }
            });
        }

        setDgLabel('dg-section-label-partner', pName + ' 今日状态');
        setDgLabel('dg-weather-label', pName + ' 的天气');
        setDgLabel('dg-status-label', pName + ' 的今日建议');

        var envInfoSpan = document.getElementById('env-reply-time-info');
        if (envInfoSpan) envInfoSpan.textContent = pName + ' 将在 10-24 小时内回信（8-12 句话）';

        var pokeInput = document.getElementById('poke-input');
        if (pokeInput) pokeInput.placeholder = '例如：拍了拍"' + pName + '"的肩膀';

        document.querySelectorAll('[data-name-partner]').forEach(function(el) {
            el.textContent = pName + '的记录';
        });
        document.querySelectorAll('[data-name-me]').forEach(function(el) {
            el.textContent = mName + '的记录';
        });
        document.querySelectorAll('[data-delete-partner]').forEach(function(el) {
            el.textContent = '删除' + pName;
        });
        document.querySelectorAll('[data-edit-partner]').forEach(function(el) {
            el.textContent = '修改' + pName;
        });
    } catch(e) { console.warn('updateDynamicNames error:', e); }
};
function setDgLabel(id, txt) {
    var el = document.getElementById(id);
    if (el && el.tagName !== 'INPUT') el.textContent = txt;
}

window.closeDailyGreeting = function() {
    try {
        var modal = document.getElementById('daily-greeting-modal');
        if (modal) {
            modal.style.opacity = '0';
            modal.style.transition = 'opacity 0.3s ease';
            setTimeout(function() {
                modal.classList.add('hidden');
                modal.style.display = 'none';
                
                var parent = modal.parentElement;
                if (parent && parent.classList.contains('modal')) {
                    // ★ 恢复背景为默认
                    parent.style.background = '';
                    parent.style.backdropFilter = '';
                    parent.style.webkitBackdropFilter = '';
                    parent.style.display = 'none';
                }
            }, 320);
        }
        try {
            localStorage.setItem('dailyGreetingShown', new Date().toDateString());
        } catch(e) {}
    } catch(e) {
        console.error('[公告] 关闭失败:', e);
    }
};
window.reopenDailyGreeting = function(mode) {
    try {
        var targetMode = mode || 'partner';
        window._greetingPage = targetMode;
        
        var modal = document.getElementById('daily-greeting-modal');
        if (modal) {
            var parent = modal.parentElement;
            if (parent && parent.classList.contains('modal')) {
                // ★ 透明背景 + 模糊效果
                parent.style.background = 'rgba(0,0,0,0)';
                parent.style.backdropFilter = 'blur(8px)';
                parent.style.webkitBackdropFilter = 'blur(8px)';
                parent.style.display = 'flex';
                parent.style.zIndex = '9999';
                
                // 隐藏父容器下其他子元素，避免闪现
                var children = parent.children;
                for (var i = 0; i < children.length; i++) {
                    if (children[i].id !== 'daily-greeting-modal') {
                        children[i].style.display = 'none';
                    }
                }
                modal.style.display = 'block';
            }
            
            // 构建公告内容
            if (typeof window._buildDailyGreeting === 'function') {
                window._buildDailyGreeting(targetMode);
            }
            
            modal.classList.remove('hidden');
            modal.style.display = 'flex';
            modal.style.opacity = '0';
            modal.style.zIndex = '10000';
            
            requestAnimationFrame(function() {
                modal.style.transition = 'opacity 0.3s ease';
                modal.style.opacity = '1';
            });
        }
    } catch(e) {
        console.error('[公告] 打开失败:', e);
    }
};

window.tryShowDailyGreeting = function() {
    try {
        if (localStorage.getItem('dailyGreetingShown') === new Date().toDateString()) return;

        var now = new Date();
        var todayStr = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0') + '-' + String(now.getDate()).padStart(2,'0');
        var moodDataRaw = window.moodData || {};
        var todayMood = moodDataRaw[todayStr];

        if (!todayMood || !todayMood.partner) {
            setTimeout(function() {
                var refreshedMood = (window.moodData || {})[todayStr];
                _buildDailyGreeting(); 
                var modal = document.getElementById('daily-greeting-modal');
                if (modal) modal.classList.remove('hidden');
                localStorage.setItem('dailyGreetingShown', new Date().toDateString());
            }, 45000);
            return;
        }

        _greetingPage = 'partner';
        _buildDailyGreeting('partner');
        var modal = document.getElementById('daily-greeting-modal');
        if (modal) modal.classList.remove('hidden');
    } catch(e) { console.warn('Daily greeting show error:', e); }
};


// ===== 绑定翻页按钮点击事件（确保在 DOM 加载后执行） =====
(function() {
    // 如果 DOM 还未加载，等待 DOMContentLoaded
    function bindPageButtons() {
        var prevBtn = document.getElementById('dg-page-prev');
        var nextBtn = document.getElementById('dg-page-next');
        if (prevBtn) {
            // 移除可能存在的旧监听，避免重复绑定
            prevBtn.removeEventListener('click', window._handlePrevPage);
            window._handlePrevPage = function(e) {
                e.preventDefault();
                if (typeof window._switchGreetingPage === 'function') {
                    window._switchGreetingPage('prev');
                }
            };
            prevBtn.addEventListener('click', window._handlePrevPage);
        }
        if (nextBtn) {
            nextBtn.removeEventListener('click', window._handleNextPage);
            window._handleNextPage = function(e) {
                e.preventDefault();
                if (typeof window._switchGreetingPage === 'function') {
                    window._switchGreetingPage('next');
                }
            };
            nextBtn.addEventListener('click', window._handleNextPage);
        }
    }

    // 如果 DOM 已加载，直接绑定；否则等待
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bindPageButtons);
    } else {
        bindPageButtons();
    }
})();

// 梦角页天气手动修改（点击天气文字时触发）
window.startEditDgWeather = function(el) {
    var now = new Date();
    var current = localStorage.getItem('dg_weather') || '';
    var input = prompt('修改今天的天气（手动修改后，将在 3~8 小时后被随机覆盖）：', current);
    if (input === null) return; // 取消
    var val = input.trim();
    if (val === '') {
        // 如果清空，则删除存储，让系统立即重新随机
        localStorage.removeItem('dg_weather');
        localStorage.removeItem('dg_weather_next_update');
    } else {
        localStorage.setItem('dg_weather', val);
        // 设置下次更新为 3~8 小时后（这样手动值会持续一段时间）
        var nowTs = now.getTime();
        var minDelay = 3 * 60 * 60 * 1000;  
        var maxDelay = 8 * 60 * 60 * 1000;
        var delay = minDelay + Math.random() * (maxDelay - minDelay);
        localStorage.setItem('dg_weather_next_update', String(nowTs + delay));
    }
    // 刷新界面
    if (typeof _buildDailyGreeting === 'function') {
        _buildDailyGreeting(_greetingPage || 'partner');
    }
    if (typeof showNotification === 'function') {
        showNotification(val ? '天气已更新，将在 3~8 小时后自动轮换' : '天气已清空，将立即随机', 'success', 2000);
    }
};
