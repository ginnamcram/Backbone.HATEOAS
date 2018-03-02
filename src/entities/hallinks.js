
let Links = {
    embedded:{},
    links:{},
    getEmbedded() {
        return this.embedded;
    },
    getLinks() {
        return this.links;
    },
    getLink(rel) {
        let found;
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
    removeLink(rel){
      let found;
      if (_.isArray(this.links)) {
          this.links = _.reject(this.links, function(link){ return link.rel == rel; });
      } else if (!_.isUndefined(this.links[rel])) {
          delete this.links[rel];
      }
    }
};

export default Links;