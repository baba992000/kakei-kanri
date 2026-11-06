// ========================================================
// 音声入力・音声読み上げ管理モジュール (Web Speech API)
// ========================================================

const SpeechManager = {
    recognition: null,
    isListening: false,
    synth: window.speechSynthesis || null,
    isSpeaking: false,
    activeTargetInput: null, // 個別のinput（メモ欄など）への直接入力時

    // 設定
    settings: {
        voiceFeedbackEnabled: true,   // 登録完了時の音声フィードバック
        voiceRate: 1.0,               // 読み上げ速度 (0.8 ~ 1.4)
        autoSubmitOnVoice: false      // 音声パース後に自動で保存するかどうか
    },

    // 初期化
    init() {
        this.loadSettings();
        this.setupRecognition();
        this.bindEvents();
        this.updateSettingsUI();
        console.log('音声管理モジュールを初期化しました。SpeechRecognition対応:', !!this.recognition);
    },

    // 設定読み込み
    loadSettings() {
        try {
            const saved = localStorage.getItem('kakei_speech_settings');
            if (saved) {
                this.settings = Object.assign(this.settings, JSON.parse(saved));
            }
        } catch (e) {
            console.warn('音声設定の読み込みに失敗しました:', e);
        }
    },

    // 設定保存
    saveSettings() {
        try {
            localStorage.setItem('kakei_speech_settings', JSON.stringify(this.settings));
        } catch (e) {
            console.warn('音声設定の保存に失敗しました:', e);
        }
    },

    // 音声認識のセットアップ
    setupRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            console.warn('このブラウザは SpeechRecognition に対応していません。');
            return;
        }

        this.recognition = new SpeechRecognition();
        this.recognition.lang = 'ja-JP';
        this.recognition.interimResults = true;
        this.recognition.continuous = false;
        this.recognition.maxAlternatives = 1;

        this.recognition.onstart = () => {
            this.isListening = true;
            this.updateListeningUI(true);
        };

        this.recognition.onresult = (event) => {
            let interimTranscript = '';
            let finalTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                } else {
                    interimTranscript += event.results[i][0].transcript;
                }
            }

            const currentText = finalTranscript || interimTranscript;
            this.handleRecognitionResult(currentText, !!finalTranscript);
        };

        this.recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            this.isListening = false;
            this.updateListeningUI(false);
            const statusEl = document.getElementById('voiceModalStatus');
            if (statusEl) {
                if (event.error === 'not-allowed') {
                    statusEl.textContent = '⚠️ マイクの使用が許可されていません。ブラウザの設定をご確認ください。';
                } else if (event.error === 'no-speech') {
                    statusEl.textContent = '音声が聞き取れませんでした。もう一度お試しください。';
                } else {
                    statusEl.textContent = `エラーが発生しました: ${event.error}`;
                }
            }
        };

        this.recognition.onend = () => {
            this.isListening = false;
            this.updateListeningUI(false);
        };
    },

    // イベントバインド
    bindEvents() {
        // 音声入力モーダルを開くボタン
        const openVoiceBtn = document.getElementById('openVoiceModalBtn');
        if (openVoiceBtn) {
            openVoiceBtn.addEventListener('click', () => this.openVoiceModal());
        }

        // モーダル内のマイク開始/停止ボタン
        const voiceMicBtn = document.getElementById('voiceModalMicBtn');
        if (voiceMicBtn) {
            voiceMicBtn.addEventListener('click', () => {
                if (this.isListening) {
                    this.stopListening();
                } else {
                    this.startListening();
                }
            });
        }

        // 音声入力モーダルを閉じるボタン
        const closeVoiceBtn = document.getElementById('closeVoiceModalBtn');
        if (closeVoiceBtn) {
            closeVoiceBtn.addEventListener('click', () => this.closeVoiceModal());
        }

        // モーダル外側クリックで閉じる
        window.addEventListener('click', (e) => {
            const modal = document.getElementById('voiceModal');
            if (e.target === modal) {
                this.closeVoiceModal();
            }
        });

        // モーダル内の「フォームに反映して登録」ボタン
        const applyVoiceBtn = document.getElementById('applyVoiceRecordBtn');
        if (applyVoiceBtn) {
            applyVoiceBtn.addEventListener('click', () => this.applyVoiceParsedData(true));
        }

        // モーダル内の「フォームに反映のみ」ボタン
        const fillOnlyVoiceBtn = document.getElementById('fillOnlyVoiceRecordBtn');
        if (fillOnlyVoiceBtn) {
            fillOnlyVoiceBtn.addEventListener('click', () => this.applyVoiceParsedData(false));
        }

        // メモ欄横のマイクボタン
        const memoMicBtn = document.getElementById('memoMicBtn');
        if (memoMicBtn) {
            memoMicBtn.addEventListener('click', () => {
                const memoInput = document.getElementById('memo');
                this.toggleDirectInputRecognition(memoInput, memoMicBtn);
            });
        }

        // ダッシュボードの音声サマリー読み上げボタン
        const readSummaryBtn = document.getElementById('readSummaryBtn');
        if (readSummaryBtn) {
            readSummaryBtn.addEventListener('click', () => this.toggleSummaryReading());
        }

        // 設定画面のUIイベント
        const voiceFeedbackToggle = document.getElementById('setting-voiceFeedback');
        if (voiceFeedbackToggle) {
            voiceFeedbackToggle.addEventListener('change', (e) => {
                this.settings.voiceFeedbackEnabled = e.target.checked;
                this.saveSettings();
                if (this.settings.voiceFeedbackEnabled) {
                    this.speak('音声フィードバックを有効にしました。');
                }
            });
        }

        const voiceRateSelect = document.getElementById('setting-voiceRate');
        if (voiceRateSelect) {
            voiceRateSelect.addEventListener('change', (e) => {
                this.settings.voiceRate = parseFloat(e.target.value) || 1.0;
                this.saveSettings();
                this.speak('読み上げ速度を変更しました。');
            });
        }

        const testVoiceBtn = document.getElementById('testVoiceBtn');
        if (testVoiceBtn) {
            testVoiceBtn.addEventListener('click', () => {
                this.speak('家計管理アプリの音声テストです。正常に動作しています。');
            });
        }
    },

    // 設定画面のUI同期
    updateSettingsUI() {
        const voiceFeedbackToggle = document.getElementById('setting-voiceFeedback');
        if (voiceFeedbackToggle) {
            voiceFeedbackToggle.checked = this.settings.voiceFeedbackEnabled;
        }

        const voiceRateSelect = document.getElementById('setting-voiceRate');
        if (voiceRateSelect) {
            voiceRateSelect.value = String(this.settings.voiceRate);
        }

        // ブラウザサポート診断表示
        const supportBadge = document.getElementById('voiceSupportStatus');
        if (supportBadge) {
            const hasRec = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
            const hasSynth = !!window.speechSynthesis;
            if (hasRec && hasSynth) {
                supportBadge.innerHTML = '<span class="badge-success">✅ 音声入力・読み上げ 双方対応</span>';
            } else if (hasSynth) {
                supportBadge.innerHTML = '<span class="badge-warning">⚠️ 読み上げのみ対応（音声入力は非対応）</span>';
            } else {
                supportBadge.innerHTML = '<span class="badge-danger">❌ お使いのブラウザは音声機能に非対応です</span>';
            }
        }
    },

    // 音声認識開始
    startListening() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert('お使いのブラウザは音声認識機能（SpeechRecognition）に対応していません。Google ChromeまたはMicrosoft Edgeをお試しください。');
            return;
        }
        if (!this.recognition) {
            this.setupRecognition();
        }
        if (this.isListening) return;

        try {
            this.recognition.start();
            const statusEl = document.getElementById('voiceModalStatus');
            if (statusEl) statusEl.textContent = '聞き取り中... お話しください（例: 食費 850円 ランチ）';
        } catch (e) {
            console.error('認識開始エラー:', e);
        }
    },

    // 音声認識停止
    stopListening() {
        if (!this.recognition || !this.isListening) return;
        try {
            this.recognition.stop();
        } catch (e) {
            console.error('認識停止エラー:', e);
        }
    },

    // 録音中UI更新
    updateListeningUI(listening) {
        const micBtn = document.getElementById('voiceModalMicBtn');
        const waveContainer = document.getElementById('voiceWaveContainer');
        const statusEl = document.getElementById('voiceModalStatus');

        if (micBtn) {
            if (listening) {
                micBtn.classList.add('recording');
                micBtn.setAttribute('title', 'クリックして停止');
            } else {
                micBtn.classList.remove('recording');
                micBtn.setAttribute('title', 'クリックして音声入力開始');
            }
        }

        if (waveContainer) {
            if (listening) {
                waveContainer.classList.add('active');
            } else {
                waveContainer.classList.remove('active');
            }
        }

        if (!listening && statusEl && statusEl.textContent.includes('聞き取り中')) {
            statusEl.textContent = '聞き取りが完了しました。解析結果をご確認ください。';
        }
    },

    // 個別Input欄（メモなど）への直接音声入力
    toggleDirectInputRecognition(inputElement, triggerBtn) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert('お使いのブラウザは音声認識機能に対応していません。Google ChromeまたはMicrosoft Edgeをお試しください。');
            return;
        }

        if (this.isListening) {
            this.stopListening();
            this.activeTargetInput = null;
            if (triggerBtn) triggerBtn.classList.remove('recording');
            return;
        }

        this.activeTargetInput = inputElement;
        if (triggerBtn) triggerBtn.classList.add('recording');

        const prevOnResult = this.recognition ? this.recognition.onresult : null;
        const prevOnEnd = this.recognition ? this.recognition.onend : null;

        if (!this.recognition) {
            this.setupRecognition();
        }

        this.recognition.onresult = (event) => {
            let text = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                text += event.results[i][0].transcript;
            }
            if (this.activeTargetInput) {
                this.activeTargetInput.value = text;
            }
        };

        this.recognition.onend = () => {
            this.isListening = false;
            this.activeTargetInput = null;
            if (triggerBtn) triggerBtn.classList.remove('recording');
            this.setupRecognition(); // 元のハンドラに戻す
        };

        try {
            this.recognition.start();
        } catch (e) {
            console.error('個別音声認識開始エラー:', e);
            if (triggerBtn) triggerBtn.classList.remove('recording');
        }
    },

    // 音声認識結果のハンドリング
    handleRecognitionResult(transcript, isFinal) {
        const textDisplay = document.getElementById('voiceTranscriptText');
        if (textDisplay) {
            textDisplay.textContent = transcript || '（音声を待機しています...）';
        }

        // 自然言語パース
        const parsed = this.parseVoiceText(transcript);
        this.displayParsedPreview(parsed);

        if (isFinal) {
            this.currentParsedData = parsed;
            const applyBtn = document.getElementById('applyVoiceRecordBtn');
            const fillOnlyBtn = document.getElementById('fillOnlyVoiceRecordBtn');
            if (applyBtn) applyBtn.disabled = !parsed.amount;
            if (fillOnlyBtn) fillOnlyBtn.disabled = !parsed.amount;

            // 自動保存設定がONかつ金額が検出できた場合
            if (this.settings.autoSubmitOnVoice && parsed.amount) {
                setTimeout(() => {
                    this.applyVoiceParsedData(true);
                }, 800);
            }
        }
    },

    // 自然言語パースエンジン (日本語テキストから家計簿データを抽出)
    parseVoiceText(rawText) {
        if (!rawText) {
            return { date: '', type: '支出', category: '食費', amount: null, memo: '' };
        }

        let text = rawText.trim();

        // 1. 日付の抽出
        let date = this.extractDate(text);
        if (!date) {
            const today = new Date();
            const y = today.getFullYear();
            const m = String(today.getMonth() + 1).padStart(2, '0');
            const d = String(today.getDate()).padStart(2, '0');
            date = `${y}-${m}-${d}`;
        }

        // 2. 区分の抽出
        let type = '支出';
        if (/給料|給与|収入|ボーナス|売上|入金|もらった|バイト代/.test(text)) {
            type = '収入';
        } else if (/貯金出金|引き出し|おろした/.test(text)) {
            type = '貯金出金';
        } else if (/貯金|預金|貯蓄|積立/.test(text)) {
            type = '貯金';
        } else if (/サブスク|月額|定期課金/.test(text)) {
            type = 'サブスク';
        }

        // 3. 金額の抽出
        let amount = this.extractAmount(text);

        // 4. カテゴリの推定
        let category = this.extractCategory(text, type);

        // 5. メモの抽出
        let memo = this.extractMemo(text, amount, category, type);

        // 6. 共同口座・口座種別の推定
        let account = 'personal';
        if (/共同|共有|ペア口座|共同口座|生活費口座/.test(text)) {
            account = 'joint';
            memo = memo.replace(/共同口座|共有口座|ペア口座|生活費口座|共同|共有/g, '').trim();
        }

        // 7. 登録者の推定（家族共有用）
        let owner = '自分';
        if (/パートナー|夫|妻|旦那|嫁|彼氏|彼女/.test(text)) {
            owner = 'パートナー';
        } else if (/共通|家族|みんな|2人|二人/.test(text)) {
            owner = '共通';
        }

        return {
            date,
            type,
            category,
            amount,
            memo,
            account,
            owner,
            rawText
        };
    },

    // 日付抽出
    extractDate(text) {
        const today = new Date();

        if (/一昨日|おととい/.test(text)) {
            const d = new Date(today);
            d.setDate(d.getDate() - 2);
            return this.formatDateYMD(d);
        }
        if (/昨日|きのう/.test(text)) {
            const d = new Date(today);
            d.setDate(d.getDate() - 1);
            return this.formatDateYMD(d);
        }
        if (/今日|きょう/.test(text)) {
            return this.formatDateYMD(today);
        }
        if (/明日|あした|あす/.test(text)) {
            const d = new Date(today);
            d.setDate(d.getDate() + 1);
            return this.formatDateYMD(d);
        }

        // "9月15日" などのパターン
        const monthDayMatch = text.match(/([0-9０-９]+)月([0-9０-９]+)日/);
        if (monthDayMatch) {
            const m = this.zenkakuToHankaku(monthDayMatch[1]).padStart(2, '0');
            const d = this.zenkakuToHankaku(monthDayMatch[2]).padStart(2, '0');
            return `${today.getFullYear()}-${m}-${d}`;
        }

        // "15日" などのパターン
        const dayOnlyMatch = text.match(/([0-9０-９]+)日/);
        if (dayOnlyMatch) {
            const m = String(today.getMonth() + 1).padStart(2, '0');
            const d = this.zenkakuToHankaku(dayOnlyMatch[1]).padStart(2, '0');
            return `${today.getFullYear()}-${m}-${d}`;
        }

        return null;
    },

    // 金額抽出
    extractAmount(text) {
        let normalized = this.zenkakuToHankaku(text);

        // 「1万5000円」「1万5千円」「2万円」「1.5万円」などのパターン
        const manMatch = normalized.match(/([0-9]+(?:\.[0-9]+)?)\s*万\s*([0-9]+)?\s*(?:千)?(?:円)?/);
        if (manMatch) {
            let val = parseFloat(manMatch[1]) * 10000;
            if (manMatch[2]) {
                if (text.includes('千')) {
                    val += parseInt(manMatch[2], 10) * 1000;
                } else {
                    val += parseInt(manMatch[2], 10);
                }
            }
            return Math.round(val);
        }

        // 「5千円」パターン
        const senMatch = normalized.match(/([0-9]+)\s*千(?:円)?/);
        if (senMatch) {
            return parseInt(senMatch[1], 10) * 1000;
        }

        // 「1500円」などの数字＋円パターン
        const yenMatch = normalized.match(/([0-9]{1,3}(?:,[0-9]{3})+|[0-9]+)\s*円/);
        if (yenMatch) {
            return parseInt(yenMatch[1].replace(/,/g, ''), 10);
        }

        // 数字のみ発話
        const pureNumberMatch = normalized.match(/\b([0-9]{3,8})\b/);
        if (pureNumberMatch) {
            return parseInt(pureNumberMatch[1], 10);
        }

        return null;
    },

    // カテゴリ推定
    extractCategory(text, type) {
        const features = window.KakeiSettingsManager ? window.KakeiSettingsManager.settings.features : {};

        if (type === '収入') {
            if (features.partTimeIncome && /アルバイト|バイト|副業|パート/.test(text)) {
                return 'アルバイト';
            }
            if (/給与|給料|賞与|ボーナス|本業/.test(text)) {
                return '給与';
            }
            return 'その他';
        }

        if (type === '貯金' || type === '貯金出金') {
            if (features.pension && /長期積立|積立|つみたて|投資|nisa|ニーサ/.test(text.toLowerCase())) {
                return '長期積立';
            }
            if (/定期|定期預金/.test(text)) {
                return '定期預金';
            }
            return '普通預金';
        }

        // 支出 / サブスク
        if (/チャージ振替|振替/.test(text)) {
            return 'チャージ振替';
        }
        if (/チャージ|電子マネー|suicaチャージ|pasmoチャージ|paypayチャージ/.test(text.toLowerCase())) {
            return 'チャージ';
        }
        if (/サブスク|月額|定額|netflix|spotify|youtube|amazon prime|アマプラ/.test(text.toLowerCase())) {
            return 'サブスク（月額）';
        }
        if (/貯金|入金|つみたて/.test(text)) {
            return '貯金（入金）';
        }
        if (/税金|社会保険|住民税|所得税|固定資産税|国民健康保険|年金/.test(text)) {
            return '税金・社会保険料';
        }
        if (/保険料|保険|生命保険|医療保険|火災保険|自動車保険/.test(text)) {
            return '保険料';
        }
        if (/仕送り|実家送金/.test(text)) {
            return '仕送り';
        }
        if (/車両費|ガソリン|車検|駐車場|洗車|高速料金|etc代|オイル交換/.test(text)) {
            return '車両費';
        }
        if (/教育費|学費|授業料|教科書|文房具|塾|習い事|セミナー/.test(text)) {
            return '教育費';
        }
        if (/衣服|美容|服|洋服|コスメ|化粧品|美容院|散髪|ネイル|ヘアサロン|カット/.test(text)) {
            return '衣服・美容費';
        }
        if (/特別費|冠婚葬祭|ご祝儀|香典|家電|家具|引越し/.test(text)) {
            return '特別費';
        }
        if (/旅行|ホテル|宿泊|新幹線|飛行機|ツアー/.test(text)) {
            return '旅行費';
        }
        if (/食費|ランチ|昼飯|朝食|夕食|ディナー|外食|スーパー|カフェ|珈琲|コーヒー|スタバ|マック|弁当|コンビニ|居酒屋|飲み会|ごはん|飯|ラーメン|パン|昼食/.test(text)) {
            return '食費';
        }
        if (/交通費|電車|地下鉄|バス|タクシー|新幹線|切符|定期代/.test(text.toLowerCase())) {
            return '交通費';
        }
        if (/水道光熱費|光熱費|電気代|水道代|ガス代|電気|ガス|水道/.test(text)) {
            return '水道光熱費';
        }
        if (/通信費|スマホ|携帯|ネット|プロバイダ|wi-fi|wifi|ドコモ|au|ソフトバンク/.test(text.toLowerCase())) {
            return '通信費';
        }
        if (/日用品|ドラッグストア|薬局|洗剤|シャンプー|ティッシュ|消耗品|100均|セリア|ダイソー/.test(text)) {
            return '日用品';
        }
        if (/娯楽|遊び|映画|ゲーム|本|マンガ|漫画|カラオケ|テーマパーク|趣味|ライブ/.test(text)) {
            return '娯楽費';
        }
        if (/医療費|病院|クリニック|歯医者|薬|診察|治療|処方箋/.test(text)) {
            return '医療費';
        }
        if (/住居費|家賃|マンション|更新料|共益費|管理費|住宅ローン/.test(text)) {
            return '住居費';
        }

        return '食費';
    },

    // メモ抽出
    extractMemo(text, amount, category, type) {
        let memo = text;

        memo = memo.replace(/今日|昨日|一昨日|明日|[0-9０-９]+月[0-9０-９]+日|[0-9０-９]+日/g, '');
        memo = memo.replace(/[0-9０-９]+(?:\.[0-9]+)?\s*万(?:[0-9０-９]+)?(?:千)?(?:円)?/g, '');
        memo = memo.replace(/[0-9０-９]+\s*千(?:円)?/g, '');
        memo = memo.replace(/([0-9０-９,]+)\s*円/g, '');
        if (amount) {
            memo = memo.replace(new RegExp(String(amount), 'g'), '');
        }
        memo = memo.replace(/収入|支出|貯金|貯金出金|サブスク|で|を|に|円|買っ(た|て)|払っ(た|て)|使っ(た|て)/g, '');
        memo = memo.replace(new RegExp(category, 'g'), '');

        memo = memo.trim();
        memo = memo.replace(/^[\s,、。]+|[\s,、。]+$/g, '');

        return memo || category;
    },

    // 解析結果のプレビュー更新
    displayParsedPreview(parsed) {
        const previewDate = document.getElementById('voicePreviewDate');
        const previewType = document.getElementById('voicePreviewType');
        const previewCategory = document.getElementById('voicePreviewCategory');
        const previewAmount = document.getElementById('voicePreviewAmount');
        const previewMemo = document.getElementById('voicePreviewMemo');

        if (previewDate) previewDate.textContent = parsed.date || '-';
        if (previewType) {
            previewType.textContent = parsed.type || '-';
            previewType.className = `preview-type-tag type-${parsed.type}`;
        }
        if (previewCategory) previewCategory.textContent = parsed.category || '-';
        if (previewAmount) {
            if (parsed.amount) {
                previewAmount.textContent = new Intl.NumberFormat('ja-JP').format(parsed.amount) + ' 円';
                previewAmount.classList.remove('text-muted');
            } else {
                previewAmount.textContent = '金額未検出（もう一度話してください）';
                previewAmount.classList.add('text-muted');
            }
        }
        if (previewMemo) previewMemo.textContent = parsed.memo || '-';
    },

    // 解析データを登録フォームに反映
    applyVoiceParsedData(autoSubmit = false) {
        if (!this.currentParsedData || !this.currentParsedData.amount) {
            alert('金額が認識されていません。もう一度話すか手動でご入力ください。');
            return;
        }

        const data = this.currentParsedData;

        const dateInput = document.getElementById('date');
        const typeSelect = document.getElementById('type');
        const amountInput = document.getElementById('amount');
        const memoInput = document.getElementById('memo');

        if (dateInput && data.date) dateInput.value = data.date;

        if (typeSelect && data.type) {
            typeSelect.value = data.type;
            if (window.KakeiRecordManager) {
                window.KakeiRecordManager.updateFormCategoryOptions('');
            }
        }

        const categorySelect = document.getElementById('category');
        if (categorySelect && data.category) {
            const exists = Array.from(categorySelect.options).some(o => o.value === data.category);
            if (exists) {
                categorySelect.value = data.category;
                if (window.KakeiRecordManager) {
                    window.KakeiRecordManager.syncCategorySelection('', data.category);
                }
            }
        }

        if (amountInput && data.amount) amountInput.value = data.amount;
        if (memoInput) memoInput.value = data.memo || '';

        const ownerSelect = document.getElementById('owner');
        if (ownerSelect && data.owner) ownerSelect.value = data.owner;

        const accountSelect = document.getElementById('account');
        if (accountSelect && data.account) accountSelect.value = data.account;

        this.closeVoiceModal();

        if (autoSubmit && window.KakeiRecordManager) {
            window.KakeiRecordManager.addRecord();
        } else {
            const calTabBtn = document.querySelector('.nav-btn[data-tab="tab-calendar"]');
            if (calTabBtn) calTabBtn.click();

            const formCard = document.querySelector('.form-card');
            if (formCard) formCard.scrollIntoView({ behavior: 'smooth' });
        }
    },

    // モーダル開閉
    openVoiceModal() {
        const modal = document.getElementById('voiceModal');
        if (modal) {
            modal.classList.add('show');
            this.currentParsedData = null;
            const textDisplay = document.getElementById('voiceTranscriptText');
            if (textDisplay) textDisplay.textContent = 'マイクボタンを押して、家計簿の内容をお話しください。';
            const statusEl = document.getElementById('voiceModalStatus');
            if (statusEl) statusEl.textContent = '待機中（例: 「今日 食費 850円 ランチ」）';

            this.displayParsedPreview({
                date: this.formatDateYMD(new Date()),
                type: '支出',
                category: '食費',
                amount: null,
                memo: ''
            });

            const applyBtn = document.getElementById('applyVoiceRecordBtn');
            const fillOnlyBtn = document.getElementById('fillOnlyVoiceRecordBtn');
            if (applyBtn) applyBtn.disabled = true;
            if (fillOnlyBtn) fillOnlyBtn.disabled = true;

            setTimeout(() => {
                this.startListening();
            }, 300);
        }
    },

    closeVoiceModal() {
        this.stopListening();
        const modal = document.getElementById('voiceModal');
        if (modal) {
            modal.classList.remove('show');
        }
    },

    // ==========================================
    // 音声読み上げ (SpeechSynthesis) 機能
    // ==========================================

    speak(text, onEndCallback) {
        if (!this.synth) {
            console.warn('SpeechSynthesis is not supported.');
            return;
        }

        this.synth.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'ja-JP';
        utterance.rate = this.settings.voiceRate || 1.0;
        utterance.pitch = 1.0;

        const voices = this.synth.getVoices();
        const jaVoice = voices.find(v => v.lang === 'ja-JP' || v.lang.startsWith('ja'));
        if (jaVoice) {
            utterance.voice = jaVoice;
        }

        utterance.onstart = () => {
            this.isSpeaking = true;
            this.updateSpeakingUI(true);
        };

        utterance.onend = () => {
            this.isSpeaking = false;
            this.updateSpeakingUI(false);
            if (onEndCallback) onEndCallback();
        };

        utterance.onerror = (e) => {
            console.error('SpeechSynthesis error:', e);
            this.isSpeaking = false;
            this.updateSpeakingUI(false);
            if (onEndCallback) onEndCallback();
        };

        this.synth.speak(utterance);
    },

    stopSpeaking() {
        if (this.synth) {
            this.synth.cancel();
            this.isSpeaking = false;
            this.updateSpeakingUI(false);
        }
    },

    updateSpeakingUI(speaking) {
        const readBtn = document.getElementById('readSummaryBtn');
        if (readBtn) {
            if (speaking) {
                readBtn.classList.add('speaking');
                readBtn.innerHTML = '<span class="speak-anim-icon">⏹️</span> 読み上げを停止';
            } else {
                readBtn.classList.remove('speaking');
                readBtn.innerHTML = '<span class="speak-anim-icon">🔊</span> レポートを聴く';
            }
        }
    },

    // レコード登録完了時の音声アナウンス
    speakRecordRegistered(record) {
        if (!this.settings.voiceFeedbackEnabled || !this.synth) return;

        const amountFormatted = new Intl.NumberFormat('ja-JP').format(record.amount);
        let msg = '';

        if (record.type === '支出') {
            msg = `${record.category}、${amountFormatted}円の支出を登録しました。`;
        } else if (record.type === '収入') {
            msg = `${record.category}、${amountFormatted}円の収入を登録しました。`;
        } else if (record.type === '貯金') {
            msg = `${record.category}へ、${amountFormatted}円を貯金しました。`;
        } else if (record.type === '貯金出金') {
            msg = `${amountFormatted}円の出金を記録しました。`;
        } else if (record.type === 'サブスク') {
            msg = `${record.memo || record.category}、月額${amountFormatted}円のサブスクを登録しました。`;
        } else {
            msg = `${amountFormatted}円を登録しました。`;
        }

        this.speak(msg);
    },

    // ダッシュボードの家計レポート読み上げ
    toggleSummaryReading() {
        if (this.isSpeaking) {
            this.stopSpeaking();
            return;
        }

        const reportText = this.generateSummaryReportText();
        this.speak(reportText);
    },

    // 今月の状況レポートテキストの生成
    generateSummaryReportText() {
        const records = window.KakeiStorage ? window.KakeiStorage.loadRecords() : [];
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1;
        const currentYM = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;

        const thisMonthRecords = records.filter(r => r.date && r.date.startsWith(currentYM));

        let income = 0;
        let expense = 0;
        let saving = 0;
        const categoryMap = {};

        thisMonthRecords.forEach(r => {
            const amt = Number(r.amount) || 0;
            if (r.type === '収入') {
                income += amt;
            } else if (r.type === '支出' || r.type === 'サブスク') {
                expense += amt;
                categoryMap[r.category] = (categoryMap[r.category] || 0) + amt;
            } else if (r.type === '貯金') {
                saving += amt;
            }
        });

        const balance = income - expense;
        const fmt = (n) => new Intl.NumberFormat('ja-JP').format(n);

        let topCategory = '';
        let topCategoryAmount = 0;
        for (const [cat, amt] of Object.entries(categoryMap)) {
            if (amt > topCategoryAmount) {
                topCategory = cat;
                topCategoryAmount = amt;
            }
        }

        let report = `${currentMonth}月の家計レポートです。`;
        report += `今月の総収入は${fmt(income)}円、総支出は${fmt(expense)}円、`;

        if (balance >= 0) {
            report += `収支はプラス${fmt(balance)}円となっています。`;
        } else {
            report += `収支はマイナス${fmt(Math.abs(balance))}円の赤字となっています。ご注意ください。`;
        }

        if (topCategory && topCategoryAmount > 0) {
            report += `最も支出の多いカテゴリは${topCategory}で、${fmt(topCategoryAmount)}円です。`;
        }

        if (expense === 0 && income === 0) {
            report = `${currentMonth}月のデータはまだ登録されていません。音声入力またはフォームから今月の支出や収入を登録してみましょう！`;
        }

        return report;
    },

    zenkakuToHankaku(str) {
        if (!str) return '';
        return str.replace(/[０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));
    },

    formatDateYMD(dateObj) {
        const y = dateObj.getFullYear();
        const m = String(dateObj.getMonth() + 1).padStart(2, '0');
        const d = String(dateObj.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }
};

window.KakeiSpeechManager = SpeechManager;
