// 主应用逻辑

let gameBoards = []; // 多个方案的游戏板
let currentSchemeIndex = 0; // 当前方案索引
let playerInventory = []; // 玩家拥有的方块
let blockUsageMap = new Map(); // 方块使用情况：blockId -> Set(schemeIndex)
let attributeCalculators = []; // 每个方案的属性计算器
let previousAttributes = {};
let dragBlock = null;
let dragOffset = { x: 0, y: 0 };
let selectedBlock = null; // 当前选中的方块（用于旋转）
let rotationControlPanel = null; // 旋转控制面板
let gachaCounts = { low: 0, high: 0 }; // 宝箱开启次数统计
let silverKeys = 10; // 银色钥匙数量（初始10个）
let goldKeys = 1; // 金色钥匙数量（初始1个）
let activeDays = 0; // 活跃天数（从0天开始）
let playerRole = '非R'; // 玩家角色：非R、小R、中R、大R、超R
let reachedExpansionLevels = new Set(); // 已完成的扩展等级（全局，首次达到某个等级要求时标记为完成）
let refineCount = 0; // 累计洗练次数
let boardLevel = 0; // 底板等级（从0级开始）
let boardExp = 0; // 底板积分经验

// 版本号管理 - 自动递增系统
// 版本号基于代码内容自动检测变化并递增

// 简单的字符串hash函数
function simpleHash(str) {
    let hash = 0;
    if (!str) return '0';
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // 转换为32位整数
    }
    return Math.abs(hash).toString(36); // 转换为36进制字符串
}

// 获取当前代码的签名hash
// 通过检查关键函数和代码特征来生成唯一标识
function getCodeSignatureHash() {
    try {
        // 收集关键代码特征来生成hash
        let codeFeatures = '';
        
        // 1. 关键配置值（从data.js中）- 这些是代码的核心部分
        if (typeof BOARD_EXPANSION_RULES !== 'undefined') {
            codeFeatures += JSON.stringify(BOARD_EXPANSION_RULES);
        }
        if (typeof ACTIVE_DAY_REWARDS !== 'undefined') {
            codeFeatures += JSON.stringify(ACTIVE_DAY_REWARDS);
        }
        if (typeof GACHA_PROBABILITY !== 'undefined') {
            codeFeatures += JSON.stringify(GACHA_PROBABILITY);
        }
        if (typeof ATTRIBUTE_LEVEL_TABLE !== 'undefined') {
            codeFeatures += JSON.stringify(ATTRIBUTE_LEVEL_TABLE);
        }
        
        // 2. 关键类的关键方法签名（取前一部分以避免过大）
        if (typeof GameBoard !== 'undefined' && GameBoard.prototype) {
            const methods = ['expandCells', 'getTotalLevel', 'placeBlock'];
            methods.forEach(method => {
                if (GameBoard.prototype[method]) {
                    codeFeatures += GameBoard.prototype[method].toString().substring(0, 200);
                }
            });
        }
        if (typeof Block !== 'undefined' && Block.prototype) {
            const methods = ['generateAttributes', 'getRange'];
            methods.forEach(method => {
                if (Block.prototype[method]) {
                    codeFeatures += Block.prototype[method].toString().substring(0, 200);
                }
            });
        }
        
        // 3. 关键全局函数（不包括版本号相关函数，避免循环）
        if (typeof updateAttributeDisplay === 'function') {
            codeFeatures += updateAttributeDisplay.toString().substring(0, 300);
        }
        if (typeof openChest === 'function') {
            codeFeatures += openChest.toString().substring(0, 300);
        }
        
        // 4. 脚本文件的信息
        const scripts = Array.from(document.querySelectorAll('script[src]'));
        const scriptSources = scripts.map(s => {
            const src = s.getAttribute('src');
            return src ? src.split('/').pop() : '';
        }).sort().join('|');
        codeFeatures += scriptSources;
        
        return simpleHash(codeFeatures);
    } catch (e) {
        console.warn('生成代码hash失败，使用fallback:', e);
        // fallback: 返回一个固定值，这样不会导致每次刷新都变化
        return simpleHash('code-signature-fallback');
    }
}

// 版本号管理函数
function initializeVersion() {
    const VERSION_STORAGE_KEY = 'tetris_game_version';
    const CODE_HASH_STORAGE_KEY = 'tetris_code_hash';
    const VERSION_RESET_FLAG = 'tetris_version_reset_done';
    
    // 检查是否需要重置版本号（首次运行或版本号系统更新）
    const resetDone = localStorage.getItem(VERSION_RESET_FLAG);
    if (!resetDone) {
        // 首次运行或版本号系统更新，重置为1.0.0
        localStorage.setItem(VERSION_STORAGE_KEY, '1.0.0');
        localStorage.removeItem(CODE_HASH_STORAGE_KEY);
        localStorage.setItem(VERSION_RESET_FLAG, 'true');
        console.log('版本号系统已重置，初始版本号: 1.0.0');
    }
    
    // 从localStorage读取当前版本号
    let currentVersion = localStorage.getItem(VERSION_STORAGE_KEY);
    if (!currentVersion) {
        // 如果版本号不存在，初始化为1.0.0
        currentVersion = '1.0.0';
        localStorage.setItem(VERSION_STORAGE_KEY, currentVersion);
    }
    
    // 获取当前代码签名hash（延迟执行以确保所有脚本已加载）
    // 使用setTimeout确保在DOM和所有脚本加载完成后执行
    setTimeout(() => {
        try {
            const currentCodeHash = getCodeSignatureHash();
            const lastCodeHash = localStorage.getItem(CODE_HASH_STORAGE_KEY);
            
            // 如果代码hash变化了（且不是首次加载），版本号最后一位+1
            if (lastCodeHash && lastCodeHash !== currentCodeHash) {
                const versionParts = currentVersion.split('.');
                if (versionParts.length === 3) {
                    const lastDigit = parseInt(versionParts[2]) || 0;
                    versionParts[2] = (lastDigit + 1).toString();
                    const newVersion = versionParts.join('.');
                    localStorage.setItem(VERSION_STORAGE_KEY, newVersion);
                    currentVersion = newVersion;
                    console.log('检测到代码变化，版本号已自动更新:', newVersion);
                    
                    // 更新显示
                    const display = document.getElementById('version-display');
                    if (display) {
                        display.textContent = `版本号: ${newVersion}`;
                    }
                }
            }
            
            // 保存当前代码hash
            localStorage.setItem(CODE_HASH_STORAGE_KEY, currentCodeHash);
        } catch (e) {
            console.warn('版本号检测失败:', e);
        }
    }, 100); // 延迟100ms确保所有脚本加载完成
    
    return currentVersion;
}

// 获取版本号（同步版本，用于显示）
function getVersion() {
    const VERSION_STORAGE_KEY = 'tetris_game_version';
    const version = localStorage.getItem(VERSION_STORAGE_KEY);
    return version || '1.0.0';
}

// 更新版本号显示
function updateVersionDisplay() {
    const display = document.getElementById('version-display');
    if (display) {
        // 初始化并获取版本号
        const version = initializeVersion();
        display.textContent = `版本号: ${version}`;
        console.log('版本号显示已更新:', version);
    } else {
        console.warn('版本号显示元素未找到');
    }
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    // 先加载配置，获取方案数量
    loadConfigData();
    
    // 初始化多个方案
    initializeGameBoards();
    
    initializeNavigation();
    initializeBoard();
    initializeGacha();
    initializeUpgrade();
    initializeClearBoard();
    initializeConfigPage();
    updateVersionDisplay(); // 初始化版本号显示
    updateAttributeDisplay();
    
    // 加载保存的数据
    loadGameData();
    loadGachaCounts();
    updateGachaCounts();
    updateSilverKeysDisplay();
    updateGoldKeysDisplay();
    updateActiveDaysDisplay();
    updatePlayerRoleDisplay();
    updateExpansionProgressDisplay();
});

// 初始化多个游戏板方案
function initializeGameBoards() {
    const schemeCount = BOARD_SCHEME_COUNT || 3;
    gameBoards = [];
    attributeCalculators = [];
    
    for (let i = 0; i < schemeCount; i++) {
        const board = new GameBoard();
        gameBoards.push(board);
        attributeCalculators.push(new AttributeCalculator(board));
    }
    
    currentSchemeIndex = 0;
}

// 获取当前方案的游戏板
function getCurrentGameBoard() {
    return gameBoards[currentSchemeIndex];
}

// 获取当前方案的属性计算器
function getCurrentAttributeCalculator() {
    return attributeCalculators[currentSchemeIndex];
}

// 导航切换
function initializeNavigation() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const page = btn.dataset.page;
            document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(`${page}-page`).classList.add('active');
            
            if (page === 'board') {
                renderBoard();
                renderInventory();
            } else if (page === 'upgrade') {
                renderUpgradeInventory();
            } else if (page === 'config') {
                renderConfigPage();
            } else if (page === 'gacha') {
                // 切换到获取方块页面时，更新钥匙和活跃天数显示
                updateSilverKeysDisplay();
                updateGoldKeysDisplay();
                updateActiveDaysDisplay();
            }
        });
    });
}

// 初始化底板
function initializeBoard() {
    initializeSchemeSelector();
    renderBoard();
    setupDragAndDrop();
}

// 初始化方案选择器
function initializeSchemeSelector() {
    const selector = document.getElementById('scheme-select');
    if (!selector) return;
    
    selector.innerHTML = '';
    for (let i = 0; i < gameBoards.length; i++) {
        const option = document.createElement('option');
        option.value = i;
        option.textContent = `方案 ${i + 1}`;
        if (i === currentSchemeIndex) {
            option.selected = true;
        }
        selector.appendChild(option);
    }
    
    selector.addEventListener('change', (e) => {
        currentSchemeIndex = parseInt(e.target.value);
        renderBoard();
        renderInventory();
        updateAttributeDisplay();
        saveGameData();
    });
}

// 渲染底板
function renderBoard() {
    const board = document.getElementById('game-board');
    board.innerHTML = '';
    board.classList.remove('full');
    
    const gameBoard = getCurrentGameBoard();
    const coords = gameBoard.getAllCellCoords();
    const minX = Math.min(...coords.map(c => c.x));
    const maxX = Math.max(...coords.map(c => c.x));
    const minY = Math.min(...coords.map(c => c.y));
    const maxY = Math.max(...coords.map(c => c.y));
    
    const width = (maxX - minX + 1) * gameBoard.cellSize;
    const height = (maxY - minY + 1) * gameBoard.cellSize;
    board.style.width = width + 'px';
    board.style.height = height + 'px';
    
    // 先创建所有格子
    const cellMap = new Map();
    coords.forEach(({ x, y, key }) => {
        const cell = document.createElement('div');
        cell.className = 'board-cell';
        cell.dataset.x = x;
        cell.dataset.y = y;
        
        const screenX = (x - minX) * gameBoard.cellSize;
        const screenY = (y - minY) * gameBoard.cellSize;
        cell.style.left = screenX + 'px';
        cell.style.top = screenY + 'px';
        cell.style.width = gameBoard.cellSize + 'px';
        cell.style.height = gameBoard.cellSize + 'px';
        
        const block = gameBoard.cells.get(key);
        if (block) {
            cell.classList.add('filled');
        }
        
        cellMap.set(key, cell);
        board.appendChild(cell);
    });
    
    // 渲染方块（每个方块只渲染一次）
    const renderedBlocks = new Set();
    coords.forEach(({ x, y, key }) => {
        const block = gameBoard.cells.get(key);
        if (block && !renderedBlocks.has(block.id)) {
            renderedBlocks.add(block.id);
            // 找到方块的主位置（baseX, baseY）
            const blockData = [...gameBoard.blocks, ...gameBoard.specialBlocks].find(b => b.block === block);
            if (blockData) {
                // 直接渲染，不需要传入 container
                renderBlockOnBoard(block, blockData.x, blockData.y, null, minX, minY);
            }
        }
    });
    
    // 渲染特殊方块加成箭头
    renderBonusArrows();
    
    // 检查是否全满
    if (gameBoard.isFull()) {
        board.classList.add('full');
    }
}

// 在底板上渲染方块
function renderBlockOnBoard(block, baseX, baseY, container, boardMinX, boardMinY) {
    const gameBoard = getCurrentGameBoard(); // 获取当前方案的游戏板
    
    const positions = block.getPositions(baseX, baseY);
    const minX = Math.min(...positions.map(([x]) => x));
    const minY = Math.min(...positions.map(([, y]) => y));
    const maxX = Math.max(...positions.map(([x]) => x));
    const maxY = Math.max(...positions.map(([, y]) => y));
    
    // 调试日志已移除（避免拖动时频繁输出）
    
    // 创建方块容器，覆盖整个方块区域
    // 方块容器直接添加到 board，位置相对于 board 的内容区域（不包括padding）
    const board = document.getElementById('game-board');
    const blockContainer = document.createElement('div');
    blockContainer.className = 'board-block';
    blockContainer.dataset.blockId = block.id;
    blockContainer.style.position = 'absolute';
    // 方块位置相对于 board 的内容区域，格子的位置也是相对于内容区域的
    // 所以不需要加padding，因为格子的位置已经是在内容区域内的
    blockContainer.style.left = (minX - boardMinX) * gameBoard.cellSize + 'px';
    blockContainer.style.top = (minY - boardMinY) * gameBoard.cellSize + 'px';
    blockContainer.style.width = (maxX - minX + 1) * gameBoard.cellSize + 'px';
    blockContainer.style.height = (maxY - minY + 1) * gameBoard.cellSize + 'px';
    blockContainer.style.cursor = 'move';
    blockContainer.style.zIndex = '10';
    
    if (block.isSpecial) {
        const specialEl = document.createElement('div');
        specialEl.className = 'special-block';
        specialEl.textContent = block.level;
        specialEl.style.width = '100%';
        specialEl.style.height = '100%';
        blockContainer.appendChild(specialEl);
        
        // 为特殊方块添加悬停提示
        blockContainer.addEventListener('mouseenter', (e) => {
            showTooltip(e.target, block);
        });
        blockContainer.addEventListener('mouseleave', () => {
            hideTooltip();
        });
    } else {
        // 直接使用cells中的坐标（已经是归一化的）
        block.cells.forEach((cell, index) => {
            const cellEl = document.createElement('div');
            cellEl.className = `block-cell ${cell.primaryAttr}`;
            cellEl.style.position = 'absolute';
            // 使用cell中存储的相对坐标（相对于方块容器）
            cellEl.style.left = cell.x * gameBoard.cellSize + 'px';
            cellEl.style.top = cell.y * gameBoard.cellSize + 'px';
            cellEl.style.width = gameBoard.cellSize + 'px';
            cellEl.style.height = gameBoard.cellSize + 'px';
            
            if (cell.secondaryAttr) {
                const icon = document.createElement('div');
                icon.className = 'secondary-attr-icon';
                icon.textContent = SECONDARY_ATTR_ICONS[cell.secondaryAttr];
                cellEl.appendChild(icon);
            }
            
            blockContainer.appendChild(cellEl);
        });
        
        // 移除等级显示（放入底板的方块不显示等级）
        // const levelEl = document.createElement('div');
        // levelEl.className = 'block-level';
        // levelEl.textContent = block.level;
        // blockContainer.appendChild(levelEl);
        
        // 为普通方块也添加悬停提示
        blockContainer.addEventListener('mouseenter', (e) => {
            showTooltip(e.target, block);
        });
        blockContainer.addEventListener('mouseleave', () => {
            hideTooltip();
        });
    }
    
    // 直接添加到 board，而不是添加到 container（格子）
    board.appendChild(blockContainer);
}

// 渲染加成箭头
function renderBonusArrows() {
    const board = document.getElementById('game-board');
    const existingArrows = board.querySelectorAll('.bonus-arrow');
    existingArrows.forEach(arrow => arrow.remove());
    
    // 移除之前的加成范围高亮
    board.querySelectorAll('.bonus-range-highlight').forEach(el => el.remove());
    
    const gameBoard = getCurrentGameBoard();
    gameBoard.specialBlocks.forEach(({ block, x, y }) => {
        const range = block.getRange();
        if (!range || !Array.isArray(range)) {
            console.error('无法获取特殊方块加成区域:', block);
            return;
        }
        const coords = gameBoard.getAllCellCoords();
        const minX = Math.min(...coords.map(c => c.x));
        const minY = Math.min(...coords.map(c => c.y));
        
        range.forEach(([dx, dy]) => {
            const targetX = x + dx;
            const targetY = y + dy;
            const key = `${targetX},${targetY}`;
            const targetBlock = gameBoard.cells.get(key);
            
            if (targetBlock && !targetBlock.isSpecial) {
                // 添加箭头
                const arrow = document.createElement('div');
                arrow.className = 'bonus-arrow';
                arrow.textContent = '↑';
                const screenX = (targetX - minX) * gameBoard.cellSize + gameBoard.cellSize / 2;
                const screenY = (targetY - minY) * gameBoard.cellSize;
                arrow.style.left = screenX + 'px';
                arrow.style.top = screenY + 'px';
                board.appendChild(arrow);
                
                // 添加加成范围高亮
                const highlight = document.createElement('div');
                highlight.className = 'bonus-range-highlight';
                highlight.style.position = 'absolute';
                highlight.style.left = (targetX - minX) * gameBoard.cellSize + 'px';
                highlight.style.top = (targetY - minY) * gameBoard.cellSize + 'px';
                highlight.style.width = gameBoard.cellSize + 'px';
                highlight.style.height = gameBoard.cellSize + 'px';
                highlight.style.pointerEvents = 'none';
                highlight.style.zIndex = '8';
                board.appendChild(highlight);
            }
        });
    });
}

// 渲染背包
function renderInventory() {
    const inventory = document.getElementById('inventory');
    inventory.innerHTML = '';
    
    // 排序：特殊方块在前，等级高的在前
    const sorted = [...playerInventory].sort((a, b) => {
        if (a.isSpecial !== b.isSpecial) {
            return a.isSpecial ? -1 : 1;
        }
        return b.level - a.level;
    });
    
    sorted.forEach(block => {
        const blockEl = createBlockElement(block);
        // 使用状态已在 createBlockElement 中处理
        inventory.appendChild(blockEl);
    });
}

