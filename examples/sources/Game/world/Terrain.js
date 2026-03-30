import * as THREE from 'three/webgpu';
import { Brush, Evaluator, SUBTRACTION } from 'three-bvh-csg';
import { Fn, color, float, positionLocal, mix, uniform, vec2, vec3, vec4, sin } from 'three/tsl'

import { Game } from '../Game';

const permute = Fn(([x_immutable]) => {
    const x = vec3(x_immutable).toVar()

    return x.mul(44.0).add(1.0).mul(x).mod(299.0)
})

const simplexNoise2d = Fn(([v_immutable]) => {
    const v = vec2(v_immutable).toVar()
    const C = vec4(
        0.211324865405187,
        0.366025403784439,
        -0.577350269189626,
        0.024390243902439
    )

    const i = v.add(v.dot(C.yy)).floor().toVar()
    const x0 = v.sub(i).add(i.dot(C.xx)).toVar()

    const isXGreater = x0.x.greaterThan(x0.y).toVar()
    const i1 = vec2(
        isXGreater.select(1.0, 0.0),
        isXGreater.select(0.0, 1.0)
    ).toVar()

    const x12 = x0.xyxy.add(C.xxzz).toVar()
    x12.xy.subAssign(i1)

    i.assign(i.mod(299.0))

    const p = permute(
        permute(i.y.add(vec3(0.0, i1.y, 1.0)))
            .add(i.x)
            .add(vec3(0.0, i1.x, 1.0))
    ).toVar()

    const m = vec3(
        x0.dot(x0),
        x12.xy.dot(x12.xy),
        x12.zw.dot(x12.zw)
    ).mul(-1.0).add(0.5).max(0.0).toVar()

    m.mulAssign(m)
    m.mulAssign(m)

    const x = p.mul(C.www).fract().mul(2.0).sub(1.0).toVar()
    const h = x.abs().sub(0.5).toVar()
    const ox = x.add(0.5).floor().toVar()
    const a0 = x.sub(ox).toVar()

    m.mulAssign(
        float(1.79284291400159).sub(
            float(0.85373472095314).mul(
                a0.mul(a0).add(h.mul(h))
            )
        )
    )

    const g = vec3().toVar()
    g.x.assign(a0.x.mul(x0.x).add(h.x.mul(x0.y)))
    g.yz.assign(a0.yz.mul(x12.xz).add(h.yz.mul(x12.yw)))

    return float(130.0).mul(m.dot(g))
})

const SIMPLEX_GRADIENTS_2D = [
    [1, 1],
    [-1, 1],
    [1, -1],
    [-1, -1],
    [1, 0],
    [-1, 0],
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    [0, 1],
    [0, -1]
]

const SIMPLEX_PERMUTATION = [
    151, 160, 137, 91, 90, 15, 131, 13, 201, 95, 96, 53, 194, 233, 7, 225,
    140, 36, 103, 30, 69, 142, 8, 99, 37, 240, 21, 10, 23, 190, 6, 148, 247,
    120, 234, 75, 0, 26, 197, 62, 94, 252, 219, 203, 117, 35, 11, 32, 57, 177,
    33, 88, 237, 149, 56, 87, 174, 20, 125, 136, 171, 168, 68, 175, 74, 165,
    71, 134, 139, 48, 27, 166, 77, 146, 158, 231, 83, 111, 229, 122, 60, 211,
    133, 230, 220, 105, 92, 41, 55, 46, 245, 40, 244, 102, 143, 54, 65, 25,
    63, 161, 1, 216, 80, 73, 209, 76, 132, 187, 208, 89, 18, 169, 200, 196,
    135, 130, 116, 188, 159, 86, 164, 100, 109, 198, 173, 186, 3, 64, 52, 217,
    226, 250, 124, 123, 5, 202, 38, 147, 118, 126, 255, 82, 85, 212, 207, 206,
    59, 227, 47, 16, 58, 17, 182, 189, 28, 42, 223, 183, 170, 213, 119, 248,
    152, 2, 44, 154, 163, 70, 221, 153, 101, 155, 167, 43, 172, 9, 129, 22,
    39, 253, 19, 98, 108, 110, 79, 113, 224, 232, 178, 185, 112, 104, 218, 246,
    97, 228, 251, 34, 242, 193, 238, 210, 144, 12, 191, 179, 162, 241, 81, 51,
    145, 235, 249, 14, 239, 107, 49, 192, 214, 31, 181, 199, 106, 157, 184, 84,
    204, 176, 115, 121, 50, 45, 127, 4, 150, 254, 138, 236, 205, 93, 222, 114,
    67, 29, 24, 72, 243, 141, 128, 195, 78, 66, 215, 61, 156, 180
]

