import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

let scene, camera, renderer, controls;
const DEG_TO_RAD = Math.PI / 180; // Превращаем градусы в радианы
const DEFAULT_CAMERA_POS = new THREE.Vector3(50, 40, 60); // Где будет находиться камера в начале

// Сохраняем все элементы, которые можно включать и выключать
let axesHelper, gridXY, gridYZ, gridXZ, groundMesh;
let scaleLabels = [];

/**
 * Добавляем разноцветные линии-помощники с цифрами в метрах, чтобы было легче понимать размеры
 */
function addAxesAndScales(scene) {
    const axisLength = 40;
    axesHelper = new THREE.AxesHelper(axisLength);
    axesHelper.name = "XYZ Axes";
    scene.add(axesHelper);

    for (let x = 5; x <= 100; x += 5) addNumberLabel(scene, x, 0.1, 0, x);
    for (let x = -5; x >= -100; x -= 5) addNumberLabel(scene, x, 0.1, 0, Math.abs(x));
    for (let y = 5; y <= 120; y += 5) addNumberLabel(scene, 0.1, y, 0, y);
    for (let z = 5; z <= 100; z += 5) addNumberLabel(scene, 0, 0.1, z, z);
    for (let z = -5; z >= -100; z -= 5) addNumberLabel(scene, 0, 0.1, z, Math.abs(z));
}

/**
 * Добавляем циферки на сцену, чтобы показать расстояния
 */
function addNumberLabel(scene, x, y, z, value) {
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.font = 'bold 34px monospace';
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 3;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.strokeText(String(value), size / 2, size / 2);
    ctx.fillStyle = '#222';
    ctx.fillText(String(value), size / 2, size / 2);

    const texture = new THREE.Texture(canvas);
    texture.needsUpdate = true;
    const material = new THREE.SpriteMaterial({ map: texture, depthTest: false, depthWrite: false });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(4, 4, 1);
    sprite.position.set(x, y, z);
    sprite.userData.isScaleLabel = true;
    scene.add(sprite);
    scaleLabels.push(sprite);
}

/**
 * Настраиваем нашу 3D-сцену, где будет находиться кран
 */
export function initScene(container, config) {
    // Создаём пустую сцену и делаем серый фон
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xcccccc);
    scene.fog = new THREE.Fog(0xcccccc, 100, 500); // Добавляем туман вдалеке

    // Настраиваем камеру, через которую мы будем смотреть на кран
    const aspect = container.clientWidth / container.clientHeight;
    camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 1000);
    camera.position.copy(DEFAULT_CAMERA_POS);
    camera.lookAt(0, config.mastHeight / 2, 0);

    // Создаём волшебный экран, на котором будет всё отображаться
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true; // Включаем красивые тени
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // Добавляем мягкий рассеянный свет, как в пасмурный день
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    // Добавляем яркий направленный свет, как солнышко
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(50, 100, 30);
    directionalLight.castShadow = true; // Этот свет будет создавать тени
    directionalLight.shadow.mapSize.width = 1024;
    directionalLight.shadow.mapSize.height = 1024;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 500;
    directionalLight.shadow.camera.left = -100;
    directionalLight.shadow.camera.right = 100;
    directionalLight.shadow.camera.top = 100;
    directionalLight.shadow.camera.bottom = -100;
    scene.add(directionalLight);

    groundMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(500, 500),
        new THREE.MeshStandardMaterial({
            color: 0xbbbbaa,
            depthWrite: false,
            roughness: 0.9,
            metalness: 0.1
        })
    );
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.receiveShadow = true;
    groundMesh.name = "Ground";
    scene.add(groundMesh);

    gridXY = new THREE.GridHelper(200, 40, 0x0086c7, 0xaaaab0);
    gridXY.material.opacity = 0.55;
    gridXY.material.transparent = true;
    gridXY.position.y = 0.01;
    gridXY.name = "GridXY";
    scene.add(gridXY);

    gridYZ = new THREE.GridHelper(150, 30, 0xf07f23, 0xc8c8d8);
    gridYZ.material.opacity = 0.3;
    gridYZ.material.transparent = true;
    gridYZ.rotation.z = Math.PI / 2;
    gridYZ.position.x = 0.01;
    gridYZ.name = "GridYZ";
    scene.add(gridYZ);

    gridXZ = new THREE.GridHelper(150, 30, 0x1bc986, 0xc8c8d8);
    gridXZ.material.opacity = 0.3;
    gridXZ.material.transparent = true;
    gridXZ.rotation.x = Math.PI / 2;
    gridXZ.position.z = 0.01;
    gridXZ.name = "GridXZ";
    scene.add(gridXZ);

    addAxesAndScales(scene);

    // Настраиваем управление камерой - как мы будем двигаться вокруг крана
    controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, config.mastHeight / 2, 0);
    controls.enableDamping = true; // Делаем движение камеры плавным
    controls.dampingFactor = 0.1; // Насколько плавным будет движение
    controls.screenSpacePanning = false;
    controls.maxDistance = 400; // Как далеко можно отойти от крана
    controls.minDistance = 10; // Как близко можно подойти к крану
    controls.maxPolarAngle = Math.PI - 0.05; // Как высоко можно поднять камеру
    controls.minPolarAngle = 0; // Как низко можно опустить камеру
    controls.autoRotate = false; // Камера не будет крутиться сама
    controls.minAzimuthAngle = -Infinity; // Разрешаем крутиться вокруг крана без ограничений
    controls.maxAzimuthAngle = Infinity;

    // Настраиваем кнопочки, которыми можно включать и выключать разные элементы
    setupVisibilityControls();

    return {
        scene,
        camera,
        renderer,
        controls
    };
}

