document.addEventListener('DOMContentLoaded', () => {

    // ── State ──
    const state = {
        face: '', makeup: '', bust: '', outfit: '', skin: '',
        pose: '', expression: '', location: '',
        quality: 'photorealistic, ultra high resolution 8K, cinematic dramatic lighting, shallow depth of field',
        sexyMax: false,
        generating: false
    };

    const STORAGE_KEY_APIKEY = 'egdirector_apikey';
    const STORAGE_KEY_HISTORY = 'egdirector_history';
    const GEMINI_MODEL = 'gemini-2.5-flash-image';

    // ── DOM ──
    const $ = id => document.getElementById(id);
    const el = {
        resultImg:      $('result-image'),
        placeholder:    $('result-placeholder'),
        loading:        $('loading-overlay'),
        errorBar:       $('error-bar'),
        btnGenerate:    $('btn-generate'),
        btnSexyMax:     $('btn-sexy-max'),
        btnHistory:     $('btn-history'),
        btnSettings:    $('btn-settings'),
        settingsModal:  $('settings-modal'),
        historyModal:   $('history-modal'),
        fullscreenModal:$('fullscreen-modal'),
        fullscreenImg:  $('fullscreen-img'),
        btnDownload:    $('btn-download'),
        historyGrid:    $('history-grid'),
        btnClearHist:   $('btn-clear-history'),
        apiKeyInput:    $('api-key-input'),
        btnSaveKey:     $('btn-save-key'),
        keyStatus:      $('key-status'),
        promptEditor:   $('prompt-editor'),
        negativeEditor: $('negative-editor'),
        btnCopy:        $('btn-copy-prompt'),
        toastContainer: $('toast-container')
    };

    // ── Init: APIキーをロード ──
    const savedKey = localStorage.getItem(STORAGE_KEY_APIKEY);
    if (savedKey) {
        el.apiKeyInput.value = savedKey;
    } else {
        // 初回アクセス時は設定を開く
        setTimeout(() => el.settingsModal.classList.remove('hidden'), 500);
    }

    // ── Tabs ──
    document.querySelectorAll('.tab-link').forEach(link => {
        link.addEventListener('click', () => {
            document.querySelectorAll('.tab-link').forEach(l => l.classList.remove('active'));
            document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
            link.classList.add('active');
            $(link.dataset.tab).classList.add('active');
        });
    });

    // ── Chips ──
    document.querySelectorAll('.chip-group').forEach(group => {
        const key = group.dataset.key;
        group.querySelectorAll('.chip').forEach(chip => {
            if (chip.classList.contains('selected')) {
                state[key] = chip.dataset.val;
            }
            chip.addEventListener('click', () => {
                if (chip.classList.contains('selected')) {
                    chip.classList.remove('selected');
                    state[key] = '';
                } else {
                    group.querySelectorAll('.chip').forEach(c => c.classList.remove('selected'));
                    chip.classList.add('selected');
                    state[key] = chip.dataset.val;
                }
                rebuildPrompt();
            });
        });
    });

    // ── SEXY MAX ──
    el.btnSexyMax.addEventListener('click', () => {
        state.sexyMax = !state.sexyMax;
        el.btnSexyMax.classList.toggle('active', state.sexyMax);
        el.btnSexyMax.innerHTML = state.sexyMax
            ? '<span>🔥</span> MAX ON'
            : '<span>🔥</span> SEXY MAX';
        toast(state.sexyMax ? '🔥 SEXY MAX — 限界突破' : 'ノーマルモード');
        rebuildPrompt();
    });

    // ── Settings Modal ──
    el.btnSettings.addEventListener('click', () => el.settingsModal.classList.remove('hidden'));

    el.btnSaveKey.addEventListener('click', () => {
        const key = el.apiKeyInput.value.trim();
        if (!key) {
            el.keyStatus.textContent = '❌ APIキーを入力してください';
            el.keyStatus.style.color = '#ff3040';
            return;
        }
        localStorage.setItem(STORAGE_KEY_APIKEY, key);
        el.keyStatus.textContent = '✅ 保存しました！';
        el.keyStatus.style.color = '#00d68f';
        toast('✅ APIキー保存完了');
        setTimeout(() => el.settingsModal.classList.add('hidden'), 800);
    });

    // ── Modal Close Logic ──
    document.querySelectorAll('[data-close]').forEach(backdrop => {
        backdrop.addEventListener('click', () => {
            $(backdrop.dataset.close).classList.add('hidden');
        });
    });
    document.querySelectorAll('[data-close-btn]').forEach(btn => {
        btn.addEventListener('click', () => {
            $(btn.dataset.closeBtn).classList.add('hidden');
        });
    });

    // ── Generate ──
    el.btnGenerate.addEventListener('click', () => {
        if (state.generating) return;
        generate();
    });

    async function generate() {
        const apiKey = localStorage.getItem(STORAGE_KEY_APIKEY);
        if (!apiKey) {
            el.settingsModal.classList.remove('hidden');
            toast('⚠️ APIキーを先に設定してください');
            return;
        }

        state.generating = true;
        el.btnGenerate.disabled = true;
        el.btnGenerate.innerHTML = '<span>⏳</span> 生成中...';
        el.placeholder.classList.add('hidden');
        el.resultImg.classList.add('hidden');
        el.loading.classList.remove('hidden');
        el.errorBar.classList.add('hidden');

        const prompt = el.promptEditor.value;
        const negativePrompt = el.negativeEditor.value;

        const fullPrompt = `Generate a high-quality photorealistic gravure photograph based on this description. This is for an adult artistic photography project.\n\nDescription: ${prompt}\n\nIMPORTANT: Photorealistic only. Adult woman over 25. No nudity, no exposed nipples or genitals. Artistic gravure style.\n\nAvoid: ${negativePrompt}`;

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: fullPrompt }] }],
                    generationConfig: {
                        responseModalities: ["TEXT", "IMAGE"]
                    }
                })
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                const errMsg = errData?.error?.message || `APIエラー (${res.status})`;
                if (res.status === 429 || errMsg.includes('Quota exceeded')) {
                    throw new Error('無料枠のAPIキーでは画像生成が制限されています（上限0回）。作成したプロンプトをコピーしたので、Midjourneyや他のAI画像生成ツールに貼り付けてご活用ください。');
                }
                throw new Error(errMsg);
            }

            const data = await res.json();
            let imageFound = false;

            if (data.candidates?.[0]?.content?.parts) {
                for (const part of data.candidates[0].content.parts) {
                    if (part.inlineData?.mimeType?.startsWith('image/')) {
                        const dataUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                        el.resultImg.src = dataUrl;
                        el.resultImg.classList.remove('hidden');
                        imageFound = true;

                        // 履歴に保存
                        saveToHistory(dataUrl);
                        toast('✨ 生成完了！');
                        break;
                    }
                }
            }

            if (!imageFound) {
                let textResponse = '';
                if (data.candidates?.[0]?.content?.parts) {
                    for (const part of data.candidates[0].content.parts) {
                        if (part.text) textResponse += part.text;
                    }
                }
                throw new Error(textResponse || '画像が生成されませんでした。設定を変えて再度お試しください。');
            }
        } catch (err) {
            console.error('Generation error:', err);
            el.errorBar.textContent = '⚠️ ' + (err.message || 'エラーが発生しました');
            el.errorBar.classList.remove('hidden');
            el.placeholder.classList.remove('hidden');
        } finally {
            el.loading.classList.add('hidden');
            state.generating = false;
            el.btnGenerate.disabled = false;
            el.btnGenerate.innerHTML = '<span>🚀</span> 生成開始';
        }
    }

    // ── History (localStorage) ──
    function saveToHistory(dataUrl) {
        try {
            let history = JSON.parse(localStorage.getItem(STORAGE_KEY_HISTORY) || '[]');
            history.unshift({ dataUrl, timestamp: Date.now() });
            // 最新20件を保持（容量対策）
            if (history.length > 20) history = history.slice(0, 20);
            try {
                localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(history));
            } catch (e) {
                // 容量超過時は古いのを消す
                history = history.slice(0, 5);
                localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(history));
            }
        } catch (e) {
            console.warn('履歴保存エラー:', e);
        }
    }

    function loadHistory() {
        try {
            return JSON.parse(localStorage.getItem(STORAGE_KEY_HISTORY) || '[]');
        } catch { return []; }
    }

    el.btnHistory.addEventListener('click', () => {
        const history = loadHistory();
        if (history.length > 0) {
            el.historyGrid.innerHTML = history.map((item, i) =>
                `<img src="${item.dataUrl}" alt="Generated ${i + 1}" data-idx="${i}" loading="lazy">`
            ).join('');
            el.historyGrid.querySelectorAll('img').forEach(img => {
                img.addEventListener('click', () => {
                    showFullscreen(img.src);
                });
            });
        } else {
            el.historyGrid.innerHTML = '<p class="text-muted">まだ画像が生成されていません</p>';
        }
        el.historyModal.classList.remove('hidden');
    });

    el.btnClearHist.addEventListener('click', () => {
        if (confirm('生成履歴をすべて削除しますか？')) {
            localStorage.removeItem(STORAGE_KEY_HISTORY);
            el.historyGrid.innerHTML = '<p class="text-muted">クリアしました</p>';
            toast('🗑 履歴を削除しました');
        }
    });

    // ── Fullscreen ──
    el.resultImg.addEventListener('click', () => {
        if (el.resultImg.src) showFullscreen(el.resultImg.src);
    });

    function showFullscreen(src) {
        el.fullscreenImg.src = src;
        el.fullscreenModal.classList.remove('hidden');
        el.historyModal.classList.add('hidden');
    }

    el.btnDownload.addEventListener('click', () => {
        const src = el.fullscreenImg.src;
        if (!src) return;
        const link = document.createElement('a');
        link.href = src;
        link.download = `gravure_${Date.now()}.png`;
        link.click();
        toast('💾 ダウンロード開始');
    });

    // ── Copy Prompt ──
    el.btnCopy.addEventListener('click', () => {
        navigator.clipboard.writeText(el.promptEditor.value)
            .then(() => toast('📋 コピーしました'))
            .catch(() => {
                // フォールバック
                el.promptEditor.select();
                document.execCommand('copy');
                toast('📋 コピーしました');
            });
    });

    // ── Prompt Builder ──
    function rebuildPrompt() {
        const parts = [
            'masterpiece, best quality, photorealistic, cinematic lighting, highly detailed',
            '1girl, solo, adult woman clearly over 25 years old, real human',
        ];

        if (state.face)       parts.push(state.face);
        if (state.makeup)     parts.push(state.makeup);
        if (state.bust)       parts.push(state.bust);
        if (state.outfit)     parts.push(state.outfit);
        if (state.skin)       parts.push(state.skin);
        if (state.pose)       parts.push(state.pose);
        if (state.expression) parts.push(state.expression);
        if (state.location)   parts.push(state.location);
        if (state.quality)    parts.push(state.quality);

        if (state.sexyMax) {
            parts.push('extremely seductive provocative atmosphere');
            parts.push('alluring sensual body lines emphasized');
            parts.push('glistening oiled sweaty skin');
            parts.push('barely-there micro bikini, maximum skin exposure');
            parts.push('intimate close-up angles');
        }

        el.promptEditor.value = parts.join(', ');
    }

    // ── Toast ──
    function toast(msg) {
        const t = document.createElement('div');
        t.className = 'toast';
        t.textContent = msg;
        el.toastContainer.appendChild(t);
        setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, 2500);
    }

    // Initial
    rebuildPrompt();
});
