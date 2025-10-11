/**
 * Управляет всеми надписями на экране:
 * - Информация о положении крюка
 * - Скорость ветра
 * - Статистика работы крана
 */

// Элементы для показа информации
let hookLabelElement;      // Надпись возле крюка
let windLabelElement;      // Надпись о скорости ветра
let analyticsPanel;       // Панель со статистикой

// Можно ли видеть надписи
let hookLabelVisible = true;     // Показывать информацию возле крюка
let analyticsVisible = true;     // Показывать статистику

/**
 * Находим все элементы для надписей на странице
 */
export function init(container) {
    hookLabelElement = document.getElementById('label-hook-info');
    windLabelElement = document.getElementById('label-wind-info');
    analyticsPanel = document.getElementById('analytics-panel');
    if (!hookLabelElement || !windLabelElement || !analyticsPanel) {
        console.warn("Некоторые элементы подписей не найдены");
    }
}

/**
 * Обновляем положение и содержание надписей:
 * - Координаты крюка
 * - Вес груза
 * - Время операции
 * - Скорость ветра
 */
export function updateLabels(record, hookPosition, craneTopPosition) {
    // Обновляем информацию возле крюка
    if (hookLabelElement) {
        hookLabelElement.style.left = `${hookPosition.x}px`;
        hookLabelElement.style.top = `${hookPosition.y}px`;
        hookLabelElement.style.display = hookLabelVisible ? 'block' : 'none';

        if (record) {
            hookLabelElement.style.fontSize = '13px';
            hookLabelElement.style.fontFamily = 'monospace';
            // Добавляем время из файла
            const timeStr = record.timeString ? formatRUDateTime(record.timeString) : "--";
            let cargoHint = "";
            // Подсказка о типе груза (если определено искусственным интеллектом)
            if (record.aiCargoType) {
                cargoHint = ` (${record.aiCargoType === "concrete" ? "бетон" : record.aiCargoType})`;
            }
            hookLabelElement.textContent =
                `Время: ${timeStr}\n` +
                `Высота: ${record.height !== null && typeof record.height === 'number' ? record.height.toFixed(1) + ' м' : '--'}\n` +
                `Вес: ${record.weight !== null && typeof record.weight === 'number' ? record.weight.toFixed(2) + ' т' : '--'}${cargoHint}\n` +
                `Радиус: ${record.radius !== null && typeof record.radius === 'number' ? record.radius.toFixed(1) + ' м' : '--'}\n` +
                `Угол: ${record.angle !== null && typeof record.angle === 'number' ? record.angle.toFixed(1) + '°' : '--'}`;
        } else {
             // Show default info if no record (e.g., initial state or no file)
             hookLabelElement.textContent =
                `Время: --:--:--\n` +
                `Высота: -- м\n` +
                `Вес: -- т\n` +
                `Радиус: -- м\n` +
                `Угол: --°`;
        }
    }

    // Обновляем информацию о ветре
    if (windLabelElement) {
         // Размещаем надпись о ветре наверху крана
        windLabelElement.style.left = `${craneTopPosition.x}px`;
        windLabelElement.style.top = `${craneTopPosition.y}px`;

        if (record && record.wind !== null && typeof record.wind === 'number') {
            windLabelElement.style.display = 'block';
            windLabelElement.textContent = `Скорость ветра: ${record.wind.toFixed(1)} м/с`;
            windLabelElement.style.fontSize = '13px';
        } else {
            windLabelElement.style.display = 'none';
        }
    }
}

/**
 * Переводит время в российский формат (день.месяц.год часы:минуты:секунды)
 */
function formatRUDateTime(tstr) {
    try {
        const date = new Date(tstr);
        // Check for valid date and year (Excel dates sometimes parse to 1899/1900)
        if (!isNaN(date) && date.getFullYear() > 1970) { // Use a reasonable cutoff
            const opts = {
                day: "2-digit", month: "2-digit", year: "numeric", // Changed year to numeric for clarity
                hour: "2-digit", minute: "2-digit", second: "2-digit"
            };
            return date.toLocaleString('ru-RU', opts);
        }
    } catch (e) {
        console.error("Error formatting date:", tstr, e);
    }
     // If parsing fails or date is clearly invalid, try simpler output or show original
     try {
         const justTime = tstr.split('T')[1]?.split('.')[0]; // Try to extract HH:MM:SS from ISO
         if (justTime) return justTime;
     } catch (e) {}

    return tstr; // Fallback to original string
}

