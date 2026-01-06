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
// 每个等级可以有多个区域方案，每个方案是一个坐标数组
// 特殊方块生成时会从该等级的所有方案中随机选择一个
let SPECIAL_BLOCK_RANGE = {
    1: [
        [[0, 0], [1, 0], [-1, 0]],  // 方案1：横向
        [[0, 0], [0, 1], [0, -1]]   // 方案2：纵向
    ],
    2: [
        [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]  // 方案1：十字形（5格）
    ],
    3: [
        [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [2, 0], [-2, 0]]  // 方案1：十字形（7格）
    ],
    4: [
        [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [2, 0], [-2, 0], [0, 2], [0, -2]]  // 方案1：十字形（9格）
    ],
    5: [
        [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1], 
         [2, 0], [-2, 0], [0, 2], [0, -2]]  // 方案1：十字形（13格）
    ]
};

// 特殊方块加成数值（按等级）
const SPECIAL_BLOCK_BONUS = {
    1: 0.2,  // 10%加成
    2: 0.4,
    3: 0.6,
    4: 0.8,
    5: 1.0,
    6: 1.2,
    7: 1.4,
    8: 1.6,
    9: 1.8,
    10: 2.0
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
        3: 0.3,   // 30%
        4: 0.1,   // 20%
        5: 0.06,  // 9%
        special: 0.04  // 1%特殊方块
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

// 底板扩展规则（总等级 -> 格子数量）- 已废弃，改用 BOARD_LEVEL_EXPANSION
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

// 底板等级扩展配置（底板等级 -> 增加的格子数量）
let BOARD_LEVEL_EXPANSION = [
    { level: 1, cellIncrease: 3 },   // 底板等级1时，增加3格（从25到28）
    { level: 2, cellIncrease: 3 },   // 底板等级2时，再增加3格（从28到31）
    { level: 3, cellIncrease: 3 },   // 底板等级3时，再增加3格（从31到34）
    { level: 4, cellIncrease: 3 },   // 底板等级4时，再增加3格（从34到37）
    { level: 5, cellIncrease: 3 },   // 底板等级5时，再增加3格（从37到40）
    { level: 6, cellIncrease: 3 },   // 底板等级6时，再增加3格（从40到43）
    { level: 7, cellIncrease: 3 },   // 底板等级7时，再增加3格（从43到46）
    { level: 8, cellIncrease: 3 }    // 底板等级8时，再增加3格（从46到49）
];

// 底板等级经验需求配置（等级 -> 所需积分经验）
let BOARD_LEVEL_EXP_REQUIREMENTS = [
    { level: 1, expRequired: 200 },   // 从0级升级到1级需要100经验
    { level: 2, expRequired: 500 },   // 从1级升级到2级需要200经验
    { level: 3, expRequired: 1000 },   // 从2级升级到3级需要300经验
    { level: 4, expRequired: 3000 },   // 从3级升级到4级需要400经验
    { level: 5, expRequired: 6000 },   // 从4级升级到5级需要500经验
    { level: 6, expRequired: 10000 },   // 从5级升级到6级需要600经验
    { level: 7, expRequired: 20000 },   // 从6级升级到7级需要700经验
    { level: 8, expRequired: 40000 }    // 从7级升级到8级需要800经验
];

// 宝箱经验奖励配置
let CHEST_EXP_REWARDS = {
    low: 2,   // 低级宝箱开启一次获得10经验
    high: 5   // 高级宝箱开启一次获得50经验
};

// 洗练等级要求配置
let REFINE_LEVEL_REQUIREMENT = 5; // 只有此等级及以上的方块才能洗练

// 底板填满后的属性加成比例（1.5表示增加50%，即最终为150%）
let FULL_BOARD_BONUS = 1.5;

// 活跃天数奖励配置（每个角色每天固定奖励）
let ACTIVE_DAY_REWARDS = {
    '非R': { silverKeys: 15, goldKeys: 1 },
    '小R': { silverKeys: 20, goldKeys: 2 },
    '中R': { silverKeys: 25, goldKeys: 3 },
    '大R': { silverKeys: 30, goldKeys: 5 },
    '超R': { silverKeys: 30, goldKeys: 8 }
};

// 角色头像配置（风格统一的角色头像）
const PLAYER_ROLE_AVATARS = {
    '非R': '🟢',  // 绿色圆形 - 基础角色
    '小R': '🟡',  // 黄色圆形 - 小R角色
    '中R': '🟠',  // 橙色圆形 - 中R角色
    '大R': '🔴',  // 红色圆形 - 大R角色
    '超R': '🟣'   // 紫色圆形 - 超R角色
};

// 底板方案数量配置
let BOARD_SCHEME_COUNT = 3; // 默认3个方案

// 方块形状名称映射（用于显示）
const SHAPE_NAMES = ['I型', 'O型', 'T型', 'S型', 'Z型', 'J型', 'L型'];

// 可用方块组合配置（形状+旋转的组合，用于宝箱生成）
// 默认只包含基本形状（rotation=0），其他角度从宝箱中删除
let AVAILABLE_BLOCK_COMBINATIONS = [];
// 初始化所有可能的组合（但只有rotation=0的默认启用）
(function initBlockCombinations() {
    AVAILABLE_BLOCK_COMBINATIONS = [];
    for (let shape = 0; shape < TETRIS_SHAPES.length; shape++) {
        for (let rotation of [0, 90, 180, 270]) {
            AVAILABLE_BLOCK_COMBINATIONS.push({
                shape: shape,
                rotation: rotation,
                enabled: rotation === 0  // 只有0度旋转默认启用，其他角度默认禁用
            });
        }
    }
})();

