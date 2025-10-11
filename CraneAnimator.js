import * as THREE from 'three';

// Переводим градусы в радианы (для поворота крана)
const DEG_TO_RAD = Math.PI / 180;

/**
 * Обновляет положение всех подвижных частей крана:
 * - Поворот верхней части крана (с кабиной)
 * - Перемещение грузовой тележки по стреле
 * - Подъем/опускание крюковой подвески
 * @param {THREE.Group} craneGroup - Вся модель крана целиком
 * @param {object} config - Параметры крана из паспорта
 * @param {object|null} frame - Текущие данные о положении механизмов
 */
export function updateCraneAnimation(craneGroup, config, frame) {
    if (!craneGroup || !config) return;

    // Находим основные части крана по их названиям
    const upper = craneGroup.getObjectByName('Upper Structure (Rotating)');
    if (!upper) return;
    const trolley = upper.getObjectByName('Trolley');
    const jib = upper.getObjectByName('Jib');
    const hookGroup = upper.getObjectByName('Hook Group');
    if (!trolley || !jib || !hookGroup) return;

    // Получаем длину стрелы - нужна для ограничения движения тележки
    const maxJibLen = jib.userData?.geometryParams?.width || 
                     (jib.geometry?.parameters?.width) || 
                     config.jibLength;

    // Определяем нулевой угол поворота (куда смотрит кран в начальном положении)
    // N - север (0°), E - восток (90°), S - юг (180°), W - запад (270°)
    const baseZeroDeg = {N:0,E:90,S:180,W:270}[config.zeroAngleDirection||'N']||0;
    const customZeroDeg = (config.zeroAngleDirection === "custom" && 
                          typeof config.customZeroAngle === "number" ? 
                          config.customZeroAngle : 0);

    // Текущие координаты механизмов (если нет данных, оставляем как есть)
    let trolleyRad = trolley.position.x; // Вылет тележки
    let angleDeg = 0; // Угол поворота
    let hookHeightFromBase = config.hookMaxHeight; // Высота крюка

    // Если есть новые данные о положении - обновляем
    if (frame) {
        trolleyRad = frame.radius ?? trolleyRad;
        angleDeg = frame.angle ?? angleDeg;
        hookHeightFromBase = frame.height ?? hookHeightFromBase;
    }

    // Поворачиваем верхнюю часть крана
    // Общий угол = угол из данных + поправка на начальное положение
    const totalAngleDeg = angleDeg + customZeroDeg + baseZeroDeg;
    upper.rotation.y = THREE.MathUtils.degToRad(totalAngleDeg);

    // Перемещаем тележку по стреле
    // Тележка двигается только вперед-назад по стреле
    const clampedR = Math.max(0, Math.min(trolleyRad, maxJibLen));
    trolley.position.x = clampedR;

    // Определяем высоту верха стрелы (не меняется при повороте)
    const upperBaseY = upper.position.y;
    
    // Получаем параметры стрелы
    let jibYlocal = jib.position.y;
    if (jib.geometry?.parameters?.height) {
        jibYlocal += jib.geometry.parameters.height / 2;
    } else if (jib.userData?.geometryParams?.height) {
        jibYlocal += jib.userData.geometryParams.height / 2;
    }
    
    const jibBaseY = upperBaseY + jibYlocal; // Абсолютная высота верха стрелы

    // Рассчитываем высоту крюка
    let hookYWorld;
    if (config.hookHeightReference === 'jib') {
        // Высота отсчитывается от верха стрелы
        hookYWorld = jibBaseY - Math.abs(hookHeightFromBase);
    } else {
        // Высота отсчитывается от земли
        hookYWorld = Math.min(Math.abs(hookHeightFromBase), jibBaseY - 0.5);
    }
    // Ограничиваем высоту крюка
    hookYWorld = Math.max(0.5, Math.min(hookYWorld, jibBaseY - 0.5));

    // Крюк должен висеть строго под тележкой
    const trolleyWorldPos = new THREE.Vector3();
    trolley.getWorldPosition(trolleyWorldPos);
    upper.worldToLocal(trolleyWorldPos);
    const hookYLocal = hookYWorld - upperBaseY;
    hookGroup.position.set(trolleyWorldPos.x, hookYLocal, trolleyWorldPos.z);

    // Добавляем легкое покачивание крюка (как от ветра)
    const time = Date.now() * 0.001;
    const swayAmount = 0.02; // Насколько сильно качается
    if (Math.abs(hookYLocal - trolleyWorldPos.y) > 1) {
        hookGroup.position.x += Math.sin(time * 0.5) * swayAmount;
        hookGroup.position.z += Math.cos(time * 0.7) * swayAmount;
    }

    // Возвращаем текущие координаты для отрисовки троса
    return {
        trolleyLocalPos: trolley.position.clone(),
        hookLocalPos: hookGroup.position.clone(),
        jibBaseYWorld: jibBaseY
    };
}