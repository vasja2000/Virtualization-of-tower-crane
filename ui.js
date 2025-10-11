/**
 * UI functions: переключение между формой и 3D, обновление панели времени,
 * управление элементами управления, всё на русском! (Русский интерфейс)
 */

let configContainer, visualizationContainer, formElement;
let loadingIndicator, submitButton, backButton;
let timelineSlider, timestampDisplay;
let playPauseButton, reverseButton, speedSelector;
let hookLabelToggle, analyticsToggle;
let analyticsPanel;
let isWallTiedCheckbox, wallTiesSection;

export function init() {
    configContainer = document.getElementById('config-container');
    visualizationContainer = document.getElementById('visualization-container');
    formElement = document.getElementById('crane-config-form');
    loadingIndicator = document.getElementById('loading-indicator');
    submitButton = document.getElementById('submit-button');
    backButton = document.getElementById('back-to-config');

    timelineSlider = document.getElementById('timeline-slider');
    timestampDisplay = document.getElementById('timestamp-display');
    playPauseButton = document.getElementById('play-pause-button');
    reverseButton = document.getElementById('reverse-button');
    speedSelector = document.getElementById('speed-selector');
    hookLabelToggle = document.getElementById('toggle-hook-label');
    analyticsToggle = document.getElementById('toggle-analytics');
    analyticsPanel = document.getElementById('analytics-panel');
    isWallTiedCheckbox = document.getElementById('isWallTied');
    wallTiesSection = document.getElementById('wall-ties-section');

    // Слушатели для переключателей
    if (hookLabelToggle) {
        hookLabelToggle.addEventListener('change', () => {
            const evt = new CustomEvent('hookLabelToggle', { detail: { checked: hookLabelToggle.checked } });
            window.dispatchEvent(evt);
        });
    }
    if (analyticsToggle) {
        analyticsToggle.addEventListener('change', () => {
            const evt = new CustomEvent('analyticsToggle', { detail: { checked: analyticsToggle.checked } });
            window.dispatchEvent(evt);
        });
    }
    // Управление плеером
    if (playPauseButton) {
        playPauseButton.addEventListener('click', () => {
            const evt = new Event('togglePlayPause');
            window.dispatchEvent(evt);
        });
    }
    if (reverseButton) {
        reverseButton.addEventListener('click', () => {
            const evt = new Event('toggleReverse');
            window.dispatchEvent(evt);
        });
    }
    if (timelineSlider) {
        timelineSlider.addEventListener('input', (e) => {
            const value = parseInt(e.target.value, 10);
            const evt = new CustomEvent('timelineSeek', { detail: { index: value } });
            window.dispatchEvent(evt);
        });
    }
    if (speedSelector) {
        speedSelector.addEventListener('change', (e) => {
            const val = parseFloat(e.target.value);
            const evt = new CustomEvent('speedChange', { detail: { speed: val } });
            window.dispatchEvent(evt);
        });
    }
}

/**
 * Переключает видимость: визуализация
 */
export function showVizView() {
    if (configContainer) configContainer.classList.add("hidden");
    if (visualizationContainer) visualizationContainer.classList.remove("hidden");
    window.scrollTo({ top: 0, behavior: "auto" });
}

/**
 * Переключает видимость: форма-конфигуратор
 */
export function showConfigView() {
    if (visualizationContainer) visualizationContainer.classList.add("hidden");
    if (configContainer) configContainer.classList.remove("hidden");
    window.scrollTo({ top: 0, behavior: "auto" });
}

export function setBackBtnCallback(cb) {
    if (backButton)
        backButton.onclick = cb;
}

/**
 * Получить ссылку на форму (для FormHandler)
 */
export function getFormElement() {
    return formElement;
}

export function getIsWallTiedCheckbox() {
    return isWallTiedCheckbox;
}
export function getWallTiesSection() {
    return wallTiesSection;
}

/**
 * Показать/скрыть индикатор загрузки
 */
export function showLoading(show) {
    if (loadingIndicator)
        loadingIndicator.classList.toggle('hidden', !show);
}
export function disableSubmitButton(disabled) {
    if (submitButton)
        submitButton.disabled = disabled;
}

/**
 * Обновление таймлайна крана (интерфейс для визуализации)
 * timelineSlider становится длиннее!  style="width: 1500px"
 * Показываем дату+время как в исходном файле (полностью!)
 */
export function updateTimelineUI(currentFrameIndex, historyData) {
    if (!timelineSlider || !timestampDisplay) return;

    if (!historyData || !Array.isArray(historyData) || historyData.length === 0) {
        timelineSlider.value = 0;
        timelineSlider.disabled = true;
        timestampDisplay.textContent = "--:--:--";
        return;
    }

    timelineSlider.max = historyData.length > 0 ? (historyData.length - 1) : 0;
    timelineSlider.value = currentFrameIndex;
    timelineSlider.disabled = false;
    timelineSlider.style.width = "1500px"; // длинная шкала: теперь 1.5 метра!

    const record = historyData[currentFrameIndex];
    if (record && record.timeString) {
        timestampDisplay.textContent = record.timeString; // показываем полностью (дата+время iso)
    } else {
        timestampDisplay.textContent = "--:--:--";
    }
}

// --- Панель аналитики ---
export function showAnalyticsPanel(show) {
    if (analyticsPanel)
        analyticsPanel.style.display = show ? 'block' : 'none';
}

// При необходимости сюда можно добавить другие функции

/**
 * Проверка работы интерфейса
 * Запускается вручную при настройке программы
 * Проверяет основные функции:
 * - Показ/скрытие индикатора загрузки
 * - Включение/выключение кнопок
 * - Работу временной шкалы
 */
export function runUITests() {
    let passed = 0;  // Сколько проверок прошло успешно
    let failed = 0;  // Сколько проверок не прошло
    
    // Проверка 1: Показ и скрытие индикатора загрузки
    showLoading(true);
    if (!loadingIndicator.classList.contains('hidden')) passed++; 
    else { 
        failed++; 
        console.error('Ошибка: Индикатор загрузки не появился'); 
    }
    showLoading(false);
    if (loadingIndicator.classList.contains('hidden')) passed++; 
    else { 
        failed++; 
        console.error('Ошибка: Индикатор загрузки не скрылся'); 
    }

    // Проверка 2: Включение и выключение кнопки "Применить"
    disableSubmitButton(true);
    if (submitButton.disabled) passed++; 
    else { 
        failed++; 
        console.error('Ошибка: Кнопка не отключилась'); 
    }
    disableSubmitButton(false);
    if (!submitButton.disabled) passed++; 
    else { 
        failed++; 
        console.error('Ошибка: Кнопка не включилась'); 
    }

    // Проверка 3: Временная шкала без данных и с данными
    updateTimelineUI(0, []);
    if (timelineSlider.disabled && timestampDisplay.textContent === "--:--:--") passed++; 
    else { 
        failed++; 
        console.error('Ошибка: Шкала времени не очистилась'); 
    }
    updateTimelineUI(0, [{timeString:"2023-01-01T11:22:33Z"}]);
    if (!timelineSlider.disabled && timestampDisplay.textContent.includes("11:22:33")) passed++; 
    else { 
        failed++; 
        console.error('Ошибка: Шкала времени не показала данные'); 
    }

    // Вывод результатов проверки
    if (failed === 0) {
        console.log(`Проверка интерфейса: Всё работает (${passed}/5 тестов пройдено)`);
    } else {
        console.warn(`Проверка интерфейса: ${passed} успешно, ${failed} с ошибками -- смотрите детали выше`);
    }
}