// 创建方块元素
function createBlockElement(block) {
    const container = document.createElement('div');
    container.className = 'block';
    container.dataset.blockId = block.id;
    
    // 检查方块使用状态并添加标识
    const usage = blockUsageMap.get(block.id);
    if (usage && usage.size > 0) {
        if (usage.has(currentSchemeIndex)) {
            // 在当前方案中使用 - 添加 in-use 类以禁用拖动
            container.classList.add('in-use');
            const indicator = document.createElement('div');
            indicator.className = 'block-usage-indicator current';
            indicator.title = '在当前方案中使用，无法拖动';
            container.appendChild(indicator);
        } else {
            // 在其他方案中使用 - 不添加 in-use 类，因为可以在当前方案中使用
            const indicator = document.createElement('div');
            indicator.className = 'block-usage-indicator other';
            indicator.title = '在其他方案中使用';
            container.appendChild(indicator);
        }
    }
    
    if (block.isSpecial) {
        const specialEl = document.createElement('div');
        specialEl.className = 'special-block';
        specialEl.textContent = block.level;
        container.appendChild(specialEl);
        
        // 为特殊方块添加悬停提示（图形化）
        container.addEventListener('mouseenter', (e) => {
            showSpecialBlockTooltip(e.target, block);
        });
        container.addEventListener('mouseleave', () => {
            hideTooltip();
        });
    } else {
        const grid = document.createElement('div');
        grid.className = 'block-grid';
        
        const positions = block.getPositions(0, 0);
        const minX = Math.min(...positions.map(([x]) => x));
        const minY = Math.min(...positions.map(([, y]) => y));
        const maxX = Math.max(...positions.map(([x]) => x));
        const maxY = Math.max(...positions.map(([, y]) => y));
        
        grid.style.gridTemplateColumns = `repeat(${maxX - minX + 1}, 20px)`;
        grid.style.gridTemplateRows = `repeat(${maxY - minY + 1}, 20px)`;
        
        block.cells.forEach(cell => {
            const cellEl = document.createElement('div');
            cellEl.className = `block-cell ${cell.primaryAttr}`;
            cellEl.style.gridColumn = (cell.x - minX + 1);
            cellEl.style.gridRow = (cell.y - minY + 1);
            
            if (cell.secondaryAttr) {
                const icon = document.createElement('div');
                icon.className = 'secondary-attr-icon';
                icon.textContent = SECONDARY_ATTR_ICONS[cell.secondaryAttr];
                cellEl.appendChild(icon);
            }
            
            grid.appendChild(cellEl);
        });
        
        container.appendChild(grid);
        
        const levelEl = document.createElement('div');
        levelEl.className = 'block-level';
        levelEl.textContent = block.level;
        container.appendChild(levelEl);
        
        // 工具提示
        container.addEventListener('mouseenter', (e) => {
            showTooltip(e.target, block);
        });
        container.addEventListener('mouseleave', () => {
            hideTooltip();
        });
    }
    
    return container;
}

// 显示工具提示
let tooltip = null;
function showTooltip(element, block) {
    hideTooltip();
    
    // 如果是特殊方块，使用图形化提示
    if (block.isSpecial) {
        showSpecialBlockTooltip(element, block);
        return;
    }
    
    tooltip = document.createElement('div');
    tooltip.className = 'block-tooltip';
    tooltip.textContent = block.getTooltipText();
    document.body.appendChild(tooltip);
    
    const rect = element.getBoundingClientRect();
    tooltip.style.left = rect.left + rect.width / 2 + 'px';
    tooltip.style.top = rect.top - 10 + 'px';
    tooltip.style.transform = 'translate(-50%, -100%)';
}

// 显示特殊方块的图形化加成区域提示
function showSpecialBlockTooltip(element, block) {
    hideTooltip();
    
    tooltip = document.createElement('div');
    tooltip.className = 'special-block-tooltip';
    
    // 创建标题
    const title = document.createElement('div');
    title.className = 'special-tooltip-title';
    const bonus = SPECIAL_BLOCK_BONUS[block.level] || 0;
    const bonusPercent = (bonus * 100).toFixed(0);
    title.innerHTML = `<strong>特殊方块 Lv.${block.level}</strong><br>加成比例: ${bonusPercent}%`;
    tooltip.appendChild(title);
    
    // 创建图形化区域显示
    const range = block.getRange();
    if (!range || !Array.isArray(range)) {
        console.error('无法获取特殊方块加成区域:', block);
        return;
    }
    const allX = range.map(([x]) => x);
    const allY = range.map(([, y]) => y);
    const minX = Math.min(...allX, -3);
    const maxX = Math.max(...allX, 3);
    const minY = Math.min(...allY, -3);
    const maxY = Math.max(...allY, 3);
    const gridSize = Math.max(maxX - minX + 1, maxY - minY + 1, 7);
    const centerOffset = Math.floor(gridSize / 2);
    
    const grid = document.createElement('div');
    grid.className = 'special-tooltip-grid';
    grid.style.display = 'grid';
    grid.style.gridTemplateColumns = `repeat(${gridSize}, 25px)`;
    grid.style.gap = '2px';
    grid.style.margin = '10px 0';
    
    const rangeSet = new Set(range.map(([x, y]) => `${x},${y}`));
    
    for (let row = 0; row < gridSize; row++) {
        for (let col = 0; col < gridSize; col++) {
            const cell = document.createElement('div');
            const x = col - centerOffset;
            const y = row - centerOffset;
            const key = `${x},${y}`;
            
            cell.className = 'special-tooltip-cell';
            if (x === 0 && y === 0) {
                cell.classList.add('special-tooltip-center');
                cell.textContent = '★';
            } else if (rangeSet.has(key)) {
                cell.classList.add('special-tooltip-active');
            }
            
            grid.appendChild(cell);
        }
    }
    
    tooltip.appendChild(grid);
    
    // 添加说明文字
    const desc = document.createElement('div');
    desc.className = 'special-tooltip-desc';
    desc.textContent = `影响范围: ${range.length} 格`;
    tooltip.appendChild(desc);
    
    document.body.appendChild(tooltip);
    
    const rect = element.getBoundingClientRect();
    tooltip.style.left = rect.left + rect.width / 2 + 'px';
    tooltip.style.top = rect.top - 10 + 'px';
    tooltip.style.transform = 'translate(-50%, -100%)';
}

function hideTooltip() {
    if (tooltip) {
        tooltip.remove();
        tooltip = null;
    }
}

// 设置拖拽
function setupDragAndDrop() {
    document.addEventListener('mousedown', (e) => {
        // 检查是否点击了底板上的方块
        const boardBlockEl = e.target.closest('.board-block');
        if (boardBlockEl) {
            // 清除选择状态
            clearBlockSelection();
            
            const blockId = boardBlockEl.dataset.blockId;
            dragBlock = playerInventory.find(b => b.id == blockId);
            if (dragBlock) {
                // 从底板拿起方块
                
                const gameBoard = getCurrentGameBoard();
                // 保存原位置（用于调试）
                const oldBlockData = [...gameBoard.blocks, ...gameBoard.specialBlocks].find(b => b.block === dragBlock);
                if (oldBlockData) {
                    dragBlock.oldPosition = { x: oldBlockData.x, y: oldBlockData.y };
                    // 方块原位置已保存
                }
                
                // 从底板移除
                gameBoard.removeBlock(dragBlock);
                // 更新方块使用情况
                const usage = blockUsageMap.get(dragBlock.id);
                if (usage) {
                    usage.delete(currentSchemeIndex);
                    if (usage.size === 0) {
                        blockUsageMap.delete(dragBlock.id);
                    }
                }
                renderBoard();
                renderInventory();
                updateAttributeDisplay();
                
                // 创建拖拽克隆
                const clone = createBlockElement(dragBlock);
                clone.style.position = 'fixed';
                clone.style.pointerEvents = 'none';
                clone.style.zIndex = '10000';
                clone.style.transform = 'scale(1.2)';
                document.body.appendChild(clone);
                dragBlock.cloneEl = clone;
                
                const boardBlockRect = boardBlockEl.getBoundingClientRect();
                dragOffset.x = e.clientX - boardBlockRect.left;
                dragOffset.y = e.clientY - boardBlockRect.top;
                
                // 更新拖拽偏移，考虑缩放
                dragOffset.x = dragOffset.x * 1.2;
                dragOffset.y = dragOffset.y * 1.2;
                
                updateDragPosition(e);
                e.preventDefault();
                return;
            }
        }
        
        // 检查是否点击了背包中的方块
        const blockEl = e.target.closest('.block');
        if (!blockEl || blockEl.classList.contains('in-use')) {
            // 如果点击的不是方块，清除选择
            if (!e.target.closest('.rotation-control-panel')) {
                clearBlockSelection();
            }
            return;
        }
        
        // 如果点击的是旋转按钮，不处理
        if (e.target.closest('.rotation-btn')) {
            return;
        }
        
        const blockId = blockEl.dataset.blockId;
        const block = playerInventory.find(b => b.id == blockId);
        if (!block) return;
        
        // 如果点击的是已选中的方块，开始拖放
        if (selectedBlock && selectedBlock.id === block.id) {
            startDragging(block, blockEl, e);
            return;
        }
        
        // 否则，选择方块并显示旋转控制
        selectBlock(block, blockEl);
    });
    
    document.addEventListener('mousemove', (e) => {
        if (dragBlock) {
            updateDragPosition(e);
            highlightBoardCells(e);
        }
    });
    
    document.addEventListener('mouseup', (e) => {
        if (dragBlock) {
            handleDrop(e);
            cleanupDrag();
        }
    });
    
    // 监听键盘事件：R键旋转选中的方块
    document.addEventListener('keydown', (e) => {
        if (e.key === 'r' || e.key === 'R') {
            if (selectedBlock && !dragBlock) {
                rotateSelectedBlock();
                e.preventDefault();
            }
        }
    });
}

// 选择方块并显示旋转控制
function selectBlock(block, blockEl) {
    // 清除之前的选择
    clearBlockSelection();
    
    selectedBlock = block;
    blockEl.classList.add('selected');
    
    // 创建旋转控制面板
    createRotationControlPanel(blockEl);
}

// 清除方块选择
function clearBlockSelection() {
    if (selectedBlock) {
        document.querySelectorAll('.block.selected').forEach(el => {
            el.classList.remove('selected');
        });
        selectedBlock = null;
    }
    
    if (rotationControlPanel) {
        rotationControlPanel.remove();
        rotationControlPanel = null;
    }
}

// 创建旋转控制面板
function createRotationControlPanel(blockEl) {
    // 移除旧的面板
    if (rotationControlPanel) {
        rotationControlPanel.remove();
    }
    
    rotationControlPanel = document.createElement('div');
    rotationControlPanel.className = 'rotation-control-panel';
    
    // 旋转按钮（只对非特殊方块显示）
    if (selectedBlock && !selectedBlock.isSpecial) {
        const rotateBtn = document.createElement('button');
        rotateBtn.className = 'rotation-btn';
        rotateBtn.innerHTML = '↻ 旋转 (R)';
        rotateBtn.title = '点击旋转方块90度，或按R键';
        rotateBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            rotateSelectedBlock();
        });
        rotationControlPanel.appendChild(rotateBtn);
    }
    
    // 洗练按钮（只对非特殊方块显示）
    if (selectedBlock && !selectedBlock.isSpecial) {
        const refineBtn = document.createElement('button');
        refineBtn.className = 'refine-btn';
        refineBtn.innerHTML = '✨ 洗练';
        refineBtn.title = '重新生成方块属性（保持形状不变）';
        refineBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            refineSelectedBlock();
        });
        rotationControlPanel.appendChild(refineBtn);
    }
    
    const dragHint = document.createElement('div');
    dragHint.className = 'drag-hint';
    dragHint.textContent = '点击或拖动方块到底板';
    
    rotationControlPanel.appendChild(dragHint);
    
    // 定位面板在方块旁边
    const rect = blockEl.getBoundingClientRect();
    rotationControlPanel.style.position = 'fixed';
    rotationControlPanel.style.left = (rect.right + 10) + 'px';
    rotationControlPanel.style.top = rect.top + 'px';
    rotationControlPanel.style.zIndex = '10001';
    
    document.body.appendChild(rotationControlPanel);
    
    // 更新面板位置（如果方块在屏幕边缘）
    updateRotationPanelPosition(blockEl);
}

// 更新旋转面板位置
function updateRotationPanelPosition(blockEl) {
    if (!rotationControlPanel) return;
    
    const rect = blockEl.getBoundingClientRect();
    const panelRect = rotationControlPanel.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    
    // 如果面板超出右边界，显示在左边
    if (rect.right + panelRect.width + 10 > viewportWidth) {
        rotationControlPanel.style.left = (rect.left - panelRect.width - 10) + 'px';
    } else {
        rotationControlPanel.style.left = (rect.right + 10) + 'px';
    }
}

// 洗练选中的方块（重新生成属性，保持形状不变）
function refineSelectedBlock() {
    if (!selectedBlock || selectedBlock.isSpecial) return; // 特殊方块不能洗练
    
    // 保存方块的形状、旋转角度和等级
    const originalShape = selectedBlock.shape;
    const originalRotation = selectedBlock.rotation;
    const originalLevel = selectedBlock.level;
    
    // 重新生成属性（使用相同的形状和旋转角度）
    selectedBlock.cells = [];
    selectedBlock.generateAttributes();
    
    // 确保形状、旋转角度和等级没有被改变
    selectedBlock.shape = originalShape;
    selectedBlock.rotation = originalRotation;
    selectedBlock.level = originalLevel;
    
    // 增加洗练次数
    refineCount++;
    
    // 更新显示
    renderInventory();
    
    // 如果方块在底板上，也需要更新底板显示和属性显示
    const gameBoard = getCurrentGameBoard();
    const blockData = [...gameBoard.blocks, ...gameBoard.specialBlocks].find(b => b.block === selectedBlock);
    if (blockData) {
        // 方块在底板上，更新底板显示
        renderBoard();
        updateAttributeDisplay();
    }
    
    // 更新旋转控制面板位置（因为方块可能重新渲染）
    const blockEl = document.querySelector(`.block[data-block-id="${selectedBlock.id}"]`);
    if (blockEl) {
        createRotationControlPanel(blockEl);
    }
    
    // 保存游戏数据
    saveGameData();
}

// 旋转选中的方块
function rotateSelectedBlock() {
    if (!selectedBlock || selectedBlock.isSpecial) return; // 特殊方块不能旋转
    
    // 旋转90度
    const currentRotation = selectedBlock.rotation;
    const newRotation = (currentRotation + 90) % 360;
    
    // 保存原有的cells（包括坐标和属性）
    const oldCells = selectedBlock.cells.map(cell => ({
        x: cell.x,
        y: cell.y,
        primaryAttr: cell.primaryAttr,
        primaryValue: cell.primaryValue,
        secondaryAttr: cell.secondaryAttr,
        secondaryValue: cell.secondaryValue
    }));
    
    // 获取原始形状（rotation=0时的形状）
    const baseShape = TETRIS_SHAPES[selectedBlock.shape];
    
    // 计算当前角度下的归一化坐标
    const currentRotatedShape = selectedBlock.rotateShape(baseShape, currentRotation);
    const currentMinX = Math.min(...currentRotatedShape.map(([x]) => x));
    const currentMinY = Math.min(...currentRotatedShape.map(([, y]) => y));
    const currentNormalizedShape = currentRotatedShape.map(([x, y]) => [x - currentMinX, y - currentMinY]);
    
    // 计算新角度下的归一化坐标
    const newRotatedShape = selectedBlock.rotateShape(baseShape, newRotation);
    const newMinX = Math.min(...newRotatedShape.map(([x]) => x));
    const newMinY = Math.min(...newRotatedShape.map(([, y]) => y));
    const newNormalizedShape = newRotatedShape.map(([x, y]) => [x - newMinX, y - newMinY]);
    
    // 建立新归一化坐标到索引的映射
    const newCoordToIndex = new Map();
    newNormalizedShape.forEach(([x, y], index) => {
        newCoordToIndex.set(`${x},${y}`, index);
    });
    
    // 对于每个旧cell，计算它旋转后的新坐标，然后找到对应的新索引
    // rotateShape是逆时针旋转：旧坐标[x,y] -> 新坐标[-y,x]
    // 注意：oldCells中的坐标是归一化后的坐标，直接旋转即可
    const oldIndexToNewIndex = new Map();
    oldCells.forEach((oldCell, oldIndex) => {
        // 获取旧cell的坐标
        const [oldX, oldY] = [oldCell.x, oldCell.y];
        
        // 将旧坐标逆时针旋转90度
        // 逆时针旋转90度：[x, y] -> [-y, x]
        const rotatedX = -oldY;
        const rotatedY = oldX;
        
        // 在新归一化形状中查找匹配的坐标
        const rotatedKey = `${rotatedX},${rotatedY}`;
        let newIndex = newCoordToIndex.get(rotatedKey);
        
        // 如果找不到精确匹配，尝试查找最接近的坐标
        if (newIndex === undefined) {
            let minDist = Infinity;
            let closestIndex = -1;
            for (let i = 0; i < newNormalizedShape.length; i++) {
                const [nx, ny] = newNormalizedShape[i];
                const dist = Math.abs(nx - rotatedX) + Math.abs(ny - rotatedY);
                if (dist < minDist) {
                    minDist = dist;
                    closestIndex = i;
                }
            }
            newIndex = closestIndex;
        }
        
        if (newIndex !== undefined && newIndex >= 0) {
            oldIndexToNewIndex.set(oldIndex, newIndex);
        }
    });
    
    // 建立新索引到旧索引的反向映射
    const newIndexToOldIndex = new Map();
    oldIndexToNewIndex.forEach((newIdx, oldIdx) => {
        // 如果新索引还没有映射，或者当前旧索引更合适，则更新
        if (!newIndexToOldIndex.has(newIdx)) {
            newIndexToOldIndex.set(newIdx, oldIdx);
        }
    });
    
    // 创建新的cells数组，按照newNormalizedShape的顺序
    selectedBlock.cells = newNormalizedShape.map(([newX, newY], newIndex) => {
        // 找到对应新索引的旧索引
        const oldIndex = newIndexToOldIndex.get(newIndex);
        
        // 如果找到了对应的旧索引，使用对应的旧cell
        if (oldIndex !== undefined && oldIndex >= 0 && oldIndex < oldCells.length) {
            const oldCell = oldCells[oldIndex];
            return {
                x: newX,
                y: newY,
                primaryAttr: oldCell.primaryAttr,
                primaryValue: oldCell.primaryValue,
                secondaryAttr: oldCell.secondaryAttr,
                secondaryValue: oldCell.secondaryValue
            };
        } else {
            // Fallback：如果找不到，使用索引对应的旧cell（假设顺序一致）
            const fallbackIndex = newIndex < oldCells.length ? newIndex : 0;
            const fallbackCell = oldCells[fallbackIndex];
            return {
                x: newX,
                y: newY,
                primaryAttr: fallbackCell.primaryAttr,
                primaryValue: fallbackCell.primaryValue,
                secondaryAttr: fallbackCell.secondaryAttr,
                secondaryValue: fallbackCell.secondaryValue
            };
        }
    });
    
    // 更新旋转角度
    selectedBlock.rotation = newRotation;
    
    // 更新显示
    renderInventory();
    
    // 更新旋转控制面板位置
    const blockEl = document.querySelector(`.block[data-block-id="${selectedBlock.id}"]`);
    if (blockEl) {
        createRotationControlPanel(blockEl);
    }
}

