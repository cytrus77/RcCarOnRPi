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

var pin_przod = 17;
var pin_wsteczny = 18;
var pin_wlewo = 22;
var pin_wprawo = 23;
var logcount = 0;
var doprzodu = 0; //w %
var dotylu = 0;
var wlewo = 0;
var wprawo = 0;
var opoznienie_przyspieszenia = 0.01;


console.log('Pi Car we server listening on port 8080 visit http://ipaddress:8080/socket.html');

lastAction = "";

//If we lose comms set the servos to neutral
//
function emergencyStop()
{
	//enter 0 point here specific to your pwm control
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
		
		temp_kierunek = data.gamma / 45;
		
		if(temp_kierunek >= 0)
		{
			dotylu = 0;
			if(temp_kierunek > 1) {temp_kierunek = 1;}
			
			if( Math.abs(temp_kierunek - doprzodu) < opoznienie_przyspieszenia)
			{
				doprzodu = temp_kierunek;
			}
			else
			{
				if(temp_kierunek > doprzodu) { doprzodu = doprzodu + opoznienie_przyspieszenia;}
				else { doprzodu = doprzodu - opoznienie_przyspieszenia;}
			}
		}
		else
		{
			temp_kierunek = Math.abs(temp_kierunek);
			doprzodu = 0;
			if(temp_kierunek > 1) {temp_kierunek = 1;}
			
			if( Math.abs(temp_kierunek - dotylu) < opoznienie_przyspieszenia)
			{
				dotylu = temp_kierunek;
			}
			else
			{
				if(temp_kierunek > dotylu) { doprzodu = dotylu + opoznienie_przyspieszenia;}
				else { dotylu = dotylu - opoznienie_przyspieszenia;}
			}
		}
		
		logcount = logcount + 1;
		
		
		
		
		// dont let char echos slow dn the app; we are running at 20Hz
		// dont le the console limit this due to slow echoing of chars
		if(logcount == 10)
		{
			//@ 2 Hz
			logcount = 0;
			console.log("Beta: "+data.beta+" Gamma: "+data.gamma);
			console.log("Przod: "+doprzodu*100+"%  Tyl: "+dotylu*100+"%  Lewo: "+wlewo*100+"%  Prawo: "+wprawo*100);
		}
		
		//control car using clever pwm gpio library
		if(doprzodu > 0)
		{
			piblaster.setPwm(pin_przod, doprzodu); //throttle using soft pwm
			piblaster.setPwm(pin_wsteczny, 0); //throttle using soft pwm
		}
		else
		{
			piblaster.setPwm(pin_przod, 0); //throttle using soft pwm
			piblaster.setPwm(pin_wsteczny, dotylu); //throttle using soft pwm
		}
		
		if(wlewo > 0)
		{
			piblaster.setPwm(pin_wlewo, wlewo); //throttle using soft pwm
			piblaster.setPwm(pin_wprawo, 0); //throttle using soft pwm
		}
		else
		{
			piblaster.setPwm(pin_wlewo, 0); //throttle using soft pwm
			piblaster.setPwm(pin_wprawo, wprawo); //throttle using soft pwm
		}
		
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
