import * as THREE from 'three/webgpu'
import { uniform, float } from 'three/tsl';

import gsap from 'gsap';
import { SplitText } from 'gsap/all';

import Ticker from "./utilities/Ticker";
import Viewport from './utilities/Viewport';
import Rendering from './threetools/Rendering';
import View from './threetools/View';
import ResourceLoader from './utilities/ResourceLoader';
import Debug from './utilities/Debug';
import LoadingSetup from './threetools/LoadSetup';
import CursorAnimation from './pages/CursorAnimation';
import SetGlobalAnimation from './pages/SetGlobalAnimation';
import VehicleProject from './pages/VehicleProject';
import { Inputs } from './utilities/Inputs';
import CursorTarget from './utilities/CursorTarget';
import { getAssetPath } from './utilities/assetPath';

gsap.registerPlugin(SplitText)

export default class Experience {
    static getInstance() {
        if (!Experience.instance) {
            new Experience();
        }

        return Experience.instance
    }

    constructor() {
        Experience.instance = this;

        this.init()
    }

    async init() {
        this.domElement = document.querySelector('.experience');
        this.canvasElement = this.domElement.querySelector('.js-canvas')

        this.cursorTarget = new CursorTarget();

        this.textSectionHeading = document.querySelector('.text-section-heading')
        this.textSectionDescription = document.querySelector('.text-section-description')
        this.pageProgressBars = [...document.querySelectorAll('.bar-container .bar')]
        this.pageOrder = ['beginning', 'CursorAnimation', 'VehicleProject']
        this.pageProgressTheme = {
            beginning: {
                active: '#1d2d44',
                inactive: '#c7d3e0'
            },
            CursorAnimation: {
                active: '#ffffff',
                inactive: 'rgba(255, 255, 255, 0.24)'
            },
            VehicleProject: {
                active: '#ffb347',
                inactive: 'rgba(255, 255, 255, 0.18)'
            }
        }
        this.pageText = {
            beginning: {
                heading: 'Where it begins',
                description: `I started off by exploring simple concepts and building the fundamentals,
creating the base that everything else would grow from as the projects became
more abstract, more technical, and more ambitious.`
            },
            CursorAnimation: {
                heading: 'Utilizing shaders',
                description: `This phase was about utilizing shaders and learning more advanced concepts,
moving beyond simple geometry into reactive visuals, custom rendering logic,
and effects that felt more dynamic and intentional.`
            },
            VehicleProject: {
                heading: 'Combining everything',
                description: `This final vehicle project was about combining everything into a working structure,
bringing together rendering, interaction, physics, and scene organization
into one complete and functional system.`,
                headingClassName: 'text-[3.5rem]',
                headingStartYPercent: -150
            }
        }

        this.bubblePages = document.querySelectorAll('.pop-up-container .pop-up')
        gsap.set(this.bubblePages, { xPercent: -200 })
        this.topBubblePage = ['intro-page']
        this.bubbleMap = new Map();
        this.introPage = document.querySelector('.pop-up-container .intro-page')
        this.cursorPage = document.querySelector('.pop-up-container .cursor-page')
        this.vehiclePage = document.querySelector('.pop-up-container .vehicle-page')
        this.bubbleMap.set('intro-page', this.introPage)
        this.bubbleMap.set('cursor-page', this.cursorPage)
        this.bubbleMap.set('vehicle-page', this.vehiclePage)
        this.bubbleSlashesContainer = document.querySelectorAll('.pop-up-container .container')
        this.bubbleSlashes = document.querySelectorAll('.pop-up-container .pop-up .slash')

        this.removeBubbles = (none_call = true) => {
            if (none_call) {
                gsap.killTweensOf(this.bubblePages)
                gsap.to(this.bubbleMap.get(this.topBubblePage[0]), {
                    xPercent: -200,
                    duration: 1.4,
                    ease: 'power2.out'
                })

                this.topBubblePage.shift()
            }
            else if (!none_call) {
                console.log(this.topBubblePage)
                if (this.topBubblePage.length > 1) {
                    gsap.killTweensOf(this.bubblePages)
                    gsap.to(this.bubbleMap.get(this.topBubblePage[0]), {
                        xPercent: -200,
                        duration: 1.4,
                        ease: 'power2.out'
                    })

                    this.topBubblePage.shift()
                }
            }
        }

        this.bubbleSlashesContainer.forEach(slash => {
            slash.addEventListener('pointerenter', () => {
                gsap.killTweensOf(this.bubbleSlashes)
                gsap.to(this.bubbleSlashes, {
                    width: '8px',
                    scale: 1.2,
                    duration: 0.1,
                })
            })
            slash.addEventListener('pointerleave', () => {
                gsap.killTweensOf(this.bubbleSlashes)
                gsap.to(this.bubbleSlashes, {
                    width: '5px',
                    scale: 1,
                    duration: 0.1,
                })
            })

            slash.addEventListener('pointerdown', () => {
                this.removeBubbles();
            })
        })

        this.currentPageText = { ...this.pageText.beginning }
        this.refreshTextSplits(-100, 100)
        this.updatePageProgress('beginning', false)
        this.bindPageBarNavigation()

        this.scene = new THREE.Scene();
        this.debug = new Debug();
        this.ticker = new Ticker();
        this.viewport = new Viewport(this.domElement);
        this.inputs = new Inputs([
            { name: 'forward', categories: [], keys: ['Keyboard.KeyW', 'Keyboard.ArrowUp'] },
            { name: 'backward', categories: [], keys: ['Keyboard.KeyS', 'Keyboard.ArrowDown'] },
            { name: 'left', categories: [], keys: ['Keyboard.KeyA', 'Keyboard.ArrowLeft'] },
            { name: 'right', categories: [], keys: ['Keyboard.KeyD', 'Keyboard.ArrowRight'] },
            { name: 'brake', categories: [], keys: ['Keyboard.Space'] },
            { name: 'boost', categories: [], keys: ['Keyboard.ShiftLeft', 'Keyboard.ShiftRight', 'Keyboard.Shift'] },
            { name: 'jump', categories: [], keys: ['Keyboard.Space'] },
            { name: 'pause', categories: [], keys: ['Keyboard.KeyP]'] }
        ], []);

        this.rendering = new Rendering();
        this.view = new View();
        await this.rendering.setRenderer();
        this.loadingSetup = new LoadingSetup();

        this.rendering.start();

        this.resourceLoader = new ResourceLoader();
        this.resources = {}

        this.tempProgress = { value: 0 };

        this.resources = await this.resourceLoader.load(
            [
                ['vehicleModel', getAssetPath('vehicle/default-compressed.glb'), 'gltf',],
                ['hoverAnimationDogTexture', getAssetPath('hover-animation/images/picture-1.png'), 'texture']
            ],

            ({ loaded, total, progress }) => {

                this.loadingSetup.update(this.tempProgress.value)
                gsap.killTweensOf(this.tempProgress)
                gsap.to(this.tempProgress, {
                    value: progress,
                    onUpdate: () => {
                        this.loadingSetup.update(this.tempProgress.value)
                    }
                })
            }
        )

        this.scene.add(new THREE.AmbientLight(0xffffff, 2))
        const tempMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshNormalMaterial());

