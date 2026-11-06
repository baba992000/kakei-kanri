// 家計簿の登録・一覧表示・削除機能を管理するモジュール

const RecordManager = {
    records: [],

    // 初期化処理
    init() {
        // データの読み込み
        this.records = window.KakeiStorage ? window.KakeiStorage.loadRecords() : [];

        // 今日の日付を初期値として設定
        this.setDefaultDate();

        // 登録・編集フォームの分類オプションを初期設定
        this.bindTypeChangeEvent();
        this.updateFormCategoryOptions();

        // 一覧の描画
        this.renderRecords();

        // 集計の更新
        this.updateSummary();

        // 登録ボタンのイベントリスナーを設定
        const addBtn = document.getElementById('addBtn');
        if (addBtn) {
            addBtn.addEventListener('click', () => this.addRecord());
        }

        // モーダルのイベント設定
        this.bindModalEvents();

        // 家族共有のフィルターイベント設定
        const filterOwner = document.getElementById('filterOwner');
        if (filterOwner) {
            filterOwner.addEventListener('change', () => this.renderRecords());
        }

        // 口座フィルターのイベント設定
        const filterAccount = document.getElementById('filterAccount');
        if (filterAccount) {
            filterAccount.addEventListener('change', () => this.renderRecords());
        }
    },

    // 種類セレクトボックスの変更イベントを紐付け（カテゴリの動的切り替え）
    bindTypeChangeEvent() {
        const typeSelect = document.getElementById('type');
        if (typeSelect) {
            typeSelect.addEventListener('change', () => this.updateFormCategoryOptions(''));
        }

        const editTypeSelect = document.getElementById('edit-type');
        if (editTypeSelect) {
            editTypeSelect.addEventListener('change', () => this.updateFormCategoryOptions('edit-'));
        }

        const categorySelect = document.getElementById('category');
        if (categorySelect) {
            categorySelect.addEventListener('change', () => {
                this.syncCategorySelection('', categorySelect.value);
            });
        }

        const editCategorySelect = document.getElementById('edit-category');
        if (editCategorySelect) {
            editCategorySelect.addEventListener('change', () => {
                this.syncCategorySelection('edit-', editCategorySelect.value);
            });
        }
    },

    // 種類に応じた分類オプションおよびグリッドの動的生成
    updateFormCategoryOptions(prefix = '') {
        const typeSelect = document.getElementById(prefix + 'type');
        const categorySelect = document.getElementById(prefix + 'category');
        if (!typeSelect || !categorySelect) return;

        const type = typeSelect.value;

        // 機能選択状態の取得
        const features = window.KakeiSettingsManager ? window.KakeiSettingsManager.settings.features : {
            partTimeIncome: false,
            subscription: false,
            familyShare: false,
            fixedCost: false,
            pension: false,
            jointAccount: false
        };

        // CategoryServiceからカテゴリリストを取得（フォールバックあり）
        let options = [];
        if (window.CategoryService) {
            options = window.CategoryService.getCategoriesForType(type, features);
        } else {
            if (type === '収入') {
                options = ['給与', 'その他'];
            } else if (type === '貯金' || type === '貯金出金') {
                options = ['貯金（入金）', '普通預金', '定期預金', 'その他'];
            } else {
                options = ['食費', '日用品', '住居費', '水道光熱費', '通信費', '交通費', '医療費', '娯楽費', 'その他'];
            }
        }

        // セレクトボックスのオプション生成
        const prevValue = categorySelect.value;
        categorySelect.innerHTML = options.map(opt => `<option value="${opt}">${opt}</option>`).join('');

        // デフォルト選択値の決定
        let selectedValue = options[0] || '';
        if (options.includes(prevValue)) {
            selectedValue = prevValue;
        } else if (type === '支出' && options.includes('食費')) {
            selectedValue = '食費';
        }
        categorySelect.value = selectedValue;

        // グリッドUIの生成
        const gridEl = document.getElementById(prefix + 'categoryGrid');
        if (gridEl) {
            gridEl.innerHTML = '';
            options.forEach(catName => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'category-tile' + (catName === selectedValue ? ' active' : '');
                btn.dataset.category = catName;
                btn.setAttribute('role', 'radio');
                btn.setAttribute('aria-checked', catName === selectedValue ? 'true' : 'false');
                btn.setAttribute('aria-label', catName);

                // アイコンSVG取得
                const iconHtml = window.CategoryService
                    ? window.CategoryService.getIconSvg(catName, 26)
                    : `<span class="category-fallback-icon">🏷️</span>`;

                btn.innerHTML = `
                    <div class="category-tile-icon-wrap">
                        ${iconHtml}
                    </div>
                    <span class="category-tile-text">${escapeHTML(catName)}</span>
                `;

                btn.addEventListener('click', () => {
                    categorySelect.value = catName;
                    categorySelect.dispatchEvent(new Event('change'));
                });

                gridEl.appendChild(btn);
            });

            // Lucideアイコンの初期化（未置換のSVGがあれば適用）
            if (window.lucide && typeof window.lucide.createIcons === 'function') {
                window.lucide.createIcons();
            }
        }

        // 選択中バッジ・表示タグの更新
        this.syncCategorySelection(prefix, selectedValue);
    },

    // カテゴリー選択状態をUIに反映
    syncCategorySelection(prefix = '', selectedValue) {
        const categorySelect = document.getElementById(prefix + 'category');
        if (categorySelect && selectedValue && categorySelect.value !== selectedValue) {
            categorySelect.value = selectedValue;
        }

        const gridEl = document.getElementById(prefix + 'categoryGrid');
        if (gridEl) {
            const tiles = gridEl.querySelectorAll('.category-tile');
            tiles.forEach(tile => {
                const isSelected = tile.dataset.category === selectedValue;
                tile.classList.toggle('active', isSelected);
                tile.setAttribute('aria-checked', isSelected ? 'true' : 'false');
            });
        }

        const tagEl = document.getElementById(prefix + 'currentCategoryTag');
        if (tagEl && selectedValue) {
            const iconSvg = window.CategoryService
                ? window.CategoryService.getIconSvg(selectedValue, 16)
                : '';
            tagEl.innerHTML = `選択中: <span class="tag-cat-name">${iconSvg} ${escapeHTML(selectedValue)}</span>`;
        }
    },

    // 日付入力欄の初期値を今日にする
    setDefaultDate() {
        const dateInput = document.getElementById('date');
        if (dateInput) {
            const today = new Date();
            const year = today.getFullYear();
            const month = String(today.getMonth() + 1).padStart(2, '0');
            const day = String(today.getDate()).padStart(2, '0');
            dateInput.value = `${year}-${month}-${day}`;
        }
    },

    // レコードを追加
    addRecord() {
        const dateInput = document.getElementById('date');
        const typeSelect = document.getElementById('type');
        const categorySelect = document.getElementById('category');
        const amountInput = document.getElementById('amount');
        const memoInput = document.getElementById('memo');
        const ownerSelect = document.getElementById('owner');
        const accountSelect = document.getElementById('account');

        // 値の取得
        const date = dateInput ? dateInput.value : '';
        const type = typeSelect ? typeSelect.value : '';
        const category = categorySelect ? categorySelect.value : '';
        const amountStr = amountInput ? amountInput.value.trim() : '';
        const memo = memoInput ? memoInput.value.trim() : '';
        const owner = ownerSelect ? ownerSelect.value : '自分';
        const account = accountSelect ? accountSelect.value : 'personal';

        // バリデーション
        if (!date) {
            alert('日付を入力してください。');
            return;
        }

        if (!amountStr) {
            alert('金額を入力してください。');
            return;
        }

        const amount = parseInt(amountStr, 10);
        if (isNaN(amount) || amount <= 0) {
            alert('金額には0より大きい数値を入力してください。');
            return;
        }

        // 新規レコードオブジェクトの作成
        const newRecord = {
            id: 'rec_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            date,
            type,
            category,
            amount,
            memo,
            owner,
            account
        };

        // レコードの保存
        this.records.push(newRecord);
        if (window.KakeiStorage) {
            window.KakeiStorage.saveRecords(this.records);
        }

        // UIの更新
        this.renderRecords();
        this.updateSummary();
        this.clearForm();

        // 共同口座マネージャーの更新
        if (window.KakeiJointAccountManager) {
            window.KakeiJointAccountManager.renderAll();
        }

        // カレンダー・グラフの再描画
        if (window.KakeiCalendarManager) window.KakeiCalendarManager.refreshCalendar();
        if (window.KakeiChartManager) window.KakeiChartManager.refreshCharts();

        // 音声読み上げ案内
        if (window.KakeiSpeechManager) {
            window.KakeiSpeechManager.speakRecordRegistered(newRecord);
        }

        console.log('レコードを追加しました:', newRecord);
    },

    // フォームのクリア（日付は残す）
    clearForm() {
        const amountInput = document.getElementById('amount');
        const memoInput = document.getElementById('memo');

        if (amountInput) amountInput.value = '';
        if (memoInput) memoInput.value = '';

        const typeSelect = document.getElementById('type');
        if (typeSelect) {
            typeSelect.value = '支出';
            this.updateFormCategoryOptions('');
        }

        const ownerSelect = document.getElementById('owner');
        if (ownerSelect) ownerSelect.selectedIndex = 0;

        const accountSelect = document.getElementById('account');
        if (accountSelect) accountSelect.value = 'personal';
    },

    // 編集モーダルのイベントバインド
    bindModalEvents() {
        const closeModalBtn = document.getElementById('closeModalBtn');
        const cancelModalBtn = document.getElementById('cancelModalBtn');
        const saveModalBtn = document.getElementById('saveModalBtn');

        if (closeModalBtn) closeModalBtn.addEventListener('click', () => this.closeEditModal());
        if (cancelModalBtn) cancelModalBtn.addEventListener('click', () => this.closeEditModal());
        if (saveModalBtn) saveModalBtn.addEventListener('click', () => this.saveEditRecord());

        // モーダルの外側クリックで閉じる
        window.addEventListener('click', (e) => {
            const modal = document.getElementById('editModal');
            if (e.target === modal) {
                this.closeEditModal();
            }
        });
    },

    // 編集モーダルを開く
    openEditModal(id) {
        const record = this.records.find(r => r.id === id);
        if (!record) return;

        // モーダル各欄に値をセット
        document.getElementById('edit-id').value = record.id;
        document.getElementById('edit-date').value = record.date;
        document.getElementById('edit-type').value = record.type;

        // 種類に応じたカテゴリの選択肢を生成
        this.updateFormCategoryOptions('edit-');
        document.getElementById('edit-category').value = record.category;
        this.syncCategorySelection('edit-', record.category);

        document.getElementById('edit-amount').value = record.amount;
        document.getElementById('edit-memo').value = record.memo || '';

        const editOwner = document.getElementById('edit-owner');
        if (editOwner) {
            editOwner.value = record.owner || '自分';
        }

        const editAccount = document.getElementById('edit-account');
        if (editAccount) {
            editAccount.value = record.account || 'personal';
        }

        const modal = document.getElementById('editModal');
        if (modal) {
            modal.style.display = 'flex';
        }
    },

    // 編集モーダルを閉じる
    closeEditModal() {
        const modal = document.getElementById('editModal');
        if (modal) {
            modal.style.display = 'none';
        }
    },

    // 編集内容を保存
    saveEditRecord() {
        const id = document.getElementById('edit-id').value;
        const date = document.getElementById('edit-date').value;
        const type = document.getElementById('edit-type').value;
        const category = document.getElementById('edit-category').value;
        const amountStr = document.getElementById('edit-amount').value;
        const memo = document.getElementById('edit-memo').value.trim();
        const owner = document.getElementById('edit-owner') ? document.getElementById('edit-owner').value : '自分';
        const account = document.getElementById('edit-account') ? document.getElementById('edit-account').value : 'personal';

        if (!date || !amountStr) {
            alert('日付と金額を入力してください。');
            return;
        }

        const amount = parseInt(amountStr, 10);
        if (isNaN(amount) || amount <= 0) {
            alert('金額には0より大きい数値を入力してください。');
            return;
        }

        // レコードを置換
        const index = this.records.findIndex(r => r.id === id);
        if (index !== -1) {
            this.records[index] = {
                ...this.records[index],
                date,
                type,
                category,
                amount,
                memo,
                owner,
                account
            };

            if (window.KakeiStorage) {
                window.KakeiStorage.saveRecords(this.records);
            }

            this.closeEditModal();
            this.renderRecords();
            this.updateSummary();

            // 共同口座マネージャーの更新
            if (window.KakeiJointAccountManager) {
                window.KakeiJointAccountManager.renderAll();
            }

            // カレンダー・グラフの再描画
            if (window.KakeiCalendarManager) window.KakeiCalendarManager.refreshCalendar();
            if (window.KakeiChartManager) window.KakeiChartManager.refreshCharts();

            console.log('レコードを編集しました:', this.records[index]);
        }
    },

    // レコードを削除
    deleteRecord(id) {
        if (!confirm('このレコードを削除してもよろしいですか？')) {
            return;
        }

        this.records = this.records.filter(record => record.id !== id);

        if (window.KakeiStorage) {
            window.KakeiStorage.saveRecords(this.records);
        }

        this.renderRecords();
        this.updateSummary();

        // 共同口座マネージャーの更新
        if (window.KakeiJointAccountManager) {
            window.KakeiJointAccountManager.renderAll();
        }

        // カレンダー・グラフの再描画
        if (window.KakeiCalendarManager) window.KakeiCalendarManager.refreshCalendar();
        if (window.KakeiChartManager) window.KakeiChartManager.refreshCharts();
    },

    // 一覧の描画
    renderRecords() {
        const recordList = document.getElementById('recordList');
        if (!recordList) return;

        recordList.innerHTML = '';

        const features = window.KakeiSettingsManager ? window.KakeiSettingsManager.settings.features : { familyShare: false, jointAccount: false };
        const filterOwnerEl = document.getElementById('filterOwner');
        const filterOwnerVal = filterOwnerEl ? filterOwnerEl.value : 'all';

        const filterAccountEl = document.getElementById('filterAccount');
        const filterAccountVal = filterAccountEl ? filterAccountEl.value : 'all';

        // フィルター適用
        let displayedRecords = [...this.records];
        if (features.familyShare && filterOwnerVal !== 'all') {
            displayedRecords = displayedRecords.filter(r => r.owner === filterOwnerVal);
        }
        if (features.jointAccount && filterAccountVal !== 'all') {
            displayedRecords = displayedRecords.filter(r => (r.account || 'personal') === filterAccountVal);
        }

        if (displayedRecords.length === 0) {
            let emptyColSpan = 7;
            if (features.familyShare) emptyColSpan++;
            if (features.jointAccount) emptyColSpan++;

            const emptyRow = document.createElement('tr');
            emptyRow.innerHTML = `<td colspan="${emptyColSpan}" style="color: #888; text-align: center;">登録されたデータがありません。</td>`;
            recordList.appendChild(emptyRow);
            return;
        }

        // 日付の降順（新しい順）で並び替え
        const sortedRecords = displayedRecords.sort((a, b) => new Date(b.date) - new Date(a.date));

        sortedRecords.forEach(record => {
            const tr = document.createElement('tr');

            // 金額フォーマット
            const formattedAmount = new Intl.NumberFormat('ja-JP').format(record.amount) + ' 円';

            // 種類による色分け
            let typeColor = '';
            if (record.type === '収入') {
                typeColor = 'color: var(--income-color); font-weight: bold;';
            } else if (record.type === '支出') {
                typeColor = 'color: var(--expense-color); font-weight: bold;';
            } else if (record.type === '貯金') {
                typeColor = 'color: var(--saving-color); font-weight: bold;';
            } else if (record.type === '貯金出金') {
                typeColor = 'color: var(--accent-dark); font-weight: bold;';
            } else if (record.type === 'サブスク') {
                typeColor = 'color: var(--accent-dark); font-weight: bold;';
            }

            const ownerTd = features.familyShare ? `<td><span class="badge">${escapeHTML(record.owner || '自分')}</span></td>` : '';
            const isJoint = (record.account === 'joint');
            const accountTd = features.jointAccount ? `<td><span class="badge ${isJoint ? 'badge-joint' : ''}">${isJoint ? '🏦 共同' : '👤 個人'}</span></td>` : '';

            tr.innerHTML = `
                <td>${escapeHTML(record.date)}</td>
                <td style="${typeColor}">${escapeHTML(record.type)}</td>
                <td>${window.CategoryService ? window.CategoryService.getCategoryBadge(record.category) : escapeHTML(record.category)}</td>
                <td style="text-align: right; font-family: monospace; font-weight: 600;">${formattedAmount}</td>
                <td style="text-align: left;">${escapeHTML(record.memo || '-')}</td>
                ${ownerTd}
                ${accountTd}
                <td><button class="edit-btn btn-secondary" data-id="${record.id}">編集</button></td>
                <td><button class="delete-btn btn-danger" data-id="${record.id}">削除</button></td>
            `;

            // イベントリスナーの追加
            tr.querySelector('.delete-btn').addEventListener('click', () => this.deleteRecord(record.id));
            tr.querySelector('.edit-btn').addEventListener('click', () => this.openEditModal(record.id));

            recordList.appendChild(tr);
        });
    },

    // 集計・ダッシュボードの表示更新
    updateSummary() {
        const today = new Date();
        const curYear = today.getFullYear();
        const curMonth = today.getMonth() + 1;
        const curMonthStr = `${curYear}-${String(curMonth).padStart(2, '0')}`;

        // 今月（当月）の集計
        let incomeTotal = 0;
        let expenseTotal = 0;
        let savingInTotal = 0;
        let savingOutTotal = 0;
        let subscTotal = 0;
        let partTimeIncomeTotal = 0;

        // 全期間の集計
        let allSavingInTotal = 0;
        let allSavingOutTotal = 0;
        let allPensionTotal = 0;
        let allInvestTotal = 0;

        // 支出ランキング用マップ (当月のみ)
        const catExpenses = {};

        // 固定費分析用合計 (当月のみ)
        let fixedCost = 0;
        let variableCost = 0;

        // 家族別集計マップ (当月のみ)
        const familyMap = {
            '自分':       { income: 0, expense: 0 },
            'パートナー': { income: 0, expense: 0 },
            '共通':       { income: 0, expense: 0 }
        };

        this.records.forEach(record => {
            const amount = record.amount || 0;
            const isCurrentMonth = record.date && record.date.startsWith(curMonthStr);

            // 全期間集計
            if (record.type === '貯金') {
                allSavingInTotal += amount;
                if (record.category === '長期積立') {
                    allInvestTotal += amount;
                }
            } else if (record.type === '貯金出金') {
                allSavingOutTotal += amount;
                if (record.category === '長期積立') {
                    allInvestTotal -= amount;
                }
            }

            // 年金保険・長期積立 (全期間)
            if (record.category === '年金保険' || record.category === '年金') {
                allPensionTotal += amount;
            } else if (record.category === '長期積立' && record.type !== '貯金' && record.type !== '貯金出金') {
                allInvestTotal += amount;
            }

            // 今月集計
            if (isCurrentMonth) {
                if (record.type === '収入') {
                    incomeTotal += amount;
                    if (record.category === 'アルバイト') {
                        partTimeIncomeTotal += amount;
                    }
                } else if (record.type === '支出') {
                    expenseTotal += amount;

                    // カテゴリ集計
                    const cat = record.category || 'その他';
                    catExpenses[cat] = (catExpenses[cat] || 0) + amount;

                    // 固定費判定 (家賃、住居費、光熱費、水道光熱費、通信費、保険料、税金・社会保険料等)
                    if (['家賃', '住居費', '光熱費', '水道光熱費', '通信費', '保険料', '税金・社会保険料', '固定費', 'サブスク（月額）'].includes(record.category)) {
                        fixedCost += amount;
                    } else {
                        variableCost += amount;
                    }
                } else if (record.type === '貯金') {
                    savingInTotal += amount;
                } else if (record.type === '貯金出金') {
                    savingOutTotal += amount;
                } else if (record.type === 'サブスク') {
                    subscTotal += amount;

                    // サブスクは固定費として支出合計にマージする
                    expenseTotal += amount;
                    fixedCost += amount;

                    // カテゴリ集計
                    const cat = record.category || 'その他';
                    catExpenses[cat] = (catExpenses[cat] || 0) + amount;
                }

                // 家族別集計
                const ownerKey = record.owner || '自分';
                if (familyMap[ownerKey]) {
                    if (record.type === '収入') {
                        familyMap[ownerKey].income += amount;
                    } else if (record.type === '支出' || record.type === 'サブスク') {
                        familyMap[ownerKey].expense += amount;
                    }
                }
            }

        });

        // 計算
        const totalSavingsNet = allSavingInTotal - allSavingOutTotal; // 貯金残高合計
        // 長期積立を個別の枠にするため、貯金から長期積立分を分離
        const savingBalance = (allInvestTotal > 0 && totalSavingsNet >= allInvestTotal)
            ? (totalSavingsNet - allInvestTotal)
            : totalSavingsNet;

        // 手元残高 (収入 - 支出) ※貯金出金/入金も反映
        // 収入 - 支出 - 貯金（手元から出ていく） + 貯金出金（手元に戻る）
        const balanceTotal = incomeTotal - expenseTotal - savingInTotal + savingOutTotal;

        // UI更新
        const formatter = new Intl.NumberFormat('ja-JP');

        const elSavingBalance = document.getElementById('savingBalance');
        if (elSavingBalance) {
            elSavingBalance.textContent = formatter.format(savingBalance) + ' 円';
            elSavingBalance.style.color = savingBalance < 0 ? 'var(--expense-color)' : '';
        }

        const elBalance = document.getElementById('balance');
        if (elBalance) {
            elBalance.textContent = formatter.format(balanceTotal) + ' 円';
            elBalance.style.color = balanceTotal < 0 ? 'var(--expense-color)' : '';
        }

        const elIncome = document.getElementById('income');
        if (elIncome) elIncome.textContent = formatter.format(incomeTotal) + ' 円';

        const elExpense = document.getElementById('expense');
        if (elExpense) elExpense.textContent = formatter.format(expenseTotal) + ' 円';

        // 特殊機能：年金残高
        const elPension = document.getElementById('pensionBalance');
        if (elPension) elPension.textContent = formatter.format(allPensionTotal) + ' 円';

        // 特殊機能：長期積立
        const elInvest = document.getElementById('investBalance');
        if (elInvest) elInvest.textContent = formatter.format(allInvestTotal) + ' 円';

        // 特殊機能：サブスク
        const elSubsc = document.getElementById('subscTotal');
        if (elSubsc) elSubsc.textContent = formatter.format(subscTotal) + ' 円';

        // 特殊機能：アルバイト収入
        const elPartTime = document.getElementById('partTimeIncomeVal');
        if (elPartTime) elPartTime.textContent = formatter.format(partTimeIncomeTotal) + ' 円';

        // 支出ランキング (TOP5) の描画
        const sortedExpenses = Object.keys(catExpenses)
            .map(cat => ({ category: cat, amount: catExpenses[cat] }))
            .sort((a, b) => b.amount - a.amount);

        const rankingContainer = document.getElementById('rankingContainer');
        if (rankingContainer) {
            if (sortedExpenses.length === 0) {
                rankingContainer.innerHTML = '<p class="empty-msg">今月の支出データがありません。</p>';
            } else {
                rankingContainer.innerHTML = sortedExpenses.slice(0, 5).map((item, idx) => `
                    <div class="ranking-item">
                        <span class="ranking-rank">${idx + 1}</span>
                        <span class="ranking-cat">${window.CategoryService ? window.CategoryService.getCategoryBadge(item.category) : escapeHTML(item.category)}</span>
                        <span class="ranking-amount">${formatter.format(item.amount)} 円</span>
                    </div>
                `).join('');
            }
        }

        // 固定費分析の描画
        const totalCost = fixedCost + variableCost;
        let fixedRatio = 0;
        let variableRatio = 0;
        if (totalCost > 0) {
            fixedRatio = Math.round((fixedCost / totalCost) * 100);
            variableRatio = 100 - fixedRatio;
        }

        const fixedCostBar = document.getElementById('fixedCostBar');
        if (fixedCostBar) {
            fixedCostBar.style.width = `${fixedRatio}%`;
        }

        const elFixedCostRatio = document.getElementById('fixedCostRatio');
        if (elFixedCostRatio) elFixedCostRatio.textContent = `${fixedRatio}%`;
        const elFixedCostAmount = document.getElementById('fixedCostAmount');
        if (elFixedCostAmount) elFixedCostAmount.textContent = `${formatter.format(fixedCost)}円`;

        const elVariableCostRatio = document.getElementById('variableCostRatio');
        if (elVariableCostRatio) elVariableCostRatio.textContent = `${variableRatio}%`;
        const elVariableCostAmount = document.getElementById('variableCostAmount');
        if (elVariableCostAmount) elVariableCostAmount.textContent = `${formatter.format(variableCost)}円`;

        // 家族別内訳の描画
        ['自分', 'パートナー', '共通'].forEach(member => {
            const d = familyMap[member];
            const balance = d.income - d.expense;

            const elInc = document.getElementById(`familyIncome_${member}`);
            if (elInc) elInc.textContent = formatter.format(d.income) + ' 円';

            const elExp = document.getElementById(`familyExpense_${member}`);
            if (elExp) elExp.textContent = formatter.format(d.expense) + ' 円';

            const elBal = document.getElementById(`familyBalance_${member}`);
            if (elBal) {
                elBal.textContent = formatter.format(balance) + ' 円';
                elBal.style.color = balance < 0 ? 'var(--expense-color)' : 'var(--income-color)';
            }
        });

        // 共同口座マネージャーのウィジェット・集計更新
        if (window.KakeiJointAccountManager) {
            window.KakeiJointAccountManager.renderAll();
        }
    }
};

// XSS対策のためのエスケープ関数
function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, tag => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
    }[tag] || tag));
}

// グローバルスコープに公開
window.KakeiRecordManager = RecordManager;
