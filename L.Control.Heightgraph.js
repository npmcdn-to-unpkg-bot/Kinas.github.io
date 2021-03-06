L.Control.Heightgraph = L.Control.extend({
    options: {
        position: "topleft",
        width: 800,
        height: 125,
        margins: {
            top: 45,
            right: 20,
            bottom: 30,
            left: 50
        }
    },
    onAdd: function(map) {
        var opts = this.options;
        var controlDiv = this._container = L.DomUtil.create('div', 'heightGraph');
        //controlDiv.title = 'Height Graph Profile';
        this._map = map;
        this._initToggle();
        this._cont = d3.select(controlDiv);
        // create combobox for selection
        var selection = document.createElement("select");
        selection.setAttribute("class","selection");
        this._container.appendChild(selection);
        return controlDiv;
    },
    onRemove: function(map) {
        this._container = null;
    },
    addData: function(data, profileType) {
        this._profileType = profileType;
        this._selectionvalue = this._selection();
        this._distances = this._calcDistances(data);
        this._heightvalue = this._calculateHeightType(data).height;
        this._type = this._calculateHeightType(data).type;
        this._dynamicLegend = this._updateLegend(this._type, this._profileType);
        this._waypointPosition = this._calculateHeightType(data).wpFeatPos;
        this._polygonData = this._updateBarData(this._heightvalue, this._type, this._profileType, data);
        this._waypointData = this._updateWaypointData(this._distances, this._heightvalue);
        this._createSVG = this._createBarChart(this._polygonData, this._waypointData, this._cont, this._heightvalue, this._dynamicLegend);
    },
    _initToggle: function() {
        /* inspired by L.Control.Layers */
        var container = this._container;
        //Makes this work on IE10 Touch devices by stopping it from firing a mouseout event when the touch is released
        container.setAttribute('aria-haspopup', true);
        if (!L.Browser.touch) {
            L.DomEvent.disableClickPropagation(container);
            //.disableScrollPropagation(container);
        } else {
            L.DomEvent.on(container, 'click', L.DomEvent.stopPropagation);
        }
        //this._collapse();
        // if (!L.Browser.android) {
        //     L.DomEvent.on(container, 'click', this._expand, this);
        // }
    },
    _expand: function() {
        if (this._container.className.indexOf('heightGraph-collapsed') > -1) {
            this._container.className = this._container.className.replace(' heightGraph-collapsed', '');
        } else {
            L.DomUtil.addClass(this._container, 'heightGraph-collapsed');
        }
    },
    _collapse: function() {
        L.DomUtil.addClass(this._container, 'heightGraph-collapsed');
    },
    /*
     * Reset data
     */
    _clearData: function() {
        this._data = null;
        this._dist = null;
        this._maxElevation = null;
    },
    /*
     * Reset data and display
     */
    clear: function() {
        this._clearData();
        if (!this._areapath) {
            return;
        }
        // workaround for 'Error: Problem parsing d=""' in Webkit when empty data
        // https://groups.google.com/d/msg/d3-js/7rFxpXKXFhI/HzIO_NPeDuMJ
        //this._areapath.datum(this._data).attr("d", this._area);
        this._areapath.attr("d", "M0 0");
        this._x.domain([0, 1]);
        this._y.domain([0, 1]);
        this._updateAxis();
    },
    _selection: function(){
        var value="steepness";
        var map = this._map;
        d3.select(".selection")
        .on("change", function() {
            //$( ".heightgraph" ).remove();
            d3.select("svgSec").remove();
            var div = document.getElementsByClassName("background");
            div[0].remove();
            var profileType = this.value;
            hg.addData(geojson, profileType);
        })
          .selectAll("option")
            .data([
              "steepness",
              "speed",
              "surfaces",
              "waytypes",
              "none"
            ])
          .enter().append("option")
            .attr("value", function(d) { return d; })
            .text(function(d) { return d; });
    },
    /**
     * Returns distance between each coordinate of Linestring
     * @param {FeatureCollection} a
     * @returns {Number|Array| Object} Object that contains distances between coordinates, the coordinates, and sum of distances as totaldistance
     */
    _calcDistances: function(a) {
        console.log(a)
        distances = {};
        var first, calc;
        //var wpList=[];
        distances.distance = [];
        distances.wpDistance = [];
        var featureCollectionlength = a.length
        var featureLength = a.features.length;
        distances.coordsOfDist = [];
        for (var i = 0; i < featureLength; i++) {
            var coordLength = a.features[i].geometry.coordinates.length;
            for (var j = 0; j < coordLength - 1; j++) {
                var g = new L.LatLng(a.features[i].geometry.coordinates[j][1], a.features[i].geometry.coordinates[j][0]);
                // catch steps between features
                if (j == 0 && i > 0) {
                    calc = last.distanceTo(g);
                    distances.distance.push(calc);
                    distances.coordsOfDist.push([last, g]);
                }
                var h = new L.LatLng(a.features[i].geometry.coordinates[j + 1][1], a.features[i].geometry.coordinates[j + 1][0]);
                calc = g.distanceTo(h);
                distances.distance.push(calc);
                distances.coordsOfDist.push([g, h]);
                // save last
                if (j == coordLength - 2) {
                    last = h;
                }
            }
        }
        distances.totaldistance = distances.distance.reduce(function(pv, cv) {
            return pv + cv;
        }, 0);
        console.log(distances)
        return distances;
    },
    /**
     * Returns the values (height, profileType-option(steepness, speed,...)) of the FeatureCollection as Array in list
     * @param {FeatureCollection} a
     * @returns {Number|Array|Object} list with height values and steepness values as array
     */
    _calculateHeightType: function(a) {
        var height = [];
        var type = [];
        var profileType = this._profileType;
        for (var i = 0; i < a.features.length; i++) {
            var coordNumber = a.features[i].geometry.coordinates.length;
            for (var j = 0; j < coordNumber; j++) {
                height.push(a.features[i].geometry.coordinates[j][2]);
                if (profileType=="steepness" && typeof(a.features[i].properties.steepness)!=="undefined"){
                    type.push(a.features[i].properties.steepness);
                } if (profileType=="waytypes" && typeof(a.features[i].properties.waytype)!=="undefined") {
                    type.push(a.features[i].properties.waytype);
                    console.log("done")
                } if (profileType=="none") {
                    type.push("none");
                } if (profileType=="surfaces" && typeof(a.features[i].properties.surface)!=="undefined") {
                    type.push(a.features[i].properties.surface);
                }
            }
        }
        var list = {
            height: height,
            type: type
        };
        console.log(list)
        return list;
    },
    /**
     * Returns values of steepness as Array without duplicates 
     * @param {Array} a: values of profileType (steepness, speed, watypes,...) of all coords
     * @param {String} b: profileType(steepness, speed, waytypes)
     * @returns {Array} list with steepness color and text as array
     */
    _updateLegend: function(a,b) {
        var legendList = [];
        var text=[];
        var color=[];
        //remove duplicates
        var cleanList = a.filter(function(elem, index) {
            return index == a.indexOf(elem);
        });

        function sortNumber(a, b) {
            return a - b;
        }
        cleanList.sort(sortNumber);
        for (var i = 0; i < cleanList.length; i++) {
            if (b=="steepness"){
                var j = cleanList[i] - 5;
                legendList.push(SteepnessType[cleanList[i]][j]);
            } if(b=="none"){
                legendList[i]= {text: "", color: "none"};
            } if(b=="waytypes"){
                legendList[i] = {text: WayType[cleanList[i]], color: WayTypeColors[cleanList[i]]};
            } if(b=="surfaces"){
                legendList[i] = {text: SurfaceType[cleanList[i]], color: SurfaceTypeColors[cleanList[i]]};
            }
        }
        console.log(legendList)
        return legendList;
    },
    /**
     * Returns list with four x and y coordinates for svg-path (Polygon) and type
     * @param {Array} a: heightvalue
     * @param {Array} type of profile(steepness, speed, waytypes)
     * @param {FeatureCollection}: data 
     * @returns {Number|Array|Object} list with coordinates and steepness values as array
     */
    _updateBarData: function(a, type, value, data) {
        var list = [];
        var wplist = [];
        var adddist = [0];
        var count = a.length;
        var color;
        var featureslength= data.features.length;
        for (var i = 0; i < count; i++) {
            for (var j= 0; j <featureslength;j++){
                adddist[i + 1] = adddist[i] + distances.distance[i];
                if (value=="steepness" && typeof(data.features[j].properties.steepness)!=="undefined"){
                    color= SteepnessType[type[i]][type[i] - 5].color;
                } if (value=="none") {
                     color= "black";
                } if (value=="waytypes" && typeof(data.features[j].properties.waytype)!=="undefined") {
                     color= WayTypeColors[type[i]];
                } if (value=="surfaces" && typeof(data.features[j].properties.surface)!=="undefined") {
                     color= SurfaceTypeColors[type[i]];
                }
            }
            list.push({
                coords: [{
                    x: adddist[i],
                    y: a[i]
                }, {
                    x: adddist[(i + 1 == count) ? i : i + 1],
                    y: a[(i + 1 == count) ? i : i + 1]
                }, {
                    x: adddist[(i + 1 == count) ? i : i + 1],
                    y: d3.min(a)
                }, {
                    x: adddist[i],
                    y: d3.min(a)
                }],
                type: type[i],
                color: color,
                LatLng: distances.coordsOfDist[i]
            });
        }
        console.log(list)
        return list;
    },
    /**
     * Returns list with two x and y coordinates for svg-path (Line and circle)
     * @param {Array|Object} a: distances
     * @param {Array} b: heightvalue
     * @returns {Number|Array|Object} list with coordinates as array
     */
    _updateWaypointData: function(a, b) {
        var list = [];
        var length = a.wpDistance.length;
        for (var i = 0; i < length; i++) {
            list.push({
                wpCoords: [{
                    x: a.wpDistance[i],
                    y: d3.min(b)
                }, {
                    x: a.wpDistance[i],
                    y: (d3.max(b) / 2)
                }]
            });
        }
        return list;
    },
    _showMarker: function(ll, height, heightvalue, color) {
        var layerpoint = this._map.latLngToLayerPoint(ll);
        var normalizedAlt = height / (d3.max(heightvalue) * 5) * height;
        var normalizedY = layerpoint.y - normalizedAlt;
        if (!this._mouseHeightFocus) {
            var heightG = d3.select(".leaflet-overlay-pane svg").append("g");
            this._mouseHeightFocus = heightG.append('svg:line').attr('class', 'height-focus line').attr('x2', '0').attr('y2', '0').attr('x1', '0').attr('y1', '0');
            this._mouseHeightFocusLabel = heightG.append("svg:text").attr("class", "height-focus-label");
            this._mouseHeightFocusLabelRect = heightG.insert("rect", "text").attr("class", "height-focus-label-rect").attr("y", "-7").attr("x", "-1");
            var pointG = this._pointG = heightG.append("g").attr('class', 'height-focus circle');
            pointG.append("svg:circle").attr("r", 5).attr("cx", 0).attr("cy", 0).attr("class", "height-focus circle-lower");
        }
        this._mouseHeightFocus.attr("x1", layerpoint.x).attr("x2", layerpoint.x).attr("y1", layerpoint.y).attr("y2", normalizedY);
        this._pointG.attr("transform", "translate(" + layerpoint.x + "," + layerpoint.y + ")").attr('fill', color);
        this._mouseHeightFocusLabelRect.attr("x", layerpoint.x).attr("y", normalizedY);
        this._mouseHeightFocusLabel.attr("x", layerpoint.x + 3).attr("y", normalizedY + 11).text(height + " m");
    },
    /**
     * @param {Object} polygonData: (x,y-coords, steepness)
     * @param {Object} waypointData: (x,y-coords)
     * @param {Array} heightvalue: heightvalue of each coordinate
     * @param {Object} dynamicLegend: values for legend (text and color)
     */
    _createBarChart: function(polygonData, waypointData, container, heightvalue, dynamicLegend) {
        //SVG area
        var margin = this.options.margins,
            width = this.options.width - margin.left - margin.right,
            height = 180 - margin.top - margin.bottom;
        var x = d3.scale.linear().range([0, width]).domain([0, distances.totaldistance]);
        var y = d3.scale.linear().range([height, 0]).domain(d3.extent(heightvalue, function(d) {
            return d;
        }));
        var xAxis = d3.svg.axis().scale(x).orient("bottom").ticks(8).tickFormat(function(d) {
            return d / 1000;
            // var prefix = d3.formatPrefix(d);
            // return prefix.scale(d) //+ prefix.symbol;
        });
        var yAxis = d3.svg.axis().scale(y).orient("left").ticks(8);
        var tip = d3.tip().attr('class', 'd3-tip').offset([-10, 0]).html(function(d) {
            return ((Math.round(((d.coords[0].y + d.coords[1].y) / 2) * 100) / 100) + " m");
        });
        var tipDist = d3.tip().attr('class', 'd3-tip').offset([-10, 0]).html(function(d) {
            return (d);
        });
        var svgSec = d3.select(this._container).append("svg").attr("class", "background").attr("width", width + margin.left + margin.right).attr("height", height + margin.top + margin.bottom).append("g").attr("transform", "translate(" + margin.left + "," + margin.top + ")");
        // axes and axes labels
        svgSec.append('g').attr("transform", "translate(0," + height + ")") // create a <g> element
            .attr('class', 'x axis') // specify classes
            .call(xAxis);
        svgSec.append('g').attr('class', 'y axis').call(yAxis);
        var xAxisText = svgSec.append("text").attr('class', 'AxisText') // text label for the x axis
            .attr("x", width / 2).attr("y", height + 27).text("km");
        var yAxisText = svgSec.append("text").attr('class', 'AxisText') // text label for the y axis
            .attr("x", -20).attr("y", height - height - 10).text("hm");
        // scale data (polygon-path)
        var polygon = d3.svg.line().x(function(d) {
            return x(d.x);
        }).y(function(d) {
            return y(d.y);
        });
        // bar chart as path
        svgSec.selectAll('hpath').data(polygonData).enter().append('path').attr('class', 'bars').attr('d', function(d) {
            return polygon(d.coords);
        }).attr('fill', function(d) {
            return (d.color);
        }).on('mouseover', handleMouseOver).on("mouseout", handleMouseOut).on("mousemove", mousemove);
        // focus line
        var focus = svgSec.append("g").attr("class", "focus");
        focus.append("text").attr("x", 5).attr("dy", ".35em");
        focus.insert("rect", "text").attr("y", "-7").attr("x", "-1");
        var focusLineGroup = svgSec.append("g").attr("class", "focusLine");
        var focusLine = focusLineGroup.append("line").attr("x1", 10).attr("x2", 10).attr("y1", y(d3.max(heightvalue))).attr("y2", y(d3.min(heightvalue)));
        // waypoints line
        svgSec.selectAll('linePath').data(waypointData).enter().append('path').attr('class', 'wpLine').attr('d', function(d) {
            return polygon(d.wpCoords);
        });
        svgSec.selectAll('wpText').data(waypointData).enter().append("text").attr("class", "wp-text").attr("dx", function(d) {
            return x(d.wpCoords[1].x) - 3.5;
        }).attr("dy", function(d) {
            return y(d.wpCoords[1].y - 3);
        }).text(function(d, i) {
            return i + 1;
        });
        // legend
        var legendRectSize = 7;
        var legendSpacing = 4;
        //legendBox.append(legend);
        var legend = svgSec.selectAll('.legend').data(dynamicLegend).enter().append('g').attr('class', 'legend').attr('transform', function(d, i) {
            var height = legendRectSize + legendSpacing;
            var offset = height * 2;
            var horz = -2 * legendRectSize;
            var vert = i * height - offset;
            return 'translate(' + horz + ',' + vert + ')';
        });
        legend.append('rect').attr('class', 'legend-rect').attr('x', width + 20).attr('y', 8).style('fill', function(d, i) {
            return (d.color);
        });
        legend.append('text').attr('class', 'legend-text').attr('x', width + 30).attr('y', 15).text(function(d, i) {
            return d.text;
        });
        //line top border
        var borderTopLine = d3.svg.line().x(function(d) {
            return x(d.coords[0].x);
        }).y(function(d) {
            return y(d.coords[0].y);
        }).interpolate("basis");
        svgSec.append("svg:path").attr("d", borderTopLine(polygonData)).attr('class', 'borderTop');
        svgSec.call(tip);
        // tick length
        d3.selectAll("g.y.axis g.tick line").attr("x2", function(d) {
            //d for the tick line is the value
            //of that tick 
            //(a number between 0 and 1, in this case)
            return -4;
        });
        d3.selectAll("g.x.axis g.tick line").attr("y2", function(d) {
            //d for the tick line is the value
            //of that tick 
            //(a number between 0 and 1, in this case)
            return 4;
        });
        // Create Event Handlers for mouse
        function handleMouseOver(d, i) {
            // Use D3 to select element, change color and size
            tip.show(d);
            focus.style("display", null);
            focusLine.style("display", null);
            if (typeof(self._mouseHeightFocus) != "undefined") {
                self._mouseHeightFocus.style("display", null);
                self._mouseHeightFocusLabel.style("display", null);
                self._mouseHeightFocusLabelRect.style("display", null);
                self._pointG.style("display", null);
            }
        }

        function handleMouseOut(d, i) {
            // Use D3 to select element, change color back to normal
            tip.hide(d);
            focus.style("display", "none");
            focusLine.style("display", "none");
            self._mouseHeightFocus.style("display", "none");
            self._mouseHeightFocusLabel.style("display", "none");
            self._mouseHeightFocusLabelRect.style("display", "none");
            self._pointG.style("display", "none");
        }
        var self = this;

        function mousemove(d) {
            var color = d.color;
            var x0 = x.invert(d3.mouse(this)[0]); //distance in m   
            var d0 = d.coords[0].x,
                d1 = d.coords[1].x;
            var d2 = d1 - x0 > x0 - d0 ? 0 : 1; // shortest distance between mouse and coords of polygon
            var y0 = (Math.round(((d.coords[0].y + d.coords[1].y) / 2) * 100) / 100); //height
            var LatLngCoords = d.LatLng;
            var segmentCenter = L.latLngBounds(LatLngCoords[0], LatLngCoords[1]).getCenter();
            self._showMarker(segmentCenter, y0, heightvalue, color);
            focus.style("display", "initial").attr("transform", "translate(" + x(x0) + "," + y(d3.min(heightvalue)) + ")");
            focus.select("text").text(Math.round((x0 / 1000) * 100) / 100 + ' km'); //text in km
            focusLine.style("display", "initial").attr('x1', x(x0)).attr('y1', y(y0)).attr('x2', x(x0));
        }
    }
});
L.control.heightgraph = function(options, profileType) {
    return new L.Control.Heightgraph(options, profileType);
};