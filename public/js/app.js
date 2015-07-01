var app = angular.module('app', ['ngSanitize']);

app.run(['$rootScope', function($rootScope) {
	$rootScope.$safeApply = function($scope, fn) {
    var phase = $scope.$root.$$phase;
    if(phase == '$apply' || phase == '$digest') {
      if(fn && (typeof(fn) === 'function')) {
        fn();
      }
    } else { $scope.$apply(fn); }
  };
}]);

/**
 * Search Service.
 *
 * @void.
 */
app.controller('AppCtrl', ['$rootScope', '$scope', '$timeout', '$http', '$sce', '$document', 'searchService', 
	function($rootScope, $scope, $timeout, $http, $sce, $document, SearchService) {
	
	var selectedSort, page, perPage, pageRequest, selectedSuggestionIndex, search;

	selectedSort = {value: '_score', label: 'Relevancy', type: 'desc'};
	page = pageRequest = 0;
	perPage = 10;

	// $scope data.
	$scope.bucket = {
		q: '',
		lastQ: '',
		items: [],
		totalHits: 0,
		loader: false,
		options: [
			selectedSort,
			{value: 'ViewCount', label: 'Most Viewd', type: 'desc'}
		],
		selectedSort: selectedSort,
		filters: [],
		selectedFilter: undefined,
		showSummary: false,
		suggestions: []
	};

	// ref to the search input filed;
	search = document.forms[0].elements[0];
	
	/**
	 * form submit.
	 *
	 * @void.
	 */
	$scope.submit = function(e) {
		if (!$scope.bucket.q) // empty input field.
			return;
		if (selectedSuggestionIndex) // there is a selected suggestion index.
			return;
		resetAndSearch();
	};

	/**
	 * Handle filter/tag click.
	 *
	 * @void.
	 */
	$scope.onFilterClick = function(filter) {
		// same filter/tag.
		if (typeof $scope.bucket.selectedFilter !== 'undefined' && $scope.bucket.selectedFilter.key === filter.key)
			return;
		resetAndSearch(filter);
	};

	/**
	 * get the next set of results.
	 *
	 * @void.
	 */
	$scope.next = function() {
		pageRequest = page;
		pageRequest++;
		search($scope.bucket.selectedFilter);
	};

	/**
	 * check if we have another results page to load.
	 *
	 * @void.
	 */
	$scope.hasNext = function() {
		return ((page+1) * perPage) < $scope.bucket.totalHits;
	};

	/**
	 * Listen for the sort dropdown change event.
	 *
	 * @void.
	 */
	$scope.$watch('bucket.selectedSort', function(newVal, oldVal) {
		if(newVal === oldVal || !$scope.bucket.q)
			return;
		resetAndSearch($scope.bucket.selectedFilter);
	});

	/**
	 * Listen for the suggestions list.
	 *
	 * @void.
	 */
	$scope.$watch('bucket.suggestions', function(newVal, oldVal) {
		selectedSuggestionIndex = undefined;
	});

	/**
	 * Handle input field value changes.
	 *
	 * @void.
	 */
	$scope.onQChange = function(e) {
		if ($scope.bucket.q.length < 3) {
			$scope.bucket.suggestions = [];
			return;
		}
		getSuggestions($scope.bucket.q);
	};

	/**
	 * Handle document 'keyup' event.
	 *
	 * @void.
	 */
	$document.bind('keydown', function(e) {
		switch (e.keyCode) {
			case 13:
				$rootScope.$safeApply($scope, function() {
					handleEnterKeyup(e);
				});
				break;
			case 38:
				$rootScope.$safeApply($scope, function() {
					handleArrowUpKeyup(e);
				});
				break;
			case 40:
				$rootScope.$safeApply($scope, function() {
					handleArrowDownKeyup(e);
				});	
				break;
		}
	});

	/**
	 * check if the up arrow key was pressed,
	 * if so, we prevent from the cursor to
	 * jump to the start of the search input filed.
	 *
	 * @void.
	 */
	var checkIfUpArrowAndCancel = function(e) {
		if (e.keyCode === 38)
			e.preventDefault();
	};

	search.addEventListener('keydown', function(e) {
		checkIfUpArrowAndCancel(e);
	}, false);

	search.addEventListener('keypress', function(e) {
		checkIfUpArrowAndCancel(e);
	}, false);

	/**
	 * do some clean up before doing another search
	 * and invoke the search method.
	 *
	 * @void.
	 */
	var resetAndSearch = function(filter) {
		reset();
		search(filter);
	};

	/**
	 * reset page request.
	 *
	 * @void.
	 */
	var reset = function() {
		pageRequest = 0;
	};

	/**
	 * use the response 'highlight' property
	 * which provided by 'elastic search' to override the original 'hits' 
	 * property.
	 *
	 * @void.
	 */
	var highlight = function(hits) {
		hits.forEach(function(hit) {		
			if (!hit.highlight)
				return;
			if (hit.highlight.Title)
				hit._source.Title = hit.highlight.Title[0];
			if (hit.highlight.Body)
				hit._source.Body = hit.highlight.Body[0];
		});

		return hits;
	};

	/**
	 * Enter click handling.
	 *
	 * @void.
	 */
	var handleEnterKeyup = function(e) {
		var selectedSuggestionIndexUndefined, selectedSuggestionText;
		
		selectedSuggestionIndexUndefined = typeof selectedSuggestionIndex === 'undefined';
		if (selectedSuggestionIndexUndefined && !$scope.bucket.suggestions.length)
			return;
		if (!selectedSuggestionIndexUndefined) {
			selectedSuggestionText = $scope.bucket.suggestions[selectedSuggestionIndex].text;
			$scope.bucket.q = selectedSuggestionText;
			resetAndSearch();	
		}
		$scope.bucket.suggestions = [];	
	};

	/**
	 * 
	 *
	 * @void.
	 */
	var handleArrowUpKeyup = function(e) {
		var suggestionsLength;

		if (!$scope.bucket.suggestions.length)
			return;
		suggestionsLength = $scope.bucket.suggestions.length;
		if (typeof selectedSuggestionIndex === 'undefined') {
			$scope.bucket.suggestions[suggestionsLength-1].active = true;	
			selectedSuggestionIndex = suggestionsLength-1;
			return;
		}
		if (selectedSuggestionIndex === 0) {
			delete $scope.bucket.suggestions[selectedSuggestionIndex].active; 
			$scope.bucket.suggestions[suggestionsLength-1].active = true;	
			selectedSuggestionIndex = suggestionsLength-1;
		} else {
			delete $scope.bucket.suggestions[selectedSuggestionIndex].active;
			selectedSuggestionIndex--;
			$scope.bucket.suggestions[selectedSuggestionIndex].active = true;	
		}
	};

	/**
	 * 
	 *
	 * @void.
	 */
	var handleArrowDownKeyup = function(e) {
		var suggestionsLength;

		if (!$scope.bucket.suggestions.length)
			return;
		
		if (typeof selectedSuggestionIndex === 'undefined') {
			$scope.bucket.suggestions[0].active = true;	
			selectedSuggestionIndex = 0;
			return;
		}
		suggestionsLength = $scope.bucket.suggestions.length
		if (selectedSuggestionIndex === suggestionsLength-1) {
			delete $scope.bucket.suggestions[selectedSuggestionIndex].active; 
			$scope.bucket.suggestions[0].active = true;	
			selectedSuggestionIndex = 0;
		} else {
			delete $scope.bucket.suggestions[selectedSuggestionIndex].active;
			selectedSuggestionIndex++;
			$scope.bucket.suggestions[selectedSuggestionIndex].active = true;	
		}
	};

	/**
	 * Description
	 *
	 * @param {dataType} nameOfParam Description.
	 * @void.
	 */
	var search = function(filter) {
		$scope.bucket.loader = true;
		SearchService.search($scope.bucket.q, pageRequest, perPage, $scope.bucket.selectedSort, filter).then(function(response) {
				page = pageRequest;
				$scope.bucket.showSummary = true;
				$scope.bucket.totalHits = getTotalHits(response);
				$scope.bucket.lastQ = $scope.bucket.q;
				$scope.bucket.items = highlight(response.hits.hits);
				$scope.bucket.filters = response.aggregations.tags.buckets;
				$scope.bucket.selectedFilter = filter;
		}, function(error) {
			console.log('error');
		})
		.finally(function() {
			$scope.bucket.loader = false;
		});
	};

	/**
	 * Description
	 *
	 * @param {dataType} nameOfParam Description.
	 * @void.
	 */
	var getSuggestions = function(q) {
		SearchService.getSuggestions(q).then(function(response) {
			$scope.bucket.suggestions = response.suggest.simple_phrase[0].options;
		});
	};

	/**
	 * Description
	 *
	 * @param {dataType} nameOfParam Description.
	 * @void.
	 */
	var getTotalHits = function(response) {
		return response.hits.total;
	};
}]);

/**
 * Search Service.
 *
 * @void.
 */
app.service('searchService', ['$q', '$http', function($q, $http) { 
	
	this.search = function(q, page, perPage, selectedSort, filter) {
		var params, promise, deferred = $q.defer(), filterKey;
		
		params = {
			q: q,
			page: page,
			perPage: perPage,
			sort: JSON.stringify(selectedSort)
		};

		if (filter)
			params.filter = filter.key;

		promise = $http({
	    url: '/search', 
	    method: 'GET',
	    params: params
	 });

		promise.success(function(response, status, headers, config) {
			deferred.resolve(response);
		})
		.error(function(data, status, headers, config) {
			deferred.reject();
		});

		return deferred.promise;
	};

	this.getSuggestions = function(q) {
		var q, deferred = $q.defer();
		
		$http.get('/suggestions?q=' + q).success(function(response) {
			deferred.resolve(response)	
		})
		.error(function() {
			deferred.reject();
		});
		
		return deferred.promise;
	};
}]);
