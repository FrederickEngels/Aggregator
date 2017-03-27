// ==================================
// Part 1 - incoming messages, look for type
// ==================================
var ibc = {};
var chaincode = {};
var async = require('async');

module.exports.setup = function(sdk, cc){
	ibc = sdk;
	chaincode = cc;
};

module.exports.process_msg = function(data, type){
	if(type == "insuranceRegisteration"){
		console.log("Calling chain code for insuranceRegisteration");
		//chaincode.invoke.init_marble([data.name, data.color, data.size, data.user],cb_invoked);		
		chaincode.invoke.write(data.insId,data,cb_invoked);
	}
	else if(type == "vendorRegisteration"){
		console.log("Calling chain code for vendorRegisteration");
		chaincode.invoke.write(data.vendorId,data,cb_invoked);
	}
	else if(type == "addNewRequest"){
		console.log("Calling chain code for addNewRequest");
		chaincode.invoke.write(data.reqId,data,cb_invoked);
	}
	else if(type == "updateRequest"){
		console.log("Calling chain code for updateRequest");
		chaincode.invoke.write(data.reqId,data,cb_invoked);
	}
	else if(type == "vendorDashboardCount"){
		console.log("Calling chain code for vendorDashboardCount");
		chaincode.invoke.read(data.vendorId,cb_invoked);
	}
	else if(type == "vendorRequestDetails"){
		console.log("Calling chain code for vendorRequestDetails");
		chaincode.invoke.read(data.vendorId,cb_invoked);
	}
	else if(type == "insuranceDashboardCount"){
		console.log("Calling chain code for insuranceDashboardCount");
		chaincode.invoke.read(data.insId,cb_invoked);
	}
	else if(type == "insurancerequestDetails"){
		console.log("Calling chain code for insurancerequestDetails");
		chaincode.invoke.read(data.insId,cb_invoked);;
	}
	
	//got the marble index, lets get each marble
	function cb_got_index(e, index){
		if(e != null) console.log('[ws error] did not get marble index:', e);
		else{
			try{
				var json = JSON.parse(index);
				var keys = Object.keys(json);
				var concurrency = 1;

				//serialized version
				async.eachLimit(keys, concurrency, function(key, cb) {
					console.log('!', json[key]);
					chaincode.query.read([json[key]], function(e, marble) {
						if(e != null) console.log('[ws error] did not get marble:', e);
						else {
							if(marble) sendMsg({msg: 'marbles', e: e, marble: JSON.parse(marble)});
							cb(null);
						}
					});
				}, function() {
					sendMsg({msg: 'action', e: e, status: 'finished'});
				});
			}
			catch(e){
				console.log('[ws error] could not parse response', e);
			}
		}
	}
	
	function cb_invoked(e, a){
		console.log('response: ', e, a);
	}
	
	//call back for getting the blockchain stats, lets get the block stats now
	function cb_chainstats(e, chain_stats){
		if(chain_stats && chain_stats.height){
			chain_stats.height = chain_stats.height - 1;								//its 1 higher than actual height
			var list = [];
			for(var i = chain_stats.height; i >= 1; i--){								//create a list of heights we need
				list.push(i);
				if(list.length >= 8) break;
			}
			list.reverse();																//flip it so order is correct in UI
			async.eachLimit(list, 1, function(block_height, cb) {						//iter through each one, and send it
				ibc.block_stats(block_height, function(e, stats){
					if(e == null){
						stats.height = block_height;
						sendMsg({msg: 'chainstats', e: e, chainstats: chain_stats, blockstats: stats});
					}
					cb(null);
				});
			}, function() {
			});
		}
	}
	
	//send a message, socket might be closed...
	function sendMsg(json){
		if(ws){
			try{
				ws.send(JSON.stringify(json));
			}
			catch(e){
				console.log('[ws error] could not send msg', e);
			}
		}
	}
};