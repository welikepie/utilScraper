var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
var cheerio = require('cheerio');
var get = require('./config.json');
get.db.addTimestamp = true;
var mysql = require('mysql');
var fs = require('fs');
var diff;
var timeStamp = 0;
var thresh = 0;
var absentConf;
if (get.writeToDB == true) {
//	if (get.finalSearch.length != get.db.columns.length) {
//		console.log("search paramaters not equal to column parameters");
//		process.exit(1);
//	}
}



if(get.updateDB == true){
	if("threshold" in get == false){
		console.log("Threshold not specified.");
		process.exit(1);
	}
	else{
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
	if("updateColumn" in get.db){
		if(get.db.updateColumn.length <= 0){
			console.log("Table column to update against is not specified adequately.");
			process.exit(1);		
		}
	}
	else{
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
console.log("Time until repeat: "+ timeStamp/1000/60+" minutes.");
var connection = mysql.createConnection({
	"host" : get.db.host,
	"user" : get.db.user,
	"password" : get.db.pass,
	"database" : get.db.dbName

});

if (get.writeToDB == "true") {
	//connection.query("TRUNCATE TABLE " + get.db.tName + " ;");
	console.log(get.db.tName + " truncated.");
}
function dropTable() {
	connection.query("TRUNCATE TABLE " + get.db.tName + " ;");
}

console.log("Hatching spiderlings.");
timed();

setInterval(function() {
	timed();
}, timeStamp);

function timed() {
	absentConf = fs.existsSync('numTracker.json');
	console.log("Scraping interrupted : "+absentConf);
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
	console.log("Scurrying.");
	$ = cheerio.load(thing);
	var resultLength = parseElements(get.searches[0]);
	var resultsArr = [];
	for(var i = 0; i < resultLength.length; i++){
		var returned = $(resultLength[i].replace(/>/g, " "));
		for(var a = 0; a < returned.length; a++){
			resultsArr.push(returned[a]);
			//console.log(returned[a]);
		}
	}
//	resultsArr = eliminateDuplicates(resultsArr);
//	console.log(resultsArr);
	for (var k = 0; k <= get.searches.length; k++) {
		if (get.method == "generic") {
			if (k < get.searches.length) {
				var tempResults = [];
				for (var l = 0; l < resultsArr.length; l++) {
					if(k == 0){var test = resultsArr[l].attribs.href;}
					if(k > 0){
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
				for (var l = 0; l < tempResults.length; l++) {
					var text = requester(tempResults[l]);
					$ = cheerio.load(text);
					console.log("Hunting " + tempResults[l] + ".");
					var parsed = parseElements(get.searches[k]);
					var tempArr = [];
					for(var z = 0; z < parsed.length; z++){
						var returned = $(parsed[z].replace(/>/g, " "));
						for(var b = 0; b < returned.length; b++){
							tempArr.push(returned[b]);
						}
					}
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
					console.log(Math.floor(100 * ((l+1) / tempResults.length)) + " % completed of pass " + (k+1) + " of " + (get.searches.length) + ".");
				}
			} else if (k == get.searches.length) {
				//console.log(get.preserve);
				console.log(resultsArr);
				//resultsArr = eliminateDuplicates(resultsArr);
				//if (get.baseUrl.indexOf(base) > 0) {
				//	var linkJson = JSON.parse(fs.readlinkSync('links.json'));
				//	fs.writeFileSync("links.json", '{"data":' + eliminateDuplicates(linkJson.data.concat(resultsArr)) + "}");
				//} else {
	//				console.log("writing this tree");
//					console.log(resultsArr);
					fs.writeFileSync("links.json", '{"data":'+JSON.stringify(eliminateDuplicates(resultsArr))+'}');
				//}
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
	if(get.clearDB == true){
		asyncLoop(1,function(loop){cleanDB(startFrom); loop.next()},function(){"cleaned"});
	}
	console.log('Spider digesting and saving progress.');
	var links = JSON.parse(fs.readFileSync("links.json","utf-8"));
	links = links.data;

	for (var l = 0; l < (links.length-startFrom); l++) {
		var text = requester(links[l+startFrom]);
		$ = cheerio.load(text);
		var resultString = "";
		for (var m = 0; m < get.finalSearch.length; m++) {
			var patternArr = parseElements(get.finalSearch[m]);
			var results = [];
			for(var z = 0; z < patternArr.length; z++){
				var temp = $(patternArr[z].replace(/>/g, " "));
				for(var y = 0; y < temp.length; y++){
					results.push(temp[y]);
				}
			}
			//results = eliminateDuplicates(results);
			//console.log(results);
			for(var n = 0; n < results.length; n++){
				//console.log(results[n]);
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
				writeToDb(connection.escape(resultString)+","+connection.escape(links[l+startFrom]));	
			}
			//writeToDB();
		}
		fs.writeFileSync("numTracker.json", '{"data":' + (l+startFrom) + '}');
		console.log("Wrapping in silk at "+Math.floor(100*((l + startFrom)/links.length))+"% completion. "+(links.length-(l+startFrom))+" links remaining.");
	}
	fs.unlinkSync('numTracker.json');
	fs.unlinkSync('links.json');
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
	if(get.db.addTimestamp == true){
		var sql = "INSERT INTO " + get.db.tName + " (" + string + ",timestamp) VALUES (" + data + ","+new Date().getTime()+")";		
	}
	else{
		var sql = "INSERT INTO " + get.db.tName + " (" + string + ") VALUES (" + data + ")";
	}
	
	sql += " ON DUPLICATE KEY UPDATE ";
	var dataSplit = data.replace(/" "/g,"").replace(/','/g, "'|'");
	for(var z = 0; z < string.split(",").length; z++){
		sql += string.split(",")[z];
		sql += " = "+dataSplit.split("|")[z];
		if(z < string.split(",").length - 1){
			sql+=",";
		}
	}
	if(get.db.addTimestamp == true){
		sql += ", timestamp = "+new Date().getTime();
	}
//	console.log(sql);
	var pushed = false;
//	while(pushed == false){
//		console.log("entered");
	asyncLoop(1,function(loop){
	connection.query(sql, function(err, results) {
		if (err != undefined) {
			console.log(err);
			return;
		}
		console.log(results);
		});
	loop.next();
	}
	,function(){console.log("Written")});
	//}
	//pushed = false;
}

function asyncLoop(iterations, func, callback) {
    var index = 0;
    var done = false;
    var loop = {
        "next": function() {
            if (done) {
                return;
            }

            if (index < iterations) {
                index++;
                func(loop);

            } else {
                done = true;
                callback();
            }
        },

        "iteration": function() {
            return index - 1;
        },

        "break": function() {
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



function parseElements(input){
	//console.log(input);
	if(typeof(input)!="string"){throw "Input is of invalid type.";}
	var string = input.replace(/\s/g, '');
	var array = string.split(">");
	//console.log(array);
	var sortedArr = [];
	var finalArr = [];
	var foundVar = -1;
	for(var i = 0; i < array.length; i++){		
		if(array[i].indexOf("(")!=-1){
			foundVar = i;
			var str = "";
		}
		if(foundVar == -1){
			sortedArr.push(array[i]);
		}
		
		if(array[i].indexOf(")")!=-1){
			for(var k = foundVar; k <= i; k++){
				if(k > foundVar){
					str +=">";
				}
					str += array[k];	
				}
				sortedArr.push(str);
			foundVar = -1;
		}
	}
	//previous segment splits via >, and then re-merges segments which have () in them.
	for(var i = 0; i < sortedArr.length; i++){
		if(sortedArr[i].indexOf("(")!=-1){
			var newString = "";
			for(var k = 0; k <= i; k++){
				//console.log("()"+sortedArr[k]);
				if(k > 0){
					newString += ">";
				}
				if (k == i){
					var regexMatch = sortedArr[i].match(/\(.*?\)/);
					newString += regexMatch[0].substring(1,regexMatch[0].length-1); 
					
				}
				if(k < i){
					newString += sortedArr[k]; 
				}
			}
			finalArr.push(newString);
			sortedArr[i]=sortedArr[i].split("+")[1];
		}
		if(i == sortedArr.length-1){
			var newString = "";
			for(var i = 0; i < sortedArr.length; i++){
				if(i > 0){
					newString += ">";
				}
				newString += sortedArr[i];
			}
			finalArr.push(newString);
			//write all of this as a pattern and push to finalArr.
		}
		
	}
	if(finalArr.length > 0){
		return finalArr;
	}	
	else{
		throw "Pattern is of unparseable type.";
	}
//	process.exit(1);
}
function cleanDB(startFrom){
	if(startFrom == 0 && get.updateDB == true && get.db.addTimestamp == true){
		var links = JSON.parse(fs.readFileSync("links.json","utf-8"));
	links = links.data;
		console.log("Cleaning the web.");
			var linkArr = [];
		var toRemove = [];
		var newArr = [];
		var toUpdate = [];
		var time = [];
		var sql = "SELECT "+get.db.columns[get.db.columns.length - 1]+",timestamp FROM "+ get.db.tName +" ORDER BY `timestamp` ASC";
		asyncLoop(1,function(loop){connection.query(sql, function(err, results) {
			//console.log("SQLING STUFF");
			if (err != undefined) {
				console.log(err);
				return;
			}
			if(results.length > 0){
				for(var k = 0; k < results.length; k++){
					if(get.baseUrl.indexOf(results[k][get.db.columns[get.db.columns.length - 1]])==-1||links.indexOf(results[k][get.db.columns[get.db.columns.length - 1]]) == -1){
						//console.log(results[k]);
						toRemove.push(results[k][get.db.columns[get.db.columns.length - 1]]);
					}
					time.push(results[k].timestamp);
					linkArr.push(results[k][get.db.columns[get.db.columns.length - 1]]);
				}
				for(var k = 0; k < links.length; k++){
					if(linkArr.indexOf(links[k]) != -1){
						if(get.threshold < new Date().getTime() - time[k]){
							toUpdate.push(link[k]);	
						}
					}
					else{
						newArr.push(link[k]);
					}
				}
			}
			links = eliminateDuplicates(newArr.concat(toUpdate));	
			for(var k = 0; k < toRemove.length; k++){
				var sql = "DELETE FROM "+get.db.tName+" WHERE "+get.db.columns[get.db.columns.length - 1]+" = \""+toRemove[k]+"\"";
					//console.log(sql);
					asyncLoop(1,function(loop){
					connection.query(sql, function(err, results) {
						if (err != undefined) {
							console.log(err);
							return;
						}
						//console.log(results);
						});
					loop.next();
					}
					,function(){console.log("Deleted")});
												
			}
		loop.next();
		})}
		,function(){console.log("Deleted all.")});
	}
}
