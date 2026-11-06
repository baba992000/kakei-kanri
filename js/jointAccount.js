// ========================================================
// 共同口座連携管理モジュール (Joint Account Manager)
// ========================================================

const JointAccountManager = {
    // 初期化
    init() {
        this.bindEvents();
        this.renderAll();
    },

    // イベントバインド
    bindEvents() {
        // ダッシュボード・共同口座画面の「銀行明細同期」ボタン
        const syncButtons = [
            document.getElementById('syncJointBankBtn'),
            document.getElementById('dashSyncJointBankBtn')
        ];
        syncButtons.forEach(btn => {
            if (btn) {
                btn.addEventListener('click', () => this.syncMockBankTransactions());
            }
        });

        // 共同口座専用明細CSVインポート
        const jointCsvInput = document.getElementById('jointCsvImportFile');
        if (jointCsvInput) {
            jointCsvInput.addEventListener('change', (e) => this.importJointCSV(e));
        }

        // 精算完了記録ボタン
        const settleBalanceBtn = document.getElementById('settleBalanceBtn');
        if (settleBalanceBtn) {
            settleBalanceBtn.addEventListener('click', () => this.recordSettlement());
        }
    },

    // 全描画更新
    renderAll() {
        const settings = window.KakeiSettingsManager ? window.KakeiSettingsManager.settings : null;
        if (!settings || !settings.features || !settings.features.jointAccount) {
            return;
        }

        this.updateDashboardWidget();
        this.updateJointTab();
    },

    // 共同口座関連の数値集計
    getJointMetrics() {
        const records = window.KakeiRecordManager ? window.KakeiRecordManager.records : [];
        const settings = window.KakeiSettingsManager ? window.KakeiSettingsManager.settings : {};
        const jointSettings = settings.jointAccount || {
            accountName: '共同生活費口座',
            bankName: '住信SBIネット銀行',
            initialBalance: 150000,
            targetBudget: 200000,
            splitRule: 'ratio',
            myRatio: 50,
            partnerRatio: 50,
            myFixedAmount: 100000,
            partnerFixedAmount: 100000,
            lastSynced: null
        };

        const today = new Date();
        const curYear = today.getFullYear();
        const curMonth = today.getMonth() + 1;
        const curMonthStr = `${curYear}-${String(curMonth).padStart(2, '0')}`;

        let currentBalance = jointSettings.initialBalance || 0;
        let currentMonthExpense = 0;
        let currentMonthIncome = 0;

        // 拠出内訳（当月）
        let myDepositThisMonth = 0;
        let partnerDepositThisMonth = 0;
        let commonDepositThisMonth = 0;

        // 共同口座レコード一覧（全件）
        const jointRecords = [];

        records.forEach(r => {
            const isJoint = (r.account === 'joint');
            if (!isJoint) return;

            jointRecords.push(r);
            const amount = r.amount || 0;
            const isCurrentMonth = r.date && r.date.startsWith(curMonthStr);

            // 残高計算（全期間）
            if (r.type === '収入' || r.type === '貯金') {
                currentBalance += amount;
            } else if (r.type === '支出' || r.type === 'サブスク' || r.type === '貯金出金') {
                currentBalance -= amount;
            }

            // 当月集計
            if (isCurrentMonth) {
                if (r.type === '支出' || r.type === 'サブスク') {
                    currentMonthExpense += amount;
                } else if (r.type === '収入' || r.type === '貯金') {
                    currentMonthIncome += amount;
                    // 拠出者判定
                    if (r.owner === '自分') {
                        myDepositThisMonth += amount;
                    } else if (r.owner === 'パートナー') {
                        partnerDepositThisMonth += amount;
                    } else {
                        commonDepositThisMonth += amount;
                    }
                }
            }
        });

        // 目標拠出額の計算
        let myTargetDeposit = 0;
        let partnerTargetDeposit = 0;
        const targetBudget = jointSettings.targetBudget || 200000;

        if (jointSettings.splitRule === 'fixed') {
            myTargetDeposit = jointSettings.myFixedAmount || 100000;
            partnerTargetDeposit = jointSettings.partnerFixedAmount || 100000;
        } else {
            const myRatio = (jointSettings.myRatio !== undefined) ? jointSettings.myRatio : 50;
            myTargetDeposit = Math.round(targetBudget * (myRatio / 100));
            partnerTargetDeposit = targetBudget - myTargetDeposit;
        }

        // 精算バランスの計算
        const totalDepositThisMonth = myDepositThisMonth + partnerDepositThisMonth + commonDepositThisMonth;
        let settlementMessage = '';
        let settlementType = 'balanced'; // 'balanced', 'partner_owes_me', 'me_owes_partner'
        let settlementDiff = 0;

        if (jointSettings.splitRule === 'fixed') {
            const myDiff = myDepositThisMonth - myTargetDeposit;
            const partnerDiff = partnerDepositThisMonth - partnerTargetDeposit;

            if (myDiff > partnerDiff) {
                settlementType = 'partner_owes_me';
                settlementDiff = Math.abs(myDiff - partnerDiff) / 2;
                settlementMessage = `パートナーから自分へ ${this.formatYen(settlementDiff)} の精算が適正です`;
            } else if (partnerDiff > myDiff) {
                settlementType = 'me_owes_partner';
                settlementDiff = Math.abs(partnerDiff - myDiff) / 2;
                settlementMessage = `自分からパートナーへ ${this.formatYen(settlementDiff)} の精算が適正です`;
            } else {
                settlementType = 'balanced';
                settlementMessage = '今月の拠出バランスは適正です（精算不要）';
            }
        } else {
            const myRatio = ((jointSettings.myRatio !== undefined) ? jointSettings.myRatio : 50) / 100;
            const directTotal = myDepositThisMonth + partnerDepositThisMonth;

            if (directTotal > 0) {
                const myExpected = Math.round(directTotal * myRatio);
                const myOver = myDepositThisMonth - myExpected;
                if (myOver > 500) {
                    settlementType = 'partner_owes_me';
                    settlementDiff = myOver;
                    settlementMessage = `パートナーから自分へ ${this.formatYen(settlementDiff)} の精算が適正です`;
                } else if (myOver < -500) {
                    settlementType = 'me_owes_partner';
                    settlementDiff = Math.abs(myOver);
                    settlementMessage = `自分からパートナーへ ${this.formatYen(settlementDiff)} の精算が適正です`;
                } else {
                    settlementType = 'balanced';
                    settlementMessage = '今月の拠出比率は目標どおりです（精算不要）';
                }
            } else {
                settlementType = 'balanced';
                settlementMessage = '今月の入金拠出はまだ記録されていません';
            }
        }

        return {
            jointSettings,
            currentBalance,
            currentMonthExpense,
            currentMonthIncome,
            myDepositThisMonth,
            partnerDepositThisMonth,
            commonDepositThisMonth,
            totalDepositThisMonth,
            myTargetDeposit,
            partnerTargetDeposit,
            targetBudget,
            settlementMessage,
            settlementType,
            settlementDiff,
            jointRecords
        };
    },

    // ホームダッシュボードの共同口座ウィジェット更新
    updateDashboardWidget() {
        const metrics = this.getJointMetrics();

        // 残高
        const dashJointBalance = document.getElementById('dashJointBalance');
        if (dashJointBalance) {
            dashJointBalance.textContent = this.formatYen(metrics.currentBalance);
        }

        // 口座名・銀行名
        const dashJointName = document.getElementById('dashJointName');
        if (dashJointName) {
            dashJointName.textContent = `${metrics.jointSettings.bankName} (${metrics.jointSettings.accountName})`;
        }

        // 今月の共同支出
        const dashJointExpense = document.getElementById('dashJointExpense');
        if (dashJointExpense) {
            dashJointExpense.textContent = this.formatYen(metrics.currentMonthExpense);
        }

        // 拠出状況
        const dashJointDepositMy = document.getElementById('dashJointDepositMy');
        if (dashJointDepositMy) {
            dashJointDepositMy.textContent = `${this.formatYen(metrics.myDepositThisMonth)} / 目標 ${this.formatYen(metrics.myTargetDeposit)}`;
        }

        const dashJointDepositPartner = document.getElementById('dashJointDepositPartner');
        if (dashJointDepositPartner) {
            dashJointDepositPartner.textContent = `${this.formatYen(metrics.partnerDepositThisMonth)} / 目標 ${this.formatYen(metrics.partnerTargetDeposit)}`;
        }

        // プログレスバー
        const myPercent = Math.min(100, metrics.myTargetDeposit > 0 ? Math.round((metrics.myDepositThisMonth / metrics.myTargetDeposit) * 100) : 0);
        const partnerPercent = Math.min(100, metrics.partnerTargetDeposit > 0 ? Math.round((metrics.partnerDepositThisMonth / metrics.partnerTargetDeposit) * 100) : 0);

        const myBar = document.getElementById('dashJointMyBar');
        if (myBar) myBar.style.width = `${myPercent}%`;

        const partnerBar = document.getElementById('dashJointPartnerBar');
        if (partnerBar) partnerBar.style.width = `${partnerPercent}%`;

        // 精算メッセージ
        const dashJointSettlement = document.getElementById('dashJointSettlement');
        if (dashJointSettlement) {
            dashJointSettlement.textContent = metrics.settlementMessage;
            dashJointSettlement.className = `joint-settle-tag settle-${metrics.settlementType}`;
        }

        // 最終同期日時
        const dashJointSyncTime = document.getElementById('dashJointSyncTime');
        if (dashJointSyncTime) {
            dashJointSyncTime.textContent = metrics.jointSettings.lastSynced || '未同期';
        }
    },

    // 共同口座タブの描画更新
    updateJointTab() {
        const metrics = this.getJointMetrics();

        // カード情報
        const cardBankName = document.getElementById('jointCardBankName');
        if (cardBankName) cardBankName.textContent = metrics.jointSettings.bankName;

        const cardAccountName = document.getElementById('jointCardAccountName');
        if (cardAccountName) cardAccountName.textContent = metrics.jointSettings.accountName;

        const cardBalance = document.getElementById('jointCardBalance');
        if (cardBalance) cardBalance.textContent = this.formatYen(metrics.currentBalance);

        const cardSyncTime = document.getElementById('jointCardSyncTime');
        if (cardSyncTime) cardSyncTime.textContent = `最終同期: ${metrics.jointSettings.lastSynced || '未同期'}`;

        // 今月の生活費支出サマリー
        const tabJointExpense = document.getElementById('tabJointExpense');
        if (tabJointExpense) tabJointExpense.textContent = this.formatYen(metrics.currentMonthExpense);

        const tabJointTargetBudget = document.getElementById('tabJointTargetBudget');
        if (tabJointTargetBudget) tabJointTargetBudget.textContent = this.formatYen(metrics.targetBudget);

        const budgetUsagePercent = Math.min(100, metrics.targetBudget > 0 ? Math.round((metrics.currentMonthExpense / metrics.targetBudget) * 100) : 0);
        const tabBudgetProgressBar = document.getElementById('tabBudgetProgressBar');
        if (tabBudgetProgressBar) {
            tabBudgetProgressBar.style.width = `${budgetUsagePercent}%`;
            tabBudgetProgressBar.className = budgetUsagePercent > 90 ? 'progress-fill bar-danger' : (budgetUsagePercent > 70 ? 'progress-fill bar-warning' : 'progress-fill bar-success');
        }

        const tabBudgetPercent = document.getElementById('tabBudgetPercent');
        if (tabBudgetPercent) tabBudgetPercent.textContent = `${budgetUsagePercent}% 消化`;

        // 拠出状況
        const tabMyDeposit = document.getElementById('tabMyDeposit');
        if (tabMyDeposit) tabMyDeposit.textContent = this.formatYen(metrics.myDepositThisMonth);

        const tabMyTarget = document.getElementById('tabMyTarget');
        if (tabMyTarget) tabMyTarget.textContent = this.formatYen(metrics.myTargetDeposit);

        const tabPartnerDeposit = document.getElementById('tabPartnerDeposit');
        if (tabPartnerDeposit) tabPartnerDeposit.textContent = this.formatYen(metrics.partnerDepositThisMonth);

        const tabPartnerTarget = document.getElementById('tabPartnerTarget');
        if (tabPartnerTarget) tabPartnerTarget.textContent = this.formatYen(metrics.partnerTargetDeposit);

        // 精算バランス
        const tabSettlementText = document.getElementById('tabSettlementText');
        if (tabSettlementText) {
            tabSettlementText.textContent = metrics.settlementMessage;
            tabSettlementText.className = `settle-badge-large settle-${metrics.settlementType}`;
        }

        // 精算ボタンの活性/非活性
        const settleBtn = document.getElementById('settleBalanceBtn');
        if (settleBtn) {
            settleBtn.disabled = (metrics.settlementType === 'balanced' || metrics.settlementDiff <= 0);
        }

        // 共同口座明細テーブルの描画
        this.renderJointRecordsTable(metrics.jointRecords);
    },

    // 共同口座レコード一覧テーブルの描画
    renderJointRecordsTable(records) {
        const tbody = document.getElementById('jointRecordsTableBody');
        if (!tbody) return;

        tbody.innerHTML = '';

        if (!records || records.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 24px;">共同口座の取引履歴はまだありません。「明細を同期」またはデータ登録フォームから追加してください。</td></tr>`;
            return;
        }

        // 新しい日付順にソート
        const sorted = [...records].sort((a, b) => new Date(b.date) - new Date(a.date));

        sorted.slice(0, 15).forEach(record => {
            const tr = document.createElement('tr');

            const isIncome = record.type === '収入' || record.type === '貯金';
            const typeColor = isIncome ? 'var(--income-color)' : 'var(--expense-color)';
            const sign = isIncome ? '+' : '-';
            const formattedAmount = `${sign} ${new Intl.NumberFormat('ja-JP').format(record.amount)} 円`;

            tr.innerHTML = `
                <td>${this.escapeHTML(record.date)}</td>
                <td><span class="badge" style="background: ${isIncome ? 'var(--income-light)' : 'var(--expense-light)'}; color: ${typeColor}; font-weight: 600;">${this.escapeHTML(record.type)}</span></td>
                <td>${window.CategoryService ? window.CategoryService.getCategoryBadge(record.category) : this.escapeHTML(record.category)}</td>
                <td style="font-weight: 700; color: ${typeColor}; text-align: right; font-family: monospace;">${formattedAmount}</td>
                <td>${this.escapeHTML(record.memo || '-')}</td>
                <td><span class="badge">${this.escapeHTML(record.owner || '共通')}</span></td>
            `;

            tbody.appendChild(tr);
        });
    },

    // 銀行明細シミュレーション同期 (Mock API Sync) - テスト用自動追加機能は停止中
    syncMockBankTransactions() {
        // テスト用のサンプル自動追加機能は省くため停止しています。
        alert('現在、サンプル明細の自動同期機能は停止されています。\n明細の登録は「銀行明細CSVを取り込む」をご利用いただくか、通常の収支登録をご利用ください。');
    },

    // 共同口座明細CSVのインポート
    importJointCSV(e) {
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

                const imported = [];
                for (let i = 1; i < lines.length; i++) {
                    const line = lines[i].trim();
                    if (!line) continue;

                    const matches = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || line.split(',');
                    if (!matches || matches.length < 3) continue;

                    const clean = val => val ? val.replace(/^"|"$/g, '').trim() : '';
                    const date = clean(matches[0]);
                    const typeOrDesc = clean(matches[1]);
                    const amountRaw = parseInt(clean(matches[2]), 10);
                    const memo = clean(matches[3]) || typeOrDesc;

                    if (!date || isNaN(amountRaw)) continue;

                    let type = '支出';
                    let category = '食費';
                    if (typeOrDesc.includes('入金') || typeOrDesc.includes('振込') || amountRaw < 0) {
                        type = '収入';
                        category = 'その他';
                    }

                    imported.push({
                        id: 'rec_joint_csv_' + Date.now() + '_' + i,
                        date,
                        type,
                        category,
                        amount: Math.abs(amountRaw),
                        memo,
                        owner: '共通',
                        account: 'joint'
                    });
                }

                if (imported.length === 0) {
                    alert('取り込める明細がありませんでした。');
                    return;
                }

                if (confirm(`共同口座明細から ${imported.length} 件のデータを取り込みますか？`)) {
                    if (window.KakeiRecordManager) {
                        window.KakeiRecordManager.records.push(...imported);
                        if (window.KakeiStorage) {
                            window.KakeiStorage.saveRecords(window.KakeiRecordManager.records);
                        }
                        window.KakeiRecordManager.renderRecords();
                        window.KakeiRecordManager.updateSummary();
                    }
                    this.renderAll();
                    if (window.KakeiCalendarManager) window.KakeiCalendarManager.refreshCalendar();
                    if (window.KakeiChartManager) window.KakeiChartManager.refreshCharts();

                    alert('共同口座のCSV明細を取り込みました！');
                }
            } catch (err) {
                console.error('共同口座CSV取り込みエラー:', err);
                alert('ファイル読み込みに失敗しました。');
            }
            e.target.value = '';
        };
        reader.readAsText(file);
    },

    // 精算記録を自動登録
    recordSettlement() {
        const metrics = this.getJointMetrics();
        if (metrics.settlementType === 'balanced' || metrics.settlementDiff <= 0) {
            alert('精算の必要はありません。');
            return;
        }

        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        const todayStr = `${yyyy}-${mm}-${dd}`;

        const diffYen = Math.round(metrics.settlementDiff);
        const payer = metrics.settlementType === 'partner_owes_me' ? 'パートナー' : '自分';
        const receiver = metrics.settlementType === 'partner_owes_me' ? '自分' : 'パートナー';

        if (confirm(`【生活費精算の記録】\n${payer}から${receiver}へ ${this.formatYen(diffYen)} の支払いを「精算完了」として家計簿に記録しますか？`)) {
            // 精算レコードを追加
            const settlementRecord = {
                id: 'rec_settle_' + Date.now(),
                date: todayStr,
                type: '貯金',
                category: '普通預金',
                amount: diffYen,
                memo: `生活費精算 (${payer} → ${receiver})`,
                owner: payer,
                account: 'joint'
            };

            if (window.KakeiRecordManager) {
                window.KakeiRecordManager.records.push(settlementRecord);
                if (window.KakeiStorage) {
                    window.KakeiStorage.saveRecords(window.KakeiRecordManager.records);
                }
                window.KakeiRecordManager.renderRecords();
                window.KakeiRecordManager.updateSummary();
            }

            this.renderAll();
            if (window.KakeiCalendarManager) window.KakeiCalendarManager.refreshCalendar();
            if (window.KakeiChartManager) window.KakeiChartManager.refreshCharts();

            alert('生活費の精算を記録しました！');
        }
    },

    // 日本円フォーマットヘルパー
    formatYen(amount) {
        return new Intl.NumberFormat('ja-JP').format(amount || 0) + ' 円';
    },

    // HTMLエスケープヘルパー
    escapeHTML(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
};

// グローバルスコープに公開
window.KakeiJointAccountManager = JointAccountManager;
