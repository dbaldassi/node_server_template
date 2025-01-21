const url = "wss://"+window.location.hostname+":"+window.location.port;
//Get our url
const href = new URL(window.location.href);
const autostart = href.searchParams.has("autostart");
const turn = href.searchParams.get("turn"); 
const turnUsername = href.searchParams.get("turnUsername"); 
const turnCredential = href.searchParams.get("turnCredential"); 

var opts = {
    lines: 12, // The number of lines to draw
    angle: 0.15, // The length of each line
    lineWidth: 0.44, // 0.44 The line thickness
    pointer: {
	length: 0.8, // 0.9 The radius of the inner circle
	strokeWidth: 0.035, // The rotation offset
	color: '#A0A0A0'     // Fill color
    },
    limitMax: true,
    colorStart: '#28c1d1', // Colors
    colorStop: '#28c1d1', // just experiment with them
    strokeColor: '#F0F0F0', // to see which ones work best for you
    generateGradient: false,
    gradientType: 0
};
var targets = document.querySelectorAll('.gaugeChart'); // your canvas element
var gauges = [];
for (var i=0;i<targets.length;++i)
{
    gauges[i] = new Gauge(targets[i]).setOptions (opts); // create sexy gauge!
    gauges[i].animationSpeed = 10000; // set animation speed (32 is default value)
    gauges[i].set (0); // set actual value
}
gauges[0].maxValue = 1280; 
gauges[1].maxValue = 720; 
gauges[2].maxValue = 30; 
gauges[3].maxValue = 1024; 

var texts =  document.querySelectorAll('.gaugeChartLabel');
var ssrcs;
let pc;
let csv;

function addVideoForStream(stream, muted)
{
    //Create new video element
    const video = document.querySelector (muted ? "#local" : "#remote");
    //Set same id
    video.streamid = stream.id;
    //Set src stream
    video.srcObject = stream;
    //Set other properties
    video.autoplay = true;
    video.playsInline = true;
    video.muted = muted;
}

function addRemoteTrack(event) 
{
    var prev = 0,prevFrames = 0,prevBytes = 0;
    console.debug("ontrack", event);
    const stream = event.streams[0];
    //Play it
    addVideoForStream(stream);
    //Get track
    var track = stream.getVideoTracks()[0];
    //Update stats
    let interval = setInterval(async function(){
	var results;

	try {
	    //For ff
	    results = await pc.getStats(track);
	} catch(e) {
	    //For chrome
	    results = await pc.getStats();
	}
	//Get results
	for (let result of results.values())
	{
	    if (result.type==="inbound-rtp")
	    {
		//Get timestamp delta
		var delta = result.timestamp-prev;
		//Store this ts
		prev = result.timestamp;

		//Get values
		var width = track.width || remote.videoWidth;//result.stat("googFrameWidthReceived");
		var height = track.height || remote.videoHeight;//result.stat("googFrameHeightReceived");
		var fps =  (result.framesDecoded-prevFrames)*1000/delta;
		var kbps = (result.bytesReceived-prevBytes)*8/delta;
		//Store last values
		prevFrames = result.framesDecoded;
		prevBytes  = result.bytesReceived;
		//If first
		if (delta==result.timestamp || isNaN(fps) || isNaN (kbps))
		    return;

		for (var i=0;i<targets.length;++i)
		    gauges[i].animationSpeed = 10000000; // set animation speed (32 is default value)
		gauges[0].set(width);
		gauges[1].set(height);
		gauges[2].set(Math.min(Math.floor(fps)   ,30));
		gauges[3].set(Math.min(Math.floor(kbps) ,1024));
		texts[0].innerText = width;
		texts[1].innerText = height;
		texts[2].innerText = Math.floor(fps);
		texts[3].innerText =  Math.floor(kbps);
	    }
	}
    }, 1000);

    //Stop stats on ended track
    track.addEventListener("ended", (event) =>	clearInterval(interval) );
};

function subscribe() {
    // Connect with websocket
    const ws = new WebSocket(url, "relay");
    // Crete transaction manager 
    // const tm = new TransactionManager(ws);
    
    //Start on open
    ws.onopen = async () => {
	//Create new managed pc 
	pc = new RTCPeerConnection();
	pc.addEventListener('connectionstatechange', event => {
	    console.log("remote pc : " + pc.connectionState);
	});
	
	pc.addTransceiver("video", { direction: "recvonly" });
	pc.addTransceiver("audio", { direction: "recvonly" });
			  
	//On new remote tracks
	pc.ontrack = (event) => addRemoteTrack(event);

	const offer = await pc.createOffer();
	await pc.setLocalDescription(offer);

	ws.send(JSON.stringify({ cmd: "view", offer: offer.sdp }));

	document.querySelector('#unsubscribe').style.display = "initial";
    };

    ws.onmessage = async (msg) => {
	let ans = JSON.parse(msg.data);
	if(ans.answer) {
	    pc.setRemoteDescription(new RTCSessionDescription({
		type: 'answer',
		sdp: ans.answer
	    }));
	}
    };

    ws.onclose = async () => {};

    document.querySelector('#unsubscribe').addEventListener("click", () => { pc.close(); ws.close(); });
};

function publish() {
    // Connect with websocket
    const ws = new WebSocket(url, "relay");
    //Start on open
    ws.onopen = async () => {
	const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
	addVideoForStream(stream, true);
	
        //Create new managed pc
        pc = new RTCPeerConnection();
        pc.addEventListener('connectionstatechange', event => {
            console.log("local pc : " + pc.connectionState);
        });

	stream.getTracks().forEach(track => pc.addTransceiver(track, { direction: "sendonly" }));

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        ws.send(JSON.stringify({ cmd: "publish", offer: offer.sdp }));

        document.querySelector('#unpublish').style.display = "initial";
    };

    ws.onmessage = async (msg) => {
        let ans = JSON.parse(msg.data);
        if(ans.answer) {
            pc.setRemoteDescription(new RTCSessionDescription({
                type: 'answer',
                sdp: ans.answer
            }));
        }
    };

    ws.onclose = async () => {};

    document.querySelector('#publish').addEventListener("click", () => { pc.close(); ws.close(); });
}

(function() {
    document.querySelector('#publish').addEventListener("click", () => {
	document.querySelector("#publish").style.display = "none";
	publish();
    });
    
    document.querySelector('#subscribe').addEventListener("click", () => {
        document.querySelector('#subscribe').style.display = "none";
        subscribe();
    });
})();
