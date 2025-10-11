// Сервис умного анализа работы крана через websim.chat

/**
 * Анализирует историю работы крана и определяет:
 * - Где чаще всего кран берет и ставит грузы
 * - Когда и где заливали бетон
 * - Какие типы грузов перемещались
 * @param {Array<object>} history - Записи истории работы крана
 * @returns {Promise<object|null>} Результаты анализа или null если что-то пошло не так
 */
export async function runAnalytics(history) {
    // Собираем важные данные о работе крана
    const points = history.map((h,i) => ({
        index: i,                // Номер записи
        time: h.timeString,      // Время
        radius: h.radius,        // Вылет стрелы
        angle: h.angle,          // Угол поворота
        height: h.height,        // Высота крюка
        weight: h.weight,        // Вес груза
        wind: h.wind,           // Скорость ветра
        reeving: h.reeving      // Запасовка (сколько ветвей троса)
    }));

    // Ограничиваем количество точек для анализа
    const maxPoints = 1000; // Максимум точек, которые мы можем обработать
    const pointsToSend = points.slice(0, maxPoints);
    if (points.length > maxPoints) {
        console.warn(`Слишком много данных, берем только ${maxPoints} точек для анализа.`);
    }

    // Инструкция для искусственного интеллекта на русском:
    const messages = [
        {
            role: "system",
            content:
                `Ты инженер-аналитик. На вход поступает массив точек истории работы башенного крана (tower crane).
Данные (метка времени, радиус, угол, высота, вес, ветер, запасовка):
- Сгруппируй точки по частым зонам разгрузки и погрузки (где крюк останавливается, вес меняется).
- Определи часто повторяющиеся площадки (позиции x,y,z) выгрузки (unloading) и загрузки (loading).
- Для каждой зоны дай: количество операций (count), средний вес (avgWeight), координаты (position x,y,z).
- Попробуй определить грузы типа бетон (concrete): признак — крюк опускается, вес резко уменьшается, вес ведра(бадьи) почти одинаков (например, в пределах 1-3 тонн). Определяй конкретные фреймы начала и конца заливки бетона.
- Отдельно укажи массив операций типа "заливка бетона", с координатами (начало/среднее), временем начала (startTime) и временем конца (endTime).
- В cargoTypes определи по кадрам (frameIdx): type="concrete"/тип_другого_груза/null. Используй признаки: вес резко падает/бак типовая масса, характерные движения.
Ответ строго в JSON, без лишнего текста:
{
    loadingZones: [{position:{x:number,y:number,z:number},count:number,avgWeight:number}],
    unloadingZones: [{position:{x:number,y:number,z:number},count:number,avgWeight:number}],
    cargoTypes: [{frameIdx:number,type:string|null}],
    concreteOperations: [{startTime:string,endTime:string,position:{x:number,y:number,z:number},avgWeight:number}]
}
Все координаты вычисляются исходя из radius, angle, height. Расчёт: x = radius*cos(angle_rad), y = height, z = radius*sin(angle_rad)`
        },
        { role: "user", content: JSON.stringify(pointsToSend) }
    ];

    try {
        // Отправляем данные на анализ
        const completion = await websim.chat.completions.create({
            messages,
            json: true
        });

        // Проверяем что пришел правильный ответ
        const result = typeof completion.content === "string" ? 
            JSON.parse(completion.content) : completion.content;

        // Проверяем что все данные на месте
        if (result && typeof result === 'object') {
            // Создаем пустые списки, если их нет
            result.loadingZones = Array.isArray(result.loadingZones) ? 
                result.loadingZones : [];  // Зоны погрузки
            result.unloadingZones = Array.isArray(result.unloadingZones) ? 
                result.unloadingZones : []; // Зоны разгрузки
            result.cargoTypes = Array.isArray(result.cargoTypes) ? 
                result.cargoTypes : [];     // Типы грузов
            result.concreteOperations = Array.isArray(result.concreteOperations) ? 
                result.concreteOperations : []; // Операции с бетоном

            // Сортируем зоны по количеству операций
            result.loadingZones.sort((a, b) => b.count - a.count);
            result.unloadingZones.sort((a, b) => b.count - a.count);

            return result;
        } else {
            console.error("Анализ вернул неправильные данные:", result);
            return null;
        }
    } catch (e) {
        console.warn("Ошибка при анализе:", e);
        // Возвращаем пустые списки если что-то пошло не так
        return {
             loadingZones: [],      // Зоны погрузки
             unloadingZones: [],    // Зоны разгрузки
             cargoTypes: [],        // Типы грузов
             concreteOperations: [] // Операции с бетоном
        };
    }
}
