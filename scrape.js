var cheerio = require('cheerio'), get = require('./config.json'), mysql = require('mysql'), fs = require('fs'), request = require('request'), Q = require('q'), _ = require('lodash'), htmlencode = require('htmlencode');

var diff;
var timeStamp = 0;
var thresh = 0;
var absentConf = false;
var resultSpacing = 10;
process.setMaxListeners(0);
var callFinal = false;
if (get.writeToDB == true) {
	//	if (get.finalSearch.length != get.db.columns.length) {
	//		console.log("search paramaters not equal to column parameters");
	//		process.exit(1);
	//	}
}

var connection = mysql.createConnection(
//'mysql://'+get.db.user+':'+get.db.pass+'@'+get.db.host+'/'+get.db.dbName+'?reconnect=true');
{
	"host" : get.db.host,
	"user" : get.db.user,
	"password" : get.db.pass,
	"database" : get.db.dbName
});
if (get.method == "asos") {
	var query = Q.nbind(connection.query, connection);
}
// This bit here allows the usage of ":name" placeholder format in queries
connection.config.queryFormat = function(query, values) {
	if (!values)
		return query;
	return query.replace(/\:(\w+)/g, function(txt, key) {
		if (values.hasOwnProperty(key)) {
			return this.escape(values[key]);
		}
		return txt;
	}.bind(this));
};

if (get.updateDB == true) {
	if ("threshold" in get == false) {
		console.log("Threshold not specified.");
		process.exit(1);
	} else {
		var test = get.threshold.split(",");
		for (var i = test.length - 1; i >= 0; i--) {
			if (i == test.length - 1) {
				thresh += parseInt(test[i], 10);
			} else if (i == test.length - 2) {
				thresh += parseInt(test[i], 10) * 1000;
			} else if (i == test.length - 3) {
				thresh += parseInt(test[i], 10) * 60000;
			} else if (i == test.length - 4) {
				thresh += parseInt(test[i], 10) * 60000 * 60;
			} else if (i == test.length - 5) {
				thresh += parseInt(test[i], 10) * 60000 * 60 * 24;
			}
		}
	}
	if ("updateColumn" in get.db) {
		if (get.db.updateColumn.length <= 0) {
			console.log("Table column to update against is not specified adequately.");
			process.exit(1);
		}
	} else {
		console.log("Table column to update against is missing.");
		process.exit(1);
	}
}

diff = get.repeat.split(",");
for (var i = diff.length - 1; i >= 0; i--) {
	if (i == diff.length - 1) {
		timeStamp += parseInt(diff[i], 10);
	} else if (i == diff.length - 2) {
		timeStamp += parseInt(diff[i], 10) * 1000;
	} else if (i == diff.length - 3) {
		timeStamp += parseInt(diff[i], 10) * 60000;
	} else if (i == diff.length - 4) {
		timeStamp += parseInt(diff[i], 10) * 60000 * 60;
	} else if (i == diff.length - 5) {
		timeStamp += parseInt(diff[i], 10) * 60000 * 60 * 24;
	}
}
console.log("Time until repeat: " + timeStamp / 1000 / 60 + " minutes.");

if (get.writeToDB == "true") {
	//connection.query("TRUNCATE TABLE " + get.db.tName + " ;");
	console.log(get.db.tName + " truncated.");
}
function dropTable() {
	connection.query("TRUNCATE TABLE " + get.db.tName + " ;");
}

console.log("Hatching spiderlings.");
timed();
//tester();

setInterval(function() {
	timed();
}, timeStamp);

function timed() {
	try {
		absentConf = fs.existsSync('numTracker.json');
	} catch(e) {
		absentConf = false;
		console.log(e);
	}
	console.log("Scraping interrupted : " + absentConf);
	if (absentConf == true && get.recover == true) {
		console.log("Didn't finish eating last time around!");
		var encode = JSON.parse(fs.readFileSync("numTracker.json", "utf-8"));
		callFinal = !callFinal;
		if (encode.data > 0) {
			writingToEndPoint(encode.data - 1);
		} else {
			writingToEndPoint(encode.data);
		}
	} else {
		for (var j = 0; j < get.baseUrl.length; j++) {
			huntLinks(j);
		}
	}
}

function huntLinks(j) {
	console.log("Hunting " + get.baseUrl[j]);
	//xmlhttp.open("GET", get.baseUrl[j], false);
	console.log(j);
	request(get.baseUrl[j], function(error, response, body) {

		if (!error && response.statusCode == 200) {
			// console.log(body) // Print the web page.
			carryOn(body, get.baseUrl[j], j);
			console.log(get.baseUrl[j]);
		} else {
			console.log(response);
			console.log("\033[31m A spider got lost! Error " + error + " with a code " + response.statusCode + '\033[0m');
		}

	})
}

function carryOn(thing, base, baseLength) {
	console.log("Scurrying.");
	$ = cheerio.load(thing);
	var resultLength = parseElements(get.searches[0]);
	var resultsArr = [];
	for (var i = 0; i < resultLength.length; i++) {
		var returned = $(resultLength[i].replace(/>/g, " "));
		for (var a = 0; a < returned.length; a++) {
			resultsArr.push(returned[a]);
			//console.log(returned[a]);
		}
	}
	//	resultsArr = eliminateDuplicates(resultsArr);
	//	console.log(resultsArr);
	//	for (var k = 0; k <= get.searches.length; k++) {
	dataScrape(base, 0, resultsArr);

}

