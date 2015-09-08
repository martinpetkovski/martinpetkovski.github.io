var PamTypewriter = (function(){

	var subtitles;
	var interval;
	var rnd;
	var prev;
	var subIntID;
	var i;
	var changeSubtitleInterval;
	var threshold;
	var element;

	function PamTypewriter(element) {
		this.subtitles = [
			"cube rubixer", 
			"development ninja", 
			"computer engineering student", 
			"voodoo guitar specialist",  
			"retro gamer", 
			"brainstormer extraordinare", 
			"trekkie"
			];

		this.element = element;
		this.interval = 2700;
	}

	PamTypewriter.prototype.writeChar = function() {
		var currentChar = this.subtitles[this.rnd].charAt(this.i);

		$(this.element).append(currentChar);
		
		this.i++;
		if (this.i == this.subtitles[this.rnd].length)
		{
			clearInterval(this.subIntID);
		}
	}

	PamTypewriter.prototype.changeSubtitle = function(callback) {
		$(this.element).html("");

		while(this.prev == this.rnd)
			this.rnd = Math.floor(Math.random() * this.subtitles.length);
		
		this.prev = this.rnd
		
		this.i=0;
		
		this.subIntID = setInterval(this.writeChar.bind(this), 40);
	}

	PamTypewriter.prototype.stopIfTransparent = function() {
		if ($(this.element).css("opacity") == 0) {
			clearInterval(this.changeSubtitleInterval);
			this.changeSubtitleInterval = false;
		}
		
		if ($(this.element).css("opacity") != 0 && this.changeSubtitleInterval === false) {
			this.changeSubtitleInterval = setInterval(this.changeSubtitle.bind(this), this.interval);
		}
	}

	PamTypewriter.prototype.fixFocus = function() {
		var that = this;
		$(window).blur(function(){
			clearInterval(that.changeSubtitleInterval);
			that.changeSubtitleInterval = false;
		});

		$(window).focus(function(){
			if ($(that.element).css("opacity") != 0 && that.changeSubtitleInterval === false) {
				that.changeSubtitleInterval = setInterval(that.changeSubtitle.bind(that), that.interval);
			}
		});
	}

	PamTypewriter.prototype.startTypewriting = function() {
		this.changeSubtitleInterval = setInterval(this.changeSubtitle.bind(this), this.interval);
	}

	return PamTypewriter;
})();