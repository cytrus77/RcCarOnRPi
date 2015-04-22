//declare required modules
var app = require('http').createServer(handler)
  , io = require('socket.io').listen(app)
  , fs = require('fs')
  , static = require('node-static')
  , sys = require('sys')
  , piblaster = require('pi-blaster.js')
  , sleep = require('sleep')
  , argv = require('optimist').argv;
  app.listen(8080);


//Make a web server on port 8080
//
var file = new(static.Server)();
function handler(request, response) 
{
  console.log('serving file',request.url)
  file.serve(request, response);
};


var pin_przyspieszenie = 17;
var pin_skretu = 18;
var pin_przod = 22;
var pin_wsteczny = 25;
var pin_wlewo = 23;
var pin_wprawo = 24;
var logcount = 0;
var przyspieszenie = 0; //w %
var skret = 0;
var opoznienie_przyspieszenia = 0.02;
var opoznienie_skrecania = 0.10;

console.log('Pi Car we server listening on port 8080 visit http://ipaddress:8080/socket.html');

lastAction = "";


//If we lose comms set the servos to neutral
//
function emergencyStop()
{
	//enter 0 point here specific to your pwm control
  	piblaster.setPwm(pin_przyspieszenie, 0);
 	piblaster.setPwm(pin_skretu, 0);
 	piblaster.setPwm(pin_przod, 0);
 	piblaster.setPwm(pin_wsteczny, 0);
 	piblaster.setPwm(pin_wlewo, 0);
 	piblaster.setPwm(pin_wprawo, 0);

  	console.log('###EMERGENCY STOP - signal lost or shutting down');
}//END emergencyStop


// fire up a web socket server isten to cmds from the phone and set pwm
// accordingly, if using a separate battery pack then disable the 
// motor acceleration rate limiting algorithm as this is required when the
// Pi and motors share the same battery.
//
io.sockets.on('connection', function (socket) 
{ 
	//got phone msg
	socket.on('fromclient', function (data) 
	{
		var temp_kierunek, temp_skret;
		
		logcount = logcount + 1;
		
		temp_kierunek = data.gamma / 45;
		temp_skret = data.beta / 45;
		
		if(temp_kierunek >= 0)
		{
		 	piblaster.setPwm(pin_przod, 1);	
			piblaster.setPwm(pin_wsteczny, 0);
		}
		else 
		{
		 	piblaster.setPwm(pin_przod, 0);	
			piblaster.setPwm(pin_wsteczny, 1);
 			temp_kierunek = Math.abs(temp_kierunek);
		}
		
		if(temp_kierunek > 1) {temp_kierunek = 1;}
			
		if( Math.abs(temp_kierunek - przyspieszenie) < opoznienie_przyspieszenia)
		{
			przyspieszenie = temp_kierunek;
		}
		else
		{
			if(temp_kierunek > przyspieszenie) { przyspieszenie = przyspieszenie + opoznienie_przyspieszenia;}
			else { przyspieszenie = przyspieszenie - opoznienie_przyspieszenia;}
		}
	
	
		if(temp_skret >= 0)
		{
		 	piblaster.setPwm(pin_wlewo, 1);	
			piblaster.setPwm(pin_wprawo, 0);
		}
		else
		{
		 	piblaster.setPwm(pin_wlewo, 0);	
			piblaster.setPwm(pin_wprawo, 1);
 			Math.abs(temp_skret);
		}
			
		if(temp_skret > 1) {temp_skret = 1;}
			
		if( Math.abs(temp_skret - skret) < opoznienie_skrecania)
		{
			skret = temp_skret;
		}
		else
		{
			if(temp_skret > skret) { skret = skret + opoznienie_skrecania;}
			else { skret = skret - opoznienie_skrecania;}
		}
		
		// dont let char echos slow dn the app; we are running at 20Hz
		// dont le the console limit this due to slow echoing of chars
		if(logcount == 10)
		{
			//@ 2 Hz
			logcount = 0;
			console.log("Beta: "+data.beta+" Gamma: "+data.gamma);
			console.log("Przyspieszenie: "+Math.round(przyspieszenie*100)+"%  Skret: "+Math.round(skret*100)+"%");
		}
		
		logcount++;
		
		//control car using clever pwm gpio library
		piblaster.setPwm(pin_przyspieszenie, przyspieszenie); //throttle using soft pwm
		piblaster.setPwm(pin_skretu, skret); //throttle using soft pwm
	
		
		clearInterval(lastAction); //stop emergency stop timer
		lastAction = setInterval(emergencyStop,2000); //set emergency stop timer for 1 second
				
	});
});//END io.sockets.on


//user hits ctrl+c
//
process.on('SIGINT', function() 
{
  emergencyStop();
  console.log("\nGracefully shutting down from SIGINT (Ctrl-C)");
 
  return process.exit();
});//END process.on 
