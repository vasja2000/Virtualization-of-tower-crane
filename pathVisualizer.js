import * as THREE from 'three';

// Переменные для отслеживания пути крюка и рабочих зон
let scene;
let pathPoints = [];
let pathLine;
let pathColor = new THREE.Color(0x4080ff); // Стандартный синий цвет для пути крюка

// Материалы для разных зон работы крана
const loadingZoneMaterial = new THREE.MeshBasicMaterial({
    color: 0x2ca05a, // Зеленый для зон погрузки
    transparent: true,
    opacity: 0.3,
    side: THREE.DoubleSide
});
const unloadingZoneMaterial = new THREE.MeshBasicMaterial({
    color: 0xf07f23, // Оранжевый для зон разгрузки
    transparent: true,
    opacity: 0.3,
    side: THREE.DoubleSide
});
const concretePourMaterial = new THREE.MeshBasicMaterial({
    color: 0x4c84b8, // Синий для зон заливки бетона
    transparent: true,
    opacity: 0.4,
    side: THREE.DoubleSide
});

// Группы для организации объектов на сцене
let zonesGroup;      // Группа для зон работы
let pathsGroup;      // Группа для путей крюка
let labelsGroup;     // Группа для надписей

// Настройки записи пути крюка
const minDistanceForPathPoint = 0.5; // Минимальное расстояние между точками пути (метры)
const maxPathLength = 5000;          // Максимальная длина пути (количество точек)
let lastPathTime = 0;                // Время последней записанной точки
const minTimeIntervalMs = 50;        // Минимальный интервал между записями (миллисекунды)

// Управление видимостью
let pathsVisible = true;  // Показывать пути крюка
let zonesVisible = true;  // Показывать рабочие зоны

// Слушатели событий для включения/выключения отображения
let pathsToggleListener = null;
let zonesToggleListener = null;

/**
 * Запускаем визуализацию путей крюка и рабочих зон
 * @param {THREE.Scene} _scene - 3D сцена
 * @param {Object} config - Настройки крана
 */
export function init(_scene, config) {
    scene = _scene;

    // Создаем группы для организации объектов, если они не существуют
    if (!zonesGroup) {
        zonesGroup = new THREE.Group();
        zonesGroup.name = "Zones";
        scene.add(zonesGroup);
    } else {
        scene.add(zonesGroup);
    }

    if (!pathsGroup) {
        pathsGroup = new THREE.Group();
        pathsGroup.name = "Paths";
        scene.add(pathsGroup);
    } else {
        scene.add(pathsGroup);
    }

    if (!labelsGroup) {
        labelsGroup = new THREE.Group();
        labelsGroup.name = "ZoneLabels";
        scene.add(labelsGroup);
    } else {
        scene.add(labelsGroup);
    }

    // Инициализируем линию пути
    const geometry = new THREE.BufferGeometry();
    const lineMaterial = new THREE.LineBasicMaterial({ 
        color: pathColor, 
        linewidth: 2,
        vertexColors: true
    });
    pathLine = new THREE.Line(geometry, lineMaterial);
    pathsGroup.add(pathLine);

    // Устанавливаем слушатели событий для переключения видимости
    pathsToggleListener = (e) => {
        pathsVisible = e.detail.checked;
        if (pathsGroup) pathsGroup.visible = pathsVisible;
    };
    window.addEventListener('pathsToggle', pathsToggleListener);

    zonesToggleListener = (e) => {
        zonesVisible = e.detail.checked;
        if (zonesGroup) zonesGroup.visible = zonesVisible;
        if (labelsGroup) labelsGroup.visible = zonesVisible;
    };
    window.addEventListener('zonesToggle', zonesToggleListener);
}

/**
 * Добавляем новую точку к пути крюка
 * Точка добавляется только если:
 * - Прошло достаточно времени с последней записи
 * - Крюк переместился на достаточное расстояние
 * @param {THREE.Vector3} position - Где сейчас находится крюк
 * @param {Object} data - Информация о грузе (вес, тип груза, время)
 */
export function addPositionToPath(position, data) {
    const now = performance.now();
    
    // Пропускаем точки, которые слишком близки по времени
    if (now - lastPathTime < minTimeIntervalMs) {
        return;
    }
    
    // Проверяем, есть ли предыдущие точки и достаточно ли далеко текущая точка
    if (pathPoints.length > 0) {
        const lastPoint = pathPoints[pathPoints.length - 1];
        const distance = position.distanceTo(new THREE.Vector3(lastPoint.x, lastPoint.y, lastPoint.z));
        if (distance < minDistanceForPathPoint) {
            return;
        }
    }
    
    // Добавляем точку с данными
    pathPoints.push({
        x: position.x,
        y: position.y,
        z: position.z,
        weight: data.weight,
        time: data.timeMillis,
        cargoType: data.cargoType
    });
    
    // Ограничиваем количество точек
    if (pathPoints.length > maxPathLength) {
        pathPoints.shift();
    }
    
    // Обновляем визуализацию пути
    updatePathLine();
    lastPathTime = now;
}