const SIMPLEX_PERMUTATION_TABLE = new Array(512)

for (let i = 0; i < 512; i++)
    SIMPLEX_PERMUTATION_TABLE[i] = SIMPLEX_PERMUTATION[i & 255]

export class Terrain {
    constructor() {
        this.game = Game.getInstance()
        this.container = new THREE.Object3D()
        this.boardSize = 11
        this.boardHeight = 4
        this.boardWallThickness = 0.5
        this.positionFrequency = 0.21
        this.strength = 1.3
        this.warpFrequency = 5.1
        this.warpStrength = 0.457
        this.grassNoiseFrequency = 0.085
        this.grassMaskThreshold = 0.37
        this.grassThresholdBlendRange = 0.05
        this.grassHeightMin = 1.21
        this.grassHeightMax = 2.39

        this.setBoard()
        // this.setTerrainPlane()

        this.container.position.y += 1.2
        this.container.position.x += 10

        // this.setDebug();
    }

    setBoard() {
        const boardFill = new Brush(new THREE.BoxGeometry(this.boardSize, this.boardHeight, this.boardSize))
        const boardHole = new Brush(new THREE.BoxGeometry(10, 4.1, 10))
        // boardHole.position.y = 0.2
        // boardHole.updateMatrixWorld()

        const evaluator = new Evaluator()
        const board = evaluator.evaluate(boardFill, boardHole, SUBTRACTION)
        // board.castShadow = true;
        board.receiveShadow = true;
        board.geometry.clearGroups();
        board.material = new THREE.MeshStandardMaterial({
            color: 'white',
            metalness: 0,
            roughness: 0.3,
            transparent: true,
            opacity: 0.5,
        })

        this.container.add(board)

        this.board = board;
    }

