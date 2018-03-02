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