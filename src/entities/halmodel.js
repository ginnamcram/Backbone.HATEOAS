import _ from 'underscore';
import helper from '../util/helper';


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
        return helper.createLinkResolver(propertyName, value.href, this);
      }
      return null;
    },
    fetchLinks(){
      var linksToFetch = [];
      var me = this;
      _.each(this.links,function(value,name){
        if(value.href.replace('{?projection}','') != this.url()){
          linksToFetch.push( helper.createLinkResolver(name, value.href, this) );
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
        return _.mapObject(cloned, helper.resolveModelReference);
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