// 开始拖放
function startDragging(block, blockEl, e) {
    dragBlock = block;
    clearBlockSelection(); // 清除选择状态
    
    blockEl.classList.add('dragging');
    const blockRect = blockEl.getBoundingClientRect();
    dragOffset.x = e.clientX - blockRect.left;
    dragOffset.y = e.clientY - blockRect.top;
    
    const clone = blockEl.cloneNode(true);
    clone.style.position = 'fixed';
    clone.style.pointerEvents = 'none';
    clone.style.zIndex = '10000';
    clone.style.transform = 'scale(1.2)';
    document.body.appendChild(clone);
    dragBlock.cloneEl = clone;
    
    // 更新拖拽偏移，考虑缩放
    dragOffset.x = dragOffset.x * 1.2;
    dragOffset.y = dragOffset.y * 1.2;
    
    updateDragPosition(e);
}

function updateDragPosition(e) {
    if (dragBlock && dragBlock.cloneEl) {
        dragBlock.cloneEl.style.left = (e.clientX - dragOffset.x) + 'px';
        dragBlock.cloneEl.style.top = (e.clientY - dragOffset.y) + 'px';
    }
}

function highlightBoardCells(e) {
    const board = document.getElementById('game-board');
    if (!board) return;
    
    const gameBoard = getCurrentGameBoard(); // 获取当前方案的游戏板
    
    const rect = board.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // 清除之前的标记和预览
    board.querySelectorAll('.board-cell').forEach(cell => {
        cell.classList.remove('invalid', 'highlight', 'preview-valid', 'preview-invalid');
    });
    
    // 移除之前的预览方块和增幅范围
    const existingPreview = board.querySelector('.preview-block');
    if (existingPreview) {
        existingPreview.remove();
    }
    board.querySelectorAll('.bonus-range-preview').forEach(el => el.remove());
    
    if (!dragBlock || !dragBlock.cloneEl) return;
    
    const coords = gameBoard.getAllCellCoords();
    if (coords.length === 0) return;
    
    const minX = Math.min(...coords.map(c => c.x));
    const minY = Math.min(...coords.map(c => c.y));
    
    // 获取方块的归一化形状
    const normalizedShape = dragBlock.getNormalizedShape();
    const minShapeX = Math.min(...normalizedShape.map(([x]) => x));
    const minShapeY = Math.min(...normalizedShape.map(([, y]) => y));
    
    // 计算方块左上角在底板中的位置
    // cloneEl 的左上角位置 = 鼠标位置 - dragOffset（考虑缩放）
    const cloneRect = dragBlock.cloneEl.getBoundingClientRect();
    const cloneTopLeftX = cloneRect.left - rect.left;
    const cloneTopLeftY = cloneRect.top - rect.top;
    
    // 转换为格子坐标（方块左上角对应的格子）
    // board的rect.left已经包含了padding，所以cloneTopLeftX已经是相对于board内容区域的
    // 格子的位置也是相对于board内容区域的，所以不需要再减padding
    const cellX = Math.floor((cloneTopLeftX + gameBoard.cellSize / 2) / gameBoard.cellSize);
    const cellY = Math.floor((cloneTopLeftY + gameBoard.cellSize / 2) / gameBoard.cellSize);
    const boardX = cellX + minX;
    const boardY = cellY + minY;
    
    // baseX, baseY 是方块左上角（归一化后的原点）的位置
    const baseX = boardX - minShapeX;
    const baseY = boardY - minShapeY;
    
    const positions = dragBlock.getPositions(baseX, baseY);
    let canPlace = true;
    let allInBounds = true;
    
    // 检查所有位置是否都在底板范围内
    positions.forEach(([x, y]) => {
        const key = `${x},${y}`;
        if (!gameBoard.cells.has(key)) {
            allInBounds = false;
            canPlace = false;
        } else if (gameBoard.cells.get(key) !== null) {
            canPlace = false;
        }
    });
    
    // 只有全部在范围内才显示预览
    if (allInBounds) {
        positions.forEach(([x, y]) => {
            const key = `${x},${y}`;
            const cell = board.querySelector(`[data-x="${x}"][data-y="${y}"]`);
            if (cell) {
                if (gameBoard.cells.get(key) !== null) {
                    cell.classList.add('preview-invalid');
                    canPlace = false;
                } else {
                    cell.classList.add('preview-valid');
                }
            }
        });
        
        // 创建预览方块
        if (canPlace) {
            const previewBlock = createPreviewBlock(dragBlock, baseX, baseY, minX, minY);
            board.appendChild(previewBlock);
            
            // 如果是特殊方块，显示增幅范围
            if (dragBlock.isSpecial) {
                renderBonusRangePreview(dragBlock, baseX, baseY, minX, minY);
            }
        }
    } else {
        // 标记无效位置
        positions.forEach(([x, y]) => {
            const key = `${x},${y}`;
            const cell = board.querySelector(`[data-x="${x}"][data-y="${y}"]`);
            if (cell && !gameBoard.cells.has(key)) {
                cell.classList.add('invalid');
            }
        });
    }
}

// 渲染特殊方块增幅范围预览
function renderBonusRangePreview(block, baseX, baseY, boardMinX, boardMinY) {
    const range = block.getRange();
    if (!range || !Array.isArray(range)) {
        console.error('无法获取特殊方块加成区域:', block);
        return;
    }
    const board = document.getElementById('game-board');
    const gameBoard = getCurrentGameBoard();
    
    range.forEach(([dx, dy]) => {
        const targetX = baseX + dx;
        const targetY = baseY + dy;
        const key = `${targetX},${targetY}`;
        
        // 只显示在底板范围内的格子
        if (gameBoard.cells.has(key)) {
            const cell = board.querySelector(`[data-x="${targetX}"][data-y="${targetY}"]`);
            if (cell) {
                // 添加增幅范围标记（与放置提示区分）
                const rangeMarker = document.createElement('div');
                rangeMarker.className = 'bonus-range-preview';
                rangeMarker.style.position = 'absolute';
                rangeMarker.style.left = (targetX - boardMinX) * gameBoard.cellSize + 'px';
                rangeMarker.style.top = (targetY - boardMinY) * gameBoard.cellSize + 'px';
                rangeMarker.style.width = gameBoard.cellSize + 'px';
                rangeMarker.style.height = gameBoard.cellSize + 'px';
                rangeMarker.style.border = '2px dashed #9b59b6';
                rangeMarker.style.backgroundColor = 'rgba(155, 89, 182, 0.2)';
                rangeMarker.style.pointerEvents = 'none';
                rangeMarker.style.zIndex = '4';
                rangeMarker.style.boxSizing = 'border-box';
                board.appendChild(rangeMarker);
            }
        }
    });
}

// 创建预览方块
function createPreviewBlock(block, baseX, baseY, boardMinX, boardMinY) {
    const gameBoard = getCurrentGameBoard(); // 获取当前方案的游戏板
    
    const preview = document.createElement('div');
    preview.className = 'preview-block';
    
    const positions = block.getPositions(baseX, baseY);
    const minX = Math.min(...positions.map(([x]) => x));
    const minY = Math.min(...positions.map(([, y]) => y));
    const maxX = Math.max(...positions.map(([x]) => x));
    const maxY = Math.max(...positions.map(([, y]) => y));
    
    preview.style.position = 'absolute';
    // 预览位置相对于 board 的内容区域，与方块容器一致
    preview.style.left = (minX - boardMinX) * gameBoard.cellSize + 'px';
    preview.style.top = (minY - boardMinY) * gameBoard.cellSize + 'px';
    preview.style.width = (maxX - minX + 1) * gameBoard.cellSize + 'px';
    preview.style.height = (maxY - minY + 1) * gameBoard.cellSize + 'px';
    preview.style.pointerEvents = 'none';
    preview.style.zIndex = '5';
    preview.style.border = '3px dashed #2ecc71';
    preview.style.backgroundColor = 'rgba(46, 204, 113, 0.2)';
    preview.style.boxSizing = 'border-box';
    
    return preview;
}

function handleDrop(e) {
    const board = document.getElementById('game-board');
    if (!board || !dragBlock || !dragBlock.cloneEl) return;
    
    const gameBoard = getCurrentGameBoard(); // 获取当前方案的游戏板
    
    const rect = board.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // 检查是否在底板范围内
    if (mouseX < 0 || mouseY < 0 || mouseX > rect.width || mouseY > rect.height) {
        // 如果拖出底板，且方块之前已放置，则移除
        const usage = blockUsageMap.get(dragBlock.id);
        if (usage && usage.has(currentSchemeIndex)) {
            // 方块已从底板移除（在mousedown时），只需要更新显示
            renderBoard();
            renderInventory();
            updateAttributeDisplay();
        }
        return;
    }
    
    const coords = gameBoard.getAllCellCoords();
    if (coords.length === 0) return;
    
    const minX = Math.min(...coords.map(c => c.x));
    const minY = Math.min(...coords.map(c => c.y));
    
    // 获取方块的归一化形状
    const normalizedShape = dragBlock.getNormalizedShape();
    const minShapeX = Math.min(...normalizedShape.map(([x]) => x));
    const minShapeY = Math.min(...normalizedShape.map(([, y]) => y));
    
    // 计算方块左上角在底板中的位置（使用cloneEl的实际位置）
    const cloneRect = dragBlock.cloneEl.getBoundingClientRect();
    const cloneTopLeftX = cloneRect.left - rect.left;
    const cloneTopLeftY = cloneRect.top - rect.top;
    
    // 转换为格子坐标（方块左上角对应的格子）
    // board的rect.left已经包含了padding，所以cloneTopLeftX已经是相对于board内容区域的
    // 但是格子的位置是相对于board内容区域的，所以不需要再减padding
    const cellX = Math.floor((cloneTopLeftX + gameBoard.cellSize / 2) / gameBoard.cellSize);
    const cellY = Math.floor((cloneTopLeftY + gameBoard.cellSize / 2) / gameBoard.cellSize);
    const boardX = cellX + minX;
    const boardY = cellY + minY;
    
    // baseX, baseY 是方块左上角（归一化后的原点）的位置
    const baseX = boardX - minShapeX;
    const baseY = boardY - minShapeY;
    
    // 严格检查：所有位置必须在底板范围内且为空
    if (gameBoard.canPlaceBlock(dragBlock, baseX, baseY)) {
        // 放置新位置（如果之前已放置，在mousedown时已移除）
        if (gameBoard.placeBlock(dragBlock, baseX, baseY)) {
            // 更新方块使用情况
            if (!blockUsageMap.has(dragBlock.id)) {
                blockUsageMap.set(dragBlock.id, new Set());
            }
            blockUsageMap.get(dragBlock.id).add(currentSchemeIndex);
            
            renderBoard();
            renderInventory();
            updateAttributeDisplay();
            
            // 底板扩展现在基于底板等级，不再基于总等级
            // 检查并升级底板等级（如果经验足够）
            checkAndUpgradeBoardLevel();
        } else {
            // 方块放置失败
        }
    } else {
        // 方块无法放置
        // 如果无法放置，且之前已从底板移除，需要恢复
        const usage = blockUsageMap.get(dragBlock.id);
        if (!usage || !usage.has(currentSchemeIndex)) {
            // 尝试恢复到原位置（这里简化处理，实际可以保存原位置）
            // 如果无法恢复，方块会留在背包中
            renderBoard();
            renderInventory();
            updateAttributeDisplay();
        }
    }
}

function cleanupDrag() {
    if (dragBlock) {
        if (dragBlock.cloneEl) {
            dragBlock.cloneEl.remove();
            dragBlock.cloneEl = null;
        }
        document.querySelectorAll('.block.dragging').forEach(el => el.classList.remove('dragging'));
        const board = document.getElementById('game-board');
        if (board) {
            board.querySelectorAll('.board-cell').forEach(cell => {
                cell.classList.remove('invalid', 'highlight', 'preview-valid', 'preview-invalid');
            });
            const preview = board.querySelector('.preview-block');
            if (preview) {
                preview.remove();
            }
            board.querySelectorAll('.bonus-range-preview').forEach(el => el.remove());
        }
        dragBlock = null;
    }
    // 拖放结束后清除选择
    clearBlockSelection();
}

// 更新属性显示
function updateAttributeDisplay() {
    const display = document.getElementById('attribute-display');
    display.innerHTML = '';
    
    const gameBoard = getCurrentGameBoard();
    const attributeCalculator = getCurrentAttributeCalculator();
    
    // 显示总等级数
    const totalLevel = gameBoard.getTotalLevel();
    const levelInfo = document.createElement('div');
    levelInfo.className = 'total-level-info';
    levelInfo.innerHTML = `<strong>总等级: ${totalLevel}</strong>`;
    display.appendChild(levelInfo);
    
    // 更新钥匙和活跃天数显示（钥匙显示中已包含宝箱开启次数）
    updateSilverKeysDisplay();
    updateGoldKeysDisplay();
    const attributes = attributeCalculator.calculateTotalAttributes();
    
    const attributeOrder = [
        { key: 'attack', name: '攻击' },
        { key: 'defense', name: '防御' },
        { key: 'health', name: '生命' },
        { key: 'crit', name: '暴击率' },
        { key: 'anti-crit', name: '抗暴击率' },
        { key: 'dodge', name: '闪避率' },
        { key: 'anti-dodge', name: '抗闪避率' },
        { key: 'armor-pen', name: '破甲率' },
        { key: 'anti-armor-pen', name: '抗破甲率' }
    ];
    
    attributeOrder.forEach(({ key, name }) => {
        if (attributes[key] === undefined || attributes[key] === 0) return;
        
        const item = document.createElement('div');
        item.className = `attribute-item ${key}`;
        
        const nameEl = document.createElement('span');
        nameEl.textContent = name + ': ';
        
        const valueEl = document.createElement('span');
        // 判断是否为二级属性（百分比属性）
        const isSecondaryAttr = key.includes('crit') || key.includes('dodge') || key.includes('armor');
        if (isSecondaryAttr) {
            // 二级属性精确到小数点后两位
            valueEl.textContent = attributes[key].toFixed(2) + '%';
        } else {
            // 一级属性使用整数
            valueEl.textContent = Math.floor(attributes[key]);
        }
        
        item.appendChild(nameEl);
        item.appendChild(valueEl);
        
        // 显示变化
        if (previousAttributes[key] !== undefined) {
            const change = attributes[key] - previousAttributes[key];
            if (Math.abs(change) > 0.01) {
                const changeEl = document.createElement('span');
                changeEl.className = `attribute-change ${change > 0 ? 'positive' : 'negative'}`;
                // 如果是二级属性，变化值也精确到小数点后两位
                if (isSecondaryAttr) {
                    changeEl.textContent = (change > 0 ? '+' : '') + change.toFixed(2);
                } else {
                    changeEl.textContent = (change > 0 ? '+' : '') + Math.floor(change);
                }
                item.appendChild(changeEl);
                
                setTimeout(() => changeEl.remove(), 1000);
            }
        }
        
        display.appendChild(item);
    });
    
    previousAttributes = { ...attributes };
    
    // 显示洗练次数（在清空按钮上方）
    const refineCountEl = document.createElement('div');
    refineCountEl.className = 'refine-count-info';
    refineCountEl.innerHTML = `<strong>累计洗练: ${refineCount} 次</strong>`;
    refineCountEl.style.marginTop = '15px';
    refineCountEl.style.paddingTop = '15px';
    refineCountEl.style.borderTop = '1px solid #ecf0f1';
    refineCountEl.style.color = '#7f8c8d';
    display.appendChild(refineCountEl);
    
    // 同时更新扩展进度显示
    updateExpansionProgressDisplay();
}

// 更新扩展进度显示
function updateExpansionProgressDisplay() {
    const display = document.getElementById('expansion-progress-display');
    if (!display) return;
    
    display.innerHTML = '';
    
    // 显示当前底板等级和经验
    const currentLevelInfo = document.createElement('div');
    currentLevelInfo.className = 'current-board-level';
    currentLevelInfo.innerHTML = `<strong>底板等级: ${boardLevel}</strong><br><small>积分经验: ${boardExp}</small>`;
    display.appendChild(currentLevelInfo);
    
    // 显示所有扩展要求（基于底板等级和经验）
    if (!BOARD_LEVEL_EXP_REQUIREMENTS || !Array.isArray(BOARD_LEVEL_EXP_REQUIREMENTS)) {
        return;
    }
    
    // 初始格子数量
    const initialCellCount = 25;
    let currentCellCount = initialCellCount;
    
    BOARD_LEVEL_EXP_REQUIREMENTS.forEach((requirement, index) => {
        const item = document.createElement('div');
        item.className = 'expansion-progress-item';
        
        const isReached = boardLevel >= requirement.level;
        const isCurrentlyMet = boardExp >= requirement.expRequired;
        
        // 设置样式类
        if (isReached) {
            item.classList.add('reached');
        } else if (isCurrentlyMet) {
            item.classList.add('reached');
        } else {
            item.classList.add('not-reached');
        }
        
        // 计算格子数增量
        let cellIncrease = 0;
        if (BOARD_LEVEL_EXPANSION && Array.isArray(BOARD_LEVEL_EXPANSION)) {
            const expansion = BOARD_LEVEL_EXPANSION.find(e => e.level === requirement.level);
            if (expansion) {
                cellIncrease = expansion.cellIncrease;
            }
        }
        currentCellCount += cellIncrease;
        
        // 创建文本内容：例如"底板等级 1 → 需要经验 100 → 底板格子数+3 （总共 28 格）"
        const textContent = `底板等级 ${requirement.level} → 需要经验 ${requirement.expRequired} → 底板格子数+${cellIncrease} （总共 ${currentCellCount} 格）`;
        item.textContent = textContent;
        
        display.appendChild(item);
    });
}

// 更新银色钥匙显示
function updateSilverKeysDisplay() {
    const display = document.getElementById('silver-keys-display');
    if (display) {
        display.textContent = `银色钥匙: ${silverKeys} | 低级宝箱: ${gachaCounts.low} 次`;
    }
    
    // 更新宝箱页面的钥匙显示
    const gachaDisplay = document.getElementById('gacha-silver-keys-display');
    if (gachaDisplay) {
        gachaDisplay.textContent = `银色钥匙: ${silverKeys}`;
    }
    
    // 更新按钮状态（如果钥匙不足，禁用按钮）
    document.querySelectorAll('.gacha-btn[data-type="low"]').forEach(btn => {
        const count = parseInt(btn.dataset.count);
        if (silverKeys < count) {
            btn.disabled = true;
            btn.style.opacity = '0.5';
            btn.style.cursor = 'not-allowed';
        } else {
            btn.disabled = false;
            btn.style.opacity = '1';
            btn.style.cursor = 'pointer';
        }
    });
}

