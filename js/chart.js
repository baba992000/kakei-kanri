// グラフ表示機能を管理するモジュール (Chart.js を使用)

const ChartManager = {
    monthlyChartInstance: null,
    categoryChartInstance: null,

    // 状態管理
    chartPeriod: 'month', // 'month' or 'year'
    categoryChartType: 'doughnut', // 'doughnut' or 'bar'
    selectedCategories: new Set(), // フィルターで選択中のカテゴリ

    // 初期化
    initCharts() {
        this.bindEvents();

        // 存在するカテゴリからフィルターを生成
        this.initCategoryFilters();

        // グラフ描画
        this.refreshCharts();
    },

    // イベント設定
    bindEvents() {
        // 期間切り替え（月別/年別）
        const btnPeriodMonth = document.getElementById('chartPeriodMonth');
        const btnPeriodYear = document.getElementById('chartPeriodYear');

        if (btnPeriodMonth && btnPeriodYear) {
            btnPeriodMonth.addEventListener('click', () => {
                btnPeriodMonth.classList.add('active');
                btnPeriodYear.classList.remove('active');
                this.chartPeriod = 'month';
                this.renderMonthlyChart();
            });
            btnPeriodYear.addEventListener('click', () => {
                btnPeriodYear.classList.add('active');
                btnPeriodMonth.classList.remove('active');
                this.chartPeriod = 'year';
                this.renderMonthlyChart();
            });
        }

        // カテゴリ別支出グラフの形式切り替え（円/棒）
        const btnDoughnut = document.getElementById('btnChartTypeDoughnut');
        const btnBar = document.getElementById('btnChartTypeBar');

        if (btnDoughnut && btnBar) {
            btnDoughnut.addEventListener('click', () => {
                btnDoughnut.classList.add('active');
                btnBar.classList.remove('active');
                this.categoryChartType = 'doughnut';
                this.renderCategoryChart();
            });
            btnBar.addEventListener('click', () => {
                btnBar.classList.add('active');
                btnDoughnut.classList.remove('active');
                this.categoryChartType = 'bar';
                this.renderCategoryChart();
            });
        }

        // 家族唱有フィルターの変更を監視 (履歴タブ共用フィルタ)
        const filterOwner = document.getElementById('filterOwner');
        if (filterOwner) {
            filterOwner.addEventListener('change', () => {
                this.refreshCharts();
            });
        }

        // 分析タブ家族別フィルタの変更を監視
        const chartFilterOwner = document.getElementById('chartFilterOwner');
        if (chartFilterOwner) {
            chartFilterOwner.addEventListener('change', () => {
                this.refreshCharts();
            });
        }
    },

    // カテゴリフィルターチェックボックスの初期化
    initCategoryFilters() {
        // 利用可能な全カテゴリを取得
        const records = window.KakeiStorage ? window.KakeiStorage.loadRecords() : [];
        const categories = new Set();

        // デフォルトで表示される可能性がある標準カテゴリ（22カテゴリ）
        const defaultCats = window.CategoryService ? window.CategoryService.getAllExpenseCategories() : [
            '貯金（入金）', '現金チャージ', '振替チャージ', '飲食費', '日用品',
            '交通費', '服飾・美容費', '医療費', '娯楽費', '車両費',
            '旅行費', '特別費', '住居費', '水道光熱費', '通信費',
            'サブスク', '教育費', '仕送り', '年金保険', '保険料',
            '税金・社会保険料', 'その他'
        ];
        defaultCats.forEach(cat => categories.add(cat));

        // 登録されているレコードから追加カテゴリを収集
        records.forEach(r => {
            if (r.category) categories.add(r.category);
        });

        // 初期状態では全カテゴリを選択状態にする
        this.selectedCategories = new Set(categories);

        // UI生成
        const container = document.getElementById('chartCategoryFilters');
        if (!container) return;

        container.innerHTML = '';
        categories.forEach(cat => {
            const iconSvg = window.CategoryService ? window.CategoryService.getIconSvg(cat, 14) : '';
            const label = document.createElement('label');
            label.className = 'filter-chip active';
            label.innerHTML = `
                <input type="checkbox" checked value="${cat}">
                <span class="chip-content">${iconSvg}<span>${cat}</span></span>
            `;

            const checkbox = label.querySelector('input');
            checkbox.addEventListener('change', (e) => {
                if (e.target.checked) {
                    this.selectedCategories.add(cat);
                    label.classList.add('active');
                } else {
                    this.selectedCategories.delete(cat);
                    label.classList.remove('active');
                }
                this.renderCategoryChart();
                this.renderMonthlyChart();
            });

            container.appendChild(label);
        });
    },

    // グラフのリフレッシュ
    refreshCharts() {
        this.renderMonthlyChart();
        this.renderCategoryChart();
    },

    // 収支推移グラフ（月別/年別）
    renderMonthlyChart() {
        const canvas = document.getElementById('monthlyChart');
        if (!canvas) return;

        const records = window.KakeiStorage ? window.KakeiStorage.loadRecords() : [];
        const features = window.KakeiSettingsManager ? window.KakeiSettingsManager.settings.features : { familyShare: false };
        // 分析タブの家族別フィルタを優先、なければ履歴タブの共用フィルタを参照
        const chartFilterOwnerEl = document.getElementById('chartFilterOwner');
        const filterOwnerEl = document.getElementById('filterOwner');
        const filterOwnerVal = (chartFilterOwnerEl ? chartFilterOwnerEl.value : null)
            || (filterOwnerEl ? filterOwnerEl.value : 'all');

        const labels = [];
        const incomeData = [];
        const expenseData = [];
        const savingData = [];

        const today = new Date();

        if (this.chartPeriod === 'month') {
            // 直近6ヶ月の月別集計
            document.getElementById('monthlyChartTitle').textContent = '月別収支推移 (直近6ヶ月)';

            for (let i = 5; i >= 0; i--) {
                const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
                const y = d.getFullYear();
                const m = d.getMonth() + 1;
                const monthStr = `${y}-${String(m).padStart(2, '0')}`;

                labels.push(`${y}/${String(m).padStart(2, '0')}`);

                let income = 0;
                let expense = 0;
                let savingIn = 0;
                let savingOut = 0;

                records.forEach(r => {
                    if (r.date && r.date.startsWith(monthStr)) {
                        // 家族共有フィルター
                        if (features.familyShare && filterOwnerVal !== 'all' && r.owner !== filterOwnerVal) {
                            return;
                        }
                        // カテゴリON/OFFフィルター
                        if (r.category && !this.selectedCategories.has(r.category)) {
                            return;
                        }

                        if (r.type === '収入') {
                            income += r.amount;
                        } else if (r.type === '支出' || r.type === 'サブスク') {
                            expense += r.amount;
                        } else if (r.type === '貯金') {
                            savingIn += r.amount;
                        } else if (r.type === '貯金出金') {
                            savingOut += r.amount;
                        }
                    }
                });

                incomeData.push(income);
                expenseData.push(expense);
                savingData.push(Math.max(0, savingIn - savingOut));
            }
        } else {
            // 直近5年の年別集計
            document.getElementById('monthlyChartTitle').textContent = '年別収支推移 (直近5ヶ年)';
            const currentYear = today.getFullYear();

            for (let i = 4; i >= 0; i--) {
                const y = currentYear - i;
                const yearStr = `${y}`;

                labels.push(`${y}年`);

                let income = 0;
                let expense = 0;
                let savingIn = 0;
                let savingOut = 0;

                records.forEach(r => {
                    if (r.date && r.date.startsWith(yearStr)) {
                        // 家族共有フィルター
                        if (features.familyShare && filterOwnerVal !== 'all' && r.owner !== filterOwnerVal) {
                            return;
                        }
                        // カテゴリON/OFFフィルター
                        if (r.category && !this.selectedCategories.has(r.category)) {
                            return;
                        }

                        if (r.type === '収入') {
                            income += r.amount;
                        } else if (r.type === '支出' || r.type === 'サブスク') {
                            expense += r.amount;
                        } else if (r.type === '貯金') {
                            savingIn += r.amount;
                        } else if (r.type === '貯金出金') {
                            savingOut += r.amount;
                        }
                    }
                });

                incomeData.push(income);
                expenseData.push(expense);
                savingData.push(Math.max(0, savingIn - savingOut));
            }
        }

        // 既存グラフの破棄
        if (this.monthlyChartInstance) {
            this.monthlyChartInstance.destroy();
        }

        // グラフ生成 (折れ線グラフで支出の推移を示すように変更する)
        // 開発ロードマップ第4段階「支出の推移（折れ線グラフ・月別）」
        this.monthlyChartInstance = new Chart(canvas, {
            type: 'line', // 折れ線グラフに設定
            data: {
                labels,
                datasets: [
                    {
                        label: '収入',
                        data: incomeData,
                        borderColor: '#2196f3',
                        backgroundColor: 'rgba(33, 150, 243, 0.1)',
                        borderWidth: 3,
                        tension: 0.3,
                        fill: true
                    },
                    {
                        label: '支出',
                        data: expenseData,
                        borderColor: '#f44336',
                        backgroundColor: 'rgba(244, 67, 54, 0.1)',
                        borderWidth: 3,
                        tension: 0.3,
                        fill: true
                    },
                    {
                        label: '貯金',
                        data: savingData,
                        borderColor: '#4caf50',
                        backgroundColor: 'rgba(76, 175, 80, 0.1)',
                        borderWidth: 3,
                        tension: 0.3,
                        fill: true
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: { font: { family: '"Noto Sans JP", sans-serif' } }
                    },
                    tooltip: {
                        callbacks: {
                            label: context => ` ${context.dataset.label}: ${new Intl.NumberFormat('ja-JP').format(context.parsed.y)} 円`
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: value => new Intl.NumberFormat('ja-JP').format(value) + ' 円'
                        }
                    }
                }
            }
        });
    },

    // カテゴリ別支出グラフ
    renderCategoryChart() {
        const canvas = document.getElementById('categoryChart');
        if (!canvas) return;

        const records = window.KakeiStorage ? window.KakeiStorage.loadRecords() : [];
        const features = window.KakeiSettingsManager ? window.KakeiSettingsManager.settings.features : { familyShare: false };
        // 分析タブの家族別フィルタを優先、なければ履歴タブの共用フィルタを参照
        const chartFilterOwnerEl2 = document.getElementById('chartFilterOwner');
        const filterOwnerEl2 = document.getElementById('filterOwner');
        const filterOwnerVal = (chartFilterOwnerEl2 ? chartFilterOwnerEl2.value : null)
            || (filterOwnerEl2 ? filterOwnerEl2.value : 'all');

        const today = new Date();
        const monthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

        // カテゴリ集計
        const categoryMap = {};
        records.forEach(r => {
            const isTargetPeriod = r.date && r.date.startsWith(monthStr);

            if (isTargetPeriod && (r.type === '支出' || r.type === 'サブスク')) {
                // 家族共有フィルター
                if (features.familyShare && filterOwnerVal !== 'all' && r.owner !== filterOwnerVal) {
                    return;
                }

                const cat = r.category || 'その他';

                // カテゴリON/OFFフィルター
                if (!this.selectedCategories.has(cat)) {
                    return;
                }

                categoryMap[cat] = (categoryMap[cat] || 0) + r.amount;
            }
        });

        const labels = Object.keys(categoryMap);
        const data = Object.values(categoryMap);

        if (this.categoryChartInstance) {
            this.categoryChartInstance.destroy();
        }

        const ctx = canvas.getContext('2d');
        if (labels.length === 0) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.font = '14px "Noto Sans JP", sans-serif';
            ctx.fillStyle = '#888';
            ctx.textAlign = 'center';
            ctx.fillText('今月の支出データがありません', canvas.width / 2, canvas.height / 2);
            return;
        }

        const backgroundColors = labels.map((cat, i) => {
            if (window.CategoryService) {
                return window.CategoryService.getCategoryInfo(cat).color;
            }
            const COLORS = [
                '#ff6384', '#ff9f40', '#ffcd56', '#4bc0c0', '#36a2eb',
                '#9966ff', '#c9cbcf', '#ff6347', '#3cb371', '#6495ed'
            ];
            return COLORS[i % COLORS.length];
        });

        // ドーナツ（円）か棒か
        const type = this.categoryChartType;

        this.categoryChartInstance = new Chart(canvas, {
            type: type,
            data: {
                labels,
                datasets: [{
                    label: '支出額',
                    data,
                    backgroundColor: backgroundColors,
                    borderWidth: 1,
                    borderRadius: type === 'bar' ? 6 : 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: type === 'doughnut' ? 'right' : 'top',
                        labels: { font: { family: '"Noto Sans JP", sans-serif' } }
                    },
                    tooltip: {
                        callbacks: {
                            label: context => {
                                const val = new Intl.NumberFormat('ja-JP').format(context.parsed);
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const pct = total > 0 ? ((context.parsed / total) * 100).toFixed(1) : 0;
                                return ` ${context.label}: ${val} 円 (${pct}%)`;
                            }
                        }
                    }
                },
                scales: type === 'bar' ? {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: value => new Intl.NumberFormat('ja-JP').format(value) + ' 円'
                        }
                    }
                } : {}
            }
        });
    }
};

window.KakeiChartManager = ChartManager;