function dataScrape(base, k, referenceArr) { {
		//console.log(resultsArr);
		console.log("k index : " + k);
		if (get.method == "generic" || get.method == "asos") {
			if (k < get.searches.length - 1) {
				var tempResults = [];
				for (var l = 0; l < referenceArr.length; l++) {
					if (k == 0) {
						var test = referenceArr[l].attribs.href;
					}
					if (k > 0) {
						test = resultsArr[l];
					}
					if (test != undefined && test != "") {
						var match = base.match(/[.a-z0-9A-Z]*/g)[4];
						if (test.indexOf(match) == -1) {
							if (test[0] != "/") {
								test = "/" + test
							}
							match = base + test;
						} else {
							if (test.indexOf("//") == 0) {
								test = "https:" + test;
							}
							match = test;
						}
						tempResults.push(match);
					}
				}
				console.log(tempResults.length + " animals to eat.");
				console.log("Starting to crawl.");
				resultsArr = [];
				//console.log(tempResults);
				asyncLoop(tempResults.length - 1, function(loop) {
					//				for (var l = 0; l < tempResults.length; l++) {
					//var text =  requester(tempResults[l]);
					//console.log(tempResults[loop.index]);
					console.log(loop.index);
					if (get.method == "asos") {
						tempResults[loop.index] = tempResults[loop.index] + "&parentID=-1&pge=0&pgeSize=9999&sort=-1";
					}
					request(tempResults[loop.index], function(error, response, body) {
						if (!error && response.statusCode == 200) {
							var text = body;
							$ = cheerio.load(text);
							console.log("Hunting " + tempResults[loop.index] + ".");
							var parsed = parseElements(get.searches[k + 1]);
							console.log(parsed);
							var tempArr = [];
							for (var z = 0; z < parsed.length; z++) {
								var returned = $(parsed[z].replace(/>/g, " "));
								//console.log(returned);
								for (var b = 0; b < returned.length; b++) {
									//console.log(returned[b]);
									tempArr.push(returned[b]);
								}
							}
							if (tempArr.length == 0 || tempArr == "") {
								console.log("Prey yielded no results.");
							}
							for (var m = 0; m < tempArr.length; m++) {
								var test = tempArr[m].attribs.href;
								if (test != undefined && test != "") {
									var match = base.match(/[.a-z0-9A-Z]*/g)[4];
									if (test.indexOf(match) == -1) {
										if (test[0] != "/") {
											test = "/" + test
										}
										match = base + test;
									} else {
										if (test.indexOf("//") == 0) {
											test = "https:" + test;
										}
										match = test;
									}
									//console.log(match);
									resultsArr.push(match);
								}
							}
							loop.next();
							//console.log(resultsArr);
							console.log('\033[35m' + Math.floor(100 * ((loop.index + 1) / tempResults.length)) + " % completed of pass " + (k + 1) + " of " + (get.searches.length - 1) + ". " + resultsArr.length + " results." + "\033[0m");

						} else {
							//console.log(tempResults);
							console.log("\033[31m A spider got lost! Error : " + error + '\033[0m');
							loop.next();
						}
						if (loop.index == tempResults.length - 1) {
							var pushk = k + 1;
							if (callFinal == true) {
								dataScrape(base, pushk, resultsArr);
							}
							callFinal = !callFinal;
						}

					})
				}, function() {
				});
			} else if (k == get.searches.length - 1) {
				console.log("finished");
				var urlPrepend = "http://www.asos.com/pgeproduct.aspx?";
				for (var i in resultsArr) {
					var thing = resultsArr[i].match(/iid=([0-9]+)/);
					if (thing != null) {
						//	console.log(thing[0]);
						resultsArr[i] = urlPrepend + thing[0];
					} else {
						thing = resultsArr[i].match(/sgid=([0-9]+)/);
						if (thing != null) {
							//	console.log(thing[0]);
							resultsArr[i] = urlPrepend + thing[0];
						}
					}
					//temp.push(links[i].match(/iid=([0-9]+)/)[0]);
					//console.log(temp[i]);
				}

				fs.writeFileSync("links.json", '{"data":' + JSON.stringify(eliminateDuplicates(resultsArr)) + '}');
				fs.writeFileSync("numTracker.json", '{"data":' + "0" + '}');
				writingToEndPoint(0);
				return;
			}
		} else if (get.method == "eat" && k == get.searches.length) {
			if (get.writeToDB == "true") {
				dropTable();
			}
			for (var i = 0; i < resultsArr.length; i++) {
				console.log(i);
				console.log(resultsArr[i].attribs.href);
			}
			for (var i = 0; i < resultsArr.length; i = i + 2) {
				if (i > 3 && i < 24) {
					//console.log(Math.floor(i / 4) + "," + connection.escape(resultsArr[i].children[0].data) + "," + connection.escape(resultsArr[i+1].children[0].data) +"\n")
					if (get.writeToDB == "true") {
						writeToDb(Math.floor(i / 4) + "," + connection.escape(resultsArr[i].children[0].data) + "," + connection.escape(resultsArr[i+1].children[0].data));
					}
				}
			}
		}
	}
}