// 更新金色钥匙显示
function updateGoldKeysDisplay() {
    const display = document.getElementById('gold-keys-display');
    if (display) {
        display.textContent = `金色钥匙: ${goldKeys} | 高级宝箱: ${gachaCounts.high} 次`;
    }
    
    // 更新宝箱页面的钥匙显示
    const gachaDisplay = document.getElementById('gacha-gold-keys-display');
    if (gachaDisplay) {
        gachaDisplay.textContent = `金色钥匙: ${goldKeys}`;
    }
    
    // 更新按钮状态（如果钥匙不足，禁用按钮）
    document.querySelectorAll('.gacha-btn[data-type="high"]').forEach(btn => {
        const count = parseInt(btn.dataset.count);
        if (goldKeys < count) {
            btn.disabled = true;
            btn.style.opacity = '0.5';
            btn.style.cursor = 'not-allowed';
        } else {
            btn.disabled = false;
            btn.style.opacity = '1';
            btn.style.cursor = 'pointer';
        }
    });
}

// 更新活跃天数显示
function updateActiveDaysDisplay() {
    // 更新获取方块页面的活跃天数显示
    const display = document.getElementById('active-days-display');
    if (display) {
        display.innerHTML = `
            <div class="active-days-info">
                <h4>活跃天数: 第 ${activeDays} 天</h4>
                <div class="day-buttons">
                    <button id="next-day-btn" class="next-day-btn">下一天</button>
                    <button id="next-ten-days-btn" class="next-day-btn">下十天</button>
                </div>
            </div>
        `;
        
        // 绑定下一天按钮事件
        const nextDayBtn = document.getElementById('next-day-btn');
        if (nextDayBtn && !nextDayBtn.dataset.bound) {
            nextDayBtn.dataset.bound = 'true';
            nextDayBtn.addEventListener('click', () => {
                nextDay();
            });
        }
        
        // 绑定下十天按钮事件
        const nextTenDaysBtn = document.getElementById('next-ten-days-btn');
        if (nextTenDaysBtn && !nextTenDaysBtn.dataset.bound) {
            nextTenDaysBtn.dataset.bound = 'true';
            nextTenDaysBtn.addEventListener('click', () => {
                nextTenDays();
            });
        }
    }
    
    // 更新底板页面的活跃天数显示
    const boardDisplay = document.getElementById('board-active-days-display');
    if (boardDisplay) {
        boardDisplay.textContent = `活跃天数: 第 ${activeDays} 天`;
    }
    
    // 更新底板页面的角色显示
    updatePlayerRoleDisplay();
}

// 更新底板页面的角色显示
function updatePlayerRoleDisplay() {
    const roleDisplay = document.getElementById('board-player-role-display');
    if (roleDisplay) {
        const avatar = PLAYER_ROLE_AVATARS[playerRole] || '👤';
        roleDisplay.innerHTML = `<span class="role-avatar">${avatar}</span> 当前角色: ${playerRole}`;
    }
}

// 下一天功能
function nextDay() {
    activeDays++;
    
    // 根据角色获取每天固定奖励
    const reward = getActiveDayReward();
    if (reward) {
        silverKeys += reward.silverKeys || 0;
        goldKeys += reward.goldKeys || 0;
        
        updateSilverKeysDisplay();
        updateGoldKeysDisplay();
        updateActiveDaysDisplay();
        saveGameData();
        
        let rewardText = `第 ${activeDays} 天奖励：\n`;
        if (reward.silverKeys > 0) {
            rewardText += `银色钥匙 x${reward.silverKeys}\n`;
        }
        if (reward.goldKeys > 0) {
            rewardText += `金色钥匙 x${reward.goldKeys}\n`;
        }
        alert(rewardText);
    } else {
        updateActiveDaysDisplay();
        saveGameData();
        alert(`已进入第 ${activeDays} 天（无奖励）`);
    }
}

// 下十天功能
function nextTenDays() {
    const startDay = activeDays;
    activeDays += 10;
    
    // 根据角色获取每天固定奖励，乘以10倍
    const reward = getActiveDayReward();
    if (reward) {
        const totalSilverKeys = (reward.silverKeys || 0) * 10;
        const totalGoldKeys = (reward.goldKeys || 0) * 10;
        
        silverKeys += totalSilverKeys;
        goldKeys += totalGoldKeys;
        
        updateSilverKeysDisplay();
        updateGoldKeysDisplay();
        updateActiveDaysDisplay();
        saveGameData();
        
        let rewardText = `第 ${startDay + 1} 天到第 ${activeDays} 天奖励（10天）：\n`;
        if (totalSilverKeys > 0) {
            rewardText += `银色钥匙 x${totalSilverKeys}\n`;
        }
        if (totalGoldKeys > 0) {
            rewardText += `金色钥匙 x${totalGoldKeys}\n`;
        }
        alert(rewardText);
    } else {
        updateActiveDaysDisplay();
        saveGameData();
        alert(`已进入第 ${activeDays} 天（无奖励）`);
    }
}

// 获取活跃天数奖励（每天都有固定奖励）
function getActiveDayReward() {
    const roleReward = ACTIVE_DAY_REWARDS[playerRole];
    if (!roleReward) return null;
    
    // 每天都有固定奖励
    return roleReward;
}

// 初始化宝箱系统
function initializeGacha() {
    document.querySelectorAll('.gacha-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const type = btn.dataset.type;
            const count = parseInt(btn.dataset.count);
            openChest(type, count);
        });
    });
}

function openChest(type, count) {
    // 低级宝箱需要消耗银色钥匙
    if (type === 'low') {
        const requiredKeys = count;
        if (silverKeys < requiredKeys) {
            alert(`银色钥匙不足！需要 ${requiredKeys} 把，当前拥有 ${silverKeys} 把。`);
            return;
        }
        // 消耗钥匙
        silverKeys -= requiredKeys;
        updateSilverKeysDisplay();
    }
    
    // 高级宝箱需要消耗金色钥匙
    if (type === 'high') {
        const requiredKeys = count;
        if (goldKeys < requiredKeys) {
            alert(`金色钥匙不足！需要 ${requiredKeys} 把，当前拥有 ${goldKeys} 把。`);
            return;
        }
        // 消耗钥匙
        goldKeys -= requiredKeys;
        updateGoldKeysDisplay();
    }
    
    const results = GachaSystem.openChest(type, count);
    results.forEach(block => {
        playerInventory.push(block);
    });
    
    // 更新开启次数
    gachaCounts[type] += count;
    updateGachaCounts();
    
    // 获得积分经验
    const expReward = (type === 'low' ? CHEST_EXP_REWARDS.low : CHEST_EXP_REWARDS.high) * count;
    boardExp += expReward;
    
    // 检查并升级底板等级
    checkAndUpgradeBoardLevel();
    
    // 更新显示
    updateExpansionProgressDisplay();
    
    displayGachaResults(results);
    saveGameData();
    renderInventory();
}

function displayGachaResults(results) {
    const container = document.getElementById('gacha-results');
    container.innerHTML = '<h3>获得方块：</h3>';
    
    results.forEach(block => {
        const blockEl = createBlockElement(block);
        container.appendChild(blockEl);
    });
}

// 切换方块选择状态
function toggleBlockSelection(block, blockEl) {
    if (selectedBlockIds.has(block.id)) {
        selectedBlockIds.delete(block.id);
        blockEl.classList.remove('selected');
    } else {
        // 检查是否已经选择了4个方块
        if (selectedBlockIds.size >= 4) {
            alert('最多只能选择4个方块进行合成');
            return;
        }
        // 检查是否选择了同等级同类型的方块
        const selectedBlocks = Array.from(selectedBlockIds).map(id => 
            playerInventory.find(b => b.id === id)
        ).filter(b => b);
        
        if (selectedBlocks.length > 0) {
            const firstBlock = selectedBlocks[0];
            // 检查等级和类型是否一致
            if (firstBlock.level !== block.level || firstBlock.isSpecial !== block.isSpecial) {
                alert('只能选择相同等级和相同类型的方块进行合成');
                return;
            }
        }
        
        selectedBlockIds.add(block.id);
        blockEl.classList.add('selected');
    }
    updateManualMergeButton();
}

// 更新手动合成按钮
function updateManualMergeButton() {
    const manualBtn = document.getElementById('manual-merge-btn');
    const clearBtn = document.getElementById('clear-selection-btn');
    const count = selectedBlockIds.size;
    
    if (count > 0) {
        manualBtn.style.display = 'inline-block';
        clearBtn.style.display = 'inline-block';
        manualBtn.textContent = `合成选中方块 (${count}/4)`;
        manualBtn.disabled = count !== 4;
    } else {
        manualBtn.style.display = 'none';
        clearBtn.style.display = 'none';
    }
}

// 手动合成选中的方块
function manualMerge() {
    if (selectedBlockIds.size !== 4) {
        alert('请选择4个方块进行合成');
        return;
    }
    
    const selectedBlocks = Array.from(selectedBlockIds).map(id => 
        playerInventory.find(b => b.id === id)
    ).filter(b => b);
    
    if (selectedBlocks.length !== 4) {
        alert('选择的方块无效');
        selectedBlockIds.clear();
        renderUpgradeInventory();
        return;
    }
    
    // 检查等级和类型是否一致
    const firstBlock = selectedBlocks[0];
    const allSame = selectedBlocks.every(b => 
        b.level === firstBlock.level && b.isSpecial === firstBlock.isSpecial
    );
    
    if (!allSame) {
        alert('只能合成相同等级和相同类型的方块');
        selectedBlockIds.clear();
        renderUpgradeInventory();
        return;
    }
    
    // 检查是否有二级属性的方块会被消耗
    const blocksWithSecondaryAttr = selectedBlocks.filter(block => {
        if (block.isSpecial) return false; // 特殊方块没有二级属性
        return block.cells.some(cell => cell.secondaryAttr !== null);
    });
    
    if (blocksWithSecondaryAttr.length > 0) {
        // 显示二级属性详情
        let detailText = '此次合成会消耗以下含有二级属性的方块：\n\n';
        blocksWithSecondaryAttr.forEach((block, index) => {
            detailText += `${index + 1}. 等级 ${block.level} 方块：\n`;
            block.cells.forEach((cell, cellIndex) => {
                if (cell.secondaryAttr) {
                    detailText += `   - 格子${cellIndex + 1}: ${SECONDARY_ATTR_NAMES[cell.secondaryAttr]} ${cell.secondaryValue.toFixed(2)}%\n`;
                }
            });
            detailText += '\n';
        });
        detailText += '是否继续？';
        
        if (!confirm(detailText)) {
            return; // 用户取消
        }
    }
    
    // 执行合成
    const level = firstBlock.level;
    const isSpecial = firstBlock.isSpecial;
    
    // 移除用于合成的方块
    selectedBlocks.forEach(block => {
        const index = playerInventory.indexOf(block);
        if (index > -1) {
            playerInventory.splice(index, 1);
        }
    });
    
    // 创建新方块
    const newLevel = level + 1;
    if (isSpecial) {
        const newBlock = new Block(newLevel, 0, 0, true);
        playerInventory.push(newBlock);
    } else {
        const shape = Math.floor(Math.random() * TETRIS_SHAPES.length);
        const rotation = [0, 90, 180, 270][Math.floor(Math.random() * 4)];
        const newBlock = new Block(newLevel, shape, rotation);
        playerInventory.push(newBlock);
    }
    
    // 清除选择
    selectedBlockIds.clear();
    
    saveGameData();
    renderUpgradeInventory();
    renderInventory();
    const blockType = isSpecial ? '特殊方块' : '普通方块';
    alert(`成功合成 1 个等级 ${newLevel} 的${blockType}！`);
}

// 清除选择
function clearSelection() {
    selectedBlockIds.clear();
    renderUpgradeInventory();
}

// 初始化升级系统
function initializeUpgrade() {
    document.getElementById('auto-merge-btn').addEventListener('click', () => {
        const levelStr = document.getElementById('merge-level-select').value;
        if (levelStr) {
            autoMerge(levelStr);
        } else {
            alert('请先选择要合成的等级和类型');
        }
    });
    
    document.getElementById('manual-merge-btn').addEventListener('click', () => {
        manualMerge();
    });
    
    document.getElementById('clear-selection-btn').addEventListener('click', () => {
        clearSelection();
    });
}

// 初始化清空底板功能
function initializeClearBoard() {
    const clearBtn = document.getElementById('clear-board-btn');
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            if (confirm('确定要清空底板吗？所有方块将回到背包。')) {
                clearBoard();
            }
        });
    }
    
    const resetBtn = document.getElementById('reset-system-btn');
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            if (confirm('确定要重置系统吗？这将清空底板、删除所有方块，并将格子数恢复到初始状态。此操作不可恢复！')) {
                resetSystem();
            }
        });
    }
}

// 清空当前方案的底板
function clearBoard() {
    const gameBoard = getCurrentGameBoard();
    
    // 移除当前方案中所有已放置的方块
    const blocksToRemove = [...gameBoard.blocks, ...gameBoard.specialBlocks];
    blocksToRemove.forEach(({ block }) => {
        gameBoard.removeBlock(block);
        // 更新方块使用情况
        const usage = blockUsageMap.get(block.id);
        if (usage) {
            usage.delete(currentSchemeIndex);
            if (usage.size === 0) {
                blockUsageMap.delete(block.id);
            }
        }
    });
    
    // 清空游戏板数据
    gameBoard.blocks = [];
    gameBoard.specialBlocks = [];
    
    // 重置所有格子为空
    const coords = gameBoard.getAllCellCoords();
    coords.forEach(({ key }) => {
        gameBoard.cells.set(key, null);
    });
    
    // 重新渲染
    renderBoard();
    renderInventory();
    updateAttributeDisplay();
    
    // 保存数据
    saveGameData();
    
    console.log('当前方案底板已清空');
}

// 检查并升级底板等级
function checkAndUpgradeBoardLevel() {
    if (!BOARD_LEVEL_EXP_REQUIREMENTS || !Array.isArray(BOARD_LEVEL_EXP_REQUIREMENTS)) {
        return;
    }
    
    let hasUpgrade = false;
    // 检查是否可以升级
    for (let requirement of BOARD_LEVEL_EXP_REQUIREMENTS) {
        if (boardExp >= requirement.expRequired && boardLevel < requirement.level) {
            boardLevel = requirement.level;
            hasUpgrade = true;
            
            // 扩展底板格子
            expandCellsForAllSchemesByBoardLevel();
            
            // 重新渲染底板
            renderBoard();
            updateExpansionProgressDisplay();
        }
    }
    
    if (hasUpgrade) {
        saveGameData();
    }
}

// 扩展所有方案的格子（基于底板等级）
function expandCellsForAllSchemesByBoardLevel() {
    if (!BOARD_LEVEL_EXPANSION || !Array.isArray(BOARD_LEVEL_EXPANSION)) {
        return;
    }
    
    // 初始格子数量
    const initialCellCount = 25;
    let targetCellCount = initialCellCount;
    
    // 计算当前底板等级应该有多少格子
    for (let expansion of BOARD_LEVEL_EXPANSION) {
        if (boardLevel >= expansion.level) {
            targetCellCount += expansion.cellIncrease;
        }
    }
    
    // 扩展所有方案到目标格子数
    gameBoards.forEach((board) => {
        if (board.currentCellCount < targetCellCount) {
            const coords = board.generateSpiralCoordinates(targetCellCount);
            coords.forEach(([x, y]) => {
                const key = `${x},${y}`;
                if (!board.cells.has(key)) {
                    board.cells.set(key, null);
                }
            });
            board.currentCellCount = targetCellCount;
        }
    });
}

// 扩展所有方案的格子（同步扩展）- 保持兼容性，但改为基于底板等级
function expandCellsForAllSchemes(totalLevel) {
    let maxCellCount = 0;
    
    // 找到所有方案中最大的格子数
    gameBoards.forEach(board => {
        if (board.currentCellCount > maxCellCount) {
            maxCellCount = board.currentCellCount;
        }
    });
    
    // 尝试扩展所有方案到新的格子数
    for (let rule of BOARD_EXPANSION_RULES) {
        if (totalLevel >= rule.level && maxCellCount < rule.count) {
            const newCellCount = rule.count;
            
            // 同步扩展所有方案
            gameBoards.forEach(board => {
                if (board.currentCellCount < newCellCount) {
                    const coords = board.generateSpiralCoordinates(newCellCount);
                    coords.forEach(([x, y]) => {
                        const key = `${x},${y}`;
                        if (!board.cells.has(key)) {
                            board.cells.set(key, null);
                        }
                    });
                    board.currentCellCount = newCellCount;
                }
            });
            
            return newCellCount;
        }
    }
    
    return maxCellCount;
}

// 重置系统
// 注意：此函数只重置游戏数据（方块、底板等），不会清除数据配置（gameConfig）
// 手动配置的数据会保留，不会被重置
// 活跃天数会重置为0天
// 银色钥匙和金色钥匙会重置为初始值（10个银色钥匙和1个金色钥匙）
function resetSystem() {
    // 1. 清空所有方案的底板
    gameBoards.forEach((board) => {
        const blocksToRemove = [...board.blocks, ...board.specialBlocks];
        blocksToRemove.forEach(({ block }) => {
            board.removeBlock(block);
        });
        board.blocks = [];
        board.specialBlocks = [];
        board.cells.clear();
        board.currentCellCount = board.initialCellCount;
        board.generateInitialCells();
    });
    
    // 2. 删除所有方块和特殊方块
    playerInventory = [];
    blockUsageMap.clear();
    
    // 5. 重置宝箱开启次数
    gachaCounts = { low: 0, high: 0 };
    updateGachaCounts();
    
    // 6. 重置钥匙数量为初始值
    silverKeys = 10;
    goldKeys = 1;
    updateSilverKeysDisplay();
    updateGoldKeysDisplay();
    
    // 7. 重置活跃天数为0
    activeDays = 0;
    updateActiveDaysDisplay();
    
    // 8. 重置扩展进度（清除所有已完成的扩展等级）
    reachedExpansionLevels.clear();
    
    // 9. 重置洗练次数
    refineCount = 0;
    
    // 10. 重置底板等级和经验
    boardLevel = 0;
    boardExp = 0;
    
    // 11. 清除选择状态
    selectedBlockIds.clear();
    
    // 12. 从默认配置文件重新加载配置
    loadDefaultConfig();
    
    // 13. 重新渲染
    renderBoard();
    renderInventory();
    updateAttributeDisplay();
    updateExpansionProgressDisplay(); // 更新扩展进度显示
    
    // 14. 保存游戏数据（不包含配置数据，配置数据会保留）
    saveGameData();
    
    console.log('系统已重置（已从默认配置重新加载）');
}

// 从默认配置文件加载配置
function loadDefaultConfig() {
    const defaultConfigStr = localStorage.getItem('defaultGameConfig');
    if (defaultConfigStr) {
        try {
            const defaultConfig = JSON.parse(defaultConfigStr);
            // 使用 loadConfigData 的逻辑来加载默认配置
            loadConfigFromObject(defaultConfig);
            // 同时更新当前配置
            localStorage.setItem('gameConfig', defaultConfigStr);
            console.log('已从默认配置重新加载');
        } catch (e) {
            console.error('加载默认配置失败:', e);
        }
    } else {
        console.log('没有默认配置文件，使用 data.js 中的原始默认值');
    }
}

