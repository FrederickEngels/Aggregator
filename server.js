'use strict';
/* global process */
/* global __dirname */
var express = require('express');
var app = express();
var fs = require("fs");

// Import blockchain-js
var Ibc1 = require('ibm-blockchain-js');
var ibc = new Ibc1(/*logger*/);             //you can pass a logger such as winston here - optional
var chaincode = {};

var chainCodeCall = require('./utils/chaincode_call.js');


// ==================================
// load peers manually or from VCAP, VCAP will overwrite hardcoded list!
// ==================================
try{
	//this hard coded list is intentionaly left here, feel free to use it when initially starting out
	//please create your own network when you are up and running
	//var manual = JSON.parse(fs.readFileSync('mycreds_docker_compose.json', 'utf8'));
	var manual = JSON.parse(fs.readFileSync('mycreds_bluemix.json', 'utf8'));
	var peers = manual.credentials.peers;
	console.log('loading hardcoded peers');
	var users = null;																			//users are only found if security is on
	if(manual.credentials.users) users = manual.credentials.users;
	console.log('loading hardcoded users');
}
catch(e){
	console.log('Error - could not find hardcoded peers/users, this is okay if running in bluemix');
}

if(process.env.VCAP_SERVICES){																	//load from vcap, search for service, 1 of the 3 should be found...
	var servicesObject = JSON.parse(process.env.VCAP_SERVICES);
	for(var i in servicesObject){
		if(i.indexOf('ibm-blockchain') >= 0){													//looks close enough
			if(servicesObject[i][0].credentials.error){
				console.log('!\n!\n! Error from Bluemix: \n', servicesObject[i][0].credentials.error, '!\n!\n');
				peers = null;
				users = null;
				process.error = {type: 'network', msg: 'Due to overwhelming demand the IBM Blockchain Network service is at maximum capacity.  Please try recreating this service at a later date.'};
			}
			if(servicesObject[i][0].credentials && servicesObject[i][0].credentials.peers){		//found the blob, copy it to 'peers'
				console.log('overwritting peers, loading from a vcap service: ', i);
				peers = servicesObject[i][0].credentials.peers;
				if(servicesObject[i][0].credentials.users){										//user field may or maynot exist, depends on if there is membership services or not for the network
					console.log('overwritting users, loading from a vcap service: ', i);
					users = servicesObject[i][0].credentials.users;
				} 
				else users = null;																//no security
				break;
			}
		}
	}
}


// ==================================
// configure options for ibm-blockchain-js sdk
// ==================================
var options = 	{
					network:{
						peers: [peers[0]],																	//lets only use the first peer! since we really don't need any more than 1
						users: prefer_type1_users(users),													//dump the whole thing, sdk will parse for a good one
						options: {
									quiet: true, 															//detailed debug messages on/off true/false
									tls: detect_tls_or_not(peers), 											//should app to peer communication use tls?
									maxRetry: 1																//how many times should we retry register before giving up
								}
					},
					chaincode:{
						zip_url: 'https://github.com/FrederickEngels/Aggregator/archive/master.zip',
						unzip_dir: 'Aggregator-master/chaincode',													//subdirectroy name of chaincode after unzipped
						git_url: 'https://github.com/FrederickEngels/Aggregator/tree/master/chaincode',						//GO get http url
					
						//hashed cc name from prev deployment, comment me out to always deploy, uncomment me when its already deployed to skip deploying again
						//deployed_name: '16e655c0fce6a9882896d3d6d11f7dcd4f45027fd4764004440ff1e61340910a9d67685c4bb723272a497f3cf428e6cf6b009618612220e1471e03b6c0aa76cb'
					}
				};

//filter for type1 users if we have any
function prefer_type1_users(user_array){
	var ret = [];
	for(var i in users){
		if(users[i].enrollId.indexOf('type1') >= 0) {	//gather the type1 users
			ret.push(users[i]);
		}
	}

	if(ret.length === 0) ret = user_array;				//if no users found, just use what we have
	return ret;
}

//see if peer 0 wants tls or no tls
function detect_tls_or_not(peer_array){
	var tls = false;
	if(peer_array[0] && peer_array[0].api_port_tls){
		if(!isNaN(peer_array[0].api_port_tls)) tls = true;
	}
	return tls;
}

if(process.env.VCAP_SERVICES){
	console.log('\n[!] looks like you are in bluemix, I am going to clear out the deploy_name so that it deploys new cc.\n[!] hope that is ok budddy\n');
	options.chaincode.deployed_name = '';
}

// ---- Fire off SDK ---- //
var chaincode = null;																		//sdk will populate this var in time, lets give it high scope by creating it here
ibc.load(options, function (err, cc){														//parse/load chaincode, response has chaincode functions!
	if(err != null){
		console.log('! looks like an error loading the chaincode or network, app will fail\n', err);
		if(!process.error) process.error = {type: 'load', msg: err.details};				//if it already exist, keep the last error
	}
	else{
		chaincode = cc;
		chainCodeCall.setup(ibc, cc);																//pass the cc obj to part 1 node code
		
		// ---- To Deploy or Not to Deploy ---- //
		if(!cc.details.deployed_name || cc.details.deployed_name === ''){					//yes, go deploy
			cc.deploy('init', ['99'], {delay_ms: 30000}, function(e){ 						//delay_ms is milliseconds to wait after deploy for conatiner to start, 50sec recommended
				check_if_deployed(e, 1);
			});
		}
		else{																				//no, already deployed
			console.log('chaincode summary file indicates chaincode has been previously deployed');
			check_if_deployed(null, 1);
		}
	}
});

