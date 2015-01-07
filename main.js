var subtitles = ["cube rubixer", "web development ninja", "computer engineering student", "voodoo guitar specialist",  "retro gamer", "brainstormer extraordinare" ]
var rnd;
var prev;
var subIntID;
var i;
var changeSubtitleInterval;

var Skill = (function(){
	var name;
	var time;
	var active;
	var evaluation;
	var start;
	var d;
	
	function Skill(name, time, evaluation, active) {
		this.name = name;
		this.d = (new Date()).getTime() / 1000;
		this.start = this.d - 1251763199;
		this.time = this.d - time;
		this.active = active;
		this.evaluation = evaluation;
	}
	
	Skill.prototype.getName = function() {
		return this.name;
	}
	
	Skill.prototype.getPercentage = function() {
		return ((this.time / this.start) * 100);
	}
	
	return Skill;
})();

var skills = [
	      
		new Skill("HTML", 1251763200, 86, true),
		new Skill("CSS", 1277942400, 100, true),
		new Skill("JavaScript", 1291161600, 30, true),
		new Skill("JQuery", 1301616000, 48, true),
		new Skill("PHP", 1285891200, 69, true),
		new Skill("MySQLi", 1285891200, 71, true),
		new Skill("C", 1262304000, 42, false),
	        new Skill("C++", 1283299200, 95, true),
		new Skill("C#", 1328054400, 70, false),
		new Skill("Java", 1412121600, 67, true),
		new Skill("MatLab", 1412121600, 14, false),
		new Skill("GML", 1388534400, 22, false)
		
		];

function getPercentage(id) {
	/*var p = 0;
	for(j=0;j<skills.length;j++)
		p += skills[j].time;
	
	return (100 - ((skills[id].time / p) * 100));*/
	

	var byTimeSpent = skills[id].getPercentage();
	var byEvaluation = skills[id].evaluation;
	
	return ((byTimeSpent + byEvaluation) / 2);
}

function writeChar() {
	var currentChar = subtitles[rnd].charAt(i);

	$('.homeWrapper .itemsWrapper .subtitle').append(currentChar);
	
	i++;
	if (i == subtitles[rnd].length)
	{
		clearInterval(subIntID);
	}
}

function changeSubtitle(callback) {
	$('.homeWrapper .itemsWrapper .subtitle').html("");
	
	while(prev == rnd)
		rnd = Math.floor(Math.random() * subtitles.length);
	
	prev = rnd
	
	i=0;
	
	subIntID = setInterval(writeChar, 40);	
}

$(window).focusout(function() {
	clearInterval(changeSubtitleInterval);
	changeSubtitleInterval = false;
});

$(window).focusin(function() {
	if ($('.homeWrapper .itemsWrapper .subtitle').css("opacity") != 0 && changeSubtitleInterval == false) {
		changeSubtitleInterval = setInterval(changeSubtitle, 2700);
	}
});

$(document).ready(function(){
	
	
	for(j = 0; j<skills.length; j++)
	{
		$('.experience').append('<tr class="skill"><td class="name">' + skills[j].name + '</td><td class="bar"><div class="fullBar"><div class="filledBar">&nbsp;</div></div></td></tr>');
	}
	
	var paddingTop = ($(window).height() / 2) - ( parseInt($(".homeWrapper .title").css("fontSize")) / 2);		
	$(".homeWrapper").css("paddingTop", paddingTop);	
	$(".homeWrapper").css('height', $(window).height() - paddingTop);
	
	$(window).load(function(){
		$('.blue').fadeIn(1000);
		$('.other').delay(700).animate({'fontSize':100}, 1000, 'easeInOutCubic').animate({'opacity': 1}, 1000);
		changeSubtitleInterval = setInterval(changeSubtitle, 2700);
		
		$(window).scroll(function(){
			
			if ($('.homeWrapper .itemsWrapper .subtitle').css("opacity") == 0) {
				clearInterval(changeSubtitleInterval);
				changeSubtitleInterval = false;
			}
			
			if ($('.homeWrapper .itemsWrapper .subtitle').css("opacity") != 0 && changeSubtitleInterval == false) {
				changeSubtitleInterval = setInterval(changeSubtitle, 2700);
			}
			
			var scroll = $(window).scrollTop();		
			var height = $(document).height() - $(window).height();
			
			var scrollCoef = scroll / height;
			var trueScrollCoef = scroll / $(window).height();
			var pos = - 300 + (scrollCoef * 700);
			
			
			$('body').css('backgroundPosition', '0px ' + pos + 'px' );
			$('.homeWrapper').css({'opacity': 1 - trueScrollCoef * 3});
			$('.homeWrapper .itemsWrapper .subtitle').css({'opacity': 1 - trueScrollCoef * 8});
			
			var iterator = 0;
			
			$('.itemBox .skill').each(function(){
				
				var offset = $(this).offset().top;
				
				if(offset < (scroll + $(window).height()))
				{
					
					$(this).find('.filledBar').delay(500).animate({'width': getPercentage(iterator) + '%'}, 2000);
					
					if (skills[iterator].active === false)
					{
						$(this).find('.filledBar').animate({'backgroundColor': '#CC0'}, 500);
					}
					
					
				}
				
				iterator++;
			});
	
		});
	});
});