// 从配置对象加载配置（供 loadDefaultConfig 和 loadConfigData 使用）
function loadConfigFromObject(config) {
    // 完全覆盖全局配置对象（而不是合并）
    if (config.ATTRIBUTE_LEVEL_TABLE) {
        // 清空原有配置，完全替换
        Object.keys(ATTRIBUTE_LEVEL_TABLE).forEach(key => delete ATTRIBUTE_LEVEL_TABLE[key]);
        Object.assign(ATTRIBUTE_LEVEL_TABLE, config.ATTRIBUTE_LEVEL_TABLE);
    }
    if (config.SPECIAL_BLOCK_RANGE) {
        // 清空原有配置，完全替换
        Object.keys(SPECIAL_BLOCK_RANGE).forEach(key => delete SPECIAL_BLOCK_RANGE[key]);
        
        // 兼容多种旧格式
        Object.keys(config.SPECIAL_BLOCK_RANGE).forEach(level => {
            const levelData = config.SPECIAL_BLOCK_RANGE[level];
            
            if (Array.isArray(levelData)) {
                // 新格式：已经是数组（多个方案）
                SPECIAL_BLOCK_RANGE[level] = levelData.map(scheme => Array.isArray(scheme) ? scheme : []);
            } else if (typeof levelData === 'object') {
                // 旧格式：1级是对象（horizontal/vertical）
                if (level === '1' || level === 1) {
                    // 转换为数组格式
                    SPECIAL_BLOCK_RANGE[level] = [];
                    if (levelData.horizontal) {
                        SPECIAL_BLOCK_RANGE[level].push(levelData.horizontal);
                    }
                    if (levelData.vertical) {
                        SPECIAL_BLOCK_RANGE[level].push(levelData.vertical);
                    }
                    if (SPECIAL_BLOCK_RANGE[level].length === 0) {
                        SPECIAL_BLOCK_RANGE[level] = [[[0, 0], [1, 0], [-1, 0]]]; // 默认方案
                    }
                } else {
                    // 其他等级的旧格式（单个数组），转换为数组格式
                    SPECIAL_BLOCK_RANGE[level] = [levelData];
                }
            } else {
                // 其他情况，使用默认值
                SPECIAL_BLOCK_RANGE[level] = [[[0, 0]]];
            }
        });
    }
    if (config.GACHA_PROBABILITY) {
        // 完全替换宝箱概率配置
        if (config.GACHA_PROBABILITY.low) {
            GACHA_PROBABILITY.low = { ...config.GACHA_PROBABILITY.low };
        }
        if (config.GACHA_PROBABILITY.high) {
            GACHA_PROBABILITY.high = { ...config.GACHA_PROBABILITY.high };
        }
    }
    if (config.SECONDARY_ATTRIBUTE_CONFIG) {
        // 完全替换二级属性配置
        if (config.SECONDARY_ATTRIBUTE_CONFIG.probability) {
            SECONDARY_ATTRIBUTE_CONFIG.probability = { ...config.SECONDARY_ATTRIBUTE_CONFIG.probability };
        }
        if (config.SECONDARY_ATTRIBUTE_CONFIG.values) {
            SECONDARY_ATTRIBUTE_CONFIG.values = { ...config.SECONDARY_ATTRIBUTE_CONFIG.values };
        }
    }
    if (config.SPECIAL_BLOCK_BONUS) {
        // 清空原有配置，完全替换
        Object.keys(SPECIAL_BLOCK_BONUS).forEach(key => delete SPECIAL_BLOCK_BONUS[key]);
        Object.assign(SPECIAL_BLOCK_BONUS, config.SPECIAL_BLOCK_BONUS);
    }
    if (config.BOARD_EXPANSION_RULES) {
        BOARD_EXPANSION_RULES.length = 0;
        BOARD_EXPANSION_RULES.push(...config.BOARD_EXPANSION_RULES);
        BOARD_EXPANSION_RULES.sort((a, b) => a.level - b.level);
    }
    if (config.FULL_BOARD_BONUS !== undefined) {
        FULL_BOARD_BONUS = config.FULL_BOARD_BONUS;
    }
    if (config.ACTIVE_DAY_REWARDS) {
        // 兼容旧格式（按天数）和新格式（每天固定）
        Object.keys(config.ACTIVE_DAY_REWARDS).forEach(role => {
            const roleData = config.ACTIVE_DAY_REWARDS[role];
            // 如果是对象且没有数字键，说明是新格式（每天固定）
            if (roleData && typeof roleData === 'object' && !Object.keys(roleData).some(k => !isNaN(k))) {
                ACTIVE_DAY_REWARDS[role] = roleData;
            } else {
                // 旧格式，取第一天的奖励作为每天固定奖励
                const firstDay = Object.keys(roleData).map(Number).sort((a, b) => a - b)[0];
                if (firstDay !== undefined) {
                    ACTIVE_DAY_REWARDS[role] = roleData[firstDay];
                }
            }
        });
    }
    if (config.BOARD_SCHEME_COUNT !== undefined) {
        BOARD_SCHEME_COUNT = config.BOARD_SCHEME_COUNT;
    }
    if (config.AVAILABLE_BLOCK_COMBINATIONS && Array.isArray(config.AVAILABLE_BLOCK_COMBINATIONS)) {
        // 完全替换方块组合配置
        AVAILABLE_BLOCK_COMBINATIONS.length = 0;
        AVAILABLE_BLOCK_COMBINATIONS.push(...config.AVAILABLE_BLOCK_COMBINATIONS);
    }
    if (config.BOARD_LEVEL_EXPANSION && Array.isArray(config.BOARD_LEVEL_EXPANSION)) {
        // 完全替换底板等级扩展配置
        BOARD_LEVEL_EXPANSION.length = 0;
        BOARD_LEVEL_EXPANSION.push(...config.BOARD_LEVEL_EXPANSION);
        BOARD_LEVEL_EXPANSION.sort((a, b) => a.level - b.level);
    }
    if (config.BOARD_LEVEL_EXP_REQUIREMENTS && Array.isArray(config.BOARD_LEVEL_EXP_REQUIREMENTS)) {
        // 完全替换底板等级经验需求配置
        BOARD_LEVEL_EXP_REQUIREMENTS.length = 0;
        BOARD_LEVEL_EXP_REQUIREMENTS.push(...config.BOARD_LEVEL_EXP_REQUIREMENTS);
        BOARD_LEVEL_EXP_REQUIREMENTS.sort((a, b) => a.level - b.level);
    }
    if (config.CHEST_EXP_REWARDS) {
        // 完全替换宝箱经验奖励配置
        CHEST_EXP_REWARDS.low = config.CHEST_EXP_REWARDS.low || 10;
        CHEST_EXP_REWARDS.high = config.CHEST_EXP_REWARDS.high || 50;
    }
}

// 存储选中的方块ID（用于手动合成）
let selectedBlockIds = new Set();

function renderUpgradeInventory() {
    const container = document.getElementById('upgrade-inventory');
    container.innerHTML = '';
    
    // 按等级和类型分组（普通方块和特殊方块分开）
    const byLevelNormal = {};
    const byLevelSpecial = {};
    
    playerInventory.forEach(block => {
        // 检查方块是否在任何方案中使用
        const usage = blockUsageMap.get(block.id);
        if (usage && usage.size > 0) return; // 跳过已使用的方块
        
        if (block.isSpecial) {
            // 特殊方块
            if (!byLevelSpecial[block.level]) {
                byLevelSpecial[block.level] = [];
            }
            byLevelSpecial[block.level].push(block);
        } else {
            // 普通方块
            if (!byLevelNormal[block.level]) {
                byLevelNormal[block.level] = [];
            }
            byLevelNormal[block.level].push(block);
        }
    });
    
    // 更新手动合成按钮显示
    updateManualMergeButton();
    
    // 更新选择器
    const select = document.getElementById('merge-level-select');
    select.innerHTML = '<option value="">选择等级和类型</option>';
    
    // 添加普通方块选项
    Object.keys(byLevelNormal).sort((a, b) => a - b).forEach(level => {
        const count = byLevelNormal[level].length;
        const canMerge = Math.floor(count / 4);
        if (canMerge > 0) {
            const option = document.createElement('option');
            option.value = `normal-${level}`;
            option.textContent = `普通方块 等级 ${level} (剩余 ${count} 个，可合成 ${canMerge} 个)`;
            select.appendChild(option);
        }
    });
    
    // 添加特殊方块选项
    Object.keys(byLevelSpecial).sort((a, b) => a - b).forEach(level => {
        const count = byLevelSpecial[level].length;
        const canMerge = Math.floor(count / 4);
        if (canMerge > 0) {
            const option = document.createElement('option');
            option.value = `special-${level}`;
            option.textContent = `特殊方块 等级 ${level} (剩余 ${count} 个，可合成 ${canMerge} 个)`;
            select.appendChild(option);
        }
    });
    
    // 渲染普通方块
    if (Object.keys(byLevelNormal).length > 0) {
        const normalTitle = document.createElement('h3');
        normalTitle.textContent = '普通方块';
        normalTitle.style.marginTop = '20px';
        normalTitle.style.marginBottom = '15px';
        normalTitle.style.color = '#2c3e50';
        container.appendChild(normalTitle);
        
        Object.keys(byLevelNormal).sort((a, b) => b - a).forEach(level => {
            const levelDiv = document.createElement('div');
            levelDiv.style.width = '100%';
            levelDiv.style.marginBottom = '20px';
            
            const title = document.createElement('h4');
            title.textContent = `等级 ${level} (${byLevelNormal[level].length} 个)`;
            levelDiv.appendChild(title);
            
            const grid = document.createElement('div');
            grid.style.display = 'flex';
            grid.style.flexWrap = 'wrap';
            grid.style.gap = '10px';
            
            byLevelNormal[level].forEach(block => {
                const blockEl = createBlockElement(block);
                // 添加点击选择功能
                blockEl.classList.add('selectable-block');
                if (selectedBlockIds.has(block.id)) {
                    blockEl.classList.add('selected');
                }
                blockEl.addEventListener('click', () => toggleBlockSelection(block, blockEl));
                grid.appendChild(blockEl);
            });
            
            levelDiv.appendChild(grid);
            container.appendChild(levelDiv);
        });
    }
    
    // 渲染特殊方块
    if (Object.keys(byLevelSpecial).length > 0) {
        const specialTitle = document.createElement('h3');
        specialTitle.textContent = '特殊方块';
        specialTitle.style.marginTop = '20px';
        specialTitle.style.marginBottom = '15px';
        specialTitle.style.color = '#9b59b6';
        container.appendChild(specialTitle);
        
        Object.keys(byLevelSpecial).sort((a, b) => b - a).forEach(level => {
            const levelDiv = document.createElement('div');
            levelDiv.style.width = '100%';
            levelDiv.style.marginBottom = '20px';
            
            const title = document.createElement('h4');
            title.textContent = `等级 ${level} (${byLevelSpecial[level].length} 个)`;
            levelDiv.appendChild(title);
            
            const grid = document.createElement('div');
            grid.style.display = 'flex';
            grid.style.flexWrap = 'wrap';
            grid.style.gap = '10px';
            
            byLevelSpecial[level].forEach(block => {
                const blockEl = createBlockElement(block);
                // 添加点击选择功能
                blockEl.classList.add('selectable-block');
                if (selectedBlockIds.has(block.id)) {
                    blockEl.classList.add('selected');
                }
                blockEl.addEventListener('click', () => toggleBlockSelection(block, blockEl));
                grid.appendChild(blockEl);
            });
            
            levelDiv.appendChild(grid);
            container.appendChild(levelDiv);
        });
    }
}

function autoMerge(levelStr) {
    // 解析选择的值：格式为 "normal-1" 或 "special-1"
    const [type, level] = levelStr.split('-');
    const isSpecial = type === 'special';
    const levelNum = parseInt(level);
    
    // 检查方块是否在任何方案中使用
    const blocks = playerInventory.filter(b => {
        const usage = blockUsageMap.get(b.id);
        const isUsed = usage && usage.size > 0;
        return !isUsed && b.isSpecial === isSpecial && b.level === levelNum;
    });
    
    const mergeCount = Math.floor(blocks.length / 4);
    if (mergeCount === 0) {
        alert('数量不足，无法合成');
        return;
    }
    
    // 检查是否有二级属性的方块会被消耗
    const blocksWithSecondaryAttr = blocks.filter(block => {
        if (block.isSpecial) return false; // 特殊方块没有二级属性
        return block.cells.some(cell => cell.secondaryAttr !== null);
    });
    
    // 如果存在含有二级属性的方块，进行二次确认
    if (blocksWithSecondaryAttr.length > 0) {
        // 计算会被消耗的含有二级属性的方块数量（最多显示前4个合成所需的）
        const blocksToConsume = blocks.slice(0, mergeCount * 4);
        const secondaryBlocksToConsume = blocksToConsume.filter(block => {
            if (block.isSpecial) return false;
            return block.cells.some(cell => cell.secondaryAttr !== null);
        });
        
        if (secondaryBlocksToConsume.length > 0) {
            // 显示二级属性详情
            let detailText = '此次合成会消耗以下含有二级属性的方块：\n\n';
            secondaryBlocksToConsume.forEach((block, index) => {
                detailText += `${index + 1}. 等级 ${block.level} 方块：\n`;
                block.cells.forEach((cell, cellIndex) => {
                    if (cell.secondaryAttr) {
                        detailText += `   - 格子${cellIndex + 1}: ${SECONDARY_ATTR_NAMES[cell.secondaryAttr]} ${cell.secondaryValue.toFixed(2)}%\n`;
                    }
                });
                detailText += '\n';
            });
            
            const confirmMessage = `此次合成会消耗 ${secondaryBlocksToConsume.length} 个含有二级属性的方块，是否继续？\n\n${detailText}`;
            if (!confirm(confirmMessage)) {
                return; // 用户取消合成
            }
        }
    }
    
    // 移除用于合成的方块
    for (let i = 0; i < mergeCount * 4; i++) {
        const index = playerInventory.indexOf(blocks[i]);
        if (index > -1) {
            playerInventory.splice(index, 1);
        }
    }
    
    // 创建新方块
    const newLevel = levelNum + 1;
    for (let i = 0; i < mergeCount; i++) {
        if (isSpecial) {
            // 创建特殊方块
            const newBlock = new Block(newLevel, 0, 0, true);
            playerInventory.push(newBlock);
        } else {
            // 创建普通方块
            const shape = Math.floor(Math.random() * TETRIS_SHAPES.length);
            const rotation = [0, 90, 180, 270][Math.floor(Math.random() * 4)];
            const newBlock = new Block(newLevel, shape, rotation);
            playerInventory.push(newBlock);
        }
    }
    
    saveGameData();
    renderUpgradeInventory();
    renderInventory();
    const blockType = isSpecial ? '特殊方块' : '普通方块';
    alert(`成功合成 ${mergeCount} 个等级 ${newLevel} 的${blockType}！`);
}

// 保存和加载游戏数据
function saveGameData() {
    // 保存所有方案的数据
    const schemes = gameBoards.map((board, index) => ({
        blocks: board.blocks.map(({ block, x, y }) => ({
            blockId: block.id,
            x, y
        })),
        specialBlocks: board.specialBlocks.map(({ block, x, y }) => ({
            blockId: block.id,
            x, y
        })),
        currentCellCount: board.currentCellCount
    }));
    
    // 将 blockUsageMap 转换为可序列化的格式
    const blockUsage = {};
    blockUsageMap.forEach((schemeSet, blockId) => {
        blockUsage[blockId] = Array.from(schemeSet);
    });
    
    const data = {
        inventory: playerInventory.map(b => ({
            level: b.level,
            shape: b.shape,
            rotation: b.rotation,
            isSpecial: b.isSpecial,
            rangeType: b.rangeType || null, // 保存特殊方块的加成区域类型
            cells: b.cells,
            id: b.id
        })),
        schemes: schemes,
        blockUsage: blockUsage,
        currentSchemeIndex: currentSchemeIndex,
        gachaCounts: gachaCounts,
        silverKeys: silverKeys,
        goldKeys: goldKeys,
        activeDays: activeDays,
        playerRole: playerRole,
        reachedExpansionLevels: Array.from(reachedExpansionLevels),
        refineCount: refineCount,
        boardLevel: boardLevel,
        boardExp: boardExp
    };
    
    localStorage.setItem('tetrisGameData', JSON.stringify(data));
}

