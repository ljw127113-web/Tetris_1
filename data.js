// 游戏数据配置

// 表格1: 属性等级数值表
const ATTRIBUTE_LEVEL_TABLE = {
    1: { attack: 5, defense: 5, health: 70 },
    2: { attack: 10, defense: 10, health: 140 },
    3: { attack: 16, defense: 16, health: 224 },
    4: { attack: 24, defense: 24, health: 336 },
    5: { attack: 32, defense: 32, health: 448 },
    6: { attack: 40, defense: 40, health: 560 },
    7: { attack: 50, defense: 50, health: 700 },
    8: { attack: 60, defense: 60, health: 840 },
    9: { attack: 70, defense: 70, health: 980 },
    10: { attack: 80, defense: 80, health: 1120 }
};

// 二级属性出现概率和数值
const SECONDARY_ATTRIBUTE_CONFIG = {
    probability: {
        5: 0.01,  // 5级10%概率
        6: 0.03,
        7: 0.05,
        8: 0.06,
        9: 0.08,
        10: 0.1
    },
    values: {
        5: { min: 1, max: 2 },
        6: { min: 2, max: 4 },
        7: { min: 3, max: 6 },
        8: { min: 4, max: 8 },
        9: { min: 5, max: 10 },
        10: { min: 6, max: 12 }
    }
};

// 表格2: 特殊方块影响区域（坐标偏移）- 覆盖面积已减半
const SPECIAL_BLOCK_RANGE = {
    1: [[0, 0], [1, 0], [-1, 0]],  //   横向
    2: [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]],  // 减半：从3x3（9格）减为十字形（5格）
    3: [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [2, 0], [-2, 0]], // 减半：从5x5十字（13格）减为十字形（7格）
    4: [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [2, 0], [-2, 0], [0, 2], [0, -2]],  // 减半：从21格减为9格
    5: [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1], 
        [2, 0], [-2, 0], [0, 2], [0, -2]]  // 减半：从29格减为5x5十字（13格）
};

// 特殊方块加成数值（按等级）
const SPECIAL_BLOCK_BONUS = {
    1: 0.1,  // 10%加成
    2: 0.15,
    3: 0.2,
    4: 0.25,
    5: 0.3
};

// 表格3: 宝箱概率表
const GACHA_PROBABILITY = {
    low: {
        1: 0.75,   // 50%
        2: 0.2,  // 35%
        3: 0.05   // 15%
    },
    high: {
        2: 0.5,   // 40%
        3: 0.25,   // 30%
        4: 0.1,   // 20%
        5: 0.08,  // 9%
        special: 0.07  // 1%特殊方块
    }
};

// 俄罗斯方块形状定义（相对坐标）
const TETRIS_SHAPES = [
    // I型
    [[0, 0], [1, 0], [2, 0], [3, 0]],
    // O型
    [[0, 0], [1, 0], [0, 1], [1, 1]],
    // T型
    [[0, 0], [1, 0], [2, 0], [1, 1]],
    // S型
    [[1, 0], [2, 0], [0, 1], [1, 1]],
    // Z型
    [[0, 0], [1, 0], [1, 1], [2, 1]],
    // J型
    [[0, 0], [0, 1], [0, 2], [1, 2]],
    // L型
    [[1, 0], [1, 1], [1, 2], [0, 2]]
];

// 二级属性图标映射
const SECONDARY_ATTR_ICONS = {
    'crit': '⚡',           // 暴击率 - 闪电
    'anti-crit': '🛡',      // 抗暴击率 - 盾牌
    'dodge': '💨',          // 闪避率 - 风
    'anti-dodge': '🔒',     // 抗闪避率 - 锁
    'armor-pen': '⚔',      // 破甲率 - 交叉剑
    'anti-armor-pen': '🔰' // 抗破甲率 - 新手标志
};

// 二级属性名称映射
const SECONDARY_ATTR_NAMES = {
    'crit': '暴击率',
    'anti-crit': '抗暴击率',
    'dodge': '闪避率',
    'anti-dodge': '抗闪避率',
    'armor-pen': '破甲率',
    'anti-armor-pen': '抗破甲率'
};

// 一级属性名称映射
const PRIMARY_ATTR_NAMES = {
    'attack': '攻击',
    'defense': '防御',
    'health': '生命'
};

// 底板扩展规则（总等级 -> 格子数量）
const BOARD_EXPANSION_RULES = [
    { level: 15, count: 28 },
    { level: 30, count: 31 },
    { level: 45, count: 34 },
    { level: 60, count: 37 },
    { level: 75, count: 40 },
    { level: 90, count: 43 },
    { level: 105, count: 46 },
    { level: 120, count: 49 }
];

// 底板填满后的属性加成比例（1.5表示增加50%，即最终为150%）
let FULL_BOARD_BONUS = 1.5;

// 活跃天数奖励配置（每个角色每天固定奖励）
let ACTIVE_DAY_REWARDS = {
    '非R': { silverKeys: 15, goldKeys: 1 },
    '小R': { silverKeys: 20, goldKeys: 2 },
    '中R': { silverKeys: 25, goldKeys: 5 },
    '大R': { silverKeys: 30, goldKeys: 8 },
    '超R': { silverKeys: 30, goldKeys: 12 }
};

// 底板方案数量配置
let BOARD_SCHEME_COUNT = 3; // 默认3个方案

