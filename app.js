document.addEventListener('DOMContentLoaded', () => {
    const state = {
        face: '', makeup: '', bust: '', outfit: '', skin: '',
        pose: '', expression: '', location: '',
        quality: 'photorealistic, ultra high resolution 8K, cinematic dramatic lighting, shallow depth of field',
        sexyMax: false, generating: false
    };

    const STORAGE_KEY_HISTORY = 'egdirector_history';
    const $ = id => document.getElementById(id);
    const el = {
        resultImg:      $('result-image'),
        placeholder:    $('result-placeholder'),
        loading:        $('loading-overlay'),
        errorBar:       $('error-bar'),
        btnGenerate:    $('btn-generate'),
        btnSexyMax:     $('btn-sexy-max'),
        btnHistory:     $('btn-history'),
        historyModal:   $('history-modal'),
        fullscreenModal:$('fullscreen-modal'),
        fullscreenImg:  $('fullscreen-img'),
        btnDownload:    $('btn-download'),
        historyGrid:    $('history-grid'),
        btnClearHist:   $('btn-clear-history'),
        promptEditor:   $('prompt-editor'),
        settingsModal:  $('settings-modal'),
        toastContainer: $('toast-container')
    };

    // API設定画面はもう不要なので完全に隠します
    if (el.settingsModal) el.settingsModal.style.display = 'none';

    document.querySelectorAll('.tab-link').forEach(link => {
        link.addEventListener('click', () => {
            document.querySelectorAll('.tab-link').forEach(l => l.classList.remove('active'));
            document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
            link.classList.add('active');
            $(link.dataset.tab).classList.add('active');
        });
    });

    document.querySelectorAll('.chip-group').forEach(group => {
        const key = group.dataset.key;
        group.querySelectorAll('.chip').forEach(chip => {
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

    el.btnSexyMax.addEventListener('click', () => {
        state.sexyMax = !state.sexyMax;
        el.btnSexyMax.classList.toggle('active', state.sexyMax);
        el.btnSexyMax.innerHTML = state.sexyMax ? '<span>🔥</span> MAX ON' : '<span>🔥</span> SEXY MAX';
        toast(state.sexyMax ? '🔥 SEXY MAX — 限界突破' : '通常モード');
        rebuildPrompt();
    });

    document.querySelectorAll('[data-close], [data-close-btn]').forEach(item => {
        item.addEventListener('click', () => {
            const id = item.dataset.close || item.dataset.closeBtn;
            if($(id)) $(id).classList.add('hidden');
        });
    });

    el.btnGenerate.addEventListener('click', () => {
        if (state.generating) return;
        generate();
    });

    async function generate() {
        state.generating = true;
        el.btnGenerate.disabled = true;
        el.btnGenerate.innerHTML = '<span>⏳</span> 画像生成中...';
        el.placeholder.classList.add('hidden');
        el.resultImg.classList.add('hidden');
        el.loading.classList.remove('hidden');
        el.errorBar.classList.add('hidden');

        const promptText = el.promptEditor.value;
        const seed = Math.floor(Math.random() * 1000000);
        
        // 無料・無制限の新しい画像生成APIを使用（APIキー不要）
        const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(promptText)}?width=768&height=1152&nologo=true&seed=${seed}`;

        try {
            const imgLoad = new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => resolve(imageUrl);
                img.onerror = () => reject(new Error('画像の生成に失敗しました'));
                img.src = imageUrl;
            });

            const finalUrl = await imgLoad;

            el.resultImg.src = finalUrl;
            el.resultImg.classList.remove('hidden');
            saveToHistory(finalUrl);
            toast('✨ 画像の生成が完了しました！');

        } catch (err) {
            el.errorBar.textContent = '⚠️ ' + err.message;
            el.errorBar.classList.remove('hidden');
            el.placeholder.classList.remove('hidden');
        } finally {
            el.loading.classList.add('hidden');
            state.generating = false;
            el.btnGenerate.disabled = false;
            el.btnGenerate.innerHTML = '<span>🚀</span> 別の画像を生成';
        }
    }

    function saveToHistory(dataUrl) {
        try {
            let history = JSON.parse(localStorage.getItem(STORAGE_KEY_HISTORY) || '[]');
            history.unshift({ dataUrl, timestamp: Date.now() });
            if (history.length > 20) history = history.slice(0, 20);
            localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(history));
        } catch (e) {}
    }

    el.btnHistory.addEventListener('click', () => {
        const history = JSON.parse(localStorage.getItem(STORAGE_KEY_HISTORY) || '[]');
        if (history.length > 0) {
            el.historyGrid.innerHTML = history.map(item => `<img src="${item.dataUrl}" onclick="document.getElementById('fullscreen-img').src='${item.dataUrl}'; document.getElementById('fullscreen-modal').classList.remove('hidden');">`).join('');
        } else {
            el.historyGrid.innerHTML = '<p class="text-muted">履歴なし</p>';
        }
        el.historyModal.classList.remove('hidden');
    });

    el.btnClearHist.addEventListener('click', () => {
        localStorage.removeItem(STORAGE_KEY_HISTORY);
        el.historyModal.classList.add('hidden');
        toast('🗑 履歴を削除しました');
    });

    el.resultImg.addEventListener('click', () => {
        if (el.resultImg.src) {
            el.fullscreenImg.src = el.resultImg.src;
            el.fullscreenModal.classList.remove('hidden');
        }
    });

    el.btnDownload.addEventListener('click', async () => {
        const src = el.fullscreenImg.src;
        if (!src) return;
        const link = document.createElement('a');
        link.href = src;
        link.download = `gravure_${Date.now()}.jpg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast('💾 ダウンロードを開始しました');
    });

    function rebuildPrompt() {
        const parts = ['masterpiece, best quality, photorealistic, 1girl, solo, real human, age 25+'];
        if (state.face) parts.push(state.face);
        if (state.makeup) parts.push(state.makeup);
        if (state.bust) parts.push(state.bust);
        if (state.outfit) parts.push(state.outfit);
        if (state.skin) parts.push(state.skin);
        if (state.pose) parts.push(state.pose);
        if (state.expression) parts.push(state.expression);
        if (state.location) parts.push(state.location);
        if (state.quality) parts.push(state.quality);
        if (state.sexyMax) parts.push('provocative atmosphere, seductive body, extremely revealing outfit, oily skin, alluring expression');
        if (el.promptEditor) el.promptEditor.value = parts.join(', ');
    }

    function toast(msg) {
        const t = document.createElement('div');
        t.className = 'toast';
        t.textContent = msg;
        el.toastContainer.appendChild(t);
        setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, 3000);
    }
    rebuildPrompt();
});