function loadGameData() {
    const dataStr = localStorage.getItem('tetrisGameData');
    if (!dataStr) return;
    
    try {
        const data = JSON.parse(dataStr);
        
        // 恢复方块
        playerInventory = data.inventory.map(bData => {
            const block = new Block(bData.level, bData.shape, bData.rotation, bData.isSpecial, bData.rangeType || null);
            block.id = bData.id;
            block.cells = bData.cells;
            // 如果加载的是旧数据（没有 rangeType），为1级特殊方块设置默认值
            if (block.isSpecial && block.level === 1 && !bData.rangeType) {
                block.rangeType = 'horizontal'; // 默认使用横向
            }
            return block;
        });
        
        // 恢复当前方案索引
        if (data.currentSchemeIndex !== undefined) {
            currentSchemeIndex = Math.min(data.currentSchemeIndex, gameBoards.length - 1);
        }
        
        // 恢复宝箱开启次数
        if (data.gachaCounts) {
            gachaCounts = data.gachaCounts;
        }
        
        // 恢复银色钥匙（如果已保存则使用保存的值，否则使用初始值10）
        if (data.silverKeys !== undefined) {
            silverKeys = data.silverKeys;
        } else {
            silverKeys = 10; // 初始值
        }
        
        // 恢复金色钥匙（如果已保存则使用保存的值，否则使用初始值1）
        if (data.goldKeys !== undefined) {
            goldKeys = data.goldKeys;
        } else {
            goldKeys = 1; // 初始值
        }
        
        // 恢复活跃天数（如果已保存则使用保存的值，否则使用初始值0）
        if (data.activeDays !== undefined) {
            activeDays = data.activeDays;
        } else {
            activeDays = 0; // 初始值
        }
        
        // 恢复玩家角色
        if (data.playerRole) {
            playerRole = data.playerRole;
            updatePlayerRoleDisplay();
        }
        
        // 恢复已完成的扩展等级
        if (data.reachedExpansionLevels && Array.isArray(data.reachedExpansionLevels)) {
            reachedExpansionLevels = new Set(data.reachedExpansionLevels);
        } else {
            reachedExpansionLevels = new Set();
        }
        
        // 恢复洗练次数（如果已保存则使用保存的值，否则使用初始值0）
        if (data.refineCount !== undefined) {
            refineCount = data.refineCount;
        } else {
            refineCount = 0; // 初始值
        }
        
        // 恢复底板等级和经验（如果已保存则使用保存的值，否则使用初始值0）
        if (data.boardLevel !== undefined) {
            boardLevel = data.boardLevel;
        } else {
            boardLevel = 0; // 初始值
        }
        if (data.boardExp !== undefined) {
            boardExp = data.boardExp;
        } else {
            boardExp = 0; // 初始值
        }
        
        // 根据底板等级扩展底板
        expandCellsForAllSchemesByBoardLevel();
        
        // 先恢复所有方案的数据（放置方块到底板）
        // 然后根据恢复的方块数据重新构建 blockUsageMap
        blockUsageMap.clear();
        
        // 恢复所有方案的数据
        if (data.schemes && Array.isArray(data.schemes)) {
            data.schemes.forEach((schemeData, index) => {
                if (index >= gameBoards.length) return;
                const board = gameBoards[index];
                
                // 恢复格子数量
                if (schemeData.currentCellCount) {
                    board.currentCellCount = schemeData.currentCellCount;
                    const coords = board.generateSpiralCoordinates(schemeData.currentCellCount);
                    coords.forEach(([x, y]) => {
                        board.cells.set(`${x},${y}`, null);
                    });
                }
                
                // 恢复普通方块
                if (schemeData.blocks) {
                    schemeData.blocks.forEach(({ blockId, x, y }) => {
                        const block = playerInventory.find(b => b.id === blockId);
                        if (block) {
                            board.placeBlock(block, x, y);
                            // 更新 blockUsageMap
                            if (!blockUsageMap.has(blockId)) {
                                blockUsageMap.set(blockId, new Set());
                            }
                            blockUsageMap.get(blockId).add(index);
                        }
                    });
                }
                
                // 恢复特殊方块
                if (schemeData.specialBlocks) {
                    schemeData.specialBlocks.forEach(({ blockId, x, y }) => {
                        const block = playerInventory.find(b => b.id === blockId);
                        if (block) {
                            board.placeBlock(block, x, y);
                            // 更新 blockUsageMap
                            if (!blockUsageMap.has(blockId)) {
                                blockUsageMap.set(blockId, new Set());
                            }
                            blockUsageMap.get(blockId).add(index);
                        }
                    });
                }
            });
        } else if (data.board) {
            // 兼容旧格式：只恢复第一个方案
            const board = gameBoards[0];
            data.board.blocks.forEach(({ blockId, x, y }) => {
                const block = playerInventory.find(b => b.id === blockId);
                if (block) {
                    board.placeBlock(block, x, y);
                    // 更新 blockUsageMap
                    if (!blockUsageMap.has(blockId)) {
                        blockUsageMap.set(blockId, new Set());
                    }
                    blockUsageMap.get(blockId).add(0); // 旧格式只有第一个方案
                }
            });
            data.board.specialBlocks.forEach(({ blockId, x, y }) => {
                const block = playerInventory.find(b => b.id === blockId);
                if (block) {
                    board.placeBlock(block, x, y);
                    // 更新 blockUsageMap
                    if (!blockUsageMap.has(blockId)) {
                        blockUsageMap.set(blockId, new Set());
                    }
                    blockUsageMap.get(blockId).add(0); // 旧格式只有第一个方案
                }
            });
            // 扩展格子
            const totalLevel = board.getTotalLevel();
            expandCellsForAllSchemes(totalLevel);
        }
        
        // 更新方案选择器
        initializeSchemeSelector();
        
        renderBoard();
        renderInventory();
        updateAttributeDisplay();
    } catch (e) {
        console.error('加载游戏数据失败:', e);
    }
}

// 更新宝箱开启次数显示
function updateGachaCounts() {
    // 更新宝箱页面的显示
    const lowBox = document.querySelector('.gacha-box:first-child');
    const highBox = document.querySelector('.gacha-box:last-child');
    
    if (lowBox) {
        let countEl = lowBox.querySelector('.gacha-count');
        if (!countEl) {
            countEl = document.createElement('div');
            countEl.className = 'gacha-count';
            lowBox.querySelector('p').insertAdjacentElement('afterend', countEl);
        }
        countEl.textContent = `本次重置后开启: ${gachaCounts.low} 次`;
    }
    
    if (highBox) {
        let countEl = highBox.querySelector('.gacha-count');
        if (!countEl) {
            countEl = document.createElement('div');
            countEl.className = 'gacha-count';
            highBox.querySelector('p').insertAdjacentElement('afterend', countEl);
        }
        countEl.textContent = `本次重置后开启: ${gachaCounts.high} 次`;
    }
    
    // 更新主界面的显示（在updateAttributeDisplay中已处理）
    updateAttributeDisplay();
}

// 加载宝箱开启次数
function loadGachaCounts() {
    const dataStr = localStorage.getItem('tetrisGameData');
    if (!dataStr) return;
    
    try {
        const data = JSON.parse(dataStr);
        if (data.gachaCounts) {
            gachaCounts = data.gachaCounts;
        }
    } catch (e) {
        console.error('加载宝箱次数失败:', e);
    }
}

// 定期保存
setInterval(saveGameData, 30000); // 每30秒自动保存

// 渲染数据配置页面
// 配置自动保存防抖定时器
let configSaveTimer = null;

function renderConfigPage() {
    const content = document.getElementById('config-page-content');
    content.innerHTML = '';
    
    // 获取当前激活的标签
    const activeTab = document.querySelector('#config-page .tab-btn.active');
    const tabName = activeTab ? activeTab.dataset.tab : 'table1';
    
    switch(tabName) {
        case 'table1':
            renderAttributeLevelTable(content);
            break;
        case 'table2':
            renderSpecialBlockRangeTable(content);
            break;
        case 'table3':
            renderGachaProbabilityTable(content);
            break;
        case 'table4':
            renderSecondaryAttributeTable(content);
            break;
        case 'table5':
            renderSpecialBlockBonusTable(content);
            break;
        case 'table6':
            renderBoardExpansionTable(content);
            break;
                case 'table7':
                    renderFullBoardBonusTable(content);
                    break;
                case 'table8':
                    renderRoleConfigTable(content);
                    break;
                case 'table9':
                    renderSchemeCountTable(content);
                    break;
                case 'table10':
                    renderBlockCombinationsTable(content);
                    break;
                case 'table11':
                    renderBoardLevelExpansionTable(content);
                    break;
                case 'table12':
                    renderBoardLevelExpRequirementsTable(content);
                    break;
                case 'table13':
                    renderChestExpRewardsTable(content);
                    break;
    }
    
    // 为所有输入框添加自动保存事件监听器
    setupAutoSaveForConfigInputs(content);
}

// 为配置页面的所有输入框设置自动保存
function setupAutoSaveForConfigInputs(container) {
    // 清除之前的定时器
    if (configSaveTimer) {
        clearTimeout(configSaveTimer);
    }
    
    // 使用事件委托，为容器添加统一的 change 事件监听器
    container.addEventListener('change', (e) => {
        if (e.target.tagName === 'INPUT' && e.target.type === 'number') {
            // 使用防抖，延迟500ms后保存
            if (configSaveTimer) {
                clearTimeout(configSaveTimer);
            }
            configSaveTimer = setTimeout(() => {
                saveConfigData();
                console.log('配置已自动保存，版本号已更新');
            }, 300);
        }
    }, true); // 使用捕获阶段，确保能捕获到所有事件
    
    // 为特殊方块区域的点击事件添加自动保存（使用事件委托）
    container.addEventListener('click', (e) => {
        if (e.target.classList.contains('range-config-cell')) {
            const cell = e.target;
            const x = parseInt(cell.dataset.x);
            const y = parseInt(cell.dataset.y);
            if (x === 0 && y === 0) return; // 中心格子不能切换
            
            // 使用防抖，延迟500ms后保存
            if (configSaveTimer) {
                clearTimeout(configSaveTimer);
            }
            configSaveTimer = setTimeout(() => {
                saveConfigData();
                console.log('配置已自动保存，版本号已更新');
            }, 300);
        }
    }, true);
}

// 渲染属性等级表
function renderAttributeLevelTable(container) {
    const table = document.createElement('table');
    table.className = 'config-table';
    table.innerHTML = `
        <thead>
            <tr>
                <th>等级</th>
                <th>攻击</th>
                <th>防御</th>
                <th>生命</th>
            </tr>
        </thead>
        <tbody id="attr-level-tbody"></tbody>
    `;
    
    const tbody = table.querySelector('#attr-level-tbody');
    for (let level = 1; level <= 10; level++) {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${level}</td>
            <td><input type="number" data-level="${level}" data-attr="attack" value="${ATTRIBUTE_LEVEL_TABLE[level].attack}"></td>
            <td><input type="number" data-level="${level}" data-attr="defense" value="${ATTRIBUTE_LEVEL_TABLE[level].defense}"></td>
            <td><input type="number" data-level="${level}" data-attr="health" value="${ATTRIBUTE_LEVEL_TABLE[level].health}"></td>
        `;
        tbody.appendChild(row);
    }
    
    container.appendChild(table);
}

// 渲染特殊方块区域表（图形化配置，支持多方案）
function renderSpecialBlockRangeTable(container) {
    const div = document.createElement('div');
    div.innerHTML = '<p>特殊方块影响区域配置（点击格子来切换是否在影响范围内）</p>';
    div.innerHTML += '<p style="color: #7f8c8d; font-size: 12px;">白色格子 = 不在范围内，紫色格子 = 在范围内，中心格子（深紫色）= 特殊方块位置</p>';
    div.innerHTML += '<p style="color: #7f8c8d; font-size: 12px;">每个等级可以有多个区域方案，特殊方块生成时会从该等级的所有方案中随机选择一个</p>';
    
    // 确保SPECIAL_BLOCK_RANGE是对象格式
    if (!SPECIAL_BLOCK_RANGE || typeof SPECIAL_BLOCK_RANGE !== 'object') {
        SPECIAL_BLOCK_RANGE = {};
    }
    
    for (let level = 1; level <= 10; level++) {
        const levelDiv = document.createElement('div');
        levelDiv.className = 'special-range-level-section';
        levelDiv.style.marginBottom = '30px';
        levelDiv.style.padding = '15px';
        levelDiv.style.background = 'white';
        levelDiv.style.borderRadius = '5px';
        levelDiv.innerHTML = `<h4>等级 ${level} 特殊方块区域方案</h4>`;
        
        // 获取该等级的所有方案
        let levelSchemes = SPECIAL_BLOCK_RANGE[level];
        if (!levelSchemes) {
            levelSchemes = [];
            SPECIAL_BLOCK_RANGE[level] = levelSchemes;
        }
        
        // 兼容旧格式：转换为新格式（数组的数组）
        if (!Array.isArray(levelSchemes)) {
            // 旧格式对象（1级的horizontal/vertical）
            if (typeof levelSchemes === 'object' && levelSchemes !== null) {
                const schemes = [];
                if (levelSchemes.horizontal && Array.isArray(levelSchemes.horizontal)) {
                    schemes.push(levelSchemes.horizontal);
                }
                if (levelSchemes.vertical && Array.isArray(levelSchemes.vertical)) {
                    schemes.push(levelSchemes.vertical);
                }
                levelSchemes = schemes.length > 0 ? schemes : [[]];
            } else if (Array.isArray(levelSchemes) && levelSchemes.length > 0) {
                // 检查是否是坐标数组（旧格式）还是数组的数组（新格式）
                if (!Array.isArray(levelSchemes[0])) {
                    // 单个坐标数组，包装成数组的数组
                    levelSchemes = [levelSchemes];
                }
                // 否则已经是数组的数组格式
            } else {
                levelSchemes = [[]];
            }
            SPECIAL_BLOCK_RANGE[level] = levelSchemes;
        }
        
        // 确保每个方案都是有效的数组，并过滤无效坐标
        levelSchemes = levelSchemes.map(scheme => {
            if (!Array.isArray(scheme)) {
                return [];
            }
            // 过滤掉无效的坐标
            return scheme.filter(coord => {
                return Array.isArray(coord) && 
                       coord.length >= 2 && 
                       typeof coord[0] === 'number' && 
                       typeof coord[1] === 'number' &&
                       !isNaN(coord[0]) && 
                       !isNaN(coord[1]);
            });
        });
        SPECIAL_BLOCK_RANGE[level] = levelSchemes;
        
        // 如果该等级没有方案，添加一个空方案
        if (levelSchemes.length === 0) {
            levelSchemes.push([]);
        }
        
        // 方案列表容器
        const schemesContainer = document.createElement('div');
        schemesContainer.className = 'schemes-container';
        
        // 渲染每个方案
        levelSchemes.forEach((scheme, schemeIndex) => {
            const schemeDiv = createSchemeEditor(level, schemeIndex, scheme);
            schemesContainer.appendChild(schemeDiv);
        });
        
        levelDiv.appendChild(schemesContainer);
        
        // 添加方案按钮
        const addSchemeBtn = document.createElement('button');
        addSchemeBtn.textContent = '+ 添加方案';
        addSchemeBtn.className = 'add-scheme-btn';
        addSchemeBtn.style.marginTop = '10px';
        addSchemeBtn.style.padding = '8px 16px';
        addSchemeBtn.style.backgroundColor = '#3498db';
        addSchemeBtn.style.color = 'white';
        addSchemeBtn.style.border = 'none';
        addSchemeBtn.style.borderRadius = '4px';
        addSchemeBtn.style.cursor = 'pointer';
        addSchemeBtn.addEventListener('click', () => {
            const newScheme = [];
            SPECIAL_BLOCK_RANGE[level].push(newScheme);
            const newSchemeDiv = createSchemeEditor(level, SPECIAL_BLOCK_RANGE[level].length - 1, newScheme);
            schemesContainer.appendChild(newSchemeDiv);
            saveConfigData();
        });
        levelDiv.appendChild(addSchemeBtn);
        
        div.appendChild(levelDiv);
    }
    
    container.appendChild(div);
}

// 创建方案编辑器（可视化网格样式）
function createSchemeEditor(level, schemeIndex, scheme) {
    const schemeDiv = document.createElement('div');
    schemeDiv.className = 'scheme-editor';
    schemeDiv.style.marginBottom = '20px';
    schemeDiv.style.padding = '15px';
    schemeDiv.style.border = '1px solid #bdc3c7';
    schemeDiv.style.borderRadius = '4px';
    schemeDiv.style.backgroundColor = 'white';
    
    const schemeHeader = document.createElement('div');
    schemeHeader.style.display = 'flex';
    schemeHeader.style.justifyContent = 'space-between';
    schemeHeader.style.alignItems = 'center';
    schemeHeader.style.marginBottom = '10px';
    
    const schemeTitle = document.createElement('strong');
    schemeTitle.textContent = `方案 ${schemeIndex + 1}`;
    schemeTitle.style.fontSize = '14px';
    schemeHeader.appendChild(schemeTitle);
    
    // 删除按钮（如果方案数量大于1）
    if (SPECIAL_BLOCK_RANGE[level].length > 1) {
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = '删除方案';
        deleteBtn.className = 'delete-scheme-btn';
        deleteBtn.style.padding = '4px 8px';
        deleteBtn.style.backgroundColor = '#e74c3c';
        deleteBtn.style.color = 'white';
        deleteBtn.style.border = 'none';
        deleteBtn.style.borderRadius = '3px';
        deleteBtn.style.cursor = 'pointer';
        deleteBtn.style.fontSize = '12px';
        deleteBtn.addEventListener('click', () => {
            SPECIAL_BLOCK_RANGE[level].splice(schemeIndex, 1);
            schemeDiv.remove();
            // 重新渲染该等级的所有方案（更新索引）
            const levelDiv = schemeDiv.closest('.special-range-level-section');
            if (levelDiv) {
                const schemesContainer = levelDiv.querySelector('.schemes-container');
                schemesContainer.innerHTML = '';
                SPECIAL_BLOCK_RANGE[level].forEach((s, idx) => {
                    const newSchemeDiv = createSchemeEditor(level, idx, s);
                    schemesContainer.appendChild(newSchemeDiv);
                });
            }
            saveConfigData();
        });
        schemeHeader.appendChild(deleteBtn);
    }
    
    schemeDiv.appendChild(schemeHeader);
    
    // 创建可视化网格
    const gridContainer = document.createElement('div');
    gridContainer.className = 'range-grid-container';
    gridContainer.dataset.level = level;
    gridContainer.dataset.schemeIndex = schemeIndex;
    
    // 计算网格大小
    // 确保scheme是数组，并且每个元素都是有效的坐标数组
    if (!Array.isArray(scheme)) {
        scheme = [];
    }
    // 过滤掉无效的坐标
    const validCoords = scheme.filter(coord => Array.isArray(coord) && coord.length >= 2 && typeof coord[0] === 'number' && typeof coord[1] === 'number');
    
    let allX = [];
    let allY = [];
    if (validCoords.length > 0) {
        allX = validCoords.map(([x]) => x);
        allY = validCoords.map(([, y]) => y);
    }
    
    const minX = allX.length > 0 ? Math.min(...allX, -3) : -3;
    const maxX = allX.length > 0 ? Math.max(...allX, 3) : 3;
    const minY = allY.length > 0 ? Math.min(...allY, -3) : -3;
    const maxY = allY.length > 0 ? Math.max(...allY, 3) : 3;
    const gridSize = Math.max(maxX - minX + 1, maxY - minY + 1, 7);
    const centerOffset = Math.floor(gridSize / 2);
    
    const grid = document.createElement('div');
    grid.className = 'range-config-grid';
    grid.style.display = 'grid';
    grid.style.gridTemplateColumns = `repeat(${gridSize}, 35px)`;
    grid.style.gap = '2px';
    grid.style.margin = '10px 0';
    
    const rangeSet = new Set(validCoords.map(([x, y]) => `${x},${y}`));
    
    // 创建网格单元格
    for (let row = 0; row < gridSize; row++) {
        for (let col = 0; col < gridSize; col++) {
            const cell = document.createElement('div');
            const x = col - centerOffset;
            const y = row - centerOffset;
            const key = `${x},${y}`;
            
            cell.className = 'range-config-cell';
            cell.dataset.x = x;
            cell.dataset.y = y;
            cell.dataset.level = level;
            cell.dataset.schemeIndex = schemeIndex;
            
            if (x === 0 && y === 0) {
                cell.classList.add('center-cell');
                cell.textContent = '★';
            } else if (rangeSet.has(key)) {
                cell.classList.add('active');
            }
            
            cell.addEventListener('click', () => {
                if (x === 0 && y === 0) return; // 中心格子不能切换
                
                cell.classList.toggle('active');
                
                // 更新scheme数组
                const coord = [x, y];
                if (cell.classList.contains('active')) {
                    // 添加坐标
                    const exists = scheme.some(c => c[0] === x && c[1] === y);
                    if (!exists) {
                        scheme.push(coord);
                    }
                } else {
                    // 移除坐标
                    const index = scheme.findIndex(c => c[0] === x && c[1] === y);
                    if (index >= 0) {
                        scheme.splice(index, 1);
                    }
                }
                
                saveConfigData();
            });
            
            grid.appendChild(cell);
        }
    }
    
    gridContainer.appendChild(grid);
    schemeDiv.appendChild(gridContainer);
    
    return schemeDiv;
}

// 渲染宝箱概率表
function renderGachaProbabilityTable(container) {
    const div = document.createElement('div');
    
    // 低级宝箱
    const lowDiv = document.createElement('div');
    lowDiv.innerHTML = '<h3>低级宝箱</h3>';
    const lowTable = document.createElement('table');
    lowTable.className = 'config-table';
    lowTable.innerHTML = `
        <thead>
            <tr><th>等级</th><th>概率</th></tr>
        </thead>
        <tbody id="low-gacha-tbody"></tbody>
    `;
    const lowTbody = lowTable.querySelector('#low-gacha-tbody');
    [1, 2, 3].forEach(level => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${level}</td>
            <td><input type="number" step="0.01" min="0" max="1" data-type="low" data-level="${level}" value="${GACHA_PROBABILITY.low[level]}"></td>
        `;
        lowTbody.appendChild(row);
    });
    lowDiv.appendChild(lowTable);
    div.appendChild(lowDiv);
    
    // 高级宝箱
    const highDiv = document.createElement('div');
    highDiv.style.marginTop = '20px';
    highDiv.innerHTML = '<h3>高级宝箱</h3>';
    const highTable = document.createElement('table');
    highTable.className = 'config-table';
    highTable.innerHTML = `
        <thead>
            <tr><th>等级/类型</th><th>概率</th></tr>
        </thead>
        <tbody id="high-gacha-tbody"></tbody>
    `;
    const highTbody = highTable.querySelector('#high-gacha-tbody');
    [2, 3, 4, 5].forEach(level => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${level}</td>
            <td><input type="number" step="0.01" min="0" max="1" data-type="high" data-level="${level}" value="${GACHA_PROBABILITY.high[level]}"></td>
        `;
        highTbody.appendChild(row);
    });
    const specialRow = document.createElement('tr');
    specialRow.innerHTML = `
        <td>特殊方块</td>
        <td><input type="number" step="0.01" min="0" max="1" data-type="high" data-level="special" value="${GACHA_PROBABILITY.high.special}"></td>
    `;
    highTbody.appendChild(specialRow);
    highDiv.appendChild(highTable);
    div.appendChild(highDiv);
    
    container.appendChild(div);
}

// 渲染二级属性配置表
function renderSecondaryAttributeTable(container) {
    const div = document.createElement('div');
    
    // 概率表
    const probDiv = document.createElement('div');
    probDiv.innerHTML = '<h3>二级属性出现概率</h3>';
    const probTable = document.createElement('table');
    probTable.className = 'config-table';
    probTable.innerHTML = `
        <thead>
            <tr><th>等级</th><th>概率</th></tr>
        </thead>
        <tbody id="secondary-prob-tbody"></tbody>
    `;
    const probTbody = probTable.querySelector('#secondary-prob-tbody');
    [5, 6, 7, 8, 9, 10].forEach(level => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${level}</td>
            <td><input type="number" step="0.01" min="0" max="1" data-config="probability" data-level="${level}" value="${SECONDARY_ATTRIBUTE_CONFIG.probability[level] || 0}"></td>
        `;
        probTbody.appendChild(row);
    });
    probDiv.appendChild(probTable);
    div.appendChild(probDiv);
    
    // 数值范围表
    const valueDiv = document.createElement('div');
    valueDiv.style.marginTop = '20px';
    valueDiv.innerHTML = '<h3>二级属性数值范围</h3>';
    const valueTable = document.createElement('table');
    valueTable.className = 'config-table';
    valueTable.innerHTML = `
        <thead>
            <tr><th>等级</th><th>最小值</th><th>最大值</th></tr>
        </thead>
        <tbody id="secondary-value-tbody"></tbody>
    `;
    const valueTbody = valueTable.querySelector('#secondary-value-tbody');
    [5, 6, 7, 8, 9, 10].forEach(level => {
        const row = document.createElement('tr');
        const config = SECONDARY_ATTRIBUTE_CONFIG.values[level] || { min: 0, max: 0 };
        row.innerHTML = `
            <td>${level}</td>
            <td><input type="number" data-config="values" data-level="${level}" data-range="min" value="${config.min}"></td>
            <td><input type="number" data-config="values" data-level="${level}" data-range="max" value="${config.max}"></td>
        `;
        valueTbody.appendChild(row);
    });
    valueDiv.appendChild(valueTable);
    div.appendChild(valueDiv);
    
    container.appendChild(div);
}