/**
 * Обновляем как выглядит линия пути крюка
 * Цвет линии зависит от:
 * - Пустой крюк: светло-синий
 * - Есть груз: от желтого до красного (зависит от веса)
 * - Бетон: темно-синий
 */
function updatePathLine() {
    if (!pathLine || pathPoints.length < 2) return;
    
    const positions = [];
    const colors = [];
    
    // Создаем цвета для каждой точки пути
    pathPoints.forEach(point => {
        positions.push(point.x, point.y, point.z);
        
        // Выбираем цвет в зависимости от груза
        let pointColor = new THREE.Color(pathColor);
        
        if (point.cargoType === 'concrete') {
            pointColor.setRGB(0.3, 0.5, 0.85); // Синий для бетона
        } else if (point.weight > 0) {
            // От желтого до красного в зависимости от веса (0-16 тонн)
            const normalizedWeight = Math.min(1, point.weight / 16);
            pointColor.setRGB(1, 1 - normalizedWeight, 0);
        } else {
            // Светло-синий для пустого крюка
            pointColor.setRGB(0.6, 0.8, 1);
        }
        
        colors.push(pointColor.r, pointColor.g, pointColor.b);
    });
    
    // Обновляем линию на экране
    pathLine.geometry.dispose();
    pathLine.geometry = new THREE.BufferGeometry();
    pathLine.geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    pathLine.geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
}

/**
 * Стираем весь путь крюка
 */
export function clearPath() {
    pathPoints = [];
    if (pathLine) {
        pathLine.geometry.dispose();
        pathLine.geometry = new THREE.BufferGeometry();
    }
}

/**
 * Показываем на экране зоны работы крана:
 * - Зеленые цилиндры - места погрузки
 * - Оранжевые цилиндры - места разгрузки
 * Размер цилиндра зависит от количества операций
 * @param {Array} loadingZones - Список мест погрузки
 * @param {Array} unloadingZones - Список мест разгрузки
 */
export function visualizeZones(loadingZones, unloadingZones) {
    // Очищаем существующие зоны
    while (zonesGroup.children.length > 0) {
        const obj = zonesGroup.children[0];
        if (obj.geometry) obj.geometry.dispose();
        zonesGroup.remove(obj);
    }
    
    while (labelsGroup.children.length > 0) {
        const obj = labelsGroup.children[0];
        if (obj.material && obj.material.map) obj.material.map.dispose();
        if (obj.material) obj.material.dispose();
        labelsGroup.remove(obj);
    }
    
    // Создаем зоны погрузки (зеленые)
    loadingZones.forEach((zone, index) => {
        if (!zone.position || !zone.count) return;
        
        const radius = Math.min(5, Math.max(2, Math.sqrt(zone.count)));
        const height = Math.min(10, Math.max(1, Math.log(zone.count) * 2));
        
        const geometry = new THREE.CylinderGeometry(radius, radius, height, 16);
        const mesh = new THREE.Mesh(geometry, loadingZoneMaterial);
        
        mesh.position.set(zone.position.x, height/2, zone.position.z);
        mesh.userData = {
            type: 'loading',
            count: zone.count,
            avgWeight: zone.avgWeight
        };
        
        zonesGroup.add(mesh);
        
        // Добавляем надпись с деталями
        addZoneLabel(zone.position.x, height + 1, zone.position.z, 
            `Погрузка\nОпераций: ${zone.count}\nСр. вес: ${zone.avgWeight ? zone.avgWeight.toFixed(1) : '?'} т`, 
            0x2ca05a);
    });
    
    // Создаем зоны разгрузки (оранжевые)
    unloadingZones.forEach((zone, index) => {
        if (!zone.position || !zone.count) return;
        
        const radius = Math.min(5, Math.max(2, Math.sqrt(zone.count)));
        const height = Math.min(10, Math.max(1, Math.log(zone.count) * 2));
        
        const geometry = new THREE.CylinderGeometry(radius, radius, height, 16);
        const mesh = new THREE.Mesh(geometry, unloadingZoneMaterial);
        
        mesh.position.set(zone.position.x, height/2, zone.position.z);
        mesh.userData = {
            type: 'unloading',
            count: zone.count,
            avgWeight: zone.avgWeight
        };
        
        zonesGroup.add(mesh);
        
        // Добавляем надпись с деталями
        addZoneLabel(zone.position.x, height + 1, zone.position.z, 
            `Выгрузка\nОпераций: ${zone.count}\nСр. вес: ${zone.avgWeight ? zone.avgWeight.toFixed(1) : '?'} т`, 
            0xf07f23);
    });
    
    // Устанавливаем видимость на основе состояния переключателя
    zonesGroup.visible = zonesVisible;
    labelsGroup.visible = zonesVisible;
}

