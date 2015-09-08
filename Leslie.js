var skills = [
	    
	    new Skill("C", 1262304000, 42, true),
	    new Skill("C++", 1283299200, 100, true),
	    new Skill("Java", 1412121600, 67, true),
	    new Skill("C#", 1328054400, 70, false),
		new Skill("HTML", 1251763200, 66, true),
		new Skill("CSS", 1277942400, 73, true),
		new Skill("SQL", 1285891200, 71, true),
		new Skill("PHP", 1285891200, 29, false),
		new Skill("JavaScript", 1291161600, 30, false),
		new Skill("MatLab", 1412121600, 14, false),
		new Skill("GML", 1388534400, 22, false)
		
		];

var Leslie = (function(){
	var titleColors;
	
	function Leslie() {
		this.titleColors = ["#18163C", "#39AB4D", "#DE0325", "#222222", "#A60F27", "#19524A"];
	}
	
	Leslie.prototype.appendSkills = function() {
		for(j = 0; j<skills.length; j++)
		{
			$('.experience').append('<tr class="skill"><td class="name">' + skills[j].name + '</td><td class="bar"><div class="fullBar"><div class="filledBar">&nbsp;</div></div></td></tr>');
		}	
	};

	Leslie.prototype.calculateHomeWrapperDimensions = function() {
		var paddingTop = ($(window).height() / 2) - ( parseInt($(".homeWrapper .title").css("fontSize")) / 2);		
		$(".homeWrapper").css("paddingTop", paddingTop);	
		$(".homeWrapper").css('height', $(window).height() - paddingTop);
	}

	Leslie.prototype.setTitleColors = function() {
		var that = this;
		$('.workWrapper .itemsWrapper .itemBox .title').each(function() {
			var rnd = Math.floor(Math.random() * that.titleColors.length);
			$(that).css('backgroundColor', that.titleColors[rnd]);
		});
	}

	return Leslie;
})();