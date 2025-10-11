import * as THREE from 'three';
import materials from './craneMaterials.js';

/**
 * Creates a detailed lattice structure for the mast or jib
 * @param {number} width - Width of the lattice structure
 * @param {number} height - Height of the lattice structure
 * @param {number} depth - Depth of the lattice structure
 * @param {THREE.Material} material - Material to use
 * @returns {THREE.Group} Group containing the lattice structure
 */
export function createLatticeStructure(width, height, depth, material) {
    const latticeGroup = new THREE.Group();
    
    // Создаем геометрию только один раз для каждого типа элемента
    const cornerRadius = Math.min(width, depth) * 0.05;
    const crossBeamRadius = cornerRadius * 0.8;
    
    // Создаем базовые геометрии
    const verticalGeom = new THREE.CylinderGeometry(cornerRadius, cornerRadius, height, 8);
    const horizontalGeomX = new THREE.CylinderGeometry(crossBeamRadius, crossBeamRadius, width/2, 8);
    const horizontalGeomZ = new THREE.CylinderGeometry(crossBeamRadius, crossBeamRadius, depth/2, 8);
    
    // Поворачиваем геометрии сразу
    horizontalGeomX.rotateZ(Math.PI / 2);
    horizontalGeomZ.rotateX(Math.PI / 2);
    
    // Создаем вертикальные стойки
    [-1, 1].forEach(xDir => {
        [-1, 1].forEach(zDir => {
            const cornerBeam = new THREE.Mesh(verticalGeom, material);
            cornerBeam.position.set((width/2) * xDir, height/2, (depth/2) * zDir);
            latticeGroup.add(cornerBeam);
        });
    });
    
    // Создаем горизонтальные перекладины (только от угла до центра)
    const sections = Math.max(2, Math.floor(height / (width * 2)));
    for(let i = 0; i <= sections; i++) {
        const yPos = (i / sections) * height;
        
        // X-направление (от угла до центра)
        [-1, 1].forEach(xDir => {
            [-1, 1].forEach(zDir => {
                const beam = new THREE.Mesh(horizontalGeomX, material);
                beam.position.set(xDir * width/4, yPos, zDir * depth/2);
                latticeGroup.add(beam);
            });
        });
        
        // Z-направление (от угла до центра)
        [-1, 1].forEach(xDir => {
            [-1, 1].forEach(zDir => {
                const beam = new THREE.Mesh(horizontalGeomZ, material);
                beam.position.set(xDir * width/2, yPos, zDir * depth/4);
                latticeGroup.add(beam);
            });
        });
    }
    
    return latticeGroup;
}

/**
 * Creates a detailed operator cab with windows
 * @param {number} width - Width of the cab
 * @param {number} height - Height of the cab
 * @param {number} depth - Depth of the cab
 * @returns {THREE.Group} Group containing the cab
 */
export function createOperatorCab(width, height, depth) {
    const cabGroup = new THREE.Group();
    
    // Create cab body
    const bodyGeom = new THREE.BoxGeometry(width, height, depth);
    const cabBody = new THREE.Mesh(bodyGeom, materials.cabinExterior);
    cabBody.castShadow = true;
    cabGroup.add(cabBody);
    
    // Window dimensions
    const windowThickness = 0.02;
    const windowWidth = width * 0.8;
    const windowHeight = height * 0.4;
    const windowDepth = depth * 0.8;
    
    // Front window (larger)
    const frontWindowGeom = new THREE.BoxGeometry(windowWidth, windowHeight, windowThickness);
    const frontWindow = new THREE.Mesh(frontWindowGeom, materials.cabinGlass);
    frontWindow.position.set(0, height * 0.15, depth/2 + windowThickness/2);
    cabGroup.add(frontWindow);
    
    // Side windows
    const sideWindowGeom = new THREE.BoxGeometry(windowThickness, windowHeight, windowDepth);
    
    const leftWindow = new THREE.Mesh(sideWindowGeom, materials.cabinGlass);
    leftWindow.position.set(-width/2 - windowThickness/2, height * 0.15, 0);
    cabGroup.add(leftWindow);
    
    const rightWindow = new THREE.Mesh(sideWindowGeom, materials.cabinGlass);
    rightWindow.position.set(width/2 + windowThickness/2, height * 0.15, 0);
    cabGroup.add(rightWindow);
    
    // Add a camera inside the cab (for future camera integration)
    const cabCameraGroup = new THREE.Group();
    cabCameraGroup.name = "CabCamera";
    
    const cameraBodyGeom = new THREE.BoxGeometry(0.15, 0.15, 0.2);
    const cameraBody = new THREE.Mesh(cameraBodyGeom, materials.camera);
    
    const cameraLensGeom = new THREE.CylinderGeometry(0.05, 0.05, 0.05, 16);
    cameraLensGeom.rotateX(Math.PI / 2);
    const cameraLens = new THREE.Mesh(cameraLensGeom, materials.cameraLens);
    cameraLens.position.z = 0.125;
    
    cabCameraGroup.add(cameraBody);
    cabCameraGroup.add(cameraLens);
    cabCameraGroup.position.set(-width * 0.3, height * 0.15, depth * 0.4);
    cabCameraGroup.rotation.y = Math.PI / 4; // Angle toward operator
    
    cabGroup.add(cabCameraGroup);
    
    return cabGroup;
}

