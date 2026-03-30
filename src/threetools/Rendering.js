import * as THREE from 'three/webgpu'

  import Experience from "../Experience";

  export default class Rendering {
      constructor() {
          this.experience = Experience.getInstance();
          this.isPaused = false;
      }

      start() {
          this.experience.ticker.events.on('tick', () => this.render(), 998);
          this.experience.viewport.events.on('resize', () => this.resize());
      }

      async setRenderer() {
          this.animationLoop = (elapsedTime) => this.experience.ticker.update(elapsedTime);

          this.renderer = new THREE.WebGPURenderer({
              canvas: this.experience.canvasElement,
              powerPreference: 'high-performance',
              forceWebGL: false,
              antialias: true
          });

          this.renderer.setSize(this.experience.viewport.width, this.experience.viewport.height);
          this.renderer.setPixelRatio(this.experience.viewport.pixelRatio);
          this.renderer.shadowMap.enabled = true;

          this.renderer.setAnimationLoop(this.animationLoop);

          await this.renderer.init();
      }

      resize() {
          this.renderer.setSize(this.experience.viewport.width, this.experience.viewport.height);
          this.renderer.setPixelRatio(this.experience.viewport.pixelRatio);
      }

      pause() {
          if (this.isPaused || !this.renderer) {
              return;
          }

          this.renderer.setAnimationLoop(null);
          this.isPaused = true;
      }

      resume() {
          if (!this.isPaused || !this.renderer) {
              return;
          }

          this.renderer.setAnimationLoop(this.animationLoop);
          this.isPaused = false;
      }

      async render() {
          if (!this.experience.view?.camera)
              return;

          this.renderer.render(this.experience.scene, this.experience.view.camera);
      }
  }
