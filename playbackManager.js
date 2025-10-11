// Управление воспроизведением симуляции работы крана
let isPlaying = false;
let playDirection = 1; // 1 - вперед, -1 - назад
let playbackSpeed = 1.0; // Скорость воспроизведения
let currentFrameIndex = 0; // Текущий момент времени
let elapsedSimulationTime = 0; // Сколько времени прошло
let totalSimulationDuration = 0; // Общая длительность записи
let historyData = []; // Данные о работе крана
let frameUpdateCallback = null; // Функция обновления кадра
let timelineUpdateCallback = null; // Функция обновления временной шкалы
let lastTimestamp = 0; // Для расчета прошедшего времени

export function init(data, onFrameUpdate, onTimelineUpdate) {
    historyData = data || [];
    frameUpdateCallback = onFrameUpdate;
    timelineUpdateCallback = onTimelineUpdate;
    currentFrameIndex = 0;
    elapsedSimulationTime = 0;
    isPlaying = false; // Start paused
    playDirection = 1; // Default direction
    playbackSpeed = 1.0; // Default speed

    // Calculate total duration based on the last record's relative time
    totalSimulationDuration = historyData.length > 0 ?
        historyData[historyData.length - 1].relativeTimeMillis : 0;

    lastTimestamp = performance.now(); // Initialize timestamp

    // Ensure initial UI update, even if history is empty
    if (timelineUpdateCallback) {
         // Pass data to update UI with max range and time string
        timelineUpdateCallback(currentFrameIndex, historyData);
    }
}

export function update(currentTime) {
    const deltaTime = (currentTime - lastTimestamp) / 1000; // deltaTime in seconds
    lastTimestamp = currentTime;

    if (!isPlaying || historyData.length < 2) return; // Need at least 2 frames to animate

    const timeStep = deltaTime * 1000 * playbackSpeed * playDirection; // timeStep in milliseconds

    let newElapsedSimulationTime = elapsedSimulationTime + timeStep;

    // Clamp elapsed time
    newElapsedSimulationTime = Math.max(0, Math.min(newElapsedSimulationTime, totalSimulationDuration));

    // If time hasn't changed significantly or we're at the boundary, stop or return
    if (Math.abs(newElapsedSimulationTime - elapsedSimulationTime) < 0.1 &&
        ((playDirection === 1 && newElapsedSimulationTime >= totalSimulationDuration - 0.1) ||
         (playDirection === -1 && newElapsedSimulationTime <= 0.1))) {

        elapsedSimulationTime = newElapsedSimulationTime; // Ensure it's exactly at the boundary
        // Stop playback if at the end/beginning
        if ((playDirection === 1 && elapsedSimulationTime >= totalSimulationDuration - 0.1) ||
            (playDirection === -1 && elapsedSimulationTime <= 0.1)) {
             isPlaying = false;
             const playPauseButton = document.getElementById('play-pause-button');
             if (playPauseButton) playPauseButton.classList.remove("playing");
        }
         // Update UI one last time if needed (e.g., to ensure it shows the final timestamp)
        if (currentFrameIndex !== findFrameIndexForTime(elapsedSimulationTime) && timelineUpdateCallback) {
             currentFrameIndex = findFrameIndexForTime(elapsedSimulationTime);
             timelineUpdateCallback(currentFrameIndex, historyData);
        }
        return;
    }


    elapsedSimulationTime = newElapsedSimulationTime;


    const newFrameIndex = findFrameIndexForTime(elapsedSimulationTime);

    // Only update if frame index has changed
    if (newFrameIndex !== currentFrameIndex) {
        currentFrameIndex = newFrameIndex;
        if (frameUpdateCallback) {
            frameUpdateCallback(currentFrameIndex);
        }
        if (timelineUpdateCallback) {
             // Pass data to update UI with max range and time string
            timelineUpdateCallback(currentFrameIndex, historyData);
        }

        // Check if we hit the end/beginning after the frame update
         if ((playDirection === 1 && currentFrameIndex >= historyData.length - 1) ||
            (playDirection === -1 && currentFrameIndex <= 0)) {
             isPlaying = false;
             const playPauseButton = document.getElementById('play-pause-button');
             if (playPauseButton) playPauseButton.classList.remove("playing");
         }
    } else {
        // Even if index didn't change, update UI to show smoothed time if slider moves
         if (timelineUpdateCallback) {
            timelineUpdateCallback(currentFrameIndex, historyData);
         }
    }
}

