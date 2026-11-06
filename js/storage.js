// localStorageとのデータ連携を管理するオブジェクト

const STORAGE_KEY = 'kakei_records';
const SETTINGS_KEY = 'kakei_settings';

const DEFAULT_JOINT_SETTINGS = {
    accountName: '共同生活費口座',
    bankName: '住信SBIネット銀行',
    initialBalance: 150000,
    targetBudget: 200000,
    splitRule: 'ratio', // 'ratio' または 'fixed'
    myRatio: 50,
    partnerRatio: 50,
    myFixedAmount: 100000,
    partnerFixedAmount: 100000,
    lastSynced: null
};

const DEFAULT_SETTINGS = {
    theme: 'green', // 'green', 'blue', 'purple', 'mono'
    darkMode: false,
    fontSize: 'medium', // 'small', 'medium', 'large'
    features: {
        partTimeIncome: false,
        subscription: false,
        familyShare: false,
        fixedCost: false,
        pension: false,
        jointAccount: true // 共同口座連携（デフォルトON）
    },
    jointAccount: { ...DEFAULT_JOINT_SETTINGS }
};

const Storage = {
    // データをロード
    loadRecords() {
        try {
            const data = localStorage.getItem(STORAGE_KEY);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            console.error('データの読み込みに失敗しました:', e);
            return [];
        }
    },

    // データを保存
    saveRecords(records) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
            return true;
        } catch (e) {
            console.error('データの保存に失敗しました:', e);
            return false;
        }
    },

    // 設定をロード
    loadSettings() {
        try {
            const data = localStorage.getItem(SETTINGS_KEY);
            if (!data) return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
            const parsed = JSON.parse(data);
            return {
                ...DEFAULT_SETTINGS,
                ...parsed,
                features: { ...DEFAULT_SETTINGS.features, ...(parsed.features || {}) },
                jointAccount: { ...DEFAULT_JOINT_SETTINGS, ...(parsed.jointAccount || {}) }
            };
        } catch (e) {
            console.error('設定の読み込みに失敗しました:', e);
            return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
        }
    },

    // 設定を保存
    saveSettings(settings) {
        try {
            localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
            return true;
        } catch (e) {
            console.error('設定の保存に失敗しました:', e);
            return false;
        }
    }
};

// グローバルスコープに公開
window.KakeiStorage = Storage;

