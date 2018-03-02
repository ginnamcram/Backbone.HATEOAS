import _ from 'underscore';

_.mixin({
    capitalize(string) {
      return string.charAt(0).toUpperCase() + string.substring(1).toLowerCase();
    },

    capitalizeName(string) {
      var parts = _.map(string.split('-'), function(part){
        return _(part).capitalize();
      });
      return parts.join('');
    },

    uncapitalize(string) {
      return string.charAt(0).toLowerCase() + string.substring(1);
    },

    uncapitalizeName(string) {
      var parts = _.map(string.split('-'), function(part){
        return _(part).capitalize();
      });
      return _(parts.join('')).uncapitalize();
    }
});

export default _;