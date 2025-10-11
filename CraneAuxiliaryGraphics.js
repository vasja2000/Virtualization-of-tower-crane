import * as THREE from 'three';

let ropeGroup;
let dynamicLoadMesh;
// Задаем как выглядит трос - темно-серый и толстый
const ropeMaterial = new THREE.LineBasicMaterial({ color: 0x333333, linewidth: 2 });

// Материал для обычного груза - серый как металл
const loadMaterialDefault = new THREE.MeshStandardMaterial({ 
    color: 0x888888, 
    roughness: 0.7, // насколько шершавая поверхность
    metalness: 0.3  // насколько металлический блеск
});

// Материал для бетонных изделий - синеватый и немного прозрачный
const loadMaterialConcrete = new THREE.MeshStandardMaterial({ 
    color: 0x4c84b8, 
    roughness: 0.65,
    metalness: 0.45,
    transparent: true,
    opacity: 0.86 
});

// Материалы для специальных грузов
// Материал для арматуры - коричневато-серый
const loadMaterialRebar = new THREE.MeshStandardMaterial({ 
    color: 0xa57164, 
    roughness: 0.6,
    metalness: 0.5 
});

// Материал для панелей - бежевый как бетон
const loadMaterialPanel = new THREE.MeshStandardMaterial({ 
    color: 0xd8c394, 
    roughness: 0.8,
    metalness: 0.2 
});

let ropesVisible = true;

/**
 * Настраивает группу для троса и груза под крюком.
 * Важно: кратность полиспаста (запасовка) берется из параметра 'reeving' 
 * в таблице характеристик крана, которую загружаем в начале работы
 */
export function setupRopeAndLoad(craneGroup) {
    if (!craneGroup) return;
    const upper = craneGroup.getObjectByName('Upper Structure (Rotating)');
    if (!upper) return;

    ropeGroup = new THREE.Group();
    ropeGroup.name = "RopeGroup";
    upper.add(ropeGroup);
    
    // Listen for rope visibility toggle events
    window.addEventListener('ropeToggle', (e) => {
        ropesVisible = e.detail.visible;
        if (ropeGroup) {
            ropeGroup.visible = ropesVisible;
        }
    });
}

/**
 * Обновляет положение троса и груза, когда кран двигается
 * Здесь параметр dataForFrame.reeving определяет кратность полиспаста
 * Например, если reeving = 4, будет показано 4 ветви троса
 */
