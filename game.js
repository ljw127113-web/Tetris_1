// 游戏核心逻辑

class GameBoard {
    constructor() {
        this.cells = new Map(); // 存储格子坐标和内容
        this.blocks = []; // 存储放置的方块
        this.specialBlocks = []; // 存储特殊方块
        this.cellSize = 30; // 格子大小
        this.initialCellCount = 25;
        this.currentCellCount = this.initialCellCount;
        this.generateInitialCells();
    }

    // 生成螺旋坐标
    generateSpiralCoordinates(count) {
        const coords = [];
        let x = 0, y = 0;
        coords.push([x, y]);
        
        let step = 1;
        let direction = 0; // 0:右, 1:下, 2:左, 3:上
        const directions = [[1, 0], [0, -1], [-1, 0], [0, 1]];
        
        while (coords.length < count) {
            for (let i = 0; i < 2; i++) {
                for (let j = 0; j < step; j++) {
                    x += directions[direction][0];
                    y += directions[direction][1];
                    coords.push([x, y]);
                    if (coords.length >= count) break;
                }
                if (coords.length >= count) break;
                direction = (direction + 1) % 4;
            }
            step++;
        }
        
        return coords;
    }

    // 生成初始格子
    generateInitialCells() {
        const coords = this.generateSpiralCoordinates(this.initialCellCount);
        coords.forEach(([x, y]) => {
            this.cells.set(`${x},${y}`, null);
        });
    }

    // 扩展格子
    expandCells(totalLevel) {
        const expansionRules = [
            { level: 10, count: 28 },
            { level: 15, count: 31 },
            { level: 20, count: 34 },
            { level: 25, count: 37 },
            { level: 30, count: 40 },
            { level: 35, count: 43 },
            { level: 40, count: 46 },
            { level: 45, count: 49 }
        ];

        for (let rule of expansionRules) {
            if (totalLevel >= rule.level && this.currentCellCount < rule.count) {
                const coords = this.generateSpiralCoordinates(rule.count);
                coords.forEach(([x, y]) => {
                    const key = `${x},${y}`;
                    if (!this.cells.has(key)) {
                        this.cells.set(key, null);
                    }
                });
                this.currentCellCount = rule.count;
                break;
            }
        }
    }

    // 检查位置是否可放置（确保所有位置都在底板范围内且为空）
    canPlaceBlock(block, baseX, baseY) {
        const positions = block.getPositions(baseX, baseY);
        // 确保所有位置都在底板范围内且为空
        for (let [x, y] of positions) {
            const key = `${x},${y}`;
            // 检查是否在底板范围内
            if (!this.cells.has(key)) return false;
            // 检查是否为空
            if (this.cells.get(key) !== null) return false;
        }
        return true;
    }

    // 放置方块
    // baseX, baseY 是方块左上角（归一化后的原点）的位置
    placeBlock(block, baseX, baseY) {
        if (!this.canPlaceBlock(block, baseX, baseY)) {
            return false;
        }

        const positions = block.getPositions(baseX, baseY);
        positions.forEach(([x, y]) => {
            this.cells.set(`${x},${y}`, block);
        });

        if (block.isSpecial) {
            this.specialBlocks.push({ block, x: baseX, y: baseY });
        } else {
            this.blocks.push({ block, x: baseX, y: baseY });
        }

        return true;
    }

    // 移除方块
    removeBlock(block) {
        const allBlocks = [...this.blocks, ...this.specialBlocks];
        const blockData = allBlocks.find(b => b.block === block);
        if (!blockData) return false;

        const positions = block.getPositions(blockData.x, blockData.y);
        positions.forEach(([x, y]) => {
            this.cells.set(`${x},${y}`, null);
        });

        if (block.isSpecial) {
            this.specialBlocks = this.specialBlocks.filter(b => b.block !== block);
        } else {
            this.blocks = this.blocks.filter(b => b.block !== block);
        }

        return true;
    }

    // 计算总等级
    getTotalLevel() {
        let total = 0;
        this.blocks.forEach(({ block }) => total += block.level);
        this.specialBlocks.forEach(({ block }) => total += block.level);
        return total;
    }

    // 检查是否全满
    isFull() {
        for (let value of this.cells.values()) {
            if (value === null) return false;
        }
        return true;
    }

