import * as THREE from 'three';

/**
 * Материалы для разных частей крана.
 * Все цвета и свойства материалов (блеск, шероховатость) собраны в одном месте,
 * чтобы было удобно менять.
 */
const materials = {
    // Материал для мачты - темно-серый металл
    mast: new THREE.MeshStandardMaterial({ 
        color: 0x505050,       // Цвет
        roughness: 0.6,        // Насколько шершавая поверхность (0-гладкая, 1-грубая)
        metalness: 0.4,        // Насколько металлический блеск (0-матовый, 1-зеркальный)
        envMapIntensity: 0.8   // Как сильно отражает окружение
    }),

    // Материал для решетки мачты - чуть темнее основной мачты
    mastLattice: new THREE.MeshStandardMaterial({ 
        color: 0x404040, 
        roughness: 0.7, 
        metalness: 0.3,
        envMapIntensity: 0.6
    }),

    // Материал для поворотной части - серый металл
    slew: new THREE.MeshStandardMaterial({ 
        color: 0x606060, 
        roughness: 0.5, 
        metalness: 0.5,
        envMapIntensity: 0.7
    }),

    // Материал для стрелы - желтый
    jib: new THREE.MeshStandardMaterial({ 
        color: 0xffdd00, 
        roughness: 0.7, 
        metalness: 0.2
    }),

    // Материал для противовесной консоли - светло-серый
    counterJib: new THREE.MeshStandardMaterial({ 
        color: 0xaaaaaa, 
        roughness: 0.7, 
        metalness: 0.2
    }),

    // Материал для противовеса - темно-серый бетон
    counterweight: new THREE.MeshStandardMaterial({ 
        color: 0x333333, 
        roughness: 0.8, 
        metalness: 0.1
    }),

    // Материал для крюка - красно-оранжевый металл
    hook: new THREE.MeshStandardMaterial({ 
        color: 0xdd3300, 
        roughness: 0.4, 
        metalness: 0.6
    }),

    // Материал для креплений к стене - синий металл
    tie: new THREE.MeshStandardMaterial({ 
        color: 0x0056b3, 
        roughness: 0.6, 
        metalness: 0.3
    }),

    // Материал для грузовой тележки - серый металл
    trolley: new THREE.MeshStandardMaterial({ 
        color: 0x888888, 
        roughness: 0.5, 
        metalness: 0.4
    }),

    // Материал для кабины снаружи - светло-серый
    cabinExterior: new THREE.MeshStandardMaterial({ 
        color: 0xf0f0f0, 
        roughness: 0.4, 
        metalness: 0.1
    }),

    // Материал для стекол кабины - голубое стекло
    cabinGlass: new THREE.MeshStandardMaterial({ 
        color: 0x88ccff, 
        roughness: 0.1, 
        metalness: 0.9,
        transparent: true,    // Прозрачный материал
        opacity: 0.3         // Насколько прозрачный (0-невидимый, 1-непрозрачный)
    }),

    // Материал для камер наблюдения - черный пластик
    camera: new THREE.MeshStandardMaterial({ 
        color: 0x222222, 
        roughness: 0.3, 
        metalness: 0.8
    }),

    // Материал для линз камер - синее стекло
    cameraLens: new THREE.MeshStandardMaterial({ 
        color: 0x0077ff, 
        roughness: 0.1, 
        metalness: 0.9,
        transparent: true,
        opacity: 0.9
    })
};

/**
 * Очищает все материалы когда завершаем работу с краном.
 * Нужно вызывать при выходе, чтобы освободить память компьютера.
 */
export function disposeMaterials() {
    Object.values(materials).forEach(material => {
        if (material && material.dispose) {
            material.dispose();
        }
    });
}

export default materials;