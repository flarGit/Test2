$(document).ready(function(){
	var name = "";
	var pw = "";
	var tempPW = "";
	//das die chat time nur einmal gestartet wird und zur prüfung ob die inaktivität egal ist
	var ischatstart = false;
	var redgroupsize = 1;
	var isinaktivrun = false;
	
	// WebSocket
	var socket = io.connect();
	socket.on('connect', function () {
		//?pw=pw?temppw=
		var temp = location.search.split('?pw=')[1];
		var mypw = temp.split('?temppw=')[0];
		pw = mypw;
		var mytempPW = temp.split('?temppw=')[1];
		tempPW = mytempPW;
		socket.emit('join', {pw:pw,tempPW:tempPW});
	});
	
	window.onload = function () {
		document.getElementById("javaskriptfehler").style.display = "none";
		document.getElementById("loadingsite").style.display = "none";
		document.getElementById("mychat").style.display = "none";
	}

	function chatnachrichtsenden(){
		// Eingabefelder auslesen
		var text = $('#chattextinput').val();
		// Socket senden
		socket.emit('chatnachricht',{name: name,pw:pw, text: text });
		// Text-Eingabe leeren
		$('#chattextinput').val('');
	}
	socket.on('awchatnachricht', function (data) {
		var zeit = new Date(data.zeit);
		if(name == data.name){
			$('#chattextform').append(
				'<div id="chattext" name="chattext">You:<br>'+ data.text + '</div>'
			);
		}else{
			$('#chattextform').append(
				'<div id="chattext" name="chattext">Player'+data.name+':<br>'+ data.text + '</div>'
			)
		}
		//scroll down
		if(document.getElementById("autoscroll").checked){
			document.getElementById("chattextform").scrollTop = 10000;
		}
	});	
	
	
	socket.on('waitstart', function (data) {
		vartime = data.chatTime;
		document.getElementById("wait").style.display = "";
		$('#waitme').empty();
		$('#waitme').append('welcome <br>Please wait until all other participants ('+data.groupsize+') to be ready:');
		for (i = 0; i < data.groupsize; i++) { 
			$('#waitother').append('<font color="#FF0000">player '+ (i+1) +'</font><br>');
		}
		tickenforwaitONOFF = true;
		tickenforwait();
	});	
	
	//falls die gruppe gekillt wird
	socket.on('rejoin', function (data) {
		//neu verbinden nach 2 sekunden
		window.setTimeout(rejoin, 2000);
	});
	function rejoin(){
		socket.emit('join', {pw:pw,tempPW:tempPW});
		if(document.getElementById("waitbereit").value === "not ready anymore"){
			socket.emit('joinstatusgruen',{name:name,pw:pw});
		}
	}
	
	socket.on('rejoinstatus', function (data) {
		redgroupsize = data.groupsize - data.gruen - data.gelb; 
		//timer um bei inaktivität zu kicken
		if(redgroupsize == 0 && isinaktivrun == false && (document.getElementById("waitbereit").value === "ready")){
			isinaktivrun = true;
			window.setTimeout(mytimeinaktiv, vartimeinaktiv);
		}
		
		$('#waitother').empty();
		for (i = 0; i < data.groupsize; i++) {
			if(data.gruen > i){
				$('#waitother').append('<font color="#00C000">'+ (i+1) +' Player</font><br>');
			}else if(data.gelb + data.gruen > i){
				$('#waitother').append('<font color="#DBA901">'+ (i+1) +' Player</font><br>');
			}else{
				$('#waitother').append('<font color="#FF0000">'+ (i+1) +' Player</font><br>');
			}
		}
	});
	socket.on('startchat', function (data) {
		tickenforwaitONOFF = false;
		name = data.name;
		document.getElementById("wait").style.display = "none";
		document.getElementById("mychat").style.display = "";
		if(ischatstart == false){
			ischatstart = true;
			mytime();
		}
	});
	//für reconnecht mit restzeitsetzen
	socket.on('startchatre', function (data) {
		vartime = data.chatTime;
		tickenforwaitONOFF = false;
		name = data.name;
		document.getElementById("wait").style.display = "none";
		document.getElementById("mychat").style.display = "";
		vartime = vartime - (Math.round((data.serverdatenow - data.date)/1000));
		//das nichts negatives angezeigt wird
		if(vartime < 0){
			vartime = 1;
		}
		if(ischatstart == false){
			ischatstart = true;
			mytime();
		}
	});
	
	
	
	socket.on('logout', function (data) {
		location.replace('/logout');
	});
	socket.on('ende', function (data) {
		location.replace('/ende?link=' + data.mylink);
	});
	
	function waitbereit(){
		if(document.getElementById("waitbereit").value === "ready"){
			document.getElementById("waitbereit").value = "not ready anymore";
			socket.emit('joinstatusgruen',{name:name,pw:pw});
			
		}
		else if(document.getElementById("waitbereit").value === "not ready anymore"){
			document.getElementById("waitbereit").value = "ready";
			socket.emit('joinstatusgelb',{name:name,pw:pw});
		}
		socket.emit('joinstatus',{name:name,pw:pw});
	}
	// bei einem Klick auf senden
	$('#chatnachrichtsendenkey').click(chatnachrichtsenden);
	$('#waitbereit').click(waitbereit);
	
	var timeinterval = 3000;
	var tickenforwaitONOFF = false;
	function tickenforwait(){	
		if(tickenforwaitONOFF){
			//console.log("Hallo Tick");
			joinstatusstart();
			window.setTimeout(tickenforwait, timeinterval);
		}
	}
	
	var vartime = 120;
	function mytime(){
		if(vartime > 0){
			//console.log("Hallo Tick");
			vartime = vartime - 1;
			$('#time').empty();
			if(vartime > 30){
				$('#time').append(vartime + ' seconds left');
			}else{
				$('#time').append('<font color="#FF0000">'+ vartime +' seconds left </font>');
			}
			window.setTimeout(mytime, 1000);
		}
	}
	
	var vartimeinaktiv = 90 * 1000;
	function mytimeinaktiv(){
		if(ischatstart == false && redgroupsize == 0 && (document.getElementById("waitbereit").value === "ready")){
			location.replace('/inaktiv?key=' + pw);
		}
		isinaktivrun = false;
	}
	
	function joinstatusstart(){
		socket.emit('joinstatus',{name:name,pw:pw});
	}
});
