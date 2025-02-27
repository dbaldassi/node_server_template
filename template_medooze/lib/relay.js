const TransactionManager = require("transaction-manager");
//Get the Medooze Media Server interface
const MediaServer = require("medooze-media-server");
const VideoCodecs = require("h264-encoder-mockup");

//Get Semantic SDP objects
const SemanticSDP	= require("semantic-sdp");
const SDPInfo		= SemanticSDP.SDPInfo;
const MediaInfo		= SemanticSDP.MediaInfo;
const CandidateInfo	= SemanticSDP.CandidateInfo;
const DTLSInfo		= SemanticSDP.DTLSInfo;
const ICEInfo		= SemanticSDP.ICEInfo;
const StreamInfo	= SemanticSDP.StreamInfo;
const TrackInfo		= SemanticSDP.TrackInfo;
const Direction		= SemanticSDP.Direction;
const CodecInfo		= SemanticSDP.CodecInfo;

VideoCodecs.enableDebug(false);
VideoCodecs.enableUltraDebug(false);

const Capabilities = {
	audio: {
		codecs: ["opus"],
		extensions: [
			//"http://www.ietf.org/id/draft-holmer-rmcat-transport-wide-cc-extensions-01",
			"http://www.webrtc.org/experiments/rtp-hdrext/abs-send-time",
			"urn:ietf:params:rtp-hdrext:sdes:rtp-stream-id",
			"urn:ietf:params:rtp-hdrext:sdes:mid"
		],
	},
	video : {
	    codecs		: ["vp8", "h264;packetization-mode=1"],
		rtx		: true,
		rtcpfbs		: [
			{ "id": "transport-cc"},
			{ "id": "ccm", "params": ["fir"]},
			{ "id": "nack"},
			{ "id": "nack", "params": ["pli"]}
		],
		extensions	: [
			"urn:3gpp:video-orientation",
			"http://www.ietf.org/id/draft-holmer-rmcat-transport-wide-cc-extensions-01",
			"urn:ietf:params:rtp-hdrext:sdes:repaired-rtp-stream-id",
			"urn:ietf:params:rtp-hdrext:sdes:rtp-stream-id",
			"urn:ietf:params:rtp-hdrext:sdes:mid",
		]
	}
};

let counter = 0;
var outgoingStream = [];
var incomingStream = [];

function createTransportAndAnswer(endpoint, offer) {    
    //Create an DTLS ICE transport in that enpoint
    const transport = endpoint.createTransport(offer);
    
    //Set RTP remote properties
    transport.setRemoteProperties(offer);
    
    //Create local SDP info
    const answer = offer.answer({
	dtls		: transport.getLocalDTLSInfo(),
	ice		: transport.getLocalICEInfo(),
	candidates	: endpoint.getLocalCandidates(),
	capabilities	: Capabilities
    });

    console.log(endpoint.getLocalCandidates());

    //Set RTP local  properties
    transport.setLocalProperties(answer);

    return [answer, transport];
}

module.exports = function(request, protocol, endpoint)
{
    const connection = request.accept(protocol);
    
    // const tm = new TransactionManager(connection);
    
    connection.on('message', (frame) => {
	let msg = JSON.parse(frame.utf8Data);
	
	//Get cmd
	if (msg.cmd === "publish") {
	    //Process the sdp
	    let offer = SDPInfo.process(msg.offer);
	    let [answer, transport] = createTransportAndAnswer(endpoint, offer);
	    
	    //For each stream offered
	    incomingStream = [];
	    for (let offered of offer.getStreams().values()) {
		//Create the remote stream into the transport
		const is = transport.createIncomingStream(offered);
		incomingStream.push(is);
	    }

	    //Send response
	    connection.sendUTF(JSON.stringify({ answer : answer.toString() }));
	    //Close on disconnect
	    connection.on("close",() => {
		if(transport) transport.stop();
		incomingStream.forEach(elt => elt.stop());
	    });
	}
	else if (msg.cmd === "view") {
	    //Process the sdp
	    let offer = SDPInfo.process(msg.offer);
	    let [ answer, transport ] = createTransportAndAnswer(endpoint, offer);

	    // Create new transaction manager
	    const tm = new TransactionManager(connection);

	    // Create id
	    const id = "quic-relay-" + Date.now() + "-" + (counter++);

	    // transport.dump("www/quic-relay/dumps/" + id + ".pcap");

	    // tm.event("url", "/quic-relay/dumps/" + id + ".csv");

	    transport.setBandwidthProbing(true);
	    transport.setProbingBitrateLimit(2000000);
	    transport.on("targetbitrate", (bitrate) =>	{
		// console.log("targetbitrate", bitrate/1000);
		// const encodingBitrate = Math.min(bitrate/1000, 2000) ;
		// fake.setBitrate(30, encodingBitrate);
		// transport.setBandwidthProbing(encodingBitrate < 2000);
	    });
	    
	    for(let is of incomingStream) {
		let os  = transport.createOutgoingStream({
		    audio: true,
		    video: true
		});
		
		outgoingStream.push(os);
		//Get local stream info
		const info = os.getStreamInfo();
		//Copy incoming data from the remote stream to the local one
		os.attachTo(is);
		//Add local stream info it to the answer
		answer.addStream(info);
	    }

	    //Send response
	    connection.sendUTF(JSON.stringify({ answer : answer.toString() }));
	    //Close on disconnect
	    connection.on("close",() => {
		if(transport) transport.stop();
		outgoingStream.forEach(elt => elt.stop());
	    });
	}
	else return;
    });
};