export function updateRopeAndLoadGraphics(dataForFrame) {
    // Remove previous geometry
    if (ropeGroup) {
        while (ropeGroup.children.length > 0) {
            const obj = ropeGroup.children.pop();
            if (obj.geometry) obj.geometry.dispose();
            // Materials might be reused if not cloned, dispose only if they are
            // For simplicity and safety with dynamic materials, dispose and recreate
            // If reusing materials is critical, manage them outside and only dispose on cleanup
            if (obj.material && obj.material !== ropeMaterial && 
                obj.material !== loadMaterialDefault && 
                obj.material !== loadMaterialConcrete &&
                obj.material !== loadMaterialRebar &&
                obj.material !== loadMaterialPanel) {
                obj.material.dispose?.();
            }
        }
    } else {
        // Rope group not set up yet
        return;
    }

    // Set visibility based on toggle state
    ropeGroup.visible = ropesVisible;

    const trolleyLocalPos = dataForFrame.trolleyLocalPos;
    const hookLocalPos = dataForFrame.hookLocalPos;
    if (!trolleyLocalPos || !hookLocalPos) return;

    // --- Трос: рисуем запасовку (число reeving из таблицы характеристик)
    const reeving = Math.max(1, Number(dataForFrame.reeving) || 1); // запасовка — сколько ветвей троса
    let offset = 0.1;
    // Рисуем максимум 8 ветвей троса, даже если запасовка больше
    for (let i = 0; i < Math.min(reeving, 8); ++i) {
        const ropePoints = [];
        
        // Start point at trolley
        ropePoints.push(new THREE.Vector3(
            trolleyLocalPos.x + Math.sin(i) * offset, 
            trolleyLocalPos.y, 
            trolleyLocalPos.z + Math.cos(i) * offset
        ));
        
        // IMPROVED: Create vertical rope that falls straight down with minor catenary curve
        // Number of segments increases with height difference for more detail
        const verticalDist = trolleyLocalPos.y - hookLocalPos.y;
        const segments = Math.max(3, Math.floor(verticalDist / 2));
        
        for (let s = 1; s < segments; s++) {
            const t = s / segments;
            // Add slight catenary curve effect (very minimal)
            const sag = Math.sin(t * Math.PI) * 0.1; 
            
            // Points follow a nearly vertical path from trolley to hook
            ropePoints.push(new THREE.Vector3(
                trolleyLocalPos.x + Math.sin(i + t * 0.5) * offset * 0.8 + Math.sin(t * 5) * sag * 0.1, // Very minimal horizontal variance
                trolleyLocalPos.y * (1 - t) + hookLocalPos.y * t,
                trolleyLocalPos.z + Math.cos(i + t * 0.5) * offset * 0.8 + Math.cos(t * 5) * sag * 0.1
            ));
        }
        
        // End point at hook
        ropePoints.push(new THREE.Vector3(
            hookLocalPos.x + Math.sin(i) * offset, 
            hookLocalPos.y + 0.4, // Offset hook point slightly upwards
            hookLocalPos.z + Math.cos(i) * offset
        ));
        
        // Create curve from points
        const curve = new THREE.CatmullRomCurve3(ropePoints);
        const curvePoints = curve.getPoints(50); // Smooth curve with 50 points
        
        const geo = new THREE.BufferGeometry().setFromPoints(curvePoints);
        const line = new THREE.Line(geo, ropeMaterial);
        
        ropeGroup.add(line);
        offset += 0.06;
    }

    // --- Груз: создаем разные виды грузов
    // Размер груза зависит от его веса (weight)
    // Тип груза определяется автоматически или берется из aiCargoType:
    // - "concrete" - бетонные изделия
    // - "rebar" - арматура
    // - "panel" - панели
    // - "default" - обычный груз на поддоне

    let loadType = "default";
    let loadHeight = 1;
    let loadWidth = 0.7;
    let loadDepth = 0.7;
    let loadMat = loadMaterialDefault; // Reuse material

    // Try auto-guess by AI result for this frame, fallback simple logic
    if (dataForFrame.aiCargoType) {
        loadType = dataForFrame.aiCargoType;
    } else {
        // Simple fallback logic if no AI result or aiCargoType
        if (dataForFrame.weight !== null && dataForFrame.reeving >= 2) {
            // Check against prevWeight if available
            if (dataForFrame.prevWeight !== null && 
                dataForFrame.prevWeight > dataForFrame.weight && 
                (dataForFrame.prevWeight - dataForFrame.weight) > 0.4) {
                loadType = "concrete";
            }
        }
    }

    // Configure load based on type and weight
    const weight = dataForFrame.weight || 0;
    
    if (loadType === "concrete") {
        loadHeight = 0.8 + (weight * 0.05); // Slightly taller with more weight
        loadWidth = 0.7 + (weight * 0.02);
        loadDepth = loadWidth;
        loadMat = loadMaterialConcrete;
    } else if (loadType === "rebar") {
        loadHeight = 0.3;
        loadWidth = 2 + (weight * 0.15); // Long bars
        loadDepth = 0.3;
        loadMat = loadMaterialRebar;
    } else if (loadType === "panel") {
        loadHeight = 0.2 + (weight * 0.03);
        loadWidth = 1.5 + (weight * 0.1);
        loadDepth = 1.5;
        loadMat = loadMaterialPanel;
    } else {
        // Default cargo - adjust size by weight
        loadHeight = 0.5 + (weight * 0.07);
        loadWidth = 0.6 + (weight * 0.05);
        loadDepth = loadWidth;
    }
    
    // If weight very low, make it very small or invisible
    if (weight < 0.2) {
        loadHeight = 0.2;
        loadWidth = 0.2;
        loadDepth = 0.2;
        // Make nearly invisible for zero weight
        if (weight < 0.05) {
            loadHeight = 0.1;
            loadWidth = 0.1;
            loadDepth = 0.1;
        }
    }

    // Create geometry based on cargo type
    let geom;
    
    if (loadType === "concrete") {
        geom = new THREE.CylinderGeometry(loadWidth, loadWidth * 0.8, loadHeight, 16);
    } else if (loadType === "rebar") {
        geom = new THREE.BoxGeometry(loadWidth, loadHeight, loadDepth);
    } else if (loadType === "panel") {
        geom = new THREE.BoxGeometry(loadWidth, loadHeight, loadDepth);
    } else {
        // Default mixed cargo - use a mesh of cubes for palletized goods
        if (weight > 1) {
            const group = new THREE.Group();
            
            // Create a base pallet
            const palletGeom = new THREE.BoxGeometry(loadWidth + 0.1, 0.1, loadDepth + 0.1);
            const palletMesh = new THREE.Mesh(palletGeom, new THREE.MeshStandardMaterial({ 
                color: 0x8B4513, roughness: 0.9 
            }));
            palletMesh.position.y = -loadHeight / 2;
            group.add(palletMesh);
            
            // Create cargo boxes on pallet
            const boxSize = loadWidth / 2;
            const boxHeight = loadHeight - 0.1;
            
            for (let x = -1; x <= 1; x += 2) {
                for (let z = -1; z <= 1; z += 2) {
                    if (Math.random() > 0.2) { // Random gaps in cargo
                        const boxGeom = new THREE.BoxGeometry(
                            boxSize * (0.7 + Math.random() * 0.3),
                            boxHeight * (0.7 + Math.random() * 0.3),
                            boxSize * (0.7 + Math.random() * 0.3)
                        );
                        const boxMesh = new THREE.Mesh(boxGeom, loadMat);
                        boxMesh.position.set(
                            (x * boxSize / 2) * 0.7,
                            -loadHeight / 2 + boxHeight / 2 + 0.05,
                            (z * boxSize / 2) * 0.7
                        );
                        group.add(boxMesh);
                    }
                }
            }
            
            dynamicLoadMesh = group;
            // Position load relative to ropeGroup (which is parented to Upper Structure)
            dynamicLoadMesh.position.copy(hookLocalPos);
            dynamicLoadMesh.position.y -= 0.7; // Position load visually below hook
            dynamicLoadMesh.castShadow = true;
            ropeGroup.add(dynamicLoadMesh);
            
            return; // Skip standard mesh creation below
        } else {
            geom = new THREE.BoxGeometry(loadWidth, loadHeight, loadDepth);
        }
    }
    
    dynamicLoadMesh = new THREE.Mesh(geom, loadMat);
    // Position load relative to ropeGroup (which is parented to Upper Structure)
    dynamicLoadMesh.position.copy(hookLocalPos);
    dynamicLoadMesh.position.y -= (loadHeight / 2 + 0.5); // Position load visually below hook
    
    // Add slight rotation for realism
    dynamicLoadMesh.rotation.y = Math.sin(Date.now() * 0.0005) * 0.05;
    dynamicLoadMesh.rotation.x = Math.sin(Date.now() * 0.0003) * 0.03;
    
    dynamicLoadMesh.castShadow = true;
    ropeGroup.add(dynamicLoadMesh);
}

