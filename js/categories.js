// カテゴリ定義とLucide Icons連携モジュール

const CATEGORY_ITEMS = [
    { id: 'saving_in', name: '貯金（入金）', icon: 'piggy-bank', color: '#16a34a', type: ['支出', '貯金'] },
    { id: 'subscription', name: 'サブスク（月額）', icon: 'repeat', color: '#8b5cf6', type: ['支出', 'サブスク'] },
    { id: 'housing', name: '住居費', icon: 'home', color: '#4f46e5', type: ['支出'] },
    { id: 'utilities', name: '水道光熱費', icon: 'droplets', color: '#0284c7', type: ['支出'] },
    { id: 'communication', name: '通信費', icon: 'smartphone', color: '#2563eb', type: ['支出'] },
    { id: 'transport', name: '交通費', icon: 'train', color: '#b45309', type: ['支出'] },
    { id: 'medical', name: '医療費', icon: 'pill', color: '#06b6d4', type: ['支出'] },
    { id: 'entertainment', name: '娯楽費', icon: 'party-popper', color: '#eab308', type: ['支出'] },
    { id: 'food', name: '食費', icon: 'utensils', color: '#f97316', type: ['支出'] },
    { id: 'daily', name: '日用品', icon: 'shopping-bag', color: '#10b981', type: ['支出'] },
    { id: 'insurance', name: '保険料', icon: 'shield-check', color: '#059669', type: ['支出'] },
    { id: 'allowance', name: '仕送り', icon: 'heart-handshake', color: '#ec4899', type: ['支出'] },
    { id: 'car', name: '車両費', icon: 'car', color: '#0ea5e9', type: ['支出'] },
    { id: 'education', name: '教育費', icon: 'book-open', color: '#ef4444', type: ['支出'] },
    { id: 'beauty_clothes', name: '衣服・美容費', icon: 'shirt', color: '#6366f1', type: ['支出'] },
    { id: 'special', name: '特別費', icon: 'star', color: '#f59e0b', type: ['支出'] },
    { id: 'travel', name: '旅行費', icon: 'plane', color: '#0d9488', type: ['支出'] },
    { id: 'tax', name: '税金・社会保険料', icon: 'receipt', color: '#64748b', type: ['支出'] },
    { id: 'charge', name: 'チャージ', icon: 'credit-card', color: '#9333ea', type: ['支出'] },
    { id: 'charge_transfer', name: 'チャージ振替', icon: 'arrow-left-right', color: '#3b82f6', type: ['支出'] },

    // 収入用カテゴリ
    { id: 'salary', name: '給与', icon: 'banknote', color: '#10b981', type: ['収入'] },
    { id: 'part_time', name: 'アルバイト', icon: 'briefcase', color: '#06b6d4', type: ['収入'] },

    // 貯金内訳用カテゴリ
    { id: 'deposit_normal', name: '普通預金', icon: 'wallet', color: '#3b82f6', type: ['貯金', '貯金出金'] },
    { id: 'deposit_fixed', name: '定期預金', icon: 'calendar-clock', color: '#8b5cf6', type: ['貯金', '貯金出金'] },
    { id: 'deposit_invest', name: '長期積立', icon: 'trending-up', color: '#14b8a6', type: ['貯金', '貯金出金'] },
    { id: 'deposit_pension', name: '年金保険', icon: 'shield', color: '#9c27b0', type: ['支出', '貯金'] },

    // 後方互換・共通・別名
    { id: 'beauty_clothes_alt', name: '服飾・美容費', icon: 'shirt', color: '#6366f1', type: ['支出'] },
    { id: 'food_alt', name: '飲食費', icon: 'utensils', color: '#f97316', type: ['支出'] },
    { id: 'charge_alt', name: '現金チャージ', icon: 'credit-card', color: '#9333ea', type: ['支出'] },
    { id: 'charge_transfer_alt', name: '振替チャージ', icon: 'arrow-left-right', color: '#3b82f6', type: ['支出'] },
    { id: 'subscription_alt', name: 'サブスク', icon: 'repeat', color: '#8b5cf6', type: ['支出', 'サブスク'] },
    { id: 'pension_alt', name: '年金', icon: 'shield', color: '#9c27b0', type: ['支出'] },
    { id: 'rent_old', name: '家賃', icon: 'home', color: '#4f46e5', type: ['支出'] },
    { id: 'utilities_old', name: '光熱費', icon: 'zap', color: '#0284c7', type: ['支出'] },
    { id: 'other', name: 'その他', icon: 'more-horizontal', color: '#94a3b8', type: ['収入', '支出', '貯金', '貯金出金', 'サブスク'] }
];

