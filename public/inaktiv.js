$(document).ready(function(){
	var key = "";
	
	window.onload = function () {
		document.getElementById('loadingsite').style.display = "none";
		document.getElementById('javaskriptfehler').style.display = "none";
		//suchen ob die daten in der url sind wenn ja abschicken
		var temp = location.search;
		if(temp.indexOf("?key=") != -1){
			key  = location.search.split('?key=')[1];				
		}
	}

	function mybutton(){
		location.replace('/?key=' + key);
	}
	$('#mybutton').click(mybutton);		
});