// 渲染特殊方块加成表
function renderSpecialBlockBonusTable(container) {
    const table = document.createElement('table');
    table.className = 'config-table';
    table.innerHTML = `
        <thead>
            <tr>
                <th>等级</th>
                <th>加成比例</th>
            </tr>
        </thead>
        <tbody id="special-bonus-tbody"></tbody>
    `;
    
    const tbody = table.querySelector('#special-bonus-tbody');
    for (let level = 1; level <= 5; level++) {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${level}</td>
            <td><input type="number" step="0.01" min="0" max="1" data-level="${level}" value="${SPECIAL_BLOCK_BONUS[level]}"></td>
        `;
        tbody.appendChild(row);
    }
    
    container.appendChild(table);
}

// 渲染底板扩展规则表
function renderBoardExpansionTable(container) {
    const div = document.createElement('div');
    div.innerHTML = '<p>配置方块总等级达到多少时，底板扩展到多少个格子</p>';
    
    const table = document.createElement('table');
    table.className = 'config-table';
    table.innerHTML = `
        <thead>
            <tr>
                <th>序号</th>
                <th>总等级要求</th>
                <th>格子数量</th>
                <th>操作</th>
            </tr>
        </thead>
        <tbody id="expansion-rules-tbody"></tbody>
    `;
    
    const tbody = table.querySelector('#expansion-rules-tbody');
    
    // 渲染现有规则
    function renderRules() {
        tbody.innerHTML = '';
        BOARD_EXPANSION_RULES.forEach((rule, index) => {
            const row = document.createElement('tr');
            row.dataset.index = index;
            row.innerHTML = `
                <td>${index + 1}</td>
                <td><input type="number" min="0" data-field="level" value="${rule.level}"></td>
                <td><input type="number" min="25" data-field="count" value="${rule.count}"></td>
                <td><button class="delete-rule-btn" data-index="${index}">删除</button></td>
            `;
            tbody.appendChild(row);
        });
    }
    
    renderRules();
    
    // 添加新规则按钮
    const addBtn = document.createElement('button');
    addBtn.className = 'add-rule-btn';
    addBtn.textContent = '添加规则';
    addBtn.style.marginTop = '10px';
    addBtn.style.padding = '8px 15px';
    addBtn.style.background = '#3498db';
    addBtn.style.color = 'white';
    addBtn.style.border = 'none';
    addBtn.style.borderRadius = '5px';
    addBtn.style.cursor = 'pointer';
    addBtn.addEventListener('click', () => {
        const lastRule = BOARD_EXPANSION_RULES[BOARD_EXPANSION_RULES.length - 1];
        const newLevel = lastRule ? lastRule.level + 5 : 10;
        const newCount = lastRule ? lastRule.count + 3 : 28;
        BOARD_EXPANSION_RULES.push({ level: newLevel, count: newCount });
        renderRules();
        // 重新设置自动保存（因为DOM已更新）
        setTimeout(() => {
            setupAutoSaveForConfigInputs(container);
        }, 100);
    });
    
    // 删除规则
    tbody.addEventListener('click', (e) => {
        if (e.target.classList.contains('delete-rule-btn')) {
            const index = parseInt(e.target.dataset.index);
            if (BOARD_EXPANSION_RULES.length > 1) {
                BOARD_EXPANSION_RULES.splice(index, 1);
                renderRules();
                // 重新设置自动保存（因为DOM已更新）
                setTimeout(() => {
                    setupAutoSaveForConfigInputs(container);
                    // 触发自动保存
                    if (configSaveTimer) {
                        clearTimeout(configSaveTimer);
                    }
                    configSaveTimer = setTimeout(() => {
                        saveConfigData();
                        console.log('配置已自动保存，版本号已更新');
                    }, 500);
                }, 100);
            } else {
                alert('至少需要保留一条规则');
            }
        }
    });
    
    div.appendChild(table);
    div.appendChild(addBtn);
    container.appendChild(div);
}

// 渲染角色配置表
function renderRoleConfigTable(container) {
    const div = document.createElement('div');
    div.innerHTML = '<p>配置各角色每天获得的奖励（每天都有固定奖励）</p>';
    
    // 角色选择
    const roleSelectDiv = document.createElement('div');
    roleSelectDiv.style.marginBottom = '20px';
    roleSelectDiv.innerHTML = '<label>当前角色：</label>';
    const roleSelect = document.createElement('select');
    roleSelect.id = 'player-role-select';
    roleSelect.style.marginLeft = '10px';
    roleSelect.style.padding = '5px 10px';
    ['非R', '小R', '中R', '大R', '超R'].forEach(role => {
        const option = document.createElement('option');
        option.value = role;
        const avatar = PLAYER_ROLE_AVATARS[role] || '👤';
        option.textContent = `${avatar} ${role}`;
        if (role === playerRole) {
            option.selected = true;
        }
        roleSelect.appendChild(option);
    });
    roleSelect.addEventListener('change', (e) => {
        playerRole = e.target.value;
        saveGameData();
        updateActiveDaysDisplay();
        updatePlayerRoleDisplay();
    });
    roleSelectDiv.appendChild(roleSelect);
    div.appendChild(roleSelectDiv);
    
    // 奖励配置表格
    const table = document.createElement('table');
    table.className = 'config-table';
    table.style.marginTop = '20px';
    table.innerHTML = `
        <thead>
            <tr>
                <th>角色</th>
                <th>每天银色钥匙</th>
                <th>每天金色钥匙</th>
            </tr>
        </thead>
        <tbody id="role-rewards-tbody"></tbody>
    `;
    
    const tbody = table.querySelector('#role-rewards-tbody');
    
    // 渲染奖励配置
    function renderRewards() {
        tbody.innerHTML = '';
        const roles = ['非R', '小R', '中R', '大R', '超R'];
        
        roles.forEach(role => {
            const reward = ACTIVE_DAY_REWARDS[role] || { silverKeys: 0, goldKeys: 0 };
            const row = document.createElement('tr');
            row.dataset.role = role;
            row.innerHTML = `
                <td>${role}</td>
                <td><input type="number" min="0" data-field="silverKeys" value="${reward.silverKeys || 0}" style="width: 100px;"></td>
                <td><input type="number" min="0" data-field="goldKeys" value="${reward.goldKeys || 0}" style="width: 100px;"></td>
            `;
            tbody.appendChild(row);
        });
    }
    
    renderRewards();
    
    div.appendChild(table);
    container.appendChild(div);
}

// 渲染方案数量配置表
function renderSchemeCountTable(container) {
    const div = document.createElement('div');
    div.innerHTML = '<p>配置底板方案数量（修改后需要刷新页面生效）</p>';
    
    const table = document.createElement('table');
    table.className = 'config-table';
    table.style.marginTop = '20px';
    table.innerHTML = `
        <thead>
            <tr>
                <th>配置项</th>
                <th>方案数量</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td>底板方案数量</td>
                <td><input type="number" min="1" max="10" id="scheme-count-input" value="${BOARD_SCHEME_COUNT}"></td>
            </tr>
        </tbody>
    `;
    
    div.appendChild(table);
    container.appendChild(div);
}

// 渲染方案数量配置表
function renderSchemeCountTable(container) {
    const div = document.createElement('div');
    div.innerHTML = '<p>配置底板方案数量（修改后需要刷新页面生效）</p>';
    
    const table = document.createElement('table');
    table.className = 'config-table';
    table.style.marginTop = '20px';
    table.innerHTML = `
        <thead>
            <tr>
                <th>配置项</th>
                <th>方案数量</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td>底板方案数量</td>
                <td><input type="number" min="1" max="10" id="scheme-count-input" value="${BOARD_SCHEME_COUNT}"></td>
            </tr>
        </tbody>
    `;
    
    div.appendChild(table);
    container.appendChild(div);
}

// 渲染方块组合配置表
function renderBlockCombinationsTable(container) {
    const div = document.createElement('div');
    div.innerHTML = '<p>配置宝箱中可能出现的方块种类（形状和旋转组合）</p>';
    div.innerHTML += '<p style="color: #7f8c8d; font-size: 12px;">勾选表示该组合可以在宝箱中出现，取消勾选表示该组合不会在宝箱中出现</p>';
    
    // 确保所有组合都存在（初始化缺失的组合）
    // 只有rotation=0的组合默认启用，其他角度默认禁用
    for (let shape = 0; shape < TETRIS_SHAPES.length; shape++) {
        for (let rotation of [0, 90, 180, 270]) {
            const exists = AVAILABLE_BLOCK_COMBINATIONS.some(
                c => c.shape === shape && c.rotation === rotation
            );
            if (!exists) {
                AVAILABLE_BLOCK_COMBINATIONS.push({
                    shape,
                    rotation,
                    enabled: rotation === 0  // 只有0度旋转默认启用
                });
            }
        }
    }
    
    const table = document.createElement('table');
    table.className = 'config-table';
    table.style.marginTop = '20px';
    
    const thead = document.createElement('thead');
    thead.innerHTML = `
        <tr>
            <th style="width: 120px;">预览</th>
            <th style="width: 100px;">形状</th>
            <th style="width: 100px;">旋转角度</th>
            <th style="width: 120px;">启用/禁用</th>
        </tr>
    `;
    table.appendChild(thead);
    
    const tbody = document.createElement('tbody');
    
    // 按形状分组显示
    for (let shape = 0; shape < TETRIS_SHAPES.length; shape++) {
        const rotations = [0, 90, 180, 270];
        rotations.forEach((rotation) => {
            const row = document.createElement('tr');
            
            // 查找对应的配置项
            const combination = AVAILABLE_BLOCK_COMBINATIONS.find(
                c => c.shape === shape && c.rotation === rotation
            );
            
            // 预览单元格
            const previewCell = document.createElement('td');
            previewCell.style.textAlign = 'center';
            previewCell.style.padding = '10px';
            previewCell.style.verticalAlign = 'middle';
            const preview = renderBlockPreview(shape, rotation);
            previewCell.appendChild(preview);
            
            // 形状单元格
            const shapeCell = document.createElement('td');
            shapeCell.textContent = SHAPE_NAMES[shape] || `形状${shape}`;
            shapeCell.style.textAlign = 'center';
            shapeCell.style.verticalAlign = 'middle';
            
            // 旋转角度单元格
            const rotationCell = document.createElement('td');
            rotationCell.textContent = `${rotation}°`;
            rotationCell.style.textAlign = 'center';
            rotationCell.style.verticalAlign = 'middle';
            
            // 启用/禁用单元格
            const enableCell = document.createElement('td');
            enableCell.style.textAlign = 'center';
            enableCell.style.verticalAlign = 'middle';
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = combination ? combination.enabled : true;
            checkbox.dataset.shape = shape;
            checkbox.dataset.rotation = rotation;
            checkbox.addEventListener('change', () => {
                if (combination) {
                    combination.enabled = checkbox.checked;
                    row.style.opacity = checkbox.checked ? '1' : '0.5';
                    saveConfigData();
                }
            });
            enableCell.appendChild(checkbox);
            
            if (!combination || !combination.enabled) {
                row.style.opacity = '0.5';
            }
            
            row.appendChild(previewCell);
            row.appendChild(shapeCell);
            row.appendChild(rotationCell);
            row.appendChild(enableCell);
            
            tbody.appendChild(row);
        });
    }
    
    table.appendChild(tbody);
    div.appendChild(table);
    container.appendChild(div);
}

// 渲染方块预览（用于配置页面）
function renderBlockPreview(shape, rotation) {
    const block = new Block(1, shape, rotation, false);
    const container = document.createElement('div');
    container.style.display = 'inline-block';
    container.style.verticalAlign = 'middle';
    
    const grid = document.createElement('div');
    grid.style.display = 'inline-grid';
    grid.style.border = '1px solid #ddd';
    grid.style.borderRadius = '3px';
    grid.style.padding = '2px';
    grid.style.backgroundColor = '#f8f9fa';
    
    const positions = block.getPositions(0, 0);
    const minX = Math.min(...positions.map(([x]) => x));
    const minY = Math.min(...positions.map(([, y]) => y));
    const maxX = Math.max(...positions.map(([x]) => x));
    const maxY = Math.max(...positions.map(([, y]) => y));
    
    const cellSize = 12;
    grid.style.gridTemplateColumns = `repeat(${maxX - minX + 1}, ${cellSize}px)`;
    grid.style.gridTemplateRows = `repeat(${maxY - minY + 1}, ${cellSize}px)`;
    grid.style.gap = '1px';
    
    positions.forEach(([x, y]) => {
        const cellEl = document.createElement('div');
        cellEl.style.backgroundColor = '#3498db';
        cellEl.style.border = '1px solid #2980b9';
        cellEl.style.borderRadius = '2px';
        cellEl.style.gridColumn = (x - minX + 1);
        cellEl.style.gridRow = (y - minY + 1);
        grid.appendChild(cellEl);
    });
    
    container.appendChild(grid);
    return container;
}

// 已删除：第二个 renderSpecialBlockRangeTable 函数（table11），保留 table2 的函数即可

// 渲染底板等级扩展配置表
function renderBoardLevelExpansionTable(container) {
    const div = document.createElement('div');
    div.innerHTML = '<p>配置底板等级与格子数量增加的关系</p>';
    div.innerHTML += '<p style="color: #7f8c8d; font-size: 12px;">每个等级可以配置增加的格子数量</p>';
    
    if (!BOARD_LEVEL_EXPANSION || !Array.isArray(BOARD_LEVEL_EXPANSION)) {
        BOARD_LEVEL_EXPANSION = [];
    }
    
    const table = document.createElement('table');
    table.className = 'config-table';
    table.style.marginTop = '20px';
    
    const thead = document.createElement('thead');
    thead.innerHTML = `
        <tr>
            <th>底板等级</th>
            <th>增加的格子数</th>
        </tr>
    `;
    table.appendChild(thead);
    
    const tbody = document.createElement('tbody');
    BOARD_LEVEL_EXPANSION.forEach((expansion, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><input type="number" min="1" class="board-level-expansion-level" data-index="${index}" value="${expansion.level}"></td>
            <td><input type="number" min="0" class="board-level-expansion-cell" data-index="${index}" value="${expansion.cellIncrease}"></td>
        `;
        tbody.appendChild(row);
    });
    
    table.appendChild(tbody);
    div.appendChild(table);
    
    // 添加按钮
    const addBtn = document.createElement('button');
    addBtn.textContent = '+ 添加等级';
    addBtn.style.marginTop = '10px';
    addBtn.addEventListener('click', () => {
        const newLevel = BOARD_LEVEL_EXPANSION.length + 1;
        BOARD_LEVEL_EXPANSION.push({ level: newLevel, cellIncrease: 3 });
        renderConfigPage();
        saveConfigData();
    });
    div.appendChild(addBtn);
    
    container.appendChild(div);
}