/**
 * Очищает все временные объекты (тросы, грузы) когда заканчиваем работу
 */
export function cleanupAuxiliaryGraphics() {
    if (ropeGroup) {
        while (ropeGroup.children.length > 0) {
            const obj = ropeGroup.children.pop();
            if (obj.geometry) obj.geometry.dispose();
            // Only dispose materials if they were created uniquely
            if (obj.material && obj.material !== ropeMaterial && 
                obj.material !== loadMaterialDefault && 
                obj.material !== loadMaterialConcrete &&
                obj.material !== loadMaterialRebar &&
                obj.material !== loadMaterialPanel) {
                obj.material.dispose?.();
            }
        }
    }
    // Dispose the materials themselves
    if (ropeMaterial && ropeMaterial.dispose) ropeMaterial.dispose();
    if (loadMaterialDefault && loadMaterialDefault.dispose) loadMaterialDefault.dispose();
    if (loadMaterialConcrete && loadMaterialConcrete.dispose) loadMaterialConcrete.dispose();
    if (loadMaterialRebar && loadMaterialRebar.dispose) loadMaterialRebar.dispose();
    if (loadMaterialPanel && loadMaterialPanel.dispose) loadMaterialPanel.dispose();

    ropeGroup = null;
    dynamicLoadMesh = null;
    
    // Remove event listener
    window.removeEventListener('ropeToggle', () => {});
}