    setTerrainPlane() {
        const geometry = new THREE.PlaneGeometry(10, 10, 500, 500)
        geometry.rotateX(-Math.PI / 2)

        const uPositionFrequency = uniform(float(this.positionFrequency))
        const uStrength = uniform(float(this.strength))
        const uWarpFrequency = uniform(float(this.warpFrequency))
        const uWarpStrength = uniform(float(this.warpStrength))
        const uTime = uniform(float(0.0))
        const uColorWaterDeep = uniform(color('#002b3d'))
        const uColorWaterSurface = uniform(color('#66a8ff'))
        const uColorSand = uniform(color('#ffe894'))
        const uColorGrass = uniform(color('#85d534'))
        const uColorSnow = uniform(color('#ffffff'))
        const uColorRock = uniform(color('#bfbd8d'))

        this.uPositionFrequency = uPositionFrequency
        this.uStrength = uStrength
        this.uWarpFrequency = uWarpFrequency
        this.uWarpStrength = uWarpStrength

        // console.log(uStrength)

        const material = new THREE.MeshStandardNodeMaterial({
            metalness: 0,
            roughness: 0.5,
        })

        const getElevation = Fn(([position_immutable]) => {
            const position = vec2(position_immutable).toVar()
            const warpedPosition = vec2(position).toVar()
            warpedPosition.x.addAssign(uTime.mul(0.2))
            warpedPosition.y.addAssign(uTime.mul(0.2))
            const elevation = float(0).toVar()

            warpedPosition.addAssign(simplexNoise2d(warpedPosition.mul(uPositionFrequency).mul(uWarpFrequency)).mul(uWarpStrength))

            elevation.addAssign(simplexNoise2d(warpedPosition.mul(uPositionFrequency)))
            elevation.addAssign(simplexNoise2d(warpedPosition.mul(uPositionFrequency).mul(2.0)).div(4.0))
            elevation.addAssign(simplexNoise2d(warpedPosition.mul(uPositionFrequency).mul(4.0)).div(8.0))

            const elevationSign = elevation.sign()
            elevation.assign(elevation.abs().pow(3.0).mul(elevationSign))
            elevation.mulAssign(uStrength);

            return elevation
        })

        const getTerrainPosition = Fn(([basePosition_immutable]) => {
            const pos = vec3(basePosition_immutable).toVar()
            const elevation = getElevation(pos.xz).toVar()

            pos.y.addAssign(elevation)

            return pos
        })

        const getNormalNode = Fn(([position_immutable]) => {
            const shift = float(0.01)
            const position = vec3(position_immutable).toVar()

            const center = getTerrainPosition(position).toVar()

            const positionA = getTerrainPosition(
                position.add(vec3(shift, 0.0, 0.0))
            ).toVar()

            const positionB = getTerrainPosition(
                position.add(vec3(0.0, 0.0, shift.negate()))
            ).toVar()

            const toA = positionA.sub(center).normalize()
            const toB = positionB.sub(center).normalize()

            return toA.cross(toB).normalize()
        })

        material.colorNode = Fn(() => {
            const terrainPosition = getTerrainPosition(positionLocal).toVar()
            terrainPosition.xz.addAssign(uTime.mul(0.2))

            // Water Mix
            const surfaceWaterMix = terrainPosition.y.smoothstep(-1.0, -0.1)
            const color = mix(uColorWaterDeep, uColorWaterSurface, surfaceWaterMix).toVar()

            // Sand Mix
            const sandMix = terrainPosition.y.step(-0.1);
            color.assign(mix(color, uColorSand, sandMix))

            // Grass
            const grassMix = terrainPosition.y.step(-0.06)
            color.assign(mix(color, uColorGrass, grassMix))

            // Stone
            const normal = getNormalNode(positionLocal)
            const upDot = normal.dot(vec3(0.0, 1.0, 0.0))
            const rockMix = float(upDot)
            rockMix.assign(float(1.0).sub(rockMix.step(0.8)))
            rockMix.mulAssign(terrainPosition.y.step(-0.06))
            color.assign(mix(color, uColorRock, rockMix))

            // Snow
            const snowThreshold = float(0.95).toVar()
            snowThreshold.addAssign(simplexNoise2d(terrainPosition.xz.mul(15.0)).div(5))
            const snowMix = terrainPosition.y.step(snowThreshold)
            color.assign(mix(color, uColorSnow, snowMix))

            return color
        })()

        material.positionNode = Fn(() => {
            return getTerrainPosition(positionLocal)
        })()

        material.normalNode = Fn(() => {
            const normal = getNormalNode(positionLocal)

            return normal;
        })()

        const terrain = new THREE.Mesh(geometry, material)
        terrain.position.y += 0.3;
        terrain.castShadow = true;
        terrain.receiveShadow = true;
        this.container.add(terrain)

        if (this.game.debug.active) {
            this.debugPanel = this.game.debug.panel.addFolder({
                title: 'Terrain',
                expanded: false,
            })

            this.debugPanel.addBinding(uPositionFrequency, 'value', { label: 'uPositionFrequency', min: 0, max: 1, step: 0.001 })
                .on('change', () => this.game.grass?.rebuild(true))
            this.debugPanel.addBinding(uStrength, 'value', { label: 'uStrength', min: 0, max: 10, step: 0.001 })
                .on('change', () => this.game.grass?.rebuild(true))
            this.debugPanel.addBinding(uWarpFrequency, 'value', { label: 'uWarpFrequency', min: 0, max: 10, step: 0.001 })
                .on('change', () => this.game.grass?.rebuild(true))
            this.debugPanel.addBinding(uWarpStrength, 'value', { label: 'uWarpStrength', min: 0, max: 1, step: 0.001 })
                .on('change', () => this.game.grass?.rebuild(true))
            this.debugPanel.addBinding(this, 'grassNoiseFrequency', { min: 0.01, max: 1, step: 0.001 })
                .on('change', () => this.game.grass?.rebuild(true))
            this.debugPanel.addBinding(this, 'grassMaskThreshold', { min: 0, max: 1, step: 0.001 })
                .on('change', () => this.game.grass?.rebuild(true))
            this.debugPanel.addBinding(this, 'grassThresholdBlendRange', { min: 0.001, max: 0.2, step: 0.001 })
                .on('change', () => this.game.grass?.rebuild(true))
            this.debugPanel.addBinding(this, 'grassHeightMin', { min: 0, max: 3, step: 0.01 })
                .on('change', () => this.game.grass?.rebuild(true))
            this.debugPanel.addBinding(this, 'grassHeightMax', { min: 0, max: 4, step: 0.01 })
                .on('change', () => this.game.grass?.rebuild(true))
            this.game.debug.addThreeColorBinding(this.debugPanel, uColorWaterDeep.value, 'waterDeep')
            this.game.debug.addThreeColorBinding(this.debugPanel, uColorWaterSurface.value, 'waterSurface')
            this.game.debug.addThreeColorBinding(this.debugPanel, uColorSand.value, 'sand')
            this.game.debug.addThreeColorBinding(this.debugPanel, uColorGrass.value, 'grass')
            this.game.debug.addThreeColorBinding(this.debugPanel, uColorRock.value, 'rock')
            this.game.debug.addThreeColorBinding(this.debugPanel, uColorSnow.value, 'snow')
        }

        this.game.ticker.events.on('tick', () => uTime.value = this.game.ticker.elapsed, 1)

        const water = new THREE.Mesh(
            new THREE.PlaneGeometry(10, 10, 1, 1),
            new THREE.MeshPhysicalMaterial({
                transmission: 1,
                roughness: 0.3
            })
        )
        water.rotation.x = - Math.PI * 0.5
        water.position.y += 0.2
        this.container.add(water)

    }

