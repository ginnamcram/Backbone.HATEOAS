import _ from 'underscore';
import Backbone from  'backbone';
import Links from './hallinks';


var Collection = {
    constructor: function (models, options) {
        if (!_.isArray(models)) {
            models = this.parse(_.clone(models));
        }
        Collection.__super__.constructor.call(this, models, options);
    },
    parse: function (object) {
        object              = object || {};
        //copy references
        this.links          = object._links || {};
        this.embedded       = object._embedded || {};
        //remove links and embedded from message
        delete object._links;
        delete object._embedded;
        //now set attributes
        this.attributes     = object || {};
        //get items from hall response
        if(this.model.clazz){
          return this.embedded[this._name];
        }
        //default
        return this.embedded.items;
    },
    reset: function (obj, options) {
        options = options || {};
        if (!_.isArray(obj)) {
            obj = this.parse(_.clone(obj));
        }
        options.parse = false;
        return Collection.__super__.reset.call(this, obj, options);
    },
    url: function () {
        var self = this.getLink('self');
        if (self) {
            return self.href;
        } else {
            return Collection.__super__.url.call(this);
        }
    }
};
//add hall links
Collection = _.extend(Collection, Links);

Collection = Backbone.Collection.extend(Collection);

export default Collection;