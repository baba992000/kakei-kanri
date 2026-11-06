// 設定管理モジュール（テーマ、ダークモード、文字サイズ、機能選択、インポート/エクスポート）

const SettingsManager = {
    settings: {
        theme: 'green',
        darkMode: false,
        fontSize: 'medium',
        features: {
            partTimeIncome: false,
            subscription: false,
            familyShare: false,
            fixedCost: false,
            pension: false
        }
    },

    // 初期化
    init() {
        // 設定をロード
        if (window.KakeiStorage) {
            this.settings = window.KakeiStorage.loadSettings();
        }

        // 初期設定の適用
        this.applyTheme();
        this.applyDarkMode();
        this.applyFontSize();
        this.applyFeatures();

        // UIイベントの紐付け
        this.bindEvents();
        this.syncUIWithSettings();
    },

    // イベントバインド
    bindEvents() {
        // ダークモードトグル
        const darkModeBtn = document.getElementById('toggleDarkMode');
        if (darkModeBtn) {
            darkModeBtn.addEventListener('click', () => {
                this.settings.darkMode = !this.settings.darkMode;
                this.applyDarkMode();
                this.saveSettings();
                this.syncUIWithSettings();
            });
        }

        // テーマカラー選択
        document.querySelectorAll('.theme-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const theme = btn.dataset.theme;
                if (theme) {
                    this.settings.theme = theme;
                    this.applyTheme();
                    this.saveSettings();
                    this.syncUIWithSettings();
                }
            });
        });

        // フォントサイズ選択
        document.querySelectorAll('.fontsize-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const size = btn.dataset.size;
                if (size) {
                    this.settings.fontSize = size;
                    this.applyFontSize();
                    this.saveSettings();
                    this.syncUIWithSettings();
                }
            });
        });

        // 機能トグルスイッチ
        const featureKeys = ['partTimeIncome', 'subscription', 'familyShare', 'fixedCost', 'pension', 'jointAccount'];
        featureKeys.forEach(key => {
            const el = document.getElementById(`feature-${key}`);
            if (el) {
                el.addEventListener('change', (e) => {
                    this.settings.features[key] = e.target.checked;
                    this.applyFeatures();
                    this.saveSettings();

                    // 関連UIをリフレッシュ
                    if (window.KakeiRecordManager) {
                        window.KakeiRecordManager.renderRecords();
                        window.KakeiRecordManager.updateSummary();
                        window.KakeiRecordManager.updateFormCategoryOptions(); // フォーム内選択肢の更新
                    }
                    if (window.KakeiJointAccountManager) {
                        window.KakeiJointAccountManager.renderAll();
                    }
                    if (window.KakeiCalendarManager) window.KakeiCalendarManager.refreshCalendar();
                    if (window.KakeiChartManager) window.KakeiChartManager.refreshCharts();
                });
            }
        });

        // 共同口座設定フォームのイベント
        this.bindJointAccountSettingsEvents();

        // CSVエクスポート
        const csvExportBtn = document.getElementById('csvExportBtn');
        if (csvExportBtn) {
            csvExportBtn.addEventListener('click', () => this.exportToCSV());
        }

        // CSVインポート
        const csvImportFile = document.getElementById('csvImportFile');
        if (csvImportFile) {
            csvImportFile.addEventListener('change', (e) => this.importFromCSV(e));
        }

        // JSONバックアップエクスポート
        const backupExportBtn = document.getElementById('backupExportBtn');
        if (backupExportBtn) {
            backupExportBtn.addEventListener('click', () => this.exportBackupJSON());
        }

        // JSONバックアップインポート
        const backupImportFile = document.getElementById('backupImportFile');
        if (backupImportFile) {
            backupImportFile.addEventListener('change', (e) => this.importBackupJSON(e));
        }
    },

    // 共同口座設定イベントのバインド
    bindJointAccountSettingsEvents() {
        const saveJointSettingsBtn = document.getElementById('saveJointSettingsBtn');
        if (saveJointSettingsBtn) {
            saveJointSettingsBtn.addEventListener('click', () => {
                const accountName = document.getElementById('joint-accountName')?.value.trim() || '共同生活費口座';
                const bankName = document.getElementById('joint-bankName')?.value.trim() || '住信SBIネット銀行';
                const initialBalance = parseInt(document.getElementById('joint-initialBalance')?.value, 10) || 0;
                const targetBudget = parseInt(document.getElementById('joint-targetBudget')?.value, 10) || 200000;
                const splitRule = document.querySelector('input[name="jointSplitRule"]:checked')?.value || 'ratio';
                const myRatio = parseInt(document.getElementById('joint-myRatio')?.value, 10) || 50;
                const partnerRatio = 100 - myRatio;
                const myFixedAmount = parseInt(document.getElementById('joint-myFixedAmount')?.value, 10) || 100000;
                const partnerFixedAmount = parseInt(document.getElementById('joint-partnerFixedAmount')?.value, 10) || 100000;

                this.settings.jointAccount = {
                    ...(this.settings.jointAccount || {}),
                    accountName,
                    bankName,
                    initialBalance,
                    targetBudget,
                    splitRule,
                    myRatio,
                    partnerRatio,
                    myFixedAmount,
                    partnerFixedAmount
                };

                this.saveSettings();

                if (window.KakeiJointAccountManager) {
                    window.KakeiJointAccountManager.renderAll();
                }
                if (window.KakeiRecordManager) {
                    window.KakeiRecordManager.updateSummary();
                }

                alert('共同口座の設定を保存しました。');
            });
        }

        // 分担ルールのラジオボタン切り替え表示
        const splitRuleRadios = document.querySelectorAll('input[name="jointSplitRule"]');
        splitRuleRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                const isRatio = e.target.value === 'ratio';
                const ratioGroup = document.getElementById('jointRatioInputsGroup');
                const fixedGroup = document.getElementById('jointFixedInputsGroup');
                if (ratioGroup) ratioGroup.style.display = isRatio ? 'flex' : 'none';
                if (fixedGroup) fixedGroup.style.display = isRatio ? 'none' : 'flex';
            });
        });

        // 負担比率スライダー連動
        const myRatioInput = document.getElementById('joint-myRatio');
        const partnerRatioInput = document.getElementById('joint-partnerRatio');
        if (myRatioInput && partnerRatioInput) {
            myRatioInput.addEventListener('input', () => {
                const val = Math.min(100, Math.max(0, parseInt(myRatioInput.value, 10) || 50));
                partnerRatioInput.value = 100 - val;
                const ratioDisplay = document.getElementById('jointRatioDisplay');
                if (ratioDisplay) ratioDisplay.textContent = `自分 ${val}% : パートナー ${100 - val}%`;
            });
        }
    },

    // 設定をLocalStorageに保存
    saveSettings() {
        if (window.KakeiStorage) {
            window.KakeiStorage.saveSettings(this.settings);
        }
    },

    // 設定内容をUIコントロールに同期
    syncUIWithSettings() {
        // ダークモードアイコン/テキストの更新
        const darkModeBtn = document.getElementById('toggleDarkMode');
        if (darkModeBtn) {
            darkModeBtn.innerHTML = this.settings.darkMode ? '☀️ ライトモード' : '🌙 ダークモード';
        }

        // テーマボタンのアクティブクラス
        document.querySelectorAll('.theme-btn').forEach(btn => {
            if (btn.dataset.theme === this.settings.theme) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // フォントサイズボタンのアクティブクラス
        document.querySelectorAll('.fontsize-btn').forEach(btn => {
            if (btn.dataset.size === this.settings.fontSize) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // 機能トグルのチェック状態
        Object.keys(this.settings.features).forEach(key => {
            const el = document.getElementById(`feature-${key}`);
            if (el) {
                el.checked = !!this.settings.features[key];
            }
        });

        // 共同口座設定の入力同期
        const joint = this.settings.jointAccount || {};
        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el && val !== undefined) el.value = val;
        };

        setVal('joint-accountName', joint.accountName || '共同生活費口座');
        setVal('joint-bankName', joint.bankName || '住信SBIネット銀行');
        setVal('joint-initialBalance', joint.initialBalance !== undefined ? joint.initialBalance : 150000);
        setVal('joint-targetBudget', joint.targetBudget !== undefined ? joint.targetBudget : 200000);

        const splitRule = joint.splitRule || 'ratio';
        const ruleRadio = document.querySelector(`input[name="jointSplitRule"][value="${splitRule}"]`);
        if (ruleRadio) ruleRadio.checked = true;

        const ratioGroup = document.getElementById('jointRatioInputsGroup');
        const fixedGroup = document.getElementById('jointFixedInputsGroup');
        if (ratioGroup) ratioGroup.style.display = splitRule === 'ratio' ? 'flex' : 'none';
        if (fixedGroup) fixedGroup.style.display = splitRule === 'ratio' ? 'none' : 'flex';

        setVal('joint-myRatio', joint.myRatio !== undefined ? joint.myRatio : 50);
        setVal('joint-partnerRatio', joint.partnerRatio !== undefined ? joint.partnerRatio : 50);
        setVal('joint-myFixedAmount', joint.myFixedAmount !== undefined ? joint.myFixedAmount : 100000);
        setVal('joint-partnerFixedAmount', joint.partnerFixedAmount !== undefined ? joint.partnerFixedAmount : 100000);

        const ratioDisplay = document.getElementById('jointRatioDisplay');
        if (ratioDisplay) {
            const myR = joint.myRatio !== undefined ? joint.myRatio : 50;
            ratioDisplay.textContent = `自分 ${myR}% : パートナー ${100 - myR}%`;
        }
    },

    // テーマ適用
    applyTheme() {
        // クラスの削除
        document.body.classList.remove('theme-green', 'theme-blue', 'theme-purple', 'theme-mono');
        document.body.classList.add(`theme-${this.settings.theme}`);
    },

    // ダークモード適用
    applyDarkMode() {
        if (this.settings.darkMode) {
            document.body.classList.add('dark-mode');
        } else {
            document.body.classList.remove('dark-mode');
        }
    },

    // 文字サイズ適用
    applyFontSize() {
        document.body.classList.remove('font-small', 'font-medium', 'font-large');
        document.body.classList.add(`font-${this.settings.fontSize}`);
    },

    // 各機能のON/OFF適用
    applyFeatures() {
        Object.keys(this.settings.features).forEach(key => {
            const enabled = this.settings.features[key];

            // クラスの追加/削除で表示・非表示を制御
            const elements = document.querySelectorAll(`.feature-section-${key}`);
            elements.forEach(el => {
                if (enabled) {
                    el.classList.remove('feature-hidden');
                } else {
                    el.classList.add('feature-hidden');
                }
            });
        });

        // ナビゲーションの共同口座タブボタンの表示制御
        const jointNavBtn = document.querySelector('.nav-btn[data-tab="tab-joint"]');
        if (jointNavBtn) {
            if (this.settings.features.jointAccount) {
                jointNavBtn.classList.remove('feature-hidden');
            } else {
                jointNavBtn.classList.add('feature-hidden');
                // もし共同口座タブがアクティブならダッシュボードへ戻す
                if (jointNavBtn.classList.contains('active')) {
                    const dashBtn = document.querySelector('.nav-btn[data-tab="tab-dashboard"]');
                    if (dashBtn) dashBtn.click();
                }
            }
        }
    },

    // CSVエクスポート
    exportToCSV() {
        const records = window.KakeiRecordManager ? window.KakeiRecordManager.records : [];
        if (records.length === 0) {
            alert('エクスポートするデータがありません。');
            return;
        }

        // CSVヘッダー
        let csvContent = '\uFEFF'; // Excelで開くためのBOM付きUTF-8
        csvContent += '日付,区分,カテゴリ,金額,メモ,登録者,口座\n';

        records.forEach(r => {
            const date = r.date || '';
            const type = r.type || '';
            const category = r.category || '';
            const amount = r.amount || 0;
            // カンマやダブルクォーテーションをエスケープ
            const memo = (r.memo || '').replace(/"/g, '""');
            const owner = (r.owner || '').replace(/"/g, '""');
            const account = (r.account === 'joint' ? '共同口座' : '個人口座').replace(/"/g, '""');
            csvContent += `"${date}","${type}","${category}",${amount},"${memo}","${owner}","${account}"\n`;
        });

        // ダウンロード処理
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `kakei_backup_${new Date().toISOString().slice(0, 10)}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    },

    // CSVインポート
    importFromCSV(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const text = event.target.result;
                const lines = text.split('\n');
                if (lines.length <= 1) {
                    alert('有効なCSVデータが見つかりません。');
                    return;
                }

                const importedRecords = [];
                // 1行目はヘッダーなので2行目から解析
                for (let i = 1; i < lines.length; i++) {
                    const line = lines[i].trim();
                    if (!line) continue;

                    // カンマ区切りの単純パース（クォーテーション対応）
                    const matches = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || line.split(',');
                    if (!matches || matches.length < 4) continue;

                    const clean = val => val ? val.replace(/^"|"$/g, '').trim() : '';

                    const date = clean(matches[0]);
                    const type = clean(matches[1]);
                    const category = clean(matches[2]);
                    const amount = parseInt(clean(matches[3]), 10);
                    const memo = clean(matches[4]) || '';
                    const owner = clean(matches[5]) || '';
                    const rawAccount = clean(matches[6]) || '';
                    const account = rawAccount === '共同口座' ? 'joint' : 'personal';

                    if (!date || isNaN(amount)) continue;

                    importedRecords.push({
                        id: 'rec_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9) + '_' + i,
                        date,
                        type,
                        category,
                        amount,
                        memo,
                        owner,
                        account
                    });
                }

                if (importedRecords.length === 0) {
                    alert('取り込める有効なデータがありませんでした。');
                    return;
                }

                if (confirm(`${importedRecords.length} 件のデータをインポートします。既存のデータに追加しますか？`)) {
                    if (window.KakeiRecordManager) {
                        window.KakeiRecordManager.records.push(...importedRecords);
                        if (window.KakeiStorage) {
                            window.KakeiStorage.saveRecords(window.KakeiRecordManager.records);
                        }

                        // 各種再描画
                        window.KakeiRecordManager.renderRecords();
                        window.KakeiRecordManager.updateSummary();
                        if (window.KakeiJointAccountManager) window.KakeiJointAccountManager.renderAll();
                        if (window.KakeiCalendarManager) window.KakeiCalendarManager.refreshCalendar();
                        if (window.KakeiChartManager) window.KakeiChartManager.refreshCharts();

                        alert('CSVインポートが完了しました。');
                    }
                }
            } catch (err) {
                console.error('CSVパースエラー:', err);
                alert('ファイルの読み込み中にエラーが発生しました。');
            }
            // inputの値をリセットして、同じファイルを再度選択可能にする
            e.target.value = '';
        };
        reader.readAsText(file);
    },

    // 設定込みの完全バックアップ（JSON）
    exportBackupJSON() {
        const records = window.KakeiRecordManager ? window.KakeiRecordManager.records : [];
        const backupData = {
            version: '1.0',
            settings: this.settings,
            records: records
        };

        const jsonString = JSON.stringify(backupData, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `kakei_full_backup_${new Date().toISOString().slice(0, 10)}.json`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    },

    // 完全バックアップ復元（JSON）
    importBackupJSON(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const backupData = JSON.parse(event.target.result);
                if (!backupData.records || !backupData.settings) {
                    alert('無効なバックアップファイルフォーマットです。');
                    return;
                }

                if (confirm('バックアップを復元します。現在のデータおよび設定はすべて上書きされます。よろしいですか？')) {
                    // 設定の上書き
                    this.settings = {
                        ...this.settings,
                        ...backupData.settings,
                        features: { ...(this.settings.features || {}), ...(backupData.settings.features || {}) }
                    };
                    this.saveSettings();

                    // レコードの上書き
                    if (window.KakeiRecordManager) {
                        window.KakeiRecordManager.records = backupData.records;
                        if (window.KakeiStorage) {
                            window.KakeiStorage.saveRecords(backupData.records);
                        }
                    }

                    // アプリの再初期化処理を適用
                    this.applyTheme();
                    this.applyDarkMode();
                    this.applyFontSize();
                    this.applyFeatures();
                    this.syncUIWithSettings();

                    if (window.KakeiRecordManager) {
                        window.KakeiRecordManager.renderRecords();
                        window.KakeiRecordManager.updateSummary();
                        window.KakeiRecordManager.updateFormCategoryOptions();
                    }
                    if (window.KakeiJointAccountManager) window.KakeiJointAccountManager.renderAll();
                    if (window.KakeiCalendarManager) window.KakeiCalendarManager.refreshCalendar();
                    if (window.KakeiChartManager) window.KakeiChartManager.refreshCharts();

                    alert('データの復元が完了しました！');
                }
            } catch (err) {
                console.error('JSON復元エラー:', err);
                alert('バックアップファイルの読み込みに失敗しました。ファイルが破損している可能性があります。');
            }
            e.target.value = '';
        };
        reader.readAsText(file);
    }
};

// グローバルスコープに公開
window.KakeiSettingsManager = SettingsManager;
