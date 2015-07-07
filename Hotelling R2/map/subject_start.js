
Redwood.controller("SubjectCtrl", ["$rootScope", "$scope", "RedwoodSubject", 'SynchronizedStopWatch',function($rootScope, $scope, rs, SynchronizedStopWatch) {
    var logging = true;
    var CONST_MY_COLOR = "#0066FF";


    function dev_log(string) {
        if (logging) console.log(string);
    }
    function getIndex(id) {
    	for (var i = 0; i < $scope.players.length; i++) {
    		if ($scope.players[i].id == id) return i;
    	}
    }

    $scope.linear_cost = function () {
    	// body...
    };

    $scope.quadratic_cost = function () {
    	// body...
    };
    
    $scope.updateActionSpace = function () {
    	
    };

    /**
    * Main Ticking function
    * Updates Game State, called by syncrhonized stopwatch
    */
    $scope.tick = function () {
    	$scope.updateActionSpace();
    }

	rs.on_load(function() {
		dev_log(rs);

		readConfig();

        $scope.clock = SynchronizedStopWatch.instance()
            .frequency(1).onTick($scope.tick)
            .duration(rs.config.period_length).onComplete(function() {
                rs.trigger("new_period");
            });
        
        $scope.actionSpace = d3.select("#actionSpace");


        $scope.players = [];
        for (var i = 0; i < rs.subjects.length; i++) {
        	var player = {
        		loc: 0,
        		price: 0,
        		payoff: 0,
        		bound_lo: 0,
        		bound_hi: 0,
        		id: rs.subjects[i].user_id,
        		valid: 1,
        		iterx: 0,
        		itery: 0,
        		target: [0, 0],
        		color: $scope.config.colors[i]
        	};
        	$scope.players.push(player);
        }
        bindEvents();
        dev_log($scope.players);
	});

	/**
	 * Sets up all the DOM event handlers
	 * for the D3 plots
	 */
	function bindEvents () {
		var svg = d3.select("acti")
		var thirds = $("#actionSpace").width()/3;

		var halfHeight = $("#actionSpace").height()/2;
		var halfWidth = $("#actionSpace").width()/2;

		var leftBound = $scope.actionSpace
	        .append("div")
	        .style("position", "absolute")
	        .style("z-index", "19")
	        .style("width", "3px")
	        .style("height", "394px")
	        .style("top", "3px")
	        .style("bottom", "30px")
	        .style("left", thirds + "px")
	        .style("background", "#000");

        var rightBound = $scope.actionSpace
	        .append("div")
	        .style("position", "absolute")
	        .style("z-index", "19")
	        .style("width", "3px")
	        .style("height", "394px")
	        .style("top", "3px")
	        .style("bottom", "30px")
	        .style("left", 2*thirds + "px")
	        .style("background", "#000");

		var vertical = $scope.actionSpace
	        .append("div")
	        .attr("class", "remove")
	        .style("position", "absolute")
	        .style("z-index", "19")
	        .style("width", "2px")
	        .style("height", "390px")
	        .style("top", "5px")
	        .style("bottom", "30px")
	        .style("left", "0px")
	        .style("background", "#fff");

		for (var i = 0; i < $scope.players.length; i++) {
			$scope.actionSpace.append("circle")
					.attr("id", $scope.players[i].id)
					.attr("class", "playerCircle")
					.attr("fill", "#000")
					.attr("cx", halfWidth)
					.attr("cy", halfHeight+i+5)
					.attr("r", 7);
		}
		//main actionspace handler
		$("#actionSpace").bind("click", function(e) {
			var parentOffset = $(this).parent().offset();
			
			var actionHeight = $(this).height();
			var actionWidth = $(this).width();

            //grabs the X,Y of the mouseclick in the div
            var relX = e.pageX - parentOffset.left;
            var relY = e.pageY - parentOffset.top;

            var price = Math.abs(relY - actionHeight)/actionHeight;
            var loc = relX/actionWidth;
            
            if (price > 1) price = 1;
            if (price < 0) price = 0;
            if (loc < 0) loc = 0;
            if (loc > 1) loc = 1;

            dev_log("x: " + loc + ", y: " + price);
            var msg = {
            	loc: loc,
            	price: price
            }

            rs.send("update_player", msg);
            rs.trigger("update_player", msg);
		});
		
		d3.select("#actionSpace")
			.on("mousemove", function() {
				mousex = d3.mouse(this);
				mousex = mousex[0] + 15;
				vertical.style("left", mousex + "px")
			});


	}


	/**
	 * Reads in the config
	 * and sets them in $scope.config
	 */
	function readConfig() {
		$scope.config.subperiods = rs.config.subperiods;
		$scope.config.period_length = rs.config.period_length;

		$scope.config.x_rate = rs.config.percent_cpsx;
		$scope.config.y_rate = rs.config.percent_cpsy;

		$scope.config.transport_cost = rs.config.t;
		$scope.config.paid = rs.config.paid;

		if (rs.config.payoff_func === 0) {
			$scope.config.transport_cost = $scope.linear_cost;
		} else {
			$scope.config.transport_cost = $scope.quadratic_cost;
		}

		$scope.config.flow_opts = rs.config.p2_options;

		// discrete, turn based (dttb), continuous
		$scope.config.game_type = rs.config.discrete_time_type;

		$scope.config.scalar_x = rs.config.scale_x;
		$scope.config.scalar_y = rs.config.scale_y;

		$scope.config.price_subrounds = rs.config.num_sp_settingy;

		// debug flags
		$scope.config.debug1 = rs.config.payoff_debug;
		$scope.config.debug2 = rs.config.payoff_debug2;
		$scope.config.debug3 = rs.config.payoff_debug3;

		$scope.config.color = CONST_MY_COLOR;
		$scope.config.colors = ['#FF6699', '#339966', '#0066CC', '#CCA300'];

		$scope.config.num_players = rs.subjects.length;

		$scope.config.const_width = $("#actionSpace").width();
		$scope.config.const_height = $("#actionSpace").height();

		dev_log($scope.config);
	}



	/**
	 * Updates player location
 	 * @param id : user id of sender
	 * @param msg {
	 * 	 msg.loc 	:: new loc to update
	 * }
	 */
	rs.recv("update_location", function(uid, msg) {
		$scope.players[getIndex(uid)].loc = msg.loc;
	});

	/**
	 * Updates player price
 	 * @param id : user id of sender
	 * @param msg {
	 * 	 msg.price 	:: new price to update
	 * }
	 */
	rs.recv("update_price", function(uid, msg) {
		$scope.players[getIndex(uid)].price = msg.price;
	});

	/**
	 * Updates player state
	 * @param id : user id of sender
	 * @param msg {
	 *   msg.loc 	:: new loc to update
	 * 	 msg.price 	:: new price to update
	 * }
	 */
	rs.recv("update_player", function(uid, msg) {
		dev_log("getting index for id: " + uid);
		dev_log("got index: " + getIndex(uid));
		var index = getIndex(uid);
		$scope.players[index].loc = msg.loc;
		$scope.players[index].price = msg.price;

		$("#" + uid).attr("cx", msg.loc * $scope.config.const_width);
		$("#" + uid).attr("cy", msg.price * $scope.config.const_height);
		dev_log($scope.players);
	});
	/**
	 * Updates this player's state
	 * @param msg {
	 *   msg.loc 	:: new loc to update
	 * 	 msg.price 	:: new price to update
	 * }
	 */
	rs.on("update_player", function(msg) {
		var index = getIndex(rs.user_id);
		$scope.players[index].loc = msg.loc;
		$scope.players[index].price = msg.price;

		$("#" + rs.user_id).attr("cx", msg.loc * $scope.config.const_width);
		$("#" + rs.user_id).attr("cy", msg.price * $scope.config.const_height);
		dev_log($scope.players);
	});

	rs.on("new_period", function(msg) {
		dev_log("ending period" + rs.period);
		rs.next_period(5);
	});


}]);


