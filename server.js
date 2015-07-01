// variables.
var path = require('path')
	, express = require('express')
	, http = require('http')
	, app = express()
	, elasticsearch = require('elasticsearch');

// elastic search client.
var client = new elasticsearch.Client({
  host: '',
  log: 'trace'
});

var INDEX = 'coffee';

// simple helper to build the query portion
// of the elastic search search object.
var buildQuery = function(q, filter) {
	// with filter.
	if (!filter)
		return {match: {_all: q}};
	// without filter.
	return {
		filtered: {
			query: {match: {_all: q}},
			filter: {
				bool: {
					must: [{
						term: {Tags: filter}
					}]
				}
			}
		}
	};
};

// view engine config.
app.engine('jade', require('jade').__express);
app.set('view engine', 'jade');
app.set('port', (process.env.PORT || 5000));

// define application public directory.
publicDir = path.join(__dirname, 'public');

// application configuration.
app.use(express.static(publicDir));

// routing.
// index.html
app.get('/', function(req, res){
  app.render('index', function(err, html){
    res.send(html);
  });
});

// search request to elastic search.
app.get('/search', function(req, res) {
	var q, page, perPage, filter, sort, sortObj = {};
	
	q = req.query.q;
	page = req.query.page;
	perPage = req.query.perPage;
	filter = req.query.filter;
	sort = JSON.parse(req.query.sort);
	sortObj[sort.value] = sort.type;

	client.search({
	  index: INDEX,
		body: {
			query: buildQuery(q, filter),
			sort: [sortObj],
			from: page * perPage,
			size: perPage,
			aggs: {
				tags: {
					terms: {field: 'Tags'}
				}
			},
			highlight: {
				pre_tags : ['<span class="highlight">'],
      	post_tags : ['</span>'],
				fields: {
					'Title': {number_of_fragments: 0},
					'Body': {number_of_fragments: 0}
				}
			}
		}	
	}).then(function (resp) {
	  res.json(resp);
	}, function (err) {
	  res.status(500).json({});
	});
});

// get suggestions from elastic search.
app.get('/suggestions', function(req, res) {
	var q = req.query.q;

	client.search({
	  index: INDEX,
		body: {
			suggest : {
		    text : q,
		    simple_phrase : {
		      phrase : {
		        field : 'Body',
		        direct_generator: [{
		          field : 'Body',
		          suggest_mode : 'always',
		          min_word_length : 3,
		          prefix_length: 2
		        }]
		      }
		    }
		  }
		}
	}).then(function (resp) {
	  res.json(resp);
	}, function (err) {
	  res.status(500).json({});
	});
});

// server.
http.createServer(app).listen(app.get('port'));