/**
 * Creates a camera mount with camera
 * @param {string} name - Name for the camera
 * @returns {THREE.Group} Group containing the camera
 */
export function createCameraMount(name) {
    const cameraGroup = new THREE.Group();
    cameraGroup.name = name;
    
    // Mount
    const mountGeom = new THREE.CylinderGeometry(0.08, 0.1, 0.15, 8);
    const mount = new THREE.Mesh(mountGeom, materials.camera);
    
    // Camera body
    const bodyGeom = new THREE.BoxGeometry(0.15, 0.12, 0.25);
    const body = new THREE.Mesh(bodyGeom, materials.camera);
    body.position.y = 0.12;
    
    // Camera lens
    const lensGeom = new THREE.CylinderGeometry(0.06, 0.04, 0.12, 16);
    lensGeom.rotateX(Math.PI / 2);
    const lens = new THREE.Mesh(lensGeom, materials.cameraLens);
    lens.position.set(0, 0.12, 0.18);
    
    cameraGroup.add(mount);
    cameraGroup.add(body);
    cameraGroup.add(lens);
    
    return cameraGroup;
}

/**
 * Creates the trolley with hoist mechanism and cameras
 * @param {number} mastSize - Size of the mast for scaling trolley components
 * @returns {THREE.Group} Complete trolley group
 */
