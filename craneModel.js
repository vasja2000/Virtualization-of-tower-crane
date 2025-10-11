import * as THREE from 'three';
import materials, { disposeMaterials } from './craneMaterials.js';
import {
    createLatticeStructure,
    createOperatorCab,
    createTrolley,
    createHook,
    createWallTie
} from './craneComponents.js';

// Re-export disposeMaterials for backward compatibility
export { disposeMaterials };

/**
 * Возвращает угол поворота в радианах для выбранного направления 0°
 */
function getZeroAngle(config) {
    if (config.zeroAngleDirection === "custom" && typeof config.customZeroAngle === 'number') {
        // пользовательский угол
        return (config.customZeroAngle % 360) * Math.PI/180;
    }
    // стандартные направления
    const mapping = {
        N: 0,     // север +X
        E: 90,    // восток +Z
        S: 180,   // юг -X
        W: 270,   // запад -Z
    }
    let angle = mapping[config.zeroAngleDirection || "N"] ?? 0;
    return angle * Math.PI/180;
}

/**
 * Builds the 3D model of the tower crane based on configuration data.
 * @param {object} config - The crane configuration object.
 * @returns {THREE.Group} A THREE.Group containing the complete crane model.
 */
export function buildCraneModel(config) {
    const craneGroup = new THREE.Group();
    craneGroup.name = "Crane Root";

    // --- Mast ---
    const mastSize = config.mastSectionSize;
    const mastHeight = config.mastHeight;
    
    // Create lattice structure for the mast instead of a solid box
    const mastStructure = createLatticeStructure(mastSize, mastHeight, mastSize, materials.mastLattice);
    mastStructure.name = "Mast";
    craneGroup.add(mastStructure);

    // --- Rotating Upper Structure ---
    const upperStructureGroup = new THREE.Group();
    upperStructureGroup.position.y = mastHeight + config.mastTopToSlewHeight;
    upperStructureGroup.name = "Upper Structure (Rotating)";
    craneGroup.add(upperStructureGroup);

    // --- Slew Ring ---
    const slewHeight = 0.5; 
    const slewRadius = mastSize * 0.8; 
    const slewGeometry = new THREE.CylinderGeometry(slewRadius, slewRadius, slewHeight, 32);
    const slewMesh = new THREE.Mesh(slewGeometry, materials.slew);
    slewMesh.position.y = -config.mastTopToSlewHeight + slewHeight / 2;
    slewMesh.castShadow = true;
    slewMesh.name = "Slew Ring";
    upperStructureGroup.add(slewMesh);

    // --- Upper Cab/Platform ---
    const upperCabHeight = config.slewToUpperHeight;
    const upperCabWidth = mastSize * 1.2; 
    const upperCabDepth = mastSize * 1.5;
    
    // Main platform
    const upperCabGeometry = new THREE.BoxGeometry(upperCabWidth, upperCabHeight * 0.2, upperCabDepth);
    const upperCabMesh = new THREE.Mesh(upperCabGeometry, materials.slew);
    upperCabMesh.position.y = upperCabHeight * 0.1;
    upperCabMesh.position.z = -upperCabDepth / 4;
    upperCabMesh.castShadow = true;
    upperCabMesh.name = "Upper Platform";
    upperStructureGroup.add(upperCabMesh);
    
    // Add operator cab
    const operatorCab = createOperatorCab(upperCabWidth * 0.8, upperCabHeight * 0.8, upperCabDepth * 0.6);
    operatorCab.position.set(0, upperCabHeight * 0.2 + upperCabHeight * 0.4, -upperCabDepth * 0.4);
    operatorCab.name = "Operator Cab";
    upperStructureGroup.add(operatorCab);

    // --- Jib ---
    const jibLength = config.jibLength;
    const jibHeight = mastSize * 0.7;
    const jibDepth = mastSize * 0.7;
    
    // Create main jib structure
    const jibBase = new THREE.BoxGeometry(2, jibHeight, jibDepth);
    const jibBaseMesh = new THREE.Mesh(jibBase, materials.jib);
    jibBaseMesh.position.set(1, upperCabHeight * 0.8, 0);
    jibBaseMesh.castShadow = true;
    upperStructureGroup.add(jibBaseMesh);
    
    // Create lattice jib extending from the base
    const jibLattice = createLatticeStructure(jibLength - 2, jibHeight * 0.8, jibDepth * 0.8, materials.jib);
    jibLattice.position.set(jibLength/2 + 0.5, upperCabHeight * 0.8, 0);
    jibLattice.name = "Jib Lattice";
    upperStructureGroup.add(jibLattice);
    
    // Create a composite jib object for reference in other functions
    const compositeJib = new THREE.Group();
    compositeJib.name = "Jib";
    compositeJib.position.set(jibLength / 2, upperCabHeight * 0.8, 0);
    compositeJib.userData = { 
        geometryParams: { width: jibLength, height: jibHeight, depth: jibDepth }
    };
    compositeJib.geometry = { parameters: { width: jibLength, height: jibHeight, depth: jibDepth } };
    upperStructureGroup.add(compositeJib);

    // --- Counter Jib ---
    const counterJibLength = config.counterJibLength;
    const counterJibHeight = jibHeight * 1.1;
    const counterJibDepth = jibDepth * 1.1;
    
    // Create counter jib lattice structure
    const counterJibLattice = createLatticeStructure(counterJibLength, counterJibHeight * 0.8, counterJibDepth * 0.8, materials.counterJib);
    counterJibLattice.position.set(-counterJibLength / 2, jibBaseMesh.position.y, 0);
    counterJibLattice.name = "Counter Jib Lattice";
    upperStructureGroup.add(counterJibLattice);
    
    // Create a composite counter jib object for reference
    const compositeCounterJib = new THREE.Group();
    compositeCounterJib.name = "Counter Jib";
    compositeCounterJib.position.set(-counterJibLength / 2, jibBaseMesh.position.y, 0);
    compositeCounterJib.userData = { 
        geometryParams: { width: counterJibLength, height: counterJibHeight, depth: counterJibDepth }
    };
    compositeCounterJib.geometry = { parameters: { width: counterJibLength, height: counterJibHeight, depth: counterJibDepth } };
    upperStructureGroup.add(compositeCounterJib);

    // --- Counterweight ---
    const cwWidth = counterJibDepth * 1.5;
    const cwHeight = counterJibHeight * 1.2;
    const cwLength = Math.min(counterJibLength * 0.4, 5);
    
    // Create a stack of counterweight plates
    const counterweightGroup = new THREE.Group();
    counterweightGroup.name = "Counterweight";
    
    const plateCount = 5;
    const plateHeight = cwHeight / plateCount;
    
    for (let i = 0; i < plateCount; i++) {
        const plateGeom = new THREE.BoxGeometry(cwLength * (0.8 + i * 0.04), plateHeight * 0.9, cwWidth * (0.8 + i * 0.04));
        const plateMesh = new THREE.Mesh(plateGeom, materials.counterweight);
        plateMesh.position.y = i * plateHeight - cwHeight/2 + plateHeight/2;
        plateMesh.castShadow = true;
        counterweightGroup.add(plateMesh);
    }
    
    counterweightGroup.position.set(-counterJibLength + cwLength / 2, counterJibLattice.position.y + cwHeight/2, 0);
    upperStructureGroup.add(counterweightGroup);

    // --- Trolley ---
    const trolleyGroup = createTrolley(mastSize);
    
    // Set initial trolley position
    const initialRadius = 10;
    const trolleyStartX = Math.max(initialRadius, mastSize / 2 + upperCabWidth / 2);
    trolleyGroup.position.set(trolleyStartX, jibLattice.position.y + jibHeight * 0.5, 0);
    upperStructureGroup.add(trolleyGroup);

    // --- Hook ---
    const hookGroup = createHook(mastSize * 0.6, mastSize * 0.25, mastSize * 0.5);

    // Определяем угол поворота крана ЗДЕСЬ
    const zeroAngle = getZeroAngle(config); // угол в радианах (от -X)
    // поворот всей верхней части на этот угол
    upperStructureGroup.rotation.y = zeroAngle;

    // Верное расположение крюка: всегда под стрелой (ниже, не выше!)
    // Крюк при инициализации стартует от радиуса trolleyGroup.position.x до земли (ниже стрелы)
    // Максимально допустимая высота крюка = позиция стрелы - 0.5 (снизу)
    // Начальная высота крюка зависит от конфигурации, но не выше стрелы и не ниже уровня 0.5

    // Coordinates for the jib in world system
    const upperY = upperStructureGroup.position.y;
    const jibY = jibLattice.position.y;
    const trolleyY = trolleyGroup.position.y;

    let initialHookY = upperY + trolleyY - mastSize * 0.25 / 2;
    let jibAbsY = upperY + jibLattice.position.y + jibHeight * 0.5;

    // Клиентская формула (важно: крюк висит СНИЗУ стрелы, а не поверх!)
    if (config.hookHeightReference === 'jib') {
        // Если отсчёт от стрелы, то глубина крюка = высота стрелы (abs Y) - config.hookMaxHeight
        initialHookY = jibAbsY - Math.abs(config.hookMaxHeight);
    } else {
        // Иначе отсчёт от нуля (земли), но всё равно не выше стрелы
        initialHookY = Math.min(Math.abs(config.hookMaxHeight), jibAbsY - 0.5);
    }

    // clamp вниз не ниже 0.5, не выше стрелы
    initialHookY = Math.max(0.5, Math.min(initialHookY, jibAbsY - 0.5));

    // FIXED: Hook position should be directly below trolley
    const trolleyWorldPos = new THREE.Vector3();
    trolleyGroup.getWorldPosition(trolleyWorldPos);
    upperStructureGroup.worldToLocal(trolleyWorldPos);
    
    // Set hook X,Z to be same as trolley (directly below)
    hookGroup.position.set(trolleyWorldPos.x, initialHookY, trolleyWorldPos.z);
    upperStructureGroup.add(hookGroup);

    // --- Wall Ties (if configured) ---
    if (config.isWallTied && config.wallTieHeights && config.wallTieHeights.length > 0) {
        // Use the selected tie side or default to East
        const tieSide = config.wallTieSide || 'E';
        
        config.wallTieHeights.forEach((tieHeight, index) => {
            if (tieHeight > 0 && tieHeight <= mastHeight) {
                const tieGroup = createWallTie(mastSize, tieHeight, tieSide);
                tieGroup.name = `Wall Tie ${index + 1}`;
                craneGroup.add(tieGroup);
            } else {
                console.warn(`Wall tie height ${tieHeight} at index ${index} is outside valid mast range [0 - ${mastHeight}] and will not be visualized.`);
            }
        });
    }

    console.log("Enhanced crane model built:", craneGroup);
    return craneGroup;
}