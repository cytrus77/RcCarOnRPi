//declare required modules
var app = require('http').createServer(handler)
  , io = require('socket.io').listen(app)
  , fs = require('fs')
  , static = require('node-static')
  , sys = require('sys')
  , piblaster = require('pi-blaster.js')
  , Gpio = require('onoff').Gpio
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

//piny kontrolera silnikow
var pin_przyspieszenie = 17;
var pin_skretu = 18;
var pin_przod = 22;
var pin_wsteczny = 25;
var pin_wlewo = 23;
var pin_wprawo = 24;

//piny polozenia kol
var pin_zolty = 16;
var pin_zielony =20 ;
var pin_niebieski = 21;

var obiekt_zolty = new Gpio(pin_zolty, 'in');
var obiekt_zielony = new Gpio(pin_zielony, 'in');
var obiekt_niebieski = new Gpio(pin_niebieski, 'in');

//zmienne
var zolty = 0;
var zielony = 0;
var niebieski = 0;
var logcount = 0;
var przyspieszenie = 0; //w %
var skret = 0;
var kierunek_skretu = 0; // 0 - lewo ; 1 - prosto; 2 - prawo
var aktualny_skret = 0;
var opoznienie_przyspieszenia = 0.02;
var opoznienie_skrecania = 0.25;
var bezpiecznik = 0;
var przod_old = 0, wsteczny_old = 0;
var wlewo_old = 0, wprawo_old = 0;
var przyspieszenie_old = 0, skret_old = 0;

//center_wheels();
console.log('Pi Car we server listening on port 8080 visit http://ipaddress:8080/socket.html');


lastAction = "";

function bezpiecznik_skretu()
{
	bezpiecznik++;
	if(bezpiecznik > 10)
	{
		if(aktualny_skret == 0) {aktualny_skret = 2;}
		else if(aktualny_skret == 2) {aktualny_skret = 0;}
		bezpiecznik = 0;
	}
}

