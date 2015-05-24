Redwood.controller("SubjectCtrl", ["$rootScope", "$scope", "RedwoodSubject", 'SynchronizedStopWatch', function($rootScope, $scope, rs, SynchronizedStopWatch) {
    var id = 0; //player id
    var current_period = 0;
    var curr_subperiods = 1;
    var num_of_players = 0; //number of players in our group
    var price = 0;
    var network = {}; //player object
    var options; //plot 1 options
    var p2_options; //plot 2 options
    var player_pos = []; //location of opponent's positions
    var target_pos = [0, 0]; //our current target location for continuous time
    var plot;
    var x_rate = 1; //percent change per second along x axis
    var y_rate = 1; //percent change per second along y axis
    var keeper; //game synchronizer from our group
    var chosen = false; //flag
    var new_loc = 0;
    var new_pos = 0;
    var transport_cost;
    var time = 0;
    var tend;
    var subperiods = 0;
    var paid_round = false;
    var period_length = 0;
    var t; //config field
    var r; //redwood
    var intersects = []; //array of intersect locations on x axis
    var colors = ['#FF6699', '#339966', '#0066CC', '#CCA300'];
    var mouse = []; //for drawing crosshairs on plot
    var cummulative_payoff = 0;
    var flow_payoff = []; //should be a better way of storing flow payoffs for scalability reasons..
    var flow_payoff2 = [];
    var game_type = "continuous";
    var debug = false; //player 'Vs'
    var debug2 = false; //intersect lines
    var debug3 = false; //market share box shading
    var col; //player's blue color. may be unnecessary to store this info now
    var p2_t = 0; //fake time interval for plotting flow payoffs. should be changed
    var flow_opts; //flow payoff debug options
    var last_20 = [];
    //var l = 0;
    var my_pos; //player's current location and price 
    var sub_pay = [
        [],
        []
    ]; //stores each player's payoffs at end of round for discrete games
    var scalar_x = Number(1);
    var scalar_y = Number(1);
    var allow_x = 1; //discrete choosing settings
    var allow_y = 0;
    var price_subrounds = 1; //how many price rounds after a location round we have
    var curr_sub_y = 0;
    var curr_i = 0;
    var p2_ticks = [];
    var flag = 0; //for restarting position after new subgames
    var waiting = 1; //to disable user interface
    var in_group = []; //who is in my redwood group
    var group_num = 0;
    var silo_num = 0;
    var r_debug = 0;

    var myClick = [];

    var total_flow = [];
    var total_flow2 = [];

    var filler = [0, 0]; //for making bar graphs

    var quadratic = false;
    var linear = true;

    var payoff_mirror = 0;

    var pointCounter = 0;
    var myX;
    var myY;
    var innerRadius = 50;
    var player_xy = [];

    /*
     * returns color associated with a player
     */
    function player_color(key) {
        for (var i = 0; i < network.players.length; ++i)
            if (network.players[i].id == key) return network.players[i].color;

        return '#000000';
    }

    /*
     * returns all player's positions as x,y points
     */
    function get_opp_pos() {
        var res = [];
        for (var i = 0; i < player_pos.length; ++i) {
            res.push([
                [player_pos[i][0], player_pos[i][1]]
            ]);
        }

        return res;
    }

    /*
     * returns points to draw a line on given axis to indicate where players can choose
     */
    function gen_targ_line(axis) {
        var res = [];
        if (axis == "x") {
            res.push([Number(new_loc) + 0.015, 0]);
            res.push([Number(new_loc) - 0.015, 0]);
            res.push([Number(new_loc), 0.015]);
            res.push([Number(new_loc) + 0.015, 0]);
            res.push([Number(new_loc), 0.015]);
            res.push([Number(new_loc), 1]);
        } else if (axis == "y") {
            res.push([0, Number(new_pos) + 0.015]);
            res.push([0, Number(new_pos) - 0.015]);
            res.push([0.015, Number(new_pos)]);
            res.push([0, Number(new_pos) + 0.015]);
            res.push([0.015, Number(new_pos)]);
            res.push([1, Number(new_pos)]);
        }
        return res;
    }

    /*
     * returns market boundary points for a given player to draw 'payoff area' box
     */
    function get_market_bounds(key) {
        var res = [];
        for (var i in network.players) {
            if (network.players[i].id == key) {
                res.push(network.players[i].bound_lo);
                res.push(network.players[i].bound_hi);
                res.push(network.players[i].price);
            }
        }

        var out = [];
        out.push([res[0], null]);

        out.push([res[0], 0]);
        out.push([res[0], res[2]]);


        out.push([res[1], res[2]]);
        out.push([res[1], 0]);
        out.push([res[1], null]);

        return out;
    }

    var tmp_a0 = [];
    var tmp_a1 = [];

    //Used to hold the reflections. This is needed because Flot will try to connect
    //points even if there's a break in the function, so we split up the positive
    //reflections and the negative ones for both players.
    var tmp_a0_front = [];
    var tmp_a0_back = [];
    var tmp_a1_front = [];
    var tmp_a1_back = [];

    var market_b = [];
    var combined = true;

    /*
     * redraws and updates data for plot 1
     */
    function update_plot() {
        if (waiting) return;

        sort_players();

        get_players();
        updateCircle();

        if (combined) {
            updateActionspace();
        }

    }
        /*
         * payoff debug "V" generating function
         */
    function a_single(index) {
        var res = [];
        var player = network.players[index];
        if (player === null || player === undefined) return;

        var l = player.loc * -1;
        var p = player.price;

        // x-l^2+p

        for (var x = 0; x <= 1; x = x + 0.01) {
            var y = p + Math.abs(l + x);

            res.push([x, y]);
        }
        return res;
    }

    function a_mirror(index) {
        var res = [];
        var player = network.players[index];
        if (player === null || player === undefined) return;

        var l = player.loc * -1;
        var p = player.price;

        for (var x = player.loc; x < 2.5; x = x + 0.001) {
            var curr_loc = x;
            var y = p + Math.abs(l + x);

            if (curr_loc > 1) {
                curr_loc = 0 + Math.abs(1 - x);
                if (index == 0) {
                    tmp_a0_back.push([curr_loc, y]);
                } else if (index == 1) {
                    tmp_a1_back.push([curr_loc, y]);
                }
                continue;
            }

            res.push([curr_loc, y]);
        }

        for (var x = player.loc; x >= -2.5; x = x - 0.001) {
            var curr_loc = x;
            var y = p + Math.abs(l + x);

            if (curr_loc < 0) {
                curr_loc = Math.abs(1 + x);
                if (index == 0) {
                    tmp_a0_front.push([curr_loc, y]);
                } else if (index == 1) {
                    tmp_a1_front.push([curr_loc, y]);
                }
                continue;
            }

            res.push([curr_loc, y]);
        }
        return res;
    }

    function quad(index) {
        var res = [];
        var player = network.players[index];
        if (player === null || player === undefined) return;

        var l = player.loc * -1;
        var p = player.price;


        for (var x = 0; x <= 1; x = x + 0.01) {

            var y = p + Math.pow(Math.abs(l + x), 2);

            res.push([x, y]);
        }
        return res;
    }

    function quad_mirror(index) {
        var res = [];
        var player = network.players[index];
        if (player === null || player === undefined) return;

        var l = player.loc * -1;
        var p = player.price;

        for (var x = player.loc; x < 2.5; x = x + 0.001) {
            var curr_loc = x;
            var y = p + Math.pow(Math.abs(l + x), 2);

            if (curr_loc > 1) {
                curr_loc = 0 + Math.abs(1 - x);
                if (index == 0) {
                    tmp_a0_back.push([curr_loc, y]);
                } else if (index == 1) {
                    tmp_a1_back.push([curr_loc, y]);
                }
                continue;
            }


            res.push([curr_loc, y]);
        }

        for (var x = player.loc; x >= -2.5; x = x - 0.001) {
            var curr_loc = x;
            var y = p + Math.pow(Math.abs(l + x), 2);

            if (curr_loc < 0) {
                curr_loc = Math.abs(1 + x);
                if (index == 0) {
                    tmp_a0_front.push([curr_loc, y]);
                } else if (index == 1) {
                    tmp_a1_front.push([curr_loc, y]);
                }
                continue;
            }

            res.push([curr_loc, y]);
        }


        return res;
    }

    function updateActionspace() {

        var tmp = [target_pos];
        var i = get_index_by_id(id);
        var tmp_col = '#C7C7C7';

        if (game_type == "continuous") {
            targ_line = [];
            my_pos = [
                [player_pos[i][0], player_pos[i][1]]
            ];
        } else if (game_type != "continuous") {
            var axis = "";
            if (allow_x && !allow_y) axis = "x";
            else if (!allow_x && allow_y) axis = "y";

            tmp_col = '#B20000';
            targ_line = gen_targ_line(axis); //draw axis choosing line if in discrete time
        }

        tmp_a0 = [];
        tmp_a1 = [];

        //Used to hold the reflections. This is needed because Flot will try to connect
        //points even if there's a break in the function, so we split up the positive
        //reflections and the negative ones for both players.
        tmp_a0_front = [];
        tmp_a0_back = [];
        tmp_a1_front = [];
        tmp_a1_back = [];

        market_b = [];
        intersects = [0, mouse[0], 1];

        var opp_pos = get_opp_pos();
        //This isn't done for n players -- only players 0 & 1

        if (debug1) { // display payoff debug options, player "V's"
            //if we're doing linear, use linear v generator, otherwise do quad
            if (linear) {
                if (payoff_mirror) {
                    tmp_a0 = a_mirror(0);
                    tmp_a1 = a_mirror(1);
                } else {
                    tmp_a0 = a_single(0);
                    tmp_a1 = a_single(1);
                }
            } else {
                if (payoff_mirror) {
                    tmp_a0 = quad_mirror(0);
                    tmp_a1 = quad_mirror(1);
                } else {
                    tmp_a0 = quad(0);
                    tmp_a1 = quad(1);
                }
            }
        }

        if (debug2) { //market intersection lines
            intersects = find_intersect_pts();
            intersects[num_of_players + 1] = mouse[0];
            options.xaxis.ticks = intersects;
        }

        if (debug3) { //payoff area shading
            market_b = get_market_bounds(id);
            if (payoff_mirror) {
                //market_b_2 = get_market_bounds2(id);
            }
            //console.log(market_b);
        }
        options.xaxis.ticks = intersects;
        plot = $.plot("#placeholder", [{
            data: opp_pos[0],
            /*hoverable: false,*/
            color: player_pos[0][2],
            points: {
                show: true,
                radius: 3,
                fill: true,
                fillColor: player_pos[0][2]
            }
        }, {
            data: opp_pos[1],
            color: player_pos[1][2],
            points: {
                show: true,
                radius: 3,
                fill: true,
                fillColor: player_pos[1][2]
            }
        }, {
            data: targ_line,
            color: '#000000',
            lines: {
                show: true,
                fill: false
            }
        }, {
            data: tmp,
            color: tmp_col,
            points: {
                show: true,
                radius: 3,
                fill: true,
                fillColor: tmp_col
            }
        }, {
            data: tmp_a0,
            hoverable: false,
            color: player_color(network.players[0].id),
            lines: {
                show: true
            }
        }, {
            data: tmp_a0_front,
            hoverable: false,
            color: player_color(network.players[0].id),
            lines: {
                show: true
            }
        }, {
            data: tmp_a0_back,
            hoverable: false,
            color: player_color(network.players[0].id),
            lines: {
                show: true
            }
        }, {
            data: tmp_a1,
            color: player_color(network.players[1].id),
            lines: {
                show: true
            }
        }, {
            data: tmp_a1_front,
            hoverable: false,
            color: player_color(network.players[1].id),
            lines: {
                show: true
            }
        }, {
            data: tmp_a1_back,
            hoverable: false,
            color: player_color(network.players[1].id),
            lines: {
                show: true
            }
        }, {
            data: my_pos,
            color: '#000000',
            points: {
                show: true,
                radius: 5,
                fill: true,
                fillColor: '#0099FF'
            }
        }, {
            data: market_b,
            color: col,
            lines: {
                show: true,
                fill: 0.25
            }
        }], options);


    }

    function updateCircle() {

        buildProjections();

        for (i = 0; i < network.players.length; i++) {
            var front = network.players[i].front_projection;
            var back = network.players[i].back_projection;
            


            drawLineForDataSet(front, i, "front");
            drawLineForDataSet(back, i, "back");
        }

    }

    function buildProjections() {
        for (i = 0; i < network.players.length; i++) {
            var player = network.players[i];
            player.projection = [];
            player.front_projection = [];
            player.back_projection = [];

            if (linear) {
                player.front_projection = linear_proj(i, 1);
                player.back_projection = linear_proj(i, -1);
            } else if (quad) {
                player.front_projection = quad_proj(i, 1);
                player.back_projection = quad_proj(i, -1);
            }
        }
    }

    /* returns a set of data for given player that is half way in the direction of flag */
    function linear_proj(index, flag) {
            var res = [];
            var player = network.players[index];
            if (player === null || player === undefined) return res;
            if (player.loc == 0) return;
            var l = player.loc * -1;
            var p = player.price;

            if (flag == 1) {

                for (var x = -3; x <= player.loc; x = x + 0.01) {
                    var y = p + Math.abs(l + x);
                    res.push([x, y]);
                }

                var closex = player.loc - .0001;
                var payz = p + Math.abs(l + closex);
                res.push([closex, y]);
            } else {

                for (var x = player.loc; x < 3; x = x + 0.01) {

                    var y = p + Math.abs(l + x);
                    res.push([x, y]);
                }
                var closex = player.loc + .0001;
                var payz = p + Math.abs(l + closex);
                res.push([closex, y]);
            }
            res = pt_to_circle(res);




            return res;
        }
        /* returns a set of data for given player that is half way in the direction of flag */
    function quad_proj(index, flag) {

    }

    function drawActionspace() {
        var svg = d3.select("#actionSpace");

        //appends the circle to block position
        svg.append("circle")
            .style("stroke", "gray")
            .style("fill", "black")
            .attr("r", 50)
            .attr("cx", 225)
            .attr("cy", 225);

        //appends actionSpace
        svg.append("circle")
            .attr("id", "actionCircle")
            .style("stroke", "gray")
            .style("fill", "white")
            .attr("stroke-width", 3)
            .attr("r", 200)
            .attr("cx", 225)
            .attr("cy", 225);
    }

    function resetSvg() {
        clearSvg();
        drawActionspace();
    }

    function clearSvg() {
        $("#actionSpace").empty();
    }

    //this is a helper function for checking whether or not a
    //DOM element exists

    jQuery.fn.exists = function(){return this.length>0;}

    function drawLineForDataSet(pts, iter, dir) {
        if (pts == null) return;

        var lineFunction = d3.svg.line()
            .x(function(d) {
                return d.x;
            })
            .y(function(d) {
                return d.y;
            })
            .interpolate("basis-open");

        var idStr = "proj" + iter + dir;
        var selector = "#proj" + iter + dir;

        var svg = d3.select("#actionSpace");

        //if this projection has been drawn, simply update the data
        if ($(selector).exists()) {
            svg.select(selector)
                .attr("d", lineFunction(pts));

        } else {
            var lineGraph = svg.append("path")
                .attr("id", idStr)
                .attr("d", lineFunction(pts))
                .attr("stroke", "teal")
                .attr("stroke-width", 2)
                .attr("fill", "none");
        }
    }

    var date = 0;
    var old_date = 0;

    /*
     * rewdraw and update flow payoff plot
     */
    function update_plot2() {
        if (waiting) return;

        if (game_type == "continuous") {
            //make sure everyone is sorted
            sort_players();
            find_intersect_pts();

            //so we can get the correct payoffs
            /*
            var index = get_index_by_id(id);
            var pay = payoff(index);
            rs.send("update_payoff", {
                pay: pay,
                index: index
            });
            */

            //let's find how long it was since we updated our payoffs      
            date = new Date();
            date.getTime();

            var d = date - old_date;
            old_date = date;

            p2_t += 0.12;
            //p2_t += d;

            cummulative_payoff += network.players[get_index_by_id(id)].payoff * (d / (period_length * 1000));

            document.getElementById("curr_score").innerHTML = "Current score: " + cummulative_payoff.toFixed(3);

            if (flow_opts == "all") {
                //push all player's data to be plotted
                flow_payoff.push([p2_t, network.players[get_index_by_id(in_group[0])].payoff]);
                flow_payoff2.push([p2_t, network.players[get_index_by_id(in_group[1])].payoff]);

                total_flow.push([p2_t, network.players[get_index_by_id(in_group[0])].payoff]);
                total_flow2.push([p2_t, network.players[get_index_by_id(in_group[1])].payoff]);

                //add extra white space to front of plot to hide end time
                p2_options.xaxis.max = flow_payoff[flow_payoff.length - 1][0] + 5;

                last_20.push(network.players[get_index_by_id(in_group[0])].payoff);
                last_20.push(network.players[get_index_by_id(in_group[1])].payoff);

                //get rid of data more than 20seconds old
                if (time >= 20) {
                    flow_payoff.shift();
                    flow_payoff2.shift();
                    last_20.shift();
                    p2_options.xaxis.min = flow_payoff[0][0];
                }

                //scale flow payoff y axis to fit m ax payoff during the last 20 seconds 
                p2_options.yaxis.max = Math.max.apply(null, last_20) * 1.1;

                plot2 = $.plot("#placeholder2", [{
                    data: flow_payoff,
                    color: player_color(network.players[get_index_by_id(in_group[0])].id),
                    points: {
                        show: false,
                        radius: 4,
                        fill: true,
                        fillColor: '#C7C7C7'
                    }
                }, {
                    data: flow_payoff2,
                    color: player_color(network.players[get_index_by_id(in_group[1])].id),
                    points: {
                        show: false,
                        radius: 4,
                        fill: true,
                        fillColor: '#C7C7C7'
                    }
                }], p2_options);

            } else if (flow_opts == "own") {
                //in this case we only plot our own payoff data
                flow_payoff.push([p2_t, network.players[get_index_by_id(id)].payoff]);
                total_flow.push([p2_t, network.players[0].payoff]);

                last_20.push(network.players[get_index_by_id(id)].payoff);
                p2_options.xaxis.max = flow_payoff[flow_payoff.length - 1][0] + 5;

                if (time >= 20) {
                    flow_payoff.shift();
                    last_20.shift();
                    p2_options.xaxis.min = flow_payoff[0][0];
                }

                p2_options.yaxis.max = Math.max.apply(null, last_20) * 1.1;

                plot2 = $.plot("#placeholder2", [{
                    data: flow_payoff,
                    color: player_color(id),
                    points: {
                        show: false,
                        radius: 4,
                        fill: true,
                        fillColor: '#C7C7C7'
                    }
                }], p2_options);

            } else if (flow_opts == "none") {
                //otherwise we plot nothing
                return;
            }

        } else {
            //else we are in discrete time
            p2_options.xaxis.tickDecimals = 0;
            p2_options.xaxis.min = 0;
            p2_options.xaxis.max = curr_subperiods + 2;
            p2_options.xaxis.ticks = p2_ticks;

            if (flow_opts == "all") {
                flow_payoff = plot_data(sub_pay[0], 0, 1);
                flow_payoff2 = plot_data(sub_pay[1], 0, 1);

                //set player's payoff bar graphs to have 25% opacity
                if (network.players[0].id == id) filler = [0.25, 0];
                else if (network.players[1].id == id) filler = [0, 0.25];

                plot2 = $.plot("#placeholder2", [{
                    data: flow_payoff,
                    color: player_color(network.players[0].id),
                    points: {
                        show: false,
                        radius: 4,
                        fill: true,
                        fillColor: '#C7C7C7'
                    },
                    lines: {
                        fill: filler[0]
                    }
                }, {
                    data: flow_payoff2,
                    color: player_color(network.players[1].id),
                    points: {
                        show: false,
                        radius: 4,
                        fill: true,
                        fillColor: '#C7C7C7'
                    },
                    lines: {
                        fill: filler[1]
                    }
                }], p2_options);

            } else if (flow_opts == "own") {

                flow_payoff = plot_data(sub_pay[get_index_by_id(id)], 0, 1);

                plot2 = $.plot("#placeholder2", [{
                    data: flow_payoff,
                    color: player_color(id),
                    points: {
                        show: false,
                        radius: 4,
                        fill: true,
                        fillColor: '#C7C7C7'
                    },
                    lines: {
                        fill: 0.25
                    }
                }], p2_options);
                return;
            } else {
                return;
            }
        }
    }

    /*
     * nicely package flow payoff data for discrete time types
     * div is now always 1 since lines should overlap
     */
    function plot_data(input, offset, div) {
        var res = [];
        var i = 0;
        p2_ticks = [];
        for (var a in input) {
            if (input[a] !== 0) {
                res.push([i + ((1 / div) * offset), null]);
                res.push([i + ((1 / div) * offset), input[a]]);
                res.push([i + ((1 / div) * (offset + 1)), input[a]]);
                res.push([i + ((1 / div) * (offset + 1)), null]);
                p2_ticks.push(i);
                i++;
            }
        }
        return res;
    }



    /*
     * default
     */
    function linear_cost() {
        var res = [];
        var pos = get_index_by_id(id);

        for (var i = 0; i < network.players.length; ++i) {
            if (i != pos) res.push(Math.abs(network.players[pos].loc - network.players[i].loc) * t);
        }

        return res;
    }

    /*
     * d^2 * t
     */
    function quadratic_cost() {
        var res = [];
        var pos = get_index_by_id(id);

        for (var i = 0; i < network.players.length; ++i) {
            if (i != pos) res.push(Math.abs(Math.pow(network.players[pos].loc - network.players[i].loc), 2) * t);
        }

        return res;
    }

    /*
     * find only players that have a market share
     */
    function validate_players() {
        var tmp = network.players;
        var res = [];
        //var index;
        var i;

        for (i = 0; i < network.players.length; ++i) {
            var p1 = network.players[i];
            tmp[i].valid = 1;

            for (var j = 0; j < network.players.length; ++j) {
                var p2 = network.players[j];

                //for every player excluding yourself compare price
                if (i != j) {
                    if (linear) {
                        //new system for circle determines validity based on where intersects occur
                        var intersect2 = (t * (p2.loc + p1.loc + 1) - (p2.price - p1.price)) / (2 * t);
                        var intersect3 = (t * (p2.loc + p1.loc - 1) + (p1.price - p2.price)) / (2 * t);
                        console.log("vp intersect 2 = " + intersect2);
                        console.log("vp intersect 3 = " + intersect3);

                        if (p1.price > p2.price + t * Math.abs(p1.loc - p2.loc)) {

                            tmp[i].valid = 0;

                            //update player's new market bounds
                            var new_lo_bound = 0;
                            var new_hi_bound = 0;

                            network.players[i].bound_lo = new_lo_bound;
                            network.players[i].bound_hi = new_hi_bound;



                        }
                    } else if (quadratic) {
                        var intersection = (Math.pow(p1.loc, 2) - Math.pow(p2.loc, 2) + p1.price - p2.price) / (2 * Math.abs(p1.loc - p2.loc));
                        intersection = Math.abs(intersection);

                        var priceScalar = p2.price + t * Math.pow(p1.loc - p2.loc, 2);

                        //If the intersection occurs less than 0 or above 1, the player with the lower price `wins`
                        if (!((0 < intersection) && (intersection < 1))) {

                            if (p1.price > p2.price) {
                                tmp[i].valid = 0;

                                //update player's new market bounds
                                var new_lo_bound = 0;
                                var new_hi_bound = 0;

                                network.players[i].bound_lo = new_lo_bound;
                                network.players[i].bound_hi = new_hi_bound;
                            }
                        }

                    }
                }
            }
        }

        for (i = 0; i < network.players.length; ++i) {
            if (tmp[i].valid == 1) res.push(network.players[i]);
        }

        return res;
    }


    /*
     * returns array of all points along x-axis that correspond to an intersection
     */
    function find_intersect_pts() {
        var res = [];
        res.push(0);

        var tmp = validate_players();
        var i;

        // t(lH)+(pH)+t(lL)-(pL)2t
        // t(lH+lL) + (pH-pL)

        //high = [i+1], low = [i]
        if (linear) {

            for (i = 0; i < tmp.length - 1; ++i) {
                var intersect1 = (t * (tmp[i + 1].loc + tmp[i].loc) + (tmp[i + 1].price - tmp[i].price)) / (2 * t);

                res.push(intersect1);

                if (payoff_mirror) {
                    var intersect2 = (t * (tmp[i + 1].loc + tmp[i].loc + 1) - (tmp[i + 1].price - tmp[i].price)) / (2 * t);
                    var intersect3 = (t * (tmp[i + 1].loc + tmp[i].loc - 1) + (tmp[i].price - tmp[i+1].price)) / (2 * t);
                    console.log("intersect 2 = " + intersect2);
                    console.log("intersect 3 = " + intersect3);
                    if (intersect2 > 1) {
                        res.push(intersect3);
                    } else {
                        res.push(intersect2);
                    }
                    

                }
            }


        } else if (quad) {
            for (i = 0; i < tmp.length - 1; ++i) {

                //Let's recreate the lower player on the left and right side of the boundaries
                if (payoff_mirror) {
                    var loc_low_one = tmp[i].loc + 1;
                    var loc_low_zero = tmp[i].loc - 1;
                }
                var loc_low = tmp[i].loc;
                var price_low = tmp[i].price;
                var loc_high = tmp[i + 1].loc;
                var price_high = tmp[i + 1].price

                //this calculates the intersections between two quadratics
                var top = (Math.pow(loc_high, 2) - Math.pow(loc_low, 2) + price_high - price_low);
                var denom = (2 * Math.abs(loc_high - loc_low));
                var intersection = top / denom;

                //grab our inital intersection
                if (intersection < 0 || intersection > 1) {
                    res.push(0);
                } else {
                    res.push(intersection);
                }
                //lets grab our mirrored intersections
                if (payoff_mirror) {
                    //this calculates the intersections between two quadratics, one with the compared player and one with the player mirrored above 1
                    var top = (Math.pow(loc_high, 2) - Math.pow(loc_low_one, 2) + price_high - price_low);
                    var denom = (2 * Math.abs(loc_high - loc_low_one));
                    var intersection = top / denom;

                    //grab our intersection
                    if (intersection < 0 || intersection > 1) {
                        res.push(0);
                    } else {
                        res.push(intersection);
                    }

                    //this calculates the intersections between two quadratics, one with the compared player and one with the player mirrored below 0
                    var top = (Math.pow(loc_high, 2) - Math.pow(loc_low_zero, 2) + price_high - price_low);
                    var denom = (2 * Math.abs(loc_high - loc_low_zero));
                    var intersection = top / denom;

                    //grab our intersection
                    if (intersection < 0 || intersection > 1) {
                        res.push(0);
                    } else {
                        res.push(intersection);
                    }


                }

            }
        }

        res.push(1);
        for (i = 0; i < res.length; i++) {
            //console.log("intersection at " + res[i]);
        }
        var new_lo_bound;
        var new_hi_bound;
        var index;

        /*causing issues of mis-synchronization of market boundaries by not passing over new values*/
        /*now ever subject clicking recalculates the new market bounds for everyone, not just the syncronizer (keeper) - lines 456 and 467*/
        //if(id == keeper){
        for (i = 0; i < tmp.length; ++i) {
            new_lo_bound = res[i];
            new_hi_bound = res[i + 1];
            index = get_index_by_id(tmp[i].id);

            network.players[index].bound_lo = new_lo_bound;
            network.players[index].bound_hi = new_hi_bound;

            //line below did not exist before the fix..
            rs.send("update_bounds", {
                index: index,
                new_lo_bound: new_lo_bound,
                new_hi_bound: new_hi_bound
            });
        }

        //}

        return res;
    }

    /*
     * payoff = market_share * price
     */
    function payoff(index) {
        var market_share = Math.abs(network.players[index].bound_hi - network.players[index].bound_lo) * scalar_x;

        return market_share * (network.players[index].price * scalar_y);
    }

    /*
     * sorts players in descending order. bubblesort
     */
    function sort_players() {
        var grp = network.players;
        var len = network.players.length;

        for (var i = 0; i < len - 1; ++i) {
            for (var j = 0; j < ((len - 1) - i); ++j) {
                if (grp[j].loc > grp[j + 1].loc) {
                    var tmp = grp[j + 1];
                    grp[j + 1] = grp[j];
                    grp[j] = tmp;
                }
            }
        }

        network.players = grp;
    }

    /*
     * returns index in network object array of player with id 'key'
     */
    function get_index_by_id(key) {
        var res = -1;
        for (var i = 0; i < network.players.length; ++i) {
            if (network.players[i].id == key) return i;
        }
        return res;
    }

    //This takes the subject ID string and does a regex lookup to determine which subject number they are
    function get_subject_num_by_id(key) {
        return key.match(/\d+/)[0];
    }

    function get_players() {
        //if(waiting) return;
        if (id == keeper) {
            var value = network.players;
            rs.send("data_log", {
                value: value,
                curr_subperiods: curr_subperiods,
                silo_num: silo_num
            });
        }

        for (i = 0; i < network.players.length; ++i) {
            player_pos[i] = [network.players[i].loc, network.players[i].price, network.players[i].color];
        }
    }

    function log_data() {
        if (id == keeper) {
            var value = network.players;
            rs.send("data_log", {
                value: value,
                curr_subperiods: curr_subperiods,
                silo_num: silo_num
            });
        }
    }

    //x and y are bounded between 0 and 1
    //maps to a point (x, y) on the circle corresponding to this
    function map_point_to_circle(point) {
        var x = point[0];
        var y = point[1];

        var rad = 50 + (150 * y);
        var theta = x * 2 * Math.PI;


        var new_x = rad * (Math.cos(-theta)) + 225;
        var new_y = rad * (Math.sin(-theta)) + 225;

        //console.log("theta: " + theta);
        //console.log("radius: " + rad);

        //console.log ("mapped (" + x + ", " + y + ") to (" + new_x + ", " + new_y + " )");

        return [new_x, new_y, theta];
    }

    function point_to_circle(point) {
        var x = point[0];
        var y = point[1];

        var rad = 50 + (150 * y);
        var theta = x * 2 * Math.PI;


        var new_x = rad * (Math.cos(-theta)) + 225;
        var new_y = rad * (Math.sin(-theta)) + 225;
        return {
            "x": new_x,
            "y": new_y
        };
    }

    function pt_to_circle(points) {
        var new_pts = [];
        for (var i = 0; i < points.length; i++) {
            var point = points[i];
            var obj = point_to_circle(point);

            var checkx = obj["x"];
            var checky = obj["y"];

            var relX = Math.pow(checkx - 225, 2);
            var relY = Math.pow(checky - 225, 2);

            var distance = Math.sqrt(relX + relY);

            if (distance >= 200) continue;
            // console.log(obj);
            new_pts.push(obj);
        }
        return new_pts;
    }

    //time keeping 1s interval function
    function tick() {
        console.log("ticking");
        console.log(network.players);
        if (waiting) return;

        if (time <= 1) {
            $(".period").HTML = "Period: " + rs.period;
            network.players[get_index_by_id(id)].color = col;
        }

        // generate random player clicks if debug option is set
        if (r_debug) {
            new_loc = Math.random().toFixed(3);
            new_pos = Math.random().toFixed(3);
            var iterx = 0;
            var itery = 0;
            rs.send("update_loc", {
                new_loc: new_loc,
                id: id,
                iterx: iterx
            });
            rs.send("update_pos", {
                new_pos: new_pos,
                id: id,
                itery: itery
            });

            target_pos = [Number(new_loc), Number(new_pos)];
            rs.send("update_target", {
                new_loc: new_loc,
                new_pos: new_pos,
                id: id
            });
        }

        time = time + 1;

        // hope to fix any weird color overriding at start... 
        if (time == 5) {
            for (var n in network.players) {
                if (network.players[n].color == '#0066FF' && network.players[n].id != id)
                    network.players[n].color = colors[1];
            }
        }

        if (game_type == "stage") {
            var width = ((250 / (period_length / subperiods)) * time) % 250;
            $('#progBar').css('width', width + "%");
        } else {
            var width = (250 / period_length) * time;
            $('#progBar').css('width', width + "%");
        }

        if (id == keeper) rs.send("sync_time", {
            time: time
        });

        //check for end of period in continous time
        if (time >= period_length) {
            if (id == keeper) rs.send("new_period", {
                current_period: current_period
            });
        }

        if (game_type == "simultaneous") {
            sub_pay[0][curr_subperiods - 1] = network.players[0].payoff.toFixed(2);
            sub_pay[1][curr_subperiods - 1] = network.players[1].payoff.toFixed(2);

            cummulative_payoff = 0;
            for (i = 0; i < sub_pay[get_index_by_id(id)].length; ++i) {
                cummulative_payoff += Number(sub_pay[get_index_by_id(id)][i]);
            }

            if (time % (period_length / subperiods) === 0) {
                var iterx = 0;
                var itery = 0;
                rs.send("update_loc", {
                    new_loc: new_loc,
                    id: id,
                    iterx: iterx
                });
                rs.send("update_pos", {
                    new_pos: new_pos,
                    id: id,
                    itery: itery
                });

                if (id == keeper) {
                    rs.send("new_subperiod", {
                        curr_subperiods: curr_subperiods
                    });

                    if (curr_subperiods == subperiods) rs.send("new_period", {
                        current_period: current_period
                    });
                }

            }
        } else if (game_type == "stage") {

            if (allow_x && !allow_y) document.getElementById("select").innerHTML = "Choose x";
            else if (!allow_x && allow_y) document.getElementById("select").innerHTML = "Choose y";

            if (allow_x && !flag) { //reset price at beginning of new subgame and keep old location
                //new_pos = 0;
                var iterx = 0;
                var itery = 0;
                rs.send("update_pos", {
                    new_pos: new_pos,
                    id: id,
                    itery: itery
                });
                flag = 1;
            }

            if (time % (period_length / subperiods) < 1) { //at the end of every subperiod update new position on plot
                console.log("ENDING SUBPERIOD");
                curr_i += 4;
                var iterx = 0;
                var itery = 0;
                var offset = 1 / num_of_players;

                if (allow_x) {

                    rs.send("update_loc", {
                        new_loc: new_loc,
                        id: id,
                        iterx: iterx
                    });
                    allow_x = 0;
                    allow_y = 1; //switch to price subrounds

                } else if (allow_y) {
                    rs.send("update_pos", {
                        new_pos: new_pos,
                        id: id,
                        itery: itery
                    });

                    ++curr_sub_y;

                    if (curr_sub_y == price_subrounds) { //when we reach the last price subround, start a new subgame
                        if (id == keeper) rs.send("set_payoffs", {
                            curr_subperiods: curr_subperiods,
                            id: id
                        });
                        sub_pay[0][curr_subperiods - 1] = payoff(0).toFixed(3);
                        sub_pay[1][curr_subperiods - 1] = payoff(1).toFixed(3);

                        allow_x = 1;
                        allow_y = 0;

                        if (id == keeper) rs.send("update_subsetting", {
                            allow_x: allow_x,
                            allow_y: allow_y,
                            curr_sub_y: curr_sub_y
                        });

                    }

                    if (curr_sub_y == 2) {
                        sub_pay[0].shift();
                        sub_pay[1].shift();
                    }
                }

                if (id == keeper) rs.send("new_subperiod", {
                    curr_subperiods: curr_subperiods
                });

                if (curr_subperiods == subperiods) { //when we go through all subperiods, it's time for a new period
                    sub_pay[0][curr_subperiods - 1] = payoff(0).toFixed(3);
                    sub_pay[1][curr_subperiods - 1] = payoff(1).toFixed(3);
                    if (id == keeper) rs.send("new_period", {
                        current_period: current_period
                    });
                }

                if (id == keeper) {
                    rs.send("update_subsetting", {
                        allow_x: allow_x,
                        allow_y: allow_y,
                        curr_sub_y: curr_sub_y
                    });
                    rs.send("set_payoffs", {
                        curr_subperiods: curr_subperiods,
                        id: id
                    });
                }
            }
        }

        calculatePayoffs();

        var i;

        intersects = find_intersect_pts();

        //document.getElementById("total_score").innerHTML = "Total Score: " + rs.points.toFixed(3);
        //document.getElementById("curr_score").innerHTML = "Current score: " + cummulative_payoff.toFixed(3);

        //save payoff at end of round
        if (sub_pay[0][curr_subperiods - 1] === undefined) {
            sub_pay[0][curr_subperiods - 1] = payoff(0).toFixed(3);
        }

        if (sub_pay[1][curr_subperiods - 1] === undefined) {
            sub_pay[1][curr_subperiods - 1] = payoff(1).toFixed(3);
        }

        if (rs.config.show_secs_left) document.getElementById("time").innerHTML = "Time left: " + Math.ceil(period_length - time);
    }

    function calculatePayoffs() {
        for (i = 0; i < network.players.length; i++) {
            var pay = payoff(i);
            network.players[i].payoff = pay;
        }
    }

    /*
     * function for implementing % change on x and y axes. determines if dot should continue moving or not
     */
    function refresh() {
        if (waiting) return;

        var index = get_index_by_id(id);

        if ((x_rate === 0 && y_rate === 0) || game_type == "simultaneous" || game_type == "stage") {
            return;
        }

        var iterx;
        var itery;
        var diffx;
        var diffy;
        var signx;
        var signy;
        var scalex;
        var scaley;

        if (network.players[index].loc != network.players[index].target[0]) { //while we are not at our target x position
            //get difference along x
            diffx = Number(network.players[index].target[0]) - Number(network.players[index].loc);

            if (diffx < 0) signx = 1;
            else signx = 0;

            scalex = x_rate * 0.0833333;

            //if we are close enough, snap into place to avoid overshoot
            if (Math.abs(diffx) < (scalex * 2)) {
                new_loc = Number(network.players[index].target[0]);
            } else {
                //otherwise keep moving player along
                iterx = network.players[index].iterx - 1;
                if (iterx < 0) iterx = Number(0);

                //check which direction we have to move in
                if (signx) new_loc = Number(network.players[index].loc) - scalex;
                else new_loc = Number(network.players[index].loc) + scalex;
            }

            if (new_loc > 1) new_loc = 1;
            else if (new_loc < 0) new_loc = 0;

            rs.send("update_loc", {
                new_loc: new_loc,
                id: id,
                iterx: iterx
            });
        }

        if (network.players[index].pos != network.players[index].target[1]) { //while we are not at our target y position
            //get difference along y
            diffy = Number(network.players[index].target[1]) - Number(network.players[index].price);

            if (diffy < 0) signy = 1;
            else signy = 0;

            scaley = y_rate * 0.0833333;

            //if we are close enough, snap into place to avoid overshoot
            if (Math.abs(diffy) < (scaley * 2)) {
                new_pos = Number(network.players[index].target[1]);
            } else {
                //otherwise keep moving player along
                itery = network.players[index].itery - 1;
                if (itery < 0) itery = Number(0);

                if (signy) new_pos = Number(network.players[index].price) - scaley;
                else new_pos = Number(network.players[index].price) + scaley;
            }

            if (new_loc > 1) new_pos = 1;
            else if (new_loc < 0) new_pos = 0;

            if (new_pos > 1) new_pos = 1;
            if (new_pos < 0) new_pos = 0;

            rs.send("update_pos", {
                new_pos: new_pos,
                id: id,
                itery: itery
            });
        }

    }

    rs.on_load(function() {

        rs.send("config", {});

        id = rs.user_id;
        group_num = rs._group;

        for (var i = 0, l = rs.subjects.length; i < l; i++) {
            in_group.push(parseInt(rs.subjects[i].user_id));
        }
        num_of_bidders = rs.subjects.length;
        num_of_players = in_group.length;

        current_period = rs.period;
        time = 0;
        network.players = [];
        if (rs.config.subperiods != 0) game_type = rs.config.discrete_time_type;

        // start player movement refresh function
        //setInterval(tick, 1000);

        $scope.clock = SynchronizedStopWatch.instance()
            .frequency(1).onTick(tick)
            .duration(rs.config.period_length).onComplete(function() {
                rs.trigger("new_period");
                
            });

        $scope.clock.start();


        //setInterval(refresh, 300);
        setInterval(log_data, 500);
        setInterval(update_plot2, 400);
        setInterval(update_plot, 300);

        var svg = d3.select("#actionSpace");
        var player_cy = 0;
        //initialize our player objects
        for (var i = 0; i < num_of_players; ++i) {
            var player = {};
            player.loc = 0;
            player.price = 0;
            player.payoff = 0;
            player.bound_lo = 0;
            player.bound_hi = 0;
            player.id = in_group[i];
            player.valid = 1;
            player.iterx = 0;
            player.itery = 0;
            player.target = [0, 0];
            player.group = group_num;
            player.color = colors[i];
            network.players.push(player);

            var playerz = {};
            playerz.x_pos = 0;
            playerz.y_pos = 0;
            playerz.color = colors[i];
            player_xy.push(player);

            var thiscolor = colors[i];
            var num = in_group[i];
            if (id == player.id) {
                thiscolor = "#0066FF";
            }

            svg.append("circle")
                .attr("id", num)
                .attr("class", "playerCircle")
                .attr("fill", thiscolor)
                .attr("cx", 225)
                .attr("cy", 225 + player_cy)
                .attr("r", 7);

            player_cy += 10;
        }

        //prevent user input while period syncs up
        $('#myModal').modal({
            backdrop: 'static',
            keyboard: false
        });
        //$("#myModal").modal('show');


        //plot 1 on click event handler
        $("#placeholder").bind("plotclick", function(event, pos, item) {
            if (game_type == "stage") {
                if (allow_x) new_loc = pos.x.toFixed(3);
                else if (allow_y) new_pos = pos.y.toFixed(3);
            } else {
                new_loc = pos.x.toFixed(3);
                new_pos = pos.y.toFixed(3);
            }

            if (new_loc > 1) new_loc = 1;
            else if (new_loc < 0) new_loc = 0;

            if (new_pos > 1) new_pos = 1;
            if (new_pos < 0) new_pos = 0;

            //var new_circle_pos = map_to_circle_y(new_pos);
            //var new_circle_loc = map_to_circle_x(new_loc);

            var circle_pt = map_point_to_circle([new_loc, new_pos]);

            //iters no longer used..
            var iterx = 0;
            var itery = 0;
            target_pos = [Number(new_loc), Number(new_pos)];

            if (game_type == "simultaneous" || game_type == "stage") {
                //my_pos = [[new_loc, new_pos]];
            } else if (game_type == "continuous") {
                if (x_rate === 0) {
                    rs.send("update_loc", {
                        new_loc: new_loc,
                        id: id,
                        iterx: iterx
                    });
                    rs.trigger("update_my_loc", {
                        new_loc: new_loc,
                        id: id,
                        iterx: iterx
                    });
                }
                if (y_rate === 0) {
                    rs.send("update_pos", {
                        new_pos: new_pos,
                        id: id,
                        itery: itery
                    });
                    rs.trigger("update_my_pos", {
                        new_pos: new_pos,
                        id: id,
                        itery: itery
                    })
                }
                rs.send("update_target", {
                    new_loc: new_loc,
                    new_pos: new_pos,
                    id: id
                });
                rs.trigger("update_my_target", {
                    new_loc: new_loc,
                    new_pos: new_pos,
                    id: id
                });

                rs.send("update_circle", {
                    x_pos: circle_pt[0],
                    y_pos: circle_pt[1],
                    id: id
                });
                rs.trigger("update_my_circle", {
                    x_pos: circle_pt[0],
                    y_pos: circle_pt[1],
                    id: id
                });
                rs.send("update_theta", {
                    theta: circle_pt[2],
                    id: id
                });
                rs.trigger("update_my_theta", {
                    theta: circle_pt[2],
                    id: id
                });
                sort_players();
                find_intersect_pts();
                var index = get_index_by_id(id);

                //r.send("update_bounds", { index:index, new_lo_bound:new_lo_bound, new_hi_bound:new_hi_bound } );

                var pay = payoff(index);
                rs.send("update_payoff", {
                    pay: pay,
                    index: index
                });
                rs.trigger("update_my_payoff", {
                    pay: pay,
                    index: index
                });
            }

            update_plot();
        });

        //plot 1 on hover event handler for drawing crosshairs
        $("#actionCircle").on("mousemove", function(e) {
            var parentOffset = $(this).parent().offset();

            //or $(this).offset(); if you really just want the current element's offset

            var relX = e.pageX - parentOffset.left;
            var relY = e.pageY - parentOffset.top;

            //this should calculate the angle 
            var dY = 225 - relY;
            var dX = relX - 225;
            var theta = Math.atan2(dY, dX);

            var endX = (Math.cos(theta) * 200) + 225;
            var endY = (-Math.sin(theta) * 200) + 225;


            if (game_type == "stage") {
                if (allow_x && !allow_y) {
                    a = relX;
                } else if (!allow_x && allow_y) {
                    b = relY;
                }
            } else {
                a = relX;
                b = relY;
            }

            mouse = [a, b];

            intersects[num_of_players + 1] = a;

            var distance = 0;
            distance = Math.sqrt((relX - 225) * (relX - 225) + (relY - 225) * (relY - 225));

            if (distance > 200) return;
            var svg = d3.select("#actionSpace");

            var color = network.players[get_index_by_id(id)].color;

            $("#hoverLine").remove();
            var hoverLine = svg.append("line")
                .attr("id", "hoverLine")
                .attr("x1", 225)
                .attr("y1", 225)
                .attr("x2", endX)
                .attr("y2", endY)
                .attr("stroke-width", 2)
                .attr("stroke", color);
        });

        $("#actionCircle").on("click", function(e) {

            var parentOffset = $(this).parent().offset();

            //grabs the X,Y of the mouseclick in the div
            var relX = e.pageX - parentOffset.left;
            var relY = e.pageY - parentOffset.top;

            //console.log("x: " + relX + ", y: " + relY);

            var distance;
            distance = Math.sqrt((relX - 225) * (relX - 225) + (relY - 225) * (relY - 225));
            if (distance > 200) return; //if we're outside of the circle radius, let's stop now.
            myX = relX;
            myY = relY;

            //this should calculate the angle 
            var dY = 225 - relY;
            var dX = relX - 225;
            var theta = Math.atan2(dY, dX);

            if (theta < 0) {
                theta = Math.PI + (Math.PI + theta);
            }


            if (game_type == "stage") {
                if (allow_x) new_loc = theta / (2 * Math.PI);
                else if (allow_y) new_pos = (distance - innerRadius) / 150;
            } else {
                new_loc = theta / (2 * Math.PI);
                new_pos = (distance - innerRadius) / 150;
            }

            console.log("new_loc = " + new_loc);
            console.log("new_pos = " + new_pos);
            console.log("angle   = " + theta);

            if (new_pos > 1) new_pos = 1;
            if (new_pos < 0) new_pos = 0;

            //iters no longer used..
            var iterx = 0;
            var itery = 0;
            target_pos = [Number(new_loc), Number(new_pos)];

            if (game_type == "simultaneous" || game_type == "stage") {
                my_pos = [
                    [new_loc, new_pos]
                ];
            } else if (game_type == "continuous") {
                var obj = {
                    id: id,
                    new_loc: new_loc,
                    new_pos: new_pos,
                    x_pos: myX,
                    y_pos: myY,
                    theta: theta,
                    iterx: iterx,
                    itery: itery,
                    x_rate: x_rate,
                    y_rate: y_rate
                }
                rs.send("update_setting", obj);
                rs.trigger("update_my_setting", obj);

                if (x_rate === 0 && y_rate === 0) {
                    rs.send("update_loc", {
                        new_loc: new_loc,
                        id: id,
                        iterx: iterx
                    });
                    rs.trigger("update_my_loc", {
                        new_loc: new_loc,
                        id: id,
                        iterx: iterx
                    });

                    rs.send("update_pos", {
                        new_pos: new_pos,
                        id: id,
                        itery: itery
                    });
                    rs.trigger("update_my_pos", {
                        new_pos: new_pos,
                        id: id,
                        itery: itery
                    });

                    rs.send("update_circle", {
                        x_pos: myX,
                        y_pos: myY,
                        id: id
                    });
                    rs.trigger("update_my_circle", {
                        x_pos: myX,
                        y_pos: myY,
                        id: id
                    });

                } else if (x_rate === 0) {
                    rs.send("update_loc", {
                        new_loc: new_loc,
                        id: id,
                        iterx: iterx
                    });
                    rs.trigger("update_my_loc", {
                        new_loc: new_loc,
                        id: id,
                        iterx: iterx
                    });

                    rs.send("update_circle_x", {
                        x_pos: myX,
                        id: id
                    });
                    rs.trigger("update_my_circle_x", {
                        x_pos: myX,
                        id: id
                    });
                } else if (y_rate === 0) {
                    rs.send("update_circle_y", {
                        y_pos: myY,
                        id: id
                    });
                    rs.trigger("update_my_circle_y", {
                        y_pos: myY,
                        id: id
                    });

                    rs.send("update_pos", {
                        new_pos: new_pos,
                        id: id,
                        itery: itery
                    });
                    rs.trigger("update_my_pos", {
                        new_pos: new_pos,
                        id: id,
                        itery: itery
                    });
                }
                rs.send("update_theta", {
                    theta: theta,
                    id: id
                });
                rs.trigger("update_my_theta", {
                    theta: theta,
                    id: id
                });
                rs.send("update_target", {
                    new_loc: new_loc,
                    new_pos: new_pos,
                    id: id
                });
                rs.trigger("update_my_target", {
                    new_loc: new_loc,
                    new_pos: new_pos,
                    id: id
                })

                sort_players();
                find_intersect_pts();
                var index = get_index_by_id(id);

                //r.send("update_bounds", { index:index, new_lo_bound:new_lo_bound, new_hi_bound:new_hi_bound } );

                var pay = payoff(index);
                rs.send("update_payoff", {
                    pay: pay,
                    index: index
                });
                rs.trigger("update_my_payoff", {
                    pay: pay,
                    index: index
                })
            }

            //update_plot();
        });

        //plot 1 on hover event handler for drawing crosshairs
        $("#placeholder").bind("plothover", function(event, pos, item) {
            var a, b;

            if (game_type == "stage") {
                if (allow_x && !allow_y) {
                    a = pos.x.toFixed(3);
                } else if (!allow_x && allow_y) {
                    b = pos.y.toFixed(3);
                }
            } else {
                a = pos.x.toFixed(3);
                b = pos.y.toFixed(3);
            }

            mouse = [a, b];

            intersects[num_of_players + 1] = a;

            options.xaxis.ticks = intersects;
            options.yaxis.ticks = [0, b, 1.5];
        });

    });

    rs.recv("rdebug", function(uid, msg) {
        r_debug = msg.mode;
    });

    rs.recv("data_log", function(uid, msg) {
        //intentionally blank    
    });

    rs.recv("set_payoffs", function(uid, msg) {
        intersects = find_intersect_pts();

        for (i = 0; i < network.players.length; ++i) {
            var pay = payoff(i);
            var index = i;
            rs.send("update_payoff", {
                pay: pay,
                index: index
            });
        }
    });

    rs.recv("new_subperiod", function(uid, msg) {
        if (msg.curr_subperiods !== null) {
            curr_subperiods = msg.curr_subperiods + 1;
            cummulative_payoff = 0;

            for (var i = 0; i < sub_pay[get_index_by_id(id)].length; ++i)
                cummulative_payoff += Number(sub_pay[get_index_by_id(id)][i]);

            document.getElementById("curr_score").innerHTML = "Current score: " + cummulative_payoff.toFixed(3);
        } else return;
    });

    rs.on("new_period", function(msg) {
        clearInterval(log_data);
        clearInterval(update_plot2);
        clearInterval(update_plot);
        waiting = 1;

        //count up sub payoffs for total period payoff for discrete types
        if (game_type != "continuous") {
            cummulative_payoff = 0;
            for (var i = 0; i < sub_pay[get_index_by_id(id)].length; ++i)
                cummulative_payoff += Number(sub_pay[get_index_by_id(id)][i]);
        }

        if (paid_round) rs.add_points(cummulative_payoff);
        document.getElementById("curr_score").innerHTML = "Current score: " + cummulative_payoff.toFixed(3);

        $("#myModal").modal('show');
        rs.next_period(5);
    });

    rs.recv("update_player", function(uid, msg) {
        if (msg.id !== null) {
            network.players[get_index_by_id(msg.id)].loc = Number(msg.new_loc);
            network.players[get_index_by_id(msg.id)].iterx = Number(0);
        }
    });

    rs.recv("update_payoff", function(uid, msg) {
        console.log("updating a payoff" + msg.index);
        if (msg.pay !== null) {
            network.players[msg.index].payoff = Number(msg.pay);
        }
    });

    rs.on("update_my_payoff", function(msg) {
        console.log("updating my payoff");
        if (msg.pay !== null) {
            network.players[msg.index].payoff = Number(msg.pay);
        }
    });

    rs.recv("update_bounds", function(uid, msg) {

        if (msg.new_lo_bound !== null) {
            network.players[msg.index].bound_lo = msg.new_lo_bound;
        }

        if (msg.new_hi_bound !== null) {
            network.players[msg.index].bound_hi = msg.new_hi_bound;
        }
    });

    rs.recv("update_iterx", function(uid, msg) {
        if (msg.iterx !== null) {
            network.players[get_index_by_id(msg.id)].iterx = Number(Math.abs(msg.target_x - network.players[get_index_by_id(msg.id)].loc) / (0.025 * (x_rate / 0.5))).toFixed(3);
        }
    });

    rs.recv("update_itery", function(uid, msg) {
        if (msg.itery !== null) {
            network.players[get_index_by_id(msg.id)].itery = Number(Math.abs(msg.target_y - network.players[get_index_by_id(msg.id)].price) / (0.025 * (y_rate / 0.5))).toFixed(3);
        }
    });

    rs.recv("update_loc", function(uid, msg) {
        if (msg.new_loc !== null) {
            network.players[get_index_by_id(msg.id)].loc = Number(msg.new_loc);
            network.players[get_index_by_id(msg.id)].iterx = Number(Math.abs(msg.new_loc - network.players[get_index_by_id(msg.id)].loc) / (0.025 * (x_rate / 0.5))).toFixed(3);

            player_pos[get_index_by_id(msg.id)] = [msg.new_loc, network.players[get_index_by_id(msg.id)].price, network.players[get_index_by_id(msg.id)].color];
        }
    });
    rs.on("update_my_loc", function(msg) {
        console.log("updating my location");
        if (msg.new_loc !== null) {
            network.players[get_index_by_id(msg.id)].loc = Number(msg.new_loc);
            network.players[get_index_by_id(msg.id)].iterx = Number(Math.abs(msg.new_loc - network.players[get_index_by_id(msg.id)].loc) / (0.025 * (x_rate / 0.5))).toFixed(3);

            player_pos[get_index_by_id(msg.id)] = [msg.new_loc, network.players[get_index_by_id(msg.id)].price, network.players[get_index_by_id(msg.id)].color];
        }
    });

    rs.recv("update_pos", function(uid, msg) {
        if (msg.new_pos !== null) {
            network.players[get_index_by_id(msg.id)].price = Number(msg.new_pos);
            network.players[get_index_by_id(msg.id)].itery = Number(Math.abs(msg.new_pos - network.players[get_index_by_id(msg.id)].price) / (0.025 * (y_rate / 0.5))).toFixed(3);

            player_pos[get_index_by_id(msg.id)] = [network.players[get_index_by_id(msg.id)].loc, msg.new_pos, network.players[get_index_by_id(msg.id)].color];
        }
    });
    rs.on("update_my_pos", function(msg) {
        console.log("updating my price");
        if (msg.new_pos !== null) {
            network.players[get_index_by_id(msg.id)].price = Number(msg.new_pos);
            network.players[get_index_by_id(msg.id)].itery = Number(Math.abs(msg.new_pos - network.players[get_index_by_id(msg.id)].price) / (0.025 * (y_rate / 0.5))).toFixed(3);

            player_pos[get_index_by_id(msg.id)] = [network.players[get_index_by_id(msg.id)].loc, msg.new_pos, network.players[get_index_by_id(msg.id)].color];
        }
    });


    rs.recv("update_target", function(uid, msg) {
        console.log("recieving update target");
        if (msg.id !== null) {
            network.players[get_index_by_id(msg.id)].iterx = Number(Math.abs(msg.new_loc - network.players[get_index_by_id(msg.id)].loc) / (0.025 * (x_rate / 0.5))).toFixed(3);
            network.players[get_index_by_id(msg.id)].itery = Number(Math.abs(msg.new_pos - network.players[get_index_by_id(msg.id)].price) / (0.025 * (y_rate / 0.5))).toFixed(3);
        }
        if (msg.new_loc !== null) {
            network.players[get_index_by_id(msg.id)].target[0] = Number(msg.new_loc);
        }
        if (msg.new_pos !== null) {
            network.players[get_index_by_id(msg.id)].target[1] = Number(msg.new_pos);
        }

    });
    rs.on("update_my_target", function(msg) {
        console.log("updating my own target");
        if (msg.id !== null) {
            network.players[get_index_by_id(msg.id)].iterx = Number(Math.abs(msg.new_loc - network.players[get_index_by_id(msg.id)].loc) / (0.025 * (x_rate / 0.5))).toFixed(3);
            network.players[get_index_by_id(msg.id)].itery = Number(Math.abs(msg.new_pos - network.players[get_index_by_id(msg.id)].price) / (0.025 * (y_rate / 0.5))).toFixed(3);
        }
        if (msg.new_loc !== null) {
            network.players[get_index_by_id(msg.id)].target[0] = Number(msg.new_loc);
        }
        if (msg.new_pos !== null) {
            network.players[get_index_by_id(msg.id)].target[1] = Number(msg.new_pos);
        }

    });
    /*
        Circle redwood util functions
    */
    rs.recv("update_theta", function(uid, msg) {
        if (msg.theta !== null) {

            var index = get_index_by_id(msg.id);

            network.players[index].theta = Number(msg.theta);
            network.players[index].loc = Number(msg.theta / (2 * Math.PI));
        }
    });
    rs.on("update_my_theta", function(msg) {
        if (msg.theta !== null) {

            var index = get_index_by_id(id);

            network.players[index].theta = Number(msg.theta);
            network.players[index].loc = Number(msg.theta / (2 * Math.PI));
            update_plot();
        }
    });
    rs.recv("update_circle_x", function(uid, msg) {
        if (msg.x_pos !== null) {
            network.players[get_index_by_id(msg.id)].loc = Number(msg.new_loc);

            var index = get_index_by_id(msg.id);

            player_xy[index].x_pos = msg.x_pos;
            $("#" + index).attr("cx", msg.x_pos);
            update_plot();
        }
    });
    rs.on("update_my_circle_x", function(msg) {
        if (msg.x_pos !== null) {
            var index = get_index_by_id(id);

            network.players[index].loc = Number(msg.new_loc);
            player_xy[index].x_pos = msg.x_pos;
            $("#" + index).attr("cx", msg.x_pos);
            update_plot();
        }
    });
    rs.recv("update_circle_y", function(uid, msg) {
        if (msg.y_pos !== null) {
            var index = get_index_by_id(msg.id);
            player_xy[index].y_pos = msg.y_pos;
            $("#" + index).attr("cy", msg.y_pos);
            update_plot();
        }
    });
    rs.recv("update_my_circle_y", function(msg) {
        if (msg.y_pos !== null) {
            var index = get_index_by_id(id);
            player_xy[index].y_pos = msg.y_pos;
            $("#" + index).attr("cy", msg.y_pos);
            update_plot();
        }
    });

    rs.recv("update_circle", function(uid, msg) {
        if (msg !== null) {

            var index = get_index_by_id(msg.id);


            player_xy[index].x_pos = msg.x_pos;
            player_xy[index].y_pos = msg.y_pos;

            $("#" + msg.id).attr("cy", msg.y_pos);
            $("#" + msg.id).attr("cx", msg.x_pos);
            update_plot();
        }
    });

    rs.on("update_my_circle", function(msg) {
        if (msg !== null) {

            var index = get_index_by_id(msg.id);


            player_xy[index].x_pos = msg.x_pos;
            player_xy[index].y_pos = msg.y_pos;

            $("#" + msg.id).attr("cy", msg.y_pos);
            $("#" + msg.id).attr("cx", msg.x_pos);
            update_plot();

        }
    });

    /* 
        This is the new handler for updating 
        the state of an experiment after receiving
        a new message determining that a new player has made a move
        the message object looks like this:
                var obj = {
                    id: id,
                    new_loc: new_loc,
                    new_pos: new_pos,
                    x_pos: myX,
                    y_pos: myY,
                    theta: theta,
                    iterx: iterx,
                    itery: itery
                    x_rate: x_rate,
                    y_rate: y_rate
                }
    */
    rs.recv("update_setting", function (uid, msg) {
        if (msg !== null) {
            if (x_rate === 0 && y_rate === 0) {

            } else if (x_rate === 0) {

            } else if (y_rate === 0) {

            }
        }
    });
    rs.on("update_my_setting", function (msg) {
        if (msg !== null) {

        }
    });




    rs.recv("update_subsetting", function(uid, msg) {
        //console.log(msg);
        if (msg.allow_x !== null) allow_x = msg.allow_x;
        if (msg.allow_y !== null) allow_y = msg.allow_y;
        if (msg.curr_sub_y !== null) curr_sub_y = msg.curr_sub_y;

        if (curr_sub_y == price_subrounds) {
            curr_sub_y = 0;
            flag = 0;
        }
    });

    rs.recv("config", function(uid, msg) {
        //assign new synchronizer
        if (!chosen) keeper = in_group[Math.floor(Math.random() * in_group.length)];
        chosen = true;

        //set all config values
        subperiods = rs.config.subperiods;
        period_length = rs.config.period_length;
        console.log("period length=" + period_length)
        t = rs.config.t;
        x_rate = rs.config.percent_cpsx;
        y_rate = rs.config.percent_cpsy;

        if (rs.config.payoff_func === 0) {
            transport_cost = linear_cost;
        } else {
            transport_cost = quadratic_cost;
            quadratic = true;
            linear = false;
        }

        paid_round = rs.config.paid;
        if (rs.config.subperiods != 0) game_type = rs.config.discrete_time_type;

        debug1 = rs.config.payoff_debug;
        debug2 = rs.config.payoff_debug2;
        debug3 = rs.config.payoff_debug3;

        flow_opts = rs.config.p2_options;

        scalar_x = rs.config.scale_x;
        scalar_y = rs.config.scale_y;

        price_subrounds = rs.config.num_sp_settingy;

        payoff_mirror = rs.config.payoff_mirror;

        rs.send("setup", {
            chosen: chosen,
            keeper: keeper
        });
    });

    rs.recv("setup", function(uid, msg) {
        if (msg.chosen !== null) chosen = msg.chosen;
        if (msg.keeper !== null) keeper = msg.keeper;

        if (id == keeper) {
            var tmp = network.players;
            rs.send("sync_net", {
                tmp: tmp
            });
            rs.send("sync_time", {
                time: time
            });
        }

        col = '#0066FF'; //we always want to be blue

        document.getElementById("color").style.color = col;
        document.getElementById("period").innerHTML = "Period: " + rs.period;

        var tmp_id = "";
        for (var i = 0; i < id.length - 15; ++i) {
            tmp_id += id[i];
        }
        document.getElementById("subj").innerHTML = "Subject: " + tmp_id;

        //remove progress bar for continuous game types
        //if(game_type == "continuous") document.getElementById("prog").style.visibility="hidden";
        //if(rs.config.show_secs_left === 0) document.getElementById("time").style.visibility="hidden";

        if (paid_round) document.getElementById("paid").innerHTML = "Scoring Period";
        else document.getElementById("paid").innerHTML = "Unpaid Practice Period";

        options = {
            series: {
                shadowSize: 0,
                lines: {
                    fill: false,
                    show: false
                }
            },
            grid: {
                hoverable: true,
                clickable: true
            },
            yaxis: {
                min: 0,
                max: 1,
                position: "left",
                ticks: 1,
                tickDecimals: 2,
                tickColor: '#858585'
            },
            xaxis: {
                min: 0,
                max: 1,
                ticks: 1,
                tickDecimals: 3,
                tickColor: '#858585',
                tickFormatter: function(val, axis) {
                    return val.toFixed(axis.tickDecimals);
                }
            }
        };

        p2_options = {
            series: {
                shadowSize: 0,
                lines: {
                    fill: false,
                    show: true
                }
            },
            grid: {
                hoverable: false,
                clickable: false
            },
            yaxis: {
                min: 0,
                ticks: 2,
                tickColor: '#858585',
                position: "right"
            },
            xaxis: {
                min: 0,
                max: 30,
                tickColor: '#858585',
                ticks: 0
            }
        };

        $("#myModal").modal('hide');
        waiting = 0;
    });

    rs.recv("sync_net", function(uid, msg) {
        for (var i = 0; i < network.players.length; ++i) {
            network.players[i] = msg.tmp[i];
        }
    });

    rs.recv("sync_time", function(uid, msg) {
        if (msg.time !== null) {
            time = msg.time;
        }
    });

    rs.recv("get_silo", function(uid, msg) {
        id = r.username;
        if (msg.curr_silo !== null && id == msg.id && msg.id !== null) {
            silo_num = msg.curr_silo;
        }
    });

}]);