    // 获取所有格子坐标
    getAllCellCoords() {
        return Array.from(this.cells.keys()).map(key => {
            const [x, y] = key.split(',').map(Number);
            return { x, y, key };
        });
    }
}

class Block {
    constructor(level, shape, rotation, isSpecial = false) {
        this.level = level;
        this.shape = shape; // 形状类型索引
        this.rotation = rotation; // 0, 90, 180, 270
        this.isSpecial = isSpecial;
        this.cells = []; // 每个格子的属性
        this.id = Date.now() + Math.random();
        
        if (!isSpecial) {
            this.generateAttributes();
        }
    }

    // 生成属性
    generateAttributes() {
        const baseShape = TETRIS_SHAPES[this.shape];
        const rotatedShape = this.rotateShape(baseShape, this.rotation);
        
        // 归一化到原点
        const minX = Math.min(...rotatedShape.map(([x]) => x));
        const minY = Math.min(...rotatedShape.map(([, y]) => y));
        const normalizedShape = rotatedShape.map(([x, y]) => [x - minX, y - minY]);
        
        normalizedShape.forEach(([x, y]) => {
            const attrType = ['attack', 'defense', 'health'][Math.floor(Math.random() * 3)];
            const attrValue = ATTRIBUTE_LEVEL_TABLE[this.level][attrType];
            
            const cell = {
                x, y,
                primaryAttr: attrType,
                primaryValue: attrValue,
                secondaryAttr: null,
                secondaryValue: 0
            };

            // 5级以上可能生成二级属性（每个格子独立判断）
            if (this.level >= 5) {
                const prob = SECONDARY_ATTRIBUTE_CONFIG.probability[this.level] || 0;
                if (Math.random() < prob) {
                    const secondaryAttrs = Object.keys(SECONDARY_ATTR_ICONS);
                    cell.secondaryAttr = secondaryAttrs[Math.floor(Math.random() * secondaryAttrs.length)];
                    const valueRange = SECONDARY_ATTRIBUTE_CONFIG.values[this.level];
                    cell.secondaryValue = Math.floor(Math.random() * (valueRange.max - valueRange.min + 1)) + valueRange.min;
                }
            }

            this.cells.push(cell);
        });
    }

    // 旋转形状
    rotateShape(shape, degrees) {
        if (degrees === 0) return shape;
        
        const rotations = degrees / 90;
        let rotated = [...shape];
        
        for (let i = 0; i < rotations; i++) {
            rotated = rotated.map(([x, y]) => [-y, x]);
        }
        
        // 归一化到原点
        const minX = Math.min(...rotated.map(([x]) => x));
        const minY = Math.min(...rotated.map(([, y]) => y));
        return rotated.map(([x, y]) => [x - minX, y - minY]);
    }

    // 获取方块占用的位置（相对于baseX, baseY）
    // baseX, baseY 是方块左上角（归一化后的原点）的位置
    getPositions(baseX, baseY) {
        if (this.isSpecial) {
            return [[baseX, baseY]];
        }
        
        // 使用cells中存储的归一化坐标，加上baseX/baseY
        return this.cells.map(cell => [baseX + cell.x, baseY + cell.y]);
    }
    
    // 获取方块的归一化形状（用于显示）
    getNormalizedShape() {
        if (this.isSpecial) {
            return [[0, 0]];
        }
        return this.cells.map(cell => [cell.x, cell.y]);
    }

    // 获取工具提示文本
    getTooltipText() {
        if (this.isSpecial) {
            return `特殊方块 Lv.${this.level}`;
        }
        
        let text = `等级: ${this.level}\n`;
        this.cells.forEach((cell, idx) => {
            text += `格子${idx + 1}: ${PRIMARY_ATTR_NAMES[cell.primaryAttr]} ${cell.primaryValue}`;
            if (cell.secondaryAttr) {
                text += `\n${SECONDARY_ATTR_NAMES[cell.secondaryAttr]}: ${cell.secondaryValue}%`;
            }
            text += '\n';
        });
        return text;
    }
}

class AttributeCalculator {
    constructor(gameBoard) {
        this.gameBoard = gameBoard;
    }