// 渲染底板等级经验需求配置表
function renderBoardLevelExpRequirementsTable(container) {
    const div = document.createElement('div');
    div.innerHTML = '<p>配置底板等级升级所需的积分经验</p>';
    div.innerHTML += '<p style="color: #7f8c8d; font-size: 12px;">每个等级可以配置升级所需的总经验值</p>';
    
    if (!BOARD_LEVEL_EXP_REQUIREMENTS || !Array.isArray(BOARD_LEVEL_EXP_REQUIREMENTS)) {
        BOARD_LEVEL_EXP_REQUIREMENTS = [];
    }
    
    const table = document.createElement('table');
    table.className = 'config-table';
    table.style.marginTop = '20px';
    
    const thead = document.createElement('thead');
    thead.innerHTML = `
        <tr>
            <th>底板等级</th>
            <th>所需经验</th>
        </tr>
    `;
    table.appendChild(thead);
    
    const tbody = document.createElement('tbody');
    BOARD_LEVEL_EXP_REQUIREMENTS.forEach((requirement, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><input type="number" min="1" class="board-level-exp-req-level" data-index="${index}" value="${requirement.level}"></td>
            <td><input type="number" min="0" class="board-level-exp-req-exp" data-index="${index}" value="${requirement.expRequired}"></td>
        `;
        tbody.appendChild(row);
    });
    
    table.appendChild(tbody);
    div.appendChild(table);
    
    // 添加按钮
    const addBtn = document.createElement('button');
    addBtn.textContent = '+ 添加等级';
    addBtn.style.marginTop = '10px';
    addBtn.addEventListener('click', () => {
        const newLevel = BOARD_LEVEL_EXP_REQUIREMENTS.length + 1;
        const newExp = (BOARD_LEVEL_EXP_REQUIREMENTS.length + 1) * 100;
        BOARD_LEVEL_EXP_REQUIREMENTS.push({ level: newLevel, expRequired: newExp });
        renderConfigPage();
        saveConfigData();
    });
    div.appendChild(addBtn);
    
    container.appendChild(div);
}

// 渲染宝箱经验奖励配置表
function renderChestExpRewardsTable(container) {
    const div = document.createElement('div');
    div.innerHTML = '<p>配置开启宝箱获得的积分经验</p>';
    
    if (!CHEST_EXP_REWARDS) {
        CHEST_EXP_REWARDS = { low: 10, high: 50 };
    }
    
    const table = document.createElement('table');
    table.className = 'config-table';
    table.style.marginTop = '20px';
    
    const thead = document.createElement('thead');
    thead.innerHTML = `
        <tr>
            <th>宝箱类型</th>
            <th>每次开启获得经验</th>
        </tr>
    `;
    table.appendChild(thead);
    
    const tbody = document.createElement('tbody');
    tbody.innerHTML = `
        <tr>
            <td>低级宝箱</td>
            <td><input type="number" min="0" id="chest-exp-low" value="${CHEST_EXP_REWARDS.low}"></td>
        </tr>
        <tr>
            <td>高级宝箱</td>
            <td><input type="number" min="0" id="chest-exp-high" value="${CHEST_EXP_REWARDS.high}"></td>
        </tr>
    `;
    
    table.appendChild(tbody);
    div.appendChild(table);
    container.appendChild(div);
}

// 渲染全满加成配置表
function renderFullBoardBonusTable(container) {
    const div = document.createElement('div');
    div.innerHTML = '<p>配置底板填满后，一级属性（攻击、防御、生命）的加成比例</p>';
    div.innerHTML += '<p style="color: #7f8c8d; font-size: 12px;">例如：1.5 表示增加50%（最终为150%），2.0 表示增加100%（最终为200%）</p>';
    
    const table = document.createElement('table');
    table.className = 'config-table';
    table.style.marginTop = '20px';
    table.innerHTML = `
        <thead>
            <tr>
                <th>配置项</th>
                <th>加成比例</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td>底板填满后一级属性加成</td>
                <td><input type="number" step="0.1" min="1" id="full-board-bonus-input" value="${FULL_BOARD_BONUS}"></td>
            </tr>
        </tbody>
    `;
    
    div.appendChild(table);
    container.appendChild(div);
}

// 初始化配置页面
function initializeConfigPage() {
    // 标签切换
    document.querySelectorAll('#config-page .tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('#config-page .tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderConfigPage();
        });
    });
    
    // 保存配置
    document.getElementById('save-config-btn').addEventListener('click', () => {
        saveConfigData();
        alert('配置已保存！需要刷新页面使配置生效。');
    });
    
    // 保存为默认配置
    document.getElementById('save-as-default-btn').addEventListener('click', () => {
        if (confirm('确定要将当前配置保存为默认配置吗？重置系统时将使用此配置作为默认值。')) {
            saveAsDefaultConfig();
        }
    });
    
    // 重置配置
    document.getElementById('reset-config-btn').addEventListener('click', () => {
        if (confirm('确定要重置为默认配置吗？这将清除所有手动配置的数据，恢复到初始默认值。')) {
            // 清除手动配置的数据
            localStorage.removeItem('gameConfig');
            // 重新加载页面，使用 data.js 中的原始默认值
            location.reload();
        }
    });
}

// 保存配置数据
function saveConfigData() {
    // 保存属性等级表
    document.querySelectorAll('#attr-level-tbody input').forEach(input => {
        const level = parseInt(input.dataset.level);
        const attr = input.dataset.attr;
        const value = parseFloat(input.value);
        if (ATTRIBUTE_LEVEL_TABLE[level]) {
            ATTRIBUTE_LEVEL_TABLE[level][attr] = value;
        }
    });
    
    // 特殊方块区域配置已经通过新配置界面直接修改SPECIAL_BLOCK_RANGE对象
    // 这里不需要额外处理，因为新界面直接操作SPECIAL_BLOCK_RANGE
    
    // 保存宝箱概率
    document.querySelectorAll('#low-gacha-tbody input').forEach(input => {
        const level = parseInt(input.dataset.level);
        GACHA_PROBABILITY.low[level] = parseFloat(input.value);
    });
    document.querySelectorAll('#high-gacha-tbody input').forEach(input => {
        const level = input.dataset.level;
        if (level === 'special') {
            GACHA_PROBABILITY.high.special = parseFloat(input.value);
        } else {
            GACHA_PROBABILITY.high[parseInt(level)] = parseFloat(input.value);
        }
    });
    
    // 保存二级属性配置
    document.querySelectorAll('#secondary-prob-tbody input').forEach(input => {
        const level = parseInt(input.dataset.level);
        SECONDARY_ATTRIBUTE_CONFIG.probability[level] = parseFloat(input.value);
    });
    document.querySelectorAll('#secondary-value-tbody input').forEach(input => {
        const level = parseInt(input.dataset.level);
        const range = input.dataset.range;
        if (!SECONDARY_ATTRIBUTE_CONFIG.values[level]) {
            SECONDARY_ATTRIBUTE_CONFIG.values[level] = { min: 0, max: 0 };
        }
        SECONDARY_ATTRIBUTE_CONFIG.values[level][range] = parseInt(input.value);
    });
    
    // 保存特殊方块加成
    document.querySelectorAll('#special-bonus-tbody input').forEach(input => {
        const level = parseInt(input.dataset.level);
        SPECIAL_BLOCK_BONUS[level] = parseFloat(input.value);
    });
    
    // 保存全满加成比例
    const fullBoardBonusInput = document.getElementById('full-board-bonus-input');
    if (fullBoardBonusInput) {
        FULL_BOARD_BONUS = parseFloat(fullBoardBonusInput.value);
    }
    
    // 保存方案数量
    const schemeCountInput = document.getElementById('scheme-count-input');
    if (schemeCountInput) {
        BOARD_SCHEME_COUNT = parseInt(schemeCountInput.value) || 3;
    }
    
    // 读取现有配置，保留底板扩展规则（如果当前不在该标签页）
    let savedExpansionRules = null;
    const existingConfig = localStorage.getItem('gameConfig');
    if (existingConfig) {
        try {
            const existing = JSON.parse(existingConfig);
            if (existing.BOARD_EXPANSION_RULES && Array.isArray(existing.BOARD_EXPANSION_RULES) && existing.BOARD_EXPANSION_RULES.length > 0) {
                savedExpansionRules = existing.BOARD_EXPANSION_RULES;
            }
        } catch (e) {
            console.error('读取现有配置失败:', e);
        }
    }
    
    // 保存底板扩展规则（只有在表格存在且有数据时才更新）
    const expansionTbody = document.querySelector('#expansion-rules-tbody');
    if (expansionTbody && expansionTbody.children.length > 0) {
        // 表格存在，读取表格中的数据
        const newRules = [];
        document.querySelectorAll('#expansion-rules-tbody tr').forEach(row => {
            const levelInput = row.querySelector('[data-field="level"]');
            const countInput = row.querySelector('[data-field="count"]');
            if (levelInput && countInput) {
                const level = parseInt(levelInput.value);
                const count = parseInt(countInput.value);
                if (!isNaN(level) && !isNaN(count) && level >= 0 && count >= 25) {
                    newRules.push({
                        level: level,
                        count: count
                    });
                }
            }
        });
        
        // 如果读取到有效数据，更新规则
        if (newRules.length > 0) {
            BOARD_EXPANSION_RULES.length = 0;
            BOARD_EXPANSION_RULES.push(...newRules);
            BOARD_EXPANSION_RULES.sort((a, b) => a.level - b.level);
            savedExpansionRules = BOARD_EXPANSION_RULES;
            console.log('底板扩展规则已更新:', savedExpansionRules);
        } else {
            console.warn('底板扩展规则表格数据无效，保留现有配置');
        }
    } else {
        // 表格不存在，使用现有配置或当前值
        if (savedExpansionRules) {
            BOARD_EXPANSION_RULES.length = 0;
            BOARD_EXPANSION_RULES.push(...savedExpansionRules);
            console.log('保留现有底板扩展规则配置');
        }
    }
    
    // 保存底板等级扩展配置
    const boardLevelExpansionTbody = document.querySelector('.board-level-expansion-level');
    if (boardLevelExpansionTbody) {
        BOARD_LEVEL_EXPANSION.length = 0;
        document.querySelectorAll('.board-level-expansion-level').forEach((levelInput, index) => {
            const cellInput = document.querySelector(`.board-level-expansion-cell[data-index="${index}"]`);
            if (levelInput && cellInput) {
                const level = parseInt(levelInput.value);
                const cellIncrease = parseInt(cellInput.value);
                if (!isNaN(level) && !isNaN(cellIncrease)) {
                    BOARD_LEVEL_EXPANSION.push({ level, cellIncrease });
                }
            }
        });
        BOARD_LEVEL_EXPANSION.sort((a, b) => a.level - b.level);
    }
    
    // 保存底板等级经验需求配置
    const boardLevelExpReqTbody = document.querySelector('.board-level-exp-req-level');
    if (boardLevelExpReqTbody) {
        BOARD_LEVEL_EXP_REQUIREMENTS.length = 0;
        document.querySelectorAll('.board-level-exp-req-level').forEach((levelInput, index) => {
            const expInput = document.querySelector(`.board-level-exp-req-exp[data-index="${index}"]`);
            if (levelInput && expInput) {
                const level = parseInt(levelInput.value);
                const expRequired = parseInt(expInput.value);
                if (!isNaN(level) && !isNaN(expRequired)) {
                    BOARD_LEVEL_EXP_REQUIREMENTS.push({ level, expRequired });
                }
            }
        });
        BOARD_LEVEL_EXP_REQUIREMENTS.sort((a, b) => a.level - b.level);
    }
    
    // 保存宝箱经验奖励配置
    const chestExpLowInput = document.getElementById('chest-exp-low');
    const chestExpHighInput = document.getElementById('chest-exp-high');
    if (chestExpLowInput && chestExpHighInput) {
        CHEST_EXP_REWARDS.low = parseInt(chestExpLowInput.value) || 10;
        CHEST_EXP_REWARDS.high = parseInt(chestExpHighInput.value) || 50;
    }
    
    // 保存到localStorage（完全覆盖，使用深拷贝确保独立）
    const configToSave = {
        ATTRIBUTE_LEVEL_TABLE: JSON.parse(JSON.stringify(ATTRIBUTE_LEVEL_TABLE)),
        SPECIAL_BLOCK_RANGE: JSON.parse(JSON.stringify(SPECIAL_BLOCK_RANGE)),
        GACHA_PROBABILITY: JSON.parse(JSON.stringify(GACHA_PROBABILITY)),
        SECONDARY_ATTRIBUTE_CONFIG: JSON.parse(JSON.stringify(SECONDARY_ATTRIBUTE_CONFIG)),
        SPECIAL_BLOCK_BONUS: JSON.parse(JSON.stringify(SPECIAL_BLOCK_BONUS)),
        BOARD_LEVEL_EXPANSION: JSON.parse(JSON.stringify(BOARD_LEVEL_EXPANSION)),
        BOARD_LEVEL_EXP_REQUIREMENTS: JSON.parse(JSON.stringify(BOARD_LEVEL_EXP_REQUIREMENTS)),
        CHEST_EXP_REWARDS: JSON.parse(JSON.stringify(CHEST_EXP_REWARDS)),
        FULL_BOARD_BONUS: FULL_BOARD_BONUS,
        BOARD_SCHEME_COUNT: BOARD_SCHEME_COUNT,
        AVAILABLE_BLOCK_COMBINATIONS: JSON.parse(JSON.stringify(AVAILABLE_BLOCK_COMBINATIONS))
    };
    
    // 确保保存有效的扩展规则（使用深拷贝）
    if (savedExpansionRules && savedExpansionRules.length > 0) {
        configToSave.BOARD_EXPANSION_RULES = JSON.parse(JSON.stringify(savedExpansionRules));
    } else if (BOARD_EXPANSION_RULES.length > 0) {
        configToSave.BOARD_EXPANSION_RULES = JSON.parse(JSON.stringify(BOARD_EXPANSION_RULES));
    }
    
    // 保存角色配置（从表格读取，每天固定奖励）
    const roleRewardsTbody = document.querySelector('#role-rewards-tbody');
    if (roleRewardsTbody) {
        const newRewards = {};
        roleRewardsTbody.querySelectorAll('tr').forEach(row => {
            const role = row.dataset.role;
            const silverInput = row.querySelector('[data-field="silverKeys"]');
            const goldInput = row.querySelector('[data-field="goldKeys"]');
            
            if (role && silverInput && goldInput) {
                const silverKeys = parseInt(silverInput.value) || 0;
                const goldKeys = parseInt(goldInput.value) || 0;
                
                newRewards[role] = { silverKeys, goldKeys };
            }
        });
        configToSave.ACTIVE_DAY_REWARDS = JSON.parse(JSON.stringify(newRewards));
    } else {
        // 如果表格不存在，保留现有配置（使用深拷贝）
        configToSave.ACTIVE_DAY_REWARDS = JSON.parse(JSON.stringify(ACTIVE_DAY_REWARDS));
    }
    
    localStorage.setItem('gameConfig', JSON.stringify(configToSave));
    
    // 注意：版本号不再根据配置保存自动递增，而是跟随代码修改手动更新
    
    console.log('配置已保存');
}

// 保存当前配置为默认配置
function saveAsDefaultConfig() {
    // 先保存当前配置到 gameConfig
    saveConfigData();
    
    // 获取当前配置并保存为默认配置
    const currentConfig = localStorage.getItem('gameConfig');
    if (currentConfig) {
        localStorage.setItem('defaultGameConfig', currentConfig);
        alert('已保存为默认配置！重置系统时将使用此配置。');
        console.log('默认配置已保存');
    } else {
        alert('保存失败：当前没有可用的配置数据。');
    }
}

// 导出配置为JSON文件
function exportConfigToJSON() {
    try {
        // 先保存当前配置，确保获取最新数据（包括从UI读取的值）
        saveConfigData();
        
        // 获取当前配置
        let currentConfig = localStorage.getItem('gameConfig');
        
        // 如果没有保存的配置，从内存中的当前值构建配置对象
        if (!currentConfig) {
            // 从内存中的全局变量构建完整的配置对象
            const configToExport = {
                ATTRIBUTE_LEVEL_TABLE: JSON.parse(JSON.stringify(ATTRIBUTE_LEVEL_TABLE)),
                SPECIAL_BLOCK_RANGE: JSON.parse(JSON.stringify(SPECIAL_BLOCK_RANGE)),
                GACHA_PROBABILITY: JSON.parse(JSON.stringify(GACHA_PROBABILITY)),
                SECONDARY_ATTRIBUTE_CONFIG: JSON.parse(JSON.stringify(SECONDARY_ATTRIBUTE_CONFIG)),
                SPECIAL_BLOCK_BONUS: JSON.parse(JSON.stringify(SPECIAL_BLOCK_BONUS)),
                FULL_BOARD_BONUS: FULL_BOARD_BONUS,
                BOARD_SCHEME_COUNT: BOARD_SCHEME_COUNT,
                BOARD_EXPANSION_RULES: JSON.parse(JSON.stringify(BOARD_EXPANSION_RULES)),
                ACTIVE_DAY_REWARDS: JSON.parse(JSON.stringify(ACTIVE_DAY_REWARDS)),
                AVAILABLE_BLOCK_COMBINATIONS: JSON.parse(JSON.stringify(AVAILABLE_BLOCK_COMBINATIONS))
            };
            
            currentConfig = JSON.stringify(configToExport);
        }
        
        const config = JSON.parse(currentConfig);
        
        // 添加导出元数据（可选）
        const exportData = {
            exportDate: new Date().toISOString(),
            version: getVersion(),
            description: "游戏数据配置导出文件",
            config: config
        };
        
        // 格式化JSON（美化输出）
        const jsonString = JSON.stringify(exportData, null, 2);
        
        // 创建Blob对象
        const blob = new Blob([jsonString], { type: 'application/json' });
        
        // 创建下载链接
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
        a.download = `game-config-${timestamp}.json`; // 使用日期时间作为文件名
        document.body.appendChild(a);
        a.click();
        
        // 清理
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        alert('配置已成功导出为JSON文件！\n文件名: game-config-' + timestamp + '.json');
        console.log('配置已导出:', exportData);
    } catch (e) {
        console.error('导出配置失败:', e);
        alert('导出配置失败：' + e.message);
    }
}

// 加载配置数据
function loadConfigData() {
    // 优先从默认配置文件加载，如果没有则从当前配置加载
    let configStr = localStorage.getItem('defaultGameConfig');
    if (!configStr) {
        configStr = localStorage.getItem('gameConfig');
    }
    if (!configStr) return;
    
    try {
        const config = JSON.parse(configStr);
        loadConfigFromObject(config);
        console.log('配置数据已加载');
    } catch (e) {
        console.error('加载配置数据失败:', e);
    }
}