    simplexNoise2D(x, y) {
        const skewFactor = 0.5 * (Math.sqrt(3) - 1)
        const unskewFactor = (3 - Math.sqrt(3)) / 6
        const skew = (x + y) * skewFactor
        const cellX = Math.floor(x + skew)
        const cellY = Math.floor(y + skew)
        const unskew = (cellX + cellY) * unskewFactor
        const x0 = x - (cellX - unskew)
        const y0 = y - (cellY - unskew)
        const offsetX = x0 > y0 ? 1 : 0
        const offsetY = x0 > y0 ? 0 : 1
        const x1 = x0 - offsetX + unskewFactor
        const y1 = y0 - offsetY + unskewFactor
        const x2 = x0 - 1 + 2 * unskewFactor
        const y2 = y0 - 1 + 2 * unskewFactor
        const ii = cellX & 255
        const jj = cellY & 255
        const gi0 = SIMPLEX_PERMUTATION_TABLE[ii + SIMPLEX_PERMUTATION_TABLE[jj]] % 12
        const gi1 = SIMPLEX_PERMUTATION_TABLE[ii + offsetX + SIMPLEX_PERMUTATION_TABLE[jj + offsetY]] % 12
        const gi2 = SIMPLEX_PERMUTATION_TABLE[ii + 1 + SIMPLEX_PERMUTATION_TABLE[jj + 1]] % 12

        const contribution = (tx, ty, gradientIndex) => {
            let attenuation = 0.5 - tx * tx - ty * ty

            if (attenuation < 0)
                return 0

            attenuation *= attenuation
            const gradient = SIMPLEX_GRADIENTS_2D[gradientIndex]

            return attenuation * attenuation * (gradient[0] * tx + gradient[1] * ty)
        }

        return 70 * (
            contribution(x0, y0, gi0) +
            contribution(x1, y1, gi1) +
            contribution(x2, y2, gi2)
        )
    }