    // 计算所有属性总值
    calculateTotalAttributes() {
        const attributes = {
            attack: 0,
            defense: 0,
            health: 0,
            crit: 0,
            'anti-crit': 0,
            dodge: 0,
            'anti-dodge': 0,
            'armor-pen': 0,
            'anti-armor-pen': 0
        };

        // 计算基础属性
        this.gameBoard.blocks.forEach(({ block, x, y }) => {
            block.cells.forEach(cell => {
                const cellX = x + cell.x;
                const cellY = y + cell.y;
                attributes[cell.primaryAttr] += cell.primaryValue;
                
                if (cell.secondaryAttr) {
                    attributes[cell.secondaryAttr] += cell.secondaryValue;
                }
            });
        });

        // 应用特殊方块加成
        this.gameBoard.specialBlocks.forEach(({ block, x, y }) => {
            const range = SPECIAL_BLOCK_RANGE[block.level] || SPECIAL_BLOCK_RANGE[1];
            const bonus = SPECIAL_BLOCK_BONUS[block.level] || SPECIAL_BLOCK_BONUS[1];
            
            range.forEach(([dx, dy]) => {
                const targetX = x + dx;
                const targetY = y + dy;
                const key = `${targetX},${targetY}`;
                const targetBlock = this.gameBoard.cells.get(key);
                
                if (targetBlock && !targetBlock.isSpecial) {
                    // 找到对应的格子
                    const blockData = this.gameBoard.blocks.find(b => b.block === targetBlock);
                    if (blockData) {
                        const positions = targetBlock.getPositions(blockData.x, blockData.y);
                        const posIndex = positions.findIndex(([px, py]) => px === targetX && py === targetY);
                        if (posIndex >= 0 && posIndex < targetBlock.cells.length) {
                            const cell = targetBlock.cells[posIndex];
                            attributes[cell.primaryAttr] += cell.primaryValue * bonus;
                            if (cell.secondaryAttr) {
                                attributes[cell.secondaryAttr] += cell.secondaryValue * bonus;
                            }
                        }
                    }
                }
            });
        });

        // 如果全满，一级属性+50%
        if (this.gameBoard.isFull()) {
            attributes.attack *= 1.5;
            attributes.defense *= 1.5;
            attributes.health *= 1.5;
        }

        return attributes;
    }
}

// 宝箱系统
class GachaSystem {
    static openChest(type, count) {
        const results = [];
        for (let i = 0; i < count; i++) {
            results.push(this.openSingleChest(type));
        }
        return results;
    }

    static openSingleChest(type) {
        if (type === 'low') {
            return this.openLowChest();
        } else {
            return this.openHighChest();
        }
    }

    static openLowChest() {
        const rand = Math.random();
        let level = 1;
        if (rand < GACHA_PROBABILITY.low[1]) {
            level = 1;
        } else if (rand < GACHA_PROBABILITY.low[1] + GACHA_PROBABILITY.low[2]) {
            level = 2;
        } else {
            level = 3;
        }
        
        const shape = Math.floor(Math.random() * TETRIS_SHAPES.length);
        const rotation = [0, 90, 180, 270][Math.floor(Math.random() * 4)];
        return new Block(level, shape, rotation);
    }

    static openHighChest() {
        const rand = Math.random();
        
        // 检查特殊方块
        if (rand < GACHA_PROBABILITY.high.special) {
            const level = Math.floor(Math.random() * 5) + 1;
            return new Block(level, 0, 0, true);
        }
        
        // 普通方块
        let level = 2;
        const cumulative = [
            GACHA_PROBABILITY.high[2],
            GACHA_PROBABILITY.high[2] + GACHA_PROBABILITY.high[3],
            GACHA_PROBABILITY.high[2] + GACHA_PROBABILITY.high[3] + GACHA_PROBABILITY.high[4],
            GACHA_PROBABILITY.high[2] + GACHA_PROBABILITY.high[3] + GACHA_PROBABILITY.high[4] + GACHA_PROBABILITY.high[5]
        ];
        
        const adjustedRand = (rand - GACHA_PROBABILITY.high.special) / (1 - GACHA_PROBABILITY.high.special);
        
        if (adjustedRand < cumulative[0]) {
            level = 2;
        } else if (adjustedRand < cumulative[1]) {
            level = 3;
        } else if (adjustedRand < cumulative[2]) {
            level = 4;
        } else {
            level = 5;
        }
        
        const shape = Math.floor(Math.random() * TETRIS_SHAPES.length);
        const rotation = [0, 90, 180, 270][Math.floor(Math.random() * 4)];
        return new Block(level, shape, rotation);
    }
}

