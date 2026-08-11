// ==========================================
// 📌 AthleSense 共通設定・定数ファイル (config.js)
// ==========================================

// 1. アプリ全体の共通定数とFirebase設定
const CONSTANTS = {
    // 🔗 Firebase接続情報
    FIREBASE_CONFIG: {
        apiKey: "AIzaSyAQoESOlZIGJfOgfIwpkL0r0YcYu4tl8ZQ",
        authDomain: "team-conditioning-controling.firebaseapp.com",
        projectId: "team-conditioning-controling",
        storageBucket: "team-conditioning-controling.firebasestorage.app",
        messagingSenderId: "330203393971",
        appId: "1:330203393971:web:f47b8e66137d0fce8b65c6"
    },
    
    // ⚖️ アラートや計算ロジックに使用する閾値（ACWR, Monotony, F-vなど）
    THRESHOLDS: { 
        HIGH_FATIGUE: 8,              // 疲労度アラート基準
        LOW_SLEEP_HOURS: 6,           // 睡眠不足アラート基準 (時間)
        LOW_SLEEP_QUALITY: 2,         // 睡眠の質低下アラート基準
        MONOTONY_WARNING: 2.0,        // ⚠️ 単調さ(Monotony)の警告基準
        ACWR_DANGER: 1.5,             // 🚨 急性・慢性負荷比率(ACWR)の危険基準
        ACWR_SWEET_SPOT_MIN: 0.8,     // ACWRの最適ゾーン(下限)
        ACWR_SWEET_SPOT_MAX: 1.3,     // ACWRの最適ゾーン(上限)
        FV_FORCE_DEFICIT: 2.15,       // F-vプロファイル：力不足基準
        FV_VELOCITY_DEFICIT: 1.95,    // F-vプロファイル：速度不足基準
        
        // ⚠️ 怪我リスクスコア (IRS: Injury Risk Score) 計算用の重み付け
        IRS_WEIGHTS: { 
            FATIGUE_SEVERE: { threshold: 8, score: 15 }, 
            FATIGUE_HIGH: { threshold: 6, score: 5 }, 
            STRESS_HIGH: { threshold: 8, score: 5 }, 
            SLEEP_SHORT: { threshold: 6, score: 10 }, 
            SLEEP_MED: { threshold: 7, score: 5 }, 
            QUALITY_LOW: { threshold: 2, score: 5 }, 
            LOAD_HIGH: { threshold: 600, score: 10 }, 
            RPE_HIGH: { threshold: 8, score: 10 }, 
            CRITICAL_PARTS: ['ハムストリングス', 'カーフ', 'アキレス腱', '腸腰筋', '大腿四頭筋', '腰'], 
            SORENESS_HAMSTRING: 20, 
            SORENESS_CALF_ACHILLES: 10, 
            SORENESS_QUAD_HIP_LOWER: 10, 
            SORENESS_OTHER: 3 
        }
    },
    
    // 🎨 グラフ描画用カラーパレット (管理者画面のChart.jsなどで使用)
    COLORS: { 
        CHART_LOAD: '#0ea5e9', 
        CHART_FATIGUE: '#8b5cf6', 
        TEXT_MUTED: '#6b7280', 
        GRID_LINE: '#e5e7eb' 
    },
    
    // 🛁 デフォルトのケア項目 (管理者がチーム設定を行っていない場合に使用)
    DEFAULT_CARES: [
        "🍚 栄養補給(30分以内)", 
        "🧊 アイシング", 
        "🛁 交代浴", 
        "🧘‍♂️ 静的ストレッチ", 
        "💆‍♂️ フォームローラー", 
        "✋ マッサージ/ガン", 
        "🧦 圧縮ウエア/挙上", 
        "💤 8時間以上の睡眠"
    ],
    
    // 📣 お知らせ・ブロードキャストの重要度レベル
    LEVELS: { 
        info: { bgClass: 'b-info', label: 'お知らせ' }, 
        warning: { bgClass: 'b-warning', label: '重要' }, 
        danger: { bgClass: 'b-danger', label: '緊急' } 
    }
};

// 2. Firebaseインスタンスのグローバル変数
// ※ index.js と admin.js の両方でアクセスできるようにここで定義しておきます。
let db = null; 
let colRefs = {};
