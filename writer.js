var fs = require('fs');
var get = require('config.json');
var mysql = require('mysql');
var resultObj;

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

var connection = mysql.createConnection({
	host : get.db.host,
	user : get.db.user,
	password : get.db.pass,
	database : get.db.dbName
});

write();
setInterval(function(){write();},timeStamp);



function write(){
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
				//process.exit(1);
		});
	
	});
}

