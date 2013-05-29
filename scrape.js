var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
var cheerio = require('cheerio');
var get = require('config.json');
var mysql = require('mysql');
var fs = require('fs');
var diff;
var timeStamp = 0;

diff = get.repeat.split(",");
for(var i = diff.length-1; i >= 0; i--){
	if(i == diff.length-1){
		timeStamp += parseInt(diff[i],10);
	}
	else if(i == diff.length-2){
		timeStamp += parseInt(diff[i],10)*1000;
	}
	else if(i == diff.length-3){
		timeStamp += parseInt(diff[i],10)*60000;
	}
	else if(i == diff.length-4){
		timeStamp += parseInt(diff[i],10)*60000 * 60;
	}
	else if(i == diff.length-5){
		timeStamp += parseInt(diff[i],10)*60000 * 60 * 24;
	}
}
console.log(timeStamp);
var connection = mysql.createConnection({
  host     : get.db.host,
  user     : get.db.user,
  password : get.db.pass,
  database : get.db.dbName
});

if(get.writeToDB == "true"){
	connection.query("TRUNCATE TABLE "+get.db.tName+" ;");
	console.log(get.db.tName+" truncated.");
}

console.log("Starting");
timed();

setInterval(function(){timed();},timeStamp);

function timed(){

	for(var j = 0; j < get.baseUrl.length; j++){
		console.log("Processing "+get.baseUrl[j]);
		var xmlhttp = new XMLHttpRequest();
		xmlhttp.open("GET",get.baseUrl[j] );
		xmlhttp.send();
		xmlhttp.onreadystatechange = function() {
			console.log("xmlhttpstatus = "+xmlhttp.status);
			if (xmlhttp.readyState == 4 && xmlhttp.status == 200) {
				console.log("Page responded with dom.");
				carryOn(xmlhttp.responseText);
				//console.log(xmlhttp.responseText);
			} else if (xmlhttp.readyState == 4 && xmlhttp.status == 404) {
				console.log("Page not found.");
				process.exit(1);
			}
		}
	}
}
function carryOn(thing){
	if(thing != ""){
				console.log("loading ");
			   $ = cheerio.load(thing);
			   //console.log($);
			   var tags = $('tr',thing);
			   console.log(tags.length);
			   for(var i = 0; i < tags.length; i++){
			   	console.log(i);
			   console.log(tags[i].children);
			   }
			   
			if(get.method == "eat"){  
			   var tags = $('strong', thing);
			   var post = "";
			for(var i = 0; i < tags.length; i=i+2){
				if(i > 3 && i < 24){
					if(get.writeToDB == "true"){
						writeToDb(Math.floor(i/4)+","+connection.escape(tags[i].children[0].data)+","+connection.escape(tags[i+1].children[0].data));
					}
				}
			}
			console.log("written to database. Finished. ");
			//connection.destroy();
		}
	}
	else{
		console.log("could not be found");
		process.exit(1);
	}
}

function writeToDb(data){
	if(get.method == "eat"){
		console.log(data);
		var sql = "INSERT INTO "+get.db.tName+" (day,type,description)VALUES ("+data+")"
		connection.query(sql,function(err,results){
		if(err!=undefined){console.log(err);}
		});
	}
}

function writeToFile(){
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
	resultObj = resultObj.replace(/\\n/g,"");
	fs.writeFile(get.retrieval.name, resultObj, function(err) {
		if (err)
			throw err;
		console.log('It\'s saved!');
		//	process.exit(1);
	});

});

}
