// 主应用逻辑

let gameBoards = []; // 多个方案的游戏板
let currentSchemeIndex = 0; // 当前方案索引
let playerInventory = []; // 玩家拥有的方块
let blockUsageMap = new Map(); // 方块使用情况：blockId -> Set(schemeIndex)
let attributeCalculators = []; // 每个方案的属性计算器
let previousAttributes = {};
let dragBlock = null;
let dragOffset = { x: 0, y: 0 };
let gachaCounts = { low: 0, high: 0 }; // 宝箱开启次数统计
let silverKeys = 10; // 银色钥匙数量（初始10个）
let goldKeys = 1; // 金色钥匙数量（初始1个）
let activeDays = 0; // 活跃天数（从0天开始）
let playerRole = '非R'; // 玩家角色：非R、小R、中R、大R、超R

// 版本号管理
function getVersion() {
    const savedVersion = localStorage.getItem('gameVersion');
    if (savedVersion) {
        return savedVersion;
    }
    return '1.1.0'; // 默认版本号
}

function incrementVersion() {
    const currentVersion = getVersion();
    const parts = currentVersion.split('.');
    if (parts.length === 3) {
        const patch = parseInt(parts[2]) || 0;
        parts[2] = (patch + 1).toString();
        const newVersion = parts.join('.');
        localStorage.setItem('gameVersion', newVersion);
        updateVersionDisplay();
        return newVersion;
    }
    return currentVersion;
}

function updateVersionDisplay() {
    const display = document.getElementById('version-display');
    if (display) {
        display.textContent = `版本号: ${getVersion()}`;
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
        const range = SPECIAL_BLOCK_RANGE[block.level] || SPECIAL_BLOCK_RANGE[1];
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
    tooltip = document.createElement('div');
    tooltip.className = 'block-tooltip';
    tooltip.textContent = block.getTooltipText();
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
        if (!blockEl || blockEl.classList.contains('in-use')) return;
        
        const blockId = blockEl.dataset.blockId;
        dragBlock = playerInventory.find(b => b.id == blockId);
        if (!dragBlock) return;
        
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
    const range = SPECIAL_BLOCK_RANGE[block.level] || SPECIAL_BLOCK_RANGE[1];
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
            
            // 扩展格子（同步到所有方案）
            const totalLevel = gameBoard.getTotalLevel();
            const newCellCount = expandCellsForAllSchemes(totalLevel);
            if (newCellCount > gameBoards[0].initialCellCount) {
                renderBoard();
            }
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

// 扩展所有方案的格子（同步扩展）
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
    
    // 8. 清除选择状态
    selectedBlockIds.clear();
    
    // 7. 从默认配置文件重新加载配置
    loadDefaultConfig();
    
    // 8. 重新渲染
    renderBoard();
    renderInventory();
    updateAttributeDisplay();
    
    // 9. 保存游戏数据（不包含配置数据，配置数据会保留）
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
        Object.assign(SPECIAL_BLOCK_RANGE, config.SPECIAL_BLOCK_RANGE);
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
        playerRole: playerRole
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
            const block = new Block(bData.level, bData.shape, bData.rotation, bData.isSpecial);
            block.id = bData.id;
            block.cells = bData.cells;
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
        }
        
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
    }
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

// 渲染特殊方块区域表（图形化配置）
function renderSpecialBlockRangeTable(container) {
    const div = document.createElement('div');
    div.innerHTML = '<p>特殊方块影响区域配置（点击格子来切换是否在影响范围内）</p>';
    div.innerHTML += '<p style="color: #7f8c8d; font-size: 12px;">白色格子 = 不在范围内，紫色格子 = 在范围内，中心格子（深紫色）= 特殊方块位置</p>';
    
    for (let level = 1; level <= 5; level++) {
        const levelDiv = document.createElement('div');
        levelDiv.style.marginBottom = '30px';
        levelDiv.style.padding = '15px';
        levelDiv.style.background = 'white';
        levelDiv.style.borderRadius = '5px';
        levelDiv.innerHTML = `<h4>等级 ${level}</h4>`;
        
        // 创建图形化配置区域
        const gridContainer = document.createElement('div');
        gridContainer.className = 'range-grid-container';
        gridContainer.dataset.level = level;
        
        // 确定网格大小（根据当前范围计算）
        const currentRange = SPECIAL_BLOCK_RANGE[level] || [];
        const allX = currentRange.map(([x]) => x);
        const allY = currentRange.map(([, y]) => y);
        const minX = Math.min(...allX, -3);
        const maxX = Math.max(...allX, 3);
        const minY = Math.min(...allY, -3);
        const maxY = Math.max(...allY, 3);
        const gridSize = Math.max(maxX - minX + 1, maxY - minY + 1, 7);
        const centerOffset = Math.floor(gridSize / 2);
        
        // 创建网格
        const grid = document.createElement('div');
        grid.className = 'range-config-grid';
        grid.style.display = 'grid';
        grid.style.gridTemplateColumns = `repeat(${gridSize}, 35px)`;
        grid.style.gap = '2px';
        grid.style.margin = '10px 0';
        
        // 创建格子
        const rangeSet = new Set(currentRange.map(([x, y]) => `${x},${y}`));
        
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
                
                if (x === 0 && y === 0) {
                    cell.classList.add('center-cell');
                    cell.textContent = '★';
                } else if (rangeSet.has(key)) {
                    cell.classList.add('active');
                }
                
                cell.addEventListener('click', () => {
                    if (x === 0 && y === 0) return; // 中心格子不能切换
                    cell.classList.toggle('active');
                });
                
                grid.appendChild(cell);
            }
        }
        
        gridContainer.appendChild(grid);
        levelDiv.appendChild(gridContainer);
        div.appendChild(levelDiv);
    }
    
    container.appendChild(div);
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
    });
    
    // 删除规则
    tbody.addEventListener('click', (e) => {
        if (e.target.classList.contains('delete-rule-btn')) {
            const index = parseInt(e.target.dataset.index);
            if (BOARD_EXPANSION_RULES.length > 1) {
                BOARD_EXPANSION_RULES.splice(index, 1);
                renderRules();
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
        option.textContent = role;
        if (role === playerRole) {
            option.selected = true;
        }
        roleSelect.appendChild(option);
    });
    roleSelect.addEventListener('change', (e) => {
        playerRole = e.target.value;
        saveGameData();
        updateActiveDaysDisplay();
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
    
    // 保存特殊方块区域（从图形化配置读取）
    for (let level = 1; level <= 5; level++) {
        const gridContainer = document.querySelector(`.range-grid-container[data-level="${level}"]`);
        if (gridContainer) {
            const activeCells = gridContainer.querySelectorAll('.range-config-cell.active, .range-config-cell.center-cell');
            SPECIAL_BLOCK_RANGE[level] = Array.from(activeCells).map(cell => {
                const x = parseInt(cell.dataset.x);
                const y = parseInt(cell.dataset.y);
                return [x, y];
            });
        }
    }
    
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
    
    // 保存到localStorage（完全覆盖，使用深拷贝确保独立）
    const configToSave = {
        ATTRIBUTE_LEVEL_TABLE: JSON.parse(JSON.stringify(ATTRIBUTE_LEVEL_TABLE)),
        SPECIAL_BLOCK_RANGE: JSON.parse(JSON.stringify(SPECIAL_BLOCK_RANGE)),
        GACHA_PROBABILITY: JSON.parse(JSON.stringify(GACHA_PROBABILITY)),
        SECONDARY_ATTRIBUTE_CONFIG: JSON.parse(JSON.stringify(SECONDARY_ATTRIBUTE_CONFIG)),
        SPECIAL_BLOCK_BONUS: JSON.parse(JSON.stringify(SPECIAL_BLOCK_BONUS)),
        FULL_BOARD_BONUS: FULL_BOARD_BONUS,
        BOARD_SCHEME_COUNT: BOARD_SCHEME_COUNT
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
    
    // 保存配置时自动增加版本号
    incrementVersion();
    
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
                ACTIVE_DAY_REWARDS: JSON.parse(JSON.stringify(ACTIVE_DAY_REWARDS))
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

