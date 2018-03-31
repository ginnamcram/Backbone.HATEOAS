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


export default {
    createLinkResolver:_createLinkResolver,
    resolveModelReference: _resolveModelReference,
    transformNested: _transformNested
};