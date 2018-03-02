var Collection = Backbone.Collection.extend(_.extend({
    constructor: function (models, options) {
        if (!_.isArray(models)) {
            models = this.parse(_.clone(models));
        }
        Collection.__super__.constructor.call(this, models, options);
    },
    parse: function (object) {
        object = object || {};
        this.links = object._links || {};
        delete object._links;
        this.embedded = object._embedded || {};
        delete object._embedded;
        this.attributes = object || {};
        if(this.model.clazz){
          return this.embedded[this._name];
        }
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
}, Links));