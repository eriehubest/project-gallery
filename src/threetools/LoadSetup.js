import gsap from "gsap"
import Events from "../utilities/Events";

export default class LoadingSetup {
    constructor() {
        this.finishedLoading = false;
        this.events = new Events();

        this.realProgress = 0;

        this.init();

        // this.events.on('start', () => console.log('start'))
    }

    lerp(start, end, alpha) {
        return start + (end - start) * alpha;
    }

    init() {
        this.loadingPageDOM = document.querySelector('.loading-page')

        this.loadingTextElement = this.loadingPageDOM.querySelector('.loading-text')

        const text = "Demo Portfolio for All My WEBGL & JS Projects";
        this.chars = [...text];
        const container = document.getElementById("ring-text");
        this.elements = [];

        this.chars.forEach((char, i) => {
            const angle = (360 / this.chars.length) * i;

            const span = document.createElement("span");
            span.className = "char absolute left-1/2 top-1/2 text-lg font-semibold";
            span.style.setProperty("--angle", `${angle}deg`);
            span.textContent = char;

            container.appendChild(span);
            this.elements.push(span);
        });
    }

    async transformText(start, end) {
        const letters = 'abcdefghijklmnopqrstuvwxyz ABCDEFGHIJKLMNOPQRSTUVWXYZ '.split('');
        this.loadingTextElement.textContent = start;

        let left = 0;
        let right = end.length - 1;

        while (left <= right) {
            for (let i = 0; i < letters.length; i++) {
                let text = this.loadingTextElement.textContent;

                let chars = text.split('');

                if (chars[left] !== end[left]) {
                    chars[left] = letters[i];
                }

                if (left !== right && chars[right] !== end[right]) {
                    chars[right] = letters[i];
                }

                this.loadingTextElement.textContent = chars.join('');

                if (chars[left] === end[left] && (left === right || chars[right] === end[right])) {
                    break;
                }

                await new Promise(resolve => setTimeout(resolve, 10));
            }

            left++;
            right--;
        }
    }

    update(progress) {
        // const progress = this.lerp(this.realProgress, _progress, 0.1)
        // this.realProgress = progress;
        gsap.killTweensOf(this.loadingTextElement)
        gsap.to(
            this.loadingTextElement,
            {
                '--wipe': `${progress * 100}%`,
                duration: 1,

                onComplete: () => {
                    gsap.to(
                        this.loadingTextElement,
                        {
                            opacity: 1,
                            onComplete: () => {
                                this.transformText('Loading..', '  Enter  ')
                                this.finishedLoading = true;
                                this.start()
                            },
                        }
                    )
                }
            }
        )

        for (let i = 0; i < this.chars.length; i++) {
            const ratio = (i + 1) / this.chars.length;
            if (ratio >= progress)
                continue;

            gsap.set(this.elements[i], { transform: 'rotate(var(--angle) + var(--angle-base))) translate(280px) rotate(90deg)', })

            gsap.to(this.elements[i], {
                transform: 'rotate(calc(var(--angle) + var(--angle-base))) translate(300px) rotate(90deg)',
                opacity: 0,
                duration: 0.3,
                ease: "power2.out"
            });


        }
    }

    start() {
        addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                gsap.to(this.loadingPageDOM, {
                    opacity: 0,
                    onComplete: () => {
                        this.loadingPageDOM.classList.add('hidden')
                        this.events.trigger('start')
                    }
                })
            }
        })
    }
}
