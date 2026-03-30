import * as THREE from 'three/webgpu';

import { Debug } from './Debug';
import { ResourcesLoader } from './ResourcesLoader';
import { Quality } from './Quality';
import { Ticker } from './Ticker';
import { Time } from './Time';
import { Inputs } from './Inputs';
import { Viewport } from './Viewport';
import { Rendering } from './Rendering';
import { Respawns } from './Respawns';
import { View } from './View';
import { Physics } from './Physics.js';
import { Vehicle } from './Vehicle.js';
// import { Grass } from './Grass.js';
import { World } from './World.js';
import { MobileGrassPlane } from './MobileGrassPlane.js';
import { getAssetPath } from './utilities/assetPath.js';

export class Game {
    static getInstance() {
        return Game.instance;
    }

    constructor() {
        if (Game.instance)
            return Game.instance;

        Game.instance = this;
        this.init().catch((error) => {
            console.error(error);
        });
    }

    async init() {
        this.domElement = document.querySelector('.game');
        this.canvasElement = this.domElement.querySelector('.js-canvas');

        // initialization
        this.scene = new THREE.Scene();
        this.debug = new Debug();
        this.resourceLoader = new ResourcesLoader();
        this.quality = new Quality();
        this.ticker = new Ticker();
        this.time = new Time();
        this.inputs = new Inputs([
            { name: 'forward', categories: [], keys: ['Keyboard.KeyW', 'Keyboard.ArrowUp'] },
            { name: 'backward', categories: [], keys: ['Keyboard.KeyS', 'Keyboard.ArrowDown'] },
            { name: 'left', categories: [], keys: ['Keyboard.KeyA', 'Keyboard.ArrowLeft'] },
            { name: 'right', categories: [], keys: ['Keyboard.KeyD', 'Keyboard.ArrowRight'] },
            { name: 'brake', categories: [], keys: ['Keyboard.Space'] },
            { name: 'boost', categories: [], keys: ['Keyboard.ShiftLeft', 'Keyboard.ShiftRight', 'Keyboard.Shift'] },
            { name: 'jump', categories: [], keys: ['Keyboard.Space'] },
            { name: 'pause', categories: [], keys: ['Keyboard.KeyP]'] }
        ], [])
        this.viewport = new Viewport(this.domElement);

        this.rendering = new Rendering();
        await this.rendering.setRenderer();

        this.RAPIER = await import('@dimforge/rapier3d')

        this.resources = await this.resourceLoader.load([
            ['respawnsReferencesModel', getAssetPath('respawns/respawnsReferences-compressed.glb'), 'gltf'],
            ['vehicleModel', getAssetPath('vehicle/default-compressed.glb'), 'gltf',],

        ])

        this.respawns = new Respawns(import.meta.env.VITE_PLAYER_SPAWN || 'landing')
        this.scene.background = null
        this.physics = new Physics()
        this.setPauseInput()

        this.world = new World()
        this.view = new View();
        this.vehicle = new Vehicle(this.resources.vehicleModel)

        this.world.setViewChange()
        // this.grass = new Grass()
        this.grass = new MobileGrassPlane()
        this.rendering.setPostprocessing();
        this.rendering.start()
    }

    setPauseInput() {
        addEventListener('keydown', (event) => {
            if (event.code === 'KeyP' && !event.repeat)
                this.physics.togglePause()
        })
    }
}
