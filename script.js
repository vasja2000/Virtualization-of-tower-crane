import * as UI from './ui.js';
import * as FormHandler from './formHandler.js';
import * as FileProcessor from './fileProcessor.js';
import * as Visualization from './visualization.js';
import * as PathVisualizer from './pathVisualizer.js'; // Для управления отображением путей крюка
import * as CraneAuxiliaryGraphics from './CraneAuxiliaryGraphics.js'; // Для управления тросами и грузами

// Сохраняем ссылки на кнопки управления, чтобы потом правильно их отключить
let pathsToggleListener = null;    // Кнопка "Показать пути крюка"
let zonesToggleListener = null;    // Кнопка "Показать рабочие зоны"
let gridToggleListener = null;     // Кнопка "Показать сетку"
let axesToggleListener = null;     // Кнопка "Показать оси координат"
let ropesToggleListener = null;    // Кнопка "Показать тросы"
let groundToggleListener = null;   // Кнопка "Показать землю"

// --- Запуск программы ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("Страница загружена. Настраиваем интерфейс...");
    UI.init();
    FormHandler.init(handleFormSubmit); // Настраиваем обработку формы
    FormHandler.initialSetup(); // Проверяем настройки креплений к стене

    // Настраиваем кнопку "Вернуться к настройкам"
    Visualization.setBackButtonCallback(handleBackToConfig);

    // Настраиваем кнопки управления видом
    const pathsToggle = document.getElementById('toggle-paths');
    const zonesToggle = document.getElementById('toggle-zones');
    const gridToggle = document.getElementById('toggle-grid');
    const axesToggle = document.getElementById('toggle-axes');
    const ropesToggle = document.getElementById('toggle-ropes');
    const groundToggle = document.getElementById('toggle-ground');

    // Настройка переключателей видимости
    // Каждая кнопка управляет своей частью крана или визуализации
    if (pathsToggle) {
        pathsToggleListener = () => {
            const evt = new CustomEvent('pathsToggle', {
                detail: { checked: pathsToggle.checked }
            });
            window.dispatchEvent(evt);
        };
        pathsToggle.addEventListener('change', pathsToggleListener);
    }

    if (zonesToggle) {
        zonesToggleListener = () => {
            const evt = new CustomEvent('zonesToggle', {
                detail: { checked: zonesToggle.checked }
            });
            window.dispatchEvent(evt);
        };
        zonesToggle.addEventListener('change', zonesToggleListener);
    }

    // Visibility toggles handled by SceneManager and AuxiliaryGraphics listen to window events
    // We still add listeners here to manage their state and ensure they are added/removed correctly
    // (although the actual Three.js object visibility is handled by the respective modules)
    if (gridToggle) {
        gridToggleListener = () => {
            window.dispatchEvent(new CustomEvent('gridToggle', { detail: { checked: gridToggle.checked } }));
        };
        gridToggle.addEventListener('change', gridToggleListener);
    }
     if (axesToggle) {
        axesToggleListener = () => {
             window.dispatchEvent(new CustomEvent('axesToggle', { detail: { checked: axesToggle.checked } }));
        };
        axesToggle.addEventListener('change', axesToggleListener);
    }
     if (ropesToggle) {
        ropesToggleListener = () => {
            window.dispatchEvent(new CustomEvent('ropeToggle', { detail: { checked: ropesToggle.checked } }));
        };
        ropesToggle.addEventListener('change', ropesToggleListener);
    }
     if (groundToggle) {
        groundToggleListener = () => {
             window.dispatchEvent(new CustomEvent('groundToggle', { detail: { checked: groundToggle.checked } }));
        };
        groundToggle.addEventListener('change', groundToggleListener);
    }

    // При желании: Проверка работы интерфейса при запуске
    // if (typeof UI.runUITests === 'function') {
    //     console.log("Проверяем работу интерфейса...");
    //     UI.runUITests();
    // }
});

// --- Обработка данных формы и файла ---
async function handleFormSubmit(configData) {
    console.log("Форма отправлена. Обрабатываем настройки и файл...");
    UI.showLoading(true);
    UI.disableSubmitButton(true);

    let historyData = [];
    const file = FormHandler.getFile();

    if (file) {
        console.log(`Выбран файл "${file.name}". Читаем данные...`);
        try {
            const rawData = await FileProcessor.readFile(file);
            historyData = FileProcessor.processFileData(rawData);
            if (!historyData.length) {
                alert("Файл обработан, но не содержит данных о работе крана. Покажем только сам кран без движения.");
                console.warn("В файле нет данных о работе крана.");
            } else {
                console.log(`Успешно обработано ${historyData.length} записей о работе крана.`);
            }
        } catch (error) {
            console.error('Ошибка при чтении файла:', error);
            alert(`Ошибка обработки файла: ${error.message}`);
            UI.showLoading(false);
            UI.disableSubmitButton(false);
            return;
        }
    } else {
        console.log("Файл не выбран. Показываем кран без анимации.");
    }

    // --- Запуск визуализации ---
    console.log("Данные обработаны. Запускаем визуализацию...");
    UI.showVizView();
    UI.showLoading(false);

    // Запускаем визуализацию с настройками и данными о работе
    Visualization.initVisualization(configData, historyData);

    UI.disableSubmitButton(false);
}

// --- Очистка при возврате к настройкам ---
function handleBackToConfig() {
    console.log("Возвращаемся к настройкам. Очищаем сцену...");
    // Очищаем 3D сцену и останавливаем анимацию
    Visualization.cleanupVisualization();

    // Отключаем все кнопки управления видом
     if (pathsToggleListener) {
        // pathsToggle.removeEventListener('change', pathsToggleListener);
        pathsToggleListener = null;
    }
    if (zonesToggleListener) {
        // zonesToggle.removeEventListener('change', zonesToggleListener);
        zonesToggleListener = null;
    }
     if (gridToggleListener) {
        // gridToggle.removeEventListener('change', gridToggleListener);
        gridToggleListener = null;
    }
    if (axesToggleListener) {
        // axesToggle.removeEventListener('change', axesToggleListener);
        axesToggleListener = null;
    }
     if (ropesToggleListener) {
        // ropesToggle.removeEventListener('change', ropesToggleListener);
        ropesToggleListener = null;
    }
     if (groundToggleListener) {
        // groundToggle.removeEventListener('change', groundToggleListener);
        groundToggleListener = null;
    }

    // Показываем форму настроек
    UI.showConfigView();
    console.log("Очистка завершена. Вернулись к настройкам.");
}