        this.loadingSetup.events.on('start', () => {
            gsap.killTweensOf(this.domElement)

            const that = this;

            gsap.to(this.domElement, {
                width: '50%',
                onUpdate: function () {
                    that.viewport.measure();
                    that.viewport.events.trigger('resize');
                }
            })

            this.updateXMLElements();

            const opacity = uniform(float(0));
            this.animationState = { active: true };

            this.setGlobalAnimation = new SetGlobalAnimation('beginning');
            this.CursorAnimation = new CursorAnimation();
            this.vehicleProject = new VehicleProject();

            const tempMeshRotation = () => tempMesh.rotation.y += Math.abs(Math.sin(this.ticker.delta) / 10)

            this.setGlobalAnimation.addCallbacks(
                'beginning',
                [async () => {
                    this.scene.add(tempMesh)
                    this.ticker.events.on('tick', tempMeshRotation)
                    this.updatePageProgress('beginning')
                    await this.transitionTextContent(this.pageText.beginning)
                    gsap.to(this.view.camera.position, {
                        x: 4,
                        y: 4,
                        z: 4
                    })
                    gsap.to(document.body, {
                        '--bg-color': '#ffffff',
                    }, "<")
                    gsap.to(this.textSectionHeading, {
                        color: '#1d2d44'
                    }, "<")
                    gsap.to(this.textSectionDescription, {
                        color: '#1d2d44'
                    }, "<")
                    // gsap.to(this.cursorTarget.cursorContainer, {
                    //     '--line-color' : '#000',
                    //     duration: 0.1
                    // })

                    gsap.to(this.introPage, {
                        xPercent: 0,
                        ease: 'bounce.out',
                        duration: 1.5,
                    })
                    this.removeBubbles(false)
                    this.topBubblePage.unshift('intro-page')
                }],
                [() => {
                    this.scene.remove(tempMesh)
                    this.ticker.events.on('tick', tempMeshRotation)
                }]
            )

            this.setGlobalAnimation.triggerCallback('beginning')
        })
    }

    bindPageBarNavigation() {
        this.pageProgressBars.forEach((bar, index) => {
            const pageName = this.pageOrder[index]

            if (!pageName) {
                return
            }

            bar.setAttribute('role', 'button')
            bar.setAttribute('tabindex', '0')
            bar.style.cursor = 'pointer'
            gsap.set(bar, {
                scale: 1,
                y: 0
            })

            bar.addEventListener('pointerenter', () => {
                gsap.to(bar, {
                    scale: 1.04,
                    y: -2,
                    duration: 0.2,
                    ease: 'power2.out'
                })
            })

            bar.addEventListener('pointerleave', () => {
                gsap.to(bar, {
                    scale: 1,
                    y: 0,
                    duration: 0.2,
                    ease: 'power2.out'
                })
            })

            bar.addEventListener('click', () => {
                this.setGlobalAnimation?.triggerCallback(pageName)
            })

            bar.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    this.setGlobalAnimation?.triggerCallback(pageName)
                }
            })
        })
    }

    setTextContent(pageText) {
        this.currentPageText = { ...pageText }
        this.textSectionHeading.textContent = pageText.heading
        this.textSectionDescription.textContent = pageText.description

        this.textSectionHeading.classList.remove('text-[4.5rem]', 'text-[4.2rem]')

        if (this.currentPageText.headingClassName) {
            this.textSectionHeading.classList.add(this.currentPageText.headingClassName)
        }
    }

    clearTextSplits() {
        if (this.HEADING_SPLIT) {
            this.HEADING_SPLIT.revert()
            this.HEADING_SPLIT = null
        }

        if (this.DESCRIPTION_SPLIT) {
            this.DESCRIPTION_SPLIT.revert()
            this.DESCRIPTION_SPLIT = null
        }
    }

    refreshTextSplits(headingYPercent = -100, descriptionYPercent = 100) {
        this.clearTextSplits()
        this.setTextContent(this.currentPageText)

        this.HEADING_SPLIT = new SplitText(this.textSectionHeading, {
            type: 'chars',
            charsClass: 'char',
        })
        this.DESCRIPTION_SPLIT = new SplitText(this.textSectionDescription, {
            type: 'lines',
            linesClass: 'line'
        })

        this.DESCRIPTION_SPLIT.lines.forEach(line => {
            const wrapper = document.createElement('div')
            wrapper.classList.add('line-mask')
            line.parentNode.insertBefore(wrapper, line)
            wrapper.appendChild(line);
        });

        gsap.set(this.HEADING_SPLIT.chars, {
            yPercent: this.currentPageText.headingStartYPercent ?? headingYPercent,
            opacity: headingYPercent === 0 ? 1 : 0
        })
        gsap.set(this.DESCRIPTION_SPLIT.lines, {
            yPercent: descriptionYPercent,
            opacity: descriptionYPercent === 0 ? 1 : 0
        })
    }

    async transitionTextContent(pageText) {
        if (
            this.currentPageText.heading === pageText.heading &&
            this.currentPageText.description === pageText.description
        ) {
            return
        }

        gsap.killTweensOf(this.HEADING_SPLIT.chars)
        gsap.killTweensOf(this.DESCRIPTION_SPLIT.lines)

        await new Promise((resolve) => {
            const timeline = gsap.timeline({ onComplete: resolve })

            timeline.to(this.HEADING_SPLIT.chars, {
                yPercent: -100,
                opacity: 0,
                duration: 0.25,
                stagger: 0.03,
                ease: 'power2.in'
            })

            timeline.to(this.DESCRIPTION_SPLIT.lines, {
                yPercent: -100,
                opacity: 0,
                duration: 0.25,
                stagger: 0.06,
                ease: 'power2.in'
            }, 0)
        })

        this.currentPageText = { ...pageText }
        this.refreshTextSplits(-100, -100)
        this.updateXMLElements()
    }

    updatePageProgress(pageName, animate = true) {
        if (!this.pageProgressBars.length) {
            return
        }

        const theme = this.pageProgressTheme[pageName] ?? this.pageProgressTheme.beginning

        this.pageProgressBars.forEach((bar, index) => {
            gsap.to(bar, {
                flexGrow: this.pageOrder[index] === pageName ? 2 : 1,
                duration: animate ? 0.45 : 0,
                ease: 'power2.inOut'
            })

            gsap.to(bar, {
                backgroundColor: this.pageOrder[index] === pageName ? theme.active : theme.inactive,
                duration: animate ? 0.35 : 0,
                ease: 'power2.inOut'
            })
        })
    }

    updateXMLElements() {
        gsap.to(this.HEADING_SPLIT.chars, {
            yPercent: 0,
            opacity: 1,
            duration: 0.4,
            stagger: 0.06,
            ease: 'power2.inOut'
        })
        gsap.to(this.DESCRIPTION_SPLIT.lines, {
            yPercent: 0,
            opacity: 1,
            duration: 0.5,
            stagger: 0.1,
            ease: 'power2.in'
        })
    }

    destroy() {

    }
}
