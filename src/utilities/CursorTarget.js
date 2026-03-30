import Experience from "../Experience";
import gsap from "gsap";

export default class CursorTarget
{
    constructor()
    {
        this.experience = Experience.getInstance();
        this.domElement = this.experience.domElement;
        this.activeIframeCleanup = null;

        this.cursorContainer = document.createElement('div');
        this.cursorContainer.className = 'cursor-target'

        this.focusHorizontalLeft = document.createElement('div');
        this.focusHorizontalLeft.className = 'focus-horizontal-left'
        this.focusHorizontalRight = document.createElement('div');
        this.focusHorizontalRight.className = 'focus-horizontal-right'
        this.focusVerticalTop = document.createElement('div');
        this.focusVerticalTop.className = 'focus-vertical-top'
        this.focusVerticalBottom = document.createElement('div');
        this.focusVerticalBottom.className = 'focus-vertical-bottom'

        this.centerBlockage = document.createElement('div');
        this.centerBlockage.className = 'center-blockage'
        this.centerVertical = document.createElement('div');
        this.centerVertical.className = 'center-vertical';
        this.centerHorizontal = document.createElement('div');
        this.centerHorizontal.className = 'center-horizontal';
        this.centerBlockage.appendChild(this.centerVertical)
        this.centerBlockage.appendChild(this.centerHorizontal)

        this.cursorContainer.appendChild(this.focusHorizontalLeft)
        this.cursorContainer.appendChild(this.focusHorizontalRight)
        this.cursorContainer.appendChild(this.focusVerticalTop)
        this.cursorContainer.appendChild(this.focusVerticalBottom)
        this.cursorContainer.appendChild(this.centerBlockage)

        this.main = document.querySelector('main')
        document.body.appendChild(this.cursorContainer)

        this.addListener();
    }


    addListener()
    {
        addEventListener('pointermove', (event) => {
            this.updatePosition(event.clientX, event.clientY);
        })
    }

    updatePosition(x, y)
    {
        gsap.killTweensOf(this.cursorContainer)

        gsap.to(this.cursorContainer, {
            '--cursor-x': `${x}px`,
            '--cursor-y': `${y}px`,
            duration: 0.1,
            overwrite: 'auto'
        })
    }

    attachIframe(iframe)
    {
        this.detachIframe()

        const frameWindow = iframe.contentWindow;
        const frameDocument = frameWindow?.document;

        if (!frameWindow || !frameDocument)
        {
            return;
        }

        const syncFromIframe = (event) =>
        {
            const bounds = iframe.getBoundingClientRect();
            this.updatePosition(bounds.left + event.clientX, bounds.top + event.clientY);
        };

        frameWindow.addEventListener('pointermove', syncFromIframe);
        frameDocument.addEventListener('pointermove', syncFromIframe);

        frameDocument.documentElement.style.cursor = 'none';
        frameDocument.body.style.cursor = 'none';

        this.activeIframeCleanup = () =>
        {
            frameWindow.removeEventListener('pointermove', syncFromIframe);
            frameDocument.removeEventListener('pointermove', syncFromIframe);
        };
    }

    detachIframe()
    {
        if (!this.activeIframeCleanup)
        {
            return;
        }

        this.activeIframeCleanup();
        this.activeIframeCleanup = null;
    }
}
