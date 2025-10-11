import * as THREE from 'three';
// Подключаем все нужные модули для работы крана
import * as SceneManager from './sceneManager.js';
import * as CraneModel from './craneModel.js';
import * as PlaybackManager from './playbackManager.js';
import * as LabelManager from './labelManager.js';
import * as UI from './ui.js';
import * as CraneAnimator from './CraneAnimator.js';
import * as CraneAuxiliaryGraphics from './CraneAuxiliaryGraphics.js';
import * as AIAnalyticsService from './AIAnalyticsService.js';
import * as PathVisualizer from './pathVisualizer.js';

// Основные переменные для работы с 3D моделью крана
let config, historyData, scene, camera, renderer, controls, craneGroup;
let animationFrameId = null;
let currentFrameIndex = 0;

// --- Поддержка умного анализа через websim.chat ---
let analyticsResult = null;

// Ссылки на обработчики кнопок, которые нужно правильно отключить при завершении
let hookLabelToggleListener = null;    // Кнопка "Показать информацию у крюка"
let analyticsToggleListener = null;    // Кнопка "Показать статистику"
let togglePlayPauseListener = null;    // Кнопка "Старт/Стоп"
let toggleReverseListener = null;      // Кнопка "Вперед/Назад"
let timelineSeekListener = null;       // Ползунок времени
let speedChangeListener = null;        // Выбор скорости воспроизведения

/**
 * Запускает визуализацию крана
 * @param {Object} _config - Настройки крана из паспорта
 * @param {Array} _historyData - История работы крана из файла
 */