//loop here, check if chaincode is up and running or not
function check_if_deployed(e, attempt){
	if(e){
		cb_deployed(e);																		//looks like an error pass it along
	}
	else if(attempt >= 15){																	//tried many times, lets give up and pass an err msg
		console.log('[preflight check]', attempt, ': failed too many times, giving up');
		var msg = 'chaincode is taking an unusually long time to start. this sounds like a network error, check peer logs';
		if(!process.error) process.error = {type: 'deploy', msg: msg};
		cb_deployed(msg);
	}
	else{
		console.log('[preflight check]', attempt, ': testing if chaincode is ready');
		chaincode.query.read(['_marbleindex'], function(err, resp){
			var cc_deployed = false;
			try{
				if(err == null){															//no errors is good, but can't trust that alone
					if(resp === 'null') cc_deployed = true;									//looks alright, brand new, no marbles yet
					else{
						var json = JSON.parse(resp);
						if(json.constructor === Array) cc_deployed = true;					//looks alright, we have marbles
					}
				}
			}
			catch(e){}																		//anything nasty goes here

			// ---- Are We Ready? ---- //
			if(!cc_deployed){
				console.log('[preflight check]', attempt, ': failed, trying again');
				setTimeout(function(){
					check_if_deployed(null, ++attempt);										//no, try again later
				}, 10000);
			}
			else{
				console.log('[preflight check]', attempt, ': success');
				cb_deployed(null);															//yes, lets go!
			}
		});
	}
}

function cb_deployed(e){
	console.log('------------------------------------------ Websocket Up ------------------------------------------');
	console.log('sdk has deployed code and waited');
	chaincode.query.read(['_marbleindex']);	
}


app.post('/registeration/insurance', function (req, res) {
   fs.readFile( __dirname + "/json/" + "insuranceRegisteration.json", 'utf8', function (err, data) {
	   if(err){
		   console.log(err);
	   }
	   else{
       console.log( data );
	   chainCodeCall.process_msg(data, "insuranceRegisteration");	   
       res.end( data );
	   }
   });
})

app.post('/registeration/vendor', function (req, res) {
   fs.readFile( __dirname + "/json/" + "vendorRegisteration.json", 'utf8', function (err, data) {
	   if(err){
		   console.log(err);
	   }
	   else{
	   console.log( data );
	   chainCodeCall.process_msg(data, "vendorRegisteration");	   
       res.end( data );	            
	   }
   });
})

app.post('/addNewRequest', function (req, res) {
   fs.readFile( __dirname + "/json/" + "addNewRequest.json", 'utf8', function (err, data) {
	   if(err){
		   console.log(err);
	   }
	   else{
       console.log( data );
	   chainCodeCall.process_msg(data, "addNewRequest");	   
       res.end( data );
	   }
   });
})

app.post('/updateRequest', function (req, res) {
   fs.readFile( __dirname + "/json/" + "addNewRequest.json", 'utf8', function (err, data) {
	   if(err){
		   console.log(err);
	   }
	   else{
       console.log( data );
	   chainCodeCall.process_msg(data, "updateRequest");	   
       res.end( data );
	   }
   });
})

app.get('/vendorDashboard/count/:id', function (req, res) {  
	console.log('vendor dashboard call'); 
		var obj = 	{
						vendorId: req.params.id,						
					};
       console.log( JSON.stringify(obj) );
	   chainCodeCall.process_msg(JSON.stringify(obj) , "vendorDashboardCount");	   
       res.end( JSON.stringify(obj) );   
})

app.get('/vendorDashboard/Details/:id/:reqStatus', function (req, res) {   
		var obj = 	{
						vendorId: req.params.id,						
						reqStatus: req.params.reqStatus
					};
       console.log( JSON.stringify(obj) );       
	   chainCodeCall.process_msg(JSON.stringify(obj) , "vendorRequestDetails");	   
       res.end( JSON.stringify(obj) );
})

app.get('/insuranceDashboard/count/:id', function (req, res) {   
		var obj = 	{
						insId: req.params.id,												
					};
       console.log( JSON.stringify(obj) );
	   chainCodeCall.process_msg(JSON.stringify(obj) , "insuranceDashboardCount");	   
       res.end( JSON.stringify(obj) );   
})

app.get('/insuranceDashboard/Details/:id/:reqStatus', function (req, res) {   
		var obj = 	{
						insId: req.params.id,						
						reqStatus: req.params.reqStatus
					};
       console.log( JSON.stringify(obj) );       
	   chainCodeCall.process_msg(JSON.stringify(obj) , "insurancerequestDetails");	   
       res.end( JSON.stringify(obj) );
})

app.get('/aggregatedDashboard/count/:id', function (req, res) {   
		var obj = 	{
						reqId: req.params.id,												
					};
       console.log( JSON.stringify(obj) );
	   chainCodeCall.process_msg(JSON.stringify(obj) , "aggregatedDashboardCount");	   
       res.end( JSON.stringify(obj) );   
})

app.get('/aggregatedDashboard/Details/:id/:reqStatus', function (req, res) {   
		var obj = 	{
						reqId: req.params.id,						
						reqStatus: req.params.reqStatus
					};
       console.log( JSON.stringify(obj) );       
	   chainCodeCall.process_msg(JSON.stringify(obj) , "aggregatedDashboardDetails");	   
       res.end( JSON.stringify(obj) );
})



  var server = app.listen(8081, function () {

  var host = server.address().address
  var port = server.address().port

  console.log("Example app listening at http://%s:%s", host, port)
 // ws.send("something");

})