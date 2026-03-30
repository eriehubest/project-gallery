import Experience from "../Experience";

import gsap from "gsap";

import * as THREE from "three/webgpu";
import { MeshBasicNodeMaterial } from "three/webgpu";

import {
    uniform,
    attribute,
    cos,
    float,
    length,
    normalize,
    oneMinus,
    positionLocal,
    pow,
    sin,
    smoothstep,
    texture,
    uv,
    vec2,
    vec3
} from 'three/tsl'
import { getAssetPath } from "../utilities/assetPath";

export default class CursorAnimation {
    constructor(stateChange) {
        this.STARTING_OPACITY = uniform(float(0));

        this.experience = Experience.getInstance();
        this.experience.setGlobalAnimation.addPageObject('CursorAnimation')

        const displacement = {}

        displacement.canvas = document.createElement('canvas')
        displacement.canvas.width = 128
        displacement.canvas.height = 128

        displacement.context = displacement.canvas.getContext('2d')
        displacement.context.fillRect(0, 0, displacement.canvas.width, displacement.canvas.height)

        displacement.glowImage = new Image()
        displacement.glowImage.src = getAssetPath('hover-animation/images/glow.png')

        displacement.interactivePlane = new THREE.Mesh(
            new THREE.PlaneGeometry(10, 10),
            new THREE.MeshBasicMaterial({ color: 'red' })
        )
        displacement.interactivePlane.visible = false
        this.experience.scene.add(displacement.interactivePlane)

        displacement.raycaster = new THREE.Raycaster()
        displacement.screenCursor = new THREE.Vector2(5, 0)
        displacement.canvasCursor = new THREE.Vector2(999, 999)

        displacement.canvas.style.position = 'fixed'
        displacement.canvas.style.top = '20px'
        displacement.canvas.style.left = '20px'
        displacement.canvas.style.width = '256px'
        displacement.canvas.style.height = '256px'
        displacement.canvas.style.border = '1px solid white'
        displacement.canvas.style.zIndex = '100'
        // document.body.appendChild(displacement.canvas)

        const hoverElement = document.querySelector('.experience')
        hoverElement.classList.add('z-10000')

        hoverElement.addEventListener('pointermove', (event) => {
            // console.log('hover')
            displacement.screenCursor.x = (event.clientX / this.experience.viewport.width) * 2 - 1
            displacement.screenCursor.y = -(event.clientY / this.experience.viewport.height) * 2 + 1
        })

        displacement.texture = new THREE.CanvasTexture(displacement.canvas)

        const sourceGeometry = new THREE.PlaneGeometry(10, 10, 128, 128);
        const sourcePositions = sourceGeometry.attributes.position;
        const sourceUvs = sourceGeometry.attributes.uv;
        const particleCount = sourcePositions.count;

        const particleGeometry = new THREE.PlaneGeometry(1, 1, 1, 1);

        const intensityArray = new Float32Array(particleCount);
        const angleArray = new Float32Array(particleCount)
        const particleUvArray = new Float32Array(particleCount * 2);

        for (let i = 0; i < particleCount; i++) {
            intensityArray[i] = Math.random() / 2 + 0.5;
            angleArray[i] = Math.random() * Math.PI * 2

            particleUvArray[i * 2 + 0] = sourceUvs.getX(i);
            particleUvArray[i * 2 + 1] = sourceUvs.getY(i);
        }

        particleGeometry.setAttribute(
            "aIntensity",
            new THREE.InstancedBufferAttribute(intensityArray, 1)
        );

        particleGeometry.setAttribute(
            "aAngle",
            new THREE.InstancedBufferAttribute(angleArray, 1)
        )

        particleGeometry.setAttribute(
            "aParticleUv",
            new THREE.InstancedBufferAttribute(particleUvArray, 2)
        );

        const aIntensity = attribute("aIntensity", "float");
        const aAngle = attribute('aAngle', 'float');
        const aParticleUv = attribute("aParticleUv", "vec2");

        const pictureTextureNode = texture(this.experience.resources.hoverAnimationDogTexture, aParticleUv);
        const pictureIntensity = pictureTextureNode.r;

        const displacementSample = texture(displacement.texture, aParticleUv).r
        const displacementIntensity = smoothstep(0.1, 0.3, displacementSample)

        const displacementDirection = normalize(
            vec3(
                cos(aAngle).mul(0.2),
                sin(aAngle).mul(0.2),
                1.0
            )
        )

        const displacementOffset = displacementDirection
            .mul(displacementIntensity)
            .mul(3.0)
            .mul(aIntensity);

        const gray = pow(pictureIntensity, 2.0);
        const particleColor = vec3(gray);

        const distToCenter = length(uv().sub(vec2(0.5, 0.5)));
        const particleCircleAlpha = oneMinus(smoothstep(0.48, 0.5, distToCenter));
        const centerDistance = length(aParticleUv.sub(vec2(0.5, 0.5)));
        const revealProgress = float(0.3); // animate this
        const revealAlpha = oneMinus(smoothstep(this.STARTING_OPACITY.sub(0.15), this.STARTING_OPACITY, centerDistance));

        const circleAlpha = particleCircleAlpha
            .mul(revealAlpha)
            .mul(this.STARTING_OPACITY);

        const particleSize = float(0.08)
            .mul(pictureIntensity)
            .mul(aIntensity);

        const localQuad = vec3(
            positionLocal.x.mul(particleSize),
            positionLocal.y.mul(particleSize),
            positionLocal.z
        )

        const finalLocalPosition = localQuad.add(displacementOffset)

        const material = new MeshBasicNodeMaterial({
            transparent: true,
            depthWrite: false,
            side: THREE.DoubleSide
        });

        material.positionNode = finalLocalPosition;
        material.colorNode = particleColor;
        material.opacityNode = circleAlpha;

        const mesh = new THREE.InstancedMesh(particleGeometry, material, particleCount);

        const dummy = new THREE.Object3D();
        console.log(dummy.rotation)

        for (let i = 0; i < particleCount; i++) {
            dummy.position.set(
                sourcePositions.getX(i),
                sourcePositions.getY(i),
                sourcePositions.getZ(i)
            );

            dummy.rotation.set(0, 0, 0);
            dummy.scale.set(1, 1, 1);
            dummy.updateMatrix();

            mesh.setMatrixAt(i, dummy.matrix);
        }

        let targetRotationx = 0;
        let targetRotationy = 0;

        const update = () => {
            const tiltStrength = 0.05;
            // const differencey = ((displacement.screenCursor.y * tiltStrength) - targetRotationy);
            // const differencex = ((displacement.screenCursor.x * tiltStrength) - targetRotationx);
            // targetRotationx += differencex * 0.1;
            // targetRotationy += differencey * 0.1;
            // if (differencex <= 0.01) targetRotationx = displacement.screenCursor.x
            // if (differencey <= 0.01) targetRotationy = displacement.screenCursor.y

            targetRotationx = displacement.screenCursor.x * tiltStrength
            targetRotationy = displacement.screenCursor.y * tiltStrength

            mesh.rotation.y = targetRotationx;
            mesh.rotation.x = - targetRotationy;

            displacement.raycaster.setFromCamera(displacement.screenCursor, this.experience.view.camera)
            const intersections = displacement.raycaster.intersectObject(displacement.interactivePlane);

            if (intersections.length) {
                const hitUv = intersections[0].uv;

                displacement.canvasCursor.x = hitUv.x * displacement.canvas.width
                displacement.canvasCursor.y = hitUv.y * displacement.canvas.height

                const glowSize = displacement.canvas.width * 0.15

                displacement.context.globalCompositeOperation = 'lighten'
                displacement.context.globalAlpha = 1
                displacement.context.drawImage(
                    displacement.glowImage,
                    displacement.canvasCursor.x - glowSize * 0.5,
                    displacement.canvas.height - displacement.canvasCursor.y - glowSize * 0.5,
                    glowSize,
                    glowSize
                )
            }

            displacement.context.globalCompositeOperation = 'source-over'
            displacement.context.globalAlpha = 0.02
            displacement.context.fillRect(0, 0, displacement.canvas.width, displacement.canvas.height)

            displacement.texture.needsUpdate = true
        }

        this.experience.setGlobalAnimation.addCallbacks(
            'CursorAnimation',
            [
                async () => {
                    this.experience.updatePageProgress('CursorAnimation')
                    await this.experience.transitionTextContent(this.experience.pageText.CursorAnimation)

                    gsap.to(this.STARTING_OPACITY, {
                        value: 1,
                    })

                    // gsap.killTweensOf(this.experience.view.camera)
                    gsap.to(this.experience.view.camera.position, {
                        x: 0,
                        y: 0,
                        z: 30,
                    })

                    gsap.to(this.experience.cursorPage, {
                        xPercent: 0, 
                        ease: 'bounce.out',
                        duration: 1.5
                    })
                    this.experience.topBubblePage.unshift('cursor-page')

                    mesh.instanceMatrix.needsUpdate = true;
                    if (!mesh.parent) {
                        this.experience.scene.add(mesh);
                    }

                    this.experience.ticker.events.on('tick', update)
                },
                () => {
                    console.log('triggered')
                    gsap.to(document.body, {
                        '--bg-color': '#000',
                    }, "<")
                    gsap.to(this.experience.textSectionHeading, {
                        color: '#fff'
                    }, "<")
                    gsap.to(this.experience.textSectionDescription, {
                        color: '#fff'
                    }, "<")
                }
            ],
            [() => {

                gsap.killTweensOf(this.STARTING_OPACITY)
                return new Promise((resolve) => {
                    gsap.to(this.STARTING_OPACITY, {
                        value: 0,
                        duration: 0.2,
                        onComplete: () => {
                            this.experience.ticker.events.off('tick', update)
                            this.experience.scene.remove(mesh)
                            resolve()
                        }
                    })
                })
            }]
        )
    }
}
