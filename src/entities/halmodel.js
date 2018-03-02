import _ from 'underscore';

function _createLinkResolver(propertyName, url, model){
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
}

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

    parse(attributes) {
        attributes = attributes || {};
        this.links = attributes._links || {};
        delete attributes._links;
        this.embedded = attributes._embedded || {};
        delete attributes._embedded;
        return attributes;
    },
    fetchLink(propertyName){
      var value = this.links[propertyName]
      if(_.isUndefined( value ) ){
        throw 'link does not exist for property: ' + propertyName;
      }
      if(value.href.replace('{?projection}','') != this.url()){
        return _createLinkResolver(propertyName, value.href, this);
      }
      return null;
    },
    fetchLinks(){
      var linksToFetch = [];
      var me = this;
      _.each(this.links,function(value,name){
        if(value.href.replace('{?projection}','') != this.url()){
          linksToFetch.push( _createLinkResolver(name, value.href, this) );
        }
      },this);
      return Promise.all(linksToFetch);
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
    makeNew(){
      this.unset(this.idAttribute, {silent:true});
      this.removeLink('self');
    },
    /**
    * transform the objects of the given path to HAL objetcs
    * @param propertyPath - path of the property as string. e.g employee.department
    *                       can also entire arrays
    * @param modelClass - Classname of the Model as string
    */
    transform( propertyPath, modelClass ){
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

export default Model;