    grassHash(x, z, seed = 0) {
        const value = Math.sin(x * 127.1 + z * 311.7 + seed * 74.7) * 43758.5453123
        return value - Math.floor(value)
    }

    getLocalElevation(x, z, time = 0) {
        const positionFrequency = this.uPositionFrequency?.value ?? this.positionFrequency
        const warpFrequency = this.uWarpFrequency?.value ?? this.warpFrequency
        const warpStrength = this.uWarpStrength?.value ?? this.warpStrength
        const strength = this.uStrength?.value ?? this.strength
        let warpedX = x + time * 0.2
        let warpedZ = z + time * 0.2

        const warp = this.simplexNoise2D(
            warpedX * positionFrequency * warpFrequency,
            warpedZ * positionFrequency * warpFrequency
        ) * warpStrength

        warpedX += warp
        warpedZ += warp

        let elevation = 0
        elevation += this.simplexNoise2D(warpedX * positionFrequency, warpedZ * positionFrequency)
        elevation += this.simplexNoise2D(warpedX * positionFrequency * 2, warpedZ * positionFrequency * 2) / 4
        elevation += this.simplexNoise2D(warpedX * positionFrequency * 4, warpedZ * positionFrequency * 4) / 8

        const elevationSign = Math.sign(elevation) || 1
        return Math.pow(Math.abs(elevation), 3) * elevationSign * strength
    }

    getWorldElevation(x, z, time = 0) {
        const localX = x - this.container.position.x
        const localZ = z - this.container.position.z
        return this.container.position.y + 0.3 + this.getLocalElevation(localX, localZ, time)
    }

    getGrassSample(x, z) {
        const localX = x - this.container.position.x
        const localZ = z - this.container.position.z
        let rawNoise = this.simplexNoise2D(localX * this.grassNoiseFrequency, localZ * this.grassNoiseFrequency)
        rawNoise += this.simplexNoise2D(localX * this.grassNoiseFrequency * 2.0, localZ * this.grassNoiseFrequency * 2.0) / 4.0
        rawNoise += this.simplexNoise2D(localX * this.grassNoiseFrequency * 4.0, localZ * this.grassNoiseFrequency * 4.0) / 8.0
        const gradient = THREE.MathUtils.clamp(rawNoise * 0.5 + 0.5, 0, 1)
        const visible = gradient >= this.grassMaskThreshold
        const darkness = visible
            ? THREE.MathUtils.mapLinear(gradient, this.grassMaskThreshold, 1, 1, 0)
            : 0
        const thresholdBlend = visible
            ? THREE.MathUtils.smoothstep(
                gradient,
                this.grassMaskThreshold,
                this.grassMaskThreshold + this.grassThresholdBlendRange
            )
            : 0
        const heightScale = visible
            ? THREE.MathUtils.lerp(
                THREE.MathUtils.lerp(this.grassHeightMin, this.grassHeightMax, darkness) * 0.5,
                THREE.MathUtils.lerp(this.grassHeightMin, this.grassHeightMax, darkness),
                thresholdBlend
            )
            : 0
        const jitterStrength = THREE.MathUtils.lerp(0.4, 1.15, darkness)
        const offsetX = (this.grassHash(localX, localZ, 1) - 0.5) * jitterStrength
        const offsetZ = (this.grassHash(localX, localZ, 2) - 0.5) * jitterStrength
        const scaleMix = this.grassHash(localX, localZ, 3)
        const phase = this.grassHash(localX, localZ, 4) * Math.PI * 2
        const rotationY = this.grassHash(localX, localZ, 5) * Math.PI / 3
        const wobbleStrength = 0.7 + gradient * 0.35 + this.grassHash(localX, localZ, 6) * 0.15
        const colorMix = THREE.MathUtils.clamp(
            1 - darkness * 0.75 + this.grassHash(localX, localZ, 7) * 0.08,
            0,
            1
        )

        return {
            visible,
            gradient,
            darkness,
            heightScale,
            offsetX,
            offsetZ,
            scaleMix,
            phase,
            rotationY,
            wobbleStrength,
            colorMix
        }
    }

    setDebug() {}
}
