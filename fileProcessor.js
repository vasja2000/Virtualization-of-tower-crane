import * as XLSX from 'xlsx';

/**
 * Читает файл Excel или CSV с данными о работе крана.
 * @param {File} file - Файл с данными (например, журнал работы крана)
 * @returns {Promise<Array<Array<any>>>} Обещание вернуть прочитанные данные
 */
export function readFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = event.target.result;
                // Включаем правильное чтение дат из Excel
                // Ускоряем работу с большими файлами
                const workbook = XLSX.read(data, { type: 'array', cellDates: true, dense: true });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                // Берём данные как таблицу, форматируем даты
                // Пропускаем пустые строки
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
                    header: 1, 
                    raw: false, 
                    dateNF: 'yyyy-mm-dd hh:mm:ss', 
                    blankrows: false 
                });
                resolve(jsonData);
            } catch (err) {
                reject(new Error(`Ошибка при чтении файла: ${err.message}`));
            }
        };
        reader.onerror = (event) => {
            reject(new Error(`Ошибка чтения файла: ${event.target.error}`));
        };
        reader.readAsArrayBuffer(file);
    });
}

/**
 * Обрабатывает данные из таблицы и готовит их для показа работы крана.
 * Проверяет наличие всех важных параметров:
 * - время работы
 * - вылет стрелы (в метрах)
 * - высота подъема (в метрах)
 * - угол поворота (в градусах)
 * - вес груза (в тоннах)
 * - скорость ветра (м/с)
 * - кратность запасовки троса
 * @param {Array<Array<any>>} data - Данные из таблицы Excel
 * @returns {Array<object>} Список записей для анимации крана
 */