/**
 * Находит ближайший момент времени в записи крана (в миллисекундах).
 * Ищет от текущей позиции для быстроты.
 * Данные должны быть отсортированы по времени.
 */
function findFrameIndexForTime(timeMillis) {
    if (historyData.length === 0) return 0;

    // Clamp time within bounds
    timeMillis = Math.max(0, Math.min(timeMillis, totalSimulationDuration));

    // Optimize search direction based on playback direction or current vs target time
    const targetIndex = (playDirection === 1 || timeMillis >= historyData[currentFrameIndex].relativeTimeMillis)
        ? findForward(timeMillis)
        : findBackward(timeMillis);

    return targetIndex;
}

// Поиск вперед по времени
function findForward(timeMillis) {
     // Search forward from current index
    for (let i = currentFrameIndex; i < historyData.length; i++) {
        if (historyData[i].relativeTimeMillis >= timeMillis) {
            return i;
        }
    }
    // If not found, return the last index
    return historyData.length - 1;
}

// Поиск назад по времени
function findBackward(timeMillis) {
     // Search backward from current index
     for (let i = currentFrameIndex; i >= 0; i--) {
         if (historyData[i].relativeTimeMillis <= timeMillis) {
             return i;
         }
     }
     // If not found, return the first index
     return 0;
}

/**
 * Включает или выключает воспроизведение
 * Если включаем в конце записи - начинаем сначала
 * Если включаем в начале при обратном воспроизведении - начинаем с конца
 */
export function togglePlayPause() {
    if (historyData.length < 2) return false;
    isPlaying = !isPlaying;
    if (isPlaying) {
        // If starting play, capture current time for delta calculation
        lastTimestamp = performance.now();
        // If at the end in forward mode, restart from the beginning
        if (playDirection === 1 && currentFrameIndex >= historyData.length - 1) {
             elapsedSimulationTime = 0;
             currentFrameIndex = 0;
             if (frameUpdateCallback) frameUpdateCallback(currentFrameIndex);
             if (timelineUpdateCallback) timelineUpdateCallback(currentFrameIndex, historyData);
        }
        // If at the beginning in reverse mode, restart from the end
         if (playDirection === -1 && currentFrameIndex <= 0) {
            elapsedSimulationTime = totalSimulationDuration;
            currentFrameIndex = historyData.length - 1;
            if (frameUpdateCallback) frameUpdateCallback(currentFrameIndex);
            if (timelineUpdateCallback) timelineUpdateCallback(currentFrameIndex, historyData);
         }
    }
    return isPlaying;
}

/**
 * Меняет направление воспроизведения (вперед/назад)
 */
export function toggleDirection() {
    playDirection *= -1;
    // Ensure UI button state reflects playback direction if needed
}

/**
 * Устанавливает скорость воспроизведения
 */
export function setSpeed(speed) {
    playbackSpeed = speed;
}

/**
 * Переходит к указанному моменту времени в записи
 */
export function setCurrentFrame(index) {
     if (historyData.length === 0) return;
    const clampedIndex = Math.max(0, Math.min(index, historyData.length - 1));
    if (clampedIndex !== currentFrameIndex) {
        currentFrameIndex = clampedIndex;
        elapsedSimulationTime = historyData[currentFrameIndex].relativeTimeMillis; // Sync time to index
        if (frameUpdateCallback) {
            frameUpdateCallback(currentFrameIndex);
        }
         if (timelineUpdateCallback) {
            timelineUpdateCallback(currentFrameIndex, historyData);
         }
    }
}

/**
 * Возвращает текущий момент времени в записи
 */
export function getCurrentFrameIndex() {
    return currentFrameIndex;
}

/**
 * Возвращает данные о положении крана в текущий момент
 */
export function getCurrentFrameData() {
     if (historyData.length === 0) return null;
    return historyData[currentFrameIndex];
}

/**
 * Возвращает все данные о работе крана
 */
export function getHistoryData() {
    return historyData;
}

/**
 * Сбрасывает все настройки воспроизведения:
 * - Останавливает воспроизведение
 * - Устанавливает направление вперед
 * - Сбрасывает скорость на нормальную
 * - Очищает все данные
 */
export function reset() {
    isPlaying = false;
    playDirection = 1;
    playbackSpeed = 1.0;
    currentFrameIndex = 0;
    elapsedSimulationTime = 0;
    totalSimulationDuration = 0;
    historyData = [];
    frameUpdateCallback = null;
    timelineUpdateCallback = null;
    lastTimestamp = 0;
}