/**
 * Показываем места, где заливали бетон
 * Отмечаем синими цилиндрами
 * @param {Array} operations - Список операций с бетоном
 */
export function visualizeConcreteOperations(operations) {
    operations.forEach(op => {
        if (!op.position) return;
        
        const radius = 2.5;
        const height = 1.5;
        
        const geometry = new THREE.CylinderGeometry(radius, radius, height, 16);
        const mesh = new THREE.Mesh(geometry, concretePourMaterial);
        
        mesh.position.set(op.position.x, height/2, op.position.z);
        mesh.userData = {
            type: 'concrete',
            startTime: op.startTime,
            endTime: op.endTime,
            avgWeight: op.avgWeight
        };
        
        zonesGroup.add(mesh);
        
        // Добавляем надпись
        addZoneLabel(op.position.x, height + 1, op.position.z, 
            `Бетон\nСр. вес: ${op.avgWeight ? op.avgWeight.toFixed(1) : '?'} т`, 
            0x4c84b8);
    });
}

/**
 * Создаем текст над зоной работы
 * @param {number} x - Где по горизонтали
 * @param {number} y - Насколько высоко
 * @param {number} z - Где по глубине
 * @param {string} text - Что написать
 * @param {number} color - Каким цветом
 */
function addZoneLabel(x, y, z, text, color) {
    // Создаем табличку с текстом
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    
    // Рисуем фон и текст
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';  // Полупрозрачный черный фон
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Настраиваем как будет выглядеть текст
    ctx.font = 'bold 20px Arial';
    ctx.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Разбиваем текст на строчки и пишем каждую отдельно
    const lines = text.split('\n');
    const lineHeight = 22;
    const startY = (canvas.height - (lines.length * lineHeight)) / 2 + 5;
    
    lines.forEach((line, i) => {
        ctx.fillText(line, canvas.width / 2, startY + (i * lineHeight));
    });
    
    // Создаем табличку в 3D пространстве
    const texture = new THREE.Texture(canvas);
    texture.needsUpdate = true;
    
    const material = new THREE.SpriteMaterial({
        map: texture,
        transparent: true
    });
    
    // Размещаем табличку над зоной
    const sprite = new THREE.Sprite(material);
    sprite.position.set(x, y, z);
    sprite.scale.set(5, 2.5, 1);
    
    labelsGroup.add(sprite);
}

/**
 * Очищаем всё перед выходом:
 * - Удаляем пути крюка
 * - Удаляем зоны работы
 * - Удаляем надписи
 * - Освобождаем память
 */
export function cleanup() {
    // Очищаем пути
    clearPath();
    
    // Удаляем все геометрии и материалы
    if (pathLine) {
        if (pathLine.geometry) pathLine.geometry.dispose();
        if (pathLine.material) pathLine.material.dispose();
    }
    
    // Очищаем группу зон
    if (zonesGroup) {
        while (zonesGroup.children.length > 0) {
            const obj = zonesGroup.children[0];
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) obj.material.dispose();
            zonesGroup.remove(obj);
        }
        scene?.remove(zonesGroup);
    }
    
    // Очищаем группу путей
    if (pathsGroup) {
        while (pathsGroup.children.length > 0) {
            const obj = pathsGroup.children[0];
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) obj.material.dispose();
            pathsGroup.remove(obj);
        }
        scene?.remove(pathsGroup);
    }
    
    // Очищаем группу надписей
    if (labelsGroup) {
        while (labelsGroup.children.length > 0) {
            const obj = labelsGroup.children[0];
            if (obj.material && obj.material.map) obj.material.map.dispose();
            if (obj.material) obj.material.dispose();
            labelsGroup.remove(obj);
        }
        scene?.remove(labelsGroup);
    }
    
    // Удаляем общие материалы
    if (loadingZoneMaterial) loadingZoneMaterial.dispose();
    if (unloadingZoneMaterial) unloadingZoneMaterial.dispose();
    if (concretePourMaterial) concretePourMaterial.dispose();
    
    // Удаляем слушатели событий
    if (pathsToggleListener) window.removeEventListener('pathsToggle', pathsToggleListener);
    if (zonesToggleListener) window.removeEventListener('zonesToggle', zonesToggleListener);
    
    // Сбрасываем переменные
    scene = null;
    pathPoints = [];
    pathLine = null;
    zonesGroup = null;
    pathsGroup = null;
    labelsGroup = null;
}