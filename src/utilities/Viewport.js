import Events from "./Events.js";

export default class Viewport
{
    constructor(domElement)
    {
        this.domElement = domElement;
        
        this.events = new Events();
        
        this.measure();
        this.setResize();
    }

    measure()
    {
        const bounding = this.domElement.getBoundingClientRect();

        this.width = bounding.width;
        this.height = bounding.height;
        this.ratio = this.width / this.height;

        this.pixelRatioRaw = window.devicePixelRatio;
        this.pixelRatioMax = 2;
        this.pixelRatio = Math.min(this.pixelRatioRaw, this.pixelRatioMax);
    }

    setResize()
    {
        addEventListener('resize', () => 
        {
            this.measure()
            this.events.trigger('resize', [ this.width, this.height ]);
        })
    }
}