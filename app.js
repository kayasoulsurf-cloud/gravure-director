document.addEventListener('DOMContentLoaded', () => {

    const state = {
        face: '', makeup: '', bust: '', outfit: '', skin: '',
        pose: '', expression: '', location: '',
        quality: 'photorealistic, ultra high resolution 8K, cinematic dramatic lighting, shallow depth of field',
        sexyMax: false, generating: false
    };

    const STORAGE_KEY_APIKEY = 'egdirector_apikey';
    const STORAGE_KEY_HISTORY = 'egdirector_history';
    // 画像生成に対応した最新の実験的モデル
    const GEMINI_MODEL = 'gemini-2.0-flash-exp';

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

    const savedKey = localStorage.getItem(STORAGE_KEY_APIKEY);
    if (savedKey) el.apiKeyInput.value = savedKey;
    else setTimeout(() => el.settingsModal.classList.remove('hidden'), 500);

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
        toast(state.sexyMax ? '🔥 SEXY MAX — 準備完了' : '通常モード');
        rebuildPrompt();
    });

    el.btnSettings.addEventListener('click', () => el.settingsModal.classList.remove('hidden'));
    el.btnSaveKey.addEventListener('click', () => {
        const key = el.apiKeyInput.value.trim();
        if (!key) return;
        localStorage.setItem(STORAGE_KEY_APIKEY, key);
        toast('✅ APIキーを保存しました');
        el.settingsModal.classList.add('hidden');
    });

    document.querySelectorAll('[data-close], [data-close-btn]').forEach(item => {
        item.addEventListener('click', () => {
            const id = item.dataset.close || item.dataset.closeBtn;
            $(id).classList.add('hidden');
        });
    });

    el.btnGenerate.addEventListener('click', () => {
        if (state.generating) return;
        generate();
    });

    async function generate() {
        const apiKey = localStorage.getItem(STORAGE_KEY_APIKEY);
        if (!apiKey) {
            el.settingsModal.classList.remove('hidden');
            return;
        }

        // プロンプトをまずコピー（失敗しても手元に残るように）
        navigator.clipboard.writeText(el.promptEditor.value);

        state.generating = true;
        el.btnGenerate.disabled = true;
        el.btnGenerate.innerHTML = '<span>⏳</span> AI召喚中...';
        el.placeholder.classList.add('hidden');
        el.resultImg.classList.add('hidden');
        el.loading.classList.remove('hidden');
        el.errorBar.classList.add('hidden');

        const promptText = el.promptEditor.value;
        const negText = el.negativeEditor.value;

        // 画像生成のための指示
        const fullPrompt = `Task: Generate a high-quality photorealistic gravure photograph.
Description: ${promptText}
Constraints: Photorealistic, no anime, no nudity, no nipples, no genitals, adult woman 25+. 
Negative: ${negText}`;

        // API URL (v1betaを使用)
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: fullPrompt }] }],
                    generationConfig: {
                        // ここで画像生成を指定
                        responseModalities: ["IMAGE"]
                    }
                })
            });

            const data = await res.json();

            if (!res.ok) {
                const msg = data.error?.message || 'APIエラーが発生しました';
                if (msg.includes('not found')) throw new Error('お