/**
 * Обновляем статистику по работе крана:
 * - Где чаще всего разгружают
 * - Где чаще всего загружают
 * - Места заливки бетона
 */
export function updateAnalytics(loadingZones, unloadingZones, concreteOperations) {
    if (!analyticsPanel) return;
    analyticsPanel.style.display = analyticsVisible ? 'block' : 'none';
    if (!analyticsVisible) return;
    let content = '<h4>Аналитика операций</h4>';
    if (unloadingZones.length > 0) {
        content += '<p><b>Частые площадки выгрузки:</b></p><ul>';
        // Show top 3 zones
        unloadingZones.slice(0, 3).forEach(zone => {
             // Check for valid numbers before toFixed
            const posX = typeof zone.position?.x === 'number' ? zone.position.x.toFixed(1) : '--';
            const posY = typeof zone.position?.y === 'number' ? zone.position.y.toFixed(1) : '--';
            const posZ = typeof zone.position?.z === 'number' ? zone.position.z.toFixed(1) : '--';
            const avgW = typeof zone.avgWeight === 'number' ? zone.avgWeight.toFixed(1) : '--';
            content += `<li>Координаты (${posX}, ${posY}, ${posZ}) —
                       ${zone.count} операций, ср. вес: ${avgW} т</li>`;
        });
        content += '</ul>';
    }
     if (loadingZones.length > 0) {
        content += '<p><b>Частые площадки загрузки:</b></п><ул>';
        // Show top 3 zones
        loadingZones.slice(0, 3).forEach(zone => {
             // Check for valid numbers before toFixed
            const posX = typeof zone.position?.x === 'number' ? zone.position.x.toFixed(1) : '--';
            const posY = typeof zone.position?.y === 'number' ? zone.position.y.toFixed(1) : '--';
            const posZ = typeof zone.position?.z === 'number' ? zone.position.z.toFixed(1) : '--';
            const avgW = typeof zone.avgWeight === 'number' ? zone.avgWeight.toFixed(1) : '--';
             content += `<li>Координаты (${posX}, ${posY}, ${posZ}) —
                       ${zone.count} операций, ср. вес: ${avgW} т</ли>`;
        });
        content += '</ул>';
    }
    // Add Concrete Operations section
    if (concreteOperations && concreteOperations.length > 0) {
        content += '<п><б>Операции заливки бетона:</б></п><ул>';
        concreteOperations.forEach(op => {
            const startTime = op.startTime ? formatRUDateTime(op.startTime) : '--';
            const endTime = op.endTime ? formatRUDateTime(op.endTime) : '--';
             const posX = typeof op.position?.x === 'number' ? op.position.x.toFixed(1) : '--';
            const posY = typeof op.position?.y === 'number' ? op.position.y.toFixed(1) : '--';
            const posZ = typeof op.position?.z === 'number' ? op.position.z.toFixed(1) : '--';
            const avgW = typeof op.avgWeight === 'number' ? op.avgWeight.toFixed(1) : '--';

            content += `<ли>${startTime} - ${endTime}<бр>Координаты (${posX}, ${posY}, ${posZ}), ср. вес: ${avgW} т</ли>`;
        });
        content += '</ул>';
    }

    // Fallback if no zones or operations found
    if (unloadingZones.length === 0 && loadingZones.length === 0 && (!concreteOperations || concreteOperations.length === 0)) {
        content += '<п>Данные аналитики пока отсутствуют или не обнаружены значимые операции.</п>';
    }

    analyticsPanel.innerHTML = content;
}

/**
 * Включить/выключить информацию возле крюка
 */
export function setHookLabelVisible(visible) {
    hookLabelVisible = visible;
}

/**
 * Включить/выключить показ статистики
 */
export function setAnalyticsVisible(visible) {
    analyticsVisible = visible;
    if (analyticsPanel) {
        analyticsPanel.style.display = visible ? 'block' : 'none';
    }
}

/**
 * Узнать, какие надписи сейчас видны
 */
export function getVisibilityState() {
    return {
        hookLabelVisible,
        analyticsVisible
    };
}

/**
 * Убираем все надписи при завершении работы
 */
export function cleanup() {
    hookLabelElement = null;
    windLabelElement = null;
    analyticsPanel = null;
}