function setupVisibilityControls() {
    // Add event listeners for the toggle controls
    const gridToggle = document.getElementById('toggle-grid');
    const axesToggle = document.getElementById('toggle-axes');
    const groundToggle = document.getElementById('toggle-ground');
    
    if (gridToggle) {
        gridToggle.addEventListener('change', (e) => {
            if (gridXY) gridXY.visible = e.target.checked;
            if (gridYZ) gridYZ.visible = e.target.checked;
            if (gridXZ) gridXZ.visible = e.target.checked;
        });
    }
    
    if (axesToggle) {
        axesToggle.addEventListener('change', (e) => {
            if (axesHelper) axesHelper.visible = e.target.checked;
            // Also toggle scale labels
            scaleLabels.forEach(label => {
                label.visible = e.target.checked;
            });
        });
    }
    
    if (groundToggle) {
        groundToggle.addEventListener('change', (e) => {
            if (groundMesh) groundMesh.visible = e.target.checked;
        });
    }
    
    // Set up rope visibility toggle (used by CraneAuxiliaryGraphics)
    const ropeToggle = document.getElementById('toggle-ropes');
    if (ropeToggle) {
        ropeToggle.addEventListener('change', (e) => {
            // Dispatch custom event for rope visibility
            window.dispatchEvent(new CustomEvent('ropeToggle', { 
                detail: { visible: e.target.checked } 
            }));
        });
    }
}

export function handleResize(container) {
    if (!camera || !renderer) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
}

export function renderScene() {
    if (controls) controls.update();
    if (renderer && scene && camera) {
        renderer.render(scene, camera);
    }
}

export function get2DPosition(worldPosition) {
    if (!camera || !renderer) return { x: 0, y: 0 };

    const vector = worldPosition.clone();
    vector.project(camera);

    const x = (vector.x + 1) / 2 * renderer.domElement.offsetWidth;
    const y = -(vector.y - 1) / 2 * renderer.domElement.offsetHeight;

    return { x, y };
}

export function cleanup() {
    if (scene) {
        scene.traverse((object) => {
            if (object.isMesh) {
                if (object.geometry) object.geometry.dispose();
                if (object.material) {
                    if (Array.isArray(object.material)) {
                        object.material.forEach(material => material.dispose());
                    } else {
                        object.material.dispose();
                    }
                }
            } else if (object.isSprite) {
                if (object.material) object.material.dispose();
                if (object.material && object.material.map) object.material.map.dispose();
            }
        });
        scene.clear();
    }
    if (controls) controls.dispose();
    if (renderer) renderer.dispose();
    scene = null;
    camera = null;
    renderer = null;
    controls = null;
    
    // Clear references
    axesHelper = null;
    gridXY = gridYZ = gridXZ = null;
    groundMesh = null;
    scaleLabels = [];
}

export function getScene() { return scene; }
export function getCamera() { return camera; }