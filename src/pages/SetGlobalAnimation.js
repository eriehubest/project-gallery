import Experience from "../Experience";
import Events from "../utilities/Events";


export default class SetGlobalAnimation
{
    constructor( _startPage )
    {
        this.experience = Experience.getInstance();

        this.events = new Events();

        this.currentDisplay = null;
        this.pageCollection = new Set();
        this.availablePages = [];

        this.totalpages = 3;

        this.callbacks = {}
        
        this.addPageObject(_startPage)
        this.updatePageObject(_startPage)
    }

    addPageObject( _name )
    {
        this.pageCollection.add(_name)
        this.availablePages = Array.from(this.pageCollection)

        if (this.availablePages.length === this.totalpages)
            this.setGuideBar();
    }

    setGuideBar()
    {
        console.log('fully loaded')
    }

    updatePageObject( _name )
    {
        if (!this.pageCollection.has( _name ))
            console.warn('Page Name given doesn\'t exist')

        this.currentDisplay = _name;
        // console.log('Current page:', this.currentDisplay)
    }

    addCallbacks( _name, _onCallbacks = [], _offCallbacks = [], delayedCallbacks = [] )
    {
        for ( const callback of _onCallbacks )
        {
            this.events.on(`on${_name}`, callback )
        }

        for ( const callback of _offCallbacks )
        {
            this.events.on(`off${_name}`, callback)
        }

        return this;
    }

    async triggerCallback( _name, ON_OFF = true )
    {
        // true = ON, false = OFF

        if (_name !== this.currentDisplay)
            await this.events.trigger(`off${this.currentDisplay}`)

        this.currentDisplay = _name
        // console.log('Current page:', this.currentDisplay)

        await this.events.trigger(`on${_name}`)

        return this;
    }
}