export function initVisualization(_config, _historyData) {
    console.log("Запускаем визуализацию...");
    config = _config;
    historyData = _historyData && Array.isArray(_historyData) ? _historyData : [];
    const sceneCanvas = document.getElementById('scene-canvas');
    sceneCanvas.innerHTML = ""; // Очищаем старый холст

    // Создаём 3D сцену (камера, свет, земля, сетка)
    ({ scene, camera, renderer, controls } = SceneManager.initScene(sceneCanvas, config));

    // Строим модель крана и добавляем на сцену
    craneGroup = CraneModel.buildCraneModel(config);
    scene.add(craneGroup);

    // Добавляем трос и груз под крюком
    CraneAuxiliaryGraphics.setupRopeAndLoad(craneGroup);

    // Настраиваем отображение путей движения груза
    PathVisualizer.init(scene, config);

    // Настраиваем надписи на экране
    LabelManager.init(document.getElementById('data-labels-container'));

    // --- Настройка воспроизведения ---
    if (historyData.length > 0) {
        console.log("Найдены данные о работе. Настраиваем воспроизведение...");
        PlaybackManager.init(historyData, handleFrameUpdate, UI.updateTimelineUI);
        handleFrameUpdate(0); // Set the scene to the state of the first frame
    } else {
        console.log("Нет данных о работе. Отображаем статическую конфигурацию крана.");
        UI.updateTimelineUI(0, []); // Disable timeline UI

        // Update the dynamic scene elements for the static config display
        const animatedPositions = CraneAnimator.updateCraneAnimation(craneGroup, config, null); // Pass null frame for static config
        CraneAuxiliaryGraphics.updateRopeAndLoadGraphics({
            trolleyLocalPos: animatedPositions.trolleyLocalPos,
            hookLocalPos: animatedPositions.hookLocalPos,
            weight: null, // No weight in static config
            reeving: 2, // Default reeving for static view
            aiCargoType: null,
            prevWeight: null,
            index: 0
        });
         // Update labels for the static view
        const hookGroup = craneGroup.getObjectByName('Upper Structure (Rotating)').getObjectByName('Hook Group');
        const hookWorld = hookGroup ? hookGroup.getWorldPosition(new THREE.Vector3()) : new THREE.Vector3();
        const hookScreen = SceneManager.get2DPosition(hookWorld);

        const jib = craneGroup.getObjectByName('Upper Structure (Rotating)').getObjectByName('Jib');
         // Get jib tip world position for wind label placement
        const jibTipLocal = new THREE.Vector3(jib.geometry.parameters.width/2, jib.position.y, jib.position.z);
        jib.localToWorld(jibTipLocal); // jibTipLocal is now in world coordinates
        const jibScreen = SceneManager.get2DPosition(jibTipLocal);

        LabelManager.updateLabels(null, hookScreen, jibScreen); // Pass null record for static state
    }

    // --- Настройка обработчиков кнопок управления визуализацией ---
    console.log("Настраиваем обработчики кнопок управления визуализацией...");
    // Label visibility toggles (listen to custom events from script.js or direct element changes)
    // Listening to window events allows decoupled control
    hookLabelToggleListener = e => LabelManager.setHookLabelVisible(e.detail.checked);
    window.addEventListener('hookLabelToggle', hookLabelToggleListener);

    analyticsToggleListener = e => {
        LabelManager.setAnalyticsVisible(e.detail.checked);
        UI.showAnalyticsPanel(e.detail.checked); // Control panel visibility directly
    };
    window.addEventListener('analyticsToggle', analyticsToggleListener);

     // Playback controls (listen to custom events from script.js or direct element clicks)
    togglePlayPauseListener = () => {
        if (PlaybackManager.getHistoryData().length > 1) { // Need at least 2 frames
            const playing = PlaybackManager.togglePlayPause();
            const btn = document.getElementById('play-pause-button');
            if (btn) btn.classList.toggle("playing", playing);
        }
    };
    window.addEventListener('togglePlayPause', togglePlayPauseListener);

    toggleReverseListener = () => {
        if (PlaybackManager.getHistoryData().length > 1) {
            PlaybackManager.toggleDirection();
        }
    };
    window.addEventListener('toggleReverse', toggleReverseListener);

    timelineSeekListener = e => {
        if (PlaybackManager.getHistoryData().length > 0) {
            PlaybackManager.setCurrentFrame(e.detail.index);
        }
    };
    window.addEventListener('timelineSeek', timelineSeekListener);

    speedChangeListener = e => {
        if (PlaybackManager.getHistoryData().length > 0) {
            PlaybackManager.setSpeed(e.detail.speed);
        }
    };
    window.addEventListener('speedChange', speedChangeListener);

    // --- AI Analytics Stage (Asynchronous) ---
    // Only run analytics if there's sufficient history data (more than a few distinct points)
    if (historyData && historyData.length > 50) { // Increased threshold slightly for meaningful analysis
        console.log(`Запускаем умный анализ на ${historyData.length} точках данных...`);
        AIAnalyticsService.runAnalytics(historyData).then(res => {
            analyticsResult = res;
            if (res) {
                console.log("Умный анализ успешно завершен.", res);
                // Merge AI cargo types into history data for frame updates
                if (res.cargoTypes && Array.isArray(res.cargoTypes)) {
                    const cargoMap = new Map(res.cargoTypes.map(ct => [ct.frameIdx, ct.type]));
                     historyData.forEach((record, index) => {
                        if (cargoMap.has(index)) {
                            record.aiCargoType = cargoMap.get(index);
                        } else {
                             record.aiCargoType = null; // Ensure field exists even if null
                        }
                     });
                } else {
                     console.warn("Результат умного анализа не содержит массив cargoTypes.");
                      historyData.forEach(record => record.aiCargoType = null);
                }

                // Visualize zones and concrete operations in 3D
                if (res.loadingZones || res.unloadingZones) {
                     console.log("Отображаем зоны...");
                    PathVisualizer.visualizeZones(res.loadingZones || [], res.unloadingZones || []);
                } else {
                     console.warn("Результат умного анализа не содержит данные о зонах.");
                }

                if (res.concreteOperations && res.concreteOperations.length > 0) {
                    console.log(`Отображаем ${res.concreteOperations.length} конкретных операций.`);
                    PathVisualizer.visualizeConcreteOperations(res.concreteOperations);
                } else {
                     console.log("Умный анализ не выявил конкретных операций.");
                }

                // Update the HTML analytics panel
                LabelManager.updateAnalytics(
                    res.loadingZones || [],
                    res.unloadingZones || [],
                    res.concreteOperations || []
                );
                // Ensure panel visibility is correct based on toggle state
                UI.showAnalyticsPanel(LabelManager.getVisibilityState().analyticsVisible);

            } else {
                console.warn("Умный анализ не вернул результат или данные недействительны.");
                // Handle analytics failure by clearing panel and state
                LabelManager.updateAnalytics([], [], []); // Clear HTML panel
                 historyData.forEach(record => record.aiCargoType = null); // Clear any potential old AI data
                UI.showAnalyticsPanel(false);
                // Update toggle state in UI if it exists
                const analyticsToggle = document.getElementById('toggle-analytics');
                if (analyticsToggle) analyticsToggle.checked = false;
                LabelManager.setAnalyticsVisible(false);
            }
             // Ensure labels are updated after analytics result (cargo types) is merged into historyData
             handleFrameUpdate(currentFrameIndex);

        }).catch(error => {
            console.error("Сервис умного анализа не удался:", error);
            analyticsResult = null;
             historyData.forEach(record => record.aiCargoType = null); // Clear any partial AI data
            LabelManager.updateAnalytics([], [], []); // Clear HTML panel
            UI.showAnalyticsPanel(false);
            // Update toggle state in UI
            const analyticsToggle = document.getElementById('toggle-analytics');
            if (analyticsToggle) analyticsToggle.checked = false;
            LabelManager.setAnalyticsVisible(false);
            // Ensure labels are updated to reflect no AI data
            handleFrameUpdate(currentFrameIndex);
        });
    } else {
        console.log(`История данных слишком коротка (${historyData.length} записей) для умного анализа.`);
        analyticsResult = null;
         historyData.forEach(record => record.aiCargoType = null); // Clear any potential old AI data
        LabelManager.updateAnalytics([], [], []); // Clear HTML panel
        UI.showAnalyticsPanel(false);
         // Update toggle state in UI
        const analyticsToggle = document.getElementById('toggle-analytics');
        if (analyticsToggle) analyticsToggle.checked = false;
        LabelManager.setAnalyticsVisible(false);
         // Ensure labels are updated
        handleFrameUpdate(currentFrameIndex);
    }


    // --- Анимационный цикл ---
    console.log("Запускаем анимационный цикл...");
    function animate(currentTime) {
        // Pass currentTime to PlaybackManager for deltaTime calculation
        if (historyData.length > 1) {
            PlaybackManager.update(currentTime);
        }
        SceneManager.renderScene(); // Render the Three.js scene
        animationFrameId = requestAnimationFrame(animate);
    }
    let lastTimestamp = performance.now(); // Initialize for the animation loop
    animate(lastTimestamp); // Start animation loop
}