// カテゴリ名マップ
const CATEGORY_MAP = {};
CATEGORY_ITEMS.forEach(item => {
    CATEGORY_MAP[item.name] = item;
});

// デフォルトの標準カテゴリ（22カテゴリ）
const DEFAULT_EXPENSE_CATEGORIES = [
    '貯金（入金）', '現金チャージ', '振替チャージ', '飲食費', '日用品',
    '交通費', '服飾・美容費', '医療費', '娯楽費', '車両費',
    '旅行費', '特別費', '住居費', '水道光熱費', '通信費',
    'サブスク', '教育費', '仕送り', '年金保険', '保険料',
    '税金・社会保険料', 'その他'
];

const CategoryService = {
    getAllExpenseCategories() {
        return [...DEFAULT_EXPENSE_CATEGORIES];
    },

    getCategoryInfo(name) {
        if (CATEGORY_MAP[name]) {
            return CATEGORY_MAP[name];
        }
        // 未知カテゴリのフォールバック
        return {
            id: 'custom',
            name: name,
            icon: 'tag',
            color: '#64748b'
        };
    },

    // カテゴリのアイコンSVG文字列を生成する
    getIconSvg(categoryName, size = 20, customColor = null) {
        const info = this.getCategoryInfo(categoryName);
        const color = customColor || info.color || 'currentColor';
        const iconName = info.icon || 'tag';

        if (window.lucide && window.lucide.icons && window.lucide.icons[iconName]) {
            try {
                return window.lucide.icons[iconName].toSvg({
                    size: size,
                    color: color,
                    'stroke-width': 2
                });
            } catch (e) {
                console.warn('Lucide icon rendering failed:', e);
            }
        }

        // フォールバック（lucide.createIcons用のiタグ）
        return `<i data-lucide="${iconName}" style="width:${size}px; height:${size}px; color:${color}; stroke-width: 2;"></i>`;
    },

    // アイコン付きバッジHTMLを生成する（テーブルやランキング等で使用）
    getCategoryBadge(categoryName, options = {}) {
        const info = this.getCategoryInfo(categoryName);
        const iconSvg = this.getIconSvg(categoryName, options.size || 16);
        const extraClass = options.className || '';
        return `
            <span class="category-badge-chip ${extraClass}">
                <span class="category-badge-icon" style="color: ${info.color};">${iconSvg}</span>
                <span class="category-badge-name">${escapeHTML ? escapeHTML(categoryName) : categoryName}</span>
            </span>
        `;
    },

    // 区分に応じたカテゴリリストの取得
    getCategoriesForType(type, features = {}) {
        if (type === '収入') {
            const list = ['給与'];
            if (features.partTimeIncome) {
                list.push('アルバイト');
            }
            list.push('その他');
            return list;
        }

        if (type === '貯金' || type === '貯金出金') {
            const list = ['貯金（入金）', '普通預金', '定期預金'];
            if (features.pension) {
                list.push('長期積立');
            }
            list.push('その他');
            return list;
        }

        if (type === 'サブスク') {
            return ['サブスク（月額）', '通信費', '娯楽費', '住居費', 'その他'];
        }

        // 支出の場合（標準カテゴリ + その他）
        const list = [...DEFAULT_EXPENSE_CATEGORIES];
        if (!list.includes('その他')) {
            list.push('その他');
        }
        return list;
    }
};

window.CategoryService = CategoryService;
