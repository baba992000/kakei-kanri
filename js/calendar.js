// カレンダー機能を管理するモジュール

const CalendarManager = {
    currentYear: null,
    currentMonth: null, // 0-indexed (0=January)

    // 初期化
    init() {
        const today = new Date();
        this.currentYear = today.getFullYear();
        this.currentMonth = today.getMonth();

        // カレンダーを描画
        this.renderCalendar();

        // 前月・翌月ボタンのイベント設定
        const prevBtn = document.getElementById('prevMonth');
        const nextBtn = document.getElementById('nextMonth');

        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                this.currentMonth--;
                if (this.currentMonth < 0) {
                    this.currentMonth = 11;
                    this.currentYear--;
                }
                this.renderCalendar();
            });
        }

        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                this.currentMonth++;
                if (this.currentMonth > 11) {
                    this.currentMonth = 0;
                    this.currentYear++;
                }
                this.renderCalendar();
            });
        }
    },

    // カレンダーの描画
    renderCalendar() {
        const year = this.currentYear;
        const month = this.currentMonth;

        // タイトル更新
        const monthTitle = document.getElementById('monthTitle');
        if (monthTitle) {
            monthTitle.textContent = `${year}年${month + 1}月`;
        }

        // レコードデータを読み込む
        const records = window.KakeiStorage ? window.KakeiStorage.loadRecords() : [];

        // 対象月のレコードを日付ごとに集計する
        const dailySummary = {};
        const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;

        // 機能選択状態の取得
        const features = window.KakeiSettingsManager ? window.KakeiSettingsManager.settings.features : { familyShare: false };
        const filterOwnerEl = document.getElementById('filterOwner');
        const filterOwnerVal = filterOwnerEl ? filterOwnerEl.value : 'all';

        records.forEach(record => {
            if (record.date && record.date.startsWith(monthStr)) {
                // 家族共有フィルターのチェック
                if (features.familyShare && filterOwnerVal !== 'all' && record.owner !== filterOwnerVal) {
                    return;
                }

                const day = parseInt(record.date.split('-')[2], 10);
                if (!dailySummary[day]) {
                    dailySummary[day] = { income: 0, expense: 0 };
                }
                if (record.type === '収入') {
                    dailySummary[day].income += record.amount;
                } else if (record.type === '支出' || record.type === 'サブスク') {
                    dailySummary[day].expense += record.amount;
                }
            }
        });

        // 今日
        const today = new Date();

        // 月初の曜日（0=日, 1=月, ...）
        const firstDayOfWeek = new Date(year, month, 1).getDay();
        // 月末の日
        const lastDay = new Date(year, month + 1, 0).getDate();

        const calendarBody = document.getElementById('calendarBody');
        if (!calendarBody) return;

        calendarBody.innerHTML = '';

        let dayCount = 1;
        let html = '';

        // 6週分まで描画
        for (let week = 0; week < 6; week++) {
            if (dayCount > lastDay) break;
            html += '<tr>';

            for (let dow = 0; dow < 7; dow++) {
                const cellIndex = week * 7 + dow;

                if (cellIndex < firstDayOfWeek || dayCount > lastDay) {
                    html += '<td class="cal-empty"></td>';
                } else {
                    const isToday =
                        today.getFullYear() === year &&
                        today.getMonth() === month &&
                        today.getDate() === dayCount;

                    const summary = dailySummary[dayCount];
                    let summaryHtml = '';

                    if (summary) {
                        const formatter = new Intl.NumberFormat('ja-JP');
                        if (summary.income > 0) {
                            summaryHtml += `<span class="cal-income">+${formatter.format(summary.income)}</span>`;
                        }
                        if (summary.expense > 0) {
                            summaryHtml += `<span class="cal-expense">-${formatter.format(summary.expense)}</span>`;
                        }
                    }

                    const todayClass = isToday ? ' cal-today' : '';
                    const dataDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayCount).padStart(2, '0')}`;

                    html += `<td class="cal-day${todayClass}" data-date="${dataDate}">
                        <span class="cal-day-num">${dayCount}</span>
                        <div class="cal-summary">${summaryHtml}</div>
                    </td>`;

                    dayCount++;
                }
            }
            html += '</tr>';
        }

        calendarBody.innerHTML = html;

        // 日付クリックでフォームの日付を自動入力
        calendarBody.querySelectorAll('td.cal-day').forEach(td => {
            td.addEventListener('click', () => {
                const dateInput = document.getElementById('date');
                if (dateInput && td.dataset.date) {
                    dateInput.value = td.dataset.date;
                }
                // クリックされた日のハイライト
                calendarBody.querySelectorAll('td.cal-selected').forEach(el => {
                    el.classList.remove('cal-selected');
                });
                td.classList.add('cal-selected');
            });
        });
    },

    // 外部から呼び出す再描画メソッド
    refreshCalendar() {
        this.renderCalendar();
    }
};

window.KakeiCalendarManager = CalendarManager;