// --- Обновление кадра анимации ---
function handleFrameUpdate(idx) {
    currentFrameIndex = idx;
    const frame = PlaybackManager.getCurrentFrameData();
    const prevFrame = (idx > 0) ? PlaybackManager.getHistoryData()[idx - 1] : null;

    // Обновляем положение крана по данным из записи (угол, вылет, высота)
    const animatedPositions = CraneAnimator.updateCraneAnimation(craneGroup, config, frame);

    // Обновляем трос и груз (положение, тип груза, вес)
    const dataForAuxGraphics = {
        ...frame, // Включает вылет, высоту, угол, вес, запасовку, ветер, тип груза
        prevWeight: prevFrame ? prevFrame.weight : null,
        trolleyLocalPos: animatedPositions.trolleyLocalPos,
        hookLocalPos: animatedPositions.hookLocalPos,
        index: idx // Индекс кадра для возможной дополнительной логики
    };
    CraneAuxiliaryGraphics.updateRopeAndLoadGraphics(dataForAuxGraphics);

    // Получаем положение крюка в пространстве для рисования пути и размещения надписей
    const hookGroup = craneGroup.getObjectByName('Upper Structure (Rotating)').getObjectByName('Hook Group');
    if (hookGroup) {
        const hookWorld = hookGroup.getWorldPosition(new THREE.Vector3());
        // Добавляем текущую точку в путь крюка с данными о грузе
        if (frame) { // Добавляем только если есть данные
            PathVisualizer.addPositionToPath(hookWorld, {
                weight: frame.weight,
                timeMillis: frame.timeMillis,
                cargoType: frame.aiCargoType
            });
        }

        // Получаем координаты для надписей на экране
        const hookScreen = SceneManager.get2DPosition(hookWorld);

        // Получаем положение конца стрелы для надписи о ветре
        const jib = craneGroup.getObjectByName('Upper Structure (Rotating)').getObjectByName('Jib');
        const jibTipLocal = new THREE.Vector3(config.jibLength/2, jib.position.y, jib.position.z);
        jib.localToWorld(jibTipLocal);
        const jibScreen = SceneManager.get2DPosition(jibTipLocal);

        // Обновляем надписи на экране
        LabelManager.updateLabels(frame, hookScreen, jibScreen);
    }
}

// Function to be called by script.js when back button is clicked
export function setBackButtonCallback(cb) {
    const btn = document.getElementById('back-to-config');
    if (btn) btn.onclick = cb;
}

// --- Очистка ресурсов при завершении работы ---
export function cleanupVisualization() {
    console.log("Очищаем все ресурсы визуализации...");
    
    // Останавливаем анимацию движения крана
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    animationFrameId = null;

    // Убираем трос и груз с экрана
    CraneAuxiliaryGraphics.cleanupAuxiliaryGraphics();

    // Очищаем пути движения крюка и зоны работы крана
    PathVisualizer.cleanup();

    // Убираем 3D модель крана со сцены
    if (scene && craneGroup) {
        scene.remove(craneGroup);
        craneGroup = null;
    }

    // Очищаем всю 3D сцену (камеру, освещение, сетку)
    SceneManager.cleanup();
    
    // Освобождаем память от материалов крана
    CraneModel.disposeMaterials();

    // Убираем все надписи с экрана
    LabelManager.cleanup();

    // Сбрасываем настройки воспроизведения
    PlaybackManager.reset();

    // Очищаем результаты умного анализа
    analyticsResult = null;

    // Отключаем все кнопки управления
    if (hookLabelToggleListener) {
        window.removeEventListener('hookLabelToggle', hookLabelToggleListener);
        hookLabelToggleListener = null;
    }
    if (analyticsToggleListener) {
        window.removeEventListener('analyticsToggle', analyticsToggleListener);
        analyticsToggleListener = null;
    }
    if (togglePlayPauseListener) {
        window.removeEventListener('togglePlayPause', togglePlayPauseListener);
        togglePlayPauseListener = null;
    }
    if (toggleReverseListener) {
        window.removeEventListener('toggleReverse', toggleReverseListener);
        toggleReverseListener = null;
    }
    if (timelineSeekListener) {
        window.removeEventListener('timelineSeek', timelineSeekListener);
        timelineSeekListener = null;
    }
    if (speedChangeListener) {
        window.removeEventListener('speedChange', speedChangeListener);
        speedChangeListener = null;
    }

    console.log("Очистка завершена.");
}

// Делаем доступными функции управления сценой для других частей программы
export { SceneManager, controls, renderer, camera };