function center_wheels()
{
	piblaster.setPwm(pin_wlewo, 1);	
	piblaster.setPwm(pin_wprawo, 0);
	piblaster.setPwm(pin_skretu, 0.5); //throttle using soft pwm
	while(!(niebieski == 1 && zielony == 1))
	{
		piblaster.setPwm(pin_skretu, 0.2);
		obiekt_zielony.read(function(err, value) {
			 zielony = value;
			});
		obiekt_niebieski.read(function(err, value) {
			 niebieski = value;
			});
	}
	piblaster.setPwm(pin_skretu, 0);
	
	piblaster.setPwm(pin_wlewo, 0);	
	piblaster.setPwm(pin_wprawo, 1);
	while(!(zolty == 1))
	{
		piblaster.setPwm(pin_skretu, 0.1);
		obiekt_zolty.read(function(err, value) {
			 zolty = value;
			});
	}
	piblaster.setPwm(pin_skretu, 0);
	aktualny_skret = 1;
	
	console.log('Kalibracja ukonczona');
}

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
		var przod, wsteczny;
		var wlewo, wprawo;
		
		logcount = logcount + 1;
		
		temp_kierunek = data.gamma / 45;
		temp_skret = data.beta / 45;
		obiekt_zolty.read(function(err, value) {
			 zolty = value;
			});
		obiekt_zielony.read(function(err, value) {
			 zielony = value;
			});
		obiekt_niebieski.read(function(err, value) {
			 niebieski = value;
			});
		
		if(temp_kierunek >= 0)
		{
		 	przod = 1;	
			wsteczny = 0;
		}
		else 
		{
		 	przod = 0;	
			wsteczny = 1;
 			temp_kierunek = Math.abs(temp_kierunek);
		}
		
		if(temp_kierunek < 0.20) {temp_kierunek = 0;}
		else if(temp_kierunek > 1) {temp_kierunek = 1;}
			
		if( Math.abs(temp_kierunek - przyspieszenie) < opoznienie_przyspieszenia) { przyspieszenie = temp_kierunek; }
		else
		{
			if(temp_kierunek > przyspieszenie) { przyspieszenie = przyspieszenie + opoznienie_przyspieszenia;}
			else { przyspieszenie = przyspieszenie - opoznienie_przyspieszenia;}
		}
		
	 	if(przod != przod_old) {piblaster.setPwm(pin_przod, przod);}
		if(wsteczny != wsteczny_old) {piblaster.setPwm(pin_wsteczny, wsteczny);}
	
		// Poczatek sekcji skretu
		if(Math.abs(temp_skret) < 0.15) {kierunek_skretu = 1;}
		else if(temp_skret > 0) {kierunek_skretu = 2;}
		else if(temp_skret < 0) {kierunek_skretu = 0;}
		temp_skret = Math.abs(temp_skret);
		if(temp_skret < 0.15) {temp_skret = 0;}
		else if(temp_skret > 1) {temp_skret = 1;}
		
		if(niebieski == 1 && zielony == 0) {aktualny_skret = 0;}
		else if(niebieski == 0 && zielony == 1) {aktualny_skret = 2;}
		else if(zolty == 1) {aktualny_skret = 1;}
		
		switch(kierunek_skretu){
			case 0:
				wlewo = 1;	
				wprawo = 0;
				if(niebieski == 1 && zielony == 1 && aktualny_skret == 0)
				{
					wlewo = 0;	
					temp_skret = 0;
				//	bezpiecznik_skretu();
				}
				break;
			case 1:
				if(aktualny_skret == 1) //kola sa juz prosto
				{
		 			wlewo = 0;	
					wprawo = 0;
					temp_skret = 0;
				}
				else if(aktualny_skret == 2 ) // kola sa skrecone w prawo
				{
					wlewo = 1;	
					wprawo = 0;
					temp_skret = 0.2;
				//	bezpiecznik_skretu();
				}
				else if(aktualny_skret == 0) // kola sa skrecone w lewo
				{
					wlewo = 0;	
					wprawo = 1;
					temp_skret = 0.2;
				//	bezpiecznik_skretu();
				}
				break;
			case 2:
				wlewo = 0;	
				wprawo = 1;
				if(niebieski == 1 && zielony == 1 && aktualny_skret == 2)
				{
					wprawo = 0;
					temp_skret = 0;
				//	bezpiecznik_skretu();
				}
				break;
			default:
				wlewo = 0;	
				wprawo = 0;
				temp_skret = 0;
				break;
		}
		
		if(wlewo != wlewo_old)	{piblaster.setPwm(pin_wlewo, wlewo);}
		if(wprawo != wprawo_old) {piblaster.setPwm(pin_wprawo, wprawo);}
		skret = temp_skret;
		
		
		// dont let char echos slow dn the app; we are running at 20Hz
		// dont le the console limit this due to slow echoing of chars
		if(logcount > 20)
		{
			//@ 2 Hz
			logcount = 0;
			console.log("aktualny_skret "+aktualny_skret + "kierunek_skretu"+kierunek_skretu);
			console.log("Zolty "+zolty+" Zielony: "+zielony + " Niebieski: "+niebieski);
			console.log("Beta: "+data.beta+" Gamma: "+data.gamma);
			console.log("Przyspieszenie: "+Math.round(przyspieszenie*100)+"%  Skret: "+Math.round(skret*100)+"%");
		}

		//control car using clever pwm gpio library
		
		if(przyspieszenie != przyspieszenie_old) {piblaster.setPwm(pin_przyspieszenie, przyspieszenie);} //throttle using soft pwm
		if(skret != skret_old) {piblaster.setPwm(pin_skretu, skret);} //throttle using soft pwm
		
		przod_old = przod;
		wsteczny_old = wsteczny;
		wlewo_old = wlewo;
		wprawo_old = wprawo;
		przyspieszenie_old = przyspieszenie;
		skret_old = skret;
		
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
