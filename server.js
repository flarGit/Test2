var debug = true;

var chatTime = 120;
var groupsize = 3;

var playercountname = 1;
var groupcount = 0;
var groupcountname = 1;

var idcheck = new Map();  			//pw / randpw
var pwtoGroup = new Map();
var pwtoName = new Map();
var pwtoURL = new Map();
var socketidtopw = new Map();
var pwtosocketid = new Map();
var groupGelb = new Map();
var groupGruen = new Map();			//key = groupname   value = map(socket.id,socket.id)
var grouptoActive = new Map();		// 0 = start 1=warten 2 = läuft 3 = timeout 4 = kill
var startChatDate = new Map();		//zeit wann der caht gestartet wurde key = pw    value = Date

/*var fs = require('fs');
var conf = require('./config.json');
var freekeys = new Set(conf.freekeys);
*/var servermessage = "";
var chatmessage = "";	

var express = require('express');
var app = express();

var cookieSession = require('cookie-session');
var bodyParser = require('body-parser');

app.use(cookieSession({
    name: 'session',
    keys: ['key1', 'key2']
}));
app.use(bodyParser.urlencoded({ extended: false }));

app.configure(function(){
	// statische Dateien ausliefern
	app.use(express.static(__dirname + '/public'));
});

function checkAuth(req, res, next) {
    if (!req.session.user) {
        res.redirect('/');
    } else {
        next(); 
	}
}

app.get('/', function (req, res) {
	console.log('Anfrage:'+new Date()+'   '+ req.ip);
	servermessage = servermessage + "" + new Date() + "@user Anfrage@" + req.ip + "\n";
    res.sendfile(__dirname + '/public/login.html');
});

app.post('/login', function (req, res) {
    var pw = req.body.password;
	req.session.user = pw;
	pwtoURL.set(pw,"hallo"+pw);
    /*if (pw === 'test1') {
        req.session.user = pw;
		pwtoURL.set(pw,"hallo1");
    } else if (pw === 'test2') {
		req.session.user = pw;
		pwtoURL.set(pw,"hallo2");
    } else if (pw === 'test3') {
		req.session.user = pw;
		pwtoURL.set(pw,"hallo3");
    } else if (pw === 'test4') {
		req.session.user = pw;
		pwtoURL.set(pw,"hallo4");
    }*/
	idcheck.set(pw,rand(100000,999999));
    res.redirect('/player'+'?pw='+pw+'?temppw='+idcheck.get(pw));
});

app.get('/player', checkAuth, function (req, res) {
	//var user = req.query.id;
	//console.log('username parameter:'+user);
	res.sendfile(__dirname + '/public/player.html', {user: req.session.user});
});

app.get('/inaktiv', function (req, res) {
	res.sendfile(__dirname + '/public/inaktiv.html');
});

app.get('/ende', function (req, res) {
	res.sendfile(__dirname + '/public/ende.html');
});

//kann eigendlich weg echzeit überwachung :)
app.get('/logout', function (req, res) {
	connectionsfull[req.session.user].disconnect();
    delete connectionsfull[req.session.user];
    delete req.session.user;
    res.redirect('/');
	console.log('user logout');
	servermessage = servermessage + "" + new Date() + "@user Logout@\n";
});

//funktionen----------------------------------------------------------------
//zufall :)
function rand (min, max) {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}
//speichern in datei
/*function saveFile(filename, savedata){
	return new Promise(function(resolve, reject){
		fs.appendFile(__dirname + '/save/'+filename+'.txt', savedata, function (err) {
		if (err) 
			return console.log(err);
		});
	});
}*/
function saveFileTimer(){
	if(servermessage.length > 0){
		var tempservermessage = servermessage;
		servermessage = "";
//		saveFile('servermessage', tempservermessage);
		console.log('\u001B[36m' + new Date() + 'save servermessage' + '\u001b[0m');
	}
	if(chatmessage.length > 0){
		var tempchatmessage = chatmessage;
		chatmessage = "";
//		saveFile('chatmessage', tempchatmessage);
		console.log('\u001B[36m' + new Date() + 'save chatmessage' + '\u001b[0m');
	}
	setTimeout(function() {
		saveFileTimer();
	}, 180 * 1000);
}
//--------------------------------------------------------------------------

