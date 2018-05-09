import Backbone from  'backbone';
import Model from './entities/halmodel';
import Collection from './entities/halcollection';
import _ from './util/mixins';
// stores the additional class properties added
// with Backbone.HAL.extend for a HAL model or collection
var _predefinedClasses = {};

//main factory
Backbone.HAL = {
    //holds all registrated classes
    registry: {},
    _options:{
        url : '',
        hal : null,
        namespace: window //obj or string for model namespace
    },
    init:function(options){
        this._options = _.extend(this._options,options);
        var me = this;
        this.namespace = this._options == window?window:this._ensureNS(this._options.namespace);

        return new Promise(function(success,error){
            //get definition
            Backbone.ajax({
                url: me._options.url + '/profile',
                success: function(response){
                //create model per def
                var tmp = [];
                for (var resource in response._links) {
                    if(tmp != 'self')
                    tmp.push( me._fetchResourceDef(resource, response._links[resource].href) );
                }
                Promise.all(tmp).then(success).catch(error);
                },
                error:error
            });
        });
    },
    _ensureNS:function(ns){
        if(_.isObject( ns )){
            return ns;
        }
        //create namespace
        ns = ns.split('.');
        var currentNS = window;
        for (var i = 0; i < ns.length; i++) {
            if( !currentNS[ ns[i] ])
            currentNS[ ns[i] ] = {};
            currentNS = currentNS[ ns[i] ];
        }
        return currentNS;
    },
    _fetchResourceDef:function(name, url){
        var me = this;
        return new Promise(function(success,error){
            Backbone.ajax({
            url: url,
            success: function(response){
                var model = me.createModel(url,name,response);
                if(model) me.createCollection(url, name, model);
                success();
            },
            error: error
            });
        });
    },
    createModel:function(url, name, halDef){
        if(name == 'self') return false;
        var classname = _(name).capitalizeName();
        //find descriptor
        var descriptor;
        if(halDef.alps && _.isArray(halDef.alps.descriptors)){
            //find with id
            descriptor = _.find(halDef.alps.descriptors, function(desc){
            var n = ( _(name).uncapitalizeName() + '-representation');
            return desc.id == n;
            });
        }

        if(!descriptor){
            console.warn('descriptor not found for ' + classname);
            return;
        }

        if(this.namespace[classname]){
            console.warn('classname ' + classname + ' allready exists in namespace', this.namespace);
        }else{
            //load predefined contructor properties
            var predefinedProp = _predefinedClasses[classname];

            var protoProps = {
            _descriptor: descriptor,
            defaults:{},
            urlRoot: url.replace('/profile','')
            };
            //check if e predefined class exists
            if( _.has( predefinedProp, 'protoProps' ) ){
            _.extend(
                protoProps,
                predefinedProp.protoProps);
            }

            _.each(descriptor.descriptors,function(prop){
            if(prop.name == 'id') return;
            if(prop.type == 'SEMANTIC'){
                if( !_.has(protoProps.defaults, prop.name)){
                //set as property
                protoProps.defaults[prop.name] = null;
                }
            }
            if(prop.type == 'SAFE'){

                if( !_.has(protoProps.defaults, prop.name)){
                //set as property
                protoProps.defaults[prop.name] = null;
                }
                //TODO custom setter method fo add resources via url
                var funcName = 'get' + _(prop.name).capitalize();
                protoProps[ 'get' + _(prop.name).capitalize() ] = (function(prop){
                return function(){
                    var value = this.get(prop.name) || this.getEmbedded()[prop.name];
                    if(value){
                    if( _.isArray(value) ){
                        if( value.length && !_.has(value[0],'cid') ){
                        //transform to HAL Models + save
                        value = this.attributes[prop.name] = _.map(value,function(item){
                            return Backbone.HAL._mapClazz(item,prop);
                        });
                        }
                    }else{
                        if( !_.has(value,'cid') ){
                        //transform to HAL Model + save
                        value = this.attributes[prop.name] = Backbone.HAL._mapClazz(value, prop);
                        }
                    }
                    }
                    return value;
                };
                })(prop);
            }
            });

            var staticProps = {clazz:classname, _name:name};
            if(_.has( predefinedProp, 'staticProps' )){
            _.extend(
                staticProps,
                predefinedProp.staticProps);
            }

            //init class and register link
            var modelClazz = Model.extend( protoProps, staticProps );
            this.registry[ (url + '#' + descriptor.id) ] = modelClazz;
            return this.namespace[classname] = modelClazz;
        }
        return false;
    },
    createCollection:function(url, name, model){
        var classname = _(name).capitalizeName() + 's';
        url = url.replace('/profile','');

        //load predefined contructor properties
        var predefinedProp = _predefinedClasses[classname];

        var protoProps = {
            _name: name,
            model: model,
            url: url
        };
        //check if e predefined class exists
        if( _.has( predefinedProp, 'protoProps' ) ){
            _.extend(
            protoProps,
            predefinedProp.protoProps);
        }
        var staticProps = {};
        if(_.has( predefinedProp, 'staticProps' )){
            _.extend(
            staticProps,
            predefinedProp.staticProps);
        }

        return this.namespace[classname] = Collection.extend(protoProps, staticProps);
    },
    _mapClazz:function(value,prop){
        if( _.has(value,'cid') ) return value;
        //transform to HAL Model
        var clazz = Backbone.HAL.registry[prop.rt];
        if(clazz){
            //transform
            return new clazz(value);
        }else{
            console.warn('no representation found for ' + prop.rt);
        }
        return value;
    },
    extend:function(className, protoProps, staticProps ){
        _predefinedClasses[className] = {
            protoProps: protoProps,
            staticProps: staticProps
        };
    }
};

Backbone.HAL.Model = Model;
Backbone.HAL.Collection = Collection;
export default Backbone.HAL;