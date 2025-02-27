// Node modules
const Express           = require("express");
const CORS              = require("cors");
const FS                = require("fs");
const { createServer }  = require("https");
const WebSocketServer   = require("websocket").server;

//Get the Medooze Media Server interface
const MediaServer = require("medooze-media-server");

// server port
const PORT = 8084;

//Check
if (process.argv.length!=3)
	 throw new Error("Missing IP address\nUsage: node index.js <ip>");
//Get ip
const ip = process.argv[2];

//Restrict port range
MediaServer.setPortRange(10000,10100);

//Create UDP server endpoint
const endpoint = MediaServer.createEndpoint(ip);

//Enable debug
MediaServer.enableDebug(false);
MediaServer.enableUltraDebug(false);

//Create rest api
const rest = Express();
rest.use(CORS());
rest.use(Express.static("www"));

// Load the demo handlers
const handlers = {
	"relay" : require("./lib/relay.js"),
};

function wss(server) {
    //Create websocket server
    const wssServer = new WebSocketServer ({
	httpServer: server,
	autoAcceptConnections: false
    });

    wssServer.on("request", (request) => {
	request.on('requestAccepted', () => console.log('Request accepted'));
	request.on('requestRejected', () => console.log('Request rejected'));

	//Get protocol for demo
	var protocol = request.requestedProtocols[0];

	console.log ("-Got request for: " + protocol);
	
	//If nor found
	if (!handlers.hasOwnProperty (protocol)) {
	    //Reject connection
	    request.reject();
	    return;
	}
	
	//Process it
	handlers[protocol] (request, protocol, endpoint);
    });
}

// Load certs
const options = {
    key  : FS.readFileSync ("server.key"),
    cert : FS.readFileSync ("server.cert")
};

// Manualy start server
const server = createServer(options, rest).listen(PORT);
wss(server);

//Try to clean up on exit
const onExit = (e) => {
    if (e) console.error(e);
    MediaServer.terminate();
    process.exit();
};

process.on("uncaughtException"	, onExit);
process.on("SIGINT"		, onExit);
process.on("SIGTERM"		, onExit);
process.on("SIGQUIT"		, onExit);