var http = require('http');
var server = http.createServer(app);
server.listen(8080);
var io = require('socket.io').listen(server);

//für logout
var connectionsfull = {};


io.sockets.on('connection', function (socket) {
    // der Client ist verbunden
	console.log('Verbunden mit '+ socket.id);
	servermessage = servermessage + "" + new Date() + "@Server Verbunden mit@" + socket.id + "\n";
	
	socket.on('chatnachricht', function (data) {
		// und an mich selbst, wieder zurück das ich ihn auch sehe
		var pw = socketidtopw.get(socket.id);
		var group = pwtoGroup.get(pw);
		var name = pwtoName.get(pw);
		var idSocketid = new Map();
		idSocketid = groupGruen.get(group);
		if(typeof idSocketid !== "undefined"){
			idSocketid.forEach(function(value, key) {
				if(typeof io.sockets.connected[value] === "undefined"){
					killsocket(key);
				}else{
					io.sockets.connected[key].emit('awchatnachricht', { zeit: new Date(), text: data.text,name: name});
				}
			});
		}
		chatmessage = chatmessage + "" + new Date() + "@message" + "@from@" + name + "@group@" + group + "@text@" + data.text + "\n";
		//console.log(new Date() + ' from:' + name + ' group:'+ group +' text:' + data.text);
	});
	
	//erstes hallo und reconnect
	socket.on('join', function(data) {
		if(data.tempPW == idcheck.get(data.pw)){
			var pw = data.pw;
			//zuordnung der socket und setzen auf gelb liste
			connectionsfull[pw] = socket;
			socketidtopw.set(socket.id,pw);
			pwtosocketid.set(pw,socket.id);
			//suchen ob sie schon eine group zugerodnet ist
			if(typeof pwtoGroup.get(pw) === "undefined"){
				//neue group falls die noch offene gekillt wurde
				if(grouptoActive.get(groupcountname) == 4){
					groupcountname = groupcountname + 1;
					grouptoActive.set(groupcountname,1);
					groupcount = 0;
				}
				pwtoGroup.set(pw,groupcountname);
				groupcount = groupcount + 1;
				//neue group falls die alte voll ist
				if(groupcount >= groupsize){
					groupcountname = groupcountname + 1;
					grouptoActive.set(groupcountname,1);
					groupcount = 0;
				}
				socket.emit('waitstart', {name: data.name,groupsize:groupsize,chatTime: chatTime});
				var temp = new Map();
				temp = groupGelb.get(pwtoGroup.get(pw));
				if(typeof temp === "undefined"){
					temp = new Map();
					temp.set(socket.id,socket.id);
					groupGelb.set(pwtoGroup.get(pw),temp);
				}else{
					temp.set(socket.id,socket.id);
				}
			}else{
				//prüfen ob die gruppe noch aktive ist oder schon tod ist
				//falls die gruppe noch im waiting screen ist
				if(grouptoActive.get(pwtoGroup.get(pw)) == 1){
					console.log('blablabla hab ich dich' + pwtoGroup.get(pw));
					killgroup(pwtoGroup.get(pw));
				}
				//starte chat falls gruppe noch aktive
				if(grouptoActive.get(pwtoGroup.get(pw)) == 2){
					temp = groupGruen.get(pwtoGroup.get(pw));
					temp.set(socket.id,socket.id);
					groupGruen.set(pwtoGroup.get(pw),temp);
					socket.emit('startchatre', {name:pwtoName.get(pw),date: startChatDate.get(pw),serverdatenow: new Date().getTime(),chatTime: chatTime});
				}
				if(grouptoActive.get(pwtoGroup.get(pw)) == 3){
					socket.emit('ende', {mylink:pwtoURL.get(pw)});
				}
			}
		}else{
			console.log('da hat jemand was an der URL geaendert --> logout');
			servermessage = servermessage + "" + new Date() + "@da hat jemand was an der URL geaendert --> logout@" + "\n";
			socket.emit('logout', {});
		}
		//io.sockets.emit('awchatctoc', { zeit: new Date(), text: data.name + ' ist dem chat beigetreten',name: 'SYSTEM'});
		//console.log(new Date() +""+ data.name + "ist dem chat beigetreten SYSTEM");
    });
	
	socket.on('joinstatus', function(data) {
		var gruen = 0;
		var gelb = 0;
		var group = pwtoGroup.get(data.pw);
		var abbruch = false;
		
		var idSocketid = new Map();
		idSocketid = groupGelb.get(pwtoGroup.get(data.pw));
		if(typeof idSocketid !== "undefined"){
				idSocketid.forEach(function(value, key) {
					if(typeof io.sockets.connected[value] === "undefined"){
						killsocket(key);
						abbruch = true;
					}
				});
			gelb = idSocketid.size;
		}
		
		idSocketid = groupGruen.get(pwtoGroup.get(data.pw));
		if(typeof idSocketid !== "undefined"){
			idSocketid.forEach(function(value, key) {
				if(typeof io.sockets.connected[value] === "undefined"){
					killsocket(key);
					abbruch = true;
				}
			});
			gruen = idSocketid.size;
		}
		//zusätlicher schutz das es max einmal startet für timer		
		if(gruen == groupsize && grouptoActive.get(group) == 1){
			//alle starten gleichzeitig und prüfen ob sie noch da sind
			console.log(new Date() + ' Die group '+ pwtoGroup.get(data.pw) + ' startet jetzt');
			chatmessage = chatmessage + "" + new Date() + "@start@" + "@group@" + pwtoGroup.get(data.pw) + "\n";
			servermessage = servermessage + "" + new Date() + "@start@" + "@group@" + pwtoGroup.get(data.pw) + "\n";
			var idSocketid = new Map();
			idSocketid = groupGruen.get(group);
			
			if(typeof idSocketid !== "undefined"){
				idSocketid.forEach(function(value, key) {
					if(typeof io.sockets.connected[value] === "undefined"){
						killsocket(key);
						abbruch = true;
					}
				});
			}
			if(abbruch){
			//kill der gruppe neueinwahl der verbleibenden wird am ende auch ausgeführt falls aktiv
			
			}else{
				if(typeof idSocketid !== "undefined"){
					grouptoActive.set(pwtoGroup.get(data.pw),2);
					var name = 1;
					setTimeout(function() {
						mytimeout(group);
					}, chatTime * 1000);
					idSocketid.forEach(function(value, key) {
						if(typeof io.sockets.connected[value] === "undefined"){
						}else{
							io.sockets.connected[key].emit('startchat', {name:name});
							pwtoName.set(socketidtopw.get(key),name);
							startChatDate.set(socketidtopw.get(key),new Date().getTime());
							name = name + 1;
						}
					});
				}
			}
		}else{
			socket.emit('rejoinstatus', {gruen: gruen,gelb: gelb,groupsize: groupsize});
		}
		if(abbruch){
			//kill der gruppe neueinwahl der verbleibenden
			killgroup(group);
		}
	});
	
	socket.on('joinstatusgruen', function(data) {
		var idSocketid = new Map();
		idSocketid = groupGelb.get(pwtoGroup.get(data.pw));
		if(typeof idSocketid !== "undefined"){
			//das sollte eigendlich nie passieren aber sicher ist sicher
			idSocketid = groupGelb.get(pwtoGroup.get(data.pw));
			idSocketid.delete(socket.id);
		}
		
		var temp = new Map();
		temp = groupGruen.get(pwtoGroup.get(data.pw));
		if(typeof temp === "undefined"){
			temp = new Map();
			temp.set(socket.id,socket.id);
			groupGruen.set(pwtoGroup.get(data.pw),temp);
		}else{
			temp.set(socket.id,socket.id);
		}
	});
	socket.on('joinstatusgelb', function(data) {
		var idSocketid = new Map();
		idSocketid = groupGruen.get(pwtoGroup.get(data.pw));
		if(typeof idSocketid !== "undefined"){
			//das sollte eigendlich nie passieren aber sicher ist sicher
			idSocketid = groupGruen.get(pwtoGroup.get(data.pw));
			idSocketid.delete(socket.id);
		}
		
		var temp = new Map();
		temp = groupGelb.get(pwtoGroup.get(data.pw));
		if(typeof temp === "undefined"){
			temp = new Map();
			temp.set(socket.id,socket.id);
			groupGelb.set(pwtoGroup.get(data.pw),temp);
		}else{
			temp.set(socket.id,socket.id);
		}
	});
	
	//timer für das ende der Group
	function mytimeout(group) {
		console.log(new Date() + 'Beende group '+ group);
		chatmessage = chatmessage + "" + new Date() + "@close@" + "@group@" + group + "\n";
		servermessage = servermessage + "" + new Date() + "@close@" + "@group@" + group + "\n";
		grouptoActive.set(group,3);
		var idSocketid = new Map();
		idSocketid = groupGruen.get(group);
		if(typeof idSocketid !== "undefined"){
			idSocketid.forEach(function(value, key) {
				if(typeof io.sockets.connected[value] === "undefined"){
					killsocket(key);
				}else{
					io.sockets.connected[key].emit('ende', { mylink: pwtoURL.get(socketidtopw.get(key))});
				}
			});
		}
	}
	
	//löschen der Socket id (liste gruen und gelb)
	function killsocket(key){
		var pw = socketidtopw.get(key);
		if(typeof pw !== "undefined"){
			console.log('\u001b[31m check PlayerID '+ pw +'/'+ key + ' verloren \u001b[0m');
			if (debug) console.log("\007");
			servermessage = servermessage + "" + new Date() + "@check PlayerID verloren@" + "@key@" + key + "@pw@" + pw + "\n";
			var idSocketid = new Map();
			idSocketid = groupGruen.get(pwtoGroup.get(pw));
			if(typeof idSocketid !== "undefined"){
				if(idSocketid.has(key))idSocketid.delete(key);
			}
			
			var idSocketid2 = new Map();
			idSocketid2 = groupGelb.get(pwtoGroup.get(pw));
			if(typeof idSocketid2 !== "undefined"){
				if(idSocketid2.has(key))idSocketid2.delete(key);
			}
		}
	}
	
	//kill einer group
	function killgroup(group){
		console.log('\u001b[31m Kill Group '+ group + '\u001b[0m');
		if (debug) console.log("\007");
		servermessage = servermessage + "" + new Date() + "@Kill Group@" + "@group@" + group + "\n";
		grouptoActive.set(group,4);
		
		if(groupGelb.has(group))groupGelb.delete(group);
		if(groupGruen.has(group))groupGruen.delete(group);
		
		pwtoGroup.forEach(function(value, key) {
			if(value == group){
				if(typeof io.sockets.connected[pwtosocketid.get(key)] === "undefined"){
					killsocket(key);
				}else{
					console.log('\u001b[31m PlayerID '+ key + ' wird rejoind \u001b[0m');
					servermessage = servermessage + "" + new Date() + "@to rejoind@" + "@key@" + key + "\n";
					io.sockets.connected[pwtosocketid.get(key)].emit('rejoin', {});
				}
				pwtoGroup.delete(key);
			}
		});
	}
});





// Portnummer in die Konsole schreiben
console.log('' + new Date() + 'Der Server läuft nun');
servermessage = servermessage + "" + new Date() + "@Der Server läuft nun@" + "\n";
//für die erste group nach server start
grouptoActive.set(1,1);
saveFileTimer();