export function createTrolley(mastSize) {
    const trolleySize = mastSize * 0.5;
    const trolleyHeight = mastSize * 0.25;
    const trolleyWidth = mastSize * 0.6;
    
    const trolleyGroup = new THREE.Group();
    trolleyGroup.name = "Trolley";
    
    // Trolley base
    const trolleyBaseGeom = new THREE.BoxGeometry(trolleyWidth, trolleyHeight, trolleySize);
    const trolleyBase = new THREE.Mesh(trolleyBaseGeom, materials.trolley);
    trolleyBase.castShadow = true;
    trolleyGroup.add(trolleyBase);
    
    // Trolley wheels (4 corners)
    const wheelRadius = trolleyHeight * 0.6;
    const wheelThickness = trolleySize * 0.2;
    
    [-1, 1].forEach(xSide => {
        [-1, 1].forEach(zSide => {
            const wheelGeom = new THREE.CylinderGeometry(wheelRadius, wheelRadius, wheelThickness, 16);
            wheelGeom.rotateZ(Math.PI / 2);
            const wheel = new THREE.Mesh(wheelGeom, materials.slew);
            wheel.position.set(xSide * (trolleyWidth/2 - wheelRadius), -trolleyHeight/2, zSide * (trolleySize/2 - wheelRadius));
            trolleyGroup.add(wheel);
        });
    });
    
    // Hoist mechanism
    const hoistWidth = trolleyWidth * 0.7;
    const hoistHeight = trolleyHeight * 0.8;
    const hoistDepth = trolleySize * 0.7;
    
    const hoistGeom = new THREE.BoxGeometry(hoistWidth, hoistHeight, hoistDepth);
    const hoist = new THREE.Mesh(hoistGeom, materials.slew);
    hoist.position.y = trolleyHeight * 0.5;
    trolleyGroup.add(hoist);
    
    // Drum for cable
    const drumRadius = hoistHeight * 0.3;
    const drumLength = hoistWidth * 0.6;
    const drumGeom = new THREE.CylinderGeometry(drumRadius, drumRadius, drumLength, 16);
    drumGeom.rotateZ(Math.PI / 2);
    const drum = new THREE.Mesh(drumGeom, materials.slew);
    drum.position.y = trolleyHeight * 0.5 + hoistHeight * 0.5;
    trolleyGroup.add(drum);
    
    // Add camera for monitoring the load
    const trolleyCamera = createCameraMount("TrolleyCamera");
    trolleyCamera.position.set(0, -trolleyHeight * 0.3, 0);
    trolleyCamera.rotation.x = Math.PI / 2; // Point downward
    trolleyGroup.add(trolleyCamera);
    
    // Add camera for monitoring the hoist
    const hoistCamera = createCameraMount("HoistCamera");
    hoistCamera.position.set(trolleyWidth * 0.3, trolleyHeight, -trolleySize * 0.3);
    hoistCamera.rotation.y = Math.PI / 4; // Angle toward the hoist
    hoistCamera.rotation.x = Math.PI / 6; // Tilt down slightly
    trolleyGroup.add(hoistCamera);
    
    return trolleyGroup;
}

/**
 * Creates the hook group with block and camera
 * @param {number} trolleyWidth - Reference width for scaling hook components
 * @param {number} trolleyHeight - Reference height for scaling hook components
 * @param {number} trolleySize - Reference size for scaling hook components
 * @returns {THREE.Group} Complete hook group
 */
export function createHook(trolleyWidth, trolleyHeight, trolleySize) {
    const hookGroup = new THREE.Group();
    hookGroup.name = "Hook Group";
    
    // Hook block
    const hookBlockWidth = trolleyWidth * 0.6;
    const hookBlockHeight = trolleyHeight * 1.5;
    const hookBlockDepth = trolleySize * 0.6;
    
    const hookBlockGeom = new THREE.BoxGeometry(hookBlockWidth, hookBlockHeight, hookBlockDepth);
    const hookBlock = new THREE.Mesh(hookBlockGeom, materials.slew);
    hookBlock.castShadow = true;
    hookGroup.add(hookBlock);
    
    // Hook itself
    const hookCurveRadius = hookBlockWidth * 0.35;
    const hookThickness = hookBlockWidth * 0.15;
    
    const hookShape = new THREE.Shape();
    hookShape.moveTo(0, 0);
    hookShape.lineTo(0, -hookBlockHeight * 0.3);
    hookShape.bezierCurveTo(
        -hookCurveRadius, -hookBlockHeight * 0.3,
        -hookCurveRadius * 1.5, -hookBlockHeight * 0.5,
        -hookCurveRadius, -hookBlockHeight * 0.7
    );
    hookShape.lineTo(0, -hookBlockHeight * 0.7);
    
    const extrudeSettings = {
        steps: 16,
        depth: hookThickness,
        bevelEnabled: true,
        bevelThickness: hookThickness * 0.2,
        bevelSize: hookThickness * 0.1,
        bevelOffset: 0,
        bevelSegments: 5
    };
    
    const hookGeom = new THREE.ExtrudeGeometry(hookShape, extrudeSettings);
    const hook = new THREE.Mesh(hookGeom, materials.hook);
    hook.position.set(0, -hookBlockHeight/2, hookBlockDepth/2 - hookThickness/2);
    hook.castShadow = true;
    hookGroup.add(hook);
    
    // Add camera to monitor the load close-up
    const hookCamera = createCameraMount("HookCamera");
    hookCamera.position.set(0, 0, hookBlockDepth * 0.6);
    hookCamera.rotation.x = Math.PI / 4; // Tilt down to view load
    hookCamera.scale.set(0.8, 0.8, 0.8); // Slightly smaller camera
    hookGroup.add(hookCamera);
    
    return hookGroup;
}

