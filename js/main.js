// アプリケーション全体のエントリーポイント

document.addEventListener('DOMContentLoaded', () => {
    console.log('家計管理アプリを起動します。');

    // 1. 設定管理の初期化（テーマやダークモードの即時適用）
    if (window.KakeiSettingsManager) {
        window.KakeiSettingsManager.init();
    }

    // 2. レコード管理の初期化
    if (window.KakeiRecordManager) {
        window.KakeiRecordManager.init();
    }

    // 3. カレンダーの初期化
    if (window.KakeiCalendarManager) {
        window.KakeiCalendarManager.init();
    }

    // 4. グラフの初期化
    if (window.KakeiChartManager) {
        window.KakeiChartManager.initCharts();
    }

    // 5. 音声管理モジュールの初期化
    if (window.KakeiSpeechManager) {
        window.KakeiSpeechManager.init();
    }

    // 6. 共同口座連携管理モジュールの初期化
    if (window.KakeiJointAccountManager) {
        window.KakeiJointAccountManager.init();
    }

    // 7. タブナビゲーションの切り替え制御
    initTabNavigation();

    // 8. Lucide Iconsの初期化
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
    }
});

// タブナビゲーション制御
function initTabNavigation() {
    const navButtons = document.querySelectorAll('.nav-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTabId = btn.dataset.tab;
            if (!targetTabId) return;

            // ボタンのアクティブ状態の更新
            navButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // コンテンツの切り替え
            tabContents.forEach(content => {
                if (content.id === targetTabId) {
                    content.classList.add('active');
                } else {
                    content.classList.remove('active');
                }
            });

            // タブ切り替え時のリフレッシュ（Chart.js やカレンダーの幅ずれ防止）
            if (targetTabId === 'tab-calendar' && window.KakeiCalendarManager) {
                window.KakeiCalendarManager.refreshCalendar();
            }
            if (targetTabId === 'tab-charts' && window.KakeiChartManager) {
                window.KakeiChartManager.refreshCharts();
            }
            if (targetTabId === 'tab-dashboard') {
                if (window.KakeiRecordManager) window.KakeiRecordManager.updateSummary();
                if (window.KakeiJointAccountManager) window.KakeiJointAccountManager.renderAll();
            }
            if (targetTabId === 'tab-joint' && window.KakeiJointAccountManager) {
                window.KakeiJointAccountManager.renderAll();
            }
        });
    });
}