export function processFileData(data) {
    if (!data || data.length < 2) {
        console.warn("File is empty or contains only a header row.");
        return [];
    }

    const header = data[0].map(h => String(h || '').trim().toLowerCase()); // Handle potential null/undefined headers
    const colIndices = {
        time: header.indexOf("время"),
        torque: header.indexOf("крутящий момент (%)"),
        weight: header.indexOf("вес (т)"),
        radius: header.indexOf("амплитуда (м)"),
        height: header.indexOf("высота (м)"),
        angle: header.indexOf("поворот (°)"),
        wind: header.indexOf("скорость ветра"),
        reeving: header.indexOf("запасовка (кр.)")
    };

    // Define essential columns needed for basic animation/visualization
    const essentialCols = ["время", "амплитуда (м)", "высота (м)", "поворот (°)"];
    // Check if all essential columns exist by finding their indices
    const missingEssentialCols = essentialCols.filter(colName => header.indexOf(colName) === -1);


    if (missingEssentialCols.length > 0) {
        const errorMsg = `Missing essential columns in file: ${missingEssentialCols.join(', ')}. Required: ${essentialCols.join(', ')}`;
        console.error(errorMsg);
        throw new Error(errorMsg);
    }

    const records = [];
    let firstTimestampMillis = null; // To calculate relative time

    for (let i = 1; i < data.length; i++) {
        const row = data[i];
        // Skip row if it's completely empty or doesn't have enough cells for essential data
        const maxIndex = Math.max(colIndices.time, colIndices.radius, colIndices.height, colIndices.angle);
        if (!row || row.every(cell => cell === null || cell === '' || typeof cell === 'undefined') || row.length <= maxIndex) {
           // console.warn(`Skipping empty or incomplete row ${i + 1}`);
            continue;
        }
         // Pad short rows with nulls to avoid index errors
        while(row.length < header.length) {
            row.push(null);
        }


        const record = {};
        let recordTimestampMillis = null;
        try {
            // --- Time Parsing ---
            const timeVal = row[colIndices.time];
            let parsedDate = null;

            if (timeVal instanceof Date && !isNaN(timeVal)) {
                parsedDate = timeVal;
            } else if (typeof timeVal === 'string' || typeof timeVal === 'number') {
                 if (typeof timeVal === 'number' && timeVal > 1) {
                    // Handle Excel date numbers
                    const dateInfo = XLSX.SSF.parse_date_code(timeVal);
                    if (dateInfo) {
                         parsedDate = new Date(Date.UTC(dateInfo.y, dateInfo.m - 1, dateInfo.d, dateInfo.H, dateInfo.M, dateInfo.S)); // Use UTC to avoid timezone shifts
                    }
                 }
                 if (!parsedDate && typeof timeVal === 'string') {
                     // Attempt to parse various string formats, including ISO
                     // Replace potential Russian date parts if needed before parsing
                     const cleanedDateString = String(timeVal).replace(' ', 'T') + 'Z'; // Assume UTC if no timezone specified
                     parsedDate = new Date(cleanedDateString);
                     if (isNaN(parsedDate)) {
                        // Fallback for simpler formats if ISO parsing failed
                        parsedDate = new Date(timeVal);
                     }
                 } else if (!parsedDate && typeof timeVal === 'number') {
                    // Fallback for non-excel number dates? Unlikely needed.
                    parsedDate = new Date(timeVal);
                 }
            }

            if (parsedDate && !isNaN(parsedDate)) {
                record.timeString = parsedDate.toISOString(); // Store ISO string for display
                recordTimestampMillis = parsedDate.getTime();
                record.timeMillis = recordTimestampMillis;
                if (firstTimestampMillis === null) {
                    firstTimestampMillis = recordTimestampMillis;
                }
                record.relativeTimeMillis = recordTimestampMillis - firstTimestampMillis; // Time since first record
            } else {
                record.timeString = String(timeVal); // Store original if invalid
                record.timeMillis = null;
                record.relativeTimeMillis = null;
            }


            // --- Numeric Parsing Utilities ---
            const safeParseFloat = (val) => {
                if (val === null || typeof val === 'undefined' || String(val).trim() === '') return null;
                const strVal = String(val).replace(',', '.').trim();
                if (strVal === '') return null;
                const num = parseFloat(strVal);
                return isNaN(num) ? null : num;
            };
            const safeParseInt = (val) => {
                if (val === null || typeof val === 'undefined' || String(val).trim() === '') return null;
                 const strVal = String(val).trim();
                if (strVal === '') return null;
                const num = parseInt(strVal, 10);
                return isNaN(num) ? null : num;
            };

            // --- Assigning Values ---
            record.torque = colIndices.torque !== -1 ? safeParseFloat(row[colIndices.torque]) : null;
            record.weight = colIndices.weight !== -1 ? safeParseFloat(row[colIndices.weight]) : null;
            record.wind = colIndices.wind !== -1 ? safeParseFloat(row[colIndices.wind]) : null;
            record.reeving = colIndices.reeving !== -1 ? safeParseInt(row[colIndices.reeving]) : null;
            record.radius = safeParseFloat(row[colIndices.radius]);
            record.height = safeParseFloat(row[colIndices.height]);
            record.angle = safeParseFloat(row[colIndices.angle]);

            // --- Validation of Essential Fields ---
             // Time validation now checks timeMillis
            if (record.timeMillis === null || record.radius === null || record.height === null || record.angle === null) {
                console.warn(`Skipping row ${i + 1} due to missing or invalid essential data (Time, Radius, Height, Angle). Parsed record:`, record, 'Original row:', row);
                continue; // Skip this record
            }

            records.push(record);

        } catch (e) {
            console.error(`Error processing row ${i + 1}:`, row, e);
            continue; // Skip row on error
        }
    } // End of loop

    // Ensure records are sorted by time, as file order isn't guaranteed
    records.sort((a, b) => a.timeMillis - b.timeMillis);

    // Recalculate relativeTimeMillis after sorting if necessary
    if (records.length > 0) {
        firstTimestampMillis = records[0].timeMillis;
        records.forEach(rec => {
            rec.relativeTimeMillis = rec.timeMillis - firstTimestampMillis;
        });
    }


    console.log(`Processed and sorted ${records.length} valid records.`);
    return records;
}