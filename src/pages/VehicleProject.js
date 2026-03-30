import Experience from '../Experience';
import gsap from 'gsap';

export default class VehicleProject {
    constructor() {
        this.experience = Experience.getInstance();
        this.projectUrl = '/car-project/index.html';
        this.isActive = false;
        this.experience.setGlobalAnimation.addPageObject('VehicleProject')

        this.setDOM();
        this.setCallbacks();
    }

    setDOM() {
        this.container = document.createElement('div');
        this.container.className = 'project-frame';

        this.iframe = document.createElement('iframe');
        this.iframe.className = 'project-frame__iframe';
        this.iframe.title = 'Car Project';
        this.iframe.setAttribute('allow', 'fullscreen');
        this.iframe.setAttribute('tabindex', '0');

        this.iframe.addEventListener('load', () => {
            this.experience.cursorTarget.attachIframe(this.iframe);
            this.focusProject();
        });

        this.container.addEventListener('pointerdown', () => {
            this.focusProject();
        });

        this.container.appendChild(this.iframe);
        this.experience.domElement.appendChild(this.container);
    }

    setCallbacks() {
        this.experience.setGlobalAnimation.addCallbacks(
            'VehicleProject',
            [
                async () => {
                    this.prepareMount();
                    this.experience.updatePageProgress('VehicleProject')
                    await this.experience.transitionTextContent(this.experience.pageText.VehicleProject)

                    await new Promise((resolve) => gsap.to(document.body, {
                        '--bg-color': '#050505',
                        duration: 0.35,
                        onComplete: resolve
                    }));

                    gsap.to(this.experience.textSectionHeading, {
                        color: '#fff',
                    }, '<');

                    gsap.to(this.experience.textSectionDescription, {
                        color: '#fff',
                    }, '<');

                    gsap.to(this.experience.view.camera.position, {
                        x: 0,
                        y: 0,
                        z: 30,
                    });

                    this.mount();
                    this.experience.rendering.pause();
                }
            ],
            [
                () => {
                    return new Promise((resolve) => {
                        this.unmount();
                        resolve();
                    });
                }
            ]
        );
    }

    prepareMount() {
        if (this.iframe.src !== this.projectUrl) {
            this.iframe.src = this.projectUrl;
        }
    }

    mount() {
        if (this.isActive) {
            return;
        }

        this.container.classList.add('is-active');
        this.isActive = true;
        requestAnimationFrame(() => {
            this.focusProject();
        });
    }

    unmount() {
        if (!this.isActive) {
            return;
        }

        this.container.classList.remove('is-active');
        this.experience.cursorTarget.detachIframe();
        this.iframe.src = 'about:blank';
        this.isActive = false;
        this.experience.rendering.resume();
    }

    focusProject() {
        this.iframe.focus();
        this.iframe.contentWindow?.focus?.();
    }
}