/**
 * Creates a wall tie structure with three tubes extending from the mast
 * @param {number} mastSize - Size of the mast for scaling
 * @param {number} tieHeight - Height position for the tie
 * @param {string} side - Which side of the mast to attach to (N, E, S, W)
 * @returns {THREE.Group} Wall tie group
 */
export function createWallTie(mastSize, tieHeight, side = 'E') {
    const tieLength = mastSize * 3; // Longer tie for more realism
    const tieThickness = mastSize * 0.15; // Thinner tubes
    
    const tieGroup = new THREE.Group();
    tieGroup.name = "Wall Tie";
    
    // Calculate the rotation angle based on the side
    let rotationY = 0;
    switch(side) {
        case 'N': rotationY = 0; break;        // Front (Z-)
        case 'E': rotationY = Math.PI / 2; break; // Right (X+)
        case 'S': rotationY = Math.PI; break;   // Back (Z+)
        case 'W': rotationY = -Math.PI / 2; break; // Left (X-)
        default: rotationY = Math.PI / 2; // Default to East/Right
    }
    
    // Calculate how far apart to space the three tubes
    const spacing = mastSize * 0.3;
    
    // Create three parallel tubes
    for (let i = -1; i <= 1; i++) {
        // Main horizontal tube
        const tubeGeometry = new THREE.CylinderGeometry(tieThickness/2, tieThickness/2, tieLength, 12);
        tubeGeometry.rotateZ(Math.PI/2); // Make tube extend horizontally
        
        const tubeMesh = new THREE.Mesh(tubeGeometry, materials.tie);
        tubeMesh.castShadow = true;
        
        // Position the tube along the mast
        tubeMesh.position.set(tieLength/2, i * spacing, 0);
        
        // Add reinforcement collar at mast connection
        const collarGeometry = new THREE.CylinderGeometry(tieThickness*0.8, tieThickness*0.8, tieThickness*0.5, 12);
        collarGeometry.rotateZ(Math.PI/2);
        const collarMesh = new THREE.Mesh(collarGeometry, materials.slew);
        collarMesh.position.set(0, i * spacing, 0);
        
        // Add struts between tubes for structural stability (vertical supports)
        if (i < 1) {
            const strutGeometry = new THREE.CylinderGeometry(tieThickness/3, tieThickness/3, spacing*0.8, 8);
            const strut = new THREE.Mesh(strutGeometry, materials.tie);
            strut.position.set(tieLength*0.25, i * spacing + spacing/2, 0);
            tieGroup.add(strut);
            
            // Second strut further out
            const strut2 = strut.clone();
            strut2.position.set(tieLength*0.6, i * spacing + spacing/2, 0);
            tieGroup.add(strut2);
        }
        
        tieGroup.add(tubeMesh);
        tieGroup.add(collarMesh);
    }
    
    // Add diagonal braces between the tubes
    const diagonalGeometry = new THREE.CylinderGeometry(tieThickness/4, tieThickness/4, spacing*2*1.414, 8);
    diagonalGeometry.rotateZ(Math.PI/4);
    
    const diagonal1 = new THREE.Mesh(diagonalGeometry, materials.tie);
    diagonal1.position.set(tieLength*0.25, 0, 0);
    tieGroup.add(diagonal1);
    
    const diagonal2 = diagonal1.clone();
    diagonal2.rotation.z = -Math.PI/4;
    diagonal2.position.set(tieLength*0.6, 0, 0);
    tieGroup.add(diagonal2);
    
    // Position and rotate the whole tie group
    tieGroup.position.set(0, tieHeight, 0);
    tieGroup.rotation.y = rotationY;
    
    // Move tie away from mast center by half the mast size in appropriate direction
    const offset = mastSize / 2;
    switch(side) {
        case 'N': tieGroup.position.z = -offset; break;
        case 'E': tieGroup.position.x = offset; break;
        case 'S': tieGroup.position.z = offset; break;
        case 'W': tieGroup.position.x = -offset; break;
    }
    
    return tieGroup;
}