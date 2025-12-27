// 主应用逻辑

let gameBoard = new GameBoard();
let playerInventory = []; // 玩家拥有的方块
let placedBlocks = new Set(); // 已放置的方块ID
let attributeCalculator = new AttributeCalculator(gameBoard);
let previousAttributes = {};
let dragBlock = null;
let dragOffset = { x: 0, y: 0 };

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    initializeNavigation();
    initializeBoard();
    initializeGacha();
    initializeUpgrade();
    initializeClearBoard();
    initializeConfigPage();
    updateAttributeDisplay();
    
    // 加载保存的数据
    loadGameData();
    loadConfigData();
});

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
            }
        });
    });
}

// 初始化底板
function initializeBoard() {
    renderBoard();
    setupDragAndDrop();
}

// 渲染底板
function renderBoard() {
    const board = document.getElementById('game-board');
    board.innerHTML = '';
    board.classList.remove('full');
    
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
    const positions = block.getPositions(baseX, baseY);
    const minX = Math.min(...positions.map(([x]) => x));
    const minY = Math.min(...positions.map(([, y]) => y));
    const maxX = Math.max(...positions.map(([x]) => x));
    const maxY = Math.max(...positions.map(([, y]) => y));
    
    // 调试日志：输出渲染位置
    console.log('渲染方块:', {
        blockId: block.id,
        baseX, baseY,
        minX, minY, maxX, maxY,
        positions: positions,
        containerX: container ? container.dataset.x : null,
        containerY: container ? container.dataset.y : null
    });
    
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
                const arrow = document.createElement('div');
                arrow.className = 'bonus-arrow';
                arrow.textContent = '↑';
                const screenX = (targetX - minX) * gameBoard.cellSize + gameBoard.cellSize / 2;
                const screenY = (targetY - minY) * gameBoard.cellSize;
                arrow.style.left = screenX + 'px';
                arrow.style.top = screenY + 'px';
                board.appendChild(arrow);
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
        if (placedBlocks.has(block.id)) {
            blockEl.classList.add('in-use');
        }
        inventory.appendChild(blockEl);
    });
}