function writingToEndPoint(startFrom) {
	if (get.clearDB == true) {
		asyncLoop(1, function(loop) {
			cleanDB(startFrom);
			loop.next()
		}, function() {"cleaned"
		});
	}
	console.log('Spider digesting and loading progress.');
	var links = JSON.parse(fs.readFileSync("links.json", "utf-8"));
	links = links.data;
	console.log("file loaded");
	//for (var l = 0; l < (links.length - startFrom); l++) {
	var start = links.length - startFrom;
	console.log(startFrom);
	console.log(links.length);
	var jsonResults = [];
	console.log("stuff");
	var arr = [];
	/*for (var i = 0; i < links.length; i++) {
	if (links[i].indexOf("sgid") != -1) {
	arr.push(links[i]);
	}
	}
	links = arr;
	console.log(arr);*/
	//	return 0;
	asyncLoop(start, function(loop) {
		var l = loop.index;
		console.log(links[l + startFrom]);
		console.log(l + startFrom);
		var j = "";
		if (get.method = "asos") {
			var j = request.jar();
			j.add(request.cookie("asos=topcatid=1000&customerguid=2a6aad1ef6d84192b3c634a4be54d846&PreferredSite=www.asos.com&currencyid=1"));
		}
		//request = request.defaults({jar:j});
		request({
			url : links[l + startFrom],
			jar : j
		}, function(error, response, body) {

			if (!error && response.statusCode == 200) {
				//console.log(body);
				// console.log(body) // Print the web page.
				//console.log("success");

				var text = body;
				$ = cheerio.load(text);
				var resultString = "";
				var results = "";
				var resultsJson = {};
				if (get.method == "asos") {
					var localJson = [];
				}
				for (var m = 0; m < get.finalSearch.length; m++) {
					var patternArr = parseElements(get.finalSearch[m]);

					//console.log(patternArr);
					//price,imageUrl,title,category,description
					for (var z = 0; z < patternArr.length; z++) {
						if (get.method == "asos") {
							if (links[l + startFrom].indexOf("sgid") != -1) {
								var insert = $(".content_more_info");
								//console.log(insert);
								var sgid = links[l+startFrom].match(/sgid=([0-9]+)/)[0];
								for (var y = 0; y < insert.length; y++) {
									localJson.push({});
									if ("children" in insert[y] == false) {
										break;
									}
									var popup = htmlencode.htmlDecode(insert[y].children[0].data).split('\',\'');
									var desc = "null";
									var image = "null";
									var iid = "null";
									if (popup.length > 2) {
										desc = popup[1];
										image = popup[2];
										iid = "iid=" + image.match(/[0-9]{4,}/);
									}
									localJson[y].url = "http://www.asos.com/pgeproduct.aspx?" + sgid + "&" + iid;
									//console.log(links[l+startFrom]+"/n");
									if (get.finalSearch[m] == "#ctl00_ContentMainPage_divmor>ul>li>a") {
										var temp = $(patternArr[z].replace(/>/g, " "));
										if (temp.length > 0) {
											localJson[y].gender = temp[0].children[0].data;
										} else {
											localJson[y].gender = "null";
										}
									}
									if (get.finalSearch[m] == "#ctl00_ContentMainPage_ctlSeparateProduct_lblProductPrice") {
										var temp = $(".product_price_details")[y].children[0].data;
										if (temp != null) {
											//console.log(temp[0].children[0]);
											localJson[y].price = parseFloat(temp.substring(6, temp.length));
										} else {
											localJson[y].price = "null";
										}
									}
									if (get.finalSearch[m] == "#ctl00_ContentMainPage_imgMainImage") {
										localJson[y].image = image;
									}
									if (get.finalSearch[m] == "#ctl00_ContentMainPage_ctlSeparateProduct_lblProductTitle") {
										//title
										var temp = $(".title h1 span")[y].children
										if (temp.length == 1) {
											localJson[y].title = temp[0].data;
										} else {
											localJson[y].title = temp[1].data
										}
										if (temp.length == 0) {
											localJson[y].title = "null";
										}

									}
									if (get.finalSearch[m] == "#ctl00_ContentMainPage_divmor>ul>li") {
										var temp2 = $(patternArr[z].replace(/>/g, " "))
										if (temp2 != null) {
											if (temp2.length == 0) {
												localJson[y].category = "null";
											} else {
												logger = [];
												for (var i = 0; i < temp2.length; i++) {
													logger.push(temp2[i].children[4].children[0].data);
												}
												//console.log(logger);
												if (logger.length == 0) {
													localJson[y].category = "null";
												} else {
													logger = eliminateDuplicates(logger);

													//console.log(logger);
													var string = "";
													for (var i in logger) {
														if (string.length > 0) {
															string += "/";
														}
														string += logger[i];
													}
													//console.log(string);
													localJson[y].category = string;
												}
											}
										} else {
											localJson[y].category = "null";
										}
									}
									if (get.finalSearch[m] == ".single-entry") {
										localJson[y].description = desc;
									}

									if (get.db.addTimestamp == true) {
										localJson[y].timestamp = Math.round(new Date().getTime() / 1000);
									}
									if (get.db.addTimestamp == true) {
										localJson[y].timestamp = Math.round(new Date().getTime() / 1000);
									}
								}
							} else {
								resultsJson.url = links[l + startFrom];
								if (get.finalSearch[m] == "#ctl00_ContentMainPage_divmor>ul>li>a") {
									var temp = $(patternArr[z].replace(/>/g, " "));
									if (temp.length > 0) {
										//console.log(temp[0].children[0].data);
										resultsJson.gender = temp[0].children[0].data;
									} else {
										resultsJson.gender = "null";
									}
								}
								if (get.finalSearch[m] == "#ctl00_ContentMainPage_ctlSeparateProduct_lblProductPrice") {
									var temp = $(patternArr[z].replace(/>/g, " "));
									//console.log(temp[0].children[0].data.substring(6,temp[0].children[0].data.length));
									if (temp != null) {
										if (temp.length == 0) {
											resultsJson.price = "null";
										} else {
											//console.log(temp[0].children[0]);
											resultsJson.price = parseFloat(temp[0].children[0].data.substring(6, temp[0].children[0].data.length));
										}
									} else {
										resultsJson.price = "null";
									}
								}
								if (get.finalSearch[m] == "#ctl00_ContentMainPage_imgMainImage") {
									var temp = $(patternArr[z].replace(/>/g, " "));
									//console.log(temp[0].attribs.src);
									if (temp != null) {
										if (temp.length == 0) {
											resultsJson.image = "null";
										} else {
											resultsJson.image = temp[0].attribs.src;
										}
									} else {
										resultsJson.image = "null";
									}
								}
								if (get.finalSearch[m] == "#ctl00_ContentMainPage_ctlSeparateProduct_lblProductTitle") {

									var temp = $(patternArr[z].replace(/>/g, " "));
									//console.log(temp[0].children);
									if (temp != null) {
										if (temp.length == 0) {
											resultsJson.title = "null";
										} else {
											var ans = "";
											for (var i in temp[0].children) {
												if (temp[0].children[i].type == "text") {
													if (ans.length > 0) {
														ans += ","
													}
													ans += temp[0].children[i].data;
												}
											}
											resultsJson.title = ans;
										}
									} else {
										resultsJson.title = "null";
									}
								}
								if (get.finalSearch[m] == "#ctl00_ContentMainPage_divmor>ul>li") {
									var temp2 = $(patternArr[z].replace(/>/g, " "))
									if (temp2 != null) {
										if (temp2.length == 0) {
											resultsJson.category = "null";
										} else {
											logger = [];
											for (var i = 0; i < temp2.length; i++) {
												logger.push(temp2[i].children[4].children[0].data);
												//											if(string.length > 0){string+="/";}
												//										console.log(temp2[i].children[4].children[0].data);
												//									string+=temp2[i].children[4].children[0].data;
											}
											//console.log(logger);
											if (logger.length == 0) {
												resultsJson.category = "null";
											} else {
												logger = eliminateDuplicates(logger);

												//console.log(logger);
												var string = "";
												for (var i in logger) {
													if (string.length > 0) {
														string += "/";
													}
													string += logger[i];
												}
												//console.log(string);
												resultsJson.category = string;
											}
										}
									} else {
										resultsJson.category = "null";
									}

								}
								if (get.finalSearch[m] == ".single-entry") {

									var temp = $(patternArr[z].replace(/>/g, " ")).html();
									if (temp != null) {
										if (temp.length == 0) {
											resultsJson.description = "null";
										} else {
											//console.log(temp);
											resultsJson.description = temp;
										}
									} else {
										resultsJson.description = "null";
									}
								}
								if (get.db.addTimestamp == true) {
									resultsJson.timestamp = Math.round(new Date().getTime() / 1000);
								}
							}
							if (get.method == "generic") {
								var temp = $(patternArr[z].replace(/>/g, " "));
								//console.log($._root.children);
								if (temp != null) {
									for (var y = 0; y < temp.length; y++) {
										results.push(temp[y]);
									}
								} else {
									results.push("null");
								}
							}
						}
					}
				}
				//console.log(localJson);
				//return 0;
				if (get.method == "asos") {
					if (links[l + startFrom].indexOf("sgid") != -1) {
						jsonResults.push(localJson[0]);
						jsonResults.push(localJson[1]);
						var sgid = localJson[0].url.match(/sgid=([0-9]+)/)[1];
						query("DELETE FROM product_groups WHERE group_id = :sgid", {
							sgid : sgid
						}).done(function() {
							console.log("A group has been found. It's been successfully purged... for now...");
						});

					} else {
						jsonResults.push(resultsJson);
					}
				}
				//console.log(results.length);

				//results = eliminateDuplicates(results);
				//console.log(results[0].children);
				for (var n = 0; n < results.length; n++) {
					//console.log(results[n]);
					//console.log(results[n].children[0].data);
					if (get.method == "generic") {
						if ("children" in results[n] && results[n].children.length > 0) {
							if ("data" in results[n].children[0]) {

								if (resultString.length > 0 && resultString[resultString.length - 1] != ",") {
									resultString += ",";
								}
								resultString += results[n].children[0].data;
								console.log(results[n].children[0].data);

							}
						}
					}
				}

				//console.log("\033[1;35m" +results+"\033[0m");
				//console.log(results.length);
				//console.log(resultString);
				//console.log(get.writeToDB + "," + get.method);
				if (get.writeToDB == true && get.method == "asos" && jsonResults.length >= resultSpacing || l == links.length) {
					Q(jsonResults).then(
						function(results) {
						console.log('Retrieved raw data, processing...');

						var intermediate = {}, categories = [];

						_.each(results, function(row) {

							var i, j, temp, obj = {};
							//console.log(row);
							// Extract product ID; if ID is successfully extracted,
							// we're dealing with an actual product here.
							temp = row.url.match(/iid=([0-9]+)/);
							if (temp) {

								obj.id = parseInt(temp[1], 10);

								// Process categories into several separate ones,
								// as well as add the missing one to category storage.
								obj.categories = row.category.split('/');
								obj.categories.sort();

								categories = _.union(categories, obj.categories);

								// If the ID has not been encountered before,
								// process the rest of the data and prepare it for insertion
								if (!(obj.id in intermediate)) {

									obj.timestamp = parseInt(row.timestamp, 10);
									obj.gender = ( function() {
											if (row.gender === 'Women') {
												return 'female';
											} else if (row.gender === 'Men') {
												return 'male';
											} else {
												return '';
											}
										}());
									obj.name = row.title;
									obj.image = row.image;
									obj.price = parseFloat(row.price);

									if (row.url.match(/sgid=([0-9]+)/) != null) {
										obj.sgid = parseInt(row.url.match(/sgid=([0-9]+)/)[1], 10);
									} else {
										obj.sgid = -1;
									}
									// Parse the description and sanitise the HTML
									if (row.description && row.description.length && (row.description.toLowerCase() !== 'null') && (row.description.toLowerCase() !== 'undefined')) {

										// TEXT-BASED PROCESSING
										// First, split the description by double line breaks.
										// Those are used instead of proper paragraphs and we shall
										// return the natural way of things.
										var chunk, list_start = null, list_detected = false, chunk_before, chunk_after, list_chunk;

										// Those lines here replace some bizarre apostrophes and quotes
										// (which seem to be giving PHP some trouble parsing into JSON)
										// with generic equivalent, before splitting along two-line breaks.
										temp = row.description.replace(/‘|’|’|’/g, '&quot;').replace(/“|”/g, "'").split('<br><br>');

										for ( i = 0; i < temp.length; i += 1) {

											// Split each chunk by linebreaks, then reduce whitespace,
											// trim redundant spaces and remove empty text nodes.
											// This will ensure proper quality and reduce chance of
											// badly-looking description.
											chunk = _(temp[i].split('<br>')).map(function(str) {
												return str.replace(/^\s+|\s+$/g, '')// trimming
												.replace(/\s+/g, ' ');
												// whitespace reduction
											}).compact().value();

											// Traverse description in search of lists.
											// These are provided as mere linebreaks with hyphens,
											// whereas parsing and styling is easier if they're made
											// into proper lists;
											list_indicators = [];
											for ( j = 0; j <= chunk.length; j += 1) {
												if (( typeof chunk[j] === 'undefined') || !chunk[j].match(/^\- /)) {
													if (list_detected) {
														list_detected = false;
														list_indicators.push([list_start, j]);
													}
												} else {
													if (!list_detected) {
														list_start = j;
														list_detected = true;
													}
												}
											}

											// If there were no lists detected, return the chunk as it is.
											// Otherwise, proceed with splitting them out of the chunk.
											if (!list_indicators.length) {
												temp[i] = chunk.join('<br>');
											} else {
												var result = [];
												list_indicators = _.flatten([0, list_indicators, chunk.length]);
												for ( j = 1; j < list_indicators.length; j += 1) {
													if (j % 2) {
														result.push(chunk.slice(list_indicators[j - 1], list_indicators[j]).join('<br>'));
													} else {
														result.push('<ul>' + _.map(chunk.slice(list_indicators[j - 1], list_indicators[j]), function(line) {
															return '<li>' + line.substr(2) + '</li>';
														}).join('') + '</ul>');
													}
												}
												temp[i] = _.compact(result);
											}

										}
										// Once the chunks have been processed,
										// wrap each in a paragraph and join them together.
										temp = _(temp).flatten().map(function(chunk) {
											return '<p>' + chunk + '</p>';
										}).value().join('');

										// PARSER-BASED PROCESSING
										var $ = cheerio.load(temp, {
											'ignoreWhitespace' : true
										});

										// Remove all links that are not absolute
										$('a').each(function(index, el) {
											if (!(el.attribs && el.attribs.href && el.attribs.href.match(/^[a-z0-9]+:\/\//)
											)) {
												this.replaceWith(this.html());
											}
										});

										// Extract lists from single-child paragraphs
										$('ul').each(function(index, el) {
											if ((el.prev === null) && (el.next === null)) {
												$(el.parent).replaceWith($(el));
											}
										});

										// Reparse the titles
										$('strong').each(function(index, el) {
											if (el.next && el.next.type === 'tag' && el.next.tag === 'br') {
												$(el.parent).before('<h3>' + this.html() + '</h3>');
												$(el.next).remove();
											}
										});

										obj.description = $.html();

									} else {
										obj.description = null;
									}

									intermediate[obj.id] = obj;

								}

							}

						});

						// After pre-processing raw data, pass it forward;
						// First, the categories are added. Then, the actual products are inserted
						categories.sort();
						intermediate = _.values(intermediate);

						return [categories, intermediate];

					}).then(function(data) {
						//console.log(data);
						// Insert each category into the DB to ensure they will have
						// appropriate IDs when the products are inserted.
						console.log('Finished processing data. Inserting missing categories into DB...');
						return Q.all(data[0].map(function(category) {
							return query('INSERT IGNORE INTO categories (name) VALUES (:category) ON DUPLICATE KEY UPDATE name = :category', {
								'category' : category
							});
						})).then(function() {
							return data[1];
						},function(error){console.log("INTO CAT"+error);throw error;});

					}).then(function(products) {

						console.log('Scheduling insertion of all products...\n');

						var deferred = Q.defer(), promise = deferred.promise, total = products.length, index = 0;

						// Chunk products to ensure there's some degree of parallel
						// operations, but without trying to run all queries at the
						// same time.
						_(products).groupBy(function(val, index) {
							return Math.floor(index / 40);
						}).each(function(product_group) {

							promise = promise.then(function() {
								return Q.all(_.map(product_group, function(product) {
									return query('INSERT INTO products (' + 'id, timestamp, gender, ' + 'name, image, description' + ') VALUES (' + ':id, FROM_UNIXTIME(:timestamp), :gender, ' + ':name, :image, :description' + ') ON DUPLICATE KEY UPDATE id = :id, timestamp = FROM_UNIXTIME(:timestamp),gender=:gender, name = :name, description = :description, image = :image', product).then(function() {
										// Once the main product is in, insert the price
										// (assume GBP as currency for now)
										return query('INSERT INTO product_prices (product_id, currency, price) ' + 'VALUES (:id, \'GBP\', :price)' + ' ON DUPLICATE KEY UPDATE product_id = :id, currency = \'GBP\', price=:price', product);
									},function(error){console.log("INTO PRODUCTS AND PRODUCT PRICES"+error);throw error;}).then(function() {
										// Top it all by inserting entries tying products to categories
										// in which they might appear, one by one (though in parallel)
										return Q.all(product.categories.map(function(category) {
											//return query('')
											return (function() {
												//												console.log(category+","+category);
												query('DELETE FROM product_categories WHERE product_id = :product_id', {
													'product_id' : product.id
												}).then(function() {
													query('INSERT INTO product_categories (product_id, category_id) ' + 'SELECT :product_id, categories.id FROM categories ' + 'WHERE categories.name = :category', {
														'product_id' : product.id,
														'category' : category
													})
												},function(error){console.log("INTO PROD_CAT"+error);throw error;});
											})();
										}));
									},function(error){console.log("INTO PROD, PROD_PRICE"+error);throw error;}).then(function() {
										if (product.sgid != -1) {
											//console.log(product);
											return query('DELETE FROM product_groups WHERE group_id = :gid', {"gid":product.sgid}).then(function() {
												return query('INSERT INTO product_groups (group_id,product_id) VALUES (:gid, :iid )', {
													"gid" : product.sgid,
													"iid" : product.id
												})
											},function(error){console.log("INTO PROD,GROUPS"+error);throw error;});
										}
									}).then(function() {
										index++;
										console.log("Wrapping in silk at \033[1;35m" + Math.floor(100 * ((l + startFrom + (index)) / links.length)) + "%\033[0m completion. \033[1;35m" + (links.length - (index) - (l + startFrom)) + "\033[0m links remaining.");
										console.log('Successfully written product #' + product.id + '  ( ' + (index) + ' / ' + total + ')');
									},function(error){console.log(error);throw error;});
								}));
							});

						});

						deferred.resolve();
						return promise;

						// .done() is used here instead of .then() to make sure errors are thrown if detected
					}).done(function() {
						fs.writeFileSync("numTracker.json", '{"data":' + (l + startFrom) + '}');
						jsonResults = [];
						loop.next();
					});

				} else if (get.writeToDB == true && get.method == "asos" && jsonResults.length < resultSpacing) {
					loop.next();
				} else if (get.writeToDB == true) {
					if (resultString != "") {
						//	writeToDb(connection.escape(resultString) + "," + connection.escape(links[l + startFrom]));

						console.log("Writing information to database.");
						//	console.log(data);
						var string = "";
						for (var i = 0; i < get.db.columns.length; i++) {
							if (string.length > 0) {
								string += ",";
							}
							string += get.db.columns[i];
						}
						console.log(string);
						if (get.method == "generic") {
							resultString = connection.escape(resultString) + "," + connection.escape(links[loop.index]);
						}
						if (get.db.addTimestamp == true) {
							var sql = "INSERT INTO " + get.db.tName + " (" + string + ",timestamp) VALUES (" + resultString + "," + new Date().getTime() + ")";
						} else {
							var sql = "INSERT INTO " + get.db.tName + " (" + string + ") VALUES (" + resultString + ")";
						}
						sql += " ON DUPLICATE KEY UPDATE ";
						var dataSplit = resultString.replace(/" "/g, "").replace(/','/g, "'|'");
						for (var z = 0; z < string.split(",").length; z++) {
							sql += string.split(",")[z];
							sql += " = " + dataSplit.split("|")[z];
							if (z < string.split(",").length - 1) {
								sql += ",";
							}
						}
						if (get.db.addTimestamp == true) {
							sql += ", timestamp = " + new Date().getTime();
						}
						//console.log(resultString);
						//console.log("\033[31m" + sql + "\033[0m" + "\n");
						connection.query(sql, function(err, results) {
							console.log(results);
							if (err != undefined) {
								console.log("\033[1;35m" + err + "\033[0m");
								//return;
							}
							//console.log(results);
							fs.writeFileSync("numTracker.json", '{"data":' + (l + startFrom) + '}');
							console.log("Wrapping in silk at \033[1;35m" + Math.floor(100 * ((l + startFrom) / links.length)) + "%\033[0m completion. \033[1;35m" + (links.length - (l + startFrom)) + "\033[0m links remaining.");
							loop.next();
						});
						//loop.next();

					}
					//writeToDB();
				} else {
					fs.writeFileSync("numTracker.json", '{"data":' + (l + startFrom) + '}');
					console.log("Wrapping in silk at \033[1;35m" + Math.floor(100 * ((l + startFrom) / links.length)) + "%\033[0m completion. \033[1;35m" + (links.length - (l + startFrom)) + "\033[0m links remaining.");
					//console.log("\033[1;35m" +resultString+"\033[0m");
					loop.next();
				}
			} else {
				console.log("\033[31mA spider got lost! Error " + error + "\033[0m");
				loop.next();
			}
			//loop.next();
		})
	}, function() {
		callFinal = !callFinal;
		console.log(fs.existsSync('numTracker.json') + "," + fs.existsSync('links.json'));
		if (fs.existsSync('numTracker.json')) {
			fs.unlinkSync('numTracker.json');
		}

	});
}

function requester(url) {
	/*	var xmlhttp = new XMLHttpRequest();
	 xmlhttp.open("GET", url, false);
	 xmlhttp.send();
	 xmlhttp.onreadystatechange = function() {
	 console.log("xmlhttpstatus = " + xmlhttp.status);
	 if (xmlhttp.readyState == 4 && xmlhttp.status >= 200) {
	 console.log("Page responded with dom.");
	 //carryOn(xmlhttp.responseText);
	 //return xmlhttp.responseText;
	 //console.log(xmlhttp.responseText);
	 } else if (xmlhttp.readyState == 4 && xmlhttp.status >= 404) {
	 //console.log("Page issue encountered on " + url);
	 }
	 }
	 return xmlhttp.responseText;*/
	request(url, function(error, response, body) {

		if (!error && response.statusCode == 200) {
			// console.log(body) // Print the web page.
			return body;
		} else {
			console.log(error);
			return "";
		}

	})
}

function writeToDb(data) {
	console.log("Writing information to database.");
	//	console.log(data);
	var string = "";
	for (var i = 0; i < get.db.columns.length; i++) {
		if (string.length > 0) {
			string += ",";
		}
		string += get.db.columns[i];
	}
	//console.log(string);
	if (get.db.addTimestamp == true) {
		var sql = "INSERT INTO " + get.db.tName + " (" + string + ",timestamp) VALUES (" + data + "," + new Date().getTime() + ")";
	} else {
		var sql = "INSERT INTO " + get.db.tName + " (" + string + ") VALUES (" + data + ")";
	}

	sql += " ON DUPLICATE KEY UPDATE ";
	var dataSplit = data.replace(/" "/g, "").replace(/','/g, "'|'");
	for (var z = 0; z < string.split(",").length; z++) {
		sql += string.split(",")[z];
		sql += " = " + dataSplit.split("|")[z];
		if (z < string.split(",").length - 1) {
			sql += ",";
		}
	}
	if (get.db.addTimestamp == true) {
		sql += ", timestamp = " + new Date().getTime();
	}
	console.log("\033[31m" + sql + "\033[0m" + "\n");
	var pushed = false;
	asyncLoop(1, function(loop) {
		connection.query(sql, function(err, results) {
			if (err != undefined) {
				console.log(err);
				return;
			}
			console.log(results);
		});
		loop.next();
	}, function() {
		console.log("Written")
	});
	//}
	//pushed = false;
}

function asyncLoop(iterations, func, callback) {
	var index = 0;
	var done = false;
	var loop = {
		"index" : 0,
		"next" : function() {
			if (done) {
				return;
			}

			if (index < iterations) {
				index++;
				loop.index++;
				func(loop);

			} else {
				done = true;
				callback();
			}
		},

		"iteration" : function() {
			return index - 1;
		},

		"break" : function() {
			done = true;
			callback();
		}
	};
	loop.next();
	return loop;
}

function eliminateDuplicates(arr) {
	var i, len = arr.length, out = [], obj = {};

	for ( i = 0; i < len; i++) {
		obj[arr[i]] = 0;
	}

	for (i in obj) {
		out.push(i);
	}

	return out;
}

function writeToFile() {
	var resultObj;

	var connection = mysql.createConnection({
		host : get.db.host,
		user : get.db.user,
		password : get.db.pass,
		database : get.db.dbName
	});

	connection.query("SELECT * FROM " + get.db.tName + " ;", function(err, results) {
		if (err != undefined) {
			console.log(err);
		}
		//		console.log(results);
		resultObj = JSON.stringify(results);
		resultObj = resultObj.replace(/\\n/g, "");
		fs.writeFile(get.retrieval.name, resultObj, function(err) {
			if (err)
				throw err;
			console.log('It\'s saved!');
			//	process.exit(1);
		});

	});

}

function parseElements(input) {
	//console.log(input);
	if ( typeof (input) != "string") {
		throw "Input is of invalid type.";
	}
	var string = input.replace(/\s/g, '');
	var array = string.split(">");
	//console.log(array);
	var sortedArr = [];
	var finalArr = [];
	var foundVar = -1;
	for (var i = 0; i < array.length; i++) {
		if (array[i].indexOf("(") != -1) {
			foundVar = i;
			var str = "";
		}
		if (foundVar == -1) {
			sortedArr.push(array[i]);
		}

		if (array[i].indexOf(")") != -1) {
			for (var k = foundVar; k <= i; k++) {
				if (k > foundVar) {
					str += ">";
				}
				str += array[k];
			}
			sortedArr.push(str);
			foundVar = -1;
		}
	}
	//previous segment splits via >, and then re-merges segments which have () in them.
	for (var i = 0; i < sortedArr.length; i++) {
		if (sortedArr[i].indexOf("(") != -1) {
			var newString = "";
			for (var k = 0; k <= i; k++) {
				//console.log("()"+sortedArr[k]);
				if (k > 0) {
					newString += ">";
				}
				if (k == i) {
					var regexMatch = sortedArr[i].match(/\(.*?\)/);
					newString += regexMatch[0].substring(1, regexMatch[0].length - 1);

				}
				if (k < i) {
					newString += sortedArr[k];
				}
			}
			finalArr.push(newString);
			sortedArr[i] = sortedArr[i].split("+")[1];
		}
		if (i == sortedArr.length - 1) {
			var newString = "";
			for (var i = 0; i < sortedArr.length; i++) {
				if (i > 0) {
					newString += ">";
				}
				newString += sortedArr[i];
			}
			finalArr.push(newString);
			//write all of this as a pattern and push to finalArr.
		}

	}
	if (finalArr.length > 0) {
		return finalArr;
	} else {
		throw "Pattern is of unparseable type.";
	}
	//	process.exit(1);
}

function cleanDB(startFrom) {
	if (startFrom == 0 && get.updateDB == true && get.db.addTimestamp == true) {
		if (fs.existsSync('links.json')) {
			var links = JSON.parse(fs.readFileSync("links.json", "utf-8"));
			links = links.data;
		} else {
			links = "";
		}
		console.log("Cleaning the web.");
		var linkArr = [];
		var toRemove = [];
		var newArr = [];
		var toUpdate = [];
		var time = [];
		var sql = "SELECT " + get.db.columns[get.db.columns.length - 1] + ",timestamp FROM " + get.db.tName + " ORDER BY `timestamp` ASC";
		asyncLoop(1, function(loop) {
			connection.query(sql, function(err, results) {
				//console.log("SQLING STUFF");
				if (err != undefined) {
					console.log(err);
					return;
				}
				if (results.length > 0) {
					for (var k = 0; k < results.length; k++) {
						if (get.baseUrl.indexOf(results[k][get.db.columns[get.db.columns.length - 1]]) == -1 || links.indexOf(results[k][get.db.columns[get.db.columns.length - 1]]) == -1) {
							//console.log(results[k]);
							toRemove.push(results[k][get.db.columns[get.db.columns.length - 1]]);
						}
						time.push(results[k].timestamp);
						linkArr.push(results[k][get.db.columns[get.db.columns.length - 1]]);
					}
					for (var k = 0; k < links.length; k++) {
						if (linkArr.indexOf(links[k]) != -1) {
							if (get.threshold < new Date().getTime() - time[k]) {
								toUpdate.push(link[k]);
							}
						} else {
							newArr.push(link[k]);
						}
					}
				}
				links = eliminateDuplicates(newArr.concat(toUpdate));
				for (var k = 0; k < toRemove.length; k++) {
					var sql = "DELETE FROM " + get.db.tName + " WHERE " + get.db.columns[get.db.columns.length - 1] + " = \"" + toRemove[k] + "\"";
					//console.log(sql);
					asyncLoop(1, function(loop) {
						connection.query(sql, function(err, results) {
							if (err != undefined) {
								console.log(err);
								return;
							}
							//console.log(results);
						});
						loop.next();
					}, function() {
						console.log("Deleted")
					});

				}
				loop.next();
			})
		}, function() {
			console.log("Deleted all.")
		});
	}
}

//var pushSpacing = Q.nbind(pushSpacing(results,count));
var pushSpacing = function(results) {
	console.log(results);
	return results;
}
//			fs.writeFileSync("numTracker.json", '{"data":' + inputCount + '}');
