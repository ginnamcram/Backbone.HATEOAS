'use strict';
(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define(['underscore', 'backbone'], factory);
    } else if (typeof module === 'object' && module.exports) {
        module.exports = factory(require('underscore'), require('backbone'));
    } else {
        root.Backbone.HAL = factory(root._, root.Backbone);
    }
})(this, function (_, Backbone) {
    var Links = {
        embedded:{},
        links:{},
        getEmbedded: function () {
            return this.embedded;
        },
        getLinks: function () {
            return this.links;
        },
        getLink: function (rel) {
            var found;
            if (_.isArray(this.links)) {
                found = _.where(this.links, {
                    rel: rel
                });
                if (found.length === 1) {
                    found = found[0];
                }
            } else if (!_.isUndefined(this.links[rel])) {
                found = this.links[rel];
            }
            return found;
        },
        removeLink:function(rel){
          var found;
          if (_.isArray(this.links)) {
              this.links = _.reject(this.links, function(link){ return link.rel == rel; });
          } else if (!_.isUndefined(this.links[rel])) {
              delete this.links[rel];
          }
        }
    };

    function _resolveModelReference(arg){
      if(_.isArray(arg)){
        return _.map(arg, _resolveModelReference);
      }else if(_.isDate(arg)){
        return arg.toJSON();
      }else if(_.isObject(arg)){
        if(_.has(arg,'cid')){
          return arg.url();
        }else{
          //map each property of the object
          return _.mapObject(arg, _resolveModelReference);
        }
      }
      return arg;
    }

    function _transformNested( arg, parts, clazz ){
      if(parts.length > 0){
        //step into
        var nextProperty = parts.splice(0,1);

        if( _.isArray(arg[nextProperty]) ){
          arg[nextProperty] = _.map(arg[nextProperty], function(item){
            return _transformNested( item, parts, clazz);
          });
        }else if( _.isObject(arg[nextProperty]) ){
          arg[nextProperty] = _transformNested( arg[nextProperty], parts, clazz);
        }
        return arg;
      }else{
        //transform
        if( _.isObject(arg) && !_.isArray(arg) && !_.has(arg,'cid')){
          return new clazz(arg);
        }
        return arg;
      }
    }

    var Model = Backbone.Model.extend(_.extend({

        parse: function (attributes) {
            attributes = attributes || {};
            this.links = attributes._links || {};
            delete attributes._links;
            this.embedded = attributes._embedded || {};
            delete attributes._embedded;
            return attributes;
        },
        fetchLink:function(propertyName){
          var value = this.links[propertyName]
          if(_.isUndefined( value ) ){
            throw 'link does not exist for property: ' + propertyName;
          }
          if(value.href.replace('{?projection}','') != this.url()){
            return this._createLinkResolver(propertyName, value.href, this);
          }
          return null;
        },
        fetchLinks:function(){
          var linksToFetch = [];
          var me = this;
          _.each(this.links,function(value,name){
            if(value.href.replace('{?projection}','') != this.url()){
              linksToFetch.push( this._createLinkResolver(name, value.href, this) );
            }
          },this);
          return Promise.all(linksToFetch);
        },
        _createLinkResolver:function(propertyName, url, model){
          return new Promise(function(success, error){
            Backbone.ajax({
              url: url,
              success: function(json){
                var data = json;
                if(_.has(json, '_embedded') ){
                  data = json._embedded;
                }
                //test if there is a representation
                var def = _.findWhere(model._descriptor.descriptors, {name: propertyName });
                if( def && _.has(def,'rt') ){
                  var clazz = Backbone.HAL.registry[def.rt];
                  //transform embedded clazz
                  data = data[clazz._name];
                  if( _.isArray(data) ){
                    data = _.map(data, function(v){
                      return new clazz(v, {parse: true });
                    });
                  }else{
                    data = new clazz(json, {parse: true });
                  }
                }

                model.set(propertyName, data);
                success({model:model, propertyName: propertyName});
              },
              error: function(xhr,response){
                if(xhr.status == 404){
                  //can be a empty resource if value is not set
                  success();
                }else{
                  error();
                }
              }
            });
          });
        },
        url: function () {
            var self = this.getLink('self');
            if (self) {
                return self.href;
            } else {
                return Model.__super__.url.call(this);
            }
        },
        isNew: function () {
            var self = this.getLink('self');
            if (self || this.id) {
                return false;
            } else {
                return true;
            }
        },
        makeNew:function(){
          this.unset(this.idAttribute, {silent:true});
          this.removeLink('self');
        },
        /**
        * transform the objects of the given path to HAL objetcs
        * @param propertyPath - path of the property as string. e.g employee.department
        *                       can also entire arrays
        * @param modelClass - Classname of the Model as string
        */
        transform:function( propertyPath, modelClass ){
          var Clazz;
          if(_.isString( modelClass )){
            Clazz = Backbone.HAL.namespace[modelClass];
            if(_.isUndefined( Clazz ) ){
              throw 'class ' + modelClass + ' is not registred in namespace';
            }
          }else{
            Clazz = modelClass;
          }
          _transformNested(this, propertyPath.split('.'), Clazz);
        },
        toJSON: function () {
            var links = this.getLinks(),
                embedded = this.getEmbedded(),
                cloned;

            cloned = _.clone(this.attributes);
            if (!_.isEmpty(embedded)) {
                //cloned._embedded = embedded;
            }
            if (!_.isEmpty(links)) {
                //cloned._links = links;
            }
            return _.mapObject(cloned, _resolveModelReference);
            //return links to subresources instead of objects
            for (var field in cloned) {
              var value = cloned[field];
              if(_.isArray(value)){
                cloned[field] = _.map(value, function(valueItem){
                  return _.has(valueItem,'cid')?valueItem.url():valueItem;
                });
              }else{
                if(_.has(value,'cid')){
                  cloned[field] = value.url();
                }
              }
            }
            return cloned;
        }

    }, Links));

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

    _.mixin({
      capitalize: function(string) {
        return string.charAt(0).toUpperCase() + string.substring(1).toLowerCase();
      },
      capitalizeName: function(string) {
        var parts = _.map(string.split('-'), function(part){
          return _(part).capitalize();
        });
        return parts.join('');
      },
      uncapitalize: function(string) {
        return string.charAt(0).toLowerCase() + string.substring(1);
      },
      uncapitalizeName: function(string) {
        var parts = _.map(string.split('-'), function(part){
          return _(part).capitalize();
        });
        return _(parts.join('')).uncapitalize();
      }
    });

    // stores the additional class properties added
    // with Backbone.HAL.extend for a HAL model or collection
    var _predefinedClasses = {};

    //main factory
    Backbone.HAL = {
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
                protoProps.defaults[prop.name] = '';
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
    return Backbone.HAL;
});