// 创建方块元素
function createBlockElement(block) {
    const container = document.createElement('div');
    container.className = 'block';
    container.dataset.blockId = block.id;
    
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
                console.log('从底板拿起方块:', dragBlock.id);
                
                // 保存原位置（用于调试）
                const oldBlockData = [...gameBoard.blocks, ...gameBoard.specialBlocks].find(b => b.block === dragBlock);
                if (oldBlockData) {
                    dragBlock.oldPosition = { x: oldBlockData.x, y: oldBlockData.y };
                    console.log('方块原位置:', dragBlock.oldPosition);
                }
                
                // 从底板移除
                gameBoard.removeBlock(dragBlock);
                placedBlocks.delete(dragBlock.id);
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
    
    const rect = board.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // 清除之前的标记和预览
    board.querySelectorAll('.board-cell').forEach(cell => {
        cell.classList.remove('invalid', 'highlight', 'preview-valid', 'preview-invalid');
    });
    
    // 移除之前的预览方块
    const existingPreview = board.querySelector('.preview-block');
    if (existingPreview) {
        existingPreview.remove();
    }
    
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

// 创建预览方块
function createPreviewBlock(block, baseX, baseY, boardMinX, boardMinY) {
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
    
    const rect = board.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // 检查是否在底板范围内
    if (mouseX < 0 || mouseY < 0 || mouseX > rect.width || mouseY > rect.height) {
        // 如果拖出底板，且方块之前已放置，则移除
        if (placedBlocks.has(dragBlock.id)) {
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
    
    // 调试日志：输出鼠标位置和实际放入位置
    console.log('=== 方块放置调试信息 ===');
    console.log('鼠标位置:', { x: mouseX, y: mouseY });
    console.log('克隆方块左上角位置:', { x: cloneTopLeftX, y: cloneTopLeftY });
    console.log('计算出的格子坐标:', { cellX, cellY, boardX, boardY });
    console.log('方块归一化形状:', normalizedShape);
    console.log('方块最小坐标:', { minShapeX, minShapeY });
    console.log('最终放置位置 (baseX, baseY):', { baseX, baseY });
    const finalPositions = dragBlock.getPositions(baseX, baseY);
    console.log('方块将占用的所有位置:', finalPositions);
    console.log('========================');
    
    // 严格检查：所有位置必须在底板范围内且为空
    if (gameBoard.canPlaceBlock(dragBlock, baseX, baseY)) {
        // 放置新位置（如果之前已放置，在mousedown时已移除）
        if (gameBoard.placeBlock(dragBlock, baseX, baseY)) {
            console.log('✓ 方块成功放置到位置:', { baseX, baseY });
            placedBlocks.add(dragBlock.id);
            renderBoard();
            renderInventory();
            updateAttributeDisplay();
            
            // 扩展格子
            const totalLevel = gameBoard.getTotalLevel();
            gameBoard.expandCells(totalLevel);
            if (gameBoard.currentCellCount > gameBoard.initialCellCount) {
                renderBoard();
            }
        } else {
            console.log('✗ 方块放置失败（placeBlock返回false）');
        }
    } else {
        console.log('✗ 方块无法放置（canPlaceBlock返回false）');
        // 如果无法放置，且之前已从底板移除，需要恢复
        if (!placedBlocks.has(dragBlock.id)) {
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
        }
        dragBlock = null;
    }
}

// 更新属性显示
function updateAttributeDisplay() {
    const display = document.getElementById('attribute-display');
    display.innerHTML = '';
    
    // 显示总等级数
    const totalLevel = gameBoard.getTotalLevel();
    const levelInfo = document.createElement('div');
    levelInfo.className = 'total-level-info';
    levelInfo.innerHTML = `<strong>总等级: ${totalLevel}</strong>`;
    display.appendChild(levelInfo);
    
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
        valueEl.textContent = Math.floor(attributes[key]);
        if (key.includes('crit') || key.includes('dodge') || key.includes('armor')) {
            valueEl.textContent += '%';
        }
        
        item.appendChild(nameEl);
        item.appendChild(valueEl);
        
        // 显示变化
        if (previousAttributes[key] !== undefined) {
            const change = attributes[key] - previousAttributes[key];
            if (Math.abs(change) > 0.01) {
                const changeEl = document.createElement('span');
                changeEl.className = `attribute-change ${change > 0 ? 'positive' : 'negative'}`;
                changeEl.textContent = (change > 0 ? '+' : '') + Math.floor(change);
                item.appendChild(changeEl);
                
                setTimeout(() => changeEl.remove(), 1000);
            }
        }
        
        display.appendChild(item);
    });
    
    previousAttributes = { ...attributes };
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
    const results = GachaSystem.openChest(type, count);
    results.forEach(block => {
        playerInventory.push(block);
    });
    
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

// 初始化升级系统
function initializeUpgrade() {
    document.getElementById('auto-merge-btn').addEventListener('click', () => {
        const level = parseInt(document.getElementById('merge-level-select').value);
        if (level) {
            autoMerge(level);
        }
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

// 清空底板
function clearBoard() {
    // 移除所有已放置的方块
    const allPlacedBlocks = Array.from(placedBlocks);
    allPlacedBlocks.forEach(blockId => {
        const block = playerInventory.find(b => b.id == blockId);
        if (block) {
            gameBoard.removeBlock(block);
        }
    });
    
    // 清空已放置标记
    placedBlocks.clear();
    
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
    
    console.log('底板已清空');
}

// 重置系统
function resetSystem() {
    // 1. 清空底板
    clearBoard();
    
    // 2. 删除所有方块和特殊方块
    playerInventory = [];
    placedBlocks.clear();
    
    // 3. 重置游戏板格子数到初始状态
    gameBoard.cells.clear();
    gameBoard.blocks = [];
    gameBoard.specialBlocks = [];
    gameBoard.currentCellCount = gameBoard.initialCellCount;
    
    // 4. 重新生成初始25个格子
    gameBoard.generateInitialCells();
    
    // 5. 重新渲染
    renderBoard();
    renderInventory();
    updateAttributeDisplay();
    
    // 6. 保存数据
    saveGameData();
    
    console.log('系统已重置');
}

function renderUpgradeInventory() {
    const container = document.getElementById('upgrade-inventory');
    container.innerHTML = '';
    
    // 按等级分组
    const byLevel = {};
    playerInventory.forEach(block => {
        if (placedBlocks.has(block.id)) return; // 跳过已放置的
        if (block.isSpecial) return; // 跳过特殊方块
        
        if (!byLevel[block.level]) {
            byLevel[block.level] = [];
        }
        byLevel[block.level].push(block);
    });
    
    // 更新选择器
    const select = document.getElementById('merge-level-select');
    select.innerHTML = '<option value="">选择等级</option>';
    Object.keys(byLevel).sort((a, b) => a - b).forEach(level => {
        const count = byLevel[level].length;
        const canMerge = Math.floor(count / 4);
        if (canMerge > 0) {
            const option = document.createElement('option');
            option.value = level;
            option.textContent = `等级 ${level} (剩余 ${count} 个，可合成 ${canMerge} 个)`;
            select.appendChild(option);
        }
    });
    
    // 渲染方块
    Object.keys(byLevel).sort((a, b) => b - a).forEach(level => {
        const levelDiv = document.createElement('div');
        levelDiv.style.width = '100%';
        levelDiv.style.marginBottom = '20px';
        
        const title = document.createElement('h4');
        title.textContent = `等级 ${level} (${byLevel[level].length} 个)`;
        levelDiv.appendChild(title);
        
        const grid = document.createElement('div');
        grid.style.display = 'flex';
        grid.style.flexWrap = 'wrap';
        grid.style.gap = '10px';
        
        byLevel[level].forEach(block => {
            const blockEl = createBlockElement(block);
            grid.appendChild(blockEl);
        });
        
        levelDiv.appendChild(grid);
        container.appendChild(levelDiv);
    });
}

function autoMerge(level) {
    const blocks = playerInventory.filter(b => 
        !placedBlocks.has(b.id) && 
        !b.isSpecial && 
        b.level === level
    );
    
    const mergeCount = Math.floor(blocks.length / 4);
    if (mergeCount === 0) {
        alert('数量不足，无法合成');
        return;
    }
    
    // 移除用于合成的方块
    for (let i = 0; i < mergeCount * 4; i++) {
        const index = playerInventory.indexOf(blocks[i]);
        if (index > -1) {
            playerInventory.splice(index, 1);
        }
    }
    
    // 创建新方块
    for (let i = 0; i < mergeCount; i++) {
        const newLevel = level + 1;
        const shape = Math.floor(Math.random() * TETRIS_SHAPES.length);
        const rotation = [0, 90, 180, 270][Math.floor(Math.random() * 4)];
        const newBlock = new Block(newLevel, shape, rotation);
        playerInventory.push(newBlock);
    }
    
    saveGameData();
    renderUpgradeInventory();
    renderInventory();
    alert(`成功合成 ${mergeCount} 个等级 ${level + 1} 的方块！`);
}

// 保存和加载游戏数据
function saveGameData() {
    const data = {
        inventory: playerInventory.map(b => ({
            level: b.level,
            shape: b.shape,
            rotation: b.rotation,
            isSpecial: b.isSpecial,
            cells: b.cells,
            id: b.id
        })),
        board: {
            blocks: gameBoard.blocks.map(({ block, x, y }) => ({
                blockId: block.id,
                x, y
            })),
            specialBlocks: gameBoard.specialBlocks.map(({ block, x, y }) => ({
                blockId: block.id,
                x, y
            }))
        },
        placedBlockIds: Array.from(placedBlocks)
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
        
        // 恢复放置的方块
        placedBlocks = new Set(data.placedBlockIds);
        
        // 恢复底板
        data.board.blocks.forEach(({ blockId, x, y }) => {
            const block = playerInventory.find(b => b.id === blockId);
            if (block) {
                gameBoard.placeBlock(block, x, y);
            }
        });
        
        data.board.specialBlocks.forEach(({ blockId, x, y }) => {
            const block = playerInventory.find(b => b.id === blockId);
            if (block) {
                gameBoard.placeBlock(block, x, y);
            }
        });
        
        // 扩展格子
        const totalLevel = gameBoard.getTotalLevel();
        gameBoard.expandCells(totalLevel);
        
        renderBoard();
        renderInventory();
        updateAttributeDisplay();
    } catch (e) {
        console.error('加载游戏数据失败:', e);
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

// 渲染特殊方块区域表
function renderSpecialBlockRangeTable(container) {
    const div = document.createElement('div');
    div.innerHTML = '<p>特殊方块影响区域（坐标偏移列表，格式：x,y，每行一个坐标）</p>';
    
    for (let level = 1; level <= 5; level++) {
        const levelDiv = document.createElement('div');
        levelDiv.style.marginBottom = '20px';
        levelDiv.innerHTML = `<h4>等级 ${level}</h4>`;
        
        const textarea = document.createElement('textarea');
        textarea.className = 'range-textarea';
        textarea.dataset.level = level;
        textarea.value = SPECIAL_BLOCK_RANGE[level].map(([x, y]) => `${x},${y}`).join('\n');
        textarea.rows = 5;
        textarea.cols = 30;
        levelDiv.appendChild(textarea);
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
    
    // 重置配置
    document.getElementById('reset-config-btn').addEventListener('click', () => {
        if (confirm('确定要重置为默认配置吗？')) {
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
    
    // 保存特殊方块区域
    document.querySelectorAll('.range-textarea').forEach(textarea => {
        const level = parseInt(textarea.dataset.level);
        const lines = textarea.value.split('\n').filter(line => line.trim());
        SPECIAL_BLOCK_RANGE[level] = lines.map(line => {
            const [x, y] = line.split(',').map(Number);
            return [x, y];
        });
    });
    
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
    
    // 保存到localStorage
    localStorage.setItem('gameConfig', JSON.stringify({
        ATTRIBUTE_LEVEL_TABLE,
        SPECIAL_BLOCK_RANGE,
        GACHA_PROBABILITY,
        SECONDARY_ATTRIBUTE_CONFIG,
        SPECIAL_BLOCK_BONUS
    }));
    
    console.log('配置已保存');
}

// 加载配置数据
function loadConfigData() {
    const configStr = localStorage.getItem('gameConfig');
    if (!configStr) return;
    
    try {
        const config = JSON.parse(configStr);
        
        // 更新全局配置对象
        if (config.ATTRIBUTE_LEVEL_TABLE) {
            Object.assign(ATTRIBUTE_LEVEL_TABLE, config.ATTRIBUTE_LEVEL_TABLE);
        }
        if (config.SPECIAL_BLOCK_RANGE) {
            Object.assign(SPECIAL_BLOCK_RANGE, config.SPECIAL_BLOCK_RANGE);
        }
        if (config.GACHA_PROBABILITY) {
            Object.assign(GACHA_PROBABILITY, config.GACHA_PROBABILITY);
        }
        if (config.SECONDARY_ATTRIBUTE_CONFIG) {
            Object.assign(SECONDARY_ATTRIBUTE_CONFIG, config.SECONDARY_ATTRIBUTE_CONFIG);
        }
        if (config.SPECIAL_BLOCK_BONUS) {
            Object.assign(SPECIAL_BLOCK_BONUS, config.SPECIAL_BLOCK_BONUS);
        }
        
        console.log('配置数据已加载');
    } catch (e) {
        console.error('加载配置数据失败:', e);
    }
}

