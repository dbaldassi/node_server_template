// Node modules
const Express           = require("express");
const CORS              = require("cors");
const FS                = require("fs");
const { createServer }  = require("https");

// server port
const PORT = 9000;

//Create rest api
const rest = Express();
rest.use(CORS());
rest.use(Express.static("www"));

// Load certs
const options = {
	key     : FS.readFileSync ("server.key"),
	cert	: FS.readFileSync ("server.cert")
};

// Manualy start server
const server = createServer(options, rest);
server.listen(PORT);
