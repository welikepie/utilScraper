var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
var cheerio = require('cheerio');
var get = require('./config.json');
var mysql = require('mysql');
var fs = require('fs');
var diff;
var timeStamp = 0;
var absentConf;
if (get.writeToDB == true) {
	if (get.finalSearch.length != get.db.columns.length) {
		console.log("search paramaters not equal to column parameters");
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
console.log(timeStamp);
var connection = mysql.createConnection({
	host : get.db.host,
	user : get.db.user,
	password : get.db.pass,
	database : get.db.dbName
});

if (get.writeToDB == "true") {
	connection.query("TRUNCATE TABLE " + get.db.tName + " ;");
	console.log(get.db.tName + " truncated.");
}
function dropTable() {
	connection.query("TRUNCATE TABLE " + get.db.tName + " ;");
}

console.log("Hatching");
timed();

setInterval(function() {
	timed();
}, timeStamp);

function timed() {
	absentConf = fs.existsSync('numTracker.json');
	console.log(absentConf);
	if (absentConf == true && get.recover == true) {
		console.log("Didn't finish eating last time around!");
		var encode = JSON.parse(fs.readFileSync("numTracker.json","utf-8"));
		writingToEndPoint(encode.data);
	} else {
		for (var j = 0; j < get.baseUrl.length; j++) {
			console.log("Hunting " + get.baseUrl[j]);
			var xmlhttp = new XMLHttpRequest();
			xmlhttp.open("GET", get.baseUrl[j], false);
			xmlhttp.send();
			xmlhttp.onreadystatechange = function() {
				console.log("xmlhttpstatus = " + xmlhttp.status);
				if (xmlhttp.readyState == 4 && xmlhttp.status >= 200) {
					console.log("Page responded with dom.");
				} else if (xmlhttp.readyState == 4 && xmlhttp.status >= 404) {
					console.log("Page issue encountered.");
				}
			}
			carryOn(xmlhttp.responseText, get.baseUrl[j]);
		}
		writingToEndPoint(0);
	}
}

function carryOn(thing, base) {
	console.log("Growing Legs.");
	$ = cheerio.load(thing);
	var resultsArr = $(get.searches[0].replace(/>/g, " "));
	//console.log(resultsArr);
	for (var k = 1; k <= get.searches.length; k++) {
		if (get.method == "generic") {
			if (k < get.searches.length) {
				var tempResults = [];
				for (var l = 0; l < resultsArr.length; l++) {
					var test = resultsArr[l].attribs.href;
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
				for (var l = 0; l < tempResults.length; l++) {
					var text = requester(tempResults[l])
					$ = cheerio.load(text);
					console.log("Hunting " + tempResults[l] + ".");
					var tempArr = $(get.searches[k].replace(/>/g, " "));
					if (tempArr.length == 0 || tempArr == "") {
						console.log("Prey " + tempResults[l] + " yielded no results.");
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
							resultsArr.push(match);
						}
					}
					console.log(Math.floor(100 * (l / tempResults.length)) + " % completed of pass " + k + " of " + (get.searches.length - 1) + ".");
				}
			} else if (k == get.searches.length) {
				console.log(get.preserve);
				resultsArr = eliminateDuplicates(resultsArr);
				if (get.baseUrl.indexOf(base) > 0) {
					var linkJson = JSON.parse(fs.readlinkSync('links.json'));
					fs.writeFileSync("links.json", '{"data":' + eliminateDuplicates(linkJson.data.concat(resultsArr)) + "}");
				} else {
					fs.writeFileSync("links.json", '{"data":' + JSON.stringify(resultsArr) + "}");
				}
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
	console.log('Spider digesting and saving progress.');
	var links = JSON.parse(fs.readFileSync("links.json","utf-8"));
	links = links.data;
	console.log(links.length);
	console.log(startFrom);
	console.log(links.length-startFrom);
	for (var l = 0; l < (links.length-startFrom); l++) {
		var text = requester(links[l+startFrom]);
		$ = cheerio.load(text);
		var resultString = "";
		for (var m = 0; m < get.finalSearch.length; m++) {
			var results = $(get.finalSearch[m].replace(/>/g, " "));
			//console.log(results);
			for(var n = 0; n < results.length; n++){
				//console.log(n);
				//console.log(results[n].children[0].data);
				if("children" in results[n] && results[n].children.length > 1){
					if("data" in results[n].children[0]){
						if(results[n].children[0].data!=""){
							if(resultString.length > 0 && resultString[resultString.length-1]!= ","){
								resultString += ",";
							}
							resultString += results[n].children[0].data;
						}
					}
				}
			}
		}
		//					console.log($());
		if (get.writeToDB == true) {
			if(resultString != ""){
				writeToDb(connection.escape(connection.escape(resultString),links[l+startFrom]));
			}
			//writeToDB();
		}
		fs.writeFileSync("numTracker.json", '{"data":' + (l+startFrom) + '}');
		console.log("Wrapping in silk at "+100*(l/(links.length-startFrom))+" percent.");
	}
	//fs.unlinkSync('numTracker.json');
	//fs.unlinkSync('links.json');
}


function requester(url) {
	var xmlhttp = new XMLHttpRequest();
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
	return xmlhttp.responseText;
}

function writeToDb(data) {
	console.log("DATA");
	console.log(data);
	var string = "";
	for (var i = 0; get.db.columns.length; i++) {
		if (string.length > 0) {
			string += ",";
		}
		string += get.db.columns["i"];
	}
	var sql = "INSERT INTO " + get.db.tName + " (" + string + ")VALUES (" + data + ")"
//	connection.query(sql, function(err, results) {
//		if (err != undefined) {
//			console.log(err);
//		}
//	});
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
		console.log(results);
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
