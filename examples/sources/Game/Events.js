export class Events 
{
    constructor()
    {
        this.callbacks = {};
    }

    on(_name, _callback, _order = 1)
    {
        if ( !(this.callbacks[_name] instanceof Array) )
            this.callbacks[_name] = [];

        if ( !(this.callbacks[_name][_order] instanceof Array) )
            this.callbacks[_name][_order] = [];

        // Save Callback

        this.callbacks[_name][_order].push(_callback);

        return this;
    }

    off(_name, _callback = null)
    {
        if ( typeof _callback === 'function' )
        {
            for (const order in this.callbacks[_name])
            {
                const callbacks = this.callbacks[_name][order];

                const index = callbacks.indexOf(_callback);

                if (index !== -1)
                    callbacks.splice(index, 1);
            }
        }

        else 
        {
            if (this.callbacks[_name] instanceof Array)
                delete this.callbacks[_name];
        }

        return this;
    }

    trigger(_name, _args = []) 
    {
        if (this.callbacks[_name] instanceof Array)
        {
            for (const order in this.callbacks[_name])
            {
                for (const _callbackFunction of this.callbacks[_name][order])
                {
                    _callbackFunction.apply(this, _args);
                }
            }
        }

        return this;
    }
}