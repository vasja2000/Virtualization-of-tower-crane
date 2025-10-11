import * as UI from './ui.js';

// Объявляем переменные для работы с формой
let fileInput;                    // Поле для загрузки файла с данными
let wallTieCountInput;           // Поле для ввода количества креплений к стене
let wallTieHeightsContainer;     // Контейнер для полей ввода высот креплений
let isWallTiedCheckbox;         // Галочка "Есть крепления к стене"
let wallTieSideSelect;          // Выбор стороны крепления (С, Ю, З, В)
let form;                       // Сама форма
let onSubmitCallback;           // Что делать после заполнения формы
let wallTiesSection;           // Раздел с креплениями к стене
let zeroAngleDirectionSelect;  // Выбор начального направления стрелы
let customZeroAngleInput;      // Поле для ввода своего угла поворота

/**
 * Запускаем форму и настраиваем все элементы управления
 * @param {Function} submitCallback - Что делать после заполнения формы
 */
export function init(submitCallback) {
    onSubmitCallback = submitCallback;
    form = UI.getFormElement();
    isWallTiedCheckbox = UI.getIsWallTiedCheckbox();
    wallTiesSection = UI.getWallTiesSection();
    wallTieCountInput = document.getElementById('wallTieCount');
    wallTieHeightsContainer = document.getElementById('wall-tie-heights');
    wallTieSideSelect = document.getElementById('wallTieSide');
    fileInput = document.getElementById('historyFile');
    zeroAngleDirectionSelect = document.getElementById('zeroAngleDirection');
    customZeroAngleInput = document.getElementById('customZeroAngle');

    if (!form || !isWallTiedCheckbox || !wallTiesSection || !wallTieCountInput || !wallTieHeightsContainer || !fileInput) {
        console.error("Form Handler Init Error: One or more form elements not found!");
        return;
    }

    isWallTiedCheckbox.addEventListener('change', toggleWallTiesSection);
    wallTieCountInput.addEventListener('input', handleWallTieCountChange);
    form.addEventListener('submit', handleFormSubmit);

    if (zeroAngleDirectionSelect) {
        zeroAngleDirectionSelect.addEventListener('change', function() {
            if (zeroAngleDirectionSelect.value === "custom") {
                customZeroAngleInput.style.display = "";
                customZeroAngleInput.required = true;
            } else {
                customZeroAngleInput.style.display = "none";
                customZeroAngleInput.required = false;
                customZeroAngleInput.value = "";
            }
        });
    }
}

/**
 * Первоначальная настройка формы (прячем ненужные поля)
 */
export function initialSetup() {
    toggleWallTiesSection();
}

/**
 * Обрабатываем отправку формы:
 * - Собираем все данные
 * - Проверяем правильность заполнения
 * - Считаем количество и высоты креплений
 * - Отправляем данные дальше для создания модели крана
 */
function handleFormSubmit(event) {
    event.preventDefault();
    if (!onSubmitCallback) return;

    const formData = new FormData(form);
    const configData = {};
    const wallTieHeights = [];
    const isChecked = isWallTiedCheckbox.checked;

    formData.forEach((value, key) => {
        if (key.startsWith('wallTieHeight')) {
            if (isChecked) {
                wallTieHeights.push(parseFloat(value));
            }
        } else if (key === 'isWallTied') {
            configData[key] = value === 'on';
        } else if (key === 'wallTieCount' && !isChecked) {
            // Skip if not checked
        } else if (key === 'wallTieSide') {
            configData[key] = value;
        } else if (key === 'customZeroAngle') {
            configData[key] = value ? parseFloat(value) : undefined;
        } else {
            const numericValue = parseFloat(value);
            const intValue = parseInt(value, 10);
            if (!isNaN(numericValue) && String(numericValue) === String(value).trim()) {
                configData[key] = numericValue;
            } else if (!isNaN(intValue) && String(intValue) === String(value).trim() && !value.includes('.')) {
                configData[key] = intValue;
            } else {
                configData[key] = value;
            }
        }
    });

    if (isChecked) {
        configData['wallTieHeights'] = wallTieHeights.sort((a, b) => a - b);
        configData['wallTieCount'] = wallTieHeights.length;
    } else {
        configData['wallTieHeights'] = [];
        configData['wallTieCount'] = 0;
        delete configData['wallTieCount'];
    }

    Object.keys(configData).forEach(key => {
        if (key.startsWith('wallTieHeight')) {
            delete configData[key];
        }
    });

    if (
        configData.zeroAngleDirection === "custom" &&
        (typeof configData.customZeroAngle === 'undefined' || isNaN(configData.customZeroAngle))
    ) {
        alert('Пожалуйста, введите пользовательский угол для направления 0°');
        customZeroAngleInput.focus();
        return;
    }

    onSubmitCallback(configData);
}

/**
 * Обновляем поля для ввода высот при изменении количества креплений
 */
function handleWallTieCountChange() {
    const count = parseInt(wallTieCountInput.value, 10);
    const min = parseInt(wallTieCountInput.min, 10);
    const max = parseInt(wallTieCountInput.max, 10);

    if (!isNaN(count) && count >= min && count <= max) {
        generateWallTieInputs(count);
    } else {
        clearWallTieInputs();
    }
}

/**
 * Показываем или прячем раздел с креплениями к стене
 */
function toggleWallTiesSection() {
    const isChecked = isWallTiedCheckbox.checked;
    wallTiesSection.classList.toggle('hidden', !isChecked);
    wallTieCountInput.required = isChecked;

    if (isChecked) {
        let count = parseInt(wallTieCountInput.value, 10);
        const min = parseInt(wallTieCountInput.min, 10);
        const max = parseInt(wallTieCountInput.max, 10);
        if (isNaN(count) || count < min) {
            count = min;
            wallTieCountInput.value = count;
        } else if (count > max) {
            count = max;
            wallTieCountInput.value = count;
        }
        generateWallTieInputs(count);
    } else {
        clearWallTieInputs();
    }
}

/**
 * Создаём поля для ввода высот креплений
 * @param {number} count - Сколько креплений нужно
 */
function generateWallTieInputs(count) {
    clearWallTieInputs();
    for (let i = 1; i <= count; i++) {
        const div = document.createElement('div');
        const label = document.createElement('label');
        label.setAttribute('for', `wallTieHeight${i}`);
        label.textContent = `Крепление #${i} (м):`;
        const input = document.createElement('input');
        input.setAttribute('type', 'number');
        input.setAttribute('id', `wallTieHeight${i}`);
        input.setAttribute('name', `wallTieHeight${i}`);
        input.setAttribute('min', '15');
        input.setAttribute('max', '300');
        input.setAttribute('step', '0.1');
        input.required = true;
        div.appendChild(label);
        div.appendChild(input);
        wallTieHeightsContainer.appendChild(div);
    }
}

/**
 * Удаляем все поля для ввода высот креплений
 */
function clearWallTieInputs() {
    const dynamicInputs = wallTieHeightsContainer.querySelectorAll('div');
    dynamicInputs.forEach(div => wallTieHeightsContainer.removeChild(div));
}

/**
 * Получаем загруженный файл с данными о работе крана
 * @returns {File|null} Файл с данными или null если файл не выбран
 */
export function getFile() {
    return fileInput.files.length > 0 ? fileInput.files[0] : null;
}