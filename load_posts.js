var fs, parser, elasticsearch, client;

fs = require('fs');
parser = require('xml2json');
elasticsearch = require('elasticsearch');

client = new elasticsearch.Client({
  host: '',
  log: 'trace'
});

fs.readFile('Posts.xml', {encoding: 'utf-8'}, function(err, data) {
  var json, bulkBody = [];
  
  json = parser.toJson(data, {
    object: true,
  });

  var splitTags = function(tags) {
    var strCommaDelimeted = tags.replace(/<|><|>/g, function(match) {
      if (match === '><')
        return ',';
      return '';
    });
    return strCommaDelimeted.split(',');
  };

  json.posts.row.forEach(function(post, index) {
    bulkBody.push({index: {_index: 'coffee', _type: 'posts', _id: post.Id}});
    post.Tags = post.Tags ? splitTags(post.Tags) : []; 
    bulkBody.push(post);
  });

  client.bulk({body: bulkBody}, function(err, resp